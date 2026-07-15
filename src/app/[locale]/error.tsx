"use client";

import Link from "next/link";
import { useEffect } from "react";

// Branded route-level error boundary (replaces the bare Next.js default).
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
    useEffect(() => {
        console.error("[route error]", error);
    }, [error]);

    return (
        <main style={{ background: "#F5F0E6", minHeight: "80vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "80px 24px" }}>
            <div style={{ textAlign: "center", maxWidth: 560 }}>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.32em", color: "#B96A3D", textTransform: "uppercase" }}>Something went wrong</div>
                <h1 style={{ fontFamily: "var(--font-serif)", fontWeight: 300, fontSize: 52, color: "#1F3026", margin: "16px 0 12px", lineHeight: 1.05, letterSpacing: "-0.02em" }}>
                    A hiccup in the <em style={{ color: "#B96A3D" }}>kitchen.</em>
                </h1>
                <p style={{ fontFamily: "var(--font-sans)", fontSize: 15, color: "#2C3D33", lineHeight: 1.6, marginBottom: 32 }}>
                    Something broke on our end. Please try again — if it keeps happening, email{" "}
                    <a href="mailto:support@colchisfood.com" style={{ color: "#1F3026" }}>support@colchisfood.com</a>.
                </p>
                <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
                    <button onClick={reset} style={{ background: "#1F3026", color: "#F5F0E6", border: "none", padding: "14px 28px", fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.28em", textTransform: "uppercase", cursor: "pointer" }}>Try again</button>
                    <Link href="/" style={{ background: "transparent", color: "#1F3026", border: "1px solid #1F302655", padding: "14px 28px", fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.28em", textTransform: "uppercase", textDecoration: "none" }}>Home</Link>
                </div>
            </div>
        </main>
    );
}
