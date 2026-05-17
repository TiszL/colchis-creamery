'use client';

import { useState, useTransition } from 'react';
import { Save, CheckCircle, Plus, Trash2 } from 'lucide-react';
import { batchUpsertSiteConfigAction } from '@/app/actions/cms';

const mono = { fontFamily: 'var(--font-mono)', letterSpacing: '0.24em', textTransform: 'uppercase' as const };
const inputCls = 'w-full bg-[#0C0C0C] border border-[#B96A3D22] text-[#F5F0E6] py-3 px-4 focus:outline-none focus:border-[#B96A3D] transition-colors text-sm';
const labelCls = 'block text-[9px] text-[#D9A876] mb-2';

interface FooterEditorProps {
    initialData: {
        tagline: string;
        address: string;
        columns: { t: string; l: { label: string; href: string }[] }[];
    } | null;
}

const DEFAULTS = {
    tagline: 'Ancient heritage, fresh every day.',
    address: '84 N High St\nDublin, Ohio 43017\nMade by hand, since 2026',
    columns: [
        { t: "The Creamery", l: [{ label: "Sulguni Fresh", href: "/creamery" }, { label: "Sulguni Aged", href: "/creamery" }, { label: "Imeruli", href: "/creamery" }] },
        { t: "The Bakery", l: [{ label: "Hot delivery", href: "/bakery" }, { label: "Pickup", href: "/bakery" }, { label: "Frozen ship", href: "/bakery" }] },
        { t: "Company", l: [{ label: "Heritage", href: "/heritage" }, { label: "Contact", href: "/contact" }, { label: "Careers", href: "/contact" }] },
    ],
};

export default function FooterEditor({ initialData }: FooterEditorProps) {
    const [isPending, startTransition] = useTransition();
    const [saved, setSaved] = useState(false);
    const [data, setData] = useState({
        ...DEFAULTS,
        ...initialData,
        columns: initialData?.columns || DEFAULTS.columns,
    });

    const handleSave = () => {
        startTransition(async () => {
            // Flat-string upserts so the read path (which uses raw c.value) sees the same
            // shape we wrote. Older code wrapped these as `{value:"..."}` via
            // saveContentBlock — that mismatch caused JSON-wrapped strings to render in the
            // address textarea and on the public footer.
            const entries = [
                { key: 'footer.tagline', value: data.tagline },
                { key: 'footer.address', value: data.address },
                { key: 'footer.columns', value: JSON.stringify(data.columns) },
            ];
            const fd = new FormData();
            fd.set('entries', JSON.stringify(entries));
            await batchUpsertSiteConfigAction(fd);
            setSaved(true);
            setTimeout(() => setSaved(false), 2500);
        });
    };

    const updateColumn = (colIdx: number, field: string, value: string) => {
        const cols = [...data.columns];
        cols[colIdx] = { ...cols[colIdx], [field]: value };
        setData({ ...data, columns: cols });
    };

    const updateLink = (colIdx: number, linkIdx: number, field: string, value: string) => {
        const cols = [...data.columns];
        const links = [...cols[colIdx].l];
        links[linkIdx] = { ...links[linkIdx], [field]: value };
        cols[colIdx] = { ...cols[colIdx], l: links };
        setData({ ...data, columns: cols });
    };

    const addLink = (colIdx: number) => {
        const cols = [...data.columns];
        cols[colIdx] = { ...cols[colIdx], l: [...cols[colIdx].l, { label: '', href: '/' }] };
        setData({ ...data, columns: cols });
    };

    const removeLink = (colIdx: number, linkIdx: number) => {
        const cols = [...data.columns];
        cols[colIdx] = { ...cols[colIdx], l: cols[colIdx].l.filter((_: any, i: number) => i !== linkIdx) };
        setData({ ...data, columns: cols });
    };

    return (
        <div className="bg-[#161616] border border-[#B96A3D22] overflow-hidden">
            <div className="px-6 py-4 border-b border-[#B96A3D22] flex items-center justify-between">
                <div>
                    <h3 className="text-[#F5F0E6] font-medium" style={{ fontFamily: 'var(--font-serif)' }}>Footer Content</h3>
                    <p className="text-[#5A6158] text-[10px] mt-0.5" style={mono}>Tagline, address, link columns</p>
                </div>
                <button onClick={handleSave} disabled={isPending} className="flex items-center gap-2 bg-[#B96A3D] text-[#F5F0E6] px-4 py-2 text-[10px] hover:bg-[#F5F0E6] hover:text-[#1F3026] transition-all disabled:opacity-50" style={mono}>
                    {saved ? <><CheckCircle className="w-3.5 h-3.5" /> Saved</> : <><Save className="w-3.5 h-3.5" /> Save Footer</>}
                </button>
            </div>
            <div className="p-6 space-y-5">
                <div>
                    <label className={labelCls} style={mono}>Tagline</label>
                    <input value={data.tagline} onChange={e => setData({ ...data, tagline: e.target.value })} className={inputCls} />
                </div>
                <div>
                    <label className={labelCls} style={mono}>Address Block (deprecated)</label>
                    <textarea value={data.address} onChange={e => setData({ ...data, address: e.target.value })} rows={3} className={inputCls + ' resize-none opacity-60'} />
                    <p className="text-[9px] text-[#D9A876] mt-1.5" style={mono}>The public footer now reads from your primary business location. Edit your address at <span className="underline">/admin/locations</span>. This field is kept for legacy data only and no longer affects the site.</p>
                </div>

                {/* Columns */}
                <div>
                    <label className={labelCls} style={mono}>Link Columns</label>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {data.columns.map((col, colIdx) => (
                            <div key={colIdx} className="bg-[#0C0C0C] border border-[#B96A3D22] p-4 space-y-3">
                                <input value={col.t} onChange={e => updateColumn(colIdx, 't', e.target.value)} className={inputCls} placeholder="Column title" />
                                {col.l.map((link, linkIdx) => (
                                    <div key={linkIdx} className="flex gap-2">
                                        <input value={link.label} onChange={e => updateLink(colIdx, linkIdx, 'label', e.target.value)} className={inputCls + ' flex-1'} placeholder="Label" />
                                        <input value={link.href} onChange={e => updateLink(colIdx, linkIdx, 'href', e.target.value)} className={inputCls + ' w-24'} placeholder="/path" />
                                        <button onClick={() => removeLink(colIdx, linkIdx)} className="text-[#A8312C] hover:text-[#F5F0E6] p-1"><Trash2 className="w-3 h-3" /></button>
                                    </div>
                                ))}
                                <button onClick={() => addLink(colIdx)} className="flex items-center gap-1 text-[#B96A3D] text-[9px] hover:text-[#F5F0E6]" style={mono}><Plus className="w-3 h-3" /> Add Link</button>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
