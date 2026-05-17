// Phase E1.5 — RSS 2.0 feed for the Journal.
//
// Helps blog aggregators (Feedly, Inoreader, NewsBlur) and some AI tools
// (perplexity, etc.) discover new articles without scraping. Discoverable via
// the `<link rel="alternate" type="application/rss+xml">` tag we add to the
// journal page metadata in a later sub-task.
//
// Spec: https://www.rssboard.org/rss-specification

import { prisma } from '@/lib/db';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://colchisfood.com';
const FEED_TITLE = 'Colchis Food · Journal';
const FEED_DESCRIPTION =
    'Stories on Georgian heritage, A2 dairy, sulguni cheesemaking, and our craft from Dublin, Ohio.';

export const revalidate = 1800; // refresh every 30 minutes — articles aren't real-time

export async function GET() {
    const articles = await prisma.article.findMany({
        where: { isPublished: true },
        orderBy: { publishedAt: 'desc' },
        take: 50,
        select: {
            slug: true,
            title: true,
            excerpt: true,
            coverImage: true,
            publishedAt: true,
            updatedAt: true,
        },
    });

    const lastBuild = articles[0]?.updatedAt ?? new Date();

    const items = articles
        .map((a) => {
            const link = `${SITE_URL}/journal/${a.slug}`;
            const pub = a.publishedAt ?? a.updatedAt;
            return `    <item>
      <title>${esc(a.title)}</title>
      <link>${link}</link>
      <guid isPermaLink="true">${link}</guid>
      <pubDate>${pub.toUTCString()}</pubDate>
      ${a.excerpt ? `<description>${esc(a.excerpt)}</description>` : ''}
      ${a.coverImage ? `<enclosure url="${esc(a.coverImage)}" type="image/jpeg" />` : ''}
    </item>`;
        })
        .join('\n');

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${esc(FEED_TITLE)}</title>
    <link>${SITE_URL}/journal</link>
    <description>${esc(FEED_DESCRIPTION)}</description>
    <language>en-US</language>
    <lastBuildDate>${lastBuild.toUTCString()}</lastBuildDate>
    <atom:link href="${SITE_URL}/feed.xml" rel="self" type="application/rss+xml" />
${items}
  </channel>
</rss>`;

    return new Response(xml, {
        status: 200,
        headers: {
            'Content-Type': 'application/rss+xml; charset=utf-8',
            'Cache-Control': 'public, s-maxage=1800, stale-while-revalidate=86400',
        },
    });
}

/** XML-escape: ampersand first to avoid double-escaping; then angle brackets and quotes. */
function esc(s: string): string {
    return s
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}
