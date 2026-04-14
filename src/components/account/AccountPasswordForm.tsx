"use client";

import { useState, useTransition } from "react";
import { changePasswordAction } from "@/app/actions/auth";

interface Props {
    userId: string;
}

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
            <div className="p-6">
                <p className="text-[#2C2A29] text-sm">••••••••••••</p>
                {message && (
                    <div className={`mt-4 p-3 rounded text-sm ${message.type === "success" ? "bg-green-50 text-green-700 border border-green-200" : "bg-red-50 text-red-600 border border-red-200"}`}>
                        {message.text}
                    </div>
                )}
                <button
                    onClick={() => { setEditing(true); setMessage(null); }}
                    className="mt-4 text-sm text-[#8A6A28] hover:text-[#2C2A29] font-medium transition-colors"
                >
                    Change Password
                </button>
            </div>
        );
    }

    return (
        <form action={handleSubmit} className="p-6 space-y-4">
            <input type="hidden" name="userId" value={userId} />
            <div>
                <label className="block text-xs text-gray-400 uppercase tracking-wider font-bold mb-1">Current Password</label>
                <input
                    type="password"
                    name="currentPassword"
                    required
                    className="w-full px-4 py-3 bg-[#FDFBF7] border border-gray-200 rounded-lg text-[#2C2A29] focus:outline-none focus:border-[#CBA153] focus:ring-1 focus:ring-[#CBA153]"
                />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label className="block text-xs text-gray-400 uppercase tracking-wider font-bold mb-1">New Password</label>
                    <input
                        type="password"
                        name="newPassword"
                        required
                        minLength={8}
                        className="w-full px-4 py-3 bg-[#FDFBF7] border border-gray-200 rounded-lg text-[#2C2A29] focus:outline-none focus:border-[#CBA153] focus:ring-1 focus:ring-[#CBA153]"
                    />
                </div>
                <div>
                    <label className="block text-xs text-gray-400 uppercase tracking-wider font-bold mb-1">Confirm Password</label>
                    <input
                        type="password"
                        name="confirmPassword"
                        required
                        minLength={8}
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
                    {isPending ? "Changing..." : "Update Password"}
                </button>
                <button
                    type="button"
                    onClick={() => { setEditing(false); setMessage(null); }}
                    className="px-6 py-2.5 border border-gray-200 text-gray-500 rounded-lg text-sm font-medium hover:bg-gray-50 transition"
                >
                    Cancel
                </button>
            </div>
        </form>
    );
}
