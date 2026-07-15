import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Wholesale",
  description: "Stock the only Georgian cheese made in the Midwest. Restaurant, grocery, and hospitality partnerships.",
};

export default function WholesaleLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
