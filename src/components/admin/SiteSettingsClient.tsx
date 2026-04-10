'use client';

import { useState } from 'react';
import { Save, ArrowLeft, CheckCircle } from 'lucide-react';
import Link from 'next/link';
import { updateSiteSettings } from '@/app/actions/settings';

export default function SiteSettingsClient({
    locale,
    initialSettings
}: {
    locale: string;
    initialSettings: Record<string, string>;
}) {
    const [settings, setSettings] = useState(initialSettings);
    const [isSaving, setIsSaving] = useState(false);
    const [savedMessage, setSavedMessage] = useState(false);

    const handleChange = (key: string, value: string) => {
        setSettings(prev => ({ ...prev, [key]: value }));
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            const formData = new FormData();
            Object.entries(settings).forEach(([k, v]) => formData.append(k, v));
            await updateSiteSettings(formData);
            
            setSavedMessage(true);
            setTimeout(() => setSavedMessage(false), 3000);
        } catch (error) {
            console.error('Failed to save settings', error);
        } finally {
            setIsSaving(false);
        }
    };

    const FIELDS = [
        { key: 'contact_email', label: 'Contact Email', type: 'email', placeholder: 'hello@colchiscreamery.com' },
        { key: 'contact_phone', label: 'Contact Phone', type: 'text', placeholder: '+1 234 567 8900' },
        { key: 'contact_address', label: 'Office Address', type: 'text', placeholder: '123 Cheese Ave, NY' },
        { key: 'social_instagram', label: 'Instagram URL', type: 'url', placeholder: 'https://instagram.com/...' },
        { key: 'social_facebook', label: 'Facebook URL', type: 'url', placeholder: 'https://facebook.com/...' },
    ];

    return (
        <div className="space-y-8 max-w-4xl">
            <div className="flex items-start justify-between">
                <div>
                    <Link href={`/${locale}/admin/website`} className="text-xs text-[#CBA153] hover:text-white transition-colors flex items-center gap-1 mb-3">
                        <ArrowLeft className="w-3 h-3" /> Back to Website Content
                    </Link>
                    <h1 className="text-3xl font-serif text-white mb-2">Global Settings</h1>
                    <p className="text-gray-500 font-light">Manage contact information and social links displayed across the site.</p>
                </div>
                <button
                    onClick={handleSave}
                    disabled={isSaving}
                    className="bg-[#CBA153] text-black font-bold uppercase tracking-widest text-xs py-3 px-6 rounded-lg hover:bg-white transition-all flex items-center gap-2 disabled:opacity-50"
                >
                    <Save size={16} /> {isSaving ? 'Saving...' : 'Save Settings'}
                </button>
            </div>

            {savedMessage && (
                <div className="bg-emerald-900/30 border border-emerald-900/50 text-emerald-400 px-4 py-3 rounded-lg flex items-center gap-2 text-sm animate-fade-in">
                    <CheckCircle className="w-4 h-4" /> Global settings updated successfully.
                </div>
            )}

            <div className="bg-[#1A1A1A] rounded-xl border border-white/5 p-6 md:p-8 space-y-6">
                <h3 className="text-white font-serif text-xl border-b border-white/5 pb-4">Contact Information</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                    {FIELDS.map(f => (
                        <div key={f.key}>
                            <label className="block text-xs font-bold text-gray-400 mb-2 uppercase tracking-wider">{f.label}</label>
                            <input
                                type={f.type}
                                value={settings[f.key] || ''}
                                onChange={(e) => handleChange(f.key, e.target.value)}
                                placeholder={f.placeholder}
                                className="w-full bg-[#0D0D0D] border border-white/10 text-white py-3 px-4 rounded-lg focus:outline-none focus:border-[#CBA153] transition-colors"
                            />
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
