import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  images: {
    formats: ["image/webp", "image/avif"],
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "**.unsplash.com" },
      { protocol: "https", hostname: "**.public.blob.vercel-storage.com" },
    ],
  },
  async redirects() {
    // Phase 10: /shop is now the unified all-products index. The dedicated
    // creamery shop moved to /creamery. Old /shop/<creamery-slug> URLs (which
    // were the creamery PDPs) 308 → /creamery/<slug> to preserve SEO.
    // Root /shop is the new page, not a redirect.
    // Locale prefixes covered by the :locale group.
    return [
      { source: '/shop/:slug', destination: '/creamery/:slug', permanent: true },
      { source: '/:locale(ka|ru|es)/shop/:slug', destination: '/:locale/creamery/:slug', permanent: true },
    ];
  },
};

export default withNextIntl(nextConfig);
