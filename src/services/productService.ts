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
  db,
  handleFirestoreError,
  OperationType,
  testConnection,
} from '../lib/firebase';

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

/**
 * Dynamically fetches strictly "Published" products from Firestore.
 * Never returns demo, mock, or unpublished placeholder items.
 */
export async function fetchPublishedProducts(): Promise<Product[]> {
  const path = 'products';
  try {
    const q = query(collection(db, path), where('status', '==', 'Published'));
    const snap = await getDocs(q);
    return snap.docs
      .map((d) => d.data() as Product)
      .filter(isPublishedProduct);
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

/**
 * Fetches the public storefront catalog from Firestore, enforcing that
 * only "Published" products are returned to StoreContext.
 */
export async function fetchPublicCatalog(): Promise<PublicCatalogResponse | null> {
  await testConnection();

  let products: Product[] = [];
  try {
    products = await fetchPublishedProducts();
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'products');
  }

  const categoriesSnap = await getDocs(collection(db, 'categories')).catch((err) =>
    handleFirestoreError(err, OperationType.LIST, 'categories')
  );
  const collectionsSnap = await getDocs(collection(db, 'collections')).catch((err) =>
    handleFirestoreError(err, OperationType.LIST, 'collections')
  );
  const couponsSnap = await getDocs(collection(db, 'coupons')).catch((err) =>
    handleFirestoreError(err, OperationType.LIST, 'coupons')
  );
  const reviewsSnap = await getDocs(collection(db, 'reviews')).catch((err) =>
    handleFirestoreError(err, OperationType.LIST, 'reviews')
  );
  const settingsSnap = await getDoc(doc(db, 'settings', 'store_config')).catch((err) =>
    handleFirestoreError(err, OperationType.GET, 'settings/store_config')
  );

  const categories = categoriesSnap.docs.map((d) => d.data() as Category);
  const collections = collectionsSnap.docs.map((d) => d.data() as Collection);
  const coupons = couponsSnap.docs.map((d) => d.data() as Coupon);
  const reviews = reviewsSnap.docs.map((d) => d.data() as Review);
  const settings = settingsSnap.exists()
    ? (settingsSnap.data() as Partial<StoreSettings>)
    : undefined;

  return {
    connected: true,
    products,
    categories: categories.length > 0 ? categories : undefined,
    collections: collections.length > 0 ? collections : undefined,
    coupons,
    reviews,
    settings,
  };
}

/**
 * Fetches the full admin catalog (all product statuses and orders) for authenticated Admin sessions.
 */
export async function fetchAdminProductsCatalog(): Promise<AdminCatalogResponse> {
  const [
    productsSnap,
    categoriesSnap,
    collectionsSnap,
    couponsSnap,
    ordersSnap,
    reviewsSnap,
  ] = await Promise.all([
    getDocs(collection(db, 'products')).catch((err) =>
      handleFirestoreError(err, OperationType.LIST, 'products')
    ),
    getDocs(collection(db, 'categories')).catch((err) =>
      handleFirestoreError(err, OperationType.LIST, 'categories')
    ),
    getDocs(collection(db, 'collections')).catch((err) =>
      handleFirestoreError(err, OperationType.LIST, 'collections')
    ),
    getDocs(collection(db, 'coupons')).catch((err) =>
      handleFirestoreError(err, OperationType.LIST, 'coupons')
    ),
    getDocs(collection(db, 'orders')).catch((err) =>
      handleFirestoreError(err, OperationType.LIST, 'orders')
    ),
    getDocs(collection(db, 'reviews')).catch((err) =>
      handleFirestoreError(err, OperationType.LIST, 'reviews')
    ),
  ]);

  return {
    products: productsSnap.docs.map((d) => d.data() as Product),
    categories:
      categoriesSnap.docs.length > 0
        ? categoriesSnap.docs.map((d) => d.data() as Category)
        : undefined,
    collections:
      collectionsSnap.docs.length > 0
        ? collectionsSnap.docs.map((d) => d.data() as Collection)
        : undefined,
    coupons: couponsSnap.docs.map((d) => d.data() as Coupon),
    orders: ordersSnap.docs.map((d) => d.data() as Order),
    reviews: reviewsSnap.docs.map((d) => d.data() as Review),
  };
}
