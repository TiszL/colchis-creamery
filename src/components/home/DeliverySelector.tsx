"use client";

import { useState, useCallback, useMemo } from "react";
import Link from "next/link";
import { APIProvider, useMapsLibrary } from "@vis.gl/react-google-maps";
import type { DeliveryMethod } from "@prisma/client";
import { useLocation } from "@/providers/LocationProvider";
import { resolveNearestLocation, type ResolvedLocation } from "@/app/actions/location-resolve";

// localStorage key AddressManager (bakery/creamery) reads guest delivery
// address from. Writing the same shape here means resolving on the homepage
// lights up /bakery & /creamery without re-entering the address.
const GUEST_ADDRESS_KEY = "colchis-delivery-address";

// Honest, human label for a delivery method — mirrors the maps used on
// /bakery and /shop so copy stays consistent across the site.
function methodLabel(m: DeliveryMethod): string {
  switch (m) {
    case "OWN_DELIVERY": return "our own delivery";
    case "DOORDASH_DRIVE": return "DoorDash";
    case "UBER_DIRECT": return "Uber Eats";
    case "UPS_2DAY": return "UPS 2-day";
    case "IN_STORE_PICKUP": return "pickup";
    case "IN_STORE_DINE_IN": return "dine-in";
    default: return m.replace(/_/g, " ").toLowerCase();
  }
}

// Build the honest status line from the resolved location. No invented ETAs,
// prices, or radii — only facts derived from the matched location.
function statusLine(r: ResolvedLocation): string {
  if (r.inServiceArea) {
    const methods = r.reachableMethods.map(methodLabel);
    const via = methods.length ? methods.join(" · ") : "local delivery";
    return `→ ${r.name} · ${r.distanceMiles.toFixed(1)} mi · via ${via}`;
  }
  const nearest =
    r.nearestBakeryMiles !== null
      ? ` · nearest bakery ${r.nearestBakeryMiles.toFixed(0)} mi away`
      : "";
  return `→ Out of local range${nearest} · ships nationwide via UPS 2-day from ${r.name}`;
}

type ParsedGeocode = {
  lat: number;
  lng: number;
  formatted: string;
  city: string;
  state: string;
  postalCode: string;
};

function parseGeocode(result: google.maps.GeocoderResult): ParsedGeocode {
  const comps = result.address_components || [];
  const get = (type: string) => comps.find((c) => c.types.includes(type))?.long_name || "";
  const getShort = (type: string) => comps.find((c) => c.types.includes(type))?.short_name || "";
  return {
    lat: result.geometry.location.lat(),
    lng: result.geometry.location.lng(),
    formatted: result.formatted_address || "",
    city: get("locality") || get("postal_town") || get("sublocality") || get("administrative_area_level_2") || "",
    state: getShort("administrative_area_level_1") || "",
    postalCode: get("postal_code") || "",
  };
}

function writeGuestAddress(p: ParsedGeocode) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      GUEST_ADDRESS_KEY,
      JSON.stringify({
        formatted: p.formatted,
        lat: p.lat,
        lng: p.lng,
        googlePlaceId: "",
        city: p.city,
        state: p.state,
        postalCode: p.postalCode,
        country: "US",
      }),
    );
  } catch {
    /* quota / private mode — non-fatal */
  }
}

/* ─── Shared presentational cards (used by both interactive + static modes) ─── */

function ModeCards({ linkPrefix }: { linkPrefix: string }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
      <Link
        href={`${linkPrefix}/bakery`}
        style={{
          display: "block",
          textAlign: "left",
          padding: 14,
          textDecoration: "none",
          color: "#1F3026",
          border: "1px solid #1F302644",
        }}
      >
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.28em", textTransform: "uppercase", opacity: 0.7 }}>
          ◐ Hot · local
        </div>
        <div style={{ fontFamily: "var(--font-serif)", fontStyle: "italic", fontSize: 22, marginTop: 6 }}>Bakery</div>
        <div style={{ fontSize: 11, opacity: 0.7, marginTop: 2 }}>Khachapuri, fresh from oven</div>
      </Link>
      <Link
        href={`${linkPrefix}/creamery`}
        style={{
          display: "block",
          textAlign: "left",
          padding: 14,
          textDecoration: "none",
          color: "#1F3026",
          border: "1px solid #1F302644",
        }}
      >
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.28em", textTransform: "uppercase", opacity: 0.7 }}>
          ▸ UPS · 2-day
        </div>
        <div style={{ fontFamily: "var(--font-serif)", fontStyle: "italic", fontSize: 22, marginTop: 6 }}>Creamery</div>
        <div style={{ fontSize: 11, opacity: 0.7, marginTop: 2 }}>Cheese & frozen, US-wide</div>
      </Link>
    </div>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ background: "#F5F0E6", color: "#1F3026", padding: 24, fontFamily: "var(--font-sans)" }}>
      {children}
    </div>
  );
}

/* ─── Interactive box (requires a Maps key + APIProvider context) ─────────── */

function DeliveryBox({ linkPrefix }: { linkPrefix: string }) {
  const geocodingLib = useMapsLibrary("geocoding");
  const geocoder = useMemo(() => (geocodingLib ? new geocodingLib.Geocoder() : null), [geocodingLib]);
  const { setSelectedLocationId } = useLocation();

  const [zip, setZip] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [resolved, setResolved] = useState<ResolvedLocation | null>(null);

  // Shared tail: persist the resolved location + guest address, then reflect.
  const applyGeocode = useCallback(
    async (p: ParsedGeocode) => {
      const r = await resolveNearestLocation(p.lat, p.lng);
      if (!r) {
        setMessage("We couldn't find a serving location for that address.");
        setResolved(null);
        return;
      }
      writeGuestAddress(p);
      setSelectedLocationId(r.id); // writes cookie + localStorage → header LocationPicker updates
      setResolved(r);
      setMessage(null);
    },
    [setSelectedLocationId],
  );

  const handleZipSubmit = useCallback(() => {
    if (!geocoder) {
      setMessage("Map isn't ready yet — try again in a moment.");
      return;
    }
    if (zip.length !== 5) {
      setMessage("Enter a 5-digit ZIP code.");
      return;
    }
    setBusy(true);
    setMessage(null);
    geocoder.geocode({ address: `${zip}, USA` }, (results, status) => {
      setBusy(false);
      if (status !== "OK" || !results || results.length === 0) {
        setMessage("Couldn't find that ZIP — double-check it and try again.");
        return;
      }
      void applyGeocode(parseGeocode(results[0]));
    });
  }, [geocoder, zip, applyGeocode]);

  const handleGeolocation = useCallback(() => {
    if (!navigator.geolocation) {
      setMessage("Your browser can't share location — enter your ZIP instead.");
      return;
    }
    if (!geocoder) {
      setMessage("Map isn't ready yet — try again in a moment.");
      return;
    }
    setBusy(true);
    setMessage(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        geocoder.geocode(
          { location: { lat: pos.coords.latitude, lng: pos.coords.longitude } },
          (results, status) => {
            setBusy(false);
            if (status !== "OK" || !results || results.length === 0) {
              setMessage("Couldn't read your location — enter your ZIP instead.");
              return;
            }
            const p = parseGeocode(results[0]);
            if (p.postalCode) setZip(p.postalCode);
            void applyGeocode(p);
          },
        );
      },
      () => {
        setBusy(false);
        setMessage("Couldn't get your location — enter your ZIP.");
      },
    );
  }, [geocoder, applyGeocode]);

  return (
    <Shell>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.28em", color: "#7A8278", textTransform: "uppercase" }}>
          Deliver to
        </span>
        {resolved && (
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 10,
              letterSpacing: "0.2em",
              color: resolved.inServiceArea ? "#B96A3D" : "#1F3026",
              textTransform: "uppercase",
            }}
          >
            {resolved.inServiceArea ? "● Local zone" : "○ Ships nationwide"}
          </span>
        )}
      </div>

      {/* ZIP Input — stacks vertically on mobile (see .ch-zip-row in globals.css) */}
      <div className="ch-zip-row" style={{ display: "flex", gap: 8, marginBottom: message ? 10 : 16 }}>
        <input
          value={zip}
          onChange={(e) => setZip(e.target.value.replace(/\D/g, "").slice(0, 5))}
          onKeyDown={(e) => { if (e.key === "Enter") handleZipSubmit(); }}
          maxLength={5}
          inputMode="numeric"
          placeholder="ZIP code"
          style={{
            flex: 1,
            minWidth: 0,
            fontFamily: "var(--font-mono)",
            fontSize: 18,
            letterSpacing: "0.2em",
            background: "transparent",
            border: "1px solid #1F302644",
            padding: "12px 14px",
            color: "#1F3026",
            outline: "none",
          }}
        />
        <button
          onClick={handleZipSubmit}
          disabled={busy}
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 11,
            letterSpacing: "0.24em",
            textTransform: "uppercase",
            background: "#B96A3D",
            color: "#F5F0E6",
            border: "none",
            padding: "14px 20px",
            cursor: busy ? "wait" : "pointer",
            whiteSpace: "nowrap",
            opacity: busy ? 0.6 : 1,
          }}
        >
          Find
        </button>
        <button
          onClick={handleGeolocation}
          disabled={busy}
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 11,
            letterSpacing: "0.24em",
            textTransform: "uppercase",
            background: "#1F3026",
            color: "#F5F0E6",
            border: "none",
            padding: "14px 20px",
            cursor: busy ? "wait" : "pointer",
            whiteSpace: "nowrap",
            opacity: busy ? 0.6 : 1,
          }}
        >
          Use location
        </button>
      </div>

      {/* Inline message — denial / errors are visible, never silently swallowed */}
      {message && (
        <div
          style={{
            marginBottom: 16,
            padding: "8px 12px",
            background: "#EAE2D2",
            border: "1px solid #B96A3D55",
            fontFamily: "var(--font-sans)",
            fontSize: 12,
            color: "#1F3026",
            lineHeight: 1.4,
          }}
        >
          {message}
        </div>
      )}

      {/* Mode cards — CTAs deep-linking into the catalog */}
      <ModeCards linkPrefix={linkPrefix} />

      {/* Status line — honest, derived from the matched location */}
      {resolved && (
        <div
          style={{
            marginTop: 14,
            padding: "10px 14px",
            background: "#EAE2D2",
            fontFamily: "var(--font-mono)",
            fontSize: 10,
            letterSpacing: "0.16em",
            color: "#1F3026",
            textTransform: "uppercase",
          }}
        >
          {statusLine(resolved)}
        </div>
      )}
    </Shell>
  );
}

/* ─── Public entry ────────────────────────────────────────────────────────── */

export function DeliverySelector({ apiKey, linkPrefix = "" }: { apiKey?: string; linkPrefix?: string }) {
  // Graceful fallback: with no Maps key we can't geocode, so hide the
  // input/button and just show the catalog CTAs (no fabricated numbers).
  if (!apiKey) {
    return (
      <Shell>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.28em", color: "#7A8278", textTransform: "uppercase" }}>
            Order from
          </span>
        </div>
        <ModeCards linkPrefix={linkPrefix} />
      </Shell>
    );
  }

  return (
    <APIProvider apiKey={apiKey}>
      <DeliveryBox linkPrefix={linkPrefix} />
    </APIProvider>
  );
}
