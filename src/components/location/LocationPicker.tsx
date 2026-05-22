"use client";

import { useState, useRef, useEffect } from "react";
import { MapPin, ChevronDown, Check, Truck } from "lucide-react";
import { useLocation, type LocationOption } from "@/providers/LocationProvider";
import { useCart } from "@/providers/CartProvider";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

/**
 * Phase 1 (1e) — Sticky location picker rendered in the site header.
 *
 * Shows the currently-selected location ("Ordering from Dublin Bakery") with
 * a dropdown to switch. Bakeries first, then ship-to-home option (cold
 * warehouse) at the bottom — matching the rule that NATIONAL_SHIP is a
 * fallback when no local bakery serves the address.
 *
 * Distance-sorted hint comes in 1f when we wire the address context in.
 */
export function LocationPicker() {
    const { locations, selectedLocation, setSelectedLocationId } = useLocation();
    const { itemCount, clearCart } = useCart();
    const [open, setOpen] = useState(false);
    // Pending switch: location waiting on confirm-clear because cart is non-empty.
    const [pendingSwitch, setPendingSwitch] = useState<LocationOption | null>(null);
    const ref = useRef<HTMLDivElement>(null);

    // Close on outside click
    useEffect(() => {
        if (!open) return;
        const handler = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
        };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, [open]);

    const bakeries = locations.filter(l => l.type === "BAKERY");
    const warehouses = locations.filter(l => l.type === "D2C_COLD_WAREHOUSE");

    const pick = (loc: LocationOption) => {
        // Same location → just close.
        if (loc.id === selectedLocation?.id) {
            setOpen(false);
            return;
        }
        // Phase 1 (1g) — single-location-per-cart invariant. Switching with a
        // non-empty cart asks first; on confirm we clear + switch.
        if (itemCount > 0) {
            setPendingSwitch(loc);
            setOpen(false);
            return;
        }
        setSelectedLocationId(loc.id);
        setOpen(false);
    };

    const confirmSwitch = () => {
        if (!pendingSwitch) return;
        clearCart();
        setSelectedLocationId(pendingSwitch.id);
        setPendingSwitch(null);
    };

    const label = selectedLocation
        ? selectedLocation.name
        : "Choose a location";

    // Trim long bakery names on mobile: show first segment before " — " or " · "
    // ("Bakery — Dublin OH" → "Bakery") so the chip fits next to seal + cart.
    const shortLabel = label.split(/\s[—·]\s/)[0];

    return (
        <div ref={ref} className="relative">
            <button
                type="button"
                onClick={() => setOpen(o => !o)}
                className="flex items-center gap-1.5 sm:gap-2 px-2 py-1 sm:px-3 sm:py-1.5 text-[11px] sm:text-xs font-medium text-ink bg-cream border border-ink/10 rounded-full hover:border-ink/30 transition-colors min-w-0 max-w-[160px] sm:max-w-none"
                aria-haspopup="listbox"
                aria-expanded={open}
            >
                <MapPin className="w-3.5 h-3.5 text-[#B96A3D] shrink-0" />
                <span className="hidden sm:inline">Ordering from</span>
                <span className="font-semibold truncate">
                    <span className="sm:hidden">{shortLabel}</span>
                    <span className="hidden sm:inline max-w-[160px]">{label}</span>
                </span>
                <ChevronDown className={`w-3.5 h-3.5 shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
            </button>

            {open && (
                /* Dropdown — caps to viewport width on small screens with side gutters */
                <div className="absolute right-0 mt-2 w-[min(320px,calc(100vw-32px))] bg-cream border border-ink/15 rounded-lg shadow-xl z-50 overflow-hidden">
                    <div className="px-4 py-3 border-b border-ink/10">
                        <p className="text-[11px] font-bold text-ink/60 uppercase tracking-wider">Pick a bakery</p>
                        <p className="text-[10px] text-ink/40 mt-0.5">Catalog + delivery options scope to your choice.</p>
                    </div>

                    <ul role="listbox" className="max-h-[300px] overflow-y-auto">
                        {bakeries.length === 0 && (
                            <li className="px-4 py-3 text-xs text-ink/40 italic">No bakeries available</li>
                        )}
                        {bakeries.map(loc => {
                            const active = selectedLocation?.id === loc.id;
                            return (
                                <li key={loc.id}>
                                    <button
                                        type="button"
                                        onClick={() => pick(loc)}
                                        className={`w-full text-left px-4 py-2.5 hover:bg-ink/5 transition-colors ${active ? "bg-ink/5" : ""}`}
                                    >
                                        <div className="flex items-start gap-2">
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-semibold text-ink truncate">{loc.name}</p>
                                                <p className="text-[11px] text-ink/50 truncate">{loc.city}, {loc.state}</p>
                                                {loc.displayDescription && (
                                                    <p className="text-[10px] text-ink/40 mt-1 line-clamp-1">{loc.displayDescription}</p>
                                                )}
                                            </div>
                                            {active && <Check className="w-4 h-4 text-[#B96A3D] mt-0.5 shrink-0" />}
                                        </div>
                                    </button>
                                </li>
                            );
                        })}
                    </ul>

                    {warehouses.length > 0 && (
                        <div className="border-t border-ink/10 bg-ink/[0.02]">
                            <div className="px-4 py-2">
                                <p className="text-[10px] font-bold text-ink/50 uppercase tracking-wider">Shop nationwide</p>
                            </div>
                            <ul role="listbox">
                                {warehouses.map(loc => {
                                    const active = selectedLocation?.id === loc.id;
                                    return (
                                        <li key={loc.id}>
                                            <button
                                                type="button"
                                                onClick={() => pick(loc)}
                                                className={`w-full text-left px-4 py-2.5 hover:bg-ink/5 transition-colors ${active ? "bg-ink/5" : ""}`}
                                            >
                                                <div className="flex items-start gap-2">
                                                    <Truck className="w-3.5 h-3.5 text-ink/60 mt-1 shrink-0" />
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-sm font-semibold text-ink">Ship to home</p>
                                                        <p className="text-[11px] text-ink/50">2-day cold-chain · nationwide</p>
                                                    </div>
                                                    {active && <Check className="w-4 h-4 text-[#B96A3D] mt-0.5 shrink-0" />}
                                                </div>
                                            </button>
                                        </li>
                                    );
                                })}
                            </ul>
                        </div>
                    )}
                </div>
            )}

            <ConfirmDialog
                open={pendingSwitch !== null}
                variant="light"
                tone="normal"
                title="Switch location?"
                body={pendingSwitch ? (
                    <>Your cart has items from <strong>{selectedLocation?.name ?? "your current location"}</strong>. Switching to <strong>{pendingSwitch.name}</strong> will clear those items because each order ships from one location.</>
                ) : null}
                confirmLabel="Clear cart and switch"
                cancelLabel="Keep my cart"
                onConfirm={confirmSwitch}
                onCancel={() => setPendingSwitch(null)}
            />
        </div>
    );
}
