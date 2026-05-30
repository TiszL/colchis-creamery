'use client';

import { useState, useTransition } from 'react';
import { createShopLocationAction, updateShopLocationAction, setShopActiveAction } from '@/app/actions/b2b-org';
import { Plus, Pencil, Store, Power } from 'lucide-react';

interface Shop {
    id: string; label: string; line1: string; line2: string | null; city: string; state: string; postalCode: string;
    contactName: string | null; contactPhone: string | null; isActive: boolean;
    separateBilling: boolean; billingCompanyName: string | null; billingEin: string | null; billingEmail: string | null; billingAddress: string | null;
}
interface FormState {
    label: string; line1: string; line2: string; city: string; state: string; postalCode: string;
    contactName: string; contactPhone: string; separateBilling: boolean;
    billingCompanyName: string; billingEin: string; billingEmail: string; billingAddress: string;
}
const EMPTY: FormState = {
    label: '', line1: '', line2: '', city: '', state: '', postalCode: '', contactName: '', contactPhone: '',
    separateBilling: false, billingCompanyName: '', billingEin: '', billingEmail: '', billingAddress: '',
};
const input = 'w-full bg-white border border-[#E8E6E1] text-[#2C2A29] py-2 px-3 text-sm rounded-md focus:outline-none focus:border-[#CBA153]';
const lbl = 'block text-[10px] font-bold text-gray-500 mb-1 uppercase tracking-wider';

export default function B2BShopsClient({ shops }: { shops: Shop[] }) {
    const [mode, setMode] = useState<'closed' | 'create' | string>('closed');
    const [form, setForm] = useState<FormState>(EMPTY);
    const [error, setError] = useState<string | null>(null);
    const [pending, start] = useTransition();

    const set = (k: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
        setForm(prev => ({ ...prev, [k]: e.target.value }));

    const openCreate = () => { setForm(EMPTY); setError(null); setMode('create'); };
    const openEdit = (s: Shop) => {
        setForm({
            label: s.label, line1: s.line1, line2: s.line2 ?? '', city: s.city, state: s.state, postalCode: s.postalCode,
            contactName: s.contactName ?? '', contactPhone: s.contactPhone ?? '', separateBilling: s.separateBilling,
            billingCompanyName: s.billingCompanyName ?? '', billingEin: s.billingEin ?? '', billingEmail: s.billingEmail ?? '', billingAddress: s.billingAddress ?? '',
        });
        setError(null); setMode(s.id);
    };

    const submit = () => start(async () => {
        setError(null);
        const fd = new FormData();
        if (mode !== 'create') fd.set('id', mode);
        Object.entries(form).forEach(([k, v]) => fd.set(k, typeof v === 'boolean' ? (v ? 'true' : 'false') : v));
        const r = mode === 'create' ? await createShopLocationAction(fd) : await updateShopLocationAction(fd);
        if (r.ok) window.location.reload();
        else setError(r.error);
    });

    const toggleActive = (s: Shop) => start(async () => {
        const fd = new FormData(); fd.set('id', s.id); fd.set('isActive', s.isActive ? 'false' : 'true');
        await setShopActiveAction(fd); window.location.reload();
    });

    return (
        <div className="space-y-6">
            <div className="flex justify-end">
                <button onClick={openCreate} className="bg-[#CBA153] hover:bg-[#b08d47] text-white px-4 py-2 text-sm font-medium rounded-md transition inline-flex items-center gap-1.5">
                    <Plus className="w-4 h-4" /> Add shop
                </button>
            </div>

            {shops.length === 0 && mode === 'closed' && (
                <div className="bg-white border border-[#E8E6E1] shadow-sm rounded-xl p-8 text-center text-gray-500 text-sm">
                    No shops yet. Add one to start ordering per location.
                </div>
            )}

            <div className="space-y-2">
                {shops.map(s => (
                    <div key={s.id} className={`bg-white border border-[#E8E6E1] shadow-sm rounded-xl px-4 py-3 ${!s.isActive ? 'opacity-60' : ''}`}>
                        <div className="flex items-start justify-between gap-4">
                            <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                    <Store className="w-3.5 h-3.5 text-[#CBA153] shrink-0" />
                                    <p className="text-sm font-medium text-[#2C2A29]">{s.label}</p>
                                    {s.separateBilling && <span className="text-[10px] font-mono text-[#CBA153] uppercase tracking-wider">Subcompany</span>}
                                    {!s.isActive && <span className="text-[10px] font-mono text-amber-600 uppercase tracking-wider">Inactive</span>}
                                </div>
                                <p className="text-[11px] text-gray-500 mt-0.5">
                                    {s.line1}{s.line2 ? `, ${s.line2}` : ''}, {s.city}, {s.state} {s.postalCode}
                                </p>
                                {(s.contactName || s.contactPhone) && (
                                    <p className="text-[11px] text-gray-400">{[s.contactName, s.contactPhone].filter(Boolean).join(' · ')}</p>
                                )}
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                                <button onClick={() => openEdit(s)} className="p-2 text-gray-400 hover:text-[#2C2A29]" title="Edit"><Pencil className="w-3.5 h-3.5" /></button>
                                <button onClick={() => toggleActive(s)} disabled={pending} className="p-2 text-gray-400 hover:text-[#2C2A29]" title={s.isActive ? 'Deactivate' : 'Activate'}><Power className="w-3.5 h-3.5" /></button>
                            </div>
                        </div>
                        {mode === s.id && shopForm()}
                    </div>
                ))}
            </div>

            {mode === 'create' && (
                <div className="bg-white border border-[#E8E6E1] shadow-sm rounded-xl p-5">
                    <h2 className="text-lg font-serif text-[#2C2A29] mb-3">New shop</h2>
                    {shopForm()}
                </div>
            )}
        </div>
    );

    function shopForm() {
        return (
            <div className="mt-3 pt-3 border-t border-[#E8E6E1] space-y-3">
                {error && <div className="p-2 bg-red-50 text-red-700 border border-red-200 text-xs rounded">{error}</div>}
                <div>
                    <label className={lbl}>Shop name</label>
                    <input value={form.label} onChange={set('label')} placeholder="Downtown Store" className={input} />
                </div>
                <div>
                    <label className={lbl}>Ship-to address</label>
                    <input value={form.line1} onChange={set('line1')} placeholder="Street address" className={`${input} mb-2`} />
                    <input value={form.line2} onChange={set('line2')} placeholder="Suite / unit (optional)" className={`${input} mb-2`} />
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        <input value={form.city} onChange={set('city')} placeholder="City" className={input} />
                        <input value={form.state} onChange={set('state')} placeholder="State" className={input} />
                        <input value={form.postalCode} onChange={set('postalCode')} placeholder="ZIP" className={input} />
                    </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div><label className={lbl}>Contact name</label><input value={form.contactName} onChange={set('contactName')} placeholder="Receiving manager" className={input} /></div>
                    <div><label className={lbl}>Contact phone</label><input value={form.contactPhone} onChange={set('contactPhone')} placeholder="(555) 010-1234" className={input} /></div>
                </div>

                <label className="flex items-center gap-2 text-sm text-[#2C2A29] pt-1 cursor-pointer">
                    <input type="checkbox" checked={form.separateBilling} onChange={e => setForm(p => ({ ...p, separateBilling: e.target.checked }))} className="accent-[#CBA153]" />
                    Bill this shop as a separate company (its own invoices &amp; AR)
                </label>

                {form.separateBilling && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-[#FDFBF7] border border-[#E8E6E1] rounded-md">
                        <div><label className={lbl}>Legal company name</label><input value={form.billingCompanyName} onChange={set('billingCompanyName')} placeholder="Downtown Foods LLC" className={input} /></div>
                        <div><label className={lbl}>Tax ID / EIN</label><input value={form.billingEin} onChange={set('billingEin')} placeholder="00-0000000" className={input} /></div>
                        <div><label className={lbl}>Billing email</label><input value={form.billingEmail} onChange={set('billingEmail')} placeholder="ap@downtown.com" className={input} /></div>
                        <div><label className={lbl}>Billing address</label><input value={form.billingAddress} onChange={set('billingAddress')} placeholder="Registered address" className={input} /></div>
                    </div>
                )}

                <div className="flex items-center gap-2">
                    <button onClick={submit} disabled={pending} className="bg-[#CBA153] hover:bg-[#b08d47] text-white px-4 py-2 text-sm font-medium rounded-md transition disabled:opacity-60">{pending ? 'Saving…' : 'Save shop'}</button>
                    <button onClick={() => { setMode('closed'); setError(null); }} className="text-sm text-gray-500 hover:text-[#2C2A29] px-2">Cancel</button>
                </div>
            </div>
        );
    }
}
