'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { submitWholesaleLead } from '@/actions/wholesale';

function SubmitButton() {
    const { pending } = useFormStatus();

    return (
        <button
            type="submit"
            disabled={pending}
            className={`w-full py-3 mt-8 text-white font-medium rounded transition ${pending ? 'bg-gray-400 cursor-not-allowed' : 'bg-[#CBA153] hover:bg-opacity-90'
                }`}
        >
            {pending ? 'Sending...' : 'Request Partnership'}
        </button>
    );
}

export default function WholesaleForm() {
    const [state, formAction] = useFormState(submitWholesaleLead, null);

    return (
        <div className="max-w-2xl mx-auto p-8 md:p-12 bg-[#2C2A29] text-white shadow-2xl rounded-sm border border-[#1a1918]">
            <h2 className="text-3xl md:text-4xl font-serif text-[#CBA153] mb-4 text-center">
                Partner With Us
            </h2>
            <p className="text-center text-gray-300 mb-10 leading-relaxed max-w-lg mx-auto">
                Join our exclusive network of premium retailers and restaurants. Offer your customers the authentic taste of Colchis heritage.
            </p>

            {state?.success ? (
                <div className="p-6 bg-[#CBA153]/10 text-[#CBA153] rounded border border-[#CBA153]/30 text-center text-lg">
                    {state.success}
                </div>
            ) : (
                <form action={formAction} className="flex flex-col gap-6">

                    {state?.error && (
                        <div className="text-red-400 text-sm p-3 bg-red-400/10 rounded border border-red-400/20">
                            {state.error}
                        </div>
                    )}

                    <div>
                        <label className="block text-sm text-gray-300 mb-2 font-medium tracking-wide">Company Name *</label>
                        <input
                            type="text"
                            name="companyName"
                            required
                            className="w-full bg-[#1a1918] border border-gray-700 text-white p-3 rounded focus:outline-none focus:border-[#CBA153] transition"
                        />
                    </div>

                    <div>
                        <label className="block text-sm text-gray-300 mb-2 font-medium tracking-wide">Contact Email *</label>
                        <input
                            type="email"
                            name="email"
                            required
                            className="w-full bg-[#1a1918] border border-gray-700 text-white p-3 rounded focus:outline-none focus:border-[#CBA153] transition"
                        />
                    </div>

                    <div>
                        <label className="block text-sm text-gray-300 mb-2 font-medium tracking-wide">Estimated Monthly Volume</label>
                        <select
                            name="volume"
                            className="w-full bg-[#1a1918] border border-gray-700 text-white p-3 rounded focus:outline-none focus:border-[#CBA153] transition appearance-none"
                        >
                            <option value="Under 50 lbs">Under 50 lbs</option>
                            <option value="50 - 200 lbs">50 - 200 lbs</option>
                            <option value="200+ lbs">200+ lbs</option>
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm text-gray-300 mb-2 font-medium tracking-wide">Additional Information</label>
                        <textarea
                            name="message"
                            rows={4}
                            className="w-full bg-[#1a1918] border border-gray-700 text-white p-3 rounded focus:outline-none focus:border-[#CBA153] transition resize-y"
                        ></textarea>
                    </div>

                    <SubmitButton />
                </form>
            )}
        </div>
    );
}
