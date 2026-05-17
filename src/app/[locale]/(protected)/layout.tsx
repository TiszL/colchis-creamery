import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { AuthProvider } from "@/providers/AuthProvider";
import ProtectedShell from "@/components/layout/ProtectedShell";
import { getPrimaryLocation } from "@/lib/business-location";

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const primary = await getPrimaryLocation();
  return (
    <AuthProvider>
      <ProtectedShell header={<Header primaryAddressShort={primary.addressLine1} />} footer={<Footer />}>
        {children}
      </ProtectedShell>
    </AuthProvider>
  );
}
