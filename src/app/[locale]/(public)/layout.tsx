import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { JsonLdLocalBusiness } from "@/components/seo/JsonLdLocalBusiness";
import { AuthProvider } from "@/providers/AuthProvider";
import LiveChatWidget from "@/components/chat/LiveChatWidget";

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthProvider>
      <JsonLdLocalBusiness />
      <Header />
      <main className="min-h-screen">{children}</main>
      <Footer />
      <LiveChatWidget />
    </AuthProvider>
  );
}
