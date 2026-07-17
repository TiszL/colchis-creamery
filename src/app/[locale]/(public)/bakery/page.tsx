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

const BAKERY_SECTION = 'bakery';

export const metadata: Metadata = {
  title: "Cafe & Bakery",
  description: "Hot khachapuri, drinks and Georgian cafe dishes in Dublin, Ohio — delivered in 25 minutes or ready for pickup. Frozen bake-off ships locally.",
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
    sections?: Array<{ slug: string; label: string; items: BakeryItem[] }>;
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
      include: { productCategory: { select: { slug: true, name: true } } },
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

    // Phase 3 (cafe menu) — batched day-of-86 flags: a product whose every
    // enabled Stock row is temporarily disabled shows "Sold out today" on its
    // card (same predicate as the PDP, computed once for the whole list).
    const now = new Date();
    const enabledStocks = await prisma.stock.findMany({
      where: {
        productId: { in: bakeryProducts.map(p => p.id) },
        isEnabled: true,
        location: { isActive: true, type: LocationType.BAKERY, channels: { some: { isActive: true } } },
      },
      select: { productId: true, disabledUntil: true, location: { select: { allowsChannels: true } } },
    });
    const stocksByProduct = new Map<string, { disabledUntil: Date | null }[]>();
    for (const st of enabledStocks) {
      const prod = bakeryProducts.find(p => p.id === st.productId);
      if (!prod || !st.location.allowsChannels.includes(prod.salesChannel)) continue;
      const list = stocksByProduct.get(st.productId) ?? [];
      list.push({ disabledUntil: st.disabledUntil });
      stocksByProduct.set(st.productId, list);
    }
    const soldOutTodayFor = (id: string): boolean => {
      const rows = stocksByProduct.get(id) ?? [];
      return rows.length > 0 && rows.every(r => r.disabledUntil !== null && r.disabledUntil > now);
    };

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
      soldOutToday: soldOutTodayFor(p.id),
      dietaryTags: p.dietaryTags,
    }));

    if (activeCat) {
      // Single-category view (?cat= deep links): flat grid, one section.
      contentProps.singleSectionItems = mapped;
      contentProps.singleSectionLabel = activeCategoryLabel ?? t('filteredView');
    } else {
      // Phase 3 (cafe menu): EVERY bakery-tagged category renders as a titled
      // stacked section in Category.sortOrder — hot pastries, frozen bake-off,
      // drinks, dishes… one continuous menu, chips jump to anchors.
      const byCat = new Map<string, { slug: string; label: string; items: BakeryItem[] }>();
      mapped.forEach((item, i) => {
        const cat = bakeryProducts[i].productCategory;
        if (!cat) return;
        const section = byCat.get(cat.slug) ?? { slug: cat.slug, label: cat.name, items: [] };
        section.items.push(item);
        byCat.set(cat.slug, section);
      });
      if (byCat.size > 0) contentProps.sections = Array.from(byCat.values());
    }
  } catch {
    // DB failure: the menu renders empty (no hardcoded fallback since Phase 3).
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
        anchors={!activeCat}
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
