"use client";

import { useState, useTransition } from "react";
import { updateAddressAction } from "@/app/actions/auth";

interface Props {
    userId: string;
    initialAddress: string;
    initialCity: string;
    initialState: string;
    initialZip: string;
    initialCountry: string;
}

const inputStyle: React.CSSProperties = { width: "100%", padding: "10px 14px", background: "#F5F0E6", border: "1px solid #1F302622", color: "#1F3026", fontFamily: "var(--font-sans)", fontSize: 14, outline: "none" };
const labelStyle: React.CSSProperties = { display: "block", fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.32em", color: "#7A8278", textTransform: "uppercase", marginBottom: 6 };

export function AccountAddressForm({ userId, initialAddress, initialCity, initialState, initialZip, initialCountry }: Props) {
    const [editing, setEditing] = useState(false);
    const [address, setAddress] = useState(initialAddress);
    const [city, setCity] = useState(initialCity);
    const [state, setState] = useState(initialState);
    const [zip, setZip] = useState(initialZip);
    const [country, setCountry] = useState(initialCountry);
    const [isPending, startTransition] = useTransition();
    const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

    const handleSubmit = (formData: FormData) => {
        setMessage(null);
        startTransition(async () => {
            const result = await updateAddressAction(formData);
            if (result?.error) {
                setMessage({ type: "error", text: result.error });
            } else {
                setMessage({ type: "success", text: "Address updated successfully." });
                setEditing(false);
            }
        });
    };

    const hasAddress = address || city || state || zip;

    if (!editing) {
        return (
            <div style={{ padding: 24 }}>
                {hasAddress ? (
                    <p style={{ fontFamily: "var(--font-serif)", fontSize: 15, color: "#1F3026", lineHeight: 1.5 }}>
                        {address}<br />
                        {city}{city && state ? ", " : ""}{state} {zip}<br />
                        {country}
                    </p>
                ) : (
                    <p style={{ fontFamily: "var(--font-serif)", fontStyle: "italic", fontSize: 14, color: "#7A8278" }}>No shipping address saved yet.</p>
                )}
                {message && (
                    <div style={{ marginTop: 14, padding: 10, fontSize: 13, fontFamily: "var(--font-sans)", background: message.type === "success" ? "#B96A3D11" : "#A8312C11", color: message.type === "success" ? "#2C3D33" : "#A8312C", border: `1px solid ${message.type === "success" ? "#B96A3D33" : "#A8312C33"}` }}>
                        {message.text}
                    </div>
                )}
                <button onClick={() => setEditing(true)} style={{ marginTop: 14, fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.24em", color: "#B96A3D", textTransform: "uppercase", background: "transparent", border: "none", cursor: "pointer", padding: 0 }}>
                    {hasAddress ? "Edit Address" : "Add Address"}
                </button>
            </div>
        );
    }

    return (
        <form action={handleSubmit} style={{ padding: 24, display: "flex", flexDirection: "column", gap: 16 }}>
            <input type="hidden" name="userId" value={userId} />
            <div>
                <label style={labelStyle}>Street Address</label>
                <input type="text" name="shippingAddress" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="123 Main St, Apt 4" style={inputStyle} />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 12 }}>
                <div>
                    <label style={labelStyle}>City</label>
                    <input type="text" name="shippingCity" value={city} onChange={(e) => setCity(e.target.value)} style={inputStyle} />
                </div>
                <div>
                    <label style={labelStyle}>State</label>
                    <input type="text" name="shippingState" value={state} onChange={(e) => setState(e.target.value)} style={inputStyle} />
                </div>
                <div>
                    <label style={labelStyle}>ZIP Code</label>
                    <input type="text" name="shippingZip" value={zip} onChange={(e) => setZip(e.target.value)} style={inputStyle} />
                </div>
            </div>
            <div>
                <label style={labelStyle}>Country</label>
                <select name="shippingCountry" value={country} onChange={(e) => setCountry(e.target.value)} style={inputStyle}>
                    <option value="US">United States</option>
                    <option value="CA">Canada</option>
                    <option value="GE">Georgia</option>
                </select>
            </div>
            {message && (
                <div style={{ padding: 10, fontSize: 13, fontFamily: "var(--font-sans)", background: message.type === "success" ? "#B96A3D11" : "#A8312C11", color: message.type === "success" ? "#2C3D33" : "#A8312C", border: `1px solid ${message.type === "success" ? "#B96A3D33" : "#A8312C33"}` }}>
                    {message.text}
                </div>
            )}
            <div style={{ display: "flex", gap: 10 }}>
                <button type="submit" disabled={isPending} style={{ padding: "10px 20px", background: "#1F3026", color: "#F5F0E6", border: "none", fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.24em", textTransform: "uppercase", cursor: "pointer", opacity: isPending ? 0.5 : 1 }}>
                    {isPending ? "Saving..." : "Save Address"}
                </button>
                <button type="button" onClick={() => { setEditing(false); setMessage(null); setAddress(initialAddress); setCity(initialCity); setState(initialState); setZip(initialZip); setCountry(initialCountry); }} style={{ padding: "10px 20px", border: "1px solid #1F302622", background: "transparent", fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.24em", color: "#7A8278", textTransform: "uppercase", cursor: "pointer" }}>
                    Cancel
                </button>
            </div>
        </form>
    );
}
