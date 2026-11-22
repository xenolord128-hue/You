import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
} from 'firebase/firestore';
import {
  Category,
  Collection,
  Coupon,
  Order,
  Product,
  Review,
  StoreSettings,
} from '../types/ecommerce';
import {
  auth,
  db,
  isVerifiedAdminUser,
  testConnection,
} from '../lib/firebase';

export interface PublicCatalogResponse {
  connected: boolean;
  backendAvailable: boolean;
  products: Product[];
  categories?: Category[];
  collections?: Collection[];
  coupons?: Coupon[];
  reviews?: Review[];
  settings?: Partial<StoreSettings>;
}

export interface AdminCatalogResponse {
  backendAvailable: boolean;
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

export function mergeProductsByUpdatedAt(
  primary: Product[],
  secondary: Product[]
): Product[] {
  const map = new Map<string, Product>();
  secondary.forEach((p) => {
    if (p && typeof p.id === 'string') map.set(p.id, p);
  });
  primary.forEach((p) => {
    if (!p || typeof p.id !== 'string') return;
    const prev = map.get(p.id);
    if (!prev) {
      map.set(p.id, p);
      return;
    }
    const prevTime = Date.parse(prev.updated_at || prev.created_at || '') || 0;
    const nextTime = Date.parse(p.updated_at || p.created_at || '') || 0;
    map.set(p.id, nextTime >= prevTime ? p : prev);
  });
  return Array.from(map.values()).sort((a, b) => {
    const tA = Date.parse(a.updated_at || a.created_at || '') || 0;
    const tB = Date.parse(b.updated_at || b.created_at || '') || 0;
    return tB - tA;
  });
}

async function fetchBackendStore(): Promise<Partial<PublicCatalogResponse> | null> {
  try {
    const res = await fetch('/api/store', {
      method: 'GET',
      cache: 'no-store',
      credentials: 'include',
    });
    const ct = (res.headers.get('content-type') || '').toLowerCase();
    if (!res.ok || !ct.includes('application/json')) return null;
    const data = (await res.json()) as {
      connected?: boolean;
      products?: Product[];
      categories?: Category[];
      collections?: Collection[];
      reviews?: Review[];
      settings?: Partial<StoreSettings>;
    };
    return {
      connected: Boolean(data.connected ?? true),
      backendAvailable: true,
      products: Array.isArray(data.products) ? data.products.filter(isPublishedProduct) : [],
      categories: Array.isArray(data.categories) && data.categories.length > 0 ? data.categories : undefined,
      collections: Array.isArray(data.collections) && data.collections.length > 0 ? data.collections : undefined,
      reviews: Array.isArray(data.reviews) ? data.reviews : [],
      settings: data.settings,
    };
  } catch {
    return null;
  }
}

/**
 * Dynamically fetches strictly "Published" products from backend API & Firestore.
 * Never returns demo, mock, or unpublished placeholder items.
 */
export async function fetchPublishedProducts(): Promise<Product[]> {
  const [backendStore, fsProducts] = await Promise.all([
    fetchBackendStore(),
    (async () => {
      try {
        const q = query(collection(db, 'products'), where('status', '==', 'Published'));
        const snap = await getDocs(q);
        return snap.docs
          .map((d) => d.data() as Product)
          .filter(isPublishedProduct);
      } catch {
        return [] as Product[];
      }
    })(),
  ]);

  const apiProducts = Array.isArray(backendStore?.products) ? backendStore.products : [];
  return mergeProductsByUpdatedAt(apiProducts, fsProducts).filter(isPublishedProduct);
}

/**
 * Fetches the public storefront catalog from Express backend & Firestore,
 * enforcing that only "Published" products are returned to StoreContext.
 */
export async function fetchPublicCatalog(): Promise<PublicCatalogResponse | null> {
  const [backendStore, fsOk] = await Promise.all([
    fetchBackendStore(),
    testConnection().catch(() => false),
  ]);

  let fsProducts: Product[] = [];
  let fsCategories: Category[] | undefined;
  let fsCollections: Collection[] | undefined;
  let fsCoupons: Coupon[] = [];
  let fsReviews: Review[] = [];
  let fsSettings: Partial<StoreSettings> | undefined;

  if (fsOk) {
    const [prodRes, catRes, colRes, coupRes, revRes, setRes] = await Promise.allSettled([
      getDocs(query(collection(db, 'products'), where('status', '==', 'Published'))),
      getDocs(collection(db, 'categories')),
      getDocs(collection(db, 'collections')),
      getDocs(collection(db, 'coupons')),
      getDocs(collection(db, 'reviews')),
      getDoc(doc(db, 'settings', 'store_config')),
    ]);

    if (prodRes.status === 'fulfilled') {
      fsProducts = prodRes.value.docs
        .map((d) => d.data() as Product)
        .filter(isPublishedProduct);
    }
    if (catRes.status === 'fulfilled' && catRes.value.docs.length > 0) {
      fsCategories = catRes.value.docs.map((d) => d.data() as Category);
    }
    if (colRes.status === 'fulfilled' && colRes.value.docs.length > 0) {
      fsCollections = colRes.value.docs.map((d) => d.data() as Collection);
    }
    if (coupRes.status === 'fulfilled') {
      fsCoupons = coupRes.value.docs.map((d) => d.data() as Coupon);
    }
    if (revRes.status === 'fulfilled') {
      fsReviews = revRes.value.docs.map((d) => d.data() as Review);
    }
    if (setRes.status === 'fulfilled' && setRes.value.exists()) {
      fsSettings = setRes.value.data() as Partial<StoreSettings>;
    }
  }

  const apiProducts = Array.isArray(backendStore?.products) ? backendStore.products : [];
  const mergedProducts = mergeProductsByUpdatedAt(apiProducts, fsProducts).filter(
    isPublishedProduct
  );

  const reviewMap = new Map<string, Review>();
  fsReviews.forEach((r) => reviewMap.set(r.id, r));
  (backendStore?.reviews || []).forEach((r) => reviewMap.set(r.id, r));

  return {
    connected: Boolean(backendStore?.connected || fsOk),
    backendAvailable: Boolean(backendStore?.backendAvailable),
    products: mergedProducts,
    categories: backendStore?.categories || fsCategories,
    collections: backendStore?.collections || fsCollections,
    coupons: fsCoupons,
    reviews: Array.from(reviewMap.values()).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    ),
    settings:
      fsSettings || backendStore?.settings
        ? { ...(fsSettings || {}), ...(backendStore?.settings || {}) }
        : undefined,
  };
}

/**
 * Fetches the full admin catalog (all product statuses and orders) for authenticated Admin sessions.
 */
export async function fetchAdminProductsCatalog(
  sessionToken?: string
): Promise<AdminCatalogResponse> {
  interface BackendAdminCatalogPayload {
    products?: Product[];
    categories?: Category[];
    collections?: Collection[];
    coupons?: Coupon[];
    orders?: Order[];
    reviews?: Review[];
  }
  let backendData: BackendAdminCatalogPayload | null = null;

  try {
    const res = await fetch('/api/admin/catalog', {
      method: 'GET',
      cache: 'no-store',
      credentials: 'include',
      headers: sessionToken ? { 'X-Admin-Session': sessionToken } : undefined,
    });
    const ct = (res.headers.get('content-type') || '').toLowerCase();
    if (res.ok && ct.includes('application/json')) {
      backendData = (await res.json()) as BackendAdminCatalogPayload;
    }
  } catch {
    backendData = null;
  }

  // Also merge Firestore catalog only when verified Firebase Admin Google account is active
  let fsProducts: Product[] = [];
  let fsCategories: Category[] | undefined;
  let fsCollections: Collection[] | undefined;
  let fsCoupons: Coupon[] = [];
  let fsOrders: Order[] = [];
  let fsReviews: Review[] = [];

  if (isVerifiedAdminUser(auth.currentUser)) {
    const [pS, cS, colS, cpS, oS, rS] = await Promise.allSettled([
      getDocs(collection(db, 'products')),
      getDocs(collection(db, 'categories')),
      getDocs(collection(db, 'collections')),
      getDocs(collection(db, 'coupons')),
      getDocs(collection(db, 'orders')),
      getDocs(collection(db, 'reviews')),
    ]);
    if (pS.status === 'fulfilled') fsProducts = pS.value.docs.map((d) => d.data() as Product);
    if (cS.status === 'fulfilled' && cS.value.docs.length > 0) {
      fsCategories = cS.value.docs.map((d) => d.data() as Category);
    }
    if (colS.status === 'fulfilled' && colS.value.docs.length > 0) {
      fsCollections = colS.value.docs.map((d) => d.data() as Collection);
    }
    if (cpS.status === 'fulfilled') fsCoupons = cpS.value.docs.map((d) => d.data() as Coupon);
    if (oS.status === 'fulfilled') fsOrders = oS.value.docs.map((d) => d.data() as Order);
    if (rS.status === 'fulfilled') fsReviews = rS.value.docs.map((d) => d.data() as Review);
  }

  const mergedProducts = mergeProductsByUpdatedAt(
    backendData?.products || [],
    fsProducts
  );

  const orderMap = new Map<string, Order>();
  fsOrders.forEach((o) => orderMap.set(o.id, o));
  (backendData?.orders || []).forEach((o) => orderMap.set(o.id, o));

  const couponMap = new Map<string, Coupon>();
  fsCoupons.forEach((c) => couponMap.set(c.id, c));
  (backendData?.coupons || []).forEach((c) => couponMap.set(c.id, c));

  const reviewMap = new Map<string, Review>();
  fsReviews.forEach((r) => reviewMap.set(r.id, r));
  (backendData?.reviews || []).forEach((r) => reviewMap.set(r.id, r));

  return {
    backendAvailable: Boolean(backendData),
    products: mergedProducts,
    categories:
      backendData?.categories && backendData.categories.length > 0
        ? backendData.categories
        : fsCategories,
    collections:
      backendData?.collections && backendData.collections.length > 0
        ? backendData.collections
        : fsCollections,
    coupons: Array.from(couponMap.values()),
    orders: Array.from(orderMap.values()).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    ),
    reviews: Array.from(reviewMap.values()).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    ),
  };
}
