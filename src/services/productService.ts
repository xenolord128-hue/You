import {
  Category,
  Collection,
  Coupon,
  Order,
  Product,
  Review,
  StoreSettings,
} from '../types/ecommerce';

export interface PublicCatalogResponse {
  connected: boolean;
  products: Product[];
  categories?: Category[];
  collections?: Collection[];
  coupons?: Coupon[];
  reviews?: Review[];
  settings?: Partial<StoreSettings>;
}

export interface AdminCatalogResponse {
  products?: Product[];
  categories?: Category[];
  collections?: Collection[];
  coupons?: Coupon[];
  orders?: Order[];
  reviews?: Review[];
}

function isPublishedProduct(product: unknown): product is Product {
  if (!product || typeof product !== 'object') return false;
  const candidate = product as Partial<Product>;
  return (
    typeof candidate.id === 'string' &&
    typeof candidate.name === 'string' &&
    candidate.status === 'Published'
  );
}

function isJsonResponse(res: Response): boolean {
  const ct = res.headers.get('content-type') || '';
  return ct.toLowerCase().includes('application/json');
}

/**
 * Dynamically fetches strictly "Published" products from the backend database.
 * Never returns demo, mock, or unpublished placeholder items.
 */
export async function fetchPublishedProducts(
  signal?: AbortSignal
): Promise<Product[]> {
  const res = await fetch('/api/products?status=Published', {
    method: 'GET',
    cache: 'no-store',
    signal,
  });
  if (!res.ok || !isJsonResponse(res)) {
    throw new Error('Failed to load published products.');
  }
  const data = (await res.json()) as { products?: unknown[] };
  if (!Array.isArray(data.products)) return [];
  return data.products.filter(isPublishedProduct);
}

/**
 * Fetches the public storefront catalog from the database, enforcing that
 * only "Published" products are returned to StoreContext.
 */
export async function fetchPublicCatalog(
  signal?: AbortSignal
): Promise<PublicCatalogResponse | null> {
  const res = await fetch('/api/store', {
    method: 'GET',
    cache: 'no-store',
    signal,
  });
  if (!res.ok || !isJsonResponse(res)) return null;

  const data = (await res.json()) as {
    connected?: boolean;
    products?: unknown[];
    categories?: Category[];
    collections?: Collection[];
    coupons?: Coupon[];
    reviews?: Review[];
    settings?: Partial<StoreSettings>;
  };

  return {
    connected: Boolean(data.connected),
    products: Array.isArray(data.products)
      ? data.products.filter(isPublishedProduct)
      : [],
    categories: Array.isArray(data.categories) ? data.categories : undefined,
    collections: Array.isArray(data.collections) ? data.collections : undefined,
    coupons: Array.isArray(data.coupons) ? data.coupons : undefined,
    reviews: Array.isArray(data.reviews) ? data.reviews : [],
    settings:
      data.settings && typeof data.settings === 'object'
        ? data.settings
        : undefined,
  };
}

/**
 * Fetches the full admin catalog (all product statuses) for authenticated Admin sessions.
 */
export async function fetchAdminProductsCatalog(
  headers: Record<string, string>
): Promise<AdminCatalogResponse | null> {
  const res = await fetch('/api/admin/catalog', {
    method: 'GET',
    credentials: 'include',
    cache: 'no-store',
    headers,
  });
  if (!res.ok || !isJsonResponse(res)) return null;
  return (await res.json()) as AdminCatalogResponse;
}
