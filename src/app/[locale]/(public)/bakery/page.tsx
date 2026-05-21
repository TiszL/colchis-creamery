import BakeryClient, { type HeroContent, type MenuContent, type DeliveryContent, type BakeryItem } from "@/components/bakery/BakeryClient";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/session";
import { getMyAddresses } from "@/app/actions/addresses";
import { ProductKind } from "@prisma/client";
import type { Metadata } from "next";
import { getPrimaryLocation } from "@/lib/business-location";
import { getSelectedLocation, productCatalogWhereForLocation } from "@/lib/customer-location";

export const metadata: Metadata = {
  title: "The Bakery | Colchis Food",
  description: "Hot khachapuri delivered in 25 minutes to Dublin, Ohio. Adjaruli, Imeruli, Megruli — fresh from our oven. Frozen ships nationwide.",
};

function parseJSON<T>(value: string | undefined | null): T | null {
  if (!value) return null;
  try { return JSON.parse(value) as T; } catch { return null; }
}

// Format a string priceB2c like "16.00" → "$16" or "16.50" → "$16.50"
function fmtPrice(price: string): string {
  const n = parseFloat(price);
  if (isNaN(n)) return `$${price}`;
  return Number.isInteger(n) ? `$${n}` : `$${n.toFixed(2)}`;
}

export default async function BakeryPage() {
  // Hero / delivery / tab labels still come from SiteConfig (admin-editable copy).
  // Menu items now come from the Product DB (Phase 4).
  // Fallback to BakeryClient's defaults if DB query fails or returns empty.
  const contentProps: {
    heroContent?: HeroContent | null;
    menuContent?: MenuContent | null;
    deliveryContent?: DeliveryContent | null;
    hotItems?: BakeryItem[];
    frozenItems?: BakeryItem[];
  } = {};

  try {
    const configs = await prisma.siteConfig.findMany({
      where: { key: { startsWith: 'bakery.' } },
    });
    const cm: Record<string, string> = {};
    for (const c of configs) cm[c.key] = c.value;
    contentProps.heroContent = parseJSON<HeroContent>(cm['bakery.hero']);
    contentProps.menuContent = parseJSON<MenuContent>(cm['bakery.menu']);
    contentProps.deliveryContent = parseJSON<DeliveryContent>(cm['bakery.delivery']);
  } catch {
    // page-copy fall back to BakeryClient defaults
  }

  // Phase 1 (1f) — scope catalog to the customer's selected location.
  // If the selected location is a cold warehouse (NATIONAL_SHIP only) the
  // bakery page returns an empty catalog — switch to a bakery to see hot food.
  const selectedLocation = await getSelectedLocation();
  const locationFilter = productCatalogWhereForLocation(selectedLocation);

  try {
    const bakeryProducts = await prisma.product.findMany({
      where: {
        kind: { in: [ProductKind.BAKERY_HOT, ProductKind.BAKERY_FROZEN] },
        isB2cVisible: true,
        isActive: true,
        ...locationFilter,
      },
      orderBy: [{ kind: 'asc' }, { name: 'asc' }],
      include: { channels: true },
    });

    const mapped = bakeryProducts.map(p => ({
      id: p.id,
      sku: p.sku,
      slug: p.slug,
      name: p.name,
      desc: p.description,
      weight: p.weight || '',
      price: fmtPrice(p.priceB2c),
      tag: p.tag || '',
      ka: p.nameKa || '',
      imageUrl: p.imageUrl,
      isMadeToOrder: p.isMadeToOrder,
      isCartOrderable: p.isCartOrderable,
      // Server-known channels for the product (used to render dine-in-only state
      // before address-driven availability resolves — kills the flicker).
      offeredChannels: p.channels.map(c => c.channel),
    }));

    const hotItems = mapped.filter((_item, i) => bakeryProducts[i].kind === ProductKind.BAKERY_HOT);
    const frozenItems = mapped.filter((_item, i) => bakeryProducts[i].kind === ProductKind.BAKERY_FROZEN);

    if (hotItems.length > 0) contentProps.hotItems = hotItems;
    if (frozenItems.length > 0) contentProps.frozenItems = frozenItems;
  } catch {
    // products fall back to BakeryClient hardcoded defaults
  }

  const session = await getSession();
  const isLoggedIn = !!session?.userId;
  const [userAddresses, primary] = await Promise.all([
    isLoggedIn ? getMyAddresses() : Promise.resolve([]),
    getPrimaryLocation(),
  ]);

  return (
    <BakeryClient
      {...contentProps}
      apiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY || ''}
      isLoggedIn={isLoggedIn}
      userAddresses={userAddresses}
      primaryAddressLine1={primary.addressLine1}
      primaryCityState={`${primary.city} ${primary.state}`}
    />
  );
}
