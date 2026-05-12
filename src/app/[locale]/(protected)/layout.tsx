import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { AuthProvider } from "@/providers/AuthProvider";
import ProtectedShell from "@/components/layout/ProtectedShell";

export default function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthProvider>
      <ProtectedShell header={<Header />} footer={<Footer />}>
        {children}
      </ProtectedShell>
    </AuthProvider>
  );
}
