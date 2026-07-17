// QR table ordering — the page a printed table QR opens. Deliberately lean:
// no site header/location picker (the QR already pins the location), just the
// dine-in menu, an inline cart, and Stripe-hosted payment.
import { prisma } from '@/lib/db';
import { validateTable } from '@/lib/table-ordering';
import { sellableStockWhere } from '@/lib/stock-availability';
import { isOpenNow } from '@/lib/location-hours';
import TableOrderClient, { type TableMenuItem } from '@/components/table/TableOrderClient';
import { ColchisSeal } from '@/components/brand/ColchisSeal';
import Link from 'next/link';
import type { Metadata } from 'next';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
    title: 'Order at your table',
    robots: { index: false, follow: false }, // table URLs are for printed QRs, not search
};

export default async function TablePage({
    params,
}: {
    params: Promise<{ locale: string; locationId: string; table: string }>;
}) {
    const { locale, locationId, table: tableRaw } = await params;
    const table = parseInt(tableRaw, 10);
    const valid = Number.isInteger(table) ? await validateTable(locationId, table) : { ok: false as const, reason: 'unknown_table' as const };

    const Shell = ({ children }: { children: React.ReactNode }) => (
        <main style={{ background: '#F5F0E6', minHeight: '100vh' }}>
            <header style={{ background: '#1F3026', color: '#F5F0E6', padding: '20px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <ColchisSeal size={44} />
                    <div>
                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.28em', textTransform: 'uppercase', color: '#D9A876' }}>Colchis Food</div>
                        <div style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontSize: 18 }}>Cafe &amp; Bakery</div>
                    </div>
                </div>
                {valid.ok && (
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, letterSpacing: '0.24em', textTransform: 'uppercase', padding: '10px 16px', border: '1px solid #D9A87666', color: '#D9A876' }}>
                        Table {table}
                    </div>
                )}
            </header>
            {children}
        </main>
    );

    if (!valid.ok) {
        return (
            <Shell>
                <div style={{ maxWidth: 560, margin: '0 auto', padding: '80px 24px', textAlign: 'center' }}>
                    <div style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontSize: 32, color: '#1F3026' }}>
                        Table ordering is taking a break.
                    </div>
                    <p style={{ fontFamily: 'var(--font-sans)', fontSize: 15, color: '#2C3D33', marginTop: 16, lineHeight: 1.6 }}>
                        Please order at the counter — we&apos;ll be happy to help. You can also browse the full menu online.
                    </p>
                    <Link href={`/${locale === 'en' ? '' : locale}/bakery`.replace('//', '/')} style={{ display: 'inline-block', marginTop: 24, background: '#1F3026', color: '#F5F0E6', fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.24em', textTransform: 'uppercase', textDecoration: 'none', padding: '14px 28px' }}>
                        View the menu →
                    </Link>
                </div>
            </Shell>
        );
    }

    const open = isOpenNow(valid.location.hours);

    // Dine-in menu: everything genuinely sellable at THIS location, grouped by
    // category in sortOrder — same availability rules as the cafe menu.
    const products = await prisma.product.findMany({
        where: {
            isActive: true,
            isB2cVisible: true,
            isCartOrderable: true,
            status: 'ACTIVE',
            stocks: { some: { ...sellableStockWhere(), locationId } },
        },
        include: { productCategory: { select: { slug: true, name: true, sortOrder: true } } },
        orderBy: [{ productCategory: { sortOrder: 'asc' } }, { name: 'asc' }],
    });
    const items: TableMenuItem[] = products.map(p => ({
        id: p.id,
        name: p.name,
        ka: p.nameKa || '',
        desc: p.description,
        price: p.priceB2c,
        imageUrl: p.imageUrl || '',
        dietaryTags: p.dietaryTags,
        category: p.productCategory?.name ?? 'Menu',
    }));

    return (
        <Shell>
            <TableOrderClient
                locationId={locationId}
                table={table}
                locationName={valid.location.name}
                items={items}
                isOpen={open}
                locale={locale}
            />
        </Shell>
    );
}
