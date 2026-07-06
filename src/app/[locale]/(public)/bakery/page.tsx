import BakeryClient, { type HeroContent, type MenuContent, type DeliveryContent, type BakeryItem } from "@/components/bakery/BakeryClient";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/session";
import { getMyAddresses } from "@/app/actions/addresses";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { getPrimaryLocation } from "@/lib/business-location";
import { getSelectedLocation, productCatalogWhereForLocation } from "@/lib/customer-location";
import { CategoryChips } from "@/components/shop/CategoryChips";
import { offeredChannelsByProduct } from "@/lib/offered-channels";
import { DeliveryMethod, LocationType } from "@prisma/client";

// Phase 9b: was ProductKind.BAKERY_HOT / BAKERY_FROZEN. Now driven by Category slug.
const HOT_CATEGORY_SLUG = 'hot-pastries';
const FROZEN_CATEGORY_SLUG = 'frozen-bake-off';
const BAKERY_SECTION = 'bakery';

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

interface BakeryPageProps {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ cat?: string }>;
}

export default async function BakeryPage({ params, searchParams }: BakeryPageProps) {
  const { locale } = await params;
  const { cat: activeCatRaw } = await searchParams;
  const activeCat = activeCatRaw || null;
  const prefix = locale === 'en' ? '' : `/${locale}`;
  // Stage 4 i18n
  const t = await getTranslations({ locale, namespace: 'shop' });

  // Hero / delivery / tab labels still come from SiteConfig (admin-editable copy).
  // Menu items now come from the Product DB (Phase 4).
  // Fallback to BakeryClient's defaults if DB query fails or returns empty.
  const contentProps: {
    heroContent?: HeroContent | null;
    menuContent?: MenuContent | null;
    deliveryContent?: DeliveryContent | null;
    hotItems?: BakeryItem[];
    frozenItems?: BakeryItem[];
    singleSectionItems?: BakeryItem[];
    singleSectionLabel?: string;
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

  // Stage 4: chip nav — single-query via Prisma _count + relation `where`.
  let chipCategories: Array<{ slug: string; name: string; count: number }> = [];
  let sectionTotal = 0;
  let activeCategoryLabel: string | null = null;
  try {
    const bakeryCategories = await prisma.category.findMany({
      where: { isActive: true, sections: { has: BAKERY_SECTION } },
      select: {
        slug: true, name: true,
        _count: {
          select: {
            products: {
              where: {
                isActive: true,
                isB2cVisible: true,
                status: 'ACTIVE',
                ...locationFilter,
              },
            },
          },
        },
      },
      orderBy: { sortOrder: 'asc' },
    });
    chipCategories = bakeryCategories
      .map(c => ({ slug: c.slug, name: c.name, count: c._count.products }))
      .filter(c => c.count > 0);
    sectionTotal = chipCategories.reduce((sum, c) => sum + c.count, 0);
    if (activeCat) {
      const match = bakeryCategories.find(c => c.slug === activeCat);
      if (match) activeCategoryLabel = match.name;
    }
  } catch {
    // Chip nav is non-essential — empty list just hides the chip row.
  }

  try {
    const bakeryProducts = await prisma.product.findMany({
      where: {
        productCategory: activeCat
          // Stage 4: chip-filtered view — narrow to the active category.
          // Still gated to bakery-section + visibility for safety in case the
          // ?cat=<slug> param points at a non-bakery category.
          ? { slug: activeCat, sections: { has: BAKERY_SECTION } }
          // Default view — full bakery: hot + frozen split below.
          : { sections: { has: BAKERY_SECTION } },
        isB2cVisible: true,
        isActive: true,
        ...locationFilter,
      },
      include: { productCategory: { select: { slug: true } } },
      orderBy: [{ productCategory: { sortOrder: 'asc' } }, { name: 'asc' }],
    });

    // Server-known delivery methods per product (renders the dine-in-only /
    // out-of-range card states before address-driven availability resolves).
    // Derived from the locations that carry each product — post-Phase-8a the
    // methods live on the location, not the product. UPS excluded to mirror
    // bakery-availability.ts.
    const offeredByProduct = await offeredChannelsByProduct(
      bakeryProducts.map(p => ({ id: p.id, salesChannel: p.salesChannel, isMadeToOrder: p.isMadeToOrder })),
      { locationType: LocationType.BAKERY, exclude: [DeliveryMethod.UPS_2DAY] },
    );

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
      offeredChannels: offeredByProduct.get(p.id) ?? [],
    }));

    if (activeCat) {
      // Single-category view: flat grid, no hot/frozen tabs.
      // Prefer the Category display name; fall back to translated "Filtered".
      contentProps.singleSectionItems = mapped;
      contentProps.singleSectionLabel = activeCategoryLabel ?? t('filteredView');
    } else {
      const hotItems = mapped.filter((_item, i) => bakeryProducts[i].productCategory?.slug === HOT_CATEGORY_SLUG);
      const frozenItems = mapped.filter((_item, i) => bakeryProducts[i].productCategory?.slug === FROZEN_CATEGORY_SLUG);
      if (hotItems.length > 0) contentProps.hotItems = hotItems;
      if (frozenItems.length > 0) contentProps.frozenItems = frozenItems;
    }
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
    <>
      {/* Stage 4: server-rendered chip filter above the BakeryClient. Hidden
          when ≤1 category exists (single-option chips would be noise). */}
      <CategoryChips
        basePath="/bakery"
        prefix={prefix}
        categories={chipCategories}
        activeSlug={activeCat}
        totalCount={sectionTotal}
        label={t('browseBakery')}
        allLabel={t('all')}
      />

      <BakeryClient
        {...contentProps}
        apiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY || ''}
        isLoggedIn={isLoggedIn}
        userAddresses={userAddresses}
        primaryAddressLine1={primary.addressLine1}
        primaryCityState={`${primary.city} ${primary.state}`}
      />
    </>
  );
}
