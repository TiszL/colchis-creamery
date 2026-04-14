export type UserRole = "ADMIN" | "B2C_CUSTOMER" | "B2B_PARTNER";

export type ContractStatus =
  | "PENDING"
  | "OUT_FOR_SIGNATURE"
  | "SIGNED"
  | "EXPIRED";

export type PaymentStatus = "UNPAID" | "PAID" | "REFUNDED";

export type OrderStatus =
  | "PROCESSING"
  | "READY_FOR_PICKUP"
  | "SHIPPED"
  | "IN_TRANSIT"
  | "DELIVERED";

export type OrderType = "B2C" | "B2B";

export type LeadStatus = "NEW" | "CONTACTED" | "CONVERTED" | "REJECTED";

export interface ProductLine {
  id: string;
  slug: string;
  name: string;
  tagline: string | null;
  description: string | null;
  badgeColor: string | null;
  sortOrder: number;
  isActive: boolean;
}

export interface Category {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  productLineId: string;
  sortOrder: number;
  isActive: boolean;
}

export interface Product {
  id: string;
  sku: string;
  name: string;
  slug: string;
  description: string;
  flavorProfile: string | null;
  pairsWith: string | null;
  weight: string | null;
  ingredients: string | null;
  imageUrl: string;
  priceB2c: number;
  priceB2b: number;
  stockQuantity: number;
  isActive: boolean;
  status: 'ACTIVE' | 'INACTIVE' | 'COMING_SOON';
  productLineId?: string | null;
  categoryId?: string | null;
  productLine?: ProductLine | null;
  productCategory?: Category | null;
}

export interface CartItem {
  product: Product;
  quantity: number;
}

export interface Recipe {
  id: string;
  title: string;
  slug: string;
  description: string;
  content: string;
  prepTime: string | null;
  cookTime: string | null;
  servings: string | null;
  difficulty: string | null;
  imageUrl: string | null;
  isPublished: boolean;
}

