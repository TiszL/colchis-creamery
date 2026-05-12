'use client';

// Phase 7b.6 — Admin refund form.
//
// Renders inside the admin order detail's refund section. Submits to the
// refundOrder server action. Refreshes the page on success so the new
// Refund row + updated total-refunded math appear.

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { refundOrder, type RefundOrderInput } from '@/app/actions/orders';

interface Props {
    orderId: string;
    remainingCents: number;
}

export default function AdminRefundForm({ orderId, remainingCents }: Props) {
    const [amount, setAmount] = useState<string>('');
    const [reason, setReason] = useState<RefundOrderInput['reason']>('admin_full');
    const [notes, setNotes] = useState<string>('');
    const [restoreStock, setRestoreStock] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [isPending, startTransition] = useTransition();
    const router = useRouter();

    const remainingDollars = (remainingCents / 100).toFixed(2);
    const isFullRefund = reason === 'admin_full' || !amount || parseFloat(amount) <= 0;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setSuccess(null);

        // For "admin_full", the action interprets amountDollars <= 0 as full refund.
        const amountDollars = reason === 'admin_full' ? 0 : parseFloat(amount || '0');

        if (reason !== 'admin_full' && (!amount || amountDollars <= 0)) {
            setError('Enter a refund amount.');
            return;
        }

        startTransition(async () => {
            const result = await refundOrder({
                orderId,
                amountDollars,
                reason,
                notes: notes.trim() || undefined,
                restoreStock,
            });
            if (!result.ok) {
                setError(result.error);
                return;
            }
            setSuccess(`Refunded $${(result.amountCents / 100).toFixed(2)}.${result.fullyRefunded ? ' Order fully refunded.' : ''}`);
            setAmount('');
            setNotes('');
            setRestoreStock(false);
            // Refresh page so the new refund row + updated remaining show up
            setTimeout(() => router.refresh(), 600);
        });
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            {/* Reason */}
            <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-gray-500 block mb-2">Refund type</label>
                <div className="flex gap-2 flex-wrap">
                    {(['admin_full', 'admin_partial', 'admin_other'] as const).map(r => (
                        <label key={r} className={`px-3 py-2 text-xs font-medium uppercase tracking-wider border cursor-pointer rounded ${reason === r ? 'bg-[#2C2A29] text-white border-[#2C2A29]' : 'bg-white text-gray-700 border-gray-300 hover:border-gray-500'}`}>
                            <input
                                type="radio"
                                name="reason"
                                value={r}
                                checked={reason === r}
                                onChange={() => {
                                    setReason(r);
                                    if (r === 'admin_full') setAmount('');
                                }}
                                className="sr-only"
                            />
                            {r === 'admin_full' ? 'Full' : r === 'admin_partial' ? 'Partial' : 'Other'}
                        </label>
                    ))}
                </div>
            </div>

            {/* Amount (hidden for full refund) */}
            {reason !== 'admin_full' && (
                <div>
                    <label className="text-[10px] font-bold uppercase tracking-wider text-gray-500 block mb-2">
                        Amount (USD) <span className="text-gray-400">— max ${remainingDollars}</span>
                    </label>
                    <input
                        type="number"
                        step="0.01"
                        min="0.01"
                        max={remainingDollars}
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        placeholder="0.00"
                        className="w-full text-sm border border-gray-300 rounded py-2 px-3 focus:ring-2 focus:ring-[#B96A3D] focus:border-transparent outline-none"
                        required
                    />
                </div>
            )}

            {reason === 'admin_full' && (
                <div className="p-3 bg-amber-50 border border-amber-200 text-xs text-amber-900">
                    Full refund of <strong>${remainingDollars}</strong> remaining.
                </div>
            )}

            {/* Notes */}
            <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-gray-500 block mb-2">
                    Notes <span className="text-gray-400">— internal, audit trail</span>
                </label>
                <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="e.g. customer reported wrong item; full refund authorized via email"
                    rows={2}
                    className="w-full text-sm border border-gray-300 rounded py-2 px-3 focus:ring-2 focus:ring-[#B96A3D] focus:border-transparent outline-none"
                />
            </div>

            {/* Restore stock */}
            <label className="flex items-start gap-2 text-xs text-gray-700 cursor-pointer">
                <input
                    type="checkbox"
                    checked={restoreStock}
                    onChange={(e) => setRestoreStock(e.target.checked)}
                    className="mt-0.5 accent-[#B96A3D]"
                />
                <span>
                    <span className="font-medium">Also restore stock to inventory.</span>
                    <span className="block text-gray-500 mt-0.5">
                        Increments Stock.quantity back to pre-purchase levels (non-MTO products only). Skip if you already shipped or otherwise consumed the stock.
                    </span>
                </span>
            </label>

            {/* Submit */}
            <div>
                <button
                    type="submit"
                    disabled={isPending}
                    className="w-full px-4 py-2.5 text-xs font-bold uppercase tracking-wider bg-red-700 text-white hover:bg-red-800 transition rounded disabled:bg-gray-400 disabled:cursor-not-allowed"
                >
                    {isPending
                        ? 'Issuing refund…'
                        : isFullRefund ? `Issue full refund · $${remainingDollars}` : `Issue partial refund · $${parseFloat(amount || '0').toFixed(2)}`}
                </button>
            </div>

            {error && (
                <div className="p-3 bg-red-50 border border-red-200 text-xs text-red-800">
                    ⚠ {error}
                </div>
            )}
            {success && (
                <div className="p-3 bg-green-50 border border-green-200 text-xs text-green-800">
                    ✓ {success}
                </div>
            )}
        </form>
    );
}
