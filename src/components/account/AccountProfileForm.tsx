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
            <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <span className="text-xs text-gray-400 uppercase tracking-wider font-bold">Name</span>
                        <p className="text-[#2C2A29] mt-1">{name || "Not set"}</p>
                    </div>
                    <div>
                        <span className="text-xs text-gray-400 uppercase tracking-wider font-bold">Phone</span>
                        <p className="text-[#2C2A29] mt-1">{phone || "Not set"}</p>
                    </div>
                </div>
                {message && (
                    <div className={`mt-4 p-3 rounded text-sm ${message.type === "success" ? "bg-green-50 text-green-700 border border-green-200" : "bg-red-50 text-red-600 border border-red-200"}`}>
                        {message.text}
                    </div>
                )}
                <button
                    onClick={() => setEditing(true)}
                    className="mt-4 text-sm text-[#8A6A28] hover:text-[#2C2A29] font-medium transition-colors"
                >
                    Edit Profile
                </button>
            </div>
        );
    }

    return (
        <form action={handleSubmit} className="p-6 space-y-4">
            <input type="hidden" name="userId" value={userId} />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label className="block text-xs text-gray-400 uppercase tracking-wider font-bold mb-1">Name</label>
                    <input
                        type="text"
                        name="name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="w-full px-4 py-3 bg-[#FDFBF7] border border-gray-200 rounded-lg text-[#2C2A29] focus:outline-none focus:border-[#CBA153] focus:ring-1 focus:ring-[#CBA153]"
                    />
                </div>
                <div>
                    <label className="block text-xs text-gray-400 uppercase tracking-wider font-bold mb-1">Phone</label>
                    <input
                        type="tel"
                        name="phone"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="(555) 123-4567"
                        className="w-full px-4 py-3 bg-[#FDFBF7] border border-gray-200 rounded-lg text-[#2C2A29] focus:outline-none focus:border-[#CBA153] focus:ring-1 focus:ring-[#CBA153]"
                    />
                </div>
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
                    {isPending ? "Saving..." : "Save Changes"}
                </button>
                <button
                    type="button"
                    onClick={() => { setEditing(false); setName(initialName); setPhone(initialPhone); setMessage(null); }}
                    className="px-6 py-2.5 border border-gray-200 text-gray-500 rounded-lg text-sm font-medium hover:bg-gray-50 transition"
                >
                    Cancel
                </button>
            </div>
        </form>
    );
}
