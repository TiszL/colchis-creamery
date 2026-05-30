import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";
import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { getJwtSecret } from "./lib/auth";

const intlMiddleware = createMiddleware(routing);

// ── Role Constants ────────────────────────────────────────────────────────────
const STAFF_ROLES = ["MASTER_ADMIN", "PRODUCT_MANAGER", "CONTENT_MANAGER", "SALES"];
const ALL_ADMIN_ROLES = ["MASTER_ADMIN"];
const ALL_STAFF_ROLES = [...STAFF_ROLES];
const B2B_ROLES = ["B2B_PARTNER", "MASTER_ADMIN"];
const ANALYTICS_ROLES = ["ANALYTICS_VIEWER", ...STAFF_ROLES];
// Phase 2 (2c): /location-portal admits any signed-in user at the
// middleware layer; the layout enforces the real per-location role check
// via requireLocationAccess() against the UserLocation table. This
// decouples middleware (edge, no DB) from row-level access (server, DB).
const ANY_SIGNED_IN_ROLES = [
  "MASTER_ADMIN", "PRODUCT_MANAGER", "CONTENT_MANAGER", "SALES",
  "ANALYTICS_VIEWER", "B2B_PARTNER", "B2C_CUSTOMER",
];

// ── Protected Path Definitions ────────────────────────────────────────────────
type ProtectedArea = "admin" | "portal" | "b2b-portal" | "account" | "analytics" | "location-portal";

const PROTECTED_AREAS: { segment: string; area: ProtectedArea; allowedRoles: string[] }[] = [
  { segment: "admin", area: "admin", allowedRoles: ALL_ADMIN_ROLES },
  { segment: "portal", area: "portal", allowedRoles: ALL_STAFF_ROLES },
  { segment: "b2b-portal", area: "b2b-portal", allowedRoles: B2B_ROLES },
  { segment: "account", area: "account", allowedRoles: ["B2C_CUSTOMER", ...STAFF_ROLES] },
  { segment: "analytics", area: "analytics", allowedRoles: ANALYTICS_ROLES },
  { segment: "location-portal", area: "location-portal", allowedRoles: ANY_SIGNED_IN_ROLES },
];

function getProtectedArea(pathname: string): typeof PROTECTED_AREAS[number] | null {
  const segments = pathname.split("/");
  return PROTECTED_AREAS.find((a) => segments.includes(a.segment)) || null;
}

function isProtectedPath(pathname: string): boolean {
  return getProtectedArea(pathname) !== null;
}

function getLoginUrl(area: ProtectedArea | null, locale: string): string {
  if (area === "admin" || area === "portal" || area === "analytics" || area === "location-portal") {
    return `/${locale}/portal-login`;
  }
  if (area === "b2b-portal") {
    return `/${locale}/b2b/login`;
  }
  return `/${locale}/login`;
}

// ── Legacy path redirects ───────────────────────────────────────────────────
// Pre-overhaul `/staff` was the staff-login page (now `/portal-login`) and
// `/staff-portal` was the staff dashboard root (now `/portal`). Match ONLY
// when the legacy slug is the top-level segment (after the optional locale
// prefix) — otherwise we'd hijack `/admin/staff`, `/admin/location-staff`,
// etc., rewriting them to dead URLs.
const LEGACY_REDIRECTS: Record<string, string> = {
  "staff-portal": "portal",
  "staff": "portal-login",
};

export default async function middleware(req: NextRequest) {
  const pathname = req.nextUrl.pathname;

  // ── Backward-compat: redirect old top-level /staff and /staff-portal ──────
  const segments = pathname.split("/");
  const localePrefixed = routing.locales.includes(segments[1] as any);
  const topIdx = localePrefixed ? 2 : 1;
  const topSegment = segments[topIdx];
  const replacement = topSegment ? LEGACY_REDIRECTS[topSegment] : undefined;
  if (replacement) {
    segments[topIdx] = replacement;
    return NextResponse.redirect(new URL(segments.join("/"), req.url), 301);
  }

  // ── For non-protected paths, just run intl middleware ──────────────────────
  if (!isProtectedPath(pathname)) {
    return intlMiddleware(req);
  }

  // ── Protected path: check auth FIRST, then run intl middleware ─────────────
  const token = req.cookies.get("auth_token")?.value;
  const protectedArea = getProtectedArea(pathname);
  const firstSegment = pathname.split("/")[1] || "";
  const locale = routing.locales.includes(firstSegment as any) ? firstSegment : routing.defaultLocale;

  if (!token) {
    const loginUrl = getLoginUrl(protectedArea?.area || null, locale);
    return NextResponse.redirect(new URL(loginUrl, req.url));
  }

  try {
    const { payload } = await jwtVerify(token, getJwtSecret());
    const userRole = payload.role as string;

    if (protectedArea && !protectedArea.allowedRoles.includes(userRole)) {
      if (STAFF_ROLES.includes(userRole)) {
        if (userRole === "MASTER_ADMIN") {
          return NextResponse.redirect(new URL(`/${locale}/admin`, req.url));
        }
        return NextResponse.redirect(new URL(`/${locale}/portal`, req.url));
      }
      if (userRole === "B2B_PARTNER") {
        return NextResponse.redirect(new URL(`/${locale}/b2b-portal`, req.url));
      }
      if (userRole === "ANALYTICS_VIEWER") {
        return NextResponse.redirect(new URL(`/${locale}/analytics`, req.url));
      }
      return NextResponse.redirect(new URL(`/${locale}`, req.url));
    }

    // ── Auth passed: run intl middleware and inject user headers ───────────
    const intlResponse = intlMiddleware(req);

    // Inject auth info into the response headers for downstream pages
    intlResponse.headers.set("x-user-id", payload.userId as string);
    intlResponse.headers.set("x-user-role", userRole);
    intlResponse.headers.set("x-user-name", (payload.name as string) || "");

    return intlResponse;
  } catch {
    const loginUrl = getLoginUrl(protectedArea?.area || null, locale);
    const redirectResponse = NextResponse.redirect(new URL(loginUrl, req.url));
    redirectResponse.cookies.delete("auth_token");
    return redirectResponse;
  }
}

export const config = {
  // Tightened matcher: previous `.*\..*` excluded ANY path containing a dot,
  // which broke `/orders/<jwt>` URLs (JWTs are `header.payload.signature`).
  // We now only exclude paths that END with a typical file-extension pattern
  // (2-5 alphanumeric chars after a dot), so dynamic segments containing
  // dots — JWTs, UUIDs that happen to embed dots, version strings, etc. —
  // still flow through next-intl locale handling.
  matcher: [
    "/((?!api|_next|_vercel|.*\\.[a-zA-Z0-9]{2,5}$).*)",
  ],
};
