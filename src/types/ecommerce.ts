export type ProductCategory = string;

export type ProductStatus = 'Draft' | 'Published' | 'Unpublished' | 'Out of Stock';

export interface ProductColor {
  name: string;
  hex: string;
}

export interface Product {
  id: string;
  sku: string;
  name: string;
  slug: string;
  shortDescription?: string;
  description: string;
  category: ProductCategory;
  subcategory?: string;
  collection: string;
  price: number;
  compare_at_price?: number | null;
  images: string[];
  primaryImage?: string;
  videoUrl?: string;
  colors: ProductColor[];
  sizes: string[];
  inventory: number;
  variantStock?: Record<string, number>;
  tags?: string[];
  status: ProductStatus;
  rating: number;
  reviews_count: number;
  featured: boolean;
  new_arrival: boolean;
  best_seller: boolean;
  trending: boolean;
  winter_collection: boolean;
  sale: boolean;
  materials: string;
  size_fit: string;
  care_instructions: string;
  features: string[];
  created_at: string;
  updated_at?: string;
}

export interface Category {
  id: string;
  name: string;
  filterCategories: ProductCategory[];
  subcategories?: string[];
  slug: string;
  image: string;
  description: string;
  display_order: number;
}

export interface Collection {
  id: string;
  title: string;
  slug: string;
  description: string;
  hero_image: string;
  featured: boolean;
}

export interface CartItem {
  id: string;
  productId: string;
  sku: string;
  name: string;
  slug: string;
  price: number;
  image: string;
  color: string;
  size: string;
  quantity: number;
}

export type OrderStatus =
  | 'Order Received'
  | 'Order Confirmed'
  | 'Processing'
  | 'Packed'
  | 'Shipped'
  | 'Out for Delivery'
  | 'Delivered'
  | 'Cancelled';

export type PaymentStatus = 'Pending' | 'Paid' | 'Failed' | 'Refunded';
export type DeliveryMethod = 'Standard Delivery' | 'Express Delivery';
export type PaymentMethod = 'Cash on Delivery' | 'bKash' | 'Nagad';

export interface OrderItem {
  productId: string;
  sku?: string;
  name: string;
  slug: string;
  image: string;
  color: string;
  size: string;
  quantity: number;
  price: number;
}

export interface Order {
  id: string;
  orderNumber: string;
  userId?: string;
  isGuest?: boolean;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  address: string;
  city: string; // District
  area: string;
  postalCode: string;
  deliveryMethod: DeliveryMethod;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  deliveryStatus: string;
  deliveryNote?: string;
  paymentReference?: string;
  paymentSenderNumber?: string;
  items: OrderItem[];
  subtotal: number;
  shipping: number;
  discount: number;
  couponCode?: string;
  total: number;
  status: OrderStatus;
  createdAt: string;
  updatedAt?: string;
}

export interface Review {
  id: string;
  productId: string;
  productName?: string;
  userId?: string;
  authorName: string;
  rating: number;
  comment: string;
  createdAt: string;
}

export interface Coupon {
  id: string;
  code: string;
  discountType: 'percentage' | 'fixed';
  value: number;
  minOrder: number;
  expiryDate?: string;
  usageLimit?: number;
  active: boolean;
  usageCount: number;
}

export interface StoreSettings {
  id: string;
  insideDhakaCharge: number;
  outsideDhakaCharge: number;
  expressSurcharge: number;
  freeShippingThreshold: number;
  businessAddress: string;
  supportEmail: string;
  supportPhone: string;
  whatsappNumber: string;
  messengerHandle: string;
  facebookUrl: string;
  instagramUrl: string;
  metaPixelId: string;
  announcementText: string;
  heroImageUrl?: string;
}

export interface BlogPost {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  content: string[];
  category: string;
  publishedAt: string;
  readTime: string;
  image: string;
}
