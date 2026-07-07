import { prisma } from '@/lib/db';
import { getSession } from '@/lib/session';
import { requireRole } from '@/lib/authz';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import LocationsClient from '@/components/admin/LocationsClient';
import { LocationType, DeliveryMethod, SalesChannel } from '@prisma/client';
import { LocationConnectPanel } from '@/components/admin/LocationConnectPanel';

export const dynamic = 'force-dynamic';

const LOCATION_TYPES = Object.values(LocationType);
const FULFILLMENT_CHANNELS = Object.values(DeliveryMethod);
const SALES_CHANNELS = Object.values(SalesChannel);

async function saveLocationAction(formData: FormData) {
    'use server';
    await requireRole(['MASTER_ADMIN']);

    const id = (formData.get('id') as string) || '';
    const type = formData.get('type') as LocationType;
    const channelsRaw = formData.get('channelsJson') as string;
    const allowsChannels = formData.getAll('allowsChannels[]').filter(v => !!v) as SalesChannel[];
    const hoursRaw = ((formData.get('hoursJson') as string) || '').trim();

    let hours: Record<string, string> | undefined = undefined;
    if (hoursRaw) {
        try { hours = JSON.parse(hoursRaw) as Record<string, string>; }
        catch { hours = undefined; } // silently skip malformed JSON; admin will see hours unchanged
    }

    // Kitchen dispatch settings — prep time is clamped server-side (client
    // validates too); notification email is optional, blank = fall back to
    // the global BAKERY_NOTIFICATION_EMAIL.
    const prepMinutesRaw = parseInt((formData.get('prepMinutes') as string) || '', 10);
    const prepMinutes = Number.isFinite(prepMinutesRaw) ? Math.min(120, Math.max(5, prepMinutesRaw)) : 25;
    const notificationEmail = ((formData.get('notificationEmail') as string) || '').trim() || null;

    const data = {
        name: formData.get('name') as string,
        type,
        addressLine1: formData.get('addressLine1') as string,
        addressLine2: (formData.get('addressLine2') as string) || null,
        city: formData.get('city') as string,
        state: formData.get('state') as string,
        postalCode: formData.get('postalCode') as string,
        country: (formData.get('country') as string) || 'US',
        latitude: formData.get('latitude') ? parseFloat(formData.get('latitude') as string) : null,
        longitude: formData.get('longitude') ? parseFloat(formData.get('longitude') as string) : null,
        googlePlaceId: (formData.get('googlePlaceId') as string) || null,
        phone: (formData.get('phone') as string) || null,
        hours,
        isActive: formData.get('isActive') === 'on',
        notes: (formData.get('notes') as string) || null,
        prepMinutes,
        notificationEmail,
        // Phase 10: display-layer fields. Drives every public address surface
        // (footer, homepage Visit, contact page) via getPrimaryLocation().
        // isPrimary is NOT set here — use setPrimaryLocationAction for atomic flip.
        showOnContactPage: formData.get('showOnContactPage') === 'on',
        displayDescription: (formData.get('displayDescription') as string) || null,
        displayBakeryHours: (formData.get('displayBakeryHours') as string) || null,
        contactCardName: (formData.get('contactCardName') as string) || null,
        contactCardDoorNote: (formData.get('contactCardDoorNote') as string) || null,
        // Phase 1 — SalesChannel allowlist. Empty array is a valid choice
        // (location intentionally inactive for catalog purposes).
        allowsChannels,
    };

    let locationId: string;
    if (id) {
        const updated = await prisma.location.update({ where: { id }, data });
        locationId = updated.id;
    } else {
        const created = await prisma.location.create({ data });
        locationId = created.id;
    }

    // Save channels: incoming JSON is [{ channel, enabled, radiusMiles, maxDriveHours, flatFee, perMileFee, priceMultiplier }]
    if (channelsRaw) {
        try {
            const channels: Array<{
                deliveryMethod: DeliveryMethod;
                enabled: boolean;
                radiusMiles: number | null;
                maxDriveHours: number | null;
                flatFee: string | null;
                perMileFee: string | null;
                priceMultiplier: number;
            }> = JSON.parse(channelsRaw);

            for (const c of channels) {
                if (c.enabled) {
                    await prisma.locationDeliveryMethod.upsert({
                        where: { locationId_deliveryMethod: { locationId, deliveryMethod: c.deliveryMethod } },
                        update: {
                            radiusMiles: c.radiusMiles,
                            maxDriveHours: c.maxDriveHours,
                            flatFee: c.flatFee,
                            perMileFee: c.perMileFee,
                            priceMultiplier: c.priceMultiplier,
                            isActive: true,
                        },
                        create: {
                            locationId,
                            deliveryMethod: c.deliveryMethod,
                            radiusMiles: c.radiusMiles,
                            maxDriveHours: c.maxDriveHours,
                            flatFee: c.flatFee,
                            perMileFee: c.perMileFee,
                            priceMultiplier: c.priceMultiplier,
                            isActive: true,
                        },
                    });
                } else {
                    // Disabled = delete the row so eligibility queries treat it as not offered
                    await prisma.locationDeliveryMethod.deleteMany({
                        where: { locationId, deliveryMethod: c.deliveryMethod },
                    });
                }
            }
        } catch (e) {
            console.error('saveLocationAction: failed to parse channelsJson', e);
        }
    }

    revalidatePath('/admin/locations');
}

async function deleteLocationAction(formData: FormData) {
    'use server';
    await requireRole(['MASTER_ADMIN']);
    const id = formData.get('id') as string;
    if (!id) return;

    // Refuse delete if location has Stock or OrderFulfillment rows — admin should deactivate instead.
    const stockCount = await prisma.stock.count({ where: { locationId: id } });
    const fulfillmentCount = await prisma.orderFulfillment.count({ where: { locationId: id } });
    if (stockCount > 0 || fulfillmentCount > 0) {
        throw new Error(`Cannot delete: location has ${stockCount} stock rows and ${fulfillmentCount} fulfillments. Deactivate it instead.`);
    }

    await prisma.location.delete({ where: { id } });
    revalidatePath('/admin/locations');
}

async function toggleActiveAction(formData: FormData) {
    'use server';
    await requireRole(['MASTER_ADMIN']);
    const id = formData.get('id') as string;
    const isActive = formData.get('isActive') === 'true';
    if (!id) return;
    await prisma.location.update({ where: { id }, data: { isActive } });
    revalidatePath('/admin/locations');
}

async function setPrimaryLocationAction(formData: FormData) {
    'use server';
    await requireRole(['MASTER_ADMIN']);
    const id = formData.get('id') as string;
    if (!id) return;

    // Atomic flip — invariant is exactly ONE row with isPrimary=true at a time.
    // Without the transaction a parallel save could leave us with 0 or 2 primaries.
    await prisma.$transaction(async tx => {
        await tx.location.updateMany({ where: { isPrimary: true }, data: { isPrimary: false } });
        await tx.location.update({ where: { id }, data: { isPrimary: true, isActive: true, showOnContactPage: true } });
    });

    // Public surfaces all read primary via getPrimaryLocation() — revalidate the
    // routes that depend on it so the address flips immediately, not on next nav.
    revalidatePath('/admin/locations');
    revalidatePath('/', 'layout');
}

async function moveLocationAction(formData: FormData) {
    'use server';
    await requireRole(['MASTER_ADMIN']);
    const id = formData.get('id') as string;
    const direction = formData.get('direction') as 'up' | 'down';
    if (!id) return;

    // Sort by current displayOrder + createdAt, find the target row's neighbor,
    // and swap their displayOrder values. Atomic so concurrent reorders don't
    // collide. Operates within the showOnContactPage cohort — that's what
    // /contact and the public surfaces use.
    await prisma.$transaction(async tx => {
        const all = await tx.location.findMany({
            where: { isActive: true, showOnContactPage: true },
            orderBy: [{ isPrimary: 'desc' }, { displayOrder: 'asc' }, { createdAt: 'asc' }],
        });
        const idx = all.findIndex(l => l.id === id);
        if (idx === -1) return;
        const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
        if (targetIdx < 0 || targetIdx >= all.length) return;
        const a = all[idx];
        const b = all[targetIdx];
        // Don't reorder across the primary boundary — primary is always first.
        if (a.isPrimary || b.isPrimary) return;
        await tx.location.update({ where: { id: a.id }, data: { displayOrder: b.displayOrder } });
        await tx.location.update({ where: { id: b.id }, data: { displayOrder: a.displayOrder } });
    });

    revalidatePath('/admin/locations');
    revalidatePath('/contact');
}

export default async function AdminLocationsPage({ params }: { params: Promise<{ locale: string }> }) {
    const { locale } = await params;
    const session = await getSession();
    if (!session || session.role !== 'MASTER_ADMIN') redirect(`/${locale}/portal-login`);

    const locations = await prisma.location.findMany({
        // Primary first, then by admin-chosen displayOrder, then by type+name
        orderBy: [{ isPrimary: 'desc' }, { displayOrder: 'asc' }, { type: 'asc' }, { name: 'asc' }],
        include: {
            channels: { orderBy: { deliveryMethod: 'asc' } },
            _count: { select: { stocks: true, fulfillments: true } },
        },
    });

    const serialized = locations.map(l => ({
        id: l.id,
        name: l.name,
        type: l.type,
        addressLine1: l.addressLine1,
        addressLine2: l.addressLine2,
        city: l.city,
        state: l.state,
        postalCode: l.postalCode,
        country: l.country,
        latitude: l.latitude,
        longitude: l.longitude,
        googlePlaceId: l.googlePlaceId,
        phone: l.phone,
        hours: l.hours,
        isActive: l.isActive,
        notes: l.notes,
        prepMinutes: l.prepMinutes,
        notificationEmail: l.notificationEmail,
        // Phase 10 display fields
        isPrimary: l.isPrimary,
        showOnContactPage: l.showOnContactPage,
        displayDescription: l.displayDescription,
        displayBakeryHours: l.displayBakeryHours,
        contactCardName: l.contactCardName,
        contactCardDoorNote: l.contactCardDoorNote,
        displayOrder: l.displayOrder,
        allowsChannels: l.allowsChannels,
        stockCount: l._count.stocks,
        fulfillmentCount: l._count.fulfillments,
        channels: l.channels.map(c => ({
            deliveryMethod: c.deliveryMethod,
            radiusMiles: c.radiusMiles,
            maxDriveHours: c.maxDriveHours,
            flatFee: c.flatFee,
            perMileFee: c.perMileFee,
            priceMultiplier: c.priceMultiplier,
            isActive: c.isActive,
        })),
    }));

    // Phase 4 (4e) — Connect status panel feeds off the same locations list.
    const connectRows = locations.map(l => ({
        id: l.id,
        name: l.name,
        city: l.city,
        state: l.state,
        stripeConnectAccountId: l.stripeConnectAccountId,
        stripeOnboardingStatus: l.stripeOnboardingStatus,
        stripeOnboardingUpdatedAt: l.stripeOnboardingUpdatedAt ? l.stripeOnboardingUpdatedAt.toISOString() : null,
    }));

    return (
        <>
            <LocationConnectPanel locations={connectRows} />
            <LocationsClient
                locations={serialized}
                locationTypes={LOCATION_TYPES}
                fulfillmentChannels={FULFILLMENT_CHANNELS}
                salesChannels={SALES_CHANNELS}
                apiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY || ''}
                locale={locale}
                saveAction={saveLocationAction}
                deleteAction={deleteLocationAction}
                toggleActiveAction={toggleActiveAction}
                setPrimaryAction={setPrimaryLocationAction}
                moveAction={moveLocationAction}
            />
        </>
    );
}
