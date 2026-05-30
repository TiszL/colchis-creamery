'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { resetPasswordWithTokenAction } from '@/app/actions/auth';

export default function B2BResetPasswordPage() {
    // Read the token client-side (avoids useSearchParams' Suspense requirement).
    const [token] = useState(() =>
        typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('token') || '' : '',
    );
    const [error, setError] = useState<string | null>(null);
    const [done, setDone] = useState(false);
    const [pending, start] = useTransition();

    const onSubmit = (fd: FormData) => start(async () => {
        setError(null);
        fd.set('token', token);
        const r = await resetPasswordWithTokenAction(fd);
        if (r.ok) {
            setDone(true);
            setTimeout(() => window.location.assign('/b2b/login'), 1500);
        } else {
            setError(r.error || 'Something went wrong.');
        }
    });

    return (
        <main className="min-h-screen bg-[#1A1A1A] flex flex-col items-center justify-center p-6 text-[#CBA153]">
            <div className="w-full max-w-md">
                <div className="text-center mb-8">
                    <h1 className="text-4xl font-serif text-white mb-2">Choose a new password</h1>
                    <p className="text-gray-400 font-light text-sm">Set a new password for your B2B partner account.</p>
                </div>
                {done ? (
                    <div className="bg-[#2C2A29] p-8 rounded border border-gray-800 text-center">
                        <p className="text-emerald-400 text-sm">Password updated. Redirecting you to sign in…</p>
                    </div>
                ) : !token ? (
                    <div className="bg-[#2C2A29] p-8 rounded border border-gray-800 text-center">
                        <p className="text-gray-300 text-sm">This reset link is missing its token. Please request a new one.</p>
                        <Link href="/b2b/forgot-password" className="inline-block mt-6 text-sm text-[#CBA153] hover:text-white transition-colors">Request a new link</Link>
                    </div>
                ) : (
                    <form action={onSubmit} className="bg-[#2C2A29] p-8 rounded border border-gray-800 space-y-5">
                        {error && <div className="p-3 bg-red-900/40 text-red-200 border border-red-800 text-sm rounded">{error}</div>}
                        <div>
                            <label htmlFor="password" className="block text-sm font-medium text-gray-300 mb-2">New password</label>
                            <input type="password" id="password" name="password" required minLength={8} placeholder="At least 8 characters" className="w-full bg-[#1A1A1A] border border-gray-700 text-white placeholder-gray-600 p-3 rounded focus:outline-none focus:border-[#CBA153]" />
                        </div>
                        <button type="submit" disabled={pending} className="w-full bg-[#CBA153] hover:bg-[#b08d47] text-black font-medium py-3 rounded transition disabled:opacity-60">{pending ? 'Updating…' : 'Update password'}</button>
                    </form>
                )}
            </div>
        </main>
    );
}
