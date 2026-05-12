"use client";

import { useState, useTransition } from "react";
import { updateProfileAction } from "@/app/actions/auth";

interface Props {
    userId: string;
    initialName: string;
    initialPhone: string;
}

export function AccountProfileForm({ userId, initialName, initialPhone }: Props) {
    const [editing, setEditing] = useState(false);
    const [name, setName] = useState(initialName);
    const [phone, setPhone] = useState(initialPhone);
    const [isPending, startTransition] = useTransition();
    const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

    const handleSubmit = (formData: FormData) => {
        setMessage(null);
        startTransition(async () => {
            const result = await updateProfileAction(formData);
            if (result?.error) {
                setMessage({ type: "error", text: result.error });
            } else {
                setMessage({ type: "success", text: "Profile updated successfully." });
                setEditing(false);
            }
        });
    };

    if (!editing) {
        return (
            <div style={{ padding: 24 }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
                    <div>
                        <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.32em", color: "#7A8278", textTransform: "uppercase" }}>Name</span>
                        <p style={{ fontFamily: "var(--font-serif)", fontSize: 15, color: "#1F3026", marginTop: 4 }}>{name || "Not set"}</p>
                    </div>
                    <div>
                        <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.32em", color: "#7A8278", textTransform: "uppercase" }}>Phone</span>
                        <p style={{ fontFamily: "var(--font-serif)", fontSize: 15, color: "#1F3026", marginTop: 4 }}>{phone || "Not set"}</p>
                    </div>
                </div>
                {message && (
                    <div style={{ marginTop: 14, padding: 10, fontSize: 13, fontFamily: "var(--font-sans)", background: message.type === "success" ? "#B96A3D11" : "#A8312C11", color: message.type === "success" ? "#2C3D33" : "#A8312C", border: `1px solid ${message.type === "success" ? "#B96A3D33" : "#A8312C33"}` }}>
                        {message.text}
                    </div>
                )}
                <button onClick={() => setEditing(true)} style={{ marginTop: 14, fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.24em", color: "#B96A3D", textTransform: "uppercase", background: "transparent", border: "none", cursor: "pointer", padding: 0 }}>
                    Edit Profile
                </button>
            </div>
        );
    }

    return (
        <form action={handleSubmit} style={{ padding: 24, display: "flex", flexDirection: "column", gap: 16 }}>
            <input type="hidden" name="userId" value={userId} />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                <div>
                    <label style={{ display: "block", fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.32em", color: "#7A8278", textTransform: "uppercase", marginBottom: 6 }}>Name</label>
                    <input type="text" name="name" value={name} onChange={(e) => setName(e.target.value)} style={{ width: "100%", padding: "10px 14px", background: "#F5F0E6", border: "1px solid #1F302622", color: "#1F3026", fontFamily: "var(--font-sans)", fontSize: 14, outline: "none" }} />
                </div>
                <div>
                    <label style={{ display: "block", fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.32em", color: "#7A8278", textTransform: "uppercase", marginBottom: 6 }}>Phone</label>
                    <input type="tel" name="phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(555) 123-4567" style={{ width: "100%", padding: "10px 14px", background: "#F5F0E6", border: "1px solid #1F302622", color: "#1F3026", fontFamily: "var(--font-sans)", fontSize: 14, outline: "none" }} />
                </div>
            </div>
            {message && (
                <div style={{ padding: 10, fontSize: 13, fontFamily: "var(--font-sans)", background: message.type === "success" ? "#B96A3D11" : "#A8312C11", color: message.type === "success" ? "#2C3D33" : "#A8312C", border: `1px solid ${message.type === "success" ? "#B96A3D33" : "#A8312C33"}` }}>
                    {message.text}
                </div>
            )}
            <div style={{ display: "flex", gap: 10 }}>
                <button type="submit" disabled={isPending} style={{ padding: "10px 20px", background: "#1F3026", color: "#F5F0E6", border: "none", fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.24em", textTransform: "uppercase", cursor: "pointer", opacity: isPending ? 0.5 : 1 }}>
                    {isPending ? "Saving..." : "Save Changes"}
                </button>
                <button type="button" onClick={() => { setEditing(false); setName(initialName); setPhone(initialPhone); setMessage(null); }} style={{ padding: "10px 20px", border: "1px solid #1F302622", background: "transparent", fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.24em", color: "#7A8278", textTransform: "uppercase", cursor: "pointer" }}>
                    Cancel
                </button>
            </div>
        </form>
    );
}
