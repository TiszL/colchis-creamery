'use server';

import { prisma } from '@/lib/db';
import { getSession } from '@/lib/session';
import { revalidatePath } from 'next/cache';

// Resolve the calling partner (live session check + ownership). Throws if the
// caller isn't a B2B partner with an initialized profile.
async function callerPartner() {
    const session = await getSession();
    if (!session || (session.role !== 'B2B_PARTNER' && session.role !== 'MASTER_ADMIN')) {
        throw new Error('Unauthorized');
    }
    const partner = await prisma.b2bPartner.findUnique({ where: { userId: session.userId } });
    if (!partner) throw new Error('Partner profile not initialized — place your first net-terms order first.');
    return { session, partner };
}

export async function updatePartnerProfileAction(formData: FormData): Promise<{ ok: boolean; error?: string }> {
    try {
        const { session, partner } = await callerPartner();
        const companyName = (formData.get('companyName') as string)?.trim();
        if (!companyName) return { ok: false, error: 'Company name is required.' };

        const defaultFulfillmentLocationId = (formData.get('defaultFulfillmentLocationId') as string) || null;
        if (defaultFulfillmentLocationId) {
            const loc = await prisma.location.findUnique({ where: { id: defaultFulfillmentLocationId }, select: { id: true } });
            if (!loc) return { ok: false, error: 'Selected fulfillment location does not exist.' };
        }
        const phone = (formData.get('phone') as string)?.trim() || null;

        try {
            await prisma.$transaction([
                prisma.b2bPartner.update({
                    where: { id: partner.id },
                    data: {
                        companyName,
                        businessAddress: (formData.get('businessAddress') as string)?.trim() || null,
                        ein: (formData.get('ein') as string)?.trim() || null,
                        defaultFulfillmentLocationId,
                    },
                }),
                prisma.user.update({ where: { id: session.userId }, data: { phone, companyName } }),
            ]);
        } catch (e) {
            if ((e as { code?: string })?.code === 'P2002') {
                return { ok: false, error: 'That phone number is already in use by another account.' };
            }
            throw e;
        }

        revalidatePath('/[locale]/b2b-portal/account', 'page');
        return { ok: true };
    } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : 'Failed to update profile.' };
    }
}

// Partner submits/updates their resale certificate. taxExempt itself stays
// admin-controlled (staff verifies the cert before granting the exemption) —
// the partner provides the document so staff can approve it.
export async function submitResaleCertAction(formData: FormData): Promise<{ ok: boolean; error?: string }> {
    try {
        const { partner } = await callerPartner();
        const expiresRaw = (formData.get('resaleCertificateExpiresAt') as string)?.trim();
        await prisma.b2bPartner.update({
            where: { id: partner.id },
            data: {
                resaleCertificateNumber: (formData.get('resaleCertificateNumber') as string)?.trim() || null,
                resaleCertificateState: (formData.get('resaleCertificateState') as string)?.trim().toUpperCase() || null,
                resaleCertificateExpiresAt: expiresRaw ? new Date(expiresRaw) : null,
                resaleCertificateUrl: (formData.get('resaleCertificateUrl') as string)?.trim() || null,
            },
        });
        revalidatePath('/[locale]/b2b-portal/account', 'page');
        return { ok: true };
    } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : 'Failed to submit certificate.' };
    }
}
