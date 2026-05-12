"use client";

import { useState, useTransition } from "react";
import { changePasswordAction } from "@/app/actions/auth";

interface Props {
    userId: string;
}

const inputStyle: React.CSSProperties = { width: "100%", padding: "10px 14px", background: "#F5F0E6", border: "1px solid #1F302622", color: "#1F3026", fontFamily: "var(--font-sans)", fontSize: 14, outline: "none" };
const labelStyle: React.CSSProperties = { display: "block", fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.32em", color: "#7A8278", textTransform: "uppercase", marginBottom: 6 };

export function AccountPasswordForm({ userId }: Props) {
    const [editing, setEditing] = useState(false);
    const [isPending, startTransition] = useTransition();
    const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

    const handleSubmit = (formData: FormData) => {
        setMessage(null);
        startTransition(async () => {
            const result = await changePasswordAction(formData);
            if (result?.error) {
                setMessage({ type: "error", text: result.error });
            } else {
                setMessage({ type: "success", text: "Password changed successfully." });
                setEditing(false);
            }
        });
    };

    if (!editing) {
        return (
            <div style={{ padding: 24 }}>
                <p style={{ fontFamily: "var(--font-serif)", fontSize: 15, color: "#1F3026" }}>••••••••••••</p>
                {message && (
                    <div style={{ marginTop: 14, padding: 10, fontSize: 13, fontFamily: "var(--font-sans)", background: message.type === "success" ? "#B96A3D11" : "#A8312C11", color: message.type === "success" ? "#2C3D33" : "#A8312C", border: `1px solid ${message.type === "success" ? "#B96A3D33" : "#A8312C33"}` }}>
                        {message.text}
                    </div>
                )}
                <button onClick={() => { setEditing(true); setMessage(null); }} style={{ marginTop: 14, fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.24em", color: "#B96A3D", textTransform: "uppercase", background: "transparent", border: "none", cursor: "pointer", padding: 0 }}>
                    Change Password
                </button>
            </div>
        );
    }

    return (
        <form action={handleSubmit} style={{ padding: 24, display: "flex", flexDirection: "column", gap: 16 }}>
            <input type="hidden" name="userId" value={userId} />
            <div>
                <label style={labelStyle}>Current Password</label>
                <input type="password" name="currentPassword" required style={inputStyle} />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                    <label style={labelStyle}>New Password</label>
                    <input type="password" name="newPassword" required minLength={8} style={inputStyle} />
                </div>
                <div>
                    <label style={labelStyle}>Confirm Password</label>
                    <input type="password" name="confirmPassword" required minLength={8} style={inputStyle} />
                </div>
            </div>
            {message && (
                <div style={{ padding: 10, fontSize: 13, fontFamily: "var(--font-sans)", background: message.type === "success" ? "#B96A3D11" : "#A8312C11", color: message.type === "success" ? "#2C3D33" : "#A8312C", border: `1px solid ${message.type === "success" ? "#B96A3D33" : "#A8312C33"}` }}>
                    {message.text}
                </div>
            )}
            <div style={{ display: "flex", gap: 10 }}>
                <button type="submit" disabled={isPending} style={{ padding: "10px 20px", background: "#1F3026", color: "#F5F0E6", border: "none", fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.24em", textTransform: "uppercase", cursor: "pointer", opacity: isPending ? 0.5 : 1 }}>
                    {isPending ? "Changing..." : "Update Password"}
                </button>
                <button type="button" onClick={() => { setEditing(false); setMessage(null); }} style={{ padding: "10px 20px", border: "1px solid #1F302622", background: "transparent", fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.24em", color: "#7A8278", textTransform: "uppercase", cursor: "pointer" }}>
                    Cancel
                </button>
            </div>
        </form>
    );
}
