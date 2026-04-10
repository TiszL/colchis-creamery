import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/session';
import { revalidatePath } from 'next/cache';

export async function PUT(request: NextRequest) {
    const session = await getSession();
    if (!session || session.role !== 'MASTER_ADMIN') {
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
