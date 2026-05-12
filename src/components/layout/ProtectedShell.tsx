"use client";

// Splits the panel-route detection (which needs usePathname, a client-only hook)
// from the layout's server-component context. Header/Footer JSX is rendered in the
// parent server layout and passed in as props — this component never imports them,
// so the async Footer stays a Server Component instead of being bundled into a
// client module (which Next.js rejects).

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

/* Segments that use their OWN sidebar/shell — no public header/footer */
const PANEL_SEGMENTS = ["admin", "portal", "analytics"];

export default function ProtectedShell({
  children,
  header,
  footer,
}: {
  children: ReactNode;
  header: ReactNode;
  footer: ReactNode;
}) {
  const pathname = usePathname();
  const segments = pathname.split("/");
  const isPanel = segments.some((s) => PANEL_SEGMENTS.includes(s));

  return (
    <>
      {!isPanel && header}
      <main className={isPanel ? "" : "min-h-screen"}>{children}</main>
      {!isPanel && footer}
    </>
  );
}
