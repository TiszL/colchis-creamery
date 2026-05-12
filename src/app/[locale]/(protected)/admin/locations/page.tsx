import { prisma } from '@/lib/db';
import { getSession } from '@/lib/session';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import LocationsClient from '@/components/admin/LocationsClient';
import { LocationType, FulfillmentChannel } from '@prisma/client';

export const dynamic = 'force-dynamic';

const LOCATION_TYPES = Object.values(LocationType);
const FULFILLMENT_CHANNELS = Object.values(FulfillmentChannel);

async function saveLocationAction(formData: FormData) {
    'use server';

    const id = (formData.get('id') as string) || '';
    const type = formData.get('type') as LocationType;
    const channelsRaw = formData.get('channelsJson') as string;
    const hoursRaw = ((formData.get('hoursJson') as string) || '').trim();

    let hours: Record<string, string> | undefined = undefined;
    if (hoursRaw) {
        try { hours = JSON.parse(hoursRaw) as Record<string, string>; }
        catch { hours = undefined; } // silently skip malformed JSON; admin will see hours unchanged
    }

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
                channel: FulfillmentChannel;
                enabled: boolean;
                radiusMiles: number | null;
                maxDriveHours: number | null;
                flatFee: string | null;
                perMileFee: string | null;
                priceMultiplier: number;
            }> = JSON.parse(channelsRaw);

            for (const c of channels) {
                if (c.enabled) {
                    await prisma.locationChannel.upsert({
                        where: { locationId_channel: { locationId, channel: c.channel } },
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
                            channel: c.channel,
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
                    await prisma.locationChannel.deleteMany({
                        where: { locationId, channel: c.channel },
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
    const id = formData.get('id') as string;
    const isActive = formData.get('isActive') === 'true';
    if (!id) return;
    await prisma.location.update({ where: { id }, data: { isActive } });
    revalidatePath('/admin/locations');
}

export default async function AdminLocationsPage({ params }: { params: Promise<{ locale: string }> }) {
    const { locale } = await params;
    const session = await getSession();
    if (!session || session.role !== 'MASTER_ADMIN') redirect(`/${locale}/portal-login`);

    const locations = await prisma.location.findMany({
        orderBy: [{ type: 'asc' }, { name: 'asc' }],
        include: {
            channels: { orderBy: { channel: 'asc' } },
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
        stockCount: l._count.stocks,
        fulfillmentCount: l._count.fulfillments,
        channels: l.channels.map(c => ({
            channel: c.channel,
            radiusMiles: c.radiusMiles,
            maxDriveHours: c.maxDriveHours,
            flatFee: c.flatFee,
            perMileFee: c.perMileFee,
            priceMultiplier: c.priceMultiplier,
            isActive: c.isActive,
        })),
    }));

    return (
        <LocationsClient
            locations={serialized}
            locationTypes={LOCATION_TYPES}
            fulfillmentChannels={FULFILLMENT_CHANNELS}
            apiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY || ''}
            locale={locale}
            saveAction={saveLocationAction}
            deleteAction={deleteLocationAction}
            toggleActiveAction={toggleActiveAction}
        />
    );
}
