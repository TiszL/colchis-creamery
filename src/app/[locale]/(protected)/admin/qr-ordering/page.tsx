// QR Table Ordering — master admin control center. One switch turns the whole
// feature on/off site-wide; per-location table counts drive which /table URLs
// are valid; the QR grid below is print-ready for the physical tables.
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/session';
import { prisma } from '@/lib/db';
import { getQrOrderingConfig, setQrOrderingConfig } from '@/lib/table-ordering';
import { revalidatePath } from 'next/cache';
import QRCode from 'qrcode';
import QrOrderingClient from '@/components/admin/QrOrderingClient';

export const dynamic = 'force-dynamic';

async function saveQrConfigAction(formData: FormData) {
    'use server';
    const session = await getSession();
    if (!session || session.role !== 'MASTER_ADMIN') throw new Error('Not authorized');
    const enabled = formData.get('enabled') === 'on';
    const tablesByLocation: Record<string, number> = {};
    for (const [key, value] of formData.entries()) {
        if (!key.startsWith('tables-')) continue;
        const locationId = key.slice('tables-'.length);
        const n = parseInt((value as string) || '0', 10);
        if (Number.isFinite(n) && n > 0 && n <= 200) tablesByLocation[locationId] = n;
    }
    await setQrOrderingConfig({ enabled, tablesByLocation });
    revalidatePath('/[locale]/admin/qr-ordering', 'page');
}

export default async function QrOrderingAdminPage({ params }: { params: Promise<{ locale: string }> }) {
    const { locale } = await params;
    const session = await getSession();
    if (!session || session.role !== 'MASTER_ADMIN') redirect(`/${locale}/portal-login`);

    const [config, locations] = await Promise.all([
        getQrOrderingConfig(),
        prisma.location.findMany({
            where: { isActive: true },
            orderBy: { name: 'asc' },
            select: {
                id: true, name: true,
                channels: { where: { deliveryMethod: 'IN_STORE_DINE_IN', isActive: true }, select: { id: true } },
            },
        }),
    ]);
    const dineInLocations = locations.map(l => ({
        id: l.id,
        name: l.name,
        dineInEnabled: l.channels.length > 0,
        tables: config.tablesByLocation[l.id] ?? 0,
    }));

    // Pre-render QR SVGs server-side (data URLs) for every configured table.
    const site = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
    const qrByLocation: Record<string, { table: number; url: string; svg: string }[]> = {};
    for (const loc of dineInLocations) {
        if (!loc.dineInEnabled || loc.tables <= 0) continue;
        const list: { table: number; url: string; svg: string }[] = [];
        for (let t = 1; t <= loc.tables; t++) {
            const url = `${site}/table/${loc.id}/${t}`;
            const svg = await QRCode.toString(url, { type: 'svg', margin: 1, width: 220, color: { dark: '#1F3026', light: '#F5F0E6' } });
            list.push({ table: t, url, svg });
        }
        qrByLocation[loc.id] = list;
    }

    return (
        <QrOrderingClient
            enabled={config.enabled}
            locations={dineInLocations}
            qrByLocation={qrByLocation}
            saveAction={saveQrConfigAction}
        />
    );
}
