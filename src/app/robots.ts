import { MetadataRoute } from 'next';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://colchiscreamery.com';

/**
 * Dynamic robots.txt
 * 
 * Advantages over static public/robots.txt:
 * - Can read from SiteConfig DB for admin control
 * - Environment-aware (e.g. block staging)
 * - Co-located with sitemap.ts
 */
export default function robots(): MetadataRoute.Robots {
    const isProduction = process.env.NODE_ENV === 'production';

    // Block everything in non-production (dev, preview, staging)
    if (!isProduction) {
        return {
            rules: [{ userAgent: '*', disallow: '/' }],
            sitemap: `${SITE_URL}/sitemap.xml`,
        };
    }

    return {
        rules: [
            {
                userAgent: '*',
                allow: '/',
                disallow: [
                    // API & internal routes
                    '/api/',
                    '/admin/',
                    '/staff-portal/',
                    '/cart',
                    '/checkout',
                    // Auth pages (all locales) — should never be indexed
                    '/login',
                    '/register',
                    '/verify-email',
                    '/staff',
                    '/b2b/login',
                    '/b2b/register',
                    '/forgot-password',
                    '/*/login',
                    '/*/register',
                    '/*/verify-email',
                    '/*/staff',
                    '/*/b2b/login',
                    '/*/b2b/register',
                    '/*/forgot-password',
                    '/*/admin/',
                    '/*/staff-portal/',
                    '/*/account/',
                    '/*/b2b-portal/',
                    // Static assets that Google shouldn't index
                    '/_next/static/media/',
                    // Cloudflare artifacts
                    '/cdn-cgi/',
                ],
            },
            // AI / LLM crawlers — explicitly allowed for public content
            { userAgent: 'GPTBot', allow: '/' },
            { userAgent: 'ClaudeBot', allow: '/' },
            { userAgent: 'Google-Extended', allow: '/' },
            { userAgent: 'Bingbot', allow: '/' },
        ],
        sitemap: `${SITE_URL}/sitemap.xml`,
    };
}
