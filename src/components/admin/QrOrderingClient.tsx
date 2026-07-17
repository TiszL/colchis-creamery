'use client';

// QR Table Ordering admin UI: master toggle + per-location table counts +
// print-ready QR grid. Print uses a dedicated print stylesheet scope so only
// the QR cards land on paper.

import { useState } from 'react';
import { QrCode, Printer, Power } from 'lucide-react';

type LocationRow = { id: string; name: string; dineInEnabled: boolean; tables: number };
type QrEntry = { table: number; url: string; svg: string };

export default function QrOrderingClient({
    enabled, locations, qrByLocation, saveAction,
}: {
    enabled: boolean;
    locations: LocationRow[];
    qrByLocation: Record<string, QrEntry[]>;
    saveAction: (formData: FormData) => Promise<void>;
}) {
    const [isEnabled, setIsEnabled] = useState(enabled);
    const anyQrs = Object.values(qrByLocation).some(list => list.length > 0);

    return (
        <div className="p-6 lg:p-10 max-w-5xl">
            <div className="flex items-center gap-3 mb-2">
                <QrCode className="w-6 h-6 text-[#B96A3D]" />
                <h1 className="text-2xl font-bold text-white">QR Table Ordering</h1>
                <span className={`text-[10px] font-mono uppercase tracking-widest px-2 py-1 border ${enabled ? 'border-emerald-700 text-emerald-400 bg-emerald-900/20' : 'border-gray-700 text-gray-500 bg-[#161616]'}`}>
                    {enabled ? 'Live' : 'Off'}
                </span>
            </div>
            <p className="text-sm text-gray-400 mb-8 max-w-2xl">
                Guests scan a table QR, order and pay from their phone, and the ticket lands on the kitchen
                screen with the table number. One switch turns the whole flow on or off instantly —
                the printed QRs show a friendly &ldquo;order at the counter&rdquo; page while it&apos;s off.
            </p>

            <form action={saveAction} className="space-y-8">
                {/* Master toggle */}
                <div className="flex items-center justify-between bg-[#111] border border-[#B96A3D22] px-5 py-4">
                    <div className="flex items-center gap-3">
                        <Power className={`w-5 h-5 ${isEnabled ? 'text-emerald-400' : 'text-gray-600'}`} />
                        <div>
                            <p className="text-sm font-bold text-white">Accept orders from table QRs</p>
                            <p className="text-xs text-gray-500">Master switch — applies to every location at once.</p>
                        </div>
                    </div>
                    <label className="flex items-center gap-3 cursor-pointer">
                        <input type="checkbox" name="enabled" checked={isEnabled} onChange={e => setIsEnabled(e.target.checked)} className="w-5 h-5 accent-[#B96A3D]" />
                        <span className="text-xs font-mono uppercase tracking-wider text-gray-300">{isEnabled ? 'On' : 'Off'}</span>
                    </label>
                </div>

                {/* Per-location table counts */}
                <div className="space-y-3">
                    <h2 className="text-xs font-bold text-[#B96A3D] uppercase tracking-widest">Tables per location</h2>
                    {locations.map(loc => (
                        <div key={loc.id} className={`flex items-center justify-between border px-5 py-3 ${loc.dineInEnabled ? 'bg-[#111] border-[#ffffff0A]' : 'bg-[#0C0C0C] border-[#ffffff05] opacity-60'}`}>
                            <div>
                                <p className="text-sm text-white">{loc.name}</p>
                                {!loc.dineInEnabled && (
                                    <p className="text-[11px] text-amber-400/80 mt-0.5">
                                        Dine-in is disabled for this location — enable the IN_STORE_DINE_IN method in Admin → Locations first.
                                    </p>
                                )}
                            </div>
                            <input
                                type="number" name={`tables-${loc.id}`} min={0} max={200}
                                defaultValue={loc.tables || ''} placeholder="0"
                                disabled={!loc.dineInEnabled}
                                className="w-24 bg-[#161616] border border-[#B96A3D22] text-white py-2 px-3 text-sm font-mono focus:outline-none focus:border-[#B96A3D] disabled:opacity-40"
                            />
                        </div>
                    ))}
                </div>

                <button type="submit" className="bg-[#B96A3D] text-white text-xs font-mono uppercase tracking-widest px-8 py-3 hover:bg-[#a85c32] transition-colors">
                    Save settings
                </button>
            </form>

            {/* Printable QR grid */}
            {anyQrs && (
                <div className="mt-12">
                    <div className="flex items-center justify-between mb-4 print:hidden">
                        <h2 className="text-xs font-bold text-[#B96A3D] uppercase tracking-widest">Printable table QRs</h2>
                        <button type="button" onClick={() => window.print()} className="flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-gray-300 border border-[#ffffff1A] px-4 py-2 hover:text-white transition-colors">
                            <Printer className="w-4 h-4" /> Print all
                        </button>
                    </div>
                    <div id="qr-print-area">
                        {locations.filter(l => (qrByLocation[l.id] ?? []).length > 0).map(loc => (
                            <div key={loc.id} className="mb-8">
                                <p className="text-sm text-gray-400 mb-3 print:text-black">{loc.name}</p>
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                    {qrByLocation[loc.id].map(q => (
                                        <div key={q.table} className="bg-[#F5F0E6] text-[#1F3026] p-5 flex flex-col items-center gap-2 break-inside-avoid">
                                            <div className="text-[10px] font-mono uppercase tracking-[0.3em]">Colchis Cafe &amp; Bakery</div>
                                            <div dangerouslySetInnerHTML={{ __html: q.svg }} />
                                            <div className="font-serif italic text-2xl">Table {q.table}</div>
                                            <div className="text-[9px] font-mono uppercase tracking-widest opacity-60">Scan · order · we bring it over</div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                    <style jsx global>{`
                        @media print {
                            body * { visibility: hidden; }
                            #qr-print-area, #qr-print-area * { visibility: visible; }
                            #qr-print-area { position: absolute; left: 0; top: 0; width: 100%; }
                        }
                    `}</style>
                </div>
            )}
        </div>
    );
}
