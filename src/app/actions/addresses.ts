'use server';

import { prisma } from '@/lib/db';
import { getSession } from '@/lib/session';
import { revalidatePath } from 'next/cache';

export type UserAddressDto = {
    id: string;
    label: string | null;
    addressLine1: string;
    addressLine2: string | null;
    city: string;
    state: string;
    postalCode: string;
    country: string;
    latitude: number | null;
    longitude: number | null;
    googlePlaceId: string | null;
    isDefault: boolean;
    // Phase B: extended delivery details — fed to DD/Uber driver notes at dispatch.
    accessCode: string | null;
    buildingName: string | null;
    deliveryNotes: string | null;
};

/**
 * Returns the current user's saved addresses, or [] for guests.
 *
 * Migration: if the user has zero UserAddress rows BUT their legacy UserProfile has a
 * shippingAddress filled in, we transparently create one UserAddress entry from it.
 * Lat/lng will be null until the user re-enters via Places autocomplete.
 */
export async function getMyAddresses(): Promise<UserAddressDto[]> {
    const session = await getSession();
    if (!session?.userId) return [];

    let rows = await prisma.userAddress.findMany({
        where: { userId: session.userId },
        orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    });

    if (rows.length === 0) {
        // One-time backfill from legacy UserProfile shipping fields
        const profile = await prisma.userProfile.findUnique({ where: { userId: session.userId } });
        if (profile?.shippingAddress && profile.shippingCity && profile.shippingState && profile.shippingZip) {
            await prisma.userAddress.create({
                data: {
                    userId: session.userId,
                    label: 'Default',
                    addressLine1: profile.shippingAddress,
                    city: profile.shippingCity,
                    state: profile.shippingState,
                    postalCode: profile.shippingZip,
                    country: profile.shippingCountry || 'US',
                    isDefault: true,
                },
            });
            rows = await prisma.userAddress.findMany({
                where: { userId: session.userId },
                orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
            });
        }
    }

    return rows.map(r => ({
        id: r.id,
        label: r.label,
        addressLine1: r.addressLine1,
        addressLine2: r.addressLine2,
        city: r.city,
        state: r.state,
        postalCode: r.postalCode,
        country: r.country,
        latitude: r.latitude,
        longitude: r.longitude,
        googlePlaceId: r.googlePlaceId,
        isDefault: r.isDefault,
        accessCode: r.accessCode,
        buildingName: r.buildingName,
        deliveryNotes: r.deliveryNotes,
    }));
}

export type SaveAddressResult =
    | { ok: true; address: UserAddressDto }
    | { ok: false; error: string };

/** Create or update one of the current user's addresses. Login required. */
export async function saveMyAddress(formData: FormData): Promise<SaveAddressResult> {
    const session = await getSession();
    if (!session?.userId) return { ok: false, error: 'You must be signed in to save an address.' };

    const id = (formData.get('id') as string) || '';
    const data = {
        label: (formData.get('label') as string) || null,
        addressLine1: (formData.get('addressLine1') as string) || '',
        addressLine2: (formData.get('addressLine2') as string) || null,
        city: (formData.get('city') as string) || '',
        state: (formData.get('state') as string) || '',
        postalCode: (formData.get('postalCode') as string) || '',
        country: (formData.get('country') as string) || 'US',
        latitude: formData.get('latitude') ? parseFloat(formData.get('latitude') as string) : null,
        longitude: formData.get('longitude') ? parseFloat(formData.get('longitude') as string) : null,
        googlePlaceId: (formData.get('googlePlaceId') as string) || null,
        isDefault: formData.get('isDefault') === 'on',
        // Phase B fields — all optional
        accessCode:    (formData.get('accessCode') as string)?.trim()    || null,
        buildingName:  (formData.get('buildingName') as string)?.trim()  || null,
        deliveryNotes: (formData.get('deliveryNotes') as string)?.trim() || null,
    };

    // Validate. lat/lng is the actual key for delivery routing; without it we can't
    // determine reachability. Other fields are best-effort — surface specific errors
    // instead of silently returning null so the UI can guide the user.
    if (data.latitude === null || data.longitude === null || isNaN(data.latitude) || isNaN(data.longitude)) {
        return { ok: false, error: 'Address coordinates are missing. Pick a result from the search dropdown or drop a pin on the map.' };
    }
    if (!data.addressLine1) {
        return { ok: false, error: 'Street address is missing — pick a more specific result.' };
    }
    if (!data.city || !data.state) {
        return { ok: false, error: 'City and state are required — pick a more specific result.' };
    }
    // postalCode is "nice to have" — some rural pins / Places results legitimately lack it

    // Ownership guard: a forged `id` must never touch another user's row (IDOR).
    if (id) {
        const existing = await prisma.userAddress.findUnique({
            where: { id },
            select: { userId: true },
        });
        if (!existing || existing.userId !== session.userId) {
            return { ok: false, error: 'Address not found.' };
        }
    }

    // Atomic write: clear any other default + create/update in one transaction so
    // there's always exactly one default. On create, the auto-default flag is
    // computed from the in-transaction count so a first-address save can't race
    // with a concurrent one and leave two (or zero) defaults.
    const row = await prisma.$transaction(async (tx) => {
        if (id) {
            // Edit preserves the form's isDefault (the component keeps an existing
            // default flagged and never clears the only default), so clearing
            // others only when isDefault is set keeps the single-default invariant.
            if (data.isDefault) {
                await tx.userAddress.updateMany({
                    where: { userId: session.userId, isDefault: true, NOT: { id } },
                    data: { isDefault: false },
                });
            }
            return tx.userAddress.update({
                where: { id },
                data,
            });
        }
        // First address ever saved is auto-default.
        const count = await tx.userAddress.count({ where: { userId: session.userId } });
        const willDefault = data.isDefault || count === 0;
        if (willDefault) {
            await tx.userAddress.updateMany({
                where: { userId: session.userId, isDefault: true },
                data: { isDefault: false },
            });
        }
        return tx.userAddress.create({
            data: { ...data, userId: session.userId, isDefault: willDefault },
        });
    });

    // Revalidate every public surface that reads the user's saved addresses
    // server-side. /shop is the unified all-products index, /creamery is the
    // dedicated section page (Phase 2 rename), /cart + /checkout pick up
    // userAddresses for the address picker, /account renders the manager.
    revalidatePath('/bakery');
    revalidatePath('/shop');
    revalidatePath('/creamery');
    revalidatePath('/cart');
    revalidatePath('/checkout');
    revalidatePath('/account');

    return {
        ok: true,
        address: {
            id: row.id,
            label: row.label,
            addressLine1: row.addressLine1,
            addressLine2: row.addressLine2,
            city: row.city,
            state: row.state,
            postalCode: row.postalCode,
            country: row.country,
            latitude: row.latitude,
            longitude: row.longitude,
            googlePlaceId: row.googlePlaceId,
            isDefault: row.isDefault,
            accessCode: row.accessCode,
            buildingName: row.buildingName,
            deliveryNotes: row.deliveryNotes,
        },
    };
}

export async function deleteMyAddress(addressId: string): Promise<boolean> {
    const session = await getSession();
    if (!session?.userId || !addressId) return false;

    const row = await prisma.userAddress.findUnique({ where: { id: addressId } });
    if (!row || row.userId !== session.userId) return false;

    // Atomic: delete + promote-next in one transaction so we never sit in a state
    // where the deleted default is gone but no replacement has been chosen.
    await prisma.$transaction(async (tx) => {
        await tx.userAddress.delete({ where: { id: addressId } });

        // If we deleted the default, promote the most recent remaining row to default
        if (row.isDefault) {
            const next = await tx.userAddress.findFirst({
                where: { userId: session.userId },
                orderBy: { createdAt: 'desc' },
            });
            if (next) {
                await tx.userAddress.update({ where: { id: next.id }, data: { isDefault: true } });
            }
        }
    });

    // Revalidate every public surface that reads the user's saved addresses
    // server-side. /shop is the unified all-products index, /creamery is the
    // dedicated section page (Phase 2 rename), /cart + /checkout pick up
    // userAddresses for the address picker, /account renders the manager.
    revalidatePath('/bakery');
    revalidatePath('/shop');
    revalidatePath('/creamery');
    revalidatePath('/cart');
    revalidatePath('/checkout');
    revalidatePath('/account');
    return true;
}

export async function setDefaultAddress(addressId: string): Promise<boolean> {
    const session = await getSession();
    if (!session?.userId || !addressId) return false;

    const row = await prisma.userAddress.findUnique({ where: { id: addressId } });
    if (!row || row.userId !== session.userId) return false;

    // Atomic: clear every other default + set this one in a single transaction so
    // there's never a window with zero (or two) defaults.
    await prisma.$transaction([
        prisma.userAddress.updateMany({
            where: { userId: session.userId, isDefault: true, NOT: { id: addressId } },
            data: { isDefault: false },
        }),
        prisma.userAddress.update({ where: { id: addressId }, data: { isDefault: true } }),
    ]);

    // Revalidate every public surface that reads the user's saved addresses
    // server-side. /shop is the unified all-products index, /creamery is the
    // dedicated section page (Phase 2 rename), /cart + /checkout pick up
    // userAddresses for the address picker, /account renders the manager.
    revalidatePath('/bakery');
    revalidatePath('/shop');
    revalidatePath('/creamery');
    revalidatePath('/cart');
    revalidatePath('/checkout');
    revalidatePath('/account');
    return true;
}
