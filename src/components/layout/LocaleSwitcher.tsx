"use client";

import { useLocale } from "next-intl";
import { useRouter, usePathname } from "next/navigation";
import { routing } from "@/i18n/routing";
import { useState, useRef, useEffect, useLayoutEffect } from "react";

const localeCodes: Record<string, string> = {
  en: "EN",
  ka: "KA",
  ru: "RU",
  es: "ES",
};

// Only offer locales whose customer-facing translation is complete. ru/es
// still have untranslated surfaces (B2B portal, some checkout strings), and
// offering a half-translated language reads worse than not offering it. Their
// URLs still resolve if visited directly — this only controls the switcher.
// Re-add here once ru/es are finished.
const ENABLED_LOCALES = ["en", "ka"];

export function LocaleSwitcher() {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  // Open direction: near the bottom of the page (footer) a downward menu hangs
  // past the document edge and extends the scrollable area — the page visibly
  // "grows". Measured per open: flip upward when there isn't room below.
  const [dropUp, setDropUp] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKey);
    };
  }, []);

  // Before paint on each open: measure the real menu height against the space
  // below the trigger; open upward if it would overflow the viewport bottom
  // (and there is room above). Runs pre-paint so there is no flicker.
  useLayoutEffect(() => {
    if (!open) return;
    const trigger = ref.current;
    const menu = menuRef.current;
    if (!trigger || !menu) return;
    const t = trigger.getBoundingClientRect();
    const menuH = menu.offsetHeight + 8; // + margin
    setDropUp(t.bottom + menuH > window.innerHeight && t.top - menuH > 0);
  }, [open]);

  function switchLocale(newLocale: string) {
    const segments = pathname.split("/");
    if (routing.locales.includes(segments[1] as typeof routing.locales[number])) {
      segments[1] = newLocale;
    } else {
      segments.splice(1, 0, newLocale);
    }
    router.push(segments.join("/") || "/");
    setOpen(false);
  }

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          display: "flex", alignItems: "center", gap: 6,
          background: "transparent", border: "none", cursor: "pointer", padding: "4px 0",
          fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.28em",
          color: "inherit", textTransform: "uppercase",
        }}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        {localeCodes[locale]}
        <svg width="8" height="8" viewBox="0 0 8 8" fill="none" style={{ transition: "transform 200ms", transform: open ? "rotate(180deg)" : "none" }}>
          <path d="M1 2.5L4 5.5L7 2.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <div ref={menuRef} role="listbox" aria-label="Language" style={{
          position: "absolute", right: 0,
          ...(dropUp ? { bottom: "100%", marginBottom: 8 } : { top: "100%", marginTop: 8 }),
          background: "#FFFFFF", border: "1px solid #1F302622",
          minWidth: 80, zIndex: 50, display: "flex", flexDirection: "column",
          boxShadow: "0 4px 16px #1F302626",
        }}>
          {routing.locales.filter((loc) => ENABLED_LOCALES.includes(loc)).map((loc) => (
            <button
              key={loc}
              role="option"
              aria-selected={loc === locale}
              onClick={() => switchLocale(loc)}
              style={{
                display: "block", width: "100%", textAlign: "left",
                padding: "10px 16px", border: "none", cursor: "pointer",
                fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.28em",
                textTransform: "uppercase",
                background: loc === locale ? "#F5F0E6" : "transparent",
                color: loc === locale ? "#B96A3D" : "#1F3026",
                borderBottom: "1px solid #1F302611",
                transition: "background 150ms",
              }}
            >
              {localeCodes[loc]}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
