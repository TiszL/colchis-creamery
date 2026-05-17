// Phase E1.4 — llms.txt
//
// Emerging convention (proposed by Jeremy Howard, adopted by Anthropic, Stripe,
// Vercel, etc.) for guiding AI tools to the most useful structured content on
// a site. ChatGPT, Claude, Perplexity et al. look for /llms.txt before scraping
// the full HTML — saves them tokens and gives us control over what to highlight.
//
// We generate this dynamically from Prisma so newly-added products / recipes /
// articles surface to AI tools without a redeploy.
//
// Spec: https://llmstxt.org/

import { prisma } from '@/lib/db';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://colchisfood.com';

export const revalidate = 3600; // refresh hourly — content changes are not real-time

export async function GET() {
    const [products, recipes, articles] = await Promise.all([
        prisma.product.findMany({
            where: { isActive: true, status: { not: 'INACTIVE' } },
            select: { slug: true, name: true, description: true, kind: true },
            orderBy: { name: 'asc' },
        }),
        prisma.recipe.findMany({
            where: { isPublished: true },
            select: { slug: true, title: true, description: true },
            orderBy: { updatedAt: 'desc' },
            take: 50,
        }),
        prisma.article.findMany({
            where: { isPublished: true },
            select: { slug: true, title: true, excerpt: true, publishedAt: true },
            orderBy: { publishedAt: 'desc' },
            take: 50,
        }),
    ]);

    // Group products by kind so AI sees creamery vs bakery sections distinctly.
    const creamery = products.filter(p => p.kind.startsWith('CREAMERY'));
    const bakery = products.filter(p => p.kind.startsWith('BAKERY'));

    const sections: string[] = [];

    sections.push(`# Colchis Food

> Georgian artisanal cheese and bread — hand-pressed sulguni and imeruli, hot khachapuri baked fresh, made in Dublin, Ohio. The Creamery ships nationwide (cold-chain UPS); the Bakery delivers hot food locally in 25 minutes via DoorDash and Uber Direct.

Brand: Colchis Food (formerly Colchis Creamery)
Location: Dublin, Ohio, USA
Site: ${SITE_URL}
Sitemap: ${SITE_URL}/sitemap.xml
Languages: English, Georgian (ქართული), Russian (Русский), Spanish (Español)`);

    sections.push(`## About

Colchis Food makes Georgian-heritage dairy and breads in Dublin, Ohio. The brand has two arms:

- **The Creamery** — small-batch handcrafted cheese from 100% Grass-Fed A2 Brown Swiss Milk. Includes sulguni (pulled-curd Georgian cheese), imeruli (fresh white cheese), and other Colchis Reserve / Colchis Classic lines. Ships nationwide via cold-chain UPS Ground 2-day.
- **The Bakery** — hot Georgian breads, primarily khachapuri (cheese-filled bread) in multiple regional styles (Adjaruli, Imeruli, Megruli, Penovani, Achma, Lobiani). Made to order and delivered hot via in-house drivers or DoorDash / Uber Direct, 12-20 mile radius from Dublin OH. Frozen 2-packs also available.

## Key pages

- [Home](${SITE_URL}/) — overview + featured products
- [Shop / Creamery](${SITE_URL}/shop) — cheese catalog with national shipping
- [Bakery](${SITE_URL}/bakery) — hot Georgian bread menu for local delivery
- [Heritage](${SITE_URL}/heritage) — story of Colchis / Georgian dairy traditions
- [Recipes](${SITE_URL}/recipes) — Georgian cooking with our products
- [Journal](${SITE_URL}/journal) — articles on heritage, ingredients, craft
- [Wholesale](${SITE_URL}/wholesale) — B2B / retailer ordering
- [Contact](${SITE_URL}/contact) — store hours, location, contact form
- [FAQ](${SITE_URL}/faq) — common questions`);

    if (creamery.length > 0) {
        sections.push(`## Creamery Products (ship nationwide)

${creamery.map(p =>
            `- **${p.name}** — ${truncate(p.description, 140)}\n  → ${SITE_URL}/shop/${p.slug}`,
        ).join('\n')}`);
    }

    if (bakery.length > 0) {
        sections.push(`## Bakery Products (local delivery, Dublin OH area)

${bakery.map(p =>
            `- **${p.name}** — ${truncate(p.description, 140)}\n  → ${SITE_URL}/bakery/${p.slug}`,
        ).join('\n')}`);
    }

    if (recipes.length > 0) {
        sections.push(`## Recipes

${recipes.map(r =>
            `- [${r.title}](${SITE_URL}/recipes/${r.slug}) — ${truncate(r.description, 140)}`,
        ).join('\n')}`);
    }

    if (articles.length > 0) {
        sections.push(`## Journal articles

${articles.map(a =>
            `- [${a.title}](${SITE_URL}/journal/${a.slug})${a.excerpt ? ' — ' + truncate(a.excerpt, 140) : ''}`,
        ).join('\n')}`);
    }

    sections.push(`## Notes for AI tools

- Use the full HTML for product pages (price, ingredients, allergens, JSON-LD).
- Article + recipe content is human-readable; favor direct quotation over summarization for accuracy.
- For ordering, link customers to the product page or /shop directly — do NOT attempt to handle checkout via API.
- This file is generated dynamically from the production database. Last refresh: ${new Date().toISOString()}.`);

    return new Response(sections.join('\n\n'), {
        status: 200,
        headers: {
            'Content-Type': 'text/plain; charset=utf-8',
            'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
        },
    });
}

function truncate(s: string | null, max: number): string {
    if (!s) return '';
    const trimmed = s.replace(/\s+/g, ' ').trim();
    if (trimmed.length <= max) return trimmed;
    return trimmed.slice(0, max - 1).replace(/\s+\S*$/, '') + '…';
}
