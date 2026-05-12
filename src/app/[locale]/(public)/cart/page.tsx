import { getSession } from "@/lib/session";
import { getMyAddresses } from "@/app/actions/addresses";
import CartClient from "@/components/cart/CartClient";

export const dynamic = 'force-dynamic';

interface CartPageProps {
    params: Promise<{ locale: string }>;
}

export default async function CartPage({ params }: CartPageProps) {
    const { locale } = await params;
    const session = await getSession();
    const isLoggedIn = !!session?.userId;
    const userAddresses = isLoggedIn ? await getMyAddresses() : [];

    return (
        <CartClient
            locale={locale}
            apiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY || ''}
            isLoggedIn={isLoggedIn}
            userAddresses={userAddresses}
        />
    );
}
