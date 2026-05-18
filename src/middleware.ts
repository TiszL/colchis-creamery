import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";
import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

const intlMiddleware = createMiddleware(routing);

const SECRET_KEY = new TextEncoder().encode(
  process.env.JWT_SECRET || "dev-secret-change-in-production"
);

// ── Role Constants ────────────────────────────────────────────────────────────
const STAFF_ROLES = ["MASTER_ADMIN", "PRODUCT_MANAGER", "CONTENT_MANAGER", "SALES"];
const ALL_ADMIN_ROLES = ["MASTER_ADMIN"];
const ALL_STAFF_ROLES = [...STAFF_ROLES];
const B2B_ROLES = ["B2B_PARTNER", "MASTER_ADMIN"];
const ANALYTICS_ROLES = ["ANALYTICS_VIEWER", ...STAFF_ROLES];

// ── Protected Path Definitions ────────────────────────────────────────────────
type ProtectedArea = "admin" | "portal" | "b2b-portal" | "account" | "analytics";

const PROTECTED_AREAS: { segment: string; area: ProtectedArea; allowedRoles: string[] }[] = [
  { segment: "admin", area: "admin", allowedRoles: ALL_ADMIN_ROLES },
  { segment: "portal", area: "portal", allowedRoles: ALL_STAFF_ROLES },
  { segment: "b2b-portal", area: "b2b-portal", allowedRoles: B2B_ROLES },
  { segment: "account", area: "account", allowedRoles: ["B2C_CUSTOMER", ...STAFF_ROLES] },
  { segment: "analytics", area: "analytics", allowedRoles: ANALYTICS_ROLES },
];

function getProtectedArea(pathname: string): typeof PROTECTED_AREAS[number] | null {
  const segments = pathname.split("/");
  return PROTECTED_AREAS.find((a) => segments.includes(a.segment)) || null;
}

function isProtectedPath(pathname: string): boolean {
  return getProtectedArea(pathname) !== null;
}

function getLoginUrl(area: ProtectedArea | null, locale: string): string {
  if (area === "admin" || area === "portal" || area === "analytics") {
    return `/${locale}/portal-login`;
  }
  if (area === "b2b-portal") {
    return `/${locale}/b2b/login`;
  }
  return `/${locale}/login`;
}

// ── Legacy path redirects ───────────────────────────────────────────────────
const LEGACY_REDIRECTS: Record<string, string> = {
  "staff-portal": "portal",
  "staff": "portal-login",
};

export default async function middleware(req: NextRequest) {
  const pathname = req.nextUrl.pathname;

  // ── Backward-compat: redirect old /staff and /staff-portal to new paths ───
  const segments = pathname.split("/");
  for (const [oldSeg, newSeg] of Object.entries(LEGACY_REDIRECTS)) {
    const idx = segments.indexOf(oldSeg);
    if (idx !== -1) {
      segments[idx] = newSeg;
      return NextResponse.redirect(new URL(segments.join("/"), req.url), 301);
    }
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
    const { payload } = await jwtVerify(token, SECRET_KEY);
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
