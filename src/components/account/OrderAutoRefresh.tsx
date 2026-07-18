'use client';

// Live order tracking — re-renders the server-rendered order page on an
// interval while the order is still moving. Paired with the after()-triggered
// courier poll in the order pages, this makes "on the way → delivered"
// advance on the customer's screen without a manual reload.

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function OrderAutoRefresh({ intervalMs = 30_000 }: { intervalMs?: number }) {
    const router = useRouter();
    useEffect(() => {
        const t = setInterval(() => {
            // Skip refreshes while the tab is hidden — resume on return.
            if (document.visibilityState === 'visible') router.refresh();
        }, intervalMs);
        return () => clearInterval(t);
    }, [router, intervalMs]);
    return null;
}
