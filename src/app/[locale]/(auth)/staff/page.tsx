"use client";

import { useState, useTransition, useRef, useEffect } from "react";
import { useRouter } from "@/i18n/routing";
import { staffLoginAction, registerStaffAction, verify2FAAction } from "@/app/actions/auth";
import { Shield, KeyRound, User, Mail, Lock, ArrowRight, AlertCircle, ShieldCheck, RefreshCw } from "lucide-react";

export default function StaffLoginPage() {
    const [mode, setMode] = useState<"login" | "register" | "2fa">("login");
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [isPending, startTransition] = useTransition();
    const [twoFAEmail, setTwoFAEmail] = useState("");
    const [isTotpMode, setIsTotpMode] = useState(false);
    const [pendingRole, setPendingRole] = useState("");
    const [digits, setDigits] = useState<string[]>(["", "", "", "", "", ""]);
    const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
    const router = useRouter();

    // Auto-focus first 2FA input
    useEffect(() => {
        if (mode === "2fa") {
            inputRefs.current[0]?.focus();
        }
    }, [mode]);

    const handleLogin = (formData: FormData) => {
        setError(null);
        startTransition(async () => {
            const result = await staffLoginAction(formData);
            if (result?.error) {
                setError(result.error);
            } else if (result?.needs2FA) {
                setTwoFAEmail(result.email || "");
                setIsTotpMode(result.totpEnabled || false);
                setPendingRole(result.role || "");
                setSuccess(result.message || "Two-factor code sent to your email.");
                setMode("2fa");
                setError(null);
            } else if (result?.success) {
                if (result.role === "MASTER_ADMIN") {
                    router.push("/admin");
                } else if (result.role === "ANALYTICS_VIEWER") {
                    router.push("/analytics");
                } else {
                    router.push("/staff-portal");
                }
            }
        });
    };

    const handleRegister = (formData: FormData) => {
        setError(null);
        startTransition(async () => {
            const result = await registerStaffAction(formData);
            if (result?.error) {
                setError(result.error);
            } else if (result?.success) {
                if (result.role === "MASTER_ADMIN") {
                    router.push("/admin");
                } else if (result.role === "ANALYTICS_VIEWER") {
                    router.push("/analytics");
                } else {
                    router.push("/staff-portal");
                }
            }
        });
    };

    // 2FA digit handlers
    const handleDigitChange = (index: number, value: string) => {
        const digit = value.replace(/\D/g, "").slice(-1);
        const newDigits = [...digits];
        newDigits[index] = digit;
        setDigits(newDigits);
        setError(null);

        if (digit && index < 5) {
            inputRefs.current[index + 1]?.focus();
        }

        if (digit && index === 5) {
            const code = newDigits.join("");
            if (code.length === 6) handleVerify2FA(code);
        }
    };

    const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Backspace" && !digits[index] && index > 0) {
            inputRefs.current[index - 1]?.focus();
        }
    };

    const handlePaste = (e: React.ClipboardEvent) => {
        e.preventDefault();
        const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
        if (pasted.length === 6) {
            setDigits(pasted.split(""));
            inputRefs.current[5]?.focus();
            handleVerify2FA(pasted);
        }
    };

    const handleVerify2FA = (code: string) => {
        setError(null);
        setSuccess(null);
        startTransition(async () => {
            const result = await verify2FAAction(twoFAEmail, code);
            if (result?.error) {
                setError(result.error);
                setDigits(["", "", "", "", "", ""]);
                inputRefs.current[0]?.focus();
            } else if (result?.success) {
                setSuccess("Verified! Redirecting...");
                const role = result.role || pendingRole;
                setTimeout(() => {
                    if (role === "MASTER_ADMIN") {
                        router.push("/admin");
                    } else if (role === "ANALYTICS_VIEWER") {
                        router.push("/analytics");
                    } else {
                        router.push("/staff-portal");
                    }
                }, 1000);
            }
        });
    };

    return (
        <main className="min-h-screen bg-[#0D0D0D] flex flex-col items-center justify-center p-6 relative overflow-hidden">
            {/* Ambient background effects */}
            <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-[#CBA153]/5 rounded-full blur-[120px] -translate-y-1/2 translate-x-1/3 pointer-events-none"></div>
            <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-[#CBA153]/3 rounded-full blur-[100px] translate-y-1/2 -translate-x-1/3 pointer-events-none"></div>
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] border border-[#CBA153]/5 rounded-full pointer-events-none"></div>

            <div className="w-full max-w-md relative z-10">
                {/* Logo & Branding */}
                <div className="text-center mb-10">
                    <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-[#1A1A1A] border border-[#CBA153]/30 mb-6 shadow-lg shadow-[#CBA153]/10">
                        {mode === "2fa" ? <ShieldCheck className="w-10 h-10 text-[#CBA153]" /> : <Shield className="w-10 h-10 text-[#CBA153]" />}
                    </div>
                    <span className="text-[10px] tracking-[0.5em] uppercase text-[#CBA153]/60 mb-4 block font-medium">
                        {mode === "2fa" ? "Two-Factor Authentication" : "Internal Access"}
                    </span>
                    <h1 className="text-4xl font-serif text-white mb-2 tracking-tight">
                        {mode === "2fa" ? "Verify Identity" : "Staff Portal"}
                    </h1>
                    <p className="text-gray-500 font-light text-sm">
                        {mode === "2fa"
                            ? `Enter the 6-digit code sent to ${twoFAEmail}`
                            : mode === "login"
                                ? "Sign in to access your workspace."
                                : "Use your access code to create an account."}
                    </p>
                </div>

                {/* Tab Switcher (hidden during 2FA) */}
                {mode !== "2fa" && (
                    <div className="flex bg-[#1A1A1A] rounded-lg p-1 mb-8 border border-white/5">
                        <button
                            onClick={() => { setMode("login"); setError(null); }}
                            className={`flex-1 py-3 text-xs font-bold uppercase tracking-widest rounded-md transition-all ${mode === "login"
                                ? "bg-[#CBA153] text-black shadow-lg shadow-[#CBA153]/20"
                                : "text-gray-500 hover:text-gray-300"
                                }`}
                        >
                            Sign In
                        </button>
                        <button
                            onClick={() => { setMode("register"); setError(null); }}
                            className={`flex-1 py-3 text-xs font-bold uppercase tracking-widest rounded-md transition-all ${mode === "register"
                                ? "bg-[#CBA153] text-black shadow-lg shadow-[#CBA153]/20"
                                : "text-gray-500 hover:text-gray-300"
                                }`}
                        >
                            Activate Code
                        </button>
                    </div>
                )}

                {/* Error Banner */}
                {error && (
                    <div className="mb-6 p-4 bg-red-950/50 text-red-300 border border-red-900/50 text-sm rounded-lg flex items-center gap-3 animate-fade-in">
                        <AlertCircle size={18} className="shrink-0" />
                        {error}
                    </div>
                )}

                {/* Success Banner */}
                {success && mode === "2fa" && (
                    <div className="mb-6 p-4 bg-emerald-950/50 text-emerald-300 border border-emerald-900/50 text-sm rounded-lg flex items-center gap-3 animate-fade-in">
                        <ShieldCheck size={18} className="shrink-0" />
                        {success}
                    </div>
                )}

                {/* 2FA Form */}
                {mode === "2fa" && (
                    <div className="bg-[#1A1A1A] p-8 rounded-xl border border-white/5 space-y-6 shadow-2xl animate-fade-in">
                        {/* OTP Inputs */}
                        <div className="flex justify-center gap-2.5" onPaste={handlePaste}>
                            {digits.map((digit, index) => (
                                <input
                                    key={index}
                                    ref={el => { inputRefs.current[index] = el; }}
                                    type="text"
                                    inputMode="numeric"
                                    maxLength={1}
                                    value={digit}
                                    onChange={e => handleDigitChange(index, e.target.value)}
                                    onKeyDown={e => handleKeyDown(index, e)}
                                    disabled={isPending || success === "Verified! Redirecting..."}
                                    className={`w-12 h-14 text-center text-xl font-bold rounded-lg border-2 transition-all outline-none bg-[#0D0D0D]
                                        ${digit ? 'border-[#CBA153] text-[#CBA153]' : 'border-white/10 text-white'}
                                        focus:border-[#CBA153] focus:ring-2 focus:ring-[#CBA153]/20
                                        disabled:opacity-50 disabled:cursor-not-allowed
                                    `}
                                />
                            ))}
                        </div>

                        <button
                            onClick={() => handleVerify2FA(digits.join(""))}
                            disabled={digits.some(d => !d) || isPending || success === "Verified! Redirecting..."}
                            className="w-full bg-[#CBA153] text-black font-bold uppercase tracking-widest text-sm py-4 rounded-lg hover:bg-white transition-all shadow-lg shadow-[#CBA153]/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            {isPending ? (
                                <><RefreshCw className="w-4 h-4 animate-spin" /> Verifying...</>
                            ) : success === "Verified! Redirecting..." ? (
                                <><ShieldCheck className="w-4 h-4" /> Verified!</>
                            ) : (
                                <>Verify & Continue <ArrowRight size={16} /></>
                            )}
                        </button>

                        <div className="text-center">
                            <button
                                onClick={() => {
                                    setMode("login");
                                    setError(null);
                                    setSuccess(null);
                                    setDigits(["", "", "", "", "", ""]);
                                }}
                                className="text-gray-500 text-xs hover:text-[#CBA153] transition-colors uppercase tracking-wider"
                            >
                                ← Back to login
                            </button>
                        </div>

                        <div className="p-3 bg-white/5 rounded-lg border border-white/5">
                            <p className="text-[11px] text-gray-500 leading-relaxed text-center">
                                {isTotpMode
                                    ? "📱 Open Google Authenticator and enter the current 6-digit code."
                                    : <>🔐 This code expires in 5 minutes. Check your inbox at <strong className="text-gray-400">{twoFAEmail}</strong></>}
                            </p>
                        </div>
                    </div>
                )}

                {/* Login Form */}
                {mode === "login" && (
                    <form className="bg-[#1A1A1A] p-8 rounded-xl border border-white/5 space-y-6 shadow-2xl" action={handleLogin}>
                        <div>
                            <label htmlFor="email" className="block text-xs font-bold text-gray-400 mb-2 uppercase tracking-wider">Username or Email</label>
                            <div className="relative">
                                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-600 w-4 h-4" />
                                <input
                                    type="text" id="email" name="email" required
                                    placeholder="username or email@company.com"
                                    className="w-full bg-[#0D0D0D] border border-white/10 text-white placeholder-gray-600 py-3.5 pl-12 pr-4 rounded-lg focus:outline-none focus:border-[#CBA153] focus:ring-1 focus:ring-[#CBA153]/50 transition-all"
                                />
                            </div>
                        </div>
                        <div>
                            <label htmlFor="password" className="block text-xs font-bold text-gray-400 mb-2 uppercase tracking-wider">Password</label>
                            <div className="relative">
                                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-600 w-4 h-4" />
                                <input
                                    type="password" id="password" name="password" required
                                    placeholder="••••••••"
                                    className="w-full bg-[#0D0D0D] border border-white/10 text-white placeholder-gray-600 py-3.5 pl-12 pr-4 rounded-lg focus:outline-none focus:border-[#CBA153] focus:ring-1 focus:ring-[#CBA153]/50 transition-all"
                                />
                            </div>
                        </div>
                        <button
                            type="submit"
                            disabled={isPending}
                            className="w-full bg-[#CBA153] text-black font-bold uppercase tracking-widest text-sm py-4 rounded-lg hover:bg-white transition-all shadow-lg shadow-[#CBA153]/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            {isPending ? "Authenticating..." : (<>Access Portal <ArrowRight size={16} /></>)}
                        </button>
                    </form>
                )}

                {/* Register Form */}
                {mode === "register" && (
                    <form className="bg-[#1A1A1A] p-8 rounded-xl border border-white/5 space-y-5 shadow-2xl" action={handleRegister}>
                        <div>
                            <label htmlFor="code" className="block text-xs font-bold text-gray-400 mb-2 uppercase tracking-wider">Access Code</label>
                            <div className="relative">
                                <KeyRound className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-600 w-4 h-4" />
                                <input
                                    type="text" id="code" name="code" required
                                    placeholder="COLCHIS-XXXX-2026"
                                    className="w-full bg-[#0D0D0D] border border-white/10 text-white placeholder-gray-600 py-3.5 pl-12 pr-4 rounded-lg focus:outline-none focus:border-[#CBA153] focus:ring-1 focus:ring-[#CBA153]/50 transition-all font-mono uppercase tracking-wider"
                                />
                            </div>
                        </div>
                        <div>
                            <label htmlFor="name" className="block text-xs font-bold text-gray-400 mb-2 uppercase tracking-wider">Full Name</label>
                            <div className="relative">
                                <User className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-600 w-4 h-4" />
                                <input
                                    type="text" id="name" name="name" required
                                    placeholder="Your full name"
                                    className="w-full bg-[#0D0D0D] border border-white/10 text-white placeholder-gray-600 py-3.5 pl-12 pr-4 rounded-lg focus:outline-none focus:border-[#CBA153] focus:ring-1 focus:ring-[#CBA153]/50 transition-all"
                                />
                            </div>
                        </div>
                        <div>
                            <label htmlFor="email" className="block text-xs font-bold text-gray-400 mb-2 uppercase tracking-wider">Work Email</label>
                            <div className="relative">
                                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-600 w-4 h-4" />
                                <input
                                    type="email" id="email" name="email" required
                                    placeholder="name@colchiscreamery.com"
                                    className="w-full bg-[#0D0D0D] border border-white/10 text-white placeholder-gray-600 py-3.5 pl-12 pr-4 rounded-lg focus:outline-none focus:border-[#CBA153] focus:ring-1 focus:ring-[#CBA153]/50 transition-all"
                                />
                            </div>
                        </div>
                        <div>
                            <label htmlFor="password" className="block text-xs font-bold text-gray-400 mb-2 uppercase tracking-wider">Password</label>
                            <div className="relative">
                                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-600 w-4 h-4" />
                                <input
                                    type="password" id="password" name="password" required minLength={8}
                                    placeholder="Min 8 characters"
                                    className="w-full bg-[#0D0D0D] border border-white/10 text-white placeholder-gray-600 py-3.5 pl-12 pr-4 rounded-lg focus:outline-none focus:border-[#CBA153] focus:ring-1 focus:ring-[#CBA153]/50 transition-all"
                                />
                            </div>
                        </div>
                        <button
                            type="submit"
                            disabled={isPending}
                            className="w-full bg-[#CBA153] text-black font-bold uppercase tracking-widest text-sm py-4 rounded-lg hover:bg-white transition-all shadow-lg shadow-[#CBA153]/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            {isPending ? "Creating Account..." : (<>Activate & Continue <ArrowRight size={16} /></>)}
                        </button>
                    </form>
                )}

                {/* Footer */}
                <div className="text-center mt-8">
                    <p className="text-xs text-gray-600 uppercase tracking-widest">
                        &copy; {new Date().getFullYear()} Colchis Creamery &mdash; Confidential
                    </p>
                </div>
            </div>

            <style dangerouslySetInnerHTML={{
                __html: `
                @keyframes fadeIn {
                    from { opacity: 0; transform: translateY(8px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                .animate-fade-in {
                    animation: fadeIn 0.4s ease-out forwards;
                }
            ` }} />
        </main>
    );
}
