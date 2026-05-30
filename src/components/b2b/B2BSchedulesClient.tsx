'use client';

import { useState, useTransition } from 'react';
import { createScheduleAction, updateScheduleAction, toggleScheduleActiveAction, deleteScheduleAction } from '@/app/actions/b2b-schedules';
import { Play, Pause, Trash2, Plus, X, Pencil } from 'lucide-react';

interface Item { productId: string; quantity: number }
interface Schedule {
    id: string; name: string; intervalDays: number; paymentMethod: string;
    active: boolean; nextFireAt: string; fulfillmentLocationId: string | null; partnerLocationId: string | null; items: Item[];
}
interface Shop { id: string; label: string; city: string; state: string }
interface Props {
    schedules: Schedule[];
    products: { id: string; name: string }[];
    locations: { id: string; name: string }[];
    shops: Shop[];
    lockedShopId: string | null;
}

const NET_OPTIONS = [
    { value: 'RESOLVE_NET_7', label: 'Resolve · Net 7' },
    { value: 'RESOLVE_NET_15', label: 'Resolve · Net 15' },
    { value: 'RESOLVE_NET_30', label: 'Resolve · Net 30' },
    { value: 'RESOLVE_NET_45', label: 'Resolve · Net 45' },
];
const input = 'w-full bg-white border border-[#E8E6E1] text-[#2C2A29] py-2 px-3 text-sm rounded-md focus:outline-none focus:border-[#CBA153]';
const labelCls = 'block text-[10px] font-bold text-gray-500 mb-1 uppercase tracking-wider';

export default function B2BSchedulesClient({ schedules, products, locations, shops, lockedShopId }: Props) {
    const [mode, setMode] = useState<'closed' | 'create' | string>('closed'); // 'create' | scheduleId | 'closed'
    const [name, setName] = useState('');
    const [intervalDays, setIntervalDays] = useState(7);
    const [paymentMethod, setPaymentMethod] = useState('RESOLVE_NET_30');
    const [locationId, setLocationId] = useState('');
    const [shopId, setShopId] = useState('');
    const [items, setItems] = useState<Item[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [pending, start] = useTransition();

    const productName = (id: string) => products.find(p => p.id === id)?.name ?? id.slice(0, 8);
    const shopName = (id: string | null) => id ? (shops.find(s => s.id === id)?.label ?? null) : null;

    const openCreate = () => {
        setMode('create'); setName(''); setIntervalDays(7); setPaymentMethod('RESOLVE_NET_30');
        setLocationId(''); setShopId(lockedShopId ?? ''); setItems([{ productId: products[0]?.id ?? '', quantity: 1 }]); setError(null);
    };
    const openEdit = (s: Schedule) => {
        setMode(s.id); setName(s.name); setIntervalDays(s.intervalDays); setPaymentMethod(s.paymentMethod);
        setLocationId(s.fulfillmentLocationId ?? ''); setShopId(lockedShopId ?? s.partnerLocationId ?? '');
        setItems(s.items.length ? s.items : [{ productId: products[0]?.id ?? '', quantity: 1 }]); setError(null);
    };

    const submit = () => start(async () => {
        setError(null);
        const cleanItems = items.filter(i => i.productId && i.quantity >= 1);
        if (cleanItems.length === 0) { setError('Add at least one product.'); return; }
        const fd = new FormData();
        if (mode !== 'create') fd.set('id', mode);
        fd.set('name', name);
        fd.set('intervalDays', String(intervalDays));
        fd.set('paymentMethod', paymentMethod);
        fd.set('fulfillmentLocationId', locationId);
        fd.set('partnerLocationId', shopId);
        fd.set('itemsJson', JSON.stringify(cleanItems));
        const r = mode === 'create' ? await createScheduleAction(fd) : await updateScheduleAction(fd);
        if (r.ok) window.location.reload();
        else setError(r.error);
    });

    const doToggle = (id: string) => start(async () => { const fd = new FormData(); fd.set('id', id); await toggleScheduleActiveAction(fd); window.location.reload(); });
    const doDelete = (id: string) => start(async () => { if (!confirm('Delete this schedule?')) return; const fd = new FormData(); fd.set('id', id); await deleteScheduleAction(fd); window.location.reload(); });

    return (
        <div className="space-y-6">
            <div className="flex justify-end">
                <button onClick={openCreate} className="bg-[#CBA153] hover:bg-[#b08d47] text-white px-4 py-2 text-sm font-medium rounded-md transition inline-flex items-center gap-1.5">
                    <Plus className="w-4 h-4" /> New schedule
                </button>
            </div>

            {schedules.length === 0 && mode === 'closed' && (
                <div className="bg-white border border-[#E8E6E1] shadow-sm rounded-xl p-8 text-center text-gray-500 text-sm">
                    No schedules yet. Create one to auto-place a recurring wholesale order.
                </div>
            )}

            {/* Schedule list */}
            <div className="space-y-2">
                {schedules.map(s => (
                    <div key={s.id} className={`bg-white border border-[#E8E6E1] shadow-sm rounded-xl px-4 py-3 ${!s.active ? 'opacity-60' : ''}`}>
                        <div className="flex items-center justify-between gap-4">
                            <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                    <p className="text-sm font-medium text-[#2C2A29]">{s.name}</p>
                                    <span className="text-[10px] font-mono text-[#CBA153]">{s.paymentMethod.replace(/_/g, ' ')}</span>
                                    {!s.active && <span className="text-[10px] font-mono text-amber-600 uppercase tracking-wider">Paused</span>}
                                </div>
                                <p className="text-[11px] text-gray-500 font-mono">
                                    every {s.intervalDays}d · {s.items.reduce((n, i) => n + i.quantity, 0)} units · next {s.nextFireAt.slice(0, 10)}
                                    {shopName(s.partnerLocationId) ? ` · → ${shopName(s.partnerLocationId)}` : ''}
                                </p>
                                <p className="text-[11px] text-gray-400 truncate">{s.items.map(i => `${i.quantity}× ${productName(i.productId)}`).join(' · ')}</p>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                                <button onClick={() => openEdit(s)} className="p-2 text-gray-400 hover:text-[#2C2A29]" title="Edit"><Pencil className="w-3.5 h-3.5" /></button>
                                <button onClick={() => doToggle(s.id)} disabled={pending} className="p-2 text-gray-400 hover:text-[#2C2A29]" title={s.active ? 'Pause' : 'Resume'}>{s.active ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}</button>
                                <button onClick={() => doDelete(s.id)} disabled={pending} className="p-2 text-gray-400 hover:text-red-500" title="Delete"><Trash2 className="w-3.5 h-3.5" /></button>
                            </div>
                        </div>

                        {/* Inline edit form */}
                        {mode === s.id && ScheduleForm()}
                    </div>
                ))}
            </div>

            {/* Create form */}
            {mode === 'create' && (
                <div className="bg-white border border-[#E8E6E1] shadow-sm rounded-xl p-5">
                    <h2 className="text-lg font-serif text-[#2C2A29] mb-3">New schedule</h2>
                    {ScheduleForm()}
                </div>
            )}
        </div>
    );

    function ScheduleForm() {
        return (
            <div className="mt-3 pt-3 border-t border-[#E8E6E1] space-y-3">
                {error && <div className="p-2 bg-red-50 text-red-700 border border-red-200 text-xs rounded">{error}</div>}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div><label className={labelCls}>Name</label><input value={name} onChange={e => setName(e.target.value)} placeholder="Weekly sulguni" className={input} /></div>
                    <div><label className={labelCls}>Every (days)</label><input type="number" min={1} value={intervalDays} onChange={e => setIntervalDays(parseInt(e.target.value, 10) || 1)} className={input} /></div>
                    <div><label className={labelCls}>Payment</label>
                        <select value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)} className={input}>
                            {NET_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </select>
                    </div>
                    <div><label className={labelCls}>Ship from</label>
                        <select value={locationId} onChange={e => setLocationId(e.target.value)} className={input}>
                            <option value="">— Auto —</option>
                            {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                        </select>
                    </div>
                    {(shops.length > 0 || lockedShopId) && (
                        <div><label className={labelCls}>Ship to shop</label>
                            {lockedShopId ? (
                                <p className="text-sm text-[#2C2A29] py-2">{shopName(lockedShopId) ?? 'Your shop'} <span className="text-xs text-gray-400">(assigned)</span></p>
                            ) : (
                                <select value={shopId} onChange={e => setShopId(e.target.value)} className={input}>
                                    <option value="">— None —</option>
                                    {shops.map(s => <option key={s.id} value={s.id}>{s.label} — {s.city}, {s.state}</option>)}
                                </select>
                            )}
                        </div>
                    )}
                </div>
                <div>
                    <label className={labelCls}>Products</label>
                    <div className="space-y-2">
                        {items.map((it, idx) => (
                            <div key={idx} className="flex items-center gap-2">
                                <select value={it.productId} onChange={e => setItems(items.map((x, i) => i === idx ? { ...x, productId: e.target.value } : x))} className={`${input} flex-1`}>
                                    {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                </select>
                                <input type="number" min={1} value={it.quantity} onChange={e => setItems(items.map((x, i) => i === idx ? { ...x, quantity: parseInt(e.target.value, 10) || 1 } : x))} className={`${input} w-20`} />
                                <button type="button" onClick={() => setItems(items.filter((_, i) => i !== idx))} className="p-2 text-gray-400 hover:text-red-500"><X className="w-4 h-4" /></button>
                            </div>
                        ))}
                    </div>
                    <button type="button" onClick={() => setItems([...items, { productId: products[0]?.id ?? '', quantity: 1 }])} className="mt-2 text-xs text-[#CBA153] hover:text-[#2C2A29] inline-flex items-center gap-1"><Plus className="w-3 h-3" /> Add product</button>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={submit} disabled={pending} className="bg-[#CBA153] hover:bg-[#b08d47] text-white px-4 py-2 text-sm font-medium rounded-md transition disabled:opacity-60">{pending ? 'Saving…' : 'Save schedule'}</button>
                    <button onClick={() => { setMode('closed'); setError(null); }} className="text-sm text-gray-500 hover:text-[#2C2A29] px-2">Cancel</button>
                </div>
            </div>
        );
    }
}
