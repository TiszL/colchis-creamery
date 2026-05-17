'use client';

import { useState } from 'react';
import { Save, ArrowLeft, CheckCircle, AlertTriangle } from 'lucide-react';
import Link from 'next/link';
import { updateSiteSettings } from '@/app/actions/settings';
import { DEFAULT_TESTING_MODE, TESTING_MODE_STORAGE_KEY, type TestingModeConfig } from '@/lib/site-config';

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

    // Parse the testing-mode JSON out of the generic key/value store.
    // Falls back to defaults so the editor always renders even on first run.
    const initialTesting: TestingModeConfig = (() => {
        try {
            const raw = initialSettings[TESTING_MODE_STORAGE_KEY];
            if (!raw) return DEFAULT_TESTING_MODE;
            return { ...DEFAULT_TESTING_MODE, ...JSON.parse(raw) };
        } catch {
            return DEFAULT_TESTING_MODE;
        }
    })();
    const [testing, setTesting] = useState<TestingModeConfig>(initialTesting);

    const handleChange = (key: string, value: string) => {
        setSettings(prev => ({ ...prev, [key]: value }));
    };

    const handleTestingChange = <K extends keyof TestingModeConfig>(key: K, value: TestingModeConfig[K]) => {
        setTesting(prev => ({ ...prev, [key]: value }));
    };

    const bumpVersion = () => {
        setTesting(prev => ({ ...prev, version: prev.version + 1 }));
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            const formData = new FormData();
            Object.entries(settings).forEach(([k, v]) => formData.append(k, v));
            // Stringify the composite testing-mode object into the same flat store.
            formData.append(TESTING_MODE_STORAGE_KEY, JSON.stringify(testing));
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
        { key: 'contact_email', label: 'Contact Email', type: 'email', placeholder: 'hello@colchisfood.com' },
        { key: 'contact_phone', label: 'Contact Phone', type: 'text', placeholder: '+1 234 567 8900' },
        { key: 'contact_address', label: 'Office Address', type: 'text', placeholder: '123 Cheese Ave, NY' },
        { key: 'social_instagram', label: 'Instagram URL', type: 'url', placeholder: 'https://instagram.com/...' },
        { key: 'social_facebook', label: 'Facebook URL', type: 'url', placeholder: 'https://facebook.com/...' },
        // Phase E1.9 — additional socials feed JsonLdOrganization.sameAs for entity-recognition by Google + AI tools.
        { key: 'social_twitter',  label: 'X / Twitter URL', type: 'url', placeholder: 'https://x.com/...' },
        { key: 'social_tiktok',   label: 'TikTok URL',      type: 'url', placeholder: 'https://tiktok.com/@...' },
        { key: 'social_linkedin', label: 'LinkedIn URL',    type: 'url', placeholder: 'https://linkedin.com/company/...' },
        { key: 'social_youtube',  label: 'YouTube URL',     type: 'url', placeholder: 'https://youtube.com/@...' },
    ];

    return (
        <div className="space-y-8 max-w-4xl">
            <div className="flex items-start justify-between">
                <div>
                    <Link href={`/${locale}/admin/website`} className="text-xs text-[#B96A3D] hover:text-white transition-colors flex items-center gap-1 mb-3">
                        <ArrowLeft className="w-3 h-3" /> Back to Website Content
                    </Link>
                    <h1 className="text-3xl font-serif text-white mb-2">Global Settings</h1>
                    <p className="text-gray-500 font-light">Manage contact information and social links displayed across the site.</p>
                </div>
                <button
                    onClick={handleSave}
                    disabled={isSaving}
                    className="bg-[#B96A3D] text-black font-bold uppercase tracking-widest text-xs py-3 px-6 hover:bg-white transition-all flex items-center gap-2 disabled:opacity-50"
                >
                    <Save size={16} /> {isSaving ? 'Saving...' : 'Save Settings'}
                </button>
            </div>

            {savedMessage && (
                <div className="bg-emerald-900/30 border border-emerald-900/50 text-emerald-400 px-4 py-3 flex items-center gap-2 text-sm animate-fade-in">
                    <CheckCircle className="w-4 h-4" /> Global settings updated successfully.
                </div>
            )}

            <div className="bg-[#161616] border border-[#ffffff0A] p-6 md:p-8 space-y-6">
                <h3 className="text-white font-serif text-xl border-b border-[#ffffff0A] pb-4">Contact Information</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                    {FIELDS.map(f => (
                        <div key={f.key}>
                            <label className="block text-xs font-bold text-gray-400 mb-2 uppercase tracking-wider">{f.label}</label>
                            <input
                                type={f.type}
                                value={settings[f.key] || ''}
                                onChange={(e) => handleChange(f.key, e.target.value)}
                                placeholder={f.placeholder}
                                className="w-full bg-[#0C0C0C] border border-[#B96A3D22] text-white py-3 px-4 focus:outline-none focus:border-[#B96A3D] transition-colors"
                            />
                        </div>
                    ))}
                </div>
            </div>

            {/* Phase E1.3 — Pre-launch testing-mode editor */}
            <div className="bg-[#161616] border border-[#ffffff0A] p-6 md:p-8 space-y-6">
                <div className="flex items-start justify-between gap-4 border-b border-[#ffffff0A] pb-4">
                    <div>
                        <h3 className="text-white font-serif text-xl flex items-center gap-2">
                            <AlertTriangle className="w-4 h-4 text-[#B96A3D]" />
                            Pre-launch testing notice
                        </h3>
                        <p className="text-gray-500 text-sm mt-1">
                            Master switch + banner content for the public site. Turn this OFF when you open for real orders.
                        </p>
                    </div>
                    <label className="flex items-center gap-3 cursor-pointer flex-shrink-0">
                        <input
                            type="checkbox"
                            checked={testing.enabled}
                            onChange={(e) => handleTestingChange('enabled', e.target.checked)}
                            className="w-5 h-5 accent-[#B96A3D] cursor-pointer"
                        />
                        <span className="text-xs font-bold uppercase tracking-widest text-white">
                            {testing.enabled ? 'Enabled' : 'Disabled'}
                        </span>
                    </label>
                </div>

                <div className={testing.enabled ? '' : 'opacity-50 pointer-events-none'}>
                    <div className="grid grid-cols-1 gap-6">
                        <div>
                            <label className="block text-xs font-bold text-gray-400 mb-2 uppercase tracking-wider">Strip text (always-visible top bar)</label>
                            <input
                                type="text"
                                value={testing.stripText}
                                onChange={(e) => handleTestingChange('stripText', e.target.value)}
                                placeholder="Testing in progress — orders are not real sales"
                                maxLength={140}
                                className="w-full bg-[#0C0C0C] border border-[#B96A3D22] text-white py-3 px-4 focus:outline-none focus:border-[#B96A3D] transition-colors"
                            />
                            <div className="text-xs text-gray-600 mt-1">{testing.stripText.length}/140 chars</div>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-gray-400 mb-2 uppercase tracking-wider">First-visit modal title</label>
                            <input
                                type="text"
                                value={testing.modalTitle}
                                onChange={(e) => handleTestingChange('modalTitle', e.target.value)}
                                placeholder="Welcome — site is in testing"
                                className="w-full bg-[#0C0C0C] border border-[#B96A3D22] text-white py-3 px-4 focus:outline-none focus:border-[#B96A3D] transition-colors"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-gray-400 mb-2 uppercase tracking-wider">
                                First-visit modal body (Markdown — **bold**, *italic*, [links](url), blank line for paragraphs)
                            </label>
                            <textarea
                                value={testing.modalBody}
                                onChange={(e) => handleTestingChange('modalBody', e.target.value)}
                                rows={8}
                                className="w-full bg-[#0C0C0C] border border-[#B96A3D22] text-white py-3 px-4 focus:outline-none focus:border-[#B96A3D] transition-colors font-mono text-sm leading-relaxed"
                            />
                        </div>

                        <div className="flex items-center gap-3">
                            <input
                                id="show-modal-first-visit"
                                type="checkbox"
                                checked={testing.showModalOnFirstVisit}
                                onChange={(e) => handleTestingChange('showModalOnFirstVisit', e.target.checked)}
                                className="w-4 h-4 accent-[#B96A3D] cursor-pointer"
                            />
                            <label htmlFor="show-modal-first-visit" className="text-sm text-gray-400 cursor-pointer">
                                Show modal on first visit (uncheck → only the top strip)
                            </label>
                        </div>

                        <div className="flex items-center justify-between bg-[#0C0C0C] border border-[#ffffff0A] p-4">
                            <div className="text-sm text-gray-400">
                                <div className="text-white font-bold">Version {testing.version}</div>
                                <div className="text-xs">Bump to re-show the modal to all visitors who already acknowledged it.</div>
                            </div>
                            <button
                                type="button"
                                onClick={bumpVersion}
                                className="bg-transparent border border-[#B96A3D] text-[#B96A3D] uppercase tracking-widest text-xs py-2 px-4 hover:bg-[#B96A3D] hover:text-black transition-all"
                            >
                                Force re-show
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
