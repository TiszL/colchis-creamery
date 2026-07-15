// Product image helpers. The upload API generates a 200×200 webp thumbnail
// named `${base}-thumb.webp` next to every uploaded .webp (see
// src/app/api/upload/route.ts). Legacy non-webp images have no thumb — the
// original URL is returned and renders fine at thumbnail size.
//
// Consumers should still attach an onError fallback: pre-thumb-era .webp
// uploads may lack the -thumb file (404), in which case retry the full URL.
export function getThumbUrl(url: string): string {
    if (url && url.endsWith('.webp')) return url.replace(/\.webp$/, '-thumb.webp');
    return url;
}
