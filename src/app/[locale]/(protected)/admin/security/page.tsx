"use client";

import { useState, useTransition } from "react";
import { Shield, Lock, Key, Smartphone, CheckCircle, AlertCircle, Eye, EyeOff, QrCode, Trash2 } from "lucide-react";
import { changePasswordAction, setupTOTPAction, enableTOTPAction, disableTOTPAction } from "@/app/actions/auth";

export default function SecuritySettingsPage() {
    const [isPending, startTransition] = useTransition();
    const [pwError, setPwError] = useState<string | null>(null);
    const [pwSuccess, setPwSuccess] = useState(false);
    const [showCurrentPw, setShowCurrentPw] = useState(false);
    const [showNewPw, setShowNewPw] = useState(false);

    // TOTP state
    const [totpStep, setTotpStep] = useState<"idle" | "setup" | "verify" | "enabled">("idle");
    const [totpUri, setTotpUri] = useState("");
    const [totpSecret, setTotpSecret] = useState("");
    const [totpCode, setTotpCode] = useState("");
    const [totpError, setTotpError] = useState<string | null>(null);
    const [totpSuccess, setTotpSuccess] = useState<string | null>(null);

    // Disable TOTP state
    const [disableCode, setDisableCode] = useState("");
    const [disableError, setDisableError] = useState<string | null>(null);

    // Check TOTP status on mount
    const [totpEnabled, setTotpEnabled] = useState<boolean | null>(null);
    useState(() => {
        fetch("/api/auth/me").then(r => r.json()).then(d => {
            if (d.totpEnabled !== undefined) setTotpEnabled(d.totpEnabled);
            if (d.totpEnabled) setTotpStep("enabled");
        }).catch(() => {});
    });

    const handlePasswordChange = (formData: FormData) => {
        setPwError(null);
        setPwSuccess(false);
        startTransition(async () => {
            const result = await changePasswordAction(formData);
            if (result?.error) setPwError(result.error);
            else if (result?.success) setPwSuccess(true);
        });
    };

    const handleSetupTOTP = () => {
        setTotpError(null);
        startTransition(async () => {
            const result = await setupTOTPAction();
            if (result?.error) setTotpError(result.error);
            else if (result?.success && result.uri && result.secret) {
                setTotpUri(result.uri);
                setTotpSecret(result.secret);
                setTotpStep("setup");
            }
        });
    };

    const handleEnableTOTP = () => {
        setTotpError(null);
        if (totpCode.length !== 6) {
            setTotpError("Enter a 6-digit code from your authenticator app.");
            return;
        }
        startTransition(async () => {
            const result = await enableTOTPAction(totpSecret, totpCode);
            if (result?.error) setTotpError(result.error);
            else if (result?.success) {
                setTotpStep("enabled");
                setTotpEnabled(true);
                setTotpSuccess("Google Authenticator enabled successfully!");
                setTotpCode("");
            }
        });
    };

    const handleDisableTOTP = () => {
        setDisableError(null);
        if (disableCode.length !== 6) {
            setDisableError("Enter your current authenticator code to disable.");
            return;
        }
        startTransition(async () => {
            const result = await disableTOTPAction(disableCode);
            if (result?.error) setDisableError(result.error);
            else if (result?.success) {
                setTotpStep("idle");
                setTotpEnabled(false);
                setTotpSuccess("Google Authenticator disabled.");
                setDisableCode("");
            }
        });
    };

    return (
        <div className="space-y-8 max-w-2xl">
            {/* Header */}
            <div>
                <h1 className="text-3xl font-serif text-white mb-2">Security Settings</h1>
                <p className="text-gray-500 font-light">Manage your admin password and two-factor authentication.</p>
            </div>

            {/* Password Change Section */}
            <div className="bg-[#1A1A1A] rounded-xl border border-white/5 overflow-hidden">
                <div className="px-6 py-4 border-b border-white/5 flex items-center gap-3">
                    <Lock className="w-5 h-5 text-[#CBA153]" />
                    <h2 className="text-white font-bold">Change Password</h2>
                </div>
                <form className="p-6 space-y-4" action={handlePasswordChange}>
                    {pwSuccess && (
                        <div className="p-3 bg-emerald-950/50 text-emerald-300 border border-emerald-900/50 text-sm rounded-lg flex items-center gap-2">
                            <CheckCircle size={16} /> Password updated successfully.
                        </div>
                    )}
                    {pwError && (
                        <div className="p-3 bg-red-950/50 text-red-300 border border-red-900/50 text-sm rounded-lg flex items-center gap-2">
                            <AlertCircle size={16} /> {pwError}
                        </div>
                    )}
                    <div>
                        <label className="block text-xs font-bold text-gray-400 mb-2 uppercase tracking-wider">Current Password</label>
                        <div className="relative">
                            <input
                                type={showCurrentPw ? "text" : "password"}
                                name="currentPassword"
                                required
                                className="w-full bg-[#0D0D0D] border border-white/10 text-white py-3 px-4 pr-12 rounded-lg focus:outline-none focus:border-[#CBA153] focus:ring-1 focus:ring-[#CBA153]/50 transition-all"
                            />
                            <button type="button" onClick={() => setShowCurrentPw(!showCurrentPw)} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white">
                                {showCurrentPw ? <EyeOff size={16} /> : <Eye size={16} />}
                            </button>
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-400 mb-2 uppercase tracking-wider">New Password</label>
                        <div className="relative">
                            <input
                                type={showNewPw ? "text" : "password"}
                                name="newPassword"
                                required
                                minLength={8}
                                className="w-full bg-[#0D0D0D] border border-white/10 text-white py-3 px-4 pr-12 rounded-lg focus:outline-none focus:border-[#CBA153] focus:ring-1 focus:ring-[#CBA153]/50 transition-all"
                            />
                            <button type="button" onClick={() => setShowNewPw(!showNewPw)} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white">
                                {showNewPw ? <EyeOff size={16} /> : <Eye size={16} />}
                            </button>
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-400 mb-2 uppercase tracking-wider">Confirm New Password</label>
                        <input
                            type="password"
                            name="confirmPassword"
                            required
                            minLength={8}
                            className="w-full bg-[#0D0D0D] border border-white/10 text-white py-3 px-4 rounded-lg focus:outline-none focus:border-[#CBA153] focus:ring-1 focus:ring-[#CBA153]/50 transition-all"
                        />
                    </div>
                    <button
                        type="submit"
                        disabled={isPending}
                        className="bg-[#CBA153] text-black font-bold uppercase tracking-widest text-xs py-3 px-6 rounded-lg hover:bg-white transition-all disabled:opacity-50"
                    >
                        {isPending ? "Updating..." : "Update Password"}
                    </button>
                </form>
            </div>

            {/* Google Authenticator Section */}
            <div className="bg-[#1A1A1A] rounded-xl border border-white/5 overflow-hidden">
                <div className="px-6 py-4 border-b border-white/5 flex items-center gap-3">
                    <Smartphone className="w-5 h-5 text-[#CBA153]" />
                    <h2 className="text-white font-bold">Google Authenticator (TOTP)</h2>
                    {totpEnabled && (
                        <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 bg-emerald-900/20 px-3 py-1 rounded-full ml-auto">
                            Enabled
                        </span>
                    )}
                </div>
                <div className="p-6 space-y-4">
                    {totpSuccess && (
                        <div className="p-3 bg-emerald-950/50 text-emerald-300 border border-emerald-900/50 text-sm rounded-lg flex items-center gap-2">
                            <CheckCircle size={16} /> {totpSuccess}
                        </div>
                    )}
                    {totpError && (
                        <div className="p-3 bg-red-950/50 text-red-300 border border-red-900/50 text-sm rounded-lg flex items-center gap-2">
                            <AlertCircle size={16} /> {totpError}
                        </div>
                    )}

                    {/* IDLE: Not enabled */}
                    {totpStep === "idle" && (
                        <div>
                            <p className="text-gray-400 text-sm mb-4 leading-relaxed">
                                Secure your admin account with Google Authenticator. When enabled, you&apos;ll enter a 6-digit code from your phone on each login instead of receiving an email code.
                            </p>
                            <button
                                onClick={handleSetupTOTP}
                                disabled={isPending}
                                className="bg-[#CBA153] text-black font-bold uppercase tracking-widest text-xs py-3 px-6 rounded-lg hover:bg-white transition-all disabled:opacity-50 flex items-center gap-2"
                            >
                                <QrCode size={16} /> {isPending ? "Generating..." : "Set Up Google Authenticator"}
                            </button>
                        </div>
                    )}

                    {/* SETUP: Show QR code */}
                    {totpStep === "setup" && (
                        <div className="space-y-5">
                            <div className="p-4 bg-white/5 rounded-lg border border-white/10">
                                <p className="text-gray-300 text-sm mb-3 font-medium">1. Scan this QR code with Google Authenticator:</p>
                                <div className="flex justify-center p-4 bg-white rounded-xl w-fit mx-auto">
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img
                                        src={`/api/auth/totp-qr?uri=${encodeURIComponent(totpUri)}`}
                                        alt="TOTP QR Code"
                                        width={200}
                                        height={200}
                                    />
                                </div>
                            </div>

                            <div className="p-4 bg-white/5 rounded-lg border border-white/10">
                                <p className="text-gray-300 text-sm mb-2 font-medium">Or enter this secret manually:</p>
                                <code className="block bg-[#0D0D0D] text-[#CBA153] px-4 py-3 rounded-lg font-mono text-sm tracking-[3px] select-all text-center break-all">
                                    {totpSecret}
                                </code>
                            </div>

                            <div>
                                <p className="text-gray-300 text-sm mb-3 font-medium">2. Enter the 6-digit code from the app:</p>
                                <div className="flex gap-3">
                                    <input
                                        type="text"
                                        inputMode="numeric"
                                        maxLength={6}
                                        value={totpCode}
                                        onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                                        placeholder="000000"
                                        className="flex-1 bg-[#0D0D0D] border border-white/10 text-white py-3 px-4 rounded-lg focus:outline-none focus:border-[#CBA153] focus:ring-1 focus:ring-[#CBA153]/50 transition-all font-mono text-xl tracking-[6px] text-center"
                                    />
                                    <button
                                        onClick={handleEnableTOTP}
                                        disabled={isPending || totpCode.length !== 6}
                                        className="bg-emerald-600 text-white font-bold uppercase tracking-widest text-xs py-3 px-6 rounded-lg hover:bg-emerald-500 transition-all disabled:opacity-50 whitespace-nowrap"
                                    >
                                        {isPending ? "Verifying..." : "Verify & Enable"}
                                    </button>
                                </div>
                            </div>

                            <button
                                onClick={() => { setTotpStep("idle"); setTotpCode(""); setTotpError(null); }}
                                className="text-gray-500 text-xs hover:text-white transition-colors uppercase tracking-wider"
                            >
                                ← Cancel Setup
                            </button>
                        </div>
                    )}

                    {/* ENABLED: Show disable option */}
                    {totpStep === "enabled" && (
                        <div className="space-y-4">
                            <div className="p-4 bg-emerald-950/20 rounded-lg border border-emerald-900/30">
                                <div className="flex items-center gap-3">
                                    <Shield className="w-6 h-6 text-emerald-400" />
                                    <div>
                                        <p className="text-emerald-300 font-medium text-sm">Two-Factor Authentication is Active</p>
                                        <p className="text-emerald-700 text-xs mt-0.5">You&apos;ll be asked for a Google Authenticator code on every login.</p>
                                    </div>
                                </div>
                            </div>

                            <div className="pt-2 border-t border-white/5">
                                <p className="text-gray-500 text-xs mb-3 uppercase tracking-wider font-bold">Disable Two-Factor</p>
                                {disableError && (
                                    <div className="p-3 bg-red-950/50 text-red-300 border border-red-900/50 text-sm rounded-lg flex items-center gap-2 mb-3">
                                        <AlertCircle size={16} /> {disableError}
                                    </div>
                                )}
                                <div className="flex gap-3">
                                    <input
                                        type="text"
                                        inputMode="numeric"
                                        maxLength={6}
                                        value={disableCode}
                                        onChange={(e) => setDisableCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                                        placeholder="Enter current code"
                                        className="flex-1 bg-[#0D0D0D] border border-white/10 text-white py-3 px-4 rounded-lg focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500/50 transition-all font-mono text-center tracking-wider"
                                    />
                                    <button
                                        onClick={handleDisableTOTP}
                                        disabled={isPending || disableCode.length !== 6}
                                        className="bg-red-800 text-white font-bold uppercase tracking-widest text-xs py-3 px-6 rounded-lg hover:bg-red-700 transition-all disabled:opacity-50 whitespace-nowrap flex items-center gap-2"
                                    >
                                        <Trash2 size={14} /> Disable
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
