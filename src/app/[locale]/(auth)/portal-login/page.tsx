"use client";

import { useState, useTransition, useRef, useEffect } from "react";
import { useRouter } from "@/i18n/routing";
import { staffLoginAction, registerStaffAction, verify2FAAction } from "@/app/actions/auth";
import { KeyRound, User, Mail, Lock, ArrowRight, AlertCircle, ShieldCheck, RefreshCw } from "lucide-react";
import { ColchisSeal } from "@/components/brand/ColchisSeal";

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
                    router.push("/portal");
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
                    router.push("/portal");
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
                        router.push("/portal");
                    }
                }, 1000);
            }
        });
    };

    const mono: React.CSSProperties = { fontFamily: "var(--font-mono)", letterSpacing: "0.24em", textTransform: "uppercase" };
    const serif: React.CSSProperties = { fontFamily: "var(--font-serif)" };
    const sans: React.CSSProperties = { fontFamily: "var(--font-sans)" };

    const inputClass = "w-full bg-[#0C0C0C] border border-[#B96A3D22] text-[#F5F0E6] py-3.5 pl-12 pr-4 focus:outline-none focus:border-[#B96A3D] transition-all placeholder-[#5A6158]";

    return (
        <main className="min-h-screen bg-[#0C0C0C] flex flex-col items-center justify-center p-6 relative overflow-hidden">
            {/* Ambient background */}
            <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-[#B96A3D]/5 rounded-full blur-[120px] -translate-y-1/2 translate-x-1/3 pointer-events-none"></div>
            <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-[#B96A3D]/3 rounded-full blur-[100px] translate-y-1/2 -translate-x-1/3 pointer-events-none"></div>

            <div className="w-full max-w-md relative z-10">
                {/* Logo & Branding */}
                <div className="text-center mb-10">
                    <div className="inline-flex items-center justify-center mb-6">
                        {mode === "2fa"
                            ? <ShieldCheck className="w-12 h-12 text-[#B96A3D]" />
                            : <ColchisSeal size={56} />
                        }
                    </div>
                    <span className="text-[9px] text-[#D9A876] mb-4 block" style={mono}>
                        {mode === "2fa" ? "Two-Factor Authentication" : "№ 01 — Internal Access"}
                    </span>
                    <h1 className="text-4xl text-[#F5F0E6] mb-2" style={{ ...serif, fontWeight: 300, fontStyle: 'italic' }}>
                        {mode === "2fa" ? "Verify Identity" : "Staff Portal"}
                    </h1>
                    <p className="text-[#7A8278] text-sm" style={sans}>
                        {mode === "2fa"
                            ? `Enter the 6-digit code sent to ${twoFAEmail}`
                            : mode === "login"
                                ? "Sign in to access your workspace."
                                : "Use your access code to create an account."}
                    </p>
                </div>

                {/* Tab Switcher */}
                {mode !== "2fa" && (
                    <div className="flex border border-[#B96A3D22] mb-8">
                        <button
                            onClick={() => { setMode("login"); setError(null); }}
                            className={`flex-1 py-3 text-[10px] transition-all ${mode === "login"
                                ? "bg-[#B96A3D] text-[#F5F0E6]"
                                : "text-[#7A8278] hover:text-[#F5F0E6]"
                                }`}
                            style={mono}
                        >
                            Sign In
                        </button>
                        <button
                            onClick={() => { setMode("register"); setError(null); }}
                            className={`flex-1 py-3 text-[10px] transition-all ${mode === "register"
                                ? "bg-[#B96A3D] text-[#F5F0E6]"
                                : "text-[#7A8278] hover:text-[#F5F0E6]"
                                }`}
                            style={mono}
                        >
                            Activate Code
                        </button>
                    </div>
                )}

                {/* Error Banner */}
                {error && (
                    <div className="mb-6 p-4 bg-[#A8312C15] text-[#D9A876] border border-[#A8312C44] text-sm flex items-center gap-3 animate-fade-in" style={sans}>
                        <AlertCircle size={18} className="shrink-0 text-[#A8312C]" />
                        {error}
                    </div>
                )}

                {/* Success Banner */}
                {success && mode === "2fa" && (
                    <div className="mb-6 p-4 bg-[#4A7A5A15] text-[#D9A876] border border-[#4A7A5A44] text-sm flex items-center gap-3 animate-fade-in" style={sans}>
                        <ShieldCheck size={18} className="shrink-0 text-[#4A7A5A]" />
                        {success}
                    </div>
                )}

                {/* 2FA Form */}
                {mode === "2fa" && (
                    <div className="bg-[#161616] p-8 border border-[#B96A3D22] space-y-6 animate-fade-in">
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
                                    className={`w-12 h-14 text-center text-xl font-bold border-2 transition-all outline-none bg-[#0C0C0C]
                                        ${digit ? 'border-[#B96A3D] text-[#B96A3D]' : 'border-[#B96A3D22] text-[#F5F0E6]'}
                                        focus:border-[#B96A3D]
                                        disabled:opacity-50 disabled:cursor-not-allowed
                                    `}
                                    style={{ fontFamily: 'var(--font-mono)' }}
                                />
                            ))}
                        </div>

                        <button
                            onClick={() => handleVerify2FA(digits.join(""))}
                            disabled={digits.some(d => !d) || isPending || success === "Verified! Redirecting..."}
                            className="w-full bg-[#B96A3D] text-[#F5F0E6] text-[10px] py-4 hover:bg-[#F5F0E6] hover:text-[#1F3026] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            style={mono}
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
                                className="text-[#7A8278] text-[10px] hover:text-[#B96A3D] transition-colors"
                                style={mono}
                            >
                                ← Back to login
                            </button>
                        </div>

                        <div className="p-3 bg-[#ffffff08] border border-[#B96A3D22]">
                            <p className="text-[11px] text-[#7A8278] leading-relaxed text-center" style={sans}>
                                {isTotpMode
                                    ? "📱 Open Google Authenticator and enter the current 6-digit code."
                                    : <>🔐 This code expires in 5 minutes. Check your inbox at <strong className="text-[#D9A876]">{twoFAEmail}</strong></>}
                            </p>
                        </div>
                    </div>
                )}

                {/* Login Form */}
                {mode === "login" && (
                    <form className="bg-[#161616] p-8 border border-[#B96A3D22] space-y-6" action={handleLogin}>
                        <div>
                            <label htmlFor="email" className="block text-[9px] text-[#D9A876] mb-2" style={mono}>Username or Email</label>
                            <div className="relative">
                                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-[#5A6158] w-4 h-4" />
                                <input
                                    type="text" id="email" name="email" required
                                    placeholder="username or email@company.com"
                                    className={inputClass}
                                    style={sans}
                                />
                            </div>
                        </div>
                        <div>
                            <label htmlFor="password" className="block text-[9px] text-[#D9A876] mb-2" style={mono}>Password</label>
                            <div className="relative">
                                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-[#5A6158] w-4 h-4" />
                                <input
                                    type="password" id="password" name="password" required
                                    placeholder="••••••••"
                                    className={inputClass}
                                    style={sans}
                                />
                            </div>
                        </div>
                        <button
                            type="submit"
                            disabled={isPending}
                            className="w-full bg-[#B96A3D] text-[#F5F0E6] text-[10px] py-4 hover:bg-[#F5F0E6] hover:text-[#1F3026] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            style={mono}
                        >
                            {isPending ? "Authenticating..." : (<>Access Portal <ArrowRight size={16} /></>)}
                        </button>
                    </form>
                )}

                {/* Register Form */}
                {mode === "register" && (
                    <form className="bg-[#161616] p-8 border border-[#B96A3D22] space-y-5" action={handleRegister}>
                        <div>
                            <label htmlFor="code" className="block text-[9px] text-[#D9A876] mb-2" style={mono}>Access Code</label>
                            <div className="relative">
                                <KeyRound className="absolute left-4 top-1/2 -translate-y-1/2 text-[#5A6158] w-4 h-4" />
                                <input
                                    type="text" id="code" name="code" required
                                    placeholder="COLCHIS-XXXX-2026"
                                    className={`${inputClass}`}
                                    style={{ ...mono, fontSize: 13 }}
                                />
                            </div>
                        </div>
                        <div>
                            <label htmlFor="name" className="block text-[9px] text-[#D9A876] mb-2" style={mono}>Full Name</label>
                            <div className="relative">
                                <User className="absolute left-4 top-1/2 -translate-y-1/2 text-[#5A6158] w-4 h-4" />
                                <input
                                    type="text" id="name" name="name" required
                                    placeholder="Your full name"
                                    className={inputClass}
                                    style={sans}
                                />
                            </div>
                        </div>
                        <div>
                            <label htmlFor="email" className="block text-[9px] text-[#D9A876] mb-2" style={mono}>Work Email</label>
                            <div className="relative">
                                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-[#5A6158] w-4 h-4" />
                                <input
                                    type="email" id="email" name="email" required
                                    placeholder="name@colchisfood.com"
                                    className={inputClass}
                                    style={sans}
                                />
                            </div>
                        </div>
                        <div>
                            <label htmlFor="password" className="block text-[9px] text-[#D9A876] mb-2" style={mono}>Password</label>
                            <div className="relative">
                                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-[#5A6158] w-4 h-4" />
                                <input
                                    type="password" id="password" name="password" required minLength={8}
                                    placeholder="Min 8 characters"
                                    className={inputClass}
                                    style={sans}
                                />
                            </div>
                        </div>
                        <button
                            type="submit"
                            disabled={isPending}
                            className="w-full bg-[#B96A3D] text-[#F5F0E6] text-[10px] py-4 hover:bg-[#F5F0E6] hover:text-[#1F3026] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            style={mono}
                        >
                            {isPending ? "Creating Account..." : (<>Activate & Continue <ArrowRight size={16} /></>)}
                        </button>
                    </form>
                )}

                {/* Footer */}
                <div className="text-center mt-8">
                    <p className="text-[9px] text-[#5A6158]" style={mono}>
                        &copy; {new Date().getFullYear()} Colchis Food &mdash; Confidential
                    </p>
                </div>
            </div>
        </main>
    );
}
