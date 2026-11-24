import {
  collection,
  doc,
  getDoc,
  getDocFromServer,
  getDocs,
  getDocsFromServer,
  query,
  where,
} from 'firebase/firestore';
import {
  Category,
  Collection,
  Coupon,
  Order,
  OrderNotificationRecord,
  Product,
  ProductSaleStat,
  Review,
  StoreSettings,
} from '../types/ecommerce';
import {
  auth,
  db,
  isVerifiedAdminUser,
} from '../lib/firebase';
import { apiUrl } from '../lib/api';
import { computeProductSalesFromOrders, sortProductSalesDescending } from '../lib/salesAnalytics';

export interface PublicCatalogResponse {
  connected: boolean;
  backendAvailable: boolean;
  products: Product[];
  productSales?: ProductSaleStat[];
  productsError?: string | null;
  categories?: Category[];
  collections?: Collection[];
  coupons?: Coupon[];
  reviews?: Review[];
  settings?: Partial<StoreSettings>;
}

export interface AdminCatalogResponse {
  backendAvailable: boolean;
  products?: Product[];
  productSales?: ProductSaleStat[];
  categories?: Category[];
  collections?: Collection[];
  coupons?: Coupon[];
  orders?: Order[];
  reviews?: Review[];
  orderNotifications?: OrderNotificationRecord[];
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

interface BackendStoreFetchResult {
  data: Partial<PublicCatalogResponse> | null;
  failed: boolean;
}

async function fetchBackendStore(): Promise<BackendStoreFetchResult> {
  try {
    const res = await fetch(apiUrl('/api/store'), {
      method: 'GET',
      cache: 'no-store',
      credentials: 'include',
    });
    const ct = (res.headers.get('content-type') || '').toLowerCase();
    if (!res.ok) {
      return { data: null, failed: true };
    }
    if (!ct.includes('application/json')) {
      return { data: null, failed: true };
    }
    const data = (await res.json()) as {
      connected?: boolean;
      products?: Product[];
      productSales?: ProductSaleStat[];
      categories?: Category[];
      collections?: Collection[];
      reviews?: Review[];
      settings?: Partial<StoreSettings>;
    };
    return {
      failed: false,
      data: {
        connected: Boolean(data.connected ?? true),
        backendAvailable: true,
        products: Array.isArray(data.products) ? data.products.filter(isPublishedProduct) : [],
        productSales: Array.isArray(data.productSales) ? data.productSales : undefined,
        categories: Array.isArray(data.categories) && data.categories.length > 0 ? data.categories : undefined,
        collections: Array.isArray(data.collections) && data.collections.length > 0 ? data.collections : undefined,
        reviews: Array.isArray(data.reviews) ? data.reviews : [],
        settings: data.settings,
      },
    };
  } catch {
    return { data: null, failed: true };
  }
}

async function fetchPublishedProductsFromFirestoreServer(): Promise<Product[]> {
  const q = query(collection(db, 'products'), where('status', '==', 'Published'));
  try {
    const snap = await getDocsFromServer(q);
    return snap.docs.map((d) => d.data() as Product).filter(isPublishedProduct);
  } catch (err) {
    // Fallback to getDocs only if Firestore has already populated local memory; throw if network fails cleanly
    const snap = await getDocs(q);
    if (snap.metadata.fromCache && snap.empty) {
      throw err;
    }
    return snap.docs.map((d) => d.data() as Product).filter(isPublishedProduct);
  }
}

/**
 * Verifies a written product directly from Firestore server storage (bypasses IndexedDB cache).
 */
export async function verifyProductPersisted(productId: string): Promise<Product | null> {
  const snap = await getDocFromServer(doc(db, 'products', productId));
  return snap.exists() ? (snap.data() as Product) : null;
}

/**
 * Dynamically fetches strictly "Published" products from backend API & Firestore.
 * Never returns demo, mock, or unpublished placeholder items.
 */
export async function fetchPublishedProducts(): Promise<Product[]> {
  const [backendRes, fsRes] = await Promise.allSettled([
    fetchBackendStore(),
    fetchPublishedProductsFromFirestoreServer(),
  ]);

  const backendOk =
    backendRes.status === 'fulfilled' && !backendRes.value.failed && backendRes.value.data !== null;
  const fsOk = fsRes.status === 'fulfilled';

  if (!backendOk && !fsOk) {
    throw new Error('Unable to load products. Please try again.');
  }

  const apiProducts =
    backendOk && Array.isArray(backendRes.value.data?.products)
      ? backendRes.value.data!.products!
      : [];
  const fsProducts = fsOk ? fsRes.value : [];

  return mergeProductsByUpdatedAt(apiProducts, fsProducts).filter(isPublishedProduct);
}

/**
 * Fetches the public storefront catalog from Express backend & Firestore simultaneously
 * (never gating Firestore queries behind a secondary test ping), distinguishing DB/network
 * failures from a genuinely empty published catalog.
 */
export async function fetchPublicCatalog(): Promise<PublicCatalogResponse> {
  const [
    backendRes,
    prodRes,
    salesRes,
    catRes,
    colRes,
    coupRes,
    revRes,
    setRes,
  ] = await Promise.allSettled([
    fetchBackendStore(),
    fetchPublishedProductsFromFirestoreServer(),
    getDocsFromServer(collection(db, 'product_sales')).catch(() =>
      getDocs(collection(db, 'product_sales'))
    ),
    getDocs(collection(db, 'categories')),
    getDocs(collection(db, 'collections')),
    getDocs(collection(db, 'coupons')),
    getDocs(collection(db, 'reviews')),
    getDoc(doc(db, 'settings', 'store_config')),
  ]);

  const backendData =
    backendRes.status === 'fulfilled' ? backendRes.value.data : null;
  const backendFailed =
    backendRes.status === 'rejected' ||
    (backendRes.status === 'fulfilled' && backendRes.value.failed);

  const fsProdOk = prodRes.status === 'fulfilled';
  const fsProducts = fsProdOk ? prodRes.value : [];
  const apiProducts = Array.isArray(backendData?.products) ? backendData.products : [];

  const mergedProducts = (fsProdOk ? fsProducts : apiProducts)
    .filter(isPublishedProduct)
    .sort((a, b) => {
      const tA = Date.parse(a.updated_at || a.created_at || '') || 0;
      const tB = Date.parse(b.updated_at || b.created_at || '') || 0;
      return tB - tA;
    });

  // If both sources failed to load products, surface an explicit error instead of claiming catalog is empty
  const productsError =
    backendFailed && !fsProdOk
      ? 'Unable to load products. Please try again.'
      : null;

  const fsSales =
    salesRes.status === 'fulfilled'
      ? salesRes.value.docs
          .map((d) => d.data() as ProductSaleStat)
          .filter((s) => s && typeof s.productId === 'string' && Number(s.unitsSold) > 0)
      : null;
  const apiSales = Array.isArray(backendData?.productSales)
    ? backendData.productSales.filter((s) => s && typeof s.productId === 'string' && Number(s.unitsSold) > 0)
    : null;
  const effectiveSales = sortProductSalesDescending(
    apiSales && apiSales.length > 0 ? apiSales : fsSales || []
  );

  const fsCategories =
    catRes.status === 'fulfilled' && catRes.value.docs.length > 0
      ? catRes.value.docs.map((d) => d.data() as Category)
      : undefined;
  const fsCollections =
    colRes.status === 'fulfilled' && colRes.value.docs.length > 0
      ? colRes.value.docs.map((d) => d.data() as Collection)
      : undefined;
  const fsCoupons =
    coupRes.status === 'fulfilled'
      ? coupRes.value.docs.map((d) => d.data() as Coupon)
      : [];
  const fsReviews =
    revRes.status === 'fulfilled'
      ? revRes.value.docs.map((d) => d.data() as Review)
      : [];
  const fsSettings =
    setRes.status === 'fulfilled' && setRes.value.exists()
      ? (setRes.value.data() as Partial<StoreSettings>)
      : undefined;

  const reviewMap = new Map<string, Review>();
  fsReviews.forEach((r) => reviewMap.set(r.id, r));
  (backendData?.reviews || []).forEach((r) => reviewMap.set(r.id, r));

  return {
    connected: Boolean(backendData?.connected || fsProdOk),
    backendAvailable: Boolean(backendData?.backendAvailable),
    products: mergedProducts,
    productSales: effectiveSales,
    productsError,
    categories: backendData?.categories || fsCategories,
    collections: backendData?.collections || fsCollections,
    coupons: fsCoupons,
    reviews: Array.from(reviewMap.values()).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    ),
    settings:
      fsSettings || backendData?.settings
        ? { ...(fsSettings || {}), ...(backendData?.settings || {}) }
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
    productSales?: ProductSaleStat[];
    categories?: Category[];
    collections?: Collection[];
    coupons?: Coupon[];
    orders?: Order[];
    reviews?: Review[];
    orderNotifications?: OrderNotificationRecord[];
  }
  let backendData: BackendAdminCatalogPayload | null = null;

  const firebaseIdToken =
    auth.currentUser && isVerifiedAdminUser(auth.currentUser)
      ? await auth.currentUser.getIdToken().catch(() => '')
      : '';

  let backendReachable = false;

  try {
    const headers: Record<string, string> = {};
    if (sessionToken) headers['X-Admin-Session'] = sessionToken;
    if (firebaseIdToken) headers['X-Firebase-Id-Token'] = firebaseIdToken;

    const res = await fetch(apiUrl('/api/admin/catalog'), {
      method: 'GET',
      cache: 'no-store',
      credentials: 'include',
      headers: Object.keys(headers).length > 0 ? headers : undefined,
    });
    const ct = (res.headers.get('content-type') || '').toLowerCase();
    if (ct.includes('application/json')) {
      backendReachable = true;
    }
    if (res.ok && ct.includes('application/json')) {
      backendData = (await res.json()) as BackendAdminCatalogPayload;
    }
  } catch {
    backendData = null;
  }

  let fsProducts: Product[] = [];
  let fsCategories: Category[] | undefined;
  let fsCollections: Collection[] | undefined;
  let fsCoupons: Coupon[] = [];
  let fsOrders: Order[] = [];
  let fsReviews: Review[] = [];

  if (isVerifiedAdminUser(auth.currentUser)) {
    const [pS, cS, colS, cpS, oS, rS] = await Promise.allSettled([
      getDocsFromServer(collection(db, 'products')).catch(() =>
        getDocs(collection(db, 'products'))
      ),
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

  const mergedOrders = Array.from(orderMap.values()).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  const computedSales = computeProductSalesFromOrders(mergedOrders, mergedProducts);

  return {
    backendAvailable: Boolean(backendData) || backendReachable,
    products: mergedProducts,
    productSales:
      computedSales.length > 0 || mergedOrders.length > 0
        ? computedSales
        : backendData?.productSales || [],
    categories:
      backendData?.categories && backendData.categories.length > 0
        ? backendData.categories
        : fsCategories,
    collections:
      backendData?.collections && backendData.collections.length > 0
        ? backendData.collections
        : fsCollections,
    coupons: Array.from(couponMap.values()),
    orders: mergedOrders,
    reviews: Array.from(reviewMap.values()).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    ),
    orderNotifications: Array.isArray(backendData?.orderNotifications)
      ? backendData.orderNotifications
      : [],
  };
}
