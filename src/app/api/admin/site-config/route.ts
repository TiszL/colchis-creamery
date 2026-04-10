import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/session';
import { revalidatePath } from 'next/cache';

export async function POST(request: NextRequest) {
    const session = await getSession();
    if (!session || session.role !== 'MASTER_ADMIN') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const formData = await request.formData();
        const entries = formData.get('entries') as string;

        if (!entries) {
            return NextResponse.json({ error: 'No entries provided' }, { status: 400 });
        }

        const parsed: { key: string; value: string }[] = JSON.parse(entries);

        for (const { key, value } of parsed) {
            await prisma.siteConfig.upsert({
                where: { key },
                update: { value: value || '' },
                create: { key, value: value || '' },
            });
        }

        revalidatePath('/');
        revalidatePath('/admin/website');
        return NextResponse.json({ success: true });
    } catch (err: any) {
        console.error('Site config save error:', err);
        return NextResponse.json({ error: err.message || 'Save failed' }, { status: 500 });
    }
}
