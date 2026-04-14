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
            <div className="p-6">
                {hasAddress ? (
                    <p className="text-[#2C2A29]">
                        {address}<br />
                        {city}{city && state ? ", " : ""}{state} {zip}<br />
                        {country}
                    </p>
                ) : (
                    <p className="text-gray-400 text-sm italic">No shipping address saved yet.</p>
                )}
                {message && (
                    <div className={`mt-4 p-3 rounded text-sm ${message.type === "success" ? "bg-green-50 text-green-700 border border-green-200" : "bg-red-50 text-red-600 border border-red-200"}`}>
                        {message.text}
                    </div>
                )}
                <button
                    onClick={() => setEditing(true)}
                    className="mt-4 text-sm text-[#A6812F] hover:text-[#2C2A29] font-medium transition-colors"
                >
                    {hasAddress ? "Edit Address" : "Add Address"}
                </button>
            </div>
        );
    }

    return (
        <form action={handleSubmit} className="p-6 space-y-4">
            <input type="hidden" name="userId" value={userId} />
            <div>
                <label className="block text-xs text-gray-400 uppercase tracking-wider font-bold mb-1">Street Address</label>
                <input
                    type="text"
                    name="shippingAddress"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="123 Main St, Apt 4"
                    className="w-full px-4 py-3 bg-[#FDFBF7] border border-gray-200 rounded-lg text-[#2C2A29] focus:outline-none focus:border-[#CBA153] focus:ring-1 focus:ring-[#CBA153]"
                />
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="col-span-2">
                    <label className="block text-xs text-gray-400 uppercase tracking-wider font-bold mb-1">City</label>
                    <input
                        type="text"
                        name="shippingCity"
                        value={city}
                        onChange={(e) => setCity(e.target.value)}
                        className="w-full px-4 py-3 bg-[#FDFBF7] border border-gray-200 rounded-lg text-[#2C2A29] focus:outline-none focus:border-[#CBA153] focus:ring-1 focus:ring-[#CBA153]"
                    />
                </div>
                <div>
                    <label className="block text-xs text-gray-400 uppercase tracking-wider font-bold mb-1">State</label>
                    <input
                        type="text"
                        name="shippingState"
                        value={state}
                        onChange={(e) => setState(e.target.value)}
                        className="w-full px-4 py-3 bg-[#FDFBF7] border border-gray-200 rounded-lg text-[#2C2A29] focus:outline-none focus:border-[#CBA153] focus:ring-1 focus:ring-[#CBA153]"
                    />
                </div>
                <div>
                    <label className="block text-xs text-gray-400 uppercase tracking-wider font-bold mb-1">ZIP Code</label>
                    <input
                        type="text"
                        name="shippingZip"
                        value={zip}
                        onChange={(e) => setZip(e.target.value)}
                        className="w-full px-4 py-3 bg-[#FDFBF7] border border-gray-200 rounded-lg text-[#2C2A29] focus:outline-none focus:border-[#CBA153] focus:ring-1 focus:ring-[#CBA153]"
                    />
                </div>
            </div>
            <div>
                <label className="block text-xs text-gray-400 uppercase tracking-wider font-bold mb-1">Country</label>
                <select
                    name="shippingCountry"
                    value={country}
                    onChange={(e) => setCountry(e.target.value)}
                    className="w-full px-4 py-3 bg-[#FDFBF7] border border-gray-200 rounded-lg text-[#2C2A29] focus:outline-none focus:border-[#CBA153] focus:ring-1 focus:ring-[#CBA153]"
                >
                    <option value="US">United States</option>
                    <option value="CA">Canada</option>
                    <option value="GE">Georgia</option>
                </select>
            </div>
            {message && (
                <div className={`p-3 rounded text-sm ${message.type === "success" ? "bg-green-50 text-green-700 border border-green-200" : "bg-red-50 text-red-600 border border-red-200"}`}>
                    {message.text}
                </div>
            )}
            <div className="flex gap-3">
                <button
                    type="submit"
                    disabled={isPending}
                    className="px-6 py-2.5 bg-[#CBA153] text-white rounded-lg text-sm font-bold uppercase tracking-wider hover:bg-[#b08d47] transition disabled:opacity-50"
                >
                    {isPending ? "Saving..." : "Save Address"}
                </button>
                <button
                    type="button"
                    onClick={() => { setEditing(false); setMessage(null); setAddress(initialAddress); setCity(initialCity); setState(initialState); setZip(initialZip); setCountry(initialCountry); }}
                    className="px-6 py-2.5 border border-gray-200 text-gray-500 rounded-lg text-sm font-medium hover:bg-gray-50 transition"
                >
                    Cancel
                </button>
            </div>
        </form>
    );
}
