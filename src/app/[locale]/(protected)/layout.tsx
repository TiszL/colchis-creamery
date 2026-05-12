"use client";

import { usePathname } from "next/navigation";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { AuthProvider } from "@/providers/AuthProvider";

/* Segments that use their OWN sidebar/shell — no public header/footer */
const PANEL_SEGMENTS = ["admin", "portal", "analytics"];

export default function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const segments = pathname.split("/");
  const isPanel = segments.some((s) => PANEL_SEGMENTS.includes(s));

  return (
    <AuthProvider>
      {!isPanel && <Header />}
      <main className={isPanel ? "" : "min-h-screen"}>{children}</main>
      {!isPanel && <Footer />}
    </AuthProvider>
  );
}
