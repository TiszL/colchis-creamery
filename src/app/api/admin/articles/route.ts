import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/session';
import { revalidatePath } from 'next/cache';

export async function POST(request: NextRequest) {
    const session = await getSession();
    if (!session || session.role !== 'MASTER_ADMIN') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const isPublished = body.isPublished ?? false;

    const article = await prisma.article.create({
        data: {
            title: body.title,
            slug: body.slug,
            excerpt: body.excerpt || null,
            content: body.content || '',
            contentBlocks: body.contentBlocks || null,
            coverImage: body.coverImage || null,
            tags: body.tags || null,
            isPublished,
            publishedAt: isPublished ? new Date() : null,
        },
    });

    revalidatePath('/admin/website/articles');
    revalidatePath('/journal');
    return NextResponse.json({ id: article.id });
}

export async function PUT(request: NextRequest) {
    const session = await getSession();
    if (!session || session.role !== 'MASTER_ADMIN') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    if (!body.id) return NextResponse.json({ error: 'ID required' }, { status: 400 });

    const existing = await prisma.article.findUnique({ where: { id: body.id } });
    const wasPublished = existing?.isPublished;
    const isNowPublished = body.isPublished ?? false;

    await prisma.article.update({
        where: { id: body.id },
        data: {
            title: body.title,
            slug: body.slug,
            excerpt: body.excerpt || null,
            content: body.content || '',
            contentBlocks: body.contentBlocks || null,
            coverImage: body.coverImage || null,
            tags: body.tags || null,
            isPublished: isNowPublished,
            publishedAt: !wasPublished && isNowPublished ? new Date() : existing?.publishedAt,
        },
    });

    revalidatePath('/admin/website/articles');
    revalidatePath('/journal');
    return NextResponse.json({ success: true });
}

export async function DELETE(request: NextRequest) {
    const session = await getSession();
    if (!session || session.role !== 'MASTER_ADMIN') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    if (!body.id) return NextResponse.json({ error: 'ID required' }, { status: 400 });

    await prisma.article.delete({ where: { id: body.id } });

    revalidatePath('/admin/website/articles');
    revalidatePath('/journal');
    return NextResponse.json({ success: true });
}
