"use client";

import { useLocale } from "next-intl";
import { useRouter, usePathname } from "next/navigation";
import { routing } from "@/i18n/routing";
import { useState, useRef, useEffect } from "react";
import "flag-icons/css/flag-icons.min.css";

const localeNames: Record<string, string> = {
  en: "English",
  ka: "ქართული",
  ru: "Русский",
  es: "Español",
};

const localeFlags: Record<string, string> = {
  en: "fi fi-us border border-black/10 text-lg rounded-sm",
  ka: "fi fi-ge border border-black/10 text-lg rounded-sm",
  ru: "fi fi-ru border border-black/10 text-lg rounded-sm",
  es: "fi fi-es border border-black/10 text-lg rounded-sm",
};

export function LocaleSwitcher() {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

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
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-3 py-2 text-sm rounded hover:bg-charcoal/5 transition"
        aria-label="Switch language"
      >
        <span className={localeFlags[locale]}></span>
        <span className="hidden sm:inline lg:hidden xl:inline pt-0.5">{localeNames[locale]}</span>
        <svg
          className={`w-4 h-4 transition-transform ${open ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-44 bg-white rounded-lg shadow-lg border border-border-light z-50">
          {routing.locales.map((loc) => (
            <button
              key={loc}
              onClick={() => switchLocale(loc)}
              className={`w-full flex items-center gap-3 px-4 py-3 text-sm hover:bg-cream transition text-left ${
                loc === locale ? "text-gold font-medium" : "text-charcoal"
              }`}
            >
              <span className={localeFlags[loc]}></span>
              <span className="pt-0.5">{localeNames[loc]}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
