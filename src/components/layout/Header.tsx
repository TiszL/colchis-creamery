"use client";

import Link from "next/link";
import { useTranslations, useLocale } from "next-intl";
import { LocaleSwitcher } from "./LocaleSwitcher";
import { useCart } from "@/providers/CartProvider";
import { useAuth } from "@/providers/AuthProvider";
import { useState, useRef, useEffect } from "react";

export function Header() {
  const t = useTranslations("nav");
  const locale = useLocale();
  const { itemCount } = useCart();
  const { user, isLoggedIn, isLoading, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const prefix = locale === "en" ? "" : `/${locale}`;

  const navLinks = [
    { href: `${prefix}/`, label: t("home") },
    { href: `${prefix}/heritage`, label: t("heritage") },
    { href: `${prefix}/shop`, label: t("shop") },
    { href: `${prefix}/recipes`, label: t("recipes") },
    { href: `${prefix}/wholesale`, label: t("wholesale") },
    { href: `${prefix}/contact`, label: t("contact") },
  ];

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleLogout = async () => {
    setDropdownOpen(false);
    setMobileOpen(false);
    await logout();
  };

  const userInitial = user?.name?.charAt(0)?.toUpperCase() || user?.email?.charAt(0)?.toUpperCase() || "U";

  return (
    <header className="sticky top-0 z-40 bg-cream/95 backdrop-blur-sm border-b border-border-light">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20 sm:h-28 py-2">
          {/* Left: Logo (flex-1 to push nav to center) */}
          <div className="flex-1 flex items-center justify-start">
            <Link href={`${prefix}/`} className="flex items-center gap-3">
              <img src="/logo-optimized.png" alt="Colchis Creamery Logo" className="w-[70px] h-[70px] sm:w-[90px] sm:h-[90px] object-contain rounded-full border border-gold/30 shadow-md" />
              <span className="font-serif text-xl sm:text-2xl font-bold text-charcoal tracking-tight hidden sm:block">
                Colchis<span className="text-gold"> Creamery</span>
              </span>
            </Link>
          </div>

          {/* Center: Desktop Navigation */}
          <nav className="hidden lg:flex items-center justify-center shrink-0 gap-1">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="px-3 py-2 text-sm font-medium text-charcoal/80 hover:text-gold transition rounded"
              >
                {link.label}
              </Link>
            ))}
          </nav>

          {/* Right side (flex-1): locale, cart, auth */}
          <div className="flex-1 flex items-center justify-end gap-2">
            <LocaleSwitcher />

            <Link
              href={`${prefix}/cart`}
              className="relative p-2 rounded hover:bg-charcoal/5 transition"
              aria-label={t("cart")}
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"
                />
              </svg>
              {itemCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-gold text-white text-xs w-5 h-5 rounded-full flex items-center justify-center font-medium">
                  {itemCount}
                </span>
              )}
            </Link>

            {/* Desktop Auth */}
            {!isLoading && (
              <>
                {isLoggedIn && user ? (
                  <div className="hidden lg:block relative" ref={dropdownRef}>
                    <button
                      onClick={() => setDropdownOpen(!dropdownOpen)}
                      className="flex items-center justify-center w-10 h-10 rounded-full border-2 border-transparent hover:border-gold transition-all focus:outline-none focus:ring-2 focus:ring-gold/50"
                      aria-label="User Menu"
                    >
                      <div className="w-9 h-9 rounded-full bg-gold flex items-center justify-center shadow-sm">
                        <span className="text-white text-sm font-bold">{userInitial}</span>
                      </div>
                    </button>

                    {/* Dropdown */}
                    {dropdownOpen && (
                      <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-xl border border-border-light py-2 animate-fade-in z-50">
                        <div className="px-4 py-2 border-b border-border-light">
                          <p className="text-sm font-medium text-charcoal truncate">{user.name || "Customer"}</p>
                          <p className="text-xs text-charcoal/50 truncate">{user.email}</p>
                        </div>
                        <Link
                          href={`${prefix}/account`}
                          onClick={() => setDropdownOpen(false)}
                          className="flex items-center gap-3 px-4 py-2.5 text-sm text-charcoal/80 hover:bg-cream hover:text-gold transition"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                          </svg>
                          My Account
                        </Link>
                        <Link
                          href={`${prefix}/account`}
                          onClick={() => setDropdownOpen(false)}
                          className="flex items-center gap-3 px-4 py-2.5 text-sm text-charcoal/80 hover:bg-cream hover:text-gold transition"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                          </svg>
                          Order History
                        </Link>
                        <div className="border-t border-border-light my-1"></div>
                        <button
                          onClick={handleLogout}
                          className="flex items-center gap-3 px-4 py-2.5 text-sm text-red-500 hover:bg-red-50 transition w-full text-left"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                          </svg>
                          Sign Out
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <Link
                    href={`${prefix}/login`}
                    className="hidden lg:flex items-center gap-2 px-5 py-2 ml-2 rounded-full border border-charcoal text-charcoal text-xs font-bold tracking-tight uppercase hover:bg-charcoal hover:text-white transition-all"
                  >
                    Sign In
                  </Link>
                )}
              </>
            )}

            {/* Mobile menu button */}
            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="lg:hidden p-2 rounded hover:bg-charcoal/5 transition"
              aria-label="Menu"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                {mobileOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
          </div>
        </div>

        {/* Mobile Navigation */}
        {mobileOpen && (
          <nav className="lg:hidden pb-4 border-t border-border-light pt-4">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMobileOpen(false)}
                className="block px-3 py-3 text-base font-medium text-charcoal/80 hover:text-gold hover:bg-cream transition rounded"
              >
                {link.label}
              </Link>
            ))}
            <div className="border-t border-border-light my-2"></div>
            {!isLoading && isLoggedIn && user ? (
              <>
                <div className="flex items-center gap-3 px-3 py-3">
                  <div className="w-8 h-8 rounded-full bg-gold flex items-center justify-center">
                    <span className="text-white text-xs font-bold">{userInitial}</span>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-charcoal">{user.name || user.email.split("@")[0]}</p>
                    <p className="text-xs text-charcoal/50">{user.email}</p>
                  </div>
                </div>
                <Link
                  href={`${prefix}/account`}
                  onClick={() => setMobileOpen(false)}
                  className="block px-3 py-3 text-base font-medium text-charcoal/80 hover:text-gold hover:bg-cream transition rounded"
                >
                  My Account
                </Link>
                <button
                  onClick={handleLogout}
                  className="block w-full text-left px-3 py-3 text-base font-medium text-red-500 hover:bg-red-50 transition rounded"
                >
                  Sign Out
                </button>
              </>
            ) : (
              <Link
                href={`${prefix}/login`}
                onClick={() => setMobileOpen(false)}
                className="block px-3 py-3 text-base font-medium text-gold hover:text-charcoal hover:bg-cream transition rounded"
              >
                Sign In
              </Link>
            )}
          </nav>
        )}
      </div>
    </header>
  );
}
