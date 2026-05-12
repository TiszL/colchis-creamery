import { getTranslations } from "next-intl/server";
import { getSession } from "@/lib/session";
import { getMyAddresses } from "@/app/actions/addresses";
import { prisma } from "@/lib/db";
import CheckoutClient from "@/components/checkout/CheckoutClient";

export const dynamic = 'force-dynamic';

interface CheckoutPageProps {
    params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: CheckoutPageProps) {
    const { locale } = await params;
    const t = await getTranslations({ locale, namespace: "checkout" });
    return {
        title: t("title"),
        robots: { index: false, follow: true },
    };
}

export default async function CheckoutPage({ params }: CheckoutPageProps) {
    const { locale } = await params;
    const session = await getSession();
    const isLoggedIn = !!session?.userId;

    const [userAddresses, locationsRaw, userProfile] = await Promise.all([
        isLoggedIn ? getMyAddresses() : Promise.resolve([]),
        prisma.location.findMany({
            where: { isActive: true },
            select: { id: true, name: true, hours: true },
        }),
        isLoggedIn && session?.userId
            ? prisma.user.findUnique({
                where: { id: session.userId },
                select: { name: true, email: true, phone: true },
            })
            : Promise.resolve(null),
    ]);

    // Hours is a Prisma JsonValue at the type level. The seed shape is
    // { mon: "07:00-21:00", tue: "...", ... } — a flat map of day-key -> "HH:MM-HH:MM".
    // Cast here so the client can consume it without re-validating per render.
    const locations = locationsRaw.map(l => ({
        id: l.id,
        name: l.name,
        hours: (l.hours as Record<string, string> | null) ?? null,
    }));

    return (
        <CheckoutClient
            locale={locale}
            apiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY || ''}
            stripePublishableKey={process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || ''}
            isLoggedIn={isLoggedIn}
            userAddresses={userAddresses}
            locations={locations}
            initialContact={{
                name: userProfile?.name ?? '',
                email: userProfile?.email ?? '',
                phone: userProfile?.phone ?? '',
            }}
        />
    );
}
