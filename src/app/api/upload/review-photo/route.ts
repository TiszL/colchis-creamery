import { NextRequest, NextResponse } from 'next/server';
import sharp from 'sharp';
import { put } from '@vercel/blob';
import { getSession } from '@/lib/session';

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const MAX_WIDTH = 800;
const QUALITY = 78;

export async function POST(request: NextRequest) {
    const session = await getSession();
    if (!session) {
        return NextResponse.json({ error: 'You must be logged in to upload photos.' }, { status: 401 });
    }

    try {
        const formData = await request.formData();
        const file = formData.get('file') as File | null;

        if (!file) {
            return NextResponse.json({ error: 'No file provided' }, { status: 400 });
        }

        const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'];
        if (!allowedTypes.includes(file.type)) {
            return NextResponse.json({ error: 'Only JPEG, PNG, WebP, AVIF images allowed.' }, { status: 400 });
        }

        if (file.size > MAX_FILE_SIZE) {
            return NextResponse.json({ error: 'Photo must be under 5MB.' }, { status: 400 });
        }

        const buffer = Buffer.from(await file.arrayBuffer());
        const timestamp = Date.now();

        // Optimize: resize to max 800px wide, convert to WebP
        const metadata = await sharp(buffer).metadata();
        let pipeline = sharp(buffer);

        if (metadata.width && metadata.width > MAX_WIDTH) {
            pipeline = pipeline.resize(MAX_WIDTH, undefined, {
                fit: 'inside',
                withoutEnlargement: true,
            });
        }

        const optimized = await pipeline
            .webp({ quality: QUALITY, effort: 4 })
            .toBuffer();

        const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, '-').toLowerCase();
        const outputName = `${timestamp}-${safeName.replace(/\.[^.]+$/, '')}.webp`;

        const blob = await put(`reviews/${outputName}`, optimized, {
            access: 'public',
            contentType: 'image/webp',
        });

        return NextResponse.json({
            url: blob.url,
            size: `${(optimized.length / 1024).toFixed(1)} KB`,
        });
    } catch (err: any) {
        console.error('Review photo upload error:', err);
        return NextResponse.json({ error: err.message || 'Upload failed' }, { status: 500 });
    }
}
