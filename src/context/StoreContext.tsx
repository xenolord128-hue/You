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
} from '../config/storeConfig';
import { sanitizeDocId } from '../lib/formatters';
import { initMetaPixel, trackPixelEvent } from '../lib/metaPixel';
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
  fetchPublishedProducts,
} from '../services/productService';

interface StoreContextValue {
  serverConnected: boolean;
  productsLoading: boolean;
  mapsApiKey: string;
  authReady: boolean;
  isAdminAuthenticated: boolean;
  adminUserEmail: string;
  adminSessionToken: string;
  setAdminSessionToken: (token: string) => void;
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
    heroImageUrl: (nextSettings.heroImageUrl || '').slice(0, 2000),
  });
}

export const StoreProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [serverConnected, setServerConnected] = useState(false);
  const [authReady, setAuthReady] = useState(false);
  const [adminUser, setAdminUser] = useState<User | null>(null);
  const [adminSessionToken, setAdminSessionToken] = useState<string>('');
  const [mapsApiKey, setMapsApiKey] = useState<string>(
    (import.meta as any).env?.VITE_GOOGLE_MAPS_API_KEY || ''
  );

  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [productsLoading, setProductsLoading] = useState<boolean>(true);
  const products = useMemo(
    () => allProducts.filter((p) => p.status === 'Published'),
    [allProducts]
  );
  const isAdminAuthenticated = useMemo(() => isVerifiedAdminUser(adminUser), [adminUser]);
  const adminUserEmail = adminUser?.email || '';
  const adminLoadedRef = useRef(false);

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

  // Monitor Firebase Auth state
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      setAdminUser(user);
      if (user && isVerifiedAdminUser(user)) {
        try {
          const tok = await user.getIdToken();
          setAdminSessionToken(tok);
        } catch {
          setAdminSessionToken('');
        }
      } else {
        setAdminSessionToken('');
        adminLoadedRef.current = false;
      }
      setAuthReady(true);
    });
    return () => unsub();
  }, []);

  // Initialize Meta Pixel whenever configured in store settings
  useEffect(() => {
    if (settings.metaPixelId) {
      initMetaPixel(settings.metaPixelId);
      trackPixelEvent('PageView');
    }
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
      fetch('/api/public-config')
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
    try {
      const published = await fetchPublishedProducts();
      if (!adminLoadedRef.current) {
        setAllProducts(published);
        setServerConnected(true);
      }
    } catch {
      // Preserve state without injecting placeholder products
    } finally {
      setProductsLoading(false);
    }
  }, []);

  // Initial Firestore connectivity & public catalog load + real-time listeners
  useEffect(() => {
    let active = true;
    setProductsLoading(true);

    void testConnection().then((ok) => {
      if (active && ok) setServerConnected(true);
    });

    fetchPublicCatalog()
      .then((data) => {
        if (!active || !data) return;
        setServerConnected(Boolean(data.connected));
        if (!adminLoadedRef.current) {
          setAllProducts(data.products);
        }
        if (Array.isArray(data.categories)) {
          setCategories(
            [...data.categories].sort((a, b) => a.display_order - b.display_order)
          );
        }
        if (Array.isArray(data.collections)) {
          setCollections(data.collections);
        }
        if (Array.isArray(data.coupons)) {
          setCoupons(data.coupons);
        }
        if (Array.isArray(data.reviews)) {
          setReviews(data.reviews);
        }
        if (data.settings) {
          setSettings({
            ...DEFAULT_SETTINGS,
            ...data.settings,
          });
        }
      })
      .catch(() => {
        if (!active) return;
        setServerConnected(false);
        if (!adminLoadedRef.current) {
          setAllProducts([]);
        }
      })
      .finally(() => {
        if (active) setProductsLoading(false);
      });

    // Live public listeners (strictly filtered for Published products)
    const unsubProducts = onSnapshot(
      query(collection(db, 'products'), where('status', '==', 'Published')),
      (snap) => {
        if (!adminLoadedRef.current) {
          setAllProducts(snap.docs.map((d) => d.data() as Product));
          setProductsLoading(false);
          setServerConnected(true);
        }
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, 'products');
      }
    );

    const unsubCategories = onSnapshot(
      collection(db, 'categories'),
      (snap) => {
        if (snap.docs.length > 0) {
          const list = snap.docs
            .map((d) => d.data() as Category)
            .sort((a, b) => a.display_order - b.display_order);
          setCategories(list);
        }
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, 'categories');
      }
    );

    const unsubCollections = onSnapshot(
      collection(db, 'collections'),
      (snap) => {
        if (snap.docs.length > 0) {
          setCollections(snap.docs.map((d) => d.data() as Collection));
        }
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, 'collections');
      }
    );

    const unsubSettings = onSnapshot(
      doc(db, 'settings', 'store_config'),
      (snap) => {
        if (snap.exists()) {
          setSettings({
            ...DEFAULT_SETTINGS,
            ...(snap.data() as Partial<StoreSettings>),
          });
        }
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, 'settings/store_config');
      }
    );

    const unsubReviews = onSnapshot(
      collection(db, 'reviews'),
      (snap) => {
        const list = snap.docs
          .map((d) => d.data() as Review)
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        setReviews(list);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, 'reviews');
      }
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

  // Attach full Admin listeners ONLY when authenticated as verified Admin
  useEffect(() => {
    if (!authReady || !isAdminAuthenticated) return;

    const unsubAllProducts = onSnapshot(
      collection(db, 'products'),
      (snap) => {
        adminLoadedRef.current = true;
        setAllProducts(snap.docs.map((d) => d.data() as Product));
        setServerConnected(true);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, 'products');
      }
    );

    const unsubOrders = onSnapshot(
      collection(db, 'orders'),
      (snap) => {
        const sorted = snap.docs
          .map((d) => d.data() as Order)
          .sort(
            (a, b) =>
              new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          );
        setOrders(sorted);
        try {
          localStorage.setItem(LOCAL_ORDERS_KEY, JSON.stringify(sorted));
        } catch {
          // ignore storage errors
        }
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, 'orders');
      }
    );

    const unsubCoupons = onSnapshot(
      collection(db, 'coupons'),
      (snap) => {
        setCoupons(snap.docs.map((d) => d.data() as Coupon));
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, 'coupons');
      }
    );

    return () => {
      unsubAllProducts();
      unsubOrders();
      unsubCoupons();
    };
  }, [authReady, isAdminAuthenticated]);

  const refreshAdminData = useCallback(async () => {
    if (!isAdminAuthenticated) return;
    try {
      const data = await fetchAdminProductsCatalog();
      adminLoadedRef.current = true;
      if (Array.isArray(data.products)) {
        setAllProducts(data.products);
      }
      if (Array.isArray(data.categories)) {
        setCategories(
          [...data.categories].sort((a, b) => a.display_order - b.display_order)
        );
      }
      if (Array.isArray(data.collections)) {
        setCollections(data.collections);
      }
      if (Array.isArray(data.orders)) {
        const sorted = [...data.orders].sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
        setOrders(sorted);
        localStorage.setItem(LOCAL_ORDERS_KEY, JSON.stringify(sorted));
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
  }, [isAdminAuthenticated]);

  const signInAdmin = useCallback(async () => {
    const user = await signInAdminWithGoogle();
    setAdminUser(user);
    const tok = await user.getIdToken();
    setAdminSessionToken(tok);
    await refreshAdminData();
    return user;
  }, [refreshAdminData]);

  const signOutAdminUser = useCallback(async () => {
    await signOutAdmin();
    setAdminUser(null);
    setAdminSessionToken('');
    adminLoadedRef.current = false;
    await refreshProducts();
  }, [refreshProducts]);

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
        content_type: 'product',
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

      try {
        const batch = writeBatch(db);
        batch.set(doc(db, 'orders', newOrder.id), newOrder);
        batch.set(doc(db, 'order_tracking', trackingId), trackingPayload);
        await batch.commit();
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, `orders/${newOrder.id}`);
      }

      setOrders((prev) => {
        const next = [newOrder, ...prev.filter((o) => o.id !== newOrder.id)];
        try {
          localStorage.setItem(LOCAL_ORDERS_KEY, JSON.stringify(next));
        } catch {
          // ignore
        }
        return next;
      });

      trackPixelEvent('Purchase', {
        value: newOrder.total,
        currency: 'BDT',
        content_ids: newOrder.items.map((i) => i.productId),
        num_items: newOrder.items.reduce((s, i) => s + i.quantity, 0),
      });

      clearCart();
      return newOrder;
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
      const review: Review = cleanFirestorePayload<Review>({
        id: reviewId,
        productId: sanitizeDocId(input.productId),
        productName: input.productName?.trim().slice(0, 200),
        userId: auth.currentUser?.uid || undefined,
        authorName: (input.authorName?.trim() || 'Verified Customer').slice(0, 80),
        rating: Math.min(5, Math.max(1, Math.round(input.rating))),
        comment: input.comment.trim().slice(0, 1000),
        createdAt: new Date().toISOString(),
      });
      try {
        await setDoc(doc(db, 'reviews', review.id), review);
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, `reviews/${review.id}`);
      }
      setReviews((prev) => [review, ...prev.filter((r) => r.id !== review.id)]);
      showToast('Review published');
    },
    [showToast]
  );

  const upsertProduct = useCallback(
    async (product: Product): Promise<Product> => {
      const cleanProduct = clampProductForFirestore(product);
      const exists = allProducts.some((p) => p.id === cleanProduct.id);

      try {
        await setDoc(doc(db, 'products', cleanProduct.id), cleanProduct);
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `products/${cleanProduct.id}`);
      }

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
            ? 'Product updated & live on storefront'
            : `Product updated (${cleanProduct.status})`
        );
      } else {
        showToast(
          cleanProduct.status === 'Published'
            ? 'Product published to storefront'
            : `Product saved as ${cleanProduct.status}`
        );
      }
      return cleanProduct;
    },
    [allProducts, showToast]
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
      const cleanId = sanitizeDocId(productId);
      try {
        await deleteDoc(doc(db, 'products', cleanId));
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `products/${cleanId}`);
      }
      setAllProducts((prev) => prev.filter((p) => p.id !== cleanId));
      showToast('Product permanently deleted');
    },
    [showToast]
  );

  const upsertCategory = useCallback(
    async (cat: Category) => {
      const cleanCat = clampCategoryForFirestore(cat);
      try {
        await setDoc(doc(db, 'categories', cleanCat.id), cleanCat);
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `categories/${cleanCat.id}`);
      }
      setCategories((prev) => {
        const nextList = prev.some((c) => c.id === cleanCat.id)
          ? prev.map((c) => (c.id === cleanCat.id ? cleanCat : c))
          : [...prev, cleanCat];
        return [...nextList].sort((a, b) => a.display_order - b.display_order);
      });
      showToast('Category saved');
    },
    [showToast]
  );

  const deleteCategory = useCallback(
    async (categoryId: string) => {
      const cleanId = sanitizeDocId(categoryId);
      try {
        await deleteDoc(doc(db, 'categories', cleanId));
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `categories/${cleanId}`);
      }
      setCategories((prev) => prev.filter((c) => c.id !== cleanId));
      showToast('Category deleted');
    },
    [showToast]
  );

  const upsertCollection = useCallback(
    async (col: Collection) => {
      const cleanCol = clampCollectionForFirestore(col);
      try {
        await setDoc(doc(db, 'collections', cleanCol.id), cleanCol);
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `collections/${cleanCol.id}`);
      }
      setCollections((prev) =>
        prev.some((c) => c.id === cleanCol.id)
          ? prev.map((c) => (c.id === cleanCol.id ? cleanCol : c))
          : [...prev, cleanCol]
      );
      showToast('Collection updated');
    },
    [showToast]
  );

  const upsertCoupon = useCallback(
    async (coupon: Coupon) => {
      const payload = clampCouponForFirestore(coupon);
      try {
        await setDoc(doc(db, 'coupons', payload.id), payload);
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `coupons/${payload.id}`);
      }
      setCoupons((prev) =>
        prev.some((c) => c.id === payload.id)
          ? prev.map((c) => (c.id === payload.id ? payload : c))
          : [...prev, payload]
      );
      showToast('Coupon saved');
    },
    [showToast]
  );

  const deleteCoupon = useCallback(
    async (couponId: string) => {
      const cleanId = sanitizeDocId(couponId);
      try {
        await deleteDoc(doc(db, 'coupons', cleanId));
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `coupons/${cleanId}`);
      }
      setCoupons((prev) => prev.filter((c) => c.id !== cleanId));
      showToast('Coupon removed');
    },
    [showToast]
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

      try {
        const batch = writeBatch(db);
        batch.set(doc(db, 'orders', cleanId), updatedOrder);
        batch.set(doc(db, 'order_tracking', trackingId), trackingPayload);
        await batch.commit();
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `orders/${cleanId}`);
      }

      setOrders((prev) => {
        const next = prev.map((o) => (o.id === cleanId ? updatedOrder : o));
        try {
          localStorage.setItem(LOCAL_ORDERS_KEY, JSON.stringify(next));
        } catch {
          // ignore
        }
        return next;
      });
      showToast('Order updated');
    },
    [orders, showToast]
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
      try {
        await setDoc(doc(db, 'settings', 'store_config'), merged);
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, 'settings/store_config');
      }
      setSettings(merged);
      showToast('Store settings saved to Firebase');
    },
    [settings, showToast]
  );

  const syncCatalog = useCallback(async () => {
    if (!isAdminAuthenticated) {
      showToast('Please sign in as Admin to sync catalog to Firebase');
      return;
    }
    try {
      const batch = writeBatch(db);
      allProducts.forEach((p) => {
        const clean = clampProductForFirestore(p);
        batch.set(doc(db, 'products', clean.id), clean);
      });
      categories.forEach((c) => {
        const clean = clampCategoryForFirestore(c);
        batch.set(doc(db, 'categories', clean.id), clean);
      });
      collections.forEach((c) => {
        const clean = clampCollectionForFirestore(c);
        batch.set(doc(db, 'collections', clean.id), clean);
      });
      coupons.forEach((c) => {
        const clean = clampCouponForFirestore(c);
        batch.set(doc(db, 'coupons', clean.id), clean);
      });
      batch.set(
        doc(db, 'settings', 'store_config'),
        clampSettingsForFirestore(settings)
      );
      await batch.commit();
      setServerConnected(true);
      showToast('PYTHOX WORLD catalog synced to Firebase Firestore');
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'syncCatalog');
    }
  }, [
    isAdminAuthenticated,
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
        productsLoading,
        mapsApiKey,
        authReady,
        isAdminAuthenticated,
        adminUserEmail,
        adminSessionToken,
        setAdminSessionToken,
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
