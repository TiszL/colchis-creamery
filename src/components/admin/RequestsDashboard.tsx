'use client';

import { useState, useCallback } from 'react';
import { Building2, Mail, Phone, MapPin, Package, Calendar, MessageSquare, Eye, Loader2, CheckCircle, XCircle, Clock, ChevronDown, X } from 'lucide-react';

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
    CONVERTED: { label: 'Converted', color: 'text-emerald-400', bg: 'bg-emerald-400/10 border-emerald-400/20', icon: CheckCircle },
    REJECTED: { label: 'Rejected', color: 'text-red-400', bg: 'bg-red-400/10 border-red-400/20', icon: XCircle },
};

export default function RequestsDashboard({ leads: initialLeads, locale }: { leads: Lead[]; locale: string }) {
    const [leads, setLeads] = useState<Lead[]>(initialLeads);
    const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
    const [filter, setFilter] = useState<string>('ALL');
    const [updatingId, setUpdatingId] = useState<string | null>(null);

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
        try {
            const res = await fetch('/api/admin/leads', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, status }),
            });
            if (res.ok) {
                setLeads(prev => prev.map(l => l.id === id ? { ...l, status } : l));
                if (selectedLead?.id === id) {
                    setSelectedLead(prev => prev ? { ...prev, status } : null);
                }
            }
        } catch (err) {
            console.error('Update error:', err);
        } finally {
            setUpdatingId(null);
        }
    }, [selectedLead]);

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
                                    {/* Top row */}
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

                                    {/* Bottom row */}
                                    <div className="flex items-center justify-between mt-3 pt-3 border-t border-white/5">
                                        <span className={`text-[11px] sm:text-xs ${sc.bg} ${sc.color} px-2 py-1 rounded-full flex items-center gap-1 border`}>
                                            <StatusIcon className="w-3 h-3" /> {sc.label}
                                        </span>
                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={() => setSelectedLead(lead)}
                                                className="flex items-center gap-1 text-xs text-[#CBA153] hover:text-white transition-colors px-2 py-1.5"
                                            >
                                                <Eye className="w-3 h-3" /> View
                                            </button>
                                        </div>
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

                        {/* Status actions */}
                        <div className="p-6 border-t border-white/5">
                            <span className="text-[10px] text-gray-600 uppercase tracking-wider font-bold block mb-3">Update Status</span>
                            <div className="grid grid-cols-2 gap-2">
                                {Object.entries(STATUS_CONFIG).map(([key, config]) => {
                                    const isActive = selectedLead.status === key;
                                    const Icon = config.icon;
                                    return (
                                        <button
                                            key={key}
                                            onClick={() => updateStatus(selectedLead.id, key)}
                                            disabled={isActive || updatingId === selectedLead.id}
                                            className={`flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all border ${
                                                isActive
                                                    ? `${config.bg} ${config.color} border-2`
                                                    : 'bg-[#0D0D0D] border-white/10 text-gray-500 hover:text-white hover:border-white/20'
                                            } disabled:opacity-50`}
                                        >
                                            {updatingId === selectedLead.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Icon className="w-3 h-3" />}
                                            {config.label}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
