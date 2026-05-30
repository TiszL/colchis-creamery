'use client';

import { useState, useTransition } from 'react';
import { updatePartnerProfileAction, submitResaleCertAction } from '@/app/actions/b2b-account';
import { Building2, FileCheck, CreditCard, ShieldCheck } from 'lucide-react';

interface Props {
    profile: {
        companyName: string;
        businessAddress: string | null;
        ein: string | null;
        phone: string | null;
        defaultFulfillmentLocationId: string | null;
        taxExempt: boolean;
        resaleCertificateNumber: string | null;
        resaleCertificateState: string | null;
        resaleCertificateExpiresAt: string | null; // yyyy-mm-dd
        resaleCertificateUrl: string | null;
        creditLimitCents: number | null;
        creditApproved: boolean;
    };
    locations: { id: string; name: string }[];
    paymentMethods: { id: string; label: string }[];
}

const input = "w-full bg-white border border-[#E8E6E1] text-[#2C2A29] py-2 px-3 text-sm rounded-md focus:outline-none focus:border-[#CBA153]";
const labelCls = "block text-[10px] font-bold text-gray-500 mb-1 uppercase tracking-wider";

export default function B2BAccountClient({ profile, locations, paymentMethods }: Props) {
    const [profileMsg, setProfileMsg] = useState<{ ok: boolean; text: string } | null>(null);
    const [certMsg, setCertMsg] = useState<{ ok: boolean; text: string } | null>(null);
    const [savingProfile, startProfile] = useTransition();
    const [savingCert, startCert] = useTransition();

    const onProfile = (fd: FormData) => startProfile(async () => {
        const r = await updatePartnerProfileAction(fd);
        setProfileMsg(r.ok ? { ok: true, text: 'Saved.' } : { ok: false, text: r.error || 'Failed.' });
    });
    const onCert = (fd: FormData) => startCert(async () => {
        const r = await submitResaleCertAction(fd);
        setCertMsg(r.ok ? { ok: true, text: 'Submitted — staff will review.' } : { ok: false, text: r.error || 'Failed.' });
    });

    return (
        <div className="space-y-6">
            {/* Company profile */}
            <section className="bg-white border border-[#E8E6E1] shadow-sm rounded-xl p-5">
                <h2 className="text-lg font-serif text-[#2C2A29] mb-4 flex items-center gap-2"><Building2 className="w-5 h-5 text-[#CBA153]" /> Company profile</h2>
                <form action={onProfile} className="space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div><label className={labelCls}>Company name *</label><input name="companyName" required defaultValue={profile.companyName} className={input} /></div>
                        <div><label className={labelCls}>Phone</label><input name="phone" defaultValue={profile.phone ?? ''} className={input} /></div>
                        <div className="md:col-span-2"><label className={labelCls}>Business address</label><input name="businessAddress" defaultValue={profile.businessAddress ?? ''} className={input} /></div>
                        <div><label className={labelCls}>EIN / Tax ID</label><input name="ein" defaultValue={profile.ein ?? ''} className={input} /></div>
                        <div><label className={labelCls}>Default ship-from</label>
                            <select name="defaultFulfillmentLocationId" defaultValue={profile.defaultFulfillmentLocationId ?? ''} className={input}>
                                <option value="">— Auto (ops decides) —</option>
                                {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                            </select>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <button type="submit" disabled={savingProfile} className="bg-[#CBA153] hover:bg-[#b08d47] text-white px-4 py-2 text-sm font-medium rounded-md transition disabled:opacity-60">{savingProfile ? 'Saving…' : 'Save profile'}</button>
                        {profileMsg && <span className={`text-xs ${profileMsg.ok ? 'text-emerald-600' : 'text-red-600'}`}>{profileMsg.text}</span>}
                    </div>
                </form>
            </section>

            {/* Resale certificate */}
            <section className="bg-white border border-[#E8E6E1] shadow-sm rounded-xl p-5">
                <h2 className="text-lg font-serif text-[#2C2A29] mb-1 flex items-center gap-2"><FileCheck className="w-5 h-5 text-[#CBA153]" /> Resale certificate</h2>
                <p className="text-xs text-gray-500 mb-3">
                    {profile.taxExempt
                        ? <span className="text-emerald-600 font-medium">✓ Tax-exempt status active.</span>
                        : 'Submit your resale certificate so staff can grant tax-exempt wholesale pricing.'}
                </p>
                <form action={onCert} className="space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div><label className={labelCls}>Certificate #</label><input name="resaleCertificateNumber" defaultValue={profile.resaleCertificateNumber ?? ''} className={input} /></div>
                        <div><label className={labelCls}>State</label><input name="resaleCertificateState" maxLength={2} defaultValue={profile.resaleCertificateState ?? ''} className={`${input} uppercase`} /></div>
                        <div><label className={labelCls}>Expires</label><input type="date" name="resaleCertificateExpiresAt" defaultValue={profile.resaleCertificateExpiresAt ?? ''} className={input} /></div>
                    </div>
                    <div><label className={labelCls}>Document link (PDF/image URL)</label><input name="resaleCertificateUrl" placeholder="https://…" defaultValue={profile.resaleCertificateUrl ?? ''} className={input} /></div>
                    <div className="flex items-center gap-3">
                        <button type="submit" disabled={savingCert} className="bg-[#CBA153] hover:bg-[#b08d47] text-white px-4 py-2 text-sm font-medium rounded-md transition disabled:opacity-60">{savingCert ? 'Submitting…' : 'Submit certificate'}</button>
                        {certMsg && <span className={`text-xs ${certMsg.ok ? 'text-emerald-600' : 'text-red-600'}`}>{certMsg.text}</span>}
                    </div>
                </form>
            </section>

            {/* Credit + payment methods (read-only) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <section className="bg-white border border-[#E8E6E1] shadow-sm rounded-xl p-5">
                    <h2 className="text-lg font-serif text-[#2C2A29] mb-3 flex items-center gap-2"><ShieldCheck className="w-5 h-5 text-[#CBA153]" /> Credit</h2>
                    {profile.creditLimitCents != null ? (
                        <div className="text-sm space-y-1">
                            <div className="flex justify-between"><span className="text-gray-500">Approved limit</span><span className="font-mono text-[#2C2A29]">${(profile.creditLimitCents / 100).toFixed(2)}</span></div>
                            <div className="flex justify-between"><span className="text-gray-500">Status</span><span className={profile.creditApproved ? 'text-emerald-600' : 'text-amber-600'}>{profile.creditApproved ? 'Approved' : 'Pending'}</span></div>
                        </div>
                    ) : <p className="text-sm text-gray-500">No credit line yet — set on your first net-terms order.</p>}
                </section>
                <section className="bg-white border border-[#E8E6E1] shadow-sm rounded-xl p-5">
                    <h2 className="text-lg font-serif text-[#2C2A29] mb-3 flex items-center gap-2"><CreditCard className="w-5 h-5 text-[#CBA153]" /> Saved payment methods</h2>
                    {paymentMethods.length > 0 ? (
                        <ul className="text-sm space-y-1.5">
                            {paymentMethods.map(pm => <li key={pm.id} className="font-mono text-[#2C2A29]">{pm.label}</li>)}
                        </ul>
                    ) : <p className="text-sm text-gray-500">No saved cards/bank accounts. Pay by card once to save one.</p>}
                    <p className="text-[10px] text-gray-400 mt-3">To remove a method, contact sales.</p>
                </section>
            </div>
        </div>
    );
}
