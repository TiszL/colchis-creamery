"use client";

import { useState } from "react";

const LOCAL_ZIPS = ["43016", "43017", "43002", "43026", "43221", "43015", "43065", "43035"];

export function DeliverySelector() {
  const [zip, setZip] = useState("43017");
  const [mode, setMode] = useState<"hot" | "ship">("hot");
  const isLocal = LOCAL_ZIPS.includes(zip);

  const handleGeolocation = () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const res = await fetch(
            `https://maps.googleapis.com/maps/api/geocode/json?latlng=${pos.coords.latitude},${pos.coords.longitude}&key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY}`
          );
          const data = await res.json();
          const zipResult = data.results?.[0]?.address_components?.find(
            (c: { types: string[] }) => c.types.includes("postal_code")
          );
          if (zipResult) setZip(zipResult.short_name);
        } catch {
          /* silently fail */
        }
      },
      () => { /* denied */ }
    );
  };

  return (
    <div style={{ background: "#F5F0E6", color: "#1F3026", padding: 24, fontFamily: "var(--font-sans)" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 10,
            letterSpacing: "0.28em",
            color: "#7A8278",
            textTransform: "uppercase",
          }}
        >
          Deliver to
        </span>
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 10,
            letterSpacing: "0.2em",
            color: isLocal ? "#B96A3D" : "#1F3026",
            textTransform: "uppercase",
          }}
        >
          {isLocal ? "● Local zone" : "○ Ships nationwide"}
        </span>
      </div>

      {/* ZIP Input — stacks vertically on mobile (see .ch-zip-row in globals.css) */}
      <div className="ch-zip-row" style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <input
          value={zip}
          onChange={(e) => setZip(e.target.value.replace(/\D/g, "").slice(0, 5))}
          maxLength={5}
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
          onClick={handleGeolocation}
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 11,
            letterSpacing: "0.24em",
            textTransform: "uppercase",
            background: "#1F3026",
            color: "#F5F0E6",
            border: "none",
            padding: "14px 22px",
            cursor: "pointer",
            whiteSpace: "nowrap",
          }}
        >
          Use location
        </button>
      </div>

      {/* Mode Buttons */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <button
          onClick={() => isLocal && setMode("hot")}
          disabled={!isLocal}
          style={{
            textAlign: "left",
            padding: 14,
            cursor: isLocal ? "pointer" : "not-allowed",
            background: mode === "hot" && isLocal ? "#1F3026" : "transparent",
            color: mode === "hot" && isLocal ? "#F5F0E6" : "#1F3026",
            opacity: isLocal ? 1 : 0.4,
            border: "1px solid #1F302644",
          }}
        >
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.28em", textTransform: "uppercase", opacity: 0.7 }}>
            ◐ Hot · 25 min
          </div>
          <div style={{ fontFamily: "var(--font-serif)", fontStyle: "italic", fontSize: 22, marginTop: 6 }}>Bakery</div>
          <div style={{ fontSize: 11, opacity: 0.7, marginTop: 2 }}>Khachapuri, fresh from oven</div>
        </button>
        <button
          onClick={() => setMode("ship")}
          style={{
            textAlign: "left",
            padding: 14,
            cursor: "pointer",
            background: mode === "ship" ? "#1F3026" : "transparent",
            color: mode === "ship" ? "#F5F0E6" : "#1F3026",
            border: "1px solid #1F302644",
          }}
        >
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.28em", textTransform: "uppercase", opacity: 0.7 }}>
            ▸ UPS · 1–2 days
          </div>
          <div style={{ fontFamily: "var(--font-serif)", fontStyle: "italic", fontSize: 22, marginTop: 6 }}>Creamery</div>
          <div style={{ fontSize: 11, opacity: 0.7, marginTop: 2 }}>Cheese & frozen, US-wide</div>
        </button>
      </div>

      {/* Status line */}
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
        {isLocal && mode === "hot" && "→ Doordash · Uber Eats · ETA 25 min · until 9 PM"}
        {isLocal && mode === "ship" && "→ UPS Ground · arrives in 1–2 days · free over $75"}
        {!isLocal && "→ UPS Ground · 1–2 days · free shipping over $75"}
      </div>
    </div>
  );
}
