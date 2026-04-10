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
    const recipe = await prisma.recipe.create({
        data: {
            title: body.title,
            slug: body.slug,
            description: body.description || '',
            content: body.content || '',
            contentBlocks: body.contentBlocks || null,
            prepTime: body.prepTime || null,
            cookTime: body.cookTime || null,
            servings: body.servings || null,
            difficulty: body.difficulty || null,
            imageUrl: body.imageUrl || null,
            isPublished: body.isPublished ?? true,
        },
    });

    revalidatePath('/admin/website/recipes');
    revalidatePath('/recipes');
    return NextResponse.json({ id: recipe.id });
}

export async function PUT(request: NextRequest) {
    const session = await getSession();
    if (!session || session.role !== 'MASTER_ADMIN') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    if (!body.id) return NextResponse.json({ error: 'ID required' }, { status: 400 });

    await prisma.recipe.update({
        where: { id: body.id },
        data: {
            title: body.title,
            slug: body.slug,
            description: body.description || '',
            content: body.content || '',
            contentBlocks: body.contentBlocks || null,
            prepTime: body.prepTime || null,
            cookTime: body.cookTime || null,
            servings: body.servings || null,
            difficulty: body.difficulty || null,
            imageUrl: body.imageUrl || null,
            isPublished: body.isPublished ?? true,
        },
    });

    revalidatePath('/admin/website/recipes');
    revalidatePath('/recipes');
    return NextResponse.json({ success: true });
}

export async function DELETE(request: NextRequest) {
    const session = await getSession();
    if (!session || session.role !== 'MASTER_ADMIN') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    if (!body.id) return NextResponse.json({ error: 'ID required' }, { status: 400 });

    await prisma.recipe.delete({ where: { id: body.id } });

    revalidatePath('/admin/website/recipes');
    revalidatePath('/recipes');
    return NextResponse.json({ success: true });
}
