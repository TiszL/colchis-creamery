'use client';

import { useState, useTransition, useEffect } from 'react';
import { submitContactFormAction } from '@/app/actions/contact';

export default function ContactFormClient() {
    const [isPending, startTransition] = useTransition();
    const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
    const [errorMsg, setErrorMsg] = useState('');
    const [loadedAt] = useState(() => Date.now().toString());

    function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        const form = e.currentTarget;
        const fd = new FormData(form);
        fd.set('_t', loadedAt);

        startTransition(async () => {
            const result = await submitContactFormAction(fd);
            if (result.success) {
                setStatus('success');
                form.reset();
            } else {
                setStatus('error');
                setErrorMsg(result.error || 'Something went wrong.');
            }
        });
    }

    if (status === 'success') {
        return (
            <div className="text-center py-8">
                <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-green-50 mb-4">
                    <svg className="w-7 h-7 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                </div>
                <h3 className="text-xl font-serif text-[#2C2A29] mb-2">Message Sent!</h3>
                <p className="text-[#2C2A29]/60 text-sm">Thank you for reaching out. We&apos;ll respond within 1-2 business days.</p>
                <button
                    type="button"
                    onClick={() => setStatus('idle')}
                    className="mt-4 text-sm text-[#A6812F] hover:underline font-medium"
                >
                    Send another message
                </button>
            </div>
        );
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            {/* Honeypot — invisible to humans, bots will fill it */}
            <div className="absolute opacity-0 h-0 w-0 overflow-hidden" aria-hidden="true">
                <label htmlFor="website">Website</label>
                <input type="text" id="website" name="website" tabIndex={-1} autoComplete="off" />
            </div>

            <div>
                <label htmlFor="contact-name" className="block text-sm text-[#2C2A29] mb-1">Full Name</label>
                <input
                    id="contact-name"
                    name="name"
                    type="text"
                    required
                    minLength={2}
                    maxLength={100}
                    className="w-full border border-gray-300 p-3 rounded focus:outline-none focus:border-[#CBA153]"
                    placeholder="Your full name"
                />
            </div>
            <div>
                <label htmlFor="contact-email" className="block text-sm text-[#2C2A29] mb-1">Email Address</label>
                <input
                    id="contact-email"
                    name="email"
                    type="email"
                    required
                    maxLength={200}
                    className="w-full border border-gray-300 p-3 rounded focus:outline-none focus:border-[#CBA153]"
                    placeholder="you@example.com"
                />
            </div>
            <div>
                <label htmlFor="contact-message" className="block text-sm text-[#2C2A29] mb-1">Message</label>
                <textarea
                    id="contact-message"
                    name="message"
                    required
                    minLength={10}
                    maxLength={5000}
                    rows={4}
                    className="w-full border border-gray-300 p-3 rounded focus:outline-none focus:border-[#CBA153]"
                    placeholder="How can we help you?"
                />
            </div>

            {/* Error message */}
            {status === 'error' && (
                <p className="text-red-600 text-sm bg-red-50 px-4 py-2.5 rounded">{errorMsg}</p>
            )}

            <button
                type="submit"
                disabled={isPending}
                className="bg-[#2C2A29] text-white px-8 py-3 rounded hover:bg-opacity-90 transition font-medium w-full disabled:opacity-50 disabled:cursor-not-allowed"
            >
                {isPending ? 'Sending...' : 'Send Message'}
            </button>
        </form>
    );
}
