'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Package, Truck, ShieldCheck, Calculator } from 'lucide-react';
import Image from 'next/image';

interface BulkOrderClientProps {
    products: any[];
    discount: number;
}

type PaymentMethodChoice = 'STRIPE_CARD' | 'STRIPE_ACH' | 'RESOLVE_NET_7' | 'RESOLVE_NET_15' | 'RESOLVE_NET_30' | 'RESOLVE_NET_45';

const PAYMENT_OPTIONS: { value: PaymentMethodChoice; label: string; hint: string }[] = [
    { value: 'RESOLVE_NET_30', label: 'Resolve · Net 30',  hint: 'Pay in 30 days · credit check' },
    { value: 'RESOLVE_NET_15', label: 'Resolve · Net 15',  hint: 'Pay in 15 days' },
    { value: 'RESOLVE_NET_7',  label: 'Resolve · Net 7',   hint: 'Pay in 7 days' },
    { value: 'RESOLVE_NET_45', label: 'Resolve · Net 45',  hint: 'Pay in 45 days · subject to credit' },
    { value: 'STRIPE_ACH',     label: 'Pay now · ACH',     hint: 'Bank transfer · 1-3 day settlement' },
    { value: 'STRIPE_CARD',    label: 'Pay now · Card',    hint: 'Higher fee · instant' },
];

export default function BulkOrderClient({ products, discount }: BulkOrderClientProps) {
    const router = useRouter();
    const [quantities, setQuantities] = useState<Record<string, number>>({});
    const [isSubmitting, setIsSubmitting] = useState(false);
    // Phase 6 (6c) — Stripe vs Resolve choice at submit time. Default to
    // Net 30 since that's the most common B2B term.
    const [paymentMethod, setPaymentMethod] = useState<PaymentMethodChoice>('RESOLVE_NET_30');

    // Filter to only active products with stock > 0
    const availableProducts = products.filter(p => p.isActive && p.stockQuantity > 0);

    const handleQuantityChange = (productId: string, value: string, maxStock: number) => {
        let parsed = parseInt(value, 10);
        if (isNaN(parsed) || parsed < 0) parsed = 0;
        if (parsed > maxStock) parsed = maxStock;

        setQuantities(prev => ({
            ...prev,
            [productId]: parsed
        }));
    };

    const calculateTotals = () => {
        let subtotal = 0;
        availableProducts.forEach(product => {
            const qty = quantities[product.id] || 0;
            // Assumes B2B price implies a numeric value in string format "$50.00"
            const price = parseFloat(product.priceB2b.replace(/[^0-9.-]+/g, "")) || 0;
            subtotal += (qty * price);
        });

        const discountAmount = subtotal * (discount / 100);
        const total = subtotal - discountAmount;

        return { subtotal, discountAmount, total };
    };

    const totals = calculateTotals();
    const isOrderEmpty = totals.total === 0;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (isOrderEmpty) return;

        setIsSubmitting(true);

        const orderItems = Object.entries(quantities)
            .filter(([_, qty]) => qty > 0)
            .map(([id, qty]) => ({ id, quantity: qty }));

        try {
            const response = await fetch('/api/b2b/order', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ items: orderItems, paymentMethod }),
            });

            if (response.ok) {
                const data = await response.json().catch(() => ({}));
                // If Resolve returned a hosted pay URL, send the partner there
                // so they see the invoice immediately.
                if (data.invoicePayUrl) {
                    window.location.href = data.invoicePayUrl;
                    return;
                }
                router.push('/en/b2b-portal');
                router.refresh();
            } else {
                alert("Order failed. Please try again.");
            }
        } catch (error) {
            console.error(error);
            alert("Order failed due to network error.");
        } finally {
            setIsSubmitting(false);
        }
    };


    return (
        <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-3 gap-8">

            {/* Products List */}
            <div className="lg:col-span-2 space-y-4">
                {availableProducts.map(product => {
                    const priceNum = parseFloat(product.priceB2b.replace(/[^0-9.-]+/g, "")) || 0;
                    const discountedPrice = priceNum * (1 - (discount / 100));

                    return (
                        <div key={product.id} className="bg-white p-4 rounded-xl shadow-sm border border-[#E8E6E1] flex gap-6 items-center">
                            <div className="w-24 h-24 rounded overflow-hidden flex-shrink-0 bg-gray-100">
                                <img src={product.imageUrl} alt={product.name} className="w-full h-full object-cover" />
                            </div>

                            <div className="flex-1">
                                <h3 className="font-serif text-lg text-[#2C2A29]">{product.name}</h3>
                                <p className="text-sm text-gray-500 line-clamp-1">{product.description}</p>
                                <div className="mt-2 flex items-center gap-4 text-sm">
                                    <span className="text-gray-400 line-through">{product.priceB2b}</span>
                                    <span className="font-bold text-[#CBA153]">${discountedPrice.toFixed(2)} <span className="text-xs text-gray-400 font-normal">/ unit</span></span>
                                </div>
                            </div>

                            <div className="flex flex-col items-end gap-2 border-l border-[#E8E6E1] pl-6 ml-auto">
                                <label className="text-xs text-gray-500 font-medium uppercase">Order Qty</label>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="number"
                                        min="0"
                                        max={product.stockQuantity}
                                        value={quantities[product.id] || ''}
                                        onChange={(e) => handleQuantityChange(product.id, e.target.value, product.stockQuantity)}
                                        className="w-20 text-right border border-[#E8E6E1] rounded-md py-1.5 px-3 focus:ring-[#CBA153] focus:border-[#CBA153] outline-none transition"
                                        placeholder="0"
                                    />
                                </div>
                                <span className={`text-[10px] font-medium ${product.stockQuantity < 50 ? 'text-red-500' : 'text-green-600'}`}>
                                    {product.stockQuantity} in stock
                                </span>
                            </div>
                        </div>
                    );
                })}

                {availableProducts.length === 0 && (
                    <div className="bg-white p-12 rounded-xl text-center text-gray-500 border border-[#E8E6E1] shadow-sm">
                        No products are currently available for bulk order.
                    </div>
                )}
            </div>

            {/* Order Summary Sidebar */}
            <div className="lg:col-span-1">
                <div className="bg-[#2C2A29] rounded-xl shadow-lg sticky top-6 overflow-hidden">
                    <div className="p-6 border-b border-gray-700">
                        <h2 className="text-xl font-serif text-white flex items-center gap-2">
                            <Calculator className="w-5 h-5 text-[#CBA153]" />
                            Order Summary
                        </h2>
                    </div>

                    <div className="p-6 space-y-4 text-white">
                        <div className="flex justify-between text-gray-300">
                            <span>Subtotal</span>
                            <span>${totals.subtotal.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-[#CBA153]">
                            <span>Contract Discount ({discount}%)</span>
                            <span>-${totals.discountAmount.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-gray-300">
                            <span>Logistics & Freight</span>
                            <span className="text-xs mt-1">Calculated post-order</span>
                        </div>

                        <div className="pt-4 mt-4 border-t border-gray-700 flex justify-between items-end">
                            <div>
                                <span className="block text-sm text-gray-400">Total Estimated</span>
                                <span className="text-xs text-gray-500 line-through">${totals.subtotal.toFixed(2)}</span>
                            </div>
                            <span className="text-3xl font-serif text-white">${totals.total.toFixed(2)}</span>
                        </div>
                    </div>

                    <div className="p-6 bg-gray-900 border-t border-gray-800 space-y-4">
                        {/* Phase 6 (6c) — payment method choice */}
                        <div>
                            <label className="block text-[10px] font-bold text-gray-500 mb-2 uppercase tracking-wider">Payment method</label>
                            <select
                                value={paymentMethod}
                                onChange={e => setPaymentMethod(e.target.value as PaymentMethodChoice)}
                                className="w-full bg-gray-950 border border-gray-800 text-white py-2 px-3 text-sm rounded focus:outline-none focus:border-[#CBA153]"
                                disabled={isSubmitting}
                            >
                                {PAYMENT_OPTIONS.map(opt => (
                                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                                ))}
                            </select>
                            <p className="text-[10px] text-gray-500 mt-1">
                                {PAYMENT_OPTIONS.find(o => o.value === paymentMethod)?.hint}
                            </p>
                        </div>

                        <button
                            type="submit"
                            disabled={isOrderEmpty || isSubmitting}
                            className={`w-full py-3 rounded-lg font-medium transition flex items-center justify-center gap-2 ${isOrderEmpty ? 'bg-gray-800 text-gray-600 cursor-not-allowed' : 'bg-[#CBA153] hover:bg-[#b08d47] text-white shadow-md'
                                }`}
                        >
                            {isSubmitting ? 'Processing...' : 'Submit Bulk Order'}
                        </button>

                        <div className="text-[10px] text-gray-500 text-center flex flex-col items-center gap-1">
                            <ShieldCheck className="w-4 h-4 text-gray-400" />
                            <span>
                                {paymentMethod.startsWith('RESOLVE_')
                                    ? 'Resolve will issue an invoice with the selected net term.'
                                    : 'Stripe pay-now flow is being wired — for now the order is placed and sales will follow up.'}
                            </span>
                        </div>
                    </div>
                </div>
            </div>

        </form>
    );
}
