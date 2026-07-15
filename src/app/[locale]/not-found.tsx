import Link from "next/link";

// Branded 404 — replaces the bare "This page could not be found." default.
export default function NotFound() {
    return (
        <main style={{ background: "#F5F0E6", minHeight: "80vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "80px 24px" }}>
            <div style={{ textAlign: "center", maxWidth: 560 }}>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.32em", color: "#B96A3D", textTransform: "uppercase" }}>Error 404</div>
                <h1 style={{ fontFamily: "var(--font-serif)", fontWeight: 300, fontSize: 56, color: "#1F3026", margin: "16px 0 12px", lineHeight: 1, letterSpacing: "-0.02em" }}>
                    This page has <em style={{ color: "#B96A3D" }}>left the oven.</em>
                </h1>
                <p style={{ fontFamily: "var(--font-sans)", fontSize: 15, color: "#2C3D33", lineHeight: 1.6, marginBottom: 32 }}>
                    We couldn&apos;t find what you were looking for. It may have moved, or the link may be out of date.
                </p>
                <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
                    <Link href="/" style={{ background: "#1F3026", color: "#F5F0E6", padding: "14px 28px", fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.28em", textTransform: "uppercase", textDecoration: "none" }}>Home</Link>
                    <Link href="/shop" style={{ background: "transparent", color: "#1F3026", border: "1px solid #1F302655", padding: "14px 28px", fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.28em", textTransform: "uppercase", textDecoration: "none" }}>Shop all</Link>
                </div>
            </div>
        </main>
    );
}
