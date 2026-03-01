import type { Product } from "@/types";

// Static product data used before database is set up
// This will be replaced with Prisma queries once the DB is seeded
export const PRODUCTS: Product[] = [
  {
    id: "1",
    sku: "SUL-001",
    name: "Artisanal Sulguni",
    slug: "artisanal-sulguni",
    description:
      "Our signature stretched-curd cheese, handcrafted using traditional Georgian techniques. Mild, milky, and beautifully elastic — perfect for melting, grilling, or enjoying fresh.",
    flavorProfile: "Mild, milky, slightly tangy with a smooth elastic texture",
    pairsWith: "Fresh bread, tomatoes, herbs, white wine",
    weight: "8 oz (227g)",
    ingredients: "Pasteurized whole milk, salt, cheese cultures, rennet",
    imageUrl: "/images/products/sulguni.jpg",
    priceB2c: 24.99,
    priceB2b: 18.99,
    stockQuantity: 150,
    isActive: true,
  },
  {
    id: "2",
    sku: "SUL-002",
    name: "Smoked Sulguni",
    slug: "smoked-sulguni",
    description:
      "Classic Sulguni elevated with natural hardwood smoking. Rich, savory, and aromatic — a beloved Georgian delicacy with deep amber coloring and complex flavor.",
    flavorProfile: "Rich, smoky, savory with a firm yet pliable texture",
    pairsWith: "Dark bread, beer, grilled vegetables, cured meats",
    weight: "8 oz (227g)",
    ingredients: "Pasteurized whole milk, salt, cheese cultures, rennet, natural smoke",
    imageUrl: "/images/products/smoked-sulguni.jpg",
    priceB2c: 27.99,
    priceB2b: 21.99,
    stockQuantity: 120,
    isActive: true,
  },
  {
    id: "3",
    sku: "IME-001",
    name: "Imeretian Cheese",
    slug: "imeretian-cheese",
    description:
      "A fresh, brined cheese from the Imereti region of Georgia. Soft, crumbly, and mildly salty — the essential ingredient in khachapuri and a wonderful table cheese.",
    flavorProfile: "Fresh, mild, slightly salty with a soft crumbly texture",
    pairsWith: "Khachapuri, salads, fresh herbs, light red wine",
    weight: "10 oz (283g)",
    ingredients: "Pasteurized whole milk, salt, cheese cultures, rennet",
    imageUrl: "/images/products/imeretian.jpg",
    priceB2c: 22.99,
    priceB2b: 16.99,
    stockQuantity: 200,
    isActive: true,
  },
  {
    id: "4",
    sku: "COL-001",
    name: "Aged Colchis Reserve",
    slug: "aged-colchis-reserve",
    description:
      "Our premium aged cheese, inspired by ancient Colchian traditions. Aged for a minimum of 60 days, developing deep, complex flavors with crystalline texture and nutty undertones.",
    flavorProfile: "Complex, nutty, sharp with crystalline texture",
    pairsWith: "Aged red wine, honey, walnuts, dried fruits",
    weight: "6 oz (170g)",
    ingredients: "Pasteurized whole milk, salt, cheese cultures, rennet",
    imageUrl: "/images/products/aged-reserve.jpg",
    priceB2c: 34.99,
    priceB2b: 27.99,
    stockQuantity: 80,
    isActive: true,
  },
  {
    id: "5",
    sku: "BLN-001",
    name: "Georgian Cheese Blend",
    slug: "georgian-cheese-blend",
    description:
      "A versatile blend of our signature cheeses, perfectly balanced for everyday cooking. Melts beautifully for pizza, pasta, sandwiches, and traditional Georgian dishes.",
    flavorProfile: "Balanced, creamy, versatile with excellent melting properties",
    pairsWith: "Pizza, pasta, burgers, sandwiches, quesadillas",
    weight: "12 oz (340g)",
    ingredients: "Pasteurized whole milk, salt, cheese cultures, rennet",
    imageUrl: "/images/products/cheese-blend.jpg",
    priceB2c: 19.99,
    priceB2b: 14.99,
    stockQuantity: 250,
    isActive: true,
  },
];

export function getProduct(slug: string): Product | undefined {
  return PRODUCTS.find((p) => p.slug === slug);
}

export function getActiveProducts(): Product[] {
  return PRODUCTS.filter((p) => p.isActive);
}
