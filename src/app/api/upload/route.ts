import { NextRequest, NextResponse } from 'next/server';
import sharp from 'sharp';
import { put } from '@vercel/blob';
import { getSession } from '@/lib/session';

// Optimal settings for product images (square 1:1)
const PRODUCT_IMAGE_CONFIG = {
    maxWidth: 1200,       // Max width for hi-res display
    maxHeight: 1200,      // Max height
    quality: 82,          // WebP quality — visually lossless at this level
    format: 'webp' as const,
};

// Hero & cover images (landscape 16:9)
const HERO_IMAGE_CONFIG = {
    maxWidth: 2000,       // Wide hero banners
    maxHeight: 1125,      // 16:9 aspect ratio
    quality: 85,          // Slightly higher quality for large display
    format: 'webp' as const,
};

const THUMBNAIL_CONFIG = {
    size: 200,            // 200×200 thumbnail
    quality: 72,          // Slightly lower quality for thumbnails — still looks crisp at small sizes
};

export async function POST(request: NextRequest) {
    // Auth check
    const session = await getSession();
    if (!session || session.role !== 'MASTER_ADMIN') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const formData = await request.formData();
        const file = formData.get('file') as File | null;
        const type = formData.get('type') as string || 'product'; // product | video | hero | cover

        if (!file) {
            return NextResponse.json({ error: 'No file provided' }, { status: 400 });
        }

        // Validate file type
        const allowedImageTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/gif', 'image/tiff'];
        const allowedVideoTypes = ['video/mp4', 'video/webm', 'video/quicktime'];
        const isImage = allowedImageTypes.includes(file.type);
        const isVideo = allowedVideoTypes.includes(file.type);

        if (!isImage && !isVideo) {
            return NextResponse.json({
                error: `Unsupported file type: ${file.type}. Allowed: JPEG, PNG, WebP, AVIF, MP4, WebM`
            }, { status: 400 });
        }

        // Max file sizes: 15MB images, 100MB videos
        const maxSize = isImage ? 15 * 1024 * 1024 : 100 * 1024 * 1024;
        if (file.size > maxSize) {
            return NextResponse.json({
                error: `File too large. Max: ${isImage ? '15MB' : '100MB'}`
            }, { status: 400 });
        }

        const buffer = Buffer.from(await file.arrayBuffer());
        const timestamp = Date.now();
        const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, '-').replace(/\.+/g, '.').toLowerCase();

        if (isImage) {
            // ─── IMAGE OPTIMIZATION WITH SHARP ───
            const image = sharp(buffer);
            const metadata = await image.metadata();

            // Select config based on upload type
            const isHero = type === 'hero' || type === 'cover';
            const config = isHero ? HERO_IMAGE_CONFIG : PRODUCT_IMAGE_CONFIG;
            const subDir = isHero ? 'hero' : 'products';

            // ── Full-size output ──
            let pipeline = sharp(buffer); // fresh pipeline (sharp is single-consume)

            // Resize if larger than max dimensions (maintain aspect ratio)
            if ((metadata.width && metadata.width > config.maxWidth) ||
                (metadata.height && metadata.height > config.maxHeight)) {
                pipeline = pipeline.resize(config.maxWidth, config.maxHeight, {
                    fit: 'inside',
                    withoutEnlargement: true,
                });
            }

            // Convert to WebP with optimal quality
            const optimized = await pipeline
                .webp({ quality: config.quality, effort: 6 })
                .toBuffer();

            // ── Thumbnail output ──
            const thumbnail = await sharp(buffer)
                .resize(THUMBNAIL_CONFIG.size, THUMBNAIL_CONFIG.size, {
                    fit: 'cover',
                    position: 'centre',
                })
                .webp({ quality: THUMBNAIL_CONFIG.quality, effort: 4 })
                .toBuffer();

            // Generate output filenames
            const baseName = `${timestamp}-${safeName.replace(/\.[^.]+$/, '')}`;
            const outputName = `${baseName}.webp`;
            const thumbName = `${baseName}-thumb.webp`;

            // Upload both files to Vercel Blob
            const [mainBlob, thumbBlob] = await Promise.all([
                put(`${subDir}/${outputName}`, optimized, {
                    access: 'public',
                    contentType: 'image/webp',
                }),
                put(`${subDir}/${thumbName}`, thumbnail, {
                    access: 'public',
                    contentType: 'image/webp',
                }),
            ]);

            // Calculate compression stats
            const originalKB = (buffer.length / 1024).toFixed(1);
            const optimizedKB = (optimized.length / 1024).toFixed(1);
            const thumbKB = (thumbnail.length / 1024).toFixed(1);
            const savings = ((1 - optimized.length / buffer.length) * 100).toFixed(0);

            return NextResponse.json({
                url: mainBlob.url,
                thumbUrl: thumbBlob.url,
                originalSize: `${originalKB} KB`,
                optimizedSize: `${optimizedKB} KB`,
                thumbSize: `${thumbKB} KB`,
                savings: `${savings}%`,
                width: metadata.width,
                height: metadata.height,
                format: 'webp',
            });
        } else {
            // ─── VIDEO — upload as-is to Vercel Blob ───
            const outputName = `${timestamp}-${safeName}`;

            const videoBlob = await put(`videos/${outputName}`, buffer, {
                access: 'public',
                contentType: file.type,
            });

            return NextResponse.json({
                url: videoBlob.url,
                originalSize: `${(file.size / 1024 / 1024).toFixed(1)} MB`,
                format: file.type,
            });
        }
    } catch (err: any) {
        console.error('Upload error:', err);
        return NextResponse.json({ error: err.message || 'Upload failed' }, { status: 500 });
    }
}
