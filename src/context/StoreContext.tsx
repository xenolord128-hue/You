import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocFromServer,
  onSnapshot,
  query,
  setDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import {
  CartItem,
  Category,
  Collection,
  Coupon,
  Order,
  OrderStatus,
  PaymentStatus,
  Product,
  Review,
  StoreSettings,
} from '../types/ecommerce';
import {
  DEFAULT_CATEGORIES,
  DEFAULT_COLLECTIONS,
  DEFAULT_SETTINGS,
  normalizeCategoryMedia,
  normalizeCollectionMedia,
  normalizeProductMedia,
  sanitizeHeroSettingUrl,
} from '../config/storeConfig';
import { sanitizeDocId } from '../lib/formatters';
import {
  getSortedCategories,
  isLegacySeedCategorySet,
} from '../lib/categoryUtils';
import {
  initMetaPixel,
  trackPixelEvent,
  trackPurchaseEvent,
} from '../lib/metaPixel';
import { AppLanguage, TRANSLATIONS } from '../lib/i18n';
import {
  auth,
  cleanFirestorePayload,
  db,
  handleFirestoreError,
  isVerifiedAdminUser,
  OperationType,
  signInAdminWithGoogle,
  signOutAdmin,
  testConnection,
} from '../lib/firebase';
import {
  fetchAdminProductsCatalog,
  fetchPublicCatalog,
  mergeProductsByUpdatedAt,
  verifyProductPersisted,
} from '../services/productService';
import { setMediaSessionToken } from '../services/mediaService';
import { apiUrl } from '../lib/api';

interface StoreContextValue {
  serverConnected: boolean;
  backendConnected: boolean;
  isFirebaseAdminLinked: boolean;
  productsLoading: boolean;
  productsError: string | null;
  mapsApiKey: string;
  authReady: boolean;
  isAdminAuthenticated: boolean;
  adminSetupRequired: boolean;
  adminUserEmail: string;
  adminSessionToken: string;
  setAdminSessionToken: (token: string) => void;
  setupAdminPassword: (password: string) => Promise<void>;
  loginAdminWithPassword: (password: string) => Promise<void>;
  signInAdmin: () => Promise<User>;
  signOutAdminUser: () => Promise<void>;
  refreshProducts: () => Promise<void>;
  refreshAdminData: (tokenOverride?: string) => Promise<void>;
  products: Product[];
  adminProducts: Product[];
  categories: Category[];
  collections: Collection[];
  coupons: Coupon[];
  reviews: Review[];
  orders: Order[];
  settings: StoreSettings;
  cart: CartItem[];
  wishlist: string[];
  appliedCoupon: Coupon | null;
  recentSearches: string[];
  isCartOpen: boolean;
  isSearchOpen: boolean;
  isMobileMenuOpen: boolean;
  isQrScannerOpen: boolean;
  language: AppLanguage;
  toast: string | null;
  setIsCartOpen: (open: boolean) => void;
  setIsSearchOpen: (open: boolean) => void;
  setIsMobileMenuOpen: (open: boolean) => void;
  setIsQrScannerOpen: (open: boolean) => void;
  setLanguage: (lang: AppLanguage) => void;
  t: (key: string) => string;
  showToast: (msg: string) => void;
  addToCart: (
    product: Product,
    opts: { color: string; size: string; quantity?: number; openDrawer?: boolean }
  ) => void;
  updateCartQuantity: (itemId: string, quantity: number) => void;
  removeFromCart: (itemId: string) => void;
  clearCart: () => void;
  toggleWishlist: (productId: string) => void;
  isInWishlist: (productId: string) => boolean;
  applyCouponCode: (
    code: string,
    overrideSubtotal?: number
  ) => { ok: boolean; message: string };
  removeCoupon: () => void;
  addRecentSearch: (term: string) => void;
  placeOrder: (
    orderData: Omit<
      Order,
      'id' | 'orderNumber' | 'status' | 'paymentStatus' | 'deliveryStatus' | 'createdAt'
    > & { orderNumber?: string }
  ) => Promise<Order>;
  trackOrder: (orderNumber: string, phone: string) => Order | null;
  fetchTrackedOrder: (orderNumber: string, phone: string) => Promise<Order | null>;
  submitReview: (input: {
    productId: string;
    productName?: string;
    rating: number;
    comment: string;
    authorName?: string;
  }) => Promise<void>;
  upsertProduct: (product: Product, isNew?: boolean) => Promise<Product>;
  duplicateProduct: (product: Product) => Promise<Product>;
  deleteProduct: (productId: string) => Promise<void>;
  upsertCategory: (cat: Category) => Promise<void>;
  deleteCategory: (categoryId: string) => Promise<void>;
  reorderCategories: (orderedCategories: Category[]) => Promise<void>;
  restoreDefaultCategories: () => Promise<void>;
  upsertCollection: (col: Collection) => Promise<void>;
  upsertCoupon: (coupon: Coupon) => Promise<void>;
  deleteCoupon: (couponId: string) => Promise<void>;
  updateOrderStatus: (orderId: string, status: OrderStatus) => Promise<void>;
  updateOrderDetails: (
    orderId: string,
    patch: { status?: OrderStatus; paymentStatus?: PaymentStatus; deliveryStatus?: string }
  ) => Promise<void>;
  updateStoreSettings: (next: Partial<StoreSettings>) => Promise<void>;
  syncCatalog: () => Promise<void>;
}

const StoreContext = createContext<StoreContextValue | null>(null);

const CART_STORAGE_KEY = 'pythox_cart_v1';
const WISHLIST_STORAGE_KEY = 'pythox_wishlist_v1';
const RECENT_SEARCH_KEY = 'pythox_recent_searches_v1';
const LOCAL_ORDERS_KEY = 'pythox_local_orders_v1';
const LANGUAGE_STORAGE_KEY = 'pythox_lang_v1';
const ADMIN_SESSION_STORAGE_KEY = 'pythox_admin_session_token_v1';

function readSessionToken(): string {
  try {
    return sessionStorage.getItem(ADMIN_SESSION_STORAGE_KEY) || '';
  } catch {
    return '';
  }
}

function writeSessionToken(token: string): void {
  try {
    if (token) {
      sessionStorage.setItem(ADMIN_SESSION_STORAGE_KEY, token);
    } else {
      sessionStorage.removeItem(ADMIN_SESSION_STORAGE_KEY);
    }
  } catch {
    // ignore storage errors
  }
}

function readStorage<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function buildTrackingDocId(orderNumber: string, phone: string): string {
  const cleanOrder = orderNumber.trim().toUpperCase().replace(/[^A-Z0-9-]/g, '');
  const digits = phone.replace(/\D/g, '').slice(-10);
  return sanitizeDocId(`${cleanOrder}_${digits}`);
}

function clampProductForFirestore(product: Product): Product {
  const id = sanitizeDocId(product.id || `prod-${Date.now()}`);
  const images = (product.images || []).slice(0, 20).map((u) => String(u).slice(0, 2000));
  const primaryImage = (product.primaryImage || images[0] || '').slice(0, 2000);
  return cleanFirestorePayload<Product>({
    ...product,
    id,
    sku: (product.sku || id).trim().slice(0, 80),
    name: product.name.trim().slice(0, 200),
    slug: (product.slug || id).trim().slice(0, 200),
    shortDescription: product.shortDescription?.trim().slice(0, 500),
    description: product.description.trim().slice(0, 5000),
    category: product.category.trim().slice(0, 100),
    additionalCategories:
      product.additionalCategories && product.additionalCategories.length > 0
        ? Array.from(
            new Set(
              product.additionalCategories
                .map((c) => String(c).trim().slice(0, 100))
                .filter((c) => c && c.toLowerCase() !== product.category.trim().toLowerCase())
            )
          ).slice(0, 20)
        : undefined,
    subcategory: product.subcategory?.trim().slice(0, 100),
    collection: (product.collection || '').trim().slice(0, 100),
    price: Math.max(1, Number(product.price) || 1),
    compare_at_price:
      product.compare_at_price != null && Number.isFinite(Number(product.compare_at_price))
        ? Math.max(0, Number(product.compare_at_price))
        : null,
    images,
    primaryImage,
    videoUrl: product.videoUrl ? product.videoUrl.slice(0, 2000) : undefined,
    colors: (product.colors || []).slice(0, 20),
    sizes: (product.sizes || []).slice(0, 20).map((s) => String(s).slice(0, 40)),
    inventory: Math.max(0, Number(product.inventory) || 0),
    tags: product.tags ? product.tags.slice(0, 30).map((t) => String(t).slice(0, 60)) : undefined,
    status: product.status || 'Draft',
    rating: Math.min(5, Math.max(0, Number(product.rating) || 5)),
    reviews_count: Math.max(0, Number(product.reviews_count) || 0),
    featured: Boolean(product.featured),
    new_arrival: Boolean(product.new_arrival),
    best_seller: Boolean(product.best_seller),
    trending: Boolean(product.trending),
    winter_collection: Boolean(product.winter_collection),
    sale: Boolean(product.sale),
    materials: (product.materials || '').slice(0, 1000),
    size_fit: (product.size_fit || '').slice(0, 1000),
    care_instructions: (product.care_instructions || '').slice(0, 1000),
    features: (product.features || []).slice(0, 20).map((f) => String(f).slice(0, 200)),
    created_at: (product.created_at || new Date().toISOString()).slice(0, 64),
    updated_at: new Date().toISOString().slice(0, 64),
  });
}

function clampCategoryForFirestore(cat: Category): Category {
  const id = sanitizeDocId(cat.id || `cat-${Date.now()}`);
  return cleanFirestorePayload<Category>({
    id,
    name: cat.name.trim().slice(0, 120),
    slug: cat.slug.trim().slice(0, 120),
    filterCategories: (cat.filterCategories || []).slice(0, 50).map((s) => String(s).slice(0, 100)),
    subcategories: cat.subcategories
      ? cat.subcategories.slice(0, 50).map((s) => String(s).slice(0, 100))
      : undefined,
    image: (cat.image || '').slice(0, 2000),
    description: (cat.description || '').slice(0, 1000),
    display_order: Number(cat.display_order) || 1,
  });
}

function clampCollectionForFirestore(col: Collection): Collection {
  const id = sanitizeDocId(col.id || `col-${Date.now()}`);
  return cleanFirestorePayload<Collection>({
    id,
    title: col.title.trim().slice(0, 140),
    slug: col.slug.trim().slice(0, 140),
    description: (col.description || '').slice(0, 1000),
    hero_image: (col.hero_image || '').slice(0, 2000),
    featured: Boolean(col.featured),
  });
}

function clampCouponForFirestore(coupon: Coupon): Coupon {
  const id = sanitizeDocId(coupon.id || `coup-${Date.now()}`);
  return cleanFirestorePayload<Coupon>({
    id,
    code: coupon.code.trim().toUpperCase().slice(0, 40),
    discountType: coupon.discountType === 'fixed' ? 'fixed' : 'percentage',
    value: Math.max(1, Number(coupon.value) || 1),
    minOrder: Math.max(0, Number(coupon.minOrder) || 0),
    expiryDate: coupon.expiryDate ? coupon.expiryDate.slice(0, 40) : undefined,
    usageLimit:
      coupon.usageLimit !== undefined ? Math.max(0, Number(coupon.usageLimit) || 0) : undefined,
    active: Boolean(coupon.active),
    usageCount: Math.max(0, Number(coupon.usageCount) || 0),
  });
}

function clampSettingsForFirestore(nextSettings: StoreSettings): StoreSettings {
  return cleanFirestorePayload<StoreSettings>({
    id: 'store_config',
    insideDhakaCharge: Math.max(0, Number(nextSettings.insideDhakaCharge) || 80),
    outsideDhakaCharge: Math.max(0, Number(nextSettings.outsideDhakaCharge) || 130),
    expressSurcharge: Math.max(0, Number(nextSettings.expressSurcharge) || 70),
    freeShippingThreshold: Math.max(0, Number(nextSettings.freeShippingThreshold) || 3000),
    businessAddress: (nextSettings.businessAddress || '').slice(0, 300),
    supportEmail: (nextSettings.supportEmail || '').slice(0, 200),
    supportPhone: (nextSettings.supportPhone || '').slice(0, 40),
    whatsappNumber: (nextSettings.whatsappNumber || '').slice(0, 40),
    messengerHandle: (nextSettings.messengerHandle || '').slice(0, 80),
    facebookUrl: (nextSettings.facebookUrl || '').slice(0, 500),
    instagramUrl: (nextSettings.instagramUrl || '').slice(0, 500),
    metaPixelId: (nextSettings.metaPixelId || '').slice(0, 40),
    announcementText: (nextSettings.announcementText || '').slice(0, 300),
    heroImageUrl: sanitizeHeroSettingUrl(nextSettings.heroImageUrl).slice(0, 2000),
    mobileHeroImageUrl: sanitizeHeroSettingUrl(nextSettings.mobileHeroImageUrl).slice(0, 2000),
  });
}

function mergeStoreSettings(raw?: Partial<StoreSettings> | null): StoreSettings {
  if (!raw) return DEFAULT_SETTINGS;
  const merged = {
    ...DEFAULT_SETTINGS,
    ...raw,
    heroImageUrl: sanitizeHeroSettingUrl(raw.heroImageUrl),
    mobileHeroImageUrl: sanitizeHeroSettingUrl(raw.mobileHeroImageUrl),
  };
  if (raw.supportPhone === '+880 1700-000000' || !raw.supportPhone?.trim()) {
    merged.supportPhone = DEFAULT_SETTINGS.supportPhone;
  }
  if (raw.whatsappNumber === '8801700000000' || !raw.whatsappNumber?.trim()) {
    merged.whatsappNumber = DEFAULT_SETTINGS.whatsappNumber;
  }
  if (raw.facebookUrl === 'https://facebook.com/pythoxworld' || !raw.facebookUrl?.trim()) {
    merged.facebookUrl = DEFAULT_SETTINGS.facebookUrl;
  }
  if (raw.instagramUrl === 'https://instagram.com/pythoxworld' || !raw.instagramUrl?.trim()) {
    merged.instagramUrl = DEFAULT_SETTINGS.instagramUrl;
  }
  if (!raw.supportEmail?.trim()) {
    merged.supportEmail = DEFAULT_SETTINGS.supportEmail;
  }
  return merged;
}

export const StoreProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [serverConnected, setServerConnected] = useState(false);
  const [firebaseAuthReady, setFirebaseAuthReady] = useState(false);
  const [sessionCheckReady, setSessionCheckReady] = useState(false);
  const [adminUser, setAdminUser] = useState<User | null>(null);
  const [passwordAdminAuthed, setPasswordAdminAuthed] = useState(false);
  const [adminSetupRequired, setAdminSetupRequired] = useState(false);
  const [adminSessionToken, setAdminSessionTokenState] = useState<string>(() =>
    readSessionToken()
  );
  const setAdminSessionToken = useCallback((token: string) => {
    const clean = token || '';
    writeSessionToken(clean);
    setAdminSessionTokenState(clean);
    setMediaSessionToken(clean);
  }, []);
  const [mapsApiKey, setMapsApiKey] = useState<string>(
    (import.meta as any).env?.VITE_GOOGLE_MAPS_API_KEY || ''
  );

  const authReady = firebaseAuthReady && sessionCheckReady;

  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [productsLoading, setProductsLoading] = useState<boolean>(true);
  const [productsError, setProductsError] = useState<string | null>(null);
  const products = useMemo(
    () => allProducts.filter((p) => p.status === 'Published'),
    [allProducts]
  );
  const isFirebaseAdminLinked = useMemo(
    () => isVerifiedAdminUser(adminUser),
    [adminUser]
  );
  const isAdminAuthenticated = useMemo(
    () => Boolean(passwordAdminAuthed || isFirebaseAdminLinked),
    [passwordAdminAuthed, isFirebaseAdminLinked]
  );
  const [backendConnected, setBackendConnected] = useState(false);
  const adminUserEmail = isFirebaseAdminLinked
    ? adminUser?.email || 'lord79915@gmail.com'
    : passwordAdminAuthed
      ? 'Administrator Session'
      : '';
  const adminLoadedRef = useRef(false);
  const backendAvailableRef = useRef(false);
  const apiProductsRef = useRef<Product[]>([]);
  const fsProductsRef = useRef<Product[]>([]);
  const deletedProductIdsRef = useRef<Set<string>>(new Set());
  const apiCategoriesLoadedRef = useRef(false);
  const apiSettingsRef = useRef<Partial<StoreSettings> | undefined>(undefined);
  const productsRef = useRef<Product[]>([]);

  useEffect(() => {
    productsRef.current = products;
  }, [products]);

  useEffect(() => {
    setMediaSessionToken(adminSessionToken);
  }, [adminSessionToken]);

  const [categories, setCategories] = useState<Category[]>(DEFAULT_CATEGORIES);
  const [collections, setCollections] = useState<Collection[]>(DEFAULT_COLLECTIONS);
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [orders, setOrders] = useState<Order[]>(() =>
    readStorage<Order[]>(LOCAL_ORDERS_KEY, [])
  );
  const [settings, setSettings] = useState<StoreSettings>(DEFAULT_SETTINGS);

  const [cart, setCart] = useState<CartItem[]>(() =>
    readStorage<CartItem[]>(CART_STORAGE_KEY, [])
  );
  const [wishlist, setWishlist] = useState<string[]>(() =>
    readStorage<string[]>(WISHLIST_STORAGE_KEY, [])
  );
  const [appliedCoupon, setAppliedCoupon] = useState<Coupon | null>(null);
  const [recentSearches, setRecentSearches] = useState<string[]>(() =>
    readStorage<string[]>(RECENT_SEARCH_KEY, [])
  );

  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isQrScannerOpen, setIsQrScannerOpen] = useState(false);
  const [language, setLanguageState] = useState<AppLanguage>(() =>
    readStorage<AppLanguage>(LANGUAGE_STORAGE_KEY, 'en')
  );
  const [toast, setToast] = useState<string | null>(null);

  const setLanguage = useCallback((lang: AppLanguage) => {
    setLanguageState(lang);
    try {
      localStorage.setItem(LANGUAGE_STORAGE_KEY, JSON.stringify(lang));
    } catch {
      // ignore storage errors
    }
  }, []);

  const t = useCallback(
    (key: string) => TRANSLATIONS[language][key] || TRANSLATIONS.en[key] || key,
    [language]
  );

  const showToast = useCallback((msg: string) => {
    setToast(msg);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 3200);
    return () => clearTimeout(timer);
  }, [toast]);

  // Helper to perform authenticated admin API calls with session cookie + in-memory header + Firebase Admin ID token
  const adminApiCall = useCallback(
    async <T = Record<string, unknown>>(
      url: string,
      method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
      body?: unknown,
      tokenOverride?: string
    ): Promise<T | null> => {
      const token = tokenOverride ?? adminSessionToken;
      const firebaseIdToken =
        auth.currentUser && isVerifiedAdminUser(auth.currentUser)
          ? await auth.currentUser.getIdToken().catch(() => '')
          : '';
      const res = await fetch(apiUrl(url), {
        method,
        credentials: 'include',
        cache: 'no-store',
        headers: {
          ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
          ...(token ? { 'X-Admin-Session': token } : {}),
          ...(firebaseIdToken ? { 'X-Firebase-Id-Token': firebaseIdToken } : {}),
        },
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      });
      const ct = (res.headers.get('content-type') || '').toLowerCase();
      if (!ct.includes('application/json')) {
        return null;
      }
      const data = (await res.json()) as T & { error?: string };
      if (!res.ok) {
        if (res.status === 401) {
          setPasswordAdminAuthed(false);
          setAdminSessionToken('');
          if (!isVerifiedAdminUser(auth.currentUser)) {
            adminLoadedRef.current = false;
          }
        }
        throw new Error(data?.error || `Request failed with status ${res.status}`);
      }
      backendAvailableRef.current = true;
      return data;
    },
    [adminSessionToken, setAdminSessionToken]
  );

  // Monitor Server-Side Cookie/Header Session on mount
  useEffect(() => {
    let active = true;
    const savedToken = readSessionToken();
    fetch(apiUrl('/api/admin/session'), {
      method: 'GET',
      credentials: 'include',
      cache: 'no-store',
      headers: savedToken ? { 'X-Admin-Session': savedToken } : undefined,
    })
      .then(async (r) => {
        const ct = (r.headers.get('content-type') || '').toLowerCase();
        if (!ct.includes('application/json')) return null;
        return (await r.json()) as {
          authenticated?: boolean;
          setupRequired?: boolean;
          sessionToken?: string;
        };
      })
      .then((data) => {
        if (!active) return;
        if (data) {
          backendAvailableRef.current = true;
          setBackendConnected(true);
          setAdminSetupRequired(Boolean(data.setupRequired));
          if (data.authenticated) {
            setPasswordAdminAuthed(true);
            if (data.sessionToken) {
              setAdminSessionToken(data.sessionToken);
            }
          } else if (savedToken) {
            setAdminSessionToken('');
          }
        }
      })
      .catch(() => {})
      .finally(() => {
        if (active) setSessionCheckReady(true);
      });

    return () => {
      active = false;
    };
  }, [setAdminSessionToken]);

  // Monitor optional Firebase Auth state (non-blocking for password session)
  useEffect(() => {
    const fallbackTimer = window.setTimeout(() => {
      setFirebaseAuthReady(true);
    }, 2500);

    const unsub = onAuthStateChanged(auth, (user) => {
      window.clearTimeout(fallbackTimer);
      setAdminUser(user);
      setFirebaseAuthReady(true);
    });
    return () => {
      window.clearTimeout(fallbackTimer);
      unsub();
    };
  }, []);

  // Initialize or disable Meta Pixel whenever configured in store settings
  useEffect(() => {
    initMetaPixel(settings.metaPixelId);
  }, [settings.metaPixelId]);

  useEffect(() => {
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
  }, [cart]);

  useEffect(() => {
    localStorage.setItem(WISHLIST_STORAGE_KEY, JSON.stringify(wishlist));
  }, [wishlist]);

  useEffect(() => {
    localStorage.setItem(RECENT_SEARCH_KEY, JSON.stringify(recentSearches));
  }, [recentSearches]);

  // Optional Maps public key lookup if Express backend exists locally
  useEffect(() => {
    if (!mapsApiKey) {
      fetch(apiUrl('/api/public-config'))
        .then((r) => {
          const ct = r.headers.get('content-type') || '';
          return r.ok && ct.toLowerCase().includes('application/json') ? r.json() : null;
        })
        .then((data) => {
          if (data?.mapsApiKey) setMapsApiKey(data.mapsApiKey);
        })
        .catch(() => {});
    }
  }, [mapsApiKey]);

  const refreshProducts = useCallback(async () => {
    if (adminLoadedRef.current) return;
    setProductsLoading(true);
    setProductsError(null);
    try {
      const data = await fetchPublicCatalog();
      if (!adminLoadedRef.current) {
        if (data.productsError && data.products.length === 0 && fsProductsRef.current.length === 0) {
          setProductsError(data.productsError);
        } else {
          setProductsError(null);
          const normalizedProds = data.products.map(normalizeProductMedia);
          apiProductsRef.current = normalizedProds;
          setAllProducts(normalizedProds);
        }
        setServerConnected(data.connected);
        if (data.backendAvailable) setBackendConnected(true);
        if (data.settings) {
          apiSettingsRef.current = data.settings;
          setSettings(mergeStoreSettings(data.settings));
        }
      }
    } catch {
      if (apiProductsRef.current.length === 0 && fsProductsRef.current.length === 0) {
        setProductsError('Unable to load products. Please try again.');
      }
    } finally {
      setProductsLoading(false);
    }
  }, []);

  // Initial Backend + Firestore catalog load & real-time Firestore listeners
  useEffect(() => {
    let active = true;
    setProductsLoading(true);
    setProductsError(null);

    void testConnection().then((ok) => {
      if (active && ok) setServerConnected(true);
    });

    fetchPublicCatalog()
      .then((data) => {
        if (!active || !data) return;
        backendAvailableRef.current = data.backendAvailable;
        if (data.backendAvailable) setBackendConnected(true);
        setServerConnected(Boolean(data.connected));
        if (!adminLoadedRef.current) {
          if (data.productsError && data.products.length === 0 && fsProductsRef.current.length === 0) {
            setProductsError(data.productsError);
          } else {
            setProductsError(null);
            const normalizedProds = data.products.map(normalizeProductMedia);
            apiProductsRef.current = normalizedProds;
            setAllProducts(normalizedProds);
          }
        }
        if (Array.isArray(data.categories) && data.categories.length > 0) {
          const nextCats = (
            isLegacySeedCategorySet(data.categories)
              ? DEFAULT_CATEGORIES
              : getSortedCategories(data.categories)
          ).map(normalizeCategoryMedia);
          apiCategoriesLoadedRef.current = true;
          setCategories(nextCats);
        }
        if (Array.isArray(data.collections) && data.collections.length > 0) {
          setCollections(data.collections.map(normalizeCollectionMedia));
        }
        if (Array.isArray(data.coupons)) {
          setCoupons(data.coupons);
        }
        if (Array.isArray(data.reviews)) {
          setReviews(data.reviews);
        }
        if (data.settings) {
          apiSettingsRef.current = data.settings;
          setSettings(mergeStoreSettings(data.settings));
        }
      })
      .catch(() => {
        if (!active) return;
        if (
          !adminLoadedRef.current &&
          apiProductsRef.current.length === 0 &&
          fsProductsRef.current.length === 0
        ) {
          setProductsError('Unable to load products. Please try again.');
        }
      })
      .finally(() => {
        if (active) setProductsLoading(false);
      });

    // Live public Firestore listeners (keep live Firestore authoritative once server snapshot arrives)
    const unsubProducts = onSnapshot(
      query(collection(db, 'products'), where('status', '==', 'Published')),
      (snap) => {
        fsProductsRef.current = snap.docs.map((d) =>
          normalizeProductMedia(d.data() as Product)
        );
        if (!adminLoadedRef.current) {
          const filteredFs = fsProductsRef.current.filter(
            (p) => !deletedProductIdsRef.current.has(p.id)
          );
          if (!snap.metadata.fromCache) {
            apiProductsRef.current = filteredFs;
            setAllProducts(filteredFs);
          } else {
            setAllProducts(mergeProductsByUpdatedAt(apiProductsRef.current, filteredFs));
          }
          setProductsError(null);
          setProductsLoading(false);
          setServerConnected(true);
        }
      },
      () => {
        // Non-fatal if Firestore listener interrupted; explicit fetch handles error reporting
      }
    );

    const unsubCategories = onSnapshot(
      collection(db, 'categories'),
      (snap) => {
        if (snap.docs.length > 0) {
          const rawList = snap.docs.map((d) => d.data() as Category);
          if (isLegacySeedCategorySet(rawList)) {
            if (!apiCategoriesLoadedRef.current) {
              setCategories(DEFAULT_CATEGORIES.map(normalizeCategoryMedia));
            }
            return;
          }
          setCategories(getSortedCategories(rawList).map(normalizeCategoryMedia));
        } else if (!apiCategoriesLoadedRef.current) {
          setCategories(DEFAULT_CATEGORIES.map(normalizeCategoryMedia));
        }
      },
      () => {}
    );

    const unsubCollections = onSnapshot(
      collection(db, 'collections'),
      (snap) => {
        if (snap.docs.length > 0) {
          setCollections(
            snap.docs.map((d) => normalizeCollectionMedia(d.data() as Collection))
          );
        }
      },
      () => {}
    );

    const unsubSettings = onSnapshot(
      doc(db, 'settings', 'store_config'),
      (snap) => {
        if (snap.exists()) {
          const fsSet = snap.data() as Partial<StoreSettings>;
          setSettings(
            mergeStoreSettings({
              ...fsSet,
              ...(apiSettingsRef.current || {}),
            })
          );
        }
      },
      () => {}
    );

    const unsubReviews = onSnapshot(
      collection(db, 'reviews'),
      (snap) => {
        const fsList = snap.docs.map((d) => d.data() as Review);
        setReviews((prev) => {
          const map = new Map<string, Review>();
          prev.forEach((r) => map.set(r.id, r));
          fsList.forEach((r) => map.set(r.id, r));
          return Array.from(map.values()).sort(
            (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          );
        });
      },
      () => {}
    );

    return () => {
      active = false;
      unsubProducts();
      unsubCategories();
      unsubCollections();
      unsubSettings();
      unsubReviews();
    };
  }, []);

  const refreshAdminData = useCallback(
    async (tokenOverride?: string) => {
      const effectiveToken = tokenOverride ?? adminSessionToken;
      if (!isAdminAuthenticated && !effectiveToken) return;
      try {
        const data = await fetchAdminProductsCatalog(effectiveToken);
        adminLoadedRef.current = true;
        if (data.backendAvailable) {
          backendAvailableRef.current = true;
          setBackendConnected(true);
        }
        if (Array.isArray(data.products)) {
          const normalizedProds = data.products.map(normalizeProductMedia);
          apiProductsRef.current = normalizedProds;
          setAllProducts(normalizedProds);
        }
        if (Array.isArray(data.categories) && data.categories.length > 0) {
          apiCategoriesLoadedRef.current = true;
          setCategories(
            (isLegacySeedCategorySet(data.categories)
              ? DEFAULT_CATEGORIES
              : getSortedCategories(data.categories)
            ).map(normalizeCategoryMedia)
          );
        }
        if (Array.isArray(data.collections) && data.collections.length > 0) {
          setCollections(data.collections.map(normalizeCollectionMedia));
        }
        if (Array.isArray(data.orders)) {
          const sorted = [...data.orders].sort(
            (a, b) =>
              new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          );
          setOrders(sorted);
          try {
            localStorage.setItem(LOCAL_ORDERS_KEY, JSON.stringify(sorted));
          } catch {
            // ignore
          }
        }
        if (Array.isArray(data.coupons)) {
          setCoupons(data.coupons);
        }
        if (Array.isArray(data.reviews)) {
          setReviews(data.reviews);
        }
        setServerConnected(true);
      } catch (err) {
        console.warn('Unable to refresh admin catalog:', err);
      }
    },
    [isAdminAuthenticated, adminSessionToken]
  );

  // Load full Admin catalog + orders whenever authenticated via password or Google
  useEffect(() => {
    if (!authReady || !isAdminAuthenticated) return;
    void refreshAdminData();

    if (!isVerifiedAdminUser(adminUser)) return;

    const unsubAllProducts = onSnapshot(
      collection(db, 'products'),
      (snap) => {
        fsProductsRef.current = snap.docs.map((d) =>
          normalizeProductMedia(d.data() as Product)
        );
        adminLoadedRef.current = true;
        const filteredFs = fsProductsRef.current.filter(
          (p) => !deletedProductIdsRef.current.has(p.id)
        );
        if (!snap.metadata.fromCache) {
          apiProductsRef.current = filteredFs;
          setAllProducts(filteredFs);
        } else {
          setAllProducts(mergeProductsByUpdatedAt(apiProductsRef.current, filteredFs));
        }
        setServerConnected(true);
      },
      () => {}
    );

    const unsubOrders = onSnapshot(
      collection(db, 'orders'),
      (snap) => {
        const fsOrders = snap.docs.map((d) => d.data() as Order);
        setOrders((prev) => {
          const map = new Map<string, Order>();
          fsOrders.forEach((o) => map.set(o.id, o));
          prev.forEach((o) => map.set(o.id, o));
          const sorted = Array.from(map.values()).sort(
            (a, b) =>
              new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          );
          try {
            localStorage.setItem(LOCAL_ORDERS_KEY, JSON.stringify(sorted));
          } catch {
            // ignore
          }
          return sorted;
        });
      },
      () => {}
    );

    const unsubCoupons = onSnapshot(
      collection(db, 'coupons'),
      (snap) => {
        const fsCoupons = snap.docs.map((d) => d.data() as Coupon);
        setCoupons((prev) => {
          const map = new Map<string, Coupon>();
          fsCoupons.forEach((c) => map.set(c.id, c));
          prev.forEach((c) => map.set(c.id, c));
          return Array.from(map.values());
        });
      },
      () => {}
    );

    return () => {
      unsubAllProducts();
      unsubOrders();
      unsubCoupons();
    };
  }, [authReady, isAdminAuthenticated, adminUser, refreshAdminData]);

  const setupAdminPassword = useCallback(
    async (password: string) => {
      const res = await fetch(apiUrl('/api/admin/setup-password'), {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      const ct = (res.headers.get('content-type') || '').toLowerCase();
      if (!ct.includes('application/json')) {
        throw new Error(
          'Password setup requires the Node backend server. Sign in with Google instead.'
        );
      }
      const data = (await res.json()) as {
        authenticated?: boolean;
        setupRequired?: boolean;
        sessionToken?: string;
        error?: string;
      };
      if (!res.ok || !data.authenticated) {
        if (data.setupRequired === false) setAdminSetupRequired(false);
        throw new Error(data.error || 'Unable to set administrator password.');
      }
      const tok = data.sessionToken || '';
      setAdminSetupRequired(false);
      setPasswordAdminAuthed(true);
      setAdminSessionToken(tok);
      await refreshAdminData(tok);
    },
    [refreshAdminData, setAdminSessionToken]
  );

  const loginAdminWithPassword = useCallback(
    async (password: string) => {
      const res = await fetch(apiUrl('/api/admin/login'), {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      const ct = (res.headers.get('content-type') || '').toLowerCase();
      if (!ct.includes('application/json')) {
        throw new Error(
          'Password authentication server is not running on this static host. Please sign in with Google below.'
        );
      }
      const data = (await res.json()) as {
        authenticated?: boolean;
        setupRequired?: boolean;
        sessionToken?: string;
        error?: string;
      };
      if (!res.ok || !data.authenticated) {
        if (data.setupRequired) setAdminSetupRequired(true);
        throw new Error(data.error || 'Invalid administrator password.');
      }
      const tok = data.sessionToken || '';
      setBackendConnected(true);
      backendAvailableRef.current = true;
      setAdminSetupRequired(false);
      setPasswordAdminAuthed(true);
      setAdminSessionToken(tok);
      await refreshAdminData(tok);
    },
    [refreshAdminData, setAdminSessionToken]
  );

  const signInAdmin = useCallback(async () => {
    const user = await signInAdminWithGoogle();
    setAdminUser(user);
    let sessionTok = adminSessionToken;
    try {
      const firebaseIdToken = await user.getIdToken();
      const res = await fetch(apiUrl('/api/admin/session'), {
        method: 'GET',
        credentials: 'include',
        cache: 'no-store',
        headers: firebaseIdToken ? { 'X-Firebase-Id-Token': firebaseIdToken } : undefined,
      });
      const ct = (res.headers.get('content-type') || '').toLowerCase();
      if (res.ok && ct.includes('application/json')) {
        const data = (await res.json()) as { authenticated?: boolean; sessionToken?: string };
        backendAvailableRef.current = true;
        setBackendConnected(true);
        if (data.authenticated && data.sessionToken) {
          sessionTok = data.sessionToken;
          setAdminSessionToken(data.sessionToken);
        }
      }
    } catch {
      // Static Firebase-only host without Node backend
    }
    await refreshAdminData(sessionTok || undefined);
    return user;
  }, [adminSessionToken, refreshAdminData, setAdminSessionToken]);

  const signOutAdminUser = useCallback(async () => {
    try {
      await fetch(apiUrl('/api/admin/logout'), {
        method: 'POST',
        credentials: 'include',
        headers: adminSessionToken ? { 'X-Admin-Session': adminSessionToken } : undefined,
      });
    } catch {
      // ignore network error during logout
    }
    await signOutAdmin().catch(() => {});
    setPasswordAdminAuthed(false);
    setAdminUser(null);
    setAdminSessionToken('');
    adminLoadedRef.current = false;
    await refreshProducts();
  }, [adminSessionToken, refreshProducts, setAdminSessionToken]);

  const addToCart = useCallback(
    (
      product: Product,
      opts: { color: string; size: string; quantity?: number; openDrawer?: boolean }
    ) => {
      const qty = Math.min(20, Math.max(1, opts.quantity || 1));
      const itemId = sanitizeDocId(`${product.id}-${opts.color}-${opts.size}`);

      setCart((prev) => {
        const existing = prev.find((i) => i.id === itemId);
        if (existing) {
          const nextQty = Math.min(20, existing.quantity + qty);
          return prev.map((i) => (i.id === itemId ? { ...i, quantity: nextQty } : i));
        }
        const newItem: CartItem = {
          id: itemId,
          productId: product.id,
          sku: product.sku,
          name: product.name,
          slug: product.slug,
          price: product.price,
          image: product.primaryImage || product.images[0] || '',
          color: opts.color,
          size: opts.size,
          quantity: qty,
        };
        return [...prev, newItem];
      });

      trackPixelEvent('AddToCart', {
        content_name: product.name,
        content_ids: [product.id],
        content_category: product.category,
        content_type: 'product',
        contents: [
          {
            id: product.id,
            quantity: qty,
            item_price: product.price,
          },
        ],
        num_items: qty,
        value: product.price * qty,
        currency: 'BDT',
      });
      if (opts.openDrawer !== false) {
        setIsCartOpen(true);
      }
      showToast(`Added ${product.name} to bag`);
    },
    [showToast]
  );

  const updateCartQuantity = useCallback((itemId: string, quantity: number) => {
    if (quantity <= 0) {
      setCart((prev) => prev.filter((i) => i.id !== itemId));
      return;
    }
    const clamped = Math.min(20, Math.max(1, Math.round(quantity)));
    setCart((prev) =>
      prev.map((i) => (i.id === itemId ? { ...i, quantity: clamped } : i))
    );
  }, []);

  const removeFromCart = useCallback((itemId: string) => {
    setCart((prev) => prev.filter((i) => i.id !== itemId));
  }, []);

  const clearCart = useCallback(() => {
    setCart([]);
    setAppliedCoupon(null);
  }, []);

  const toggleWishlist = useCallback(
    (productId: string) => {
      const exists = wishlist.includes(productId);
      setWishlist((prev) =>
        exists ? prev.filter((id) => id !== productId) : [...prev, productId]
      );
      showToast(exists ? 'Removed from wishlist' : 'Saved to wishlist');
    },
    [wishlist, showToast]
  );

  const isInWishlist = useCallback(
    (productId: string) => wishlist.includes(productId),
    [wishlist]
  );

  const applyCouponCode = useCallback(
    (rawCode: string, overrideSubtotal?: number) => {
      const normalized = rawCode.trim().toUpperCase();
      const found = coupons.find(
        (c) => c.code.toUpperCase() === normalized && c.active
      );
      if (!found) {
        return { ok: false, message: 'Invalid or expired promo code.' };
      }
      if (found.expiryDate && new Date(found.expiryDate) < new Date()) {
        return { ok: false, message: 'This promo code has expired.' };
      }
      if (found.usageLimit && found.usageCount >= found.usageLimit) {
        return { ok: false, message: 'This promo code has reached its usage limit.' };
      }
      const subtotal =
        typeof overrideSubtotal === 'number'
          ? overrideSubtotal
          : cart.reduce((sum, i) => sum + i.price * i.quantity, 0);
      if (subtotal < found.minOrder) {
        return {
          ok: false,
          message: `Minimum order of ৳${found.minOrder.toLocaleString('en-US')} required for ${found.code}.`,
        };
      }
      setAppliedCoupon(found);
      return { ok: true, message: `Promo code ${found.code} applied.` };
    },
    [coupons, cart]
  );

  const removeCoupon = useCallback(() => setAppliedCoupon(null), []);

  const addRecentSearch = useCallback((term: string) => {
    const clean = term.trim();
    if (!clean) return;
    setRecentSearches((prev) =>
      [clean, ...prev.filter((t) => t.toLowerCase() !== clean.toLowerCase())].slice(0, 6)
    );
  }, []);

  const placeOrder = useCallback(
    async (
      orderData: Omit<
        Order,
        'id' | 'orderNumber' | 'status' | 'paymentStatus' | 'deliveryStatus' | 'createdAt'
      > & { orderNumber?: string }
    ): Promise<Order> => {
      const orderId = sanitizeDocId(
        `ord-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`
      );
      const orderNumber =
        orderData.orderNumber ||
        `PYX-${String(Math.floor(1000 + Math.random() * 9000))}`;
      const nowIso = new Date().toISOString();

      const cleanArea = (orderData.area || orderData.city || 'Dhaka').trim().slice(0, 80);
      const cleanPostal = (orderData.postalCode || '1340').trim().slice(0, 20);

      const newOrder: Order = cleanFirestorePayload<Order>({
        ...orderData,
        id: orderId,
        orderNumber: orderNumber.slice(0, 40),
        userId: auth.currentUser?.uid || undefined,
        area: cleanArea.length >= 2 ? cleanArea : 'Dhaka',
        postalCode: cleanPostal.length >= 3 ? cleanPostal : '1340',
        customerName: orderData.customerName.trim().slice(0, 120),
        customerEmail: orderData.customerEmail.trim().slice(0, 200),
        customerPhone: orderData.customerPhone.trim().slice(0, 25),
        address: orderData.address.trim().slice(0, 300),
        city: orderData.city.trim().slice(0, 80),
        deliveryStatus: 'Awaiting studio confirmation',
        deliveryNote: orderData.deliveryNote?.trim().slice(0, 500),
        paymentReference: orderData.paymentReference?.trim().slice(0, 120),
        paymentSenderNumber: orderData.paymentSenderNumber?.trim().slice(0, 30),
        couponCode: orderData.couponCode?.trim().slice(0, 40),
        items: (orderData.items || []).slice(0, 50),
        subtotal: Math.max(0, Number(orderData.subtotal) || 0),
        shipping: Math.max(0, Number(orderData.shipping) || 0),
        discount: Math.max(0, Number(orderData.discount) || 0),
        total: Math.max(0, Number(orderData.total) || 0),
        status: 'Order Received',
        paymentStatus: 'Pending',
        createdAt: nowIso,
      });

      const trackingId = buildTrackingDocId(newOrder.orderNumber, newOrder.customerPhone);
      const trackingPayload = cleanFirestorePayload({
        id: trackingId,
        orderId: newOrder.id,
        orderNumber: newOrder.orderNumber,
        status: newOrder.status,
        paymentStatus: newOrder.paymentStatus,
        deliveryStatus: newOrder.deliveryStatus,
        deliveryMethod: newOrder.deliveryMethod,
        city: newOrder.city,
        total: newOrder.total,
        itemCount: Math.max(
          1,
          newOrder.items.reduce((sum, item) => sum + (Number(item.quantity) || 1), 0)
        ),
        createdAt: newOrder.createdAt,
      });

      let savedOrder: Order = newOrder;
      let backendSaved = false;

      try {
        const res = await fetch(apiUrl('/api/orders'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newOrder),
        });
        const ct = (res.headers.get('content-type') || '').toLowerCase();
        if (ct.includes('application/json')) {
          const data = (await res.json()) as { order?: Order; error?: string };
          if (!res.ok) {
            throw new Error(data.error || 'Unable to submit order.');
          }
          if (data.order) {
            savedOrder = data.order;
            backendSaved = true;
          }
        }
      } catch (err) {
        if (backendAvailableRef.current) {
          throw err instanceof Error ? err : new Error('Unable to submit order.');
        }
      }

      if (!backendSaved || isVerifiedAdminUser(auth.currentUser)) {
        try {
          const batch = writeBatch(db);
          batch.set(doc(db, 'orders', savedOrder.id), savedOrder);
          batch.set(doc(db, 'order_tracking', trackingId), trackingPayload);
          await batch.commit();
        } catch (err) {
          if (!backendSaved) {
            handleFirestoreError(err, OperationType.CREATE, `orders/${savedOrder.id}`);
          }
        }
      }

      setOrders((prev) => {
        const next = [savedOrder, ...prev.filter((o) => o.id !== savedOrder.id)];
        try {
          localStorage.setItem(LOCAL_ORDERS_KEY, JSON.stringify(next));
        } catch {
          // ignore
        }
        return next;
      });

      const categoryByProductId = new Map<string, string>();
      for (const prod of productsRef.current) {
        if (prod.id && prod.category) {
          categoryByProductId.set(prod.id, prod.category);
        }
      }
      trackPurchaseEvent(savedOrder, categoryByProductId);

      clearCart();
      return savedOrder;
    },
    [clearCart]
  );

  const trackOrder = useCallback(
    (orderNumber: string, phone: string): Order | null => {
      const cleanOrd = orderNumber.trim().toUpperCase();
      const cleanPhone = phone.replace(/\D/g, '').slice(-10);
      return (
        orders.find((o) => {
          const ordMatch = o.orderNumber.toUpperCase() === cleanOrd;
          const phoneMatch = o.customerPhone.replace(/\D/g, '').slice(-10) === cleanPhone;
          return ordMatch && phoneMatch;
        }) || null
      );
    },
    [orders]
  );

  const fetchTrackedOrder = useCallback(
    async (orderNumber: string, phone: string): Promise<Order | null> => {
      const localMatch = trackOrder(orderNumber, phone);
      try {
        const res = await fetch(
          apiUrl(
            `/api/orders/track?orderNumber=${encodeURIComponent(orderNumber)}&phone=${encodeURIComponent(
              phone
            )}`
          ),
          { cache: 'no-store' }
        );
        const ct = (res.headers.get('content-type') || '').toLowerCase();
        if (res.ok && ct.includes('application/json')) {
          const data = (await res.json()) as { order?: Order };
          if (data.order) return data.order;
        }
      } catch {
        // Fallback to Firestore
      }

      const trackingId = buildTrackingDocId(orderNumber, phone);
      if (!trackingId) return localMatch;

      try {
        const snap = await getDoc(doc(db, 'order_tracking', trackingId));
        if (snap.exists()) {
          const data = snap.data() as {
            orderId: string;
            orderNumber: string;
            status: OrderStatus;
            paymentStatus: PaymentStatus;
            deliveryStatus: string;
            deliveryMethod: Order['deliveryMethod'];
            city?: string;
            total: number;
            createdAt: string;
          };
          if (localMatch) {
            return {
              ...localMatch,
              status: data.status,
              paymentStatus: data.paymentStatus,
              deliveryStatus: data.deliveryStatus,
            };
          }
          return {
            id: data.orderId,
            orderNumber: data.orderNumber,
            customerName: 'Verified Order',
            customerEmail: '',
            customerPhone: phone,
            address: '',
            city: data.city || 'Bangladesh',
            area: '',
            postalCode: '',
            deliveryMethod: data.deliveryMethod,
            paymentMethod: 'Cash on Delivery',
            paymentStatus: data.paymentStatus,
            deliveryStatus: data.deliveryStatus,
            items: [],
            subtotal: data.total,
            shipping: 0,
            discount: 0,
            total: data.total,
            status: data.status,
            createdAt: data.createdAt,
          };
        }
      } catch {
        // Fallback cleanly to local match
      }
      return localMatch;
    },
    [trackOrder]
  );

  const submitReview = useCallback(
    async (input: {
      productId: string;
      productName?: string;
      rating: number;
      comment: string;
      authorName?: string;
    }) => {
      const reviewId = sanitizeDocId(`rev-${Date.now()}-${Math.floor(10 + Math.random() * 89)}`);
      let review: Review = cleanFirestorePayload<Review>({
        id: reviewId,
        productId: sanitizeDocId(input.productId),
        productName: input.productName?.trim().slice(0, 200),
        userId: auth.currentUser?.uid || undefined,
        authorName: (input.authorName?.trim() || 'Verified Customer').slice(0, 80),
        rating: Math.min(5, Math.max(1, Math.round(input.rating))),
        comment: input.comment.trim().slice(0, 1000),
        createdAt: new Date().toISOString(),
      });
      let backendSaved = false;
      try {
        const res = await fetch(apiUrl('/api/reviews'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(input),
        });
        const ct = (res.headers.get('content-type') || '').toLowerCase();
        if (res.ok && ct.includes('application/json')) {
          const data = (await res.json()) as { review?: Review };
          if (data.review) {
            review = data.review;
            backendSaved = true;
          }
        }
      } catch {
        // fallback below
      }

      if (!backendSaved) {
        try {
          await setDoc(doc(db, 'reviews', review.id), review);
        } catch (err) {
          handleFirestoreError(err, OperationType.CREATE, `reviews/${review.id}`);
        }
      }
      setReviews((prev) => [review, ...prev.filter((r) => r.id !== review.id)]);
      showToast('Review published');
    },
    [showToast]
  );

  const upsertProduct = useCallback(
    async (product: Product): Promise<Product> => {
      if (!isVerifiedAdminUser(auth.currentUser)) {
        throw new Error(
          'Google Admin sign-in (lord79915@gmail.com or pythoxfashion@gmail.com) is required to permanently save products to Firestore. Click "Link Cloud Sync" above.'
        );
      }

      let cleanProduct = clampProductForFirestore(product);
      if (!cleanProduct.name || !cleanProduct.sku || !cleanProduct.category || cleanProduct.price <= 0) {
        throw new Error('Product Name, SKU, Category, and valid Price are required.');
      }
      const hasInvalidImageUrl = cleanProduct.images.some(
        (img) =>
          !img ||
          img.startsWith('blob:') ||
          img.startsWith('data:') ||
          img.startsWith('/uploads/')
      );
      if (cleanProduct.images.length === 0 || hasInvalidImageUrl) {
        throw new Error(
          'All product images must have valid permanent cloud URLs before saving. Please re-upload your image(s).'
        );
      }
      if (
        cleanProduct.videoUrl &&
        (cleanProduct.videoUrl.startsWith('blob:') ||
          cleanProduct.videoUrl.startsWith('data:'))
      ) {
        throw new Error(
          'Product video upload did not finish with a valid storage URL. Please retry the video upload.'
        );
      }

      const exists = allProducts.some((p) => p.id === cleanProduct.id);

      // Preserve existing Firestore created_at timestamp so update rules always pass
      try {
        const existingSnap = await getDocFromServer(doc(db, 'products', cleanProduct.id));
        if (existingSnap.exists()) {
          const existingCreated = (existingSnap.data() as Partial<Product>).created_at;
          if (typeof existingCreated === 'string' && existingCreated) {
            cleanProduct = clampProductForFirestore({
              ...cleanProduct,
              created_at: existingCreated,
            });
          }
        }
      } catch {
        // Proceed if document does not exist yet
      }

      console.info('[Product:FirestoreSave]', {
        ts: new Date().toISOString(),
        productId: cleanProduct.id,
        sku: cleanProduct.sku,
        status: cleanProduct.status,
        imageCount: cleanProduct.images.length,
        hasVideo: Boolean(cleanProduct.videoUrl),
      });

      const apiRes = await adminApiCall<{
        ok?: boolean;
        product?: Product;
        persistedToCloud?: boolean;
      }>('/api/admin/products', 'POST', { product: cleanProduct }).catch((err) => {
        // Re-throw real backend validation/auth errors; only allow Firestore direct fallback if backend is absent
        if (err instanceof Error && !err.message.toLowerCase().includes('failed to fetch')) {
          throw err;
        }
        return null;
      });

      if (apiRes?.product) {
        cleanProduct = clampProductForFirestore(apiRes.product);
      }

      try {
        await setDoc(doc(db, 'products', cleanProduct.id), cleanProduct);
        const verified = await verifyProductPersisted(cleanProduct.id);
        if (!verified) {
          throw new Error(
            'Product save could not be verified on Cloud Firestore. Please retry.'
          );
        }
        if (verified.status !== cleanProduct.status) {
          throw new Error(
            `Product publish status verification failed (expected "${cleanProduct.status}", got "${verified.status}"). Please retry.`
          );
        }
        if (!Array.isArray(verified.images) || verified.images.length === 0) {
          throw new Error(
            'Saved Firestore product is missing image URLs. Please retry saving.'
          );
        }
        cleanProduct = normalizeProductMedia(clampProductForFirestore(verified));
        console.info('[Product:PublishConfirm]', {
          ts: new Date().toISOString(),
          productId: cleanProduct.id,
          sku: cleanProduct.sku,
          status: cleanProduct.status,
          imageCount: cleanProduct.images.length,
          hasVideo: Boolean(cleanProduct.videoUrl),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `products/${cleanProduct.id}`);
      }

      deletedProductIdsRef.current.delete(cleanProduct.id);
      apiProductsRef.current = apiProductsRef.current.some((p) => p.id === cleanProduct.id)
        ? apiProductsRef.current.map((p) => (p.id === cleanProduct.id ? cleanProduct : p))
        : [cleanProduct, ...apiProductsRef.current];
      setProductsError(null);

      setAllProducts((prev) => {
        const prevExists = prev.some((p) => p.id === cleanProduct.id);
        return prevExists
          ? prev.map((p) => (p.id === cleanProduct.id ? cleanProduct : p))
          : [cleanProduct, ...prev];
      });
      setServerConnected(true);
      if (exists) {
        showToast(
          cleanProduct.status === 'Published'
            ? 'Product updated & saved to Cloud Database'
            : `Product updated (${cleanProduct.status})`
        );
      } else {
        showToast(
          cleanProduct.status === 'Published'
            ? 'Product published & permanently saved to Cloud Database'
            : `Product saved as ${cleanProduct.status}`
        );
      }
      return cleanProduct;
    },
    [allProducts, adminApiCall, showToast]
  );

  const duplicateProduct = useCallback(
    async (product: Product): Promise<Product> => {
      const nowIso = new Date().toISOString();
      const suffix = Math.floor(100 + Math.random() * 899);
      const copyPayload: Product = {
        ...product,
        id: sanitizeDocId(`prod-${Date.now()}-${suffix}`),
        sku: `${product.sku}-COPY-${suffix}`,
        name: `${product.name} (Copy)`,
        slug: `${product.slug}-copy-${suffix}`,
        status: 'Draft',
        created_at: nowIso,
        updated_at: nowIso,
      };
      return upsertProduct(copyPayload);
    },
    [upsertProduct]
  );

  const deleteProduct = useCallback(
    async (productId: string) => {
      if (!isVerifiedAdminUser(auth.currentUser)) {
        throw new Error(
          'Google Admin sign-in is required to permanently delete products from Cloud Database.'
        );
      }
      const cleanId = sanitizeDocId(productId);
      await adminApiCall<{ ok?: boolean }>(
        `/api/admin/products/${encodeURIComponent(cleanId)}`,
        'DELETE'
      ).catch((err) => {
        if (err instanceof Error && !err.message.toLowerCase().includes('failed to fetch')) {
          throw err;
        }
        return null;
      });
      try {
        await deleteDoc(doc(db, 'products', cleanId));
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `products/${cleanId}`);
      }
      deletedProductIdsRef.current.add(cleanId);
      apiProductsRef.current = apiProductsRef.current.filter((p) => p.id !== cleanId);
      setAllProducts((prev) => prev.filter((p) => p.id !== cleanId));
      showToast('Product permanently deleted');
    },
    [adminApiCall, showToast]
  );

  const upsertCategory = useCallback(
    async (cat: Category) => {
      const cleanCat = clampCategoryForFirestore(cat);
      const apiRes = await adminApiCall<{ ok?: boolean; categories?: Category[] }>(
        '/api/admin/categories',
        'POST',
        { category: cleanCat, allCategories: categories }
      );
      if (isVerifiedAdminUser(auth.currentUser)) {
        try {
          await setDoc(doc(db, 'categories', cleanCat.id), cleanCat);
        } catch (err) {
          if (!apiRes) {
            handleFirestoreError(err, OperationType.WRITE, `categories/${cleanCat.id}`);
          }
        }
      } else if (!apiRes) {
        throw new Error('Administrator session expired. Please log in again.');
      }
      apiCategoriesLoadedRef.current = true;
      setCategories((prev) => {
        const nextList = prev.some((c) => c.id === cleanCat.id)
          ? prev.map((c) => (c.id === cleanCat.id ? cleanCat : c))
          : [...prev, cleanCat];
        return [...nextList].sort((a, b) => a.display_order - b.display_order);
      });
      showToast('Category saved');
    },
    [adminApiCall, categories, showToast]
  );

  const deleteCategory = useCallback(
    async (categoryId: string) => {
      const cleanId = sanitizeDocId(categoryId);
      const apiRes = await adminApiCall<{ ok?: boolean }>(
        `/api/admin/categories/${encodeURIComponent(cleanId)}`,
        'DELETE',
        { allCategories: categories }
      );
      if (isVerifiedAdminUser(auth.currentUser)) {
        try {
          await deleteDoc(doc(db, 'categories', cleanId));
        } catch (err) {
          if (!apiRes) {
            handleFirestoreError(err, OperationType.DELETE, `categories/${cleanId}`);
          }
        }
      } else if (!apiRes) {
        throw new Error('Administrator session expired. Please log in again.');
      }
      setCategories((prev) => prev.filter((c) => c.id !== cleanId));
      showToast('Category deleted');
    },
    [adminApiCall, categories, showToast]
  );

  const reorderCategories = useCallback(
    async (orderedCategories: Category[]) => {
      const updated = orderedCategories.map((cat, idx) =>
        clampCategoryForFirestore({
          ...cat,
          display_order: idx + 1,
        })
      );
      const apiRes = await adminApiCall<{ ok?: boolean }>(
        '/api/admin/categories/batch',
        'PUT',
        { categories: updated }
      );
      if (isVerifiedAdminUser(auth.currentUser)) {
        try {
          const batch = writeBatch(db);
          updated.forEach((cat) => {
            batch.set(doc(db, 'categories', cat.id), cat);
          });
          await batch.commit();
        } catch (err) {
          if (!apiRes) {
            handleFirestoreError(err, OperationType.WRITE, 'categories/reorder');
          }
        }
      } else if (!apiRes) {
        throw new Error('Administrator session expired. Please log in again.');
      }
      apiCategoriesLoadedRef.current = true;
      setCategories(updated);
      showToast('Category order updated');
    },
    [adminApiCall, showToast]
  );

  const restoreDefaultCategories = useCallback(async () => {
    const legacyIds = ['cat-tees', 'cat-outerwear', 'cat-shirts-bottoms', 'cat-footwear-acc'];
    const defaults = DEFAULT_CATEGORIES.map((cat) => clampCategoryForFirestore(cat));
    const apiRes = await adminApiCall<{ ok?: boolean }>(
      '/api/admin/categories/batch',
      'PUT',
      { categories: defaults }
    );
    if (isVerifiedAdminUser(auth.currentUser)) {
      try {
        const batch = writeBatch(db);
        legacyIds.forEach((oldId) => {
          batch.delete(doc(db, 'categories', oldId));
        });
        defaults.forEach((cat) => {
          batch.set(doc(db, 'categories', cat.id), cat);
        });
        await batch.commit();
      } catch (err) {
        if (!apiRes) {
          handleFirestoreError(err, OperationType.WRITE, 'categories/restoreDefaults');
        }
      }
    } else if (!apiRes) {
      throw new Error('Administrator session expired. Please log in again.');
    }
    apiCategoriesLoadedRef.current = true;
    setCategories(defaults);
    showToast("Default Men's Fashion categories restored");
  }, [adminApiCall, showToast]);

  const upsertCollection = useCallback(
    async (col: Collection) => {
      const cleanCol = clampCollectionForFirestore(col);
      const apiRes = await adminApiCall<{ ok?: boolean }>(
        '/api/admin/collections',
        'POST',
        { collection: cleanCol, allCollections: collections }
      );
      if (isVerifiedAdminUser(auth.currentUser)) {
        try {
          await setDoc(doc(db, 'collections', cleanCol.id), cleanCol);
        } catch (err) {
          if (!apiRes) {
            handleFirestoreError(err, OperationType.WRITE, `collections/${cleanCol.id}`);
          }
        }
      } else if (!apiRes) {
        throw new Error('Administrator session expired. Please log in again.');
      }
      setCollections((prev) =>
        prev.some((c) => c.id === cleanCol.id)
          ? prev.map((c) => (c.id === cleanCol.id ? cleanCol : c))
          : [...prev, cleanCol]
      );
      showToast('Collection updated');
    },
    [adminApiCall, collections, showToast]
  );

  const upsertCoupon = useCallback(
    async (coupon: Coupon) => {
      const payload = clampCouponForFirestore(coupon);
      const apiRes = await adminApiCall<{ ok?: boolean }>(
        '/api/admin/coupons',
        'POST',
        { coupon: payload, allCoupons: coupons }
      );
      if (isVerifiedAdminUser(auth.currentUser)) {
        try {
          await setDoc(doc(db, 'coupons', payload.id), payload);
        } catch (err) {
          if (!apiRes) {
            handleFirestoreError(err, OperationType.WRITE, `coupons/${payload.id}`);
          }
        }
      } else if (!apiRes) {
        throw new Error('Administrator session expired. Please log in again.');
      }
      setCoupons((prev) =>
        prev.some((c) => c.id === payload.id)
          ? prev.map((c) => (c.id === payload.id ? payload : c))
          : [...prev, payload]
      );
      showToast('Coupon saved');
    },
    [adminApiCall, coupons, showToast]
  );

  const deleteCoupon = useCallback(
    async (couponId: string) => {
      const cleanId = sanitizeDocId(couponId);
      const apiRes = await adminApiCall<{ ok?: boolean }>(
        `/api/admin/coupons/${encodeURIComponent(cleanId)}`,
        'DELETE'
      );
      if (isVerifiedAdminUser(auth.currentUser)) {
        try {
          await deleteDoc(doc(db, 'coupons', cleanId));
        } catch (err) {
          if (!apiRes) {
            handleFirestoreError(err, OperationType.DELETE, `coupons/${cleanId}`);
          }
        }
      } else if (!apiRes) {
        throw new Error('Administrator session expired. Please log in again.');
      }
      setCoupons((prev) => prev.filter((c) => c.id !== cleanId));
      showToast('Coupon removed');
    },
    [adminApiCall, showToast]
  );

  const updateOrderDetails = useCallback(
    async (
      orderId: string,
      patch: { status?: OrderStatus; paymentStatus?: PaymentStatus; deliveryStatus?: string }
    ) => {
      const cleanId = sanitizeDocId(orderId);
      const existingOrder = orders.find((o) => o.id === cleanId);
      if (!existingOrder) return;

      const updatedOrder: Order = cleanFirestorePayload<Order>({
        ...existingOrder,
        ...patch,
        updatedAt: new Date().toISOString(),
      });

      const apiRes = await adminApiCall<{ ok?: boolean }>(
        `/api/admin/orders/${encodeURIComponent(cleanId)}`,
        'PATCH',
        patch
      );

      const trackingId = buildTrackingDocId(
        updatedOrder.orderNumber,
        updatedOrder.customerPhone
      );
      const trackingPayload = cleanFirestorePayload({
        id: trackingId,
        orderId: updatedOrder.id,
        orderNumber: updatedOrder.orderNumber,
        status: updatedOrder.status,
        paymentStatus: updatedOrder.paymentStatus,
        deliveryStatus: updatedOrder.deliveryStatus,
        deliveryMethod: updatedOrder.deliveryMethod,
        city: updatedOrder.city,
        total: updatedOrder.total,
        itemCount: Math.max(
          1,
          updatedOrder.items.reduce((sum, item) => sum + (Number(item.quantity) || 1), 0)
        ),
        createdAt: updatedOrder.createdAt,
      });

      if (isVerifiedAdminUser(auth.currentUser)) {
        try {
          const batch = writeBatch(db);
          batch.set(doc(db, 'orders', cleanId), updatedOrder);
          batch.set(doc(db, 'order_tracking', trackingId), trackingPayload);
          await batch.commit();
        } catch (err) {
          if (!apiRes) {
            handleFirestoreError(err, OperationType.UPDATE, `orders/${cleanId}`);
          }
        }
      } else if (!apiRes) {
        throw new Error('Administrator session expired. Please log in again.');
      }

      setOrders((prev) => {
        const next = prev.map((o) => (o.id === cleanId ? updatedOrder : o));
        try {
          localStorage.setItem(LOCAL_ORDERS_KEY, JSON.stringify(next));
        } catch {
          // ignore storage
        }
        return next;
      });
      showToast('Order updated');
    },
    [adminApiCall, orders, showToast]
  );

  const updateOrderStatus = useCallback(
    async (orderId: string, status: OrderStatus) => {
      await updateOrderDetails(orderId, { status });
    },
    [updateOrderDetails]
  );

  const updateStoreSettings = useCallback(
    async (next: Partial<StoreSettings>) => {
      const merged = clampSettingsForFirestore({
        ...settings,
        ...next,
        id: 'store_config',
      });
      const apiRes = await adminApiCall<{ ok?: boolean; settings?: StoreSettings }>(
        '/api/admin/settings',
        'PUT',
        merged
      );
      if (isVerifiedAdminUser(auth.currentUser)) {
        try {
          await setDoc(doc(db, 'settings', 'store_config'), merged);
        } catch (err) {
          if (!apiRes) {
            handleFirestoreError(err, OperationType.WRITE, 'settings/store_config');
          }
        }
      } else if (!apiRes) {
        throw new Error('Administrator session expired. Please log in again.');
      }
      apiSettingsRef.current = merged;
      setSettings(merged);
      showToast('Store settings saved');
    },
    [adminApiCall, settings, showToast]
  );

  const syncCatalog = useCallback(async () => {
    if (!isAdminAuthenticated) {
      showToast('Please unlock the Admin Panel to sync catalog');
      return;
    }
    const cleanCategories = categories.map(normalizeCategoryMedia);
    const cleanCollections = collections.map(normalizeCollectionMedia);
    const cleanSettings = clampSettingsForFirestore(settings);

    const apiRes = await adminApiCall<{ ok?: boolean }>(
      '/api/admin/sync-catalog',
      'POST',
      {
        categories: cleanCategories,
        collections: cleanCollections,
        coupons,
        settings: cleanSettings,
      }
    );

    if (isVerifiedAdminUser(auth.currentUser)) {
      const legacyCatIds = [
        'cat-tees',
        'cat-outerwear',
        'cat-shirts-bottoms',
        'cat-footwear-acc',
      ];
      try {
        const batch = writeBatch(db);
        legacyCatIds.forEach((oldId) => {
          batch.delete(doc(db, 'categories', oldId));
        });
        allProducts.forEach((p) => {
          const clean = clampProductForFirestore(normalizeProductMedia(p));
          batch.set(doc(db, 'products', clean.id), clean);
        });
        cleanCategories.forEach((c) => {
          const clean = clampCategoryForFirestore(c);
          batch.set(doc(db, 'categories', clean.id), clean);
        });
        cleanCollections.forEach((c) => {
          const clean = clampCollectionForFirestore(c);
          batch.set(doc(db, 'collections', clean.id), clean);
        });
        coupons.forEach((c) => {
          const clean = clampCouponForFirestore(c);
          batch.set(doc(db, 'coupons', clean.id), clean);
        });
        batch.set(doc(db, 'settings', 'store_config'), cleanSettings);
        await batch.commit();
      } catch (err) {
        if (!apiRes) {
          handleFirestoreError(err, OperationType.WRITE, 'syncCatalog');
        }
      }
    } else if (!apiRes) {
      throw new Error('Administrator session expired. Please log in again.');
    }

    setCategories(cleanCategories);
    setCollections(cleanCollections);
    setSettings(cleanSettings);
    setServerConnected(true);
    showToast(
      isVerifiedAdminUser(auth.currentUser)
        ? 'PYTHOX WORLD catalog & Firebase Cloud synced'
        : 'PYTHOX WORLD catalog synced'
    );
  }, [
    isAdminAuthenticated,
    adminApiCall,
    allProducts,
    categories,
    collections,
    coupons,
    settings,
    showToast,
  ]);

  return (
    <StoreContext.Provider
      value={{
        serverConnected,
        backendConnected,
        isFirebaseAdminLinked,
        productsLoading,
        productsError,
        mapsApiKey,
        authReady,
        isAdminAuthenticated,
        adminSetupRequired,
        adminUserEmail,
        adminSessionToken,
        setAdminSessionToken,
        setupAdminPassword,
        loginAdminWithPassword,
        signInAdmin,
        signOutAdminUser,
        refreshProducts,
        refreshAdminData,
        products,
        adminProducts: allProducts,
        categories,
        collections,
        coupons,
        reviews,
        orders,
        settings,
        cart,
        wishlist,
        appliedCoupon,
        recentSearches,
        isCartOpen,
        isSearchOpen,
        isMobileMenuOpen,
        isQrScannerOpen,
        language,
        toast,
        setIsCartOpen,
        setIsSearchOpen,
        setIsMobileMenuOpen,
        setIsQrScannerOpen,
        setLanguage,
        t,
        showToast,
        addToCart,
        updateCartQuantity,
        removeFromCart,
        clearCart,
        toggleWishlist,
        isInWishlist,
        applyCouponCode,
        removeCoupon,
        addRecentSearch,
        placeOrder,
        trackOrder,
        fetchTrackedOrder,
        submitReview,
        upsertProduct,
        duplicateProduct,
        deleteProduct,
        upsertCategory,
        deleteCategory,
        reorderCategories,
        restoreDefaultCategories,
        upsertCollection,
        upsertCoupon,
        deleteCoupon,
        updateOrderStatus,
        updateOrderDetails,
        updateStoreSettings,
        syncCatalog,
      }}
    >
      {children}
    </StoreContext.Provider>
  );
};

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used within StoreProvider');
  return ctx;
}
