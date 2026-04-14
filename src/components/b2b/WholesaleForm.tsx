'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { submitWholesaleLead } from '@/actions/wholesale';
import { useState, useEffect } from 'react';
import { CheckCircle, Send, Loader2 } from 'lucide-react';

function SubmitButton() {
    const { pending } = useFormStatus();

    return (
        <button
            type="submit"
            disabled={pending}
            className={`w-full py-4 mt-6 font-bold uppercase tracking-widest text-sm rounded-sm transition-all flex items-center justify-center gap-2 ${
                pending
                    ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                    : 'bg-[#CBA153] text-black hover:bg-white hover:text-[#2C2A29] shadow-lg shadow-[#CBA153]/20'
            }`}
        >
            {pending ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Processing...</>
            ) : (
                <><Send className="w-4 h-4" /> Request Partnership</>
            )}
        </button>
    );
}

export default function WholesaleForm() {
    const [state, formAction] = useActionState(submitWholesaleLead, null);
    // Honeypot timestamp — bots fill forms instantly
    const [loadTime] = useState(() => Date.now());

    const inputClass = "w-full bg-[#1a1918] border border-gray-700 text-white p-3.5 rounded-sm focus:outline-none focus:border-[#CBA153] focus:ring-1 focus:ring-[#CBA153]/30 transition placeholder-gray-600";

    if (state?.success) {
        return (
            <div className="max-w-2xl mx-auto p-8 md:p-12 bg-[#2C2A29] text-white shadow-2xl rounded-sm border border-[#1a1918]">
                <div className="text-center py-8">
                    <div className="w-16 h-16 rounded-full bg-emerald-500/10 flex items-center justify-center mx-auto mb-6">
                        <CheckCircle className="w-8 h-8 text-emerald-400" />
                    </div>
                    <h3 className="text-2xl font-serif text-[#CBA153] mb-4">Application Received!</h3>
                    <p className="text-gray-300 leading-relaxed max-w-md mx-auto">
                        {state.success}
                    </p>
                    <p className="text-gray-500 text-sm mt-6">
                        A confirmation email has been sent to your inbox.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-2xl mx-auto text-white">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-serif text-[#CBA153] mb-3 md:mb-4 text-center">
                Partner With Us
            </h2>
            <p className="text-center text-gray-300 mb-6 md:mb-10 leading-relaxed max-w-lg mx-auto text-sm md:text-base">
                Join our exclusive network of premium retailers and restaurants. Offer your
                customers the authentic taste of Colchis heritage.
            </p>

            <form action={formAction} className="flex flex-col gap-5">
                {state?.error && (
                    <div className="text-red-400 text-sm p-3 bg-red-400/10 rounded border border-red-400/20">
                        {state.error}
                    </div>
                )}

                {/* Honeypot — hidden from humans, bots fill it */}
                <input
                    type="text"
                    name="website_url"
                    tabIndex={-1}
                    autoComplete="off"
                    style={{ position: 'absolute', left: '-9999px', opacity: 0, height: 0 }}
                />
                {/* Timestamp for timing-based bot detection */}
                <input type="hidden" name="_loadTime" value={loadTime.toString()} />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div>
                        <label className="block text-sm text-gray-300 mb-2 font-medium tracking-wide">Company Name *</label>
                        <input
                            type="text"
                            name="companyName"
                            required
                            placeholder="Your business name"
                            className={inputClass}
                        />
                    </div>
                    <div>
                        <label className="block text-sm text-gray-300 mb-2 font-medium tracking-wide">Contact Person *</label>
                        <input
                            type="text"
                            name="contactName"
                            required
                            placeholder="Full name"
                            className={inputClass}
                        />
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div>
                        <label className="block text-sm text-gray-300 mb-2 font-medium tracking-wide">Contact Email *</label>
                        <input
                            type="email"
                            name="email"
                            required
                            placeholder="business@example.com"
                            className={inputClass}
                        />
                    </div>
                    <div>
                        <label className="block text-sm text-gray-300 mb-2 font-medium tracking-wide">Phone Number *</label>
                        <input
                            type="tel"
                            name="phone"
                            required
                            placeholder="+1 (555) 123-4567"
                            className={inputClass}
                        />
                    </div>
                </div>

                <div>
                    <label className="block text-sm text-gray-300 mb-2 font-medium tracking-wide">Business Address *</label>
                    <input
                        type="text"
                        name="address"
                        required
                        placeholder="Street, City, State ZIP"
                        className={inputClass}
                    />
                </div>

                <div>
                    <label className="block text-sm text-gray-300 mb-2 font-medium tracking-wide">Estimated Monthly Volume</label>
                    <select
                        name="volume"
                        className={`${inputClass} appearance-none`}
                    >
                        <option value="Under 50 lbs">Under 50 lbs</option>
                        <option value="50 - 200 lbs">50 - 200 lbs</option>
                        <option value="200 - 500 lbs">200 - 500 lbs</option>
                        <option value="500+ lbs">500+ lbs</option>
                    </select>
                </div>

                <div>
                    <label className="block text-sm text-gray-300 mb-2 font-medium tracking-wide">Additional Information</label>
                    <textarea
                        name="message"
                        rows={3}
                        placeholder="Tell us about your business, what products you're interested in, etc."
                        className={`${inputClass} resize-y`}
                    ></textarea>
                </div>

                <SubmitButton />

                <p className="text-[11px] text-gray-400 text-center mt-2">
                    By submitting this form, you agree to be contacted by Colchis Creamery regarding wholesale partnership opportunities.
                </p>
            </form>
        </div>
    );
}
