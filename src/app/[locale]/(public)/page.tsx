import { HeroSection } from "@/components/home/HeroSection";
import { Story } from "@/components/home/Story";
import { ThreeHouses } from "@/components/home/ThreeHouses";
import { FeaturedProducts } from "@/components/home/FeaturedProducts";
import { Process } from "@/components/home/Process";
import { EditorialStrip } from "@/components/home/EditorialStrip";
import { Press } from "@/components/home/Press";
import { Visit } from "@/components/home/Visit";
import { prisma } from "@/lib/db";
import type { Product } from "@/types";
import { getTranslations } from "next-intl/server";
import { getOgImage, buildOgImages } from "@/lib/seo";
import { getPrimaryLocation } from "@/lib/business-location";

interface HomePageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: HomePageProps) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "home" });
  const ogImage = await getOgImage('home');
  const title = `Colchis Food | Georgian Cheese & Bread — Heritage Recipes, Made Fresh in Dublin, Ohio`;
  const description = "Ancient heritage, fresh every day. Hand-pressed sulguni and hot khachapuri, made in Dublin, Ohio.";
  const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://colchisfood.com';
  const canonicalPath = locale === 'en' ? '' : `/${locale}`;

  return {
    title,
    description,
    alternates: {
      canonical: `${SITE_URL}${canonicalPath}`,
      languages: {
        'en': SITE_URL,
        'ka': `${SITE_URL}/ka`,
        'ru': `${SITE_URL}/ru`,
        'es': `${SITE_URL}/es`,
        'x-default': SITE_URL,
      },
    },
    openGraph: {
      type: 'website' as const,
      siteName: 'Colchis Food',
      title,
      description,
      url: `${SITE_URL}${canonicalPath}`,
      locale: locale === 'en' ? 'en_US' : locale === 'ka' ? 'ka_GE' : locale === 'ru' ? 'ru_RU' : 'es_ES',
      ...(ogImage ? { images: buildOgImages(ogImage, 'Colchis Food') } : {}),
    },
    twitter: {
      card: 'summary_large_image' as const,
      title,
      description,
      ...(ogImage ? { images: [ogImage] } : {}),
    },
  };
}

// Parse JSON safely
function parseJSON(value: string | undefined | null) {
  if (!value) return null;
  try { return JSON.parse(value); } catch { return null; }
}

export default async function HomePage({ params }: HomePageProps) {
  const { locale } = await params;

  // Fetch all homepage content blocks + hero media config + products + primary location in parallel
  const [dbProducts, homeConfigs, heroMediaConfigs, primary] = await Promise.all([
    prisma.product.findMany({
      where: { status: { in: ['ACTIVE', 'COMING_SOON'] }, isB2cVisible: true },
      orderBy: { name: 'asc' },
      take: 6,
      // sections drive the correct PDP route + house label on the homepage
      // (Product.house was dropped in 1i).
      include: { productCategory: { select: { sections: true } } },
    }).catch(() => []),
    prisma.siteConfig.findMany({
      where: { key: { startsWith: 'home.' } },
    }).catch(() => []),
    prisma.siteConfig.findMany({
      where: { key: { startsWith: 'hero.' } },
    }).catch(() => []),
    getPrimaryLocation(),
  ]);

  // Build content map
  const contentMap: Record<string, string> = {};
  for (const c of homeConfigs) contentMap[c.key] = c.value;

  // Build hero media map
  const heroMediaMap: Record<string, string> = {};
  for (const c of heroMediaConfigs) heroMediaMap[c.key] = c.value;

  // Parse content blocks (null = use component defaults)
  const heroContent = parseJSON(contentMap['home.hero']);
  const tickerContent = parseJSON(contentMap['home.ticker']);
  const storyContent = parseJSON(contentMap['home.story']);
  const threeHousesContent = parseJSON(contentMap['home.three_houses']);
  const processContent = parseJSON(contentMap['home.process']);
  const pressContent = parseJSON(contentMap['home.press']);
  const visitContent = parseJSON(contentMap['home.visit']);

  // Hero media data (images, video, carousel settings from HeroMediaEditor)
  const heroImagesRaw = heroMediaMap['hero.images'] || heroMediaMap['hero.imageUrl'] || '';
  const heroImages = heroImagesRaw.split(',').map(u => u.trim()).filter(Boolean);
  const heroVideoUrl = heroMediaMap['hero.videoUrl'] || '';
  const heroMedia = {
    images: heroImages,
    videoUrl: heroVideoUrl,
    carouselInterval: parseInt(heroMediaMap['hero.carouselInterval'] || '6') * 1000,
    carouselTransition: (heroMediaMap['hero.carouselTransition'] || 'fade') as 'fade' | 'slide' | 'zoom',
    carouselTransitionDuration: parseInt(heroMediaMap['hero.carouselTransitionDuration'] || '1500'),
    overlayEnabled: heroMediaMap['hero.overlayEnabled'] !== 'false',
    overlayOpacity: parseInt(heroMediaMap['hero.overlayOpacity'] || '50'),
    overlayColor: heroMediaMap['hero.overlayColor'] || '#FDFBF7',
    gradientEnabled: heroMediaMap['hero.gradientEnabled'] !== 'false',
    gradientOpacity: parseInt(heroMediaMap['hero.gradientOpacity'] || '90'),
  };

  // Map products
  const products: (Product & { section: 'bakery' | 'creamery' })[] = dbProducts.map(p => ({
    id: p.id,
    sku: p.sku,
    name: p.name,
    slug: p.slug,
    description: p.description || '',
    flavorProfile: p.flavorProfile,
    pairsWith: p.pairsWith,
    weight: p.weight,
    ingredients: p.ingredients,
    imageUrl: p.imageUrl || '',
    priceB2c: parseFloat(p.priceB2c) || 0,
    priceB2b: parseFloat(p.priceB2b) || 0,
    stockQuantity: p.stockQuantity,
    isActive: p.isActive,
    status: p.status as 'ACTIVE' | 'INACTIVE' | 'COMING_SOON',
    section: (p.productCategory?.sections ?? []).includes('bakery') ? 'bakery' as const : 'creamery' as const,
  }));

  return (
    <>
      <HeroSection locale={locale} content={heroContent} ticker={tickerContent} heroMedia={heroMedia} mapsApiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY} />
      <Story content={storyContent} />
      <ThreeHouses content={threeHousesContent} />
      <FeaturedProducts products={products} locale={locale} />
      <Process content={processContent} />
      <EditorialStrip locale={locale} />
      <Press content={pressContent} />
      <Visit primary={primary} content={visitContent} />
    </>
  );
}
