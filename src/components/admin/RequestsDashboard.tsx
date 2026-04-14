'use client';

import { useState, useCallback } from 'react';
import { Building2, Mail, Phone, MapPin, Package, MessageSquare, Eye, Loader2, CheckCircle, XCircle, Clock, X, ShieldCheck, KeyRound, Copy } from 'lucide-react';

interface Lead {
    id: string;
    companyName: string;
    contactName: string | null;
    email: string;
    phone: string | null;
    address: string | null;
    expectedVolume: string | null;
    message: string | null;
    status: string;
    assignedTo: string | null;
    createdAt: string;
    updatedAt: string;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: any }> = {
    NEW: { label: 'New', color: 'text-blue-400', bg: 'bg-blue-400/10 border-blue-400/20', icon: Clock },
    CONTACTED: { label: 'Contacted', color: 'text-[#CBA153]', bg: 'bg-[#CBA153]/10 border-[#CBA153]/20', icon: Mail },
    CONVERTED: { label: 'Approved', color: 'text-emerald-400', bg: 'bg-emerald-400/10 border-emerald-400/20', icon: CheckCircle },
    REJECTED: { label: 'Rejected', color: 'text-red-400', bg: 'bg-red-400/10 border-red-400/20', icon: XCircle },
};

export default function RequestsDashboard({ leads: initialLeads, locale }: { leads: Lead[]; locale: string }) {
    const [leads, setLeads] = useState<Lead[]>(initialLeads);
    const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
    const [filter, setFilter] = useState<string>('ALL');
    const [updatingId, setUpdatingId] = useState<string | null>(null);
    const [generatedCode, setGeneratedCode] = useState<string | null>(null);
    const [actionMessage, setActionMessage] = useState<string | null>(null);
    const [copiedCode, setCopiedCode] = useState(false);

    const filteredLeads = filter === 'ALL'
        ? leads
        : leads.filter(l => l.status === filter);

    const counts = {
        ALL: leads.length,
        NEW: leads.filter(l => l.status === 'NEW').length,
        CONTACTED: leads.filter(l => l.status === 'CONTACTED').length,
        CONVERTED: leads.filter(l => l.status === 'CONVERTED').length,
        REJECTED: leads.filter(l => l.status === 'REJECTED').length,
    };

    const updateStatus = useCallback(async (id: string, status: string) => {
        setUpdatingId(id);
        setGeneratedCode(null);
        setActionMessage(null);
        try {
            const res = await fetch('/api/admin/leads', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, status }),
            });
            const data = await res.json();
            if (res.ok && data.success) {
                setLeads(prev => prev.map(l => l.id === id ? { ...l, status } : l));
                if (selectedLead?.id === id) {
                    setSelectedLead(prev => prev ? { ...prev, status } : null);
                }
                if (status === 'CONVERTED' && data.accessCode) {
                    setGeneratedCode(data.accessCode);
                    setActionMessage(data.emailSent ? '✅ Approval email sent with access code' : '⚠️ Code generated but email failed to send');
                }
                if (status === 'REJECTED') {
                    setActionMessage(data.emailSent ? '✅ Rejection notification sent' : '⚠️ Status updated but email failed to send');
                }
            }
        } catch (err) {
            console.error('Update error:', err);
            setActionMessage('❌ Failed to update status');
        } finally {
            setUpdatingId(null);
        }
    }, [selectedLead]);

    const copyCode = () => {
        if (generatedCode) {
            navigator.clipboard.writeText(generatedCode);
            setCopiedCode(true);
            setTimeout(() => setCopiedCode(false), 2000);
        }
    };

    return (
        <div className="space-y-6">
            {/* Stats bar */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                {(['ALL', 'NEW', 'CONTACTED', 'CONVERTED', 'REJECTED'] as const).map((key) => {
                    const isActive = filter === key;
                    const config = key === 'ALL'
                        ? { label: 'All', color: 'text-white', bg: 'bg-white/5 border-white/10' }
                        : STATUS_CONFIG[key];
                    return (
                        <button
                            key={key}
                            onClick={() => setFilter(key)}
                            className={`p-3 rounded-xl border text-center transition-all ${
                                isActive
                                    ? `${config.bg} border-2 ring-1 ring-white/10`
                                    : 'bg-[#1A1A1A] border-white/5 hover:border-white/10'
                            }`}
                        >
                            <span className={`text-2xl font-bold block ${isActive ? config.color : 'text-gray-400'}`}>
                                {counts[key]}
                            </span>
                            <span className="text-[10px] uppercase tracking-wider text-gray-500 font-bold">{config.label}</span>
                        </button>
                    );
                })}
            </div>

            {/* Lead list */}
            {filteredLeads.length === 0 ? (
                <div className="bg-[#1A1A1A] rounded-xl border border-white/5 p-12 text-center text-gray-500">
                    {filter === 'ALL' ? 'No partnership requests yet.' : `No ${STATUS_CONFIG[filter]?.label.toLowerCase()} requests.`}
                </div>
            ) : (
                <div className="space-y-2">
                    {filteredLeads.map((lead) => {
                        const sc = STATUS_CONFIG[lead.status] || STATUS_CONFIG.NEW;
                        const StatusIcon = sc.icon;
                        return (
                            <div
                                key={lead.id}
                                className="bg-[#1A1A1A] rounded-xl border border-white/5 hover:border-[#CBA153]/20 transition-all overflow-hidden"
                            >
                                <div className="p-3 sm:p-4">
                                    <div className="flex items-start gap-3">
                                        <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-lg bg-[#0D0D0D] border border-white/10 flex items-center justify-center flex-shrink-0">
                                            <Building2 className="w-5 h-5 text-[#CBA153]/60" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <h3 className="text-white font-bold text-sm sm:text-base truncate">{lead.companyName}</h3>
                                            <div className="flex items-center gap-2 text-[11px] sm:text-xs text-gray-500 mt-0.5">
                                                {lead.contactName && <span>{lead.contactName}</span>}
                                                {lead.contactName && <span>·</span>}
                                                <span>{new Date(lead.createdAt).toLocaleDateString()}</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex items-center justify-between mt-3 pt-3 border-t border-white/5">
                                        <span className={`text-[11px] sm:text-xs ${sc.bg} ${sc.color} px-2 py-1 rounded-full flex items-center gap-1 border`}>
                                            <StatusIcon className="w-3 h-3" /> {sc.label}
                                        </span>
                                        <button
                                            onClick={() => { setSelectedLead(lead); setGeneratedCode(null); setActionMessage(null); }}
                                            className="flex items-center gap-1 text-xs text-[#CBA153] hover:text-white transition-colors px-2 py-1.5"
                                        >
                                            <Eye className="w-3 h-3" /> View
                                        </button>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Detail modal */}
            {selectedLead && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/70" onClick={() => setSelectedLead(null)} />
                    <div className="relative bg-[#1A1A1A] rounded-2xl border border-white/10 w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl">
                        {/* Header */}
                        <div className="p-6 border-b border-white/5 flex items-center justify-between">
                            <div>
                                <h2 className="text-xl font-serif text-white">{selectedLead.companyName}</h2>
                                <p className="text-xs text-gray-500 mt-1">
                                    Submitted {new Date(selectedLead.createdAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                </p>
                            </div>
                            <button onClick={() => setSelectedLead(null)} className="text-gray-600 hover:text-white transition-colors p-1">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Body */}
                        <div className="p-6 space-y-5">
                            <div className="grid grid-cols-1 gap-4">
                                {selectedLead.contactName && (
                                    <div className="flex items-start gap-3">
                                        <Building2 className="w-4 h-4 text-[#CBA153] mt-0.5 flex-shrink-0" />
                                        <div>
                                            <span className="text-[10px] text-gray-600 uppercase tracking-wider font-bold block">Contact</span>
                                            <span className="text-white text-sm">{selectedLead.contactName}</span>
                                        </div>
                                    </div>
                                )}
                                <div className="flex items-start gap-3">
                                    <Mail className="w-4 h-4 text-[#CBA153] mt-0.5 flex-shrink-0" />
                                    <div>
                                        <span className="text-[10px] text-gray-600 uppercase tracking-wider font-bold block">Email</span>
                                        <a href={`mailto:${selectedLead.email}`} className="text-[#CBA153] text-sm hover:underline">{selectedLead.email}</a>
                                    </div>
                                </div>
                                {selectedLead.phone && (
                                    <div className="flex items-start gap-3">
                                        <Phone className="w-4 h-4 text-[#CBA153] mt-0.5 flex-shrink-0" />
                                        <div>
                                            <span className="text-[10px] text-gray-600 uppercase tracking-wider font-bold block">Phone</span>
                                            <a href={`tel:${selectedLead.phone}`} className="text-white text-sm">{selectedLead.phone}</a>
                                        </div>
                                    </div>
                                )}
                                {selectedLead.address && (
                                    <div className="flex items-start gap-3">
                                        <MapPin className="w-4 h-4 text-[#CBA153] mt-0.5 flex-shrink-0" />
                                        <div>
                                            <span className="text-[10px] text-gray-600 uppercase tracking-wider font-bold block">Address</span>
                                            <span className="text-white text-sm">{selectedLead.address}</span>
                                        </div>
                                    </div>
                                )}
                                {selectedLead.expectedVolume && (
                                    <div className="flex items-start gap-3">
                                        <Package className="w-4 h-4 text-[#CBA153] mt-0.5 flex-shrink-0" />
                                        <div>
                                            <span className="text-[10px] text-gray-600 uppercase tracking-wider font-bold block">Est. Volume</span>
                                            <span className="text-white text-sm">{selectedLead.expectedVolume}</span>
                                        </div>
                                    </div>
                                )}
                                {selectedLead.message && (
                                    <div className="flex items-start gap-3">
                                        <MessageSquare className="w-4 h-4 text-[#CBA153] mt-0.5 flex-shrink-0" />
                                        <div>
                                            <span className="text-[10px] text-gray-600 uppercase tracking-wider font-bold block">Message</span>
                                            <span className="text-white text-sm leading-relaxed">{selectedLead.message}</span>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Generated code display */}
                        {generatedCode && (
                            <div className="mx-6 mb-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4">
                                <div className="flex items-center gap-2 mb-2">
                                    <KeyRound className="w-4 h-4 text-emerald-400" />
                                    <span className="text-xs text-emerald-400 font-bold uppercase tracking-wider">Generated Access Code</span>
                                </div>
                                <div className="flex items-center gap-3">
                                    <code className="text-emerald-300 font-mono text-lg tracking-wider flex-1">{generatedCode}</code>
                                    <button
                                        onClick={copyCode}
                                        className="text-emerald-400 hover:text-white transition-colors p-1.5 rounded-lg hover:bg-white/5"
                                    >
                                        {copiedCode ? <CheckCircle className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Action message */}
                        {actionMessage && (
                            <div className="mx-6 mb-4 text-sm text-gray-400 bg-white/5 rounded-lg px-4 py-2.5">
                                {actionMessage}
                            </div>
                        )}

                        {/* Actions */}
                        <div className="p-6 border-t border-white/5">
                            <span className="text-[10px] text-gray-600 uppercase tracking-wider font-bold block mb-3">Actions</span>

                            {selectedLead.status === 'CONVERTED' ? (
                                <div className="flex items-center gap-2 text-emerald-400 bg-emerald-400/10 border border-emerald-400/20 rounded-lg px-4 py-3">
                                    <CheckCircle className="w-4 h-4" />
                                    <span className="text-sm font-medium">Application Approved — Access code sent</span>
                                </div>
                            ) : selectedLead.status === 'REJECTED' ? (
                                <div className="flex items-center gap-2 text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg px-4 py-3">
                                    <XCircle className="w-4 h-4" />
                                    <span className="text-sm font-medium">Application Rejected — Notification sent</span>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {selectedLead.status === 'NEW' && (
                                        <button
                                            onClick={() => updateStatus(selectedLead.id, 'CONTACTED')}
                                            disabled={!!updatingId}
                                            className="w-full flex items-center justify-center gap-2 py-2.5 bg-[#CBA153]/10 text-[#CBA153] border border-[#CBA153]/20 rounded-lg text-xs font-bold uppercase tracking-wider hover:bg-[#CBA153]/20 transition-colors disabled:opacity-50"
                                        >
                                            <Mail className="w-3.5 h-3.5" /> Mark as Contacted
                                        </button>
                                    )}

                                    <div className="grid grid-cols-2 gap-2">
                                        <button
                                            onClick={() => updateStatus(selectedLead.id, 'CONVERTED')}
                                            disabled={!!updatingId}
                                            className="flex items-center justify-center gap-2 py-3 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-lg text-xs font-bold uppercase tracking-wider hover:bg-emerald-500/20 transition-colors disabled:opacity-50"
                                        >
                                            {updatingId === selectedLead.id ? (
                                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                            ) : (
                                                <ShieldCheck className="w-3.5 h-3.5" />
                                            )}
                                            Approve & Send Code
                                        </button>
                                        <button
                                            onClick={() => updateStatus(selectedLead.id, 'REJECTED')}
                                            disabled={!!updatingId}
                                            className="flex items-center justify-center gap-2 py-3 bg-red-500/10 text-red-400 border border-red-500/20 rounded-lg text-xs font-bold uppercase tracking-wider hover:bg-red-500/20 transition-colors disabled:opacity-50"
                                        >
                                            {updatingId === selectedLead.id ? (
                                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                            ) : (
                                                <XCircle className="w-3.5 h-3.5" />
                                            )}
                                            Reject & Notify
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
