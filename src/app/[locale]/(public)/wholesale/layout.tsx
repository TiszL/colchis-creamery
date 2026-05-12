import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Wholesale | Colchis Food",
  description: "Stock the only Georgian cheese made in the Midwest. Restaurant, grocery, and private label partnerships.",
};

export default function WholesaleLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
