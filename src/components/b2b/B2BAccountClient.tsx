'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
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
    const t = useTranslations('b2bPortal.accountForm');
    const [profileMsg, setProfileMsg] = useState<{ ok: boolean; text: string } | null>(null);
    const [certMsg, setCertMsg] = useState<{ ok: boolean; text: string } | null>(null);
    const [savingProfile, startProfile] = useTransition();
    const [savingCert, startCert] = useTransition();

    const onProfile = (fd: FormData) => startProfile(async () => {
        const r = await updatePartnerProfileAction(fd);
        setProfileMsg(r.ok ? { ok: true, text: t('saved') } : { ok: false, text: r.error || t('failed') });
    });
    const onCert = (fd: FormData) => startCert(async () => {
        const r = await submitResaleCertAction(fd);
        setCertMsg(r.ok ? { ok: true, text: t('certSubmitted') } : { ok: false, text: r.error || t('failed') });
    });

    return (
        <div className="space-y-6">
            {/* Company profile */}
            <section className="bg-white border border-[#E8E6E1] shadow-sm rounded-xl p-5">
                <h2 className="text-lg font-serif text-[#2C2A29] mb-4 flex items-center gap-2"><Building2 className="w-5 h-5 text-[#CBA153]" /> {t('companyProfile')}</h2>
                <form action={onProfile} className="space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div><label className={labelCls}>{t('companyName')}</label><input name="companyName" required defaultValue={profile.companyName} className={input} /></div>
                        <div><label className={labelCls}>{t('phone')}</label><input name="phone" defaultValue={profile.phone ?? ''} className={input} /></div>
                        <div className="md:col-span-2"><label className={labelCls}>{t('businessAddress')}</label><input name="businessAddress" defaultValue={profile.businessAddress ?? ''} className={input} /></div>
                        <div><label className={labelCls}>{t('einTaxId')}</label><input name="ein" defaultValue={profile.ein ?? ''} className={input} /></div>
                        <div><label className={labelCls}>{t('defaultShipFrom')}</label>
                            <select name="defaultFulfillmentLocationId" defaultValue={profile.defaultFulfillmentLocationId ?? ''} className={input}>
                                <option value="">{t('autoOpsDecides')}</option>
                                {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                            </select>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <button type="submit" disabled={savingProfile} className="bg-[#CBA153] hover:bg-[#b08d47] text-white px-4 py-2 text-sm font-medium rounded-md transition disabled:opacity-60">{savingProfile ? t('saving') : t('saveProfile')}</button>
                        {profileMsg && <span className={`text-xs ${profileMsg.ok ? 'text-emerald-600' : 'text-red-600'}`}>{profileMsg.text}</span>}
                    </div>
                </form>
            </section>

            {/* Resale certificate */}
            <section className="bg-white border border-[#E8E6E1] shadow-sm rounded-xl p-5">
                <h2 className="text-lg font-serif text-[#2C2A29] mb-1 flex items-center gap-2"><FileCheck className="w-5 h-5 text-[#CBA153]" /> {t('resaleCertificate')}</h2>
                <p className="text-xs text-gray-500 mb-3">
                    {profile.taxExempt
                        ? <span className="text-emerald-600 font-medium">{t('taxExemptActive')}</span>
                        : t('resaleCertPrompt')}
                </p>
                <form action={onCert} className="space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div><label className={labelCls}>{t('certificateNumber')}</label><input name="resaleCertificateNumber" defaultValue={profile.resaleCertificateNumber ?? ''} className={input} /></div>
                        <div><label className={labelCls}>{t('state')}</label><input name="resaleCertificateState" maxLength={2} defaultValue={profile.resaleCertificateState ?? ''} className={`${input} uppercase`} /></div>
                        <div><label className={labelCls}>{t('expires')}</label><input type="date" name="resaleCertificateExpiresAt" defaultValue={profile.resaleCertificateExpiresAt ?? ''} className={input} /></div>
                    </div>
                    <div><label className={labelCls}>{t('documentLink')}</label><input name="resaleCertificateUrl" placeholder="https://…" defaultValue={profile.resaleCertificateUrl ?? ''} className={input} /></div>
                    <div className="flex items-center gap-3">
                        <button type="submit" disabled={savingCert} className="bg-[#CBA153] hover:bg-[#b08d47] text-white px-4 py-2 text-sm font-medium rounded-md transition disabled:opacity-60">{savingCert ? t('submitting') : t('submitCertificate')}</button>
                        {certMsg && <span className={`text-xs ${certMsg.ok ? 'text-emerald-600' : 'text-red-600'}`}>{certMsg.text}</span>}
                    </div>
                </form>
            </section>

            {/* Credit + payment methods (read-only) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <section className="bg-white border border-[#E8E6E1] shadow-sm rounded-xl p-5">
                    <h2 className="text-lg font-serif text-[#2C2A29] mb-3 flex items-center gap-2"><ShieldCheck className="w-5 h-5 text-[#CBA153]" /> {t('credit')}</h2>
                    {profile.creditLimitCents != null ? (
                        <div className="text-sm space-y-1">
                            <div className="flex justify-between"><span className="text-gray-500">{t('approvedLimit')}</span><span className="font-mono text-[#2C2A29]">${(profile.creditLimitCents / 100).toFixed(2)}</span></div>
                            <div className="flex justify-between"><span className="text-gray-500">{t('status')}</span><span className={profile.creditApproved ? 'text-emerald-600' : 'text-amber-600'}>{profile.creditApproved ? t('approved') : t('pending')}</span></div>
                        </div>
                    ) : <p className="text-sm text-gray-500">{t('noCreditLine')}</p>}
                </section>
                <section className="bg-white border border-[#E8E6E1] shadow-sm rounded-xl p-5">
                    <h2 className="text-lg font-serif text-[#2C2A29] mb-3 flex items-center gap-2"><CreditCard className="w-5 h-5 text-[#CBA153]" /> {t('savedPaymentMethods')}</h2>
                    {paymentMethods.length > 0 ? (
                        <ul className="text-sm space-y-1.5">
                            {paymentMethods.map(pm => <li key={pm.id} className="font-mono text-[#2C2A29]">{pm.label}</li>)}
                        </ul>
                    ) : <p className="text-sm text-gray-500">{t('noSavedMethods')}</p>}
                    <p className="text-[10px] text-gray-400 mt-3">{t('removeMethodHelp')}</p>
                </section>
            </div>
        </div>
    );
}
