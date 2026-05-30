'use client';

import { useState, useTransition } from 'react';
import { inviteMemberAction, updateMemberAction, setMemberStatusAction, removeMemberAction } from '@/app/actions/b2b-members';
import { Plus, Pencil, Power, Trash2, Mail, KeyRound } from 'lucide-react';

interface Member { id: string; email: string; name: string | null; status: string; canViewBilling: boolean; assignedLocationId: string | null }
interface Shop { id: string; label: string }
interface Props { members: Member[]; shops: Shop[] }

const input = 'w-full bg-white border border-[#E8E6E1] text-[#2C2A29] py-2 px-3 text-sm rounded-md focus:outline-none focus:border-[#CBA153]';
const lbl = 'block text-[10px] font-bold text-gray-500 mb-1 uppercase tracking-wider';

export default function B2BTeamClient({ members, shops }: Props) {
    const [mode, setMode] = useState<'closed' | 'invite' | string>('closed');
    const [email, setEmail] = useState('');
    const [name, setName] = useState('');
    const [assignedLocationId, setAssignedLocationId] = useState('');
    const [canViewBilling, setCanViewBilling] = useState(false);
    const [inviteMode, setInviteMode] = useState<'email' | 'password'>('email');
    const [password, setPassword] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [note, setNote] = useState<string | null>(null);
    const [pending, start] = useTransition();

    const shopName = (id: string | null) => id ? (shops.find(s => s.id === id)?.label ?? 'Unknown shop') : 'All shops';

    const openInvite = () => {
        setEmail(''); setName(''); setAssignedLocationId(''); setCanViewBilling(false);
        setInviteMode('email'); setPassword(''); setError(null); setNote(null); setMode('invite');
    };
    const openEdit = (m: Member) => {
        setName(m.name ?? ''); setAssignedLocationId(m.assignedLocationId ?? ''); setCanViewBilling(m.canViewBilling);
        setError(null); setNote(null); setMode(m.id);
    };

    const submitInvite = () => start(async () => {
        setError(null);
        const fd = new FormData();
        fd.set('email', email); fd.set('name', name); fd.set('assignedLocationId', assignedLocationId);
        fd.set('canViewBilling', canViewBilling ? 'on' : ''); fd.set('mode', inviteMode);
        if (inviteMode === 'password') fd.set('password', password);
        const r = await inviteMemberAction(fd);
        if (r.ok) { if (r.note) { setNote(r.note); setMode('closed'); } else window.location.reload(); }
        else setError(r.error);
    });

    const submitEdit = (id: string) => start(async () => {
        setError(null);
        const fd = new FormData();
        fd.set('id', id); fd.set('name', name); fd.set('assignedLocationId', assignedLocationId);
        fd.set('canViewBilling', canViewBilling ? 'on' : '');
        const r = await updateMemberAction(fd);
        if (r.ok) window.location.reload(); else setError(r.error);
    });

    const toggleStatus = (m: Member) => start(async () => {
        const fd = new FormData(); fd.set('id', m.id); fd.set('status', m.status === 'ACTIVE' ? 'DISABLED' : 'ACTIVE');
        await setMemberStatusAction(fd); window.location.reload();
    });
    const remove = (m: Member) => start(async () => {
        if (!confirm(`Remove ${m.email} from your team?`)) return;
        const fd = new FormData(); fd.set('id', m.id); await removeMemberAction(fd); window.location.reload();
    });

    const statusBadge = (s: string) => {
        const map: Record<string, string> = { ACTIVE: 'text-emerald-600', PENDING: 'text-amber-600', DISABLED: 'text-gray-400' };
        return <span className={`text-[10px] font-mono uppercase tracking-wider ${map[s] ?? 'text-gray-400'}`}>{s === 'PENDING' ? 'Invited' : s}</span>;
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-end">
                <button onClick={openInvite} className="bg-[#CBA153] hover:bg-[#b08d47] text-white px-4 py-2 text-sm font-medium rounded-md transition inline-flex items-center gap-1.5">
                    <Plus className="w-4 h-4" /> Invite member
                </button>
            </div>

            {note && <div className="p-3 bg-emerald-50 text-emerald-700 border border-emerald-200 text-sm rounded">{note}</div>}

            {members.length === 0 && mode === 'closed' && !note && (
                <div className="bg-white border border-[#E8E6E1] shadow-sm rounded-xl p-8 text-center text-gray-500 text-sm">
                    No teammates yet. Invite someone to order on your account.
                </div>
            )}

            <div className="space-y-2">
                {members.map(m => (
                    <div key={m.id} className={`bg-white border border-[#E8E6E1] shadow-sm rounded-xl px-4 py-3 ${m.status === 'DISABLED' ? 'opacity-60' : ''}`}>
                        <div className="flex items-start justify-between gap-4">
                            <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                    <p className="text-sm font-medium text-[#2C2A29]">{m.name || m.email}</p>
                                    {statusBadge(m.status)}
                                    {m.canViewBilling && <span className="text-[10px] font-mono text-[#CBA153] uppercase tracking-wider">Billing</span>}
                                </div>
                                {m.name && <p className="text-[11px] text-gray-500 font-mono">{m.email}</p>}
                                <p className="text-[11px] text-gray-400">Orders for: {shopName(m.assignedLocationId)}</p>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                                <button onClick={() => openEdit(m)} className="p-2 text-gray-400 hover:text-[#2C2A29]" title="Edit"><Pencil className="w-3.5 h-3.5" /></button>
                                {m.status !== 'PENDING' && (
                                    <button onClick={() => toggleStatus(m)} disabled={pending} className="p-2 text-gray-400 hover:text-[#2C2A29]" title={m.status === 'ACTIVE' ? 'Disable' : 'Enable'}><Power className="w-3.5 h-3.5" /></button>
                                )}
                                <button onClick={() => remove(m)} disabled={pending} className="p-2 text-gray-400 hover:text-red-500" title="Remove"><Trash2 className="w-3.5 h-3.5" /></button>
                            </div>
                        </div>

                        {mode === m.id && (
                            <div className="mt-3 pt-3 border-t border-[#E8E6E1] space-y-3">
                                {error && <div className="p-2 bg-red-50 text-red-700 border border-red-200 text-xs rounded">{error}</div>}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <div><label className={lbl}>Name</label><input value={name} onChange={e => setName(e.target.value)} className={input} /></div>
                                    <div><label className={lbl}>Orders for shop</label>
                                        <select value={assignedLocationId} onChange={e => setAssignedLocationId(e.target.value)} className={input}>
                                            <option value="">All shops</option>
                                            {shops.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                                        </select>
                                    </div>
                                </div>
                                <label className="flex items-center gap-2 text-sm text-[#2C2A29] cursor-pointer">
                                    <input type="checkbox" checked={canViewBilling} onChange={e => setCanViewBilling(e.target.checked)} className="accent-[#CBA153]" /> Can view invoices &amp; billing
                                </label>
                                <div className="flex items-center gap-2">
                                    <button onClick={() => submitEdit(m.id)} disabled={pending} className="bg-[#CBA153] hover:bg-[#b08d47] text-white px-4 py-2 text-sm font-medium rounded-md transition disabled:opacity-60">{pending ? 'Saving…' : 'Save'}</button>
                                    <button onClick={() => { setMode('closed'); setError(null); }} className="text-sm text-gray-500 hover:text-[#2C2A29] px-2">Cancel</button>
                                </div>
                            </div>
                        )}
                    </div>
                ))}
            </div>

            {mode === 'invite' && (
                <div className="bg-white border border-[#E8E6E1] shadow-sm rounded-xl p-5 space-y-3">
                    <h2 className="text-lg font-serif text-[#2C2A29]">Invite a teammate</h2>
                    {error && <div className="p-2 bg-red-50 text-red-700 border border-red-200 text-xs rounded">{error}</div>}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div><label className={lbl}>Email</label><input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="buyer@shop.com" className={input} /></div>
                        <div><label className={lbl}>Name (optional)</label><input value={name} onChange={e => setName(e.target.value)} placeholder="Jane Buyer" className={input} /></div>
                        <div><label className={lbl}>Orders for shop</label>
                            <select value={assignedLocationId} onChange={e => setAssignedLocationId(e.target.value)} className={input}>
                                <option value="">All shops</option>
                                {shops.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                            </select>
                        </div>
                        <div className="flex items-end">
                            <label className="flex items-center gap-2 text-sm text-[#2C2A29] cursor-pointer pb-2">
                                <input type="checkbox" checked={canViewBilling} onChange={e => setCanViewBilling(e.target.checked)} className="accent-[#CBA153]" /> Can view billing
                            </label>
                        </div>
                    </div>

                    <div>
                        <label className={lbl}>How they sign in</label>
                        <div className="flex gap-2">
                            <button type="button" onClick={() => setInviteMode('email')}
                                className={`flex-1 inline-flex items-center justify-center gap-1.5 py-2 text-sm rounded-md border ${inviteMode === 'email' ? 'border-[#CBA153] bg-[#FDFBF7] text-[#2C2A29]' : 'border-[#E8E6E1] text-gray-500'}`}>
                                <Mail className="w-4 h-4" /> Email invite
                            </button>
                            <button type="button" onClick={() => setInviteMode('password')}
                                className={`flex-1 inline-flex items-center justify-center gap-1.5 py-2 text-sm rounded-md border ${inviteMode === 'password' ? 'border-[#CBA153] bg-[#FDFBF7] text-[#2C2A29]' : 'border-[#E8E6E1] text-gray-500'}`}>
                                <KeyRound className="w-4 h-4" /> Set password now
                            </button>
                        </div>
                    </div>
                    {inviteMode === 'password' && (
                        <div><label className={lbl}>Password (share it with them)</label>
                            <input type="text" value={password} onChange={e => setPassword(e.target.value)} placeholder="At least 8 characters" className={input} />
                        </div>
                    )}

                    <div className="flex items-center gap-2">
                        <button onClick={submitInvite} disabled={pending} className="bg-[#CBA153] hover:bg-[#b08d47] text-white px-4 py-2 text-sm font-medium rounded-md transition disabled:opacity-60">
                            {pending ? 'Working…' : inviteMode === 'email' ? 'Send invite' : 'Create login'}
                        </button>
                        <button onClick={() => { setMode('closed'); setError(null); }} className="text-sm text-gray-500 hover:text-[#2C2A29] px-2">Cancel</button>
                    </div>
                </div>
            )}
        </div>
    );
}
