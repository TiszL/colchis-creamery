"use client";

// Root error boundary — catches errors in the root layout itself. Must render
// its own <html>/<body> (it replaces the whole document).
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
    return (
        <html lang="en">
            <body style={{ margin: 0, background: "#F5F0E6", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "system-ui, -apple-system, sans-serif" }}>
                <div style={{ textAlign: "center", maxWidth: 520, padding: 24 }}>
                    <h1 style={{ fontSize: 40, fontWeight: 300, color: "#1F3026", margin: "0 0 12px" }}>Something went wrong</h1>
                    <p style={{ fontSize: 15, color: "#2C3D33", lineHeight: 1.6, marginBottom: 28 }}>
                        We hit an unexpected error. Please try again, or email support@colchisfood.com.
                    </p>
                    <button onClick={reset} style={{ background: "#1F3026", color: "#F5F0E6", border: "none", padding: "14px 28px", fontSize: 13, letterSpacing: "0.2em", textTransform: "uppercase", cursor: "pointer" }}>Try again</button>
                </div>
            </body>
        </html>
    );
}
