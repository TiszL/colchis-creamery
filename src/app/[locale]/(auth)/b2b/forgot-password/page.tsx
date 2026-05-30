'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { requestB2bPasswordResetAction } from '@/app/actions/auth';

export default function B2BForgotPasswordPage() {
    const [sent, setSent] = useState(false);
    const [pending, start] = useTransition();

    const onSubmit = (fd: FormData) => start(async () => {
        await requestB2bPasswordResetAction(fd);
        setSent(true);
    });

    return (
        <main className="min-h-screen bg-[#1A1A1A] flex flex-col items-center justify-center p-6 text-[#CBA153]">
            <div className="w-full max-w-md">
                <div className="text-center mb-8">
                    <Link href="/" className="inline-block mb-6">
                        <img src="/logo.svg" alt="Colchis Food" className="w-16 h-16 object-contain mx-auto" />
                    </Link>
                    <h1 className="text-4xl font-serif text-white mb-2">Reset password</h1>
                    <p className="text-gray-400 font-light text-sm">Enter your work email and we&apos;ll send a reset link.</p>
                </div>
                {sent ? (
                    <div className="bg-[#2C2A29] p-8 rounded border border-gray-800 text-center">
                        <p className="text-gray-200 text-sm leading-relaxed">If an account exists for that email, a password-reset link is on its way. Check your inbox (and spam).</p>
                        <Link href="/b2b/login" className="inline-block mt-6 text-sm text-[#CBA153] hover:text-white transition-colors">&larr; Back to sign in</Link>
                    </div>
                ) : (
                    <form action={onSubmit} className="bg-[#2C2A29] p-8 rounded border border-gray-800 space-y-5">
                        <div>
                            <label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-2">Work email</label>
                            <input type="email" id="email" name="email" required placeholder="buyer@supermarket.com" className="w-full bg-[#1A1A1A] border border-gray-700 text-white placeholder-gray-600 p-3 rounded focus:outline-none focus:border-[#CBA153]" />
                        </div>
                        <button type="submit" disabled={pending} className="w-full bg-[#CBA153] hover:bg-[#b08d47] text-black font-medium py-3 rounded transition disabled:opacity-60">{pending ? 'Sending…' : 'Send reset link'}</button>
                        <Link href="/b2b/login" className="block text-center text-sm text-gray-400 hover:text-white transition-colors">&larr; Back to sign in</Link>
                    </form>
                )}
            </div>
        </main>
    );
}
