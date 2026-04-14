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

    return {
        rules: [
            {
                userAgent: '*',
                allow: '/',
                disallow: ['/api/', '/admin/', '/staff-portal/', '/login', '/register', '/cart', '/checkout', '/verify-email'],
            },
            // AI / LLM crawlers — explicitly allowed
            { userAgent: 'GPTBot', allow: '/' },
            { userAgent: 'ClaudeBot', allow: '/' },
            { userAgent: 'Google-Extended', allow: '/' },
            { userAgent: 'Bingbot', allow: '/' },
        ],
        sitemap: `${SITE_URL}/sitemap.xml`,
        ...(isProduction ? {} : {
            // Block everything in non-production
            rules: [{ userAgent: '*', disallow: '/' }],
        }),
    };
}
