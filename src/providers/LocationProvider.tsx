"use client";

import { createContext, useContext, useEffect, useState, useCallback } from "react";
import type { LocationType, SalesChannel } from "@prisma/client";

/**
 * Phase 1 (1e) — Shopper's currently-selected serving location.
 *
 * Per business rule: 1 cart = 1 location = 1 delivery method. This provider
 * holds the location half of that invariant. Mirrored to a cookie so Server
 * Components can read it during SSR (catalog filter in 1f).
 *
 * Cart-rule enforcement (clear-on-switch) lands in 1g via CartProvider, not
 * here — we keep this provider purely about location identity.
 */

export interface LocationOption {
    id: string;
    name: string;
    type: LocationType;
    city: string;
    state: string;
    latitude: number | null;
    longitude: number | null;
    isPrimary: boolean;
    allowsChannels: SalesChannel[];
    displayDescription: string | null;
}

interface LocationContextType {
    locations: LocationOption[];
    selectedLocationId: string | null;
    selectedLocation: LocationOption | null;
    setSelectedLocationId: (id: string | null) => void;
}

const LocationContext = createContext<LocationContextType | null>(null);

const COOKIE_NAME = "colchis_loc_id";
const STORAGE_KEY = "colchis-loc-id";
const COOKIE_MAX_AGE_DAYS = 30;

function writeCookie(id: string | null) {
    if (typeof document === "undefined") return;
    if (id) {
        const maxAge = COOKIE_MAX_AGE_DAYS * 24 * 60 * 60;
        document.cookie = `${COOKIE_NAME}=${encodeURIComponent(id)}; path=/; max-age=${maxAge}; samesite=lax`;
    } else {
        document.cookie = `${COOKIE_NAME}=; path=/; max-age=0; samesite=lax`;
    }
}

function readLocalStorage(): string | null {
    if (typeof window === "undefined") return null;
    try { return localStorage.getItem(STORAGE_KEY); }
    catch { return null; }
}

function writeLocalStorage(id: string | null) {
    if (typeof window === "undefined") return;
    try {
        if (id) localStorage.setItem(STORAGE_KEY, id);
        else localStorage.removeItem(STORAGE_KEY);
    } catch { /* quota etc. */ }
}

export function LocationProvider({
    children,
    locations,
    initialSelectedId,
}: {
    children: React.ReactNode;
    locations: LocationOption[];
    /** Cookie value read server-side by the layout, so first paint matches SSR. */
    initialSelectedId: string | null;
}) {
    const [selectedLocationId, setSelectedLocationIdState] = useState<string | null>(initialSelectedId);

    // Reconcile: if localStorage disagrees with SSR cookie (e.g. user opened a
    // shared link from another browser), trust localStorage and resync cookie.
    useEffect(() => {
        const fromStorage = readLocalStorage();
        if (fromStorage && fromStorage !== selectedLocationId && locations.some(l => l.id === fromStorage)) {
            setSelectedLocationIdState(fromStorage);
            writeCookie(fromStorage);
        } else if (!selectedLocationId) {
            // No selection yet anywhere — auto-pick the primary location (matches
            // the "default to primary bakery" UX hint).
            const primary = locations.find(l => l.isPrimary);
            if (primary) {
                setSelectedLocationIdState(primary.id);
                writeCookie(primary.id);
                writeLocalStorage(primary.id);
            }
        } else {
            // Make sure storage matches cookie on first mount.
            writeLocalStorage(selectedLocationId);
        }
        // Intentional one-shot reconciliation on mount.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const setSelectedLocationId = useCallback((id: string | null) => {
        setSelectedLocationIdState(id);
        writeCookie(id);
        writeLocalStorage(id);
    }, []);

    const selectedLocation = selectedLocationId
        ? locations.find(l => l.id === selectedLocationId) ?? null
        : null;

    return (
        <LocationContext.Provider value={{ locations, selectedLocationId, selectedLocation, setSelectedLocationId }}>
            {children}
        </LocationContext.Provider>
    );
}

export function useLocation() {
    const ctx = useContext(LocationContext);
    if (!ctx) throw new Error("useLocation must be used within a LocationProvider");
    return ctx;
}

/** Cookie name exported so Server Components can read it via next/headers. */
export const LOCATION_COOKIE_NAME = COOKIE_NAME;
