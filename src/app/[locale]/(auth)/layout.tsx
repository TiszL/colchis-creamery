import type { Metadata } from "next";

/**
 * Auth layout — tells search engines NOT to index login/register/verify pages.
 * Prevents "Duplicate without user-selected canonical" errors in Google Search Console
 * for /es/login, /ka/login, /ru/login etc.
 */
export const metadata: Metadata = {
    robots: {
        index: false,
        follow: false,
        nocache: true,
        googleBot: {
            index: false,
            follow: false,
        },
    },
};

export default function AuthLayout({ children }: { children: React.ReactNode }) {
    return <>{children}</>;
}
