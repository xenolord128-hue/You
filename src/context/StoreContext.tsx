import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
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
  fetchAdminProductsCatalog,
  fetchPublicCatalog,
  fetchPublishedProducts,
} from '../services/productService';

interface StoreContextValue {
  serverConnected: boolean;
  productsLoading: boolean;
  mapsApiKey: string;
  adminSessionToken: string;
  setAdminSessionToken: (token: string) => void;
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
  applyCouponCode: (code: string, overrideSubtotal?: number) => { ok: boolean; message: string };
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
  // Admin operations (protected by server-side password session)
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
const ADMIN_TOKEN_STORAGE_KEY = 'pythox_admin_token_v1';

function readStorage<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function readSessionToken(): string {
  try {
    return sessionStorage.getItem(ADMIN_TOKEN_STORAGE_KEY) || '';
  } catch {
    return '';
  }
}

function stripUndefined<T extends Record<string, unknown>>(obj: T): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  Object.entries(obj).forEach(([k, v]) => {
    if (v !== undefined) {
      out[k] = v;
    }
  });
  return out;
}

export const StoreProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [serverConnected, setServerConnected] = useState(false);
  const [adminSessionToken, setAdminSessionTokenState] = useState<string>(() =>
    readSessionToken()
  );
  const [mapsApiKey, setMapsApiKey] = useState<string>(
    (import.meta as any).env?.VITE_GOOGLE_MAPS_API_KEY || ''
  );

  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [productsLoading, setProductsLoading] = useState<boolean>(true);
  const products = useMemo(
    () => allProducts.filter((p) => p.status === 'Published'),
    [allProducts]
  );
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

  const setAdminSessionToken = useCallback((token: string) => {
    setAdminSessionTokenState(token);
    try {
      if (token) {
        sessionStorage.setItem(ADMIN_TOKEN_STORAGE_KEY, token);
      } else {
        sessionStorage.removeItem(ADMIN_TOKEN_STORAGE_KEY);
      }
    } catch {
      // ignore storage errors
    }
  }, []);

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
      // Preserve current state cleanly without injecting demo products
    } finally {
      setProductsLoading(false);
    }
  }, []);

  // Load public configuration & published catalog from database on boot
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

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    setProductsLoading(true);

    fetchPublicCatalog(controller.signal)
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

    return () => {
      active = false;
      controller.abort();
    };
  }, []);

  const adminHeaders = useCallback(
    (tokenOverride?: string): Record<string, string> => {
      const tok = tokenOverride ?? adminSessionToken;
      return {
        'Content-Type': 'application/json',
        ...(tok ? { 'x-admin-session': tok } : {}),
      };
    },
    [adminSessionToken]
  );

  const refreshAdminData = useCallback(
    async (tokenOverride?: string) => {
      try {
        const data = await fetchAdminProductsCatalog(adminHeaders(tokenOverride));
        if (!data) return;
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
      } catch {
        // Keep existing local state if offline
      }
    },
    [adminHeaders]
  );

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
      const orderId = sanitizeDocId(`ord-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`);
      const orderNumber =
        orderData.orderNumber ||
        `PYX-${String(Math.floor(1000 + Math.random() * 9000))}`;
      const nowIso = new Date().toISOString();

      const cleanArea = (orderData.area || orderData.city || 'Dhaka').trim().slice(0, 80);
      const cleanPostal = (orderData.postalCode || '1340').trim().slice(0, 10);

      const newOrder: Order = {
        ...orderData,
        id: orderId,
        orderNumber,
        area: cleanArea.length >= 2 ? cleanArea : 'Dhaka',
        postalCode: cleanPostal.length >= 3 ? cleanPostal : '1340',
        customerName: orderData.customerName.trim().slice(0, 120),
        customerEmail: orderData.customerEmail.trim().slice(0, 200),
        customerPhone: orderData.customerPhone.trim().slice(0, 20),
        address: orderData.address.trim().slice(0, 300),
        city: orderData.city.trim().slice(0, 80),
        status: 'Order Received',
        paymentStatus: 'Pending',
        deliveryStatus: 'Awaiting studio confirmation',
        createdAt: nowIso,
      };

      try {
        const res = await fetch('/api/orders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(stripUndefined(newOrder as unknown as Record<string, unknown>)),
        });
        if (!res.ok) {
          throw new Error('Unable to record order on server.');
        }
      } catch (err) {
        console.warn('Server order sync skipped:', err);
      }

      setOrders((prev) => {
        const next = [newOrder, ...prev.filter((o) => o.id !== newOrder.id)];
        localStorage.setItem(LOCAL_ORDERS_KEY, JSON.stringify(next));
        return next;
      });

      setAllProducts((prev) =>
        prev.map((p) => {
          const orderedQty = orderData.items
            .filter((item) => item.productId === p.id)
            .reduce((sum, item) => sum + item.quantity, 0);
          return orderedQty > 0
            ? { ...p, inventory: Math.max(0, p.inventory - orderedQty) }
            : p;
        })
      );

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
      try {
        const res = await fetch(
          `/api/orders/track?orderNumber=${encodeURIComponent(
            orderNumber.trim()
          )}&phone=${encodeURIComponent(phone.trim())}`
        );
        if (res.ok) {
          const data = (await res.json()) as { order?: Order };
          if (data.order) return data.order;
        }
      } catch {
        // Fallback to local match
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
      const reviewId = sanitizeDocId(`rev-${Date.now()}`);
      const review: Review = {
        id: reviewId,
        productId: input.productId,
        productName: input.productName?.slice(0, 140),
        authorName: (input.authorName?.trim() || 'Verified Customer').slice(0, 80),
        rating: Math.min(5, Math.max(1, Math.round(input.rating))),
        comment: input.comment.trim().slice(0, 1000),
        createdAt: new Date().toISOString(),
      };
      try {
        await fetch('/api/reviews', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(review),
        });
      } catch {
        // Keep optimistic local update
      }
      setReviews((prev) => [review, ...prev]);
      showToast('Review published');
    },
    [showToast]
  );

  const upsertProduct = useCallback(
    async (product: Product): Promise<Product> => {
      const id = sanitizeDocId(product.id || `prod-${Date.now()}`);
      const cleanProduct: Product = {
        ...product,
        id,
        status: product.status || 'Draft',
        primaryImage: product.primaryImage || product.images[0],
      };
      const exists = allProducts.some((p) => p.id === id);

      const res = await fetch('/api/admin/products', {
        method: 'POST',
        credentials: 'include',
        headers: adminHeaders(),
        body: JSON.stringify({ product: cleanProduct }),
      });

      const payload = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        product?: Product;
        error?: string;
      };

      if (!res.ok) {
        throw new Error(payload.error || 'Failed to save product on server.');
      }

      const persistedProduct = payload.product || cleanProduct;
      setAllProducts((prev) => {
        const prevExists = prev.some((p) => p.id === persistedProduct.id);
        return prevExists
          ? prev.map((p) => (p.id === persistedProduct.id ? persistedProduct : p))
          : [persistedProduct, ...prev];
      });
      setServerConnected(true);
      if (exists) {
        showToast(
          persistedProduct.status === 'Published'
            ? 'Product updated & live on storefront'
            : `Product updated (${persistedProduct.status})`
        );
      } else {
        showToast(
          persistedProduct.status === 'Published'
            ? 'Product published to storefront'
            : `Product saved as ${persistedProduct.status}`
        );
      }
      return persistedProduct;
    },
    [allProducts, adminHeaders, showToast]
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
      setAllProducts((prev) => prev.filter((p) => p.id !== productId));
      await fetch(`/api/admin/products/${encodeURIComponent(productId)}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: adminHeaders(),
      }).catch(() => {});
      showToast('Product permanently deleted');
    },
    [adminHeaders, showToast]
  );

  const upsertCategory = useCallback(
    async (cat: Category) => {
      const id = sanitizeDocId(cat.id);
      const cleanCat: Category = { ...cat, id };
      const nextList = categories.some((c) => c.id === id)
        ? categories.map((c) => (c.id === id ? cleanCat : c))
        : [...categories, cleanCat];
      setCategories(nextList);
      try {
        const res = await fetch('/api/admin/categories', {
          method: 'POST',
          credentials: 'include',
          headers: adminHeaders(),
          body: JSON.stringify({ category: cleanCat, allCategories: nextList }),
        });
        if (res.ok) {
          const data = (await res.json()) as { categories?: Category[] };
          if (Array.isArray(data.categories)) {
            setCategories(
              [...data.categories].sort((a, b) => a.display_order - b.display_order)
            );
          }
        }
      } catch {
        // ignore offline fallback
      }
      showToast('Category saved');
    },
    [categories, adminHeaders, showToast]
  );

  const deleteCategory = useCallback(
    async (categoryId: string) => {
      const nextList = categories.filter((c) => c.id !== categoryId);
      setCategories(nextList);
      try {
        const res = await fetch(`/api/admin/categories/${encodeURIComponent(categoryId)}`, {
          method: 'DELETE',
          credentials: 'include',
          headers: adminHeaders(),
          body: JSON.stringify({ allCategories: categories }),
        });
        if (res.ok) {
          const data = (await res.json()) as { categories?: Category[] };
          if (Array.isArray(data.categories)) {
            setCategories(
              [...data.categories].sort((a, b) => a.display_order - b.display_order)
            );
          }
        }
      } catch {
        // ignore offline fallback
      }
      showToast('Category deleted');
    },
    [categories, adminHeaders, showToast]
  );

  const upsertCollection = useCallback(
    async (col: Collection) => {
      const id = sanitizeDocId(col.id);
      const nextList = collections.some((c) => c.id === id)
        ? collections.map((c) => (c.id === id ? col : c))
        : [...collections, col];
      setCollections(nextList);
      await fetch('/api/admin/collections', {
        method: 'POST',
        credentials: 'include',
        headers: adminHeaders(),
        body: JSON.stringify({ collection: col, allCollections: nextList }),
      }).catch(() => {});
      showToast('Collection updated');
    },
    [collections, adminHeaders, showToast]
  );

  const upsertCoupon = useCallback(
    async (coupon: Coupon) => {
      const id = sanitizeDocId(coupon.id || `coup-${Date.now()}`);
      const payload = { ...coupon, id, code: coupon.code.trim().toUpperCase() };
      const nextList = coupons.some((c) => c.id === id)
        ? coupons.map((c) => (c.id === id ? payload : c))
        : [...coupons, payload];
      setCoupons(nextList);
      await fetch('/api/admin/coupons', {
        method: 'POST',
        credentials: 'include',
        headers: adminHeaders(),
        body: JSON.stringify({ coupon: payload, allCoupons: nextList }),
      }).catch(() => {});
      showToast('Coupon saved');
    },
    [coupons, adminHeaders, showToast]
  );

  const deleteCoupon = useCallback(
    async (couponId: string) => {
      setCoupons((prev) => prev.filter((c) => c.id !== couponId));
      await fetch(`/api/admin/coupons/${encodeURIComponent(couponId)}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: adminHeaders(),
      }).catch(() => {});
      showToast('Coupon removed');
    },
    [adminHeaders, showToast]
  );

  const updateOrderDetails = useCallback(
    async (
      orderId: string,
      patch: { status?: OrderStatus; paymentStatus?: PaymentStatus; deliveryStatus?: string }
    ) => {
      const cleanPatch = stripUndefined(patch);
      setOrders((prev) => {
        const next = prev.map((o) => (o.id === orderId ? { ...o, ...cleanPatch } : o));
        localStorage.setItem(LOCAL_ORDERS_KEY, JSON.stringify(next));
        return next;
      });
      await fetch(`/api/admin/orders/${encodeURIComponent(orderId)}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: adminHeaders(),
        body: JSON.stringify(cleanPatch),
      }).catch(() => {});
      showToast('Order updated');
    },
    [adminHeaders, showToast]
  );

  const updateOrderStatus = useCallback(
    async (orderId: string, status: OrderStatus) => {
      await updateOrderDetails(orderId, { status });
    },
    [updateOrderDetails]
  );

  const updateStoreSettings = useCallback(
    async (next: Partial<StoreSettings>) => {
      const merged: StoreSettings = { ...settings, ...next, id: 'store_config' };
      setSettings(merged);
      await fetch('/api/admin/settings', {
        method: 'PUT',
        credentials: 'include',
        headers: adminHeaders(),
        body: JSON.stringify(merged),
      }).catch(() => {});
      showToast('Store settings saved');
    },
    [settings, adminHeaders, showToast]
  );

  const syncCatalog = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/sync-catalog', {
        method: 'POST',
        credentials: 'include',
        headers: adminHeaders(),
        body: JSON.stringify({
          products: allProducts,
          categories,
          collections,
          coupons,
          settings,
        }),
      });
      if (!res.ok) {
        showToast('Please unlock the admin console to sync catalog');
        return;
      }
      setServerConnected(true);
      showToast('PYTHOX WORLD catalog synced to server');
    } catch {
      showToast('Unable to sync catalog right now');
    }
  }, [adminHeaders, allProducts, categories, collections, coupons, settings, showToast]);

  return (
    <StoreContext.Provider
      value={{
        serverConnected,
        productsLoading,
        mapsApiKey,
        adminSessionToken,
        setAdminSessionToken,
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
