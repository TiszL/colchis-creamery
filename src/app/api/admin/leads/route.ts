import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/session';
import { revalidatePath } from 'next/cache';
import { sendB2bApprovalEmail, sendB2bRejectionEmail } from '@/lib/email';

export async function PUT(request: NextRequest) {
    const session = await getSession();
    if (!session || !['MASTER_ADMIN', 'SALES'].includes(session.role)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    if (!body.id || !body.status) {
        return NextResponse.json({ error: 'ID and status required' }, { status: 400 });
    }

    const validStatuses = ['NEW', 'CONTACTED', 'CONVERTED', 'REJECTED'];
    if (!validStatuses.includes(body.status)) {
        return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
    }

    // Fetch the lead for email/company info
    const lead = await prisma.b2bLead.findUnique({ where: { id: body.id } });
    if (!lead) {
        return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
    }

    // ── APPROVE: Generate access code + send email ───────────────────────────
    if (body.status === 'CONVERTED') {
        // Generate unique B2B access code
        const random = Math.random().toString(36).substring(2, 8).toUpperCase();
        const code = `COLCHIS-B2B-${random}`;

        // Create access code locked to the applicant's email
        await prisma.accessCode.create({
            data: {
                code,
                type: 'B2B',
                targetRole: 'B2B_PARTNER',
                email: lead.email,
                expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
            },
        });

        // Update lead status
        await prisma.b2bLead.update({
            where: { id: body.id },
            data: { status: 'CONVERTED' },
        });

        // Send approval email with access code
        const emailResult = await sendB2bApprovalEmail(
            lead.email,
            code,
            lead.companyName,
            lead.contactName
        );

        revalidatePath('/admin/requests');
        revalidatePath('/admin/access-codes');

        return NextResponse.json({
            success: true,
            accessCode: code,
            emailSent: emailResult.success,
        });
    }

    // ── REJECT: Send rejection email ─────────────────────────────────────────
    if (body.status === 'REJECTED') {
        await prisma.b2bLead.update({
            where: { id: body.id },
            data: { status: 'REJECTED' },
        });

        const emailResult = await sendB2bRejectionEmail(
            lead.email,
            lead.companyName,
            lead.contactName
        );

        revalidatePath('/admin/requests');

        return NextResponse.json({
            success: true,
            emailSent: emailResult.success,
        });
    }

    // ── Other status updates (NEW, CONTACTED) — no email ─────────────────────
    await prisma.b2bLead.update({
        where: { id: body.id },
        data: {
            status: body.status,
            assignedTo: body.assignedTo || undefined,
        },
    });

    revalidatePath('/admin/requests');
    return NextResponse.json({ success: true });
}
