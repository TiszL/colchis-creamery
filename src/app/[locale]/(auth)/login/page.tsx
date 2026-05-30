"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import { loginAction } from "@/app/actions/auth";
import { registerB2CAction } from "@/app/actions/auth";
import { useState, useTransition, useEffect, Suspense } from "react";
import { useRouter } from "@/i18n/routing";
import { useSearchParams } from "next/navigation";

function LoginContent() {
    const t = useTranslations("auth");
    const searchParams = useSearchParams();
    const [mode, setMode] = useState<"login" | "register">(
        searchParams.get("mode") === "register" ? "register" : "login"
    );
    const [error, setError] = useState<string | null>(null);
    const [isPending, startTransition] = useTransition();
    const [showPw, setShowPw] = useState(false);
    const [remember, setRemember] = useState(true);
    const router = useRouter();
    const isReg = mode === "register";

    useEffect(() => {
        const errorParam = searchParams.get("error");
        if (errorParam) {
            setError(errorParam === "OAuthFailed" ? "Social login failed. Please try again." :
                errorParam === "EmailRequired" ? "Social login requires email access." :
                    "An authentication error occurred.");
        }
    }, [searchParams]);

    const handleSubmit = (formData: FormData) => {
        setError(null);
        startTransition(async () => {
            if (isReg) {
                const result = await registerB2CAction(formData);
                if (result?.error) {
                    setError(result.error);
                } else if (result?.success && result?.needsVerification) {
                    router.push(`/verify-email?email=${encodeURIComponent(result.email || '')}`);
                } else if (result?.success) {
                    router.push("/shop");
                }
            } else {
                // Phase 11: this form is the D2C portal — tell loginAction to
                // scope its lookup to retail (+ master-admin) so a same-email
                // B2B partner account isn't surfaced here.
                formData.set("context", "b2c");
                const result = await loginAction(formData);
                if (result?.needsVerification) {
                    router.push(`/verify-email?email=${encodeURIComponent(result.email || '')}`);
                } else if (result?.error) {
                    setError(result.error);
                } else if (result?.success) {
                    // Retail door only authenticates customers now — staff/admin
                    // must use the staff portal (2FA). Always land on the shop.
                    window.location.assign("/shop");
                }
            }
        });
    };

    return (
        <main className="ch-auth" style={{ background: "#F5F0E6", minHeight: "calc(100vh - 80px)", position: "relative", overflow: "hidden" }}>
            {/* Faint grid */}
            <div style={{ position: "absolute", inset: 0, backgroundImage: "linear-gradient(#1F302606 1px, transparent 1px), linear-gradient(90deg, #1F302606 1px, transparent 1px)", backgroundSize: "80px 80px", pointerEvents: "none" }} />

            <div className="ch-auth-grid" style={{ maxWidth: 1440, margin: "0 auto", display: "grid", gridTemplateColumns: "1fr 1fr", minHeight: "calc(100vh - 80px)", position: "relative" }}>
                {/* ─── LEFT — Editorial column ───────────────────────────── */}
                <aside className="ch-auth-left" style={{ borderRight: "1px solid #1F302614", padding: "72px 64px 64px", display: "flex", flexDirection: "column", justifyContent: "space-between", background: "#F5F0E6" }}>
                    <div>
                        <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.32em", color: "#B96A3D", textTransform: "uppercase", marginBottom: 18 }}>
                            № 00 — The Pantry
                        </div>
                        <h1 className="ch-auth-h1" style={{ fontFamily: "var(--font-serif)", fontWeight: 300, fontSize: 92, lineHeight: 0.92, letterSpacing: "-0.03em", color: "#1F3026", margin: 0 }}>
                            {isReg ? (
                                <>Set a place<br /><em style={{ color: "#B96A3D", fontWeight: 300 }}>at the table.</em></>
                            ) : (
                                <>Welcome<br /><em style={{ color: "#B96A3D", fontWeight: 300 }}>back to the&nbsp;table.</em></>
                            )}
                        </h1>
                        <p className="ch-auth-lead" style={{ marginTop: 28, fontFamily: "var(--font-serif)", fontSize: 19, fontStyle: "italic", lineHeight: 1.55, color: "#2C3D33", opacity: 0.85, maxWidth: 460 }}>
                            Sign in to track standing orders, save addresses for the cheese cellar, and reserve hot khachapuri for pickup before it leaves the oven.
                        </p>
                    </div>

                    {/* Three-up reasons */}
                    <div className="ch-auth-reasons" style={{ marginTop: 80, display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 28, paddingTop: 36, borderTop: "1px solid #1F302622" }}>
                        {[
                            { n: "i.", t: "Standing orders", d: "Auto-ship sulguni and frozen khachapuri on your cadence." },
                            { n: "ii.", t: "Local pickup", d: "Reserve hot bread before the oven cools. 84 N High St, Dublin." },
                            { n: "iii.", t: "Cellar reserve", d: "First access to the 12-month aged wheels we only press once." },
                        ].map(r => (
                            <div key={r.n}>
                                <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.28em", color: "#B96A3D", textTransform: "uppercase" }}>{r.n}</div>
                                <div style={{ fontFamily: "var(--font-serif)", fontStyle: "italic", fontSize: 20, color: "#1F3026", marginTop: 8 }}>{r.t}</div>
                                <div style={{ fontFamily: "var(--font-sans)", fontSize: 13, color: "#2C3D33", opacity: 0.75, lineHeight: 1.55, marginTop: 6 }}>{r.d}</div>
                            </div>
                        ))}
                    </div>
                </aside>

                {/* ─── RIGHT — Form column ───────────────────────────────── */}
                <section className="ch-auth-right" style={{ padding: "72px 64px 64px", background: "#EAE2D2", display: "flex", flexDirection: "column", justifyContent: "center" }}>
                    <div className="ch-auth-card" style={{ width: "100%", maxWidth: 440, margin: "0 auto" }}>
                        {/* Tab toggle */}
                        <div role="tablist" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", border: "1px solid #1F302633", marginBottom: 36 }}>
                            {[
                                { id: "login" as const, label: "Sign In" },
                                { id: "register" as const, label: "Create Account" },
                            ].map(tab => {
                                const on = mode === tab.id;
                                return (
                                    <button key={tab.id} onClick={() => { setMode(tab.id); setError(null); }} role="tab" aria-selected={on} style={{
                                        background: on ? "#1F3026" : "transparent",
                                        color: on ? "#F5F0E6" : "#1F3026",
                                        border: "none", cursor: "pointer",
                                        fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.28em", textTransform: "uppercase",
                                        padding: "16px 0",
                                    }}>{tab.label}</button>
                                );
                            })}
                        </div>

                        {/* Greeting */}
                        <div style={{ marginBottom: 28 }}>
                            <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.32em", color: "#7A8278", textTransform: "uppercase" }}>
                                {isReg ? "Step 01 / 01 — your details" : "Members entrance"}
                            </div>
                            <h2 style={{ fontFamily: "var(--font-serif)", fontWeight: 300, fontSize: 38, color: "#1F3026", margin: "10px 0 0", letterSpacing: "-0.01em" }}>
                                {isReg ? "Open an account." : "Sign in."}
                            </h2>
                        </div>

                        {/* Social */}
                        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                            <a href="/api/auth/social?provider=google" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12, border: "1px solid #1F302633", background: "#F5F0E6", padding: "13px 16px", fontFamily: "var(--font-sans)", fontSize: 13.5, fontWeight: 500, color: "#1F3026", textDecoration: "none" }}>
                                <svg width="18" height="18" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" /><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" /><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" /><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" /></svg>
                                {isReg ? "Sign up with Google" : "Continue with Google"}
                            </a>
                            <a href="/api/auth/social?provider=twitter" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12, border: "1px solid #1F302633", background: "#F5F0E6", padding: "13px 16px", fontFamily: "var(--font-sans)", fontSize: 13.5, fontWeight: 500, color: "#1F3026", textDecoration: "none" }}>
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="#1F3026"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" /></svg>
                                {isReg ? "Sign up with X" : "Continue with X"}
                            </a>
                        </div>

                        {/* Divider */}
                        <div style={{ display: "flex", alignItems: "center", gap: 14, margin: "26px 0" }}>
                            <span style={{ flex: 1, height: 1, background: "#1F302622" }} />
                            <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.32em", color: "#7A8278", textTransform: "uppercase" }}>or with email</span>
                            <span style={{ flex: 1, height: 1, background: "#1F302622" }} />
                        </div>

                        {error && (
                            <div style={{ marginBottom: 18, padding: 12, background: "#A8312C11", color: "#A8312C", fontSize: 13, border: "1px solid #A8312C33", fontFamily: "var(--font-sans)" }}>
                                {error}
                            </div>
                        )}

                        {/* Form */}
                        <form style={{ display: "flex", flexDirection: "column", gap: 18 }} action={handleSubmit}>
                            {isReg && (
                                <div>
                                    <label style={{ display: "block", fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.32em", color: "#7A8278", textTransform: "uppercase", marginBottom: 8 }}>Full Name</label>
                                    <input type="text" name="name" placeholder="Nino Beridze" required style={{ width: "100%", padding: "13px 14px", background: "#F5F0E6", border: "1px solid #1F302633", color: "#1F3026", fontFamily: "var(--font-sans)", fontSize: 14, outline: "none" }} />
                                </div>
                            )}

                            <div>
                                <label style={{ display: "block", fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.32em", color: "#7A8278", textTransform: "uppercase", marginBottom: 8 }}>Email address</label>
                                <input type="email" name="email" placeholder="you@colchisfood.com" required style={{ width: "100%", padding: "13px 14px", background: "#F5F0E6", border: "1px solid #1F302633", color: "#1F3026", fontFamily: "var(--font-sans)", fontSize: 14, outline: "none" }} />
                            </div>

                            <div>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                                    <label style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.32em", color: "#7A8278", textTransform: "uppercase" }}>Password</label>
                                    {!isReg && <Link href="/forgot-password" style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.16em", color: "#B96A3D", textDecoration: "none", textTransform: "uppercase" }}>Forgot?</Link>}
                                </div>
                                <div style={{ position: "relative" }}>
                                    <input type={showPw ? "text" : "password"} name="password" placeholder={isReg ? "Min. 8 characters" : "••••••••"} required minLength={isReg ? 8 : undefined} style={{ width: "100%", padding: "13px 56px 13px 14px", background: "#F5F0E6", border: "1px solid #1F302633", color: "#1F3026", fontFamily: "var(--font-sans)", fontSize: 14, outline: "none" }} />
                                    <button type="button" onClick={() => setShowPw(s => !s)} style={{ position: "absolute", right: 6, top: 6, bottom: 6, padding: "0 12px", background: "transparent", border: "none", cursor: "pointer", fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.2em", color: "#7A8278", textTransform: "uppercase" }}>
                                        {showPw ? "Hide" : "Show"}
                                    </button>
                                </div>
                            </div>

                            {/* Remember / terms */}
                            <div style={{ display: "flex", alignItems: "flex-start", gap: 10, marginTop: 2 }}>
                                <button type="button" onClick={() => setRemember(r => !r)} aria-pressed={remember} style={{ width: 18, height: 18, flexShrink: 0, marginTop: 1, border: "1px solid #1F302655", background: remember ? "#1F3026" : "transparent", cursor: "pointer", padding: 0, position: "relative" }}>
                                    {remember && <span style={{ position: "absolute", inset: 0, color: "#F5F0E6", fontSize: 12, lineHeight: "16px", textAlign: "center" }}>✓</span>}
                                </button>
                                <label style={{ fontFamily: "var(--font-sans)", fontSize: 12.5, lineHeight: 1.5, color: "#2C3D33" }}>
                                    {isReg
                                        ? <>I agree to the <a href="#" style={{ color: "#B96A3D", textDecoration: "underline" }}>terms</a> and the occasional dispatch about new wheels and bake days.</>
                                        : <>Keep me signed in on this device.</>}
                                </label>
                            </div>

                            <button type="submit" disabled={isPending} style={{ background: "#1F3026", color: "#F5F0E6", border: "none", padding: "18px 0", fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.32em", textTransform: "uppercase", cursor: "pointer", marginTop: 6, opacity: isPending ? 0.7 : 1 }}>
                                {isPending ? (isReg ? "Creating account..." : "Signing in...") : (isReg ? "Create my account →" : "Sign in →")}
                            </button>

                            {!isReg && (
                                <div style={{ display: "flex", justifyContent: "center", gap: 6, fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.24em", color: "#7A8278", textTransform: "uppercase", marginTop: 6 }}>
                                    <span>New to Colchis?</span>
                                    <button type="button" onClick={() => setMode("register")} style={{ background: "transparent", border: "none", padding: 0, cursor: "pointer", color: "#B96A3D", fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.24em", textTransform: "uppercase", borderBottom: "1px solid #B96A3D" }}>Open an account</button>
                                </div>
                            )}
                        </form>

                        {/* Footnote */}
                        <div style={{ marginTop: 40, paddingTop: 22, borderTop: "1px solid #1F302614", display: "flex", justifyContent: "space-between", fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.28em", color: "#7A8278", textTransform: "uppercase" }}>
                            <span>EN / ქართული</span>
                            <span>Secure · TLS 1.3</span>
                        </div>
                    </div>
                </section>
            </div>
        </main>
    );
}

export default function B2CLoginPage() {
    return (
        <Suspense>
            <LoginContent />
        </Suspense>
    );
}
