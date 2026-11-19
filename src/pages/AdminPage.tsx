import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft,
  Copy,
  Eye,
  EyeOff,
  Image as ImageIcon,
  Lock,
  Plus,
  RotateCcw,
  Search,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { useStore } from '../context/StoreContext';
import {
  Category,
  Collection,
  Coupon,
  OrderStatus,
  PaymentStatus,
  Product,
  ProductStatus,
} from '../types/ecommerce';
import { formatBDT, sanitizeExternalHref, sanitizeMediaUrl, sanitizePixelId } from '../lib/formatters';
import { BRAND_LOCATION, EDITORIAL_MEDIA } from '../config/storeConfig';
import { SeoHead } from '../components/SeoHead';
import { AdminProductUploadForm } from '../components/AdminProductUploadForm';

type AdminTab =
  | 'overview'
  | 'products'
  | 'inventory'
  | 'orders'
  | 'customers'
  | 'categories'
  | 'collections'
  | 'coupons'
  | 'reviews'
  | 'settings'
  | 'guide';

const TABS: { id: AdminTab; label: string; subtitle: string }[] = [
  {
    id: 'overview',
    label: 'Overview & Reports',
    subtitle: 'Sales, revenue and what needs attention today.',
  },
  {
    id: 'products',
    label: 'Products',
    subtitle: 'Publish, edit and remove items from the catalogue.',
  },
  {
    id: 'inventory',
    label: 'Inventory',
    subtitle: 'Watch stock levels and adjust them in one tap.',
  },
  {
    id: 'orders',
    label: 'Orders',
    subtitle: 'Confirm, pack and dispatch every order.',
  },
  {
    id: 'customers',
    label: 'Customers',
    subtitle: 'Everyone who has ordered from the store.',
  },
  {
    id: 'categories',
    label: 'Categories',
    subtitle: 'Cover, name and description for each category.',
  },
  {
    id: 'collections',
    label: 'Collections',
    subtitle: 'Capsules that group products on the storefront.',
  },
  {
    id: 'coupons',
    label: 'Coupons',
    subtitle: 'Promo codes, limits and expiry dates.',
  },
  {
    id: 'reviews',
    label: 'Reviews',
    subtitle: 'What customers say about your products.',
  },
  {
    id: 'settings',
    label: 'Settings',
    subtitle: 'Delivery charges, pixel, announcements and contact channels.',
  },
  {
    id: 'guide',
    label: 'Client Guide & Backup',
    subtitle: 'Owner manual, backup export and handover checklist.',
  },
];

const ORDER_STATUSES: OrderStatus[] = [
  'Order Received',
  'Order Confirmed',
  'Processing',
  'Packed',
  'Shipped',
  'Out for Delivery',
  'Delivered',
  'Cancelled',
];

const PAYMENT_STATUSES: PaymentStatus[] = ['Pending', 'Paid', 'Failed', 'Refunded'];

const REVENUE_SHADES = ['#0A0A0A', '#2E2E2E', '#4A4A4A', '#7A7A79', '#A3A3A2', '#C4C4C3'];

const GUIDE_ITEMS: { title: string; text: string }[] = [
  {
    title: 'Unlock the panel',
    text: 'Visit /admin and enter your administrator password to unlock the console.',
  },
  {
    title: 'Add a product',
    text: 'Open Products, fill the form and press Publish Product.',
  },
  {
    title: 'Set a sale price',
    text: 'Keep Price lower than Regular Price. The old price shows struck through.',
  },
  {
    title: 'Draft the copy',
    text: 'Press Draft Copy to write the description and fit note from the name, category and material.',
  },
  {
    title: 'Mark badges',
    text: 'Tick New Arrival, Featured, Best Seller, Trending or Winter Collection.',
  },
  {
    title: 'Adjust stock',
    text: 'Use +10, -5 or Set 0 in Inventory. Changes apply at once.',
  },
  {
    title: 'Watch low stock',
    text: 'Anything at 15 or fewer appears in Inventory Alerts.',
  },
  {
    title: 'Confirm new orders',
    text: 'Move Order Received to Order Confirmed after you check the details.',
  },
  {
    title: 'Update payment',
    text: 'Set Paid, Pending, Failed or Refunded on each order.',
  },
  {
    title: 'Move the order along',
    text: 'Step through Processing, Packed, Shipped and Out for Delivery. Customers see each step.',
  },
  {
    title: 'Add a delivery note',
    text: 'Type the courier or tracking note, then click outside the box to save.',
  },
  {
    title: 'Copy dispatch slip',
    text: 'Press Copy Slip on any order row to copy a ready-to-send dispatch summary.',
  },
  {
    title: 'Create a coupon',
    text: 'Choose percentage or fixed, set a minimum order, limit and expiry date.',
  },
  {
    title: 'Edit categories and collections',
    text: 'Update descriptions, or add a collection with a cover image.',
  },
  {
    title: 'Update store settings',
    text: 'Change delivery charges, the announcement bar and the Meta Pixel ID.',
  },
  {
    title: 'Sync and back up',
    text: 'Press Sync Catalog after changes. Download Backup JSON each week.',
  },
];

const HANDOVER_CHECKLIST: string[] = [
  'ADMIN_PASSWORD set in hosting environment variables',
  'ADMIN_SESSION_SECRET configured on server',
  'Self-hosted store persistence verified',
  'Meta Pixel ID checked in Settings',
  'First Backup JSON downloaded',
  'Owner shown how to read this manual',
];

const CHECKLIST_STORAGE_KEY = 'pythox_admin_handover_checks';

function getPillStyle(status: string): React.CSSProperties {
  const palette: Record<string, [string, string, string]> = {
    Delivered: ['#0A0A0A', '#FFFFFF', '#0A0A0A'],
    'Out for Delivery': ['#2E2E2E', '#FFFFFF', '#2E2E2E'],
    Shipped: ['#4A4A4A', '#FFFFFF', '#4A4A4A'],
    Packed: ['#CFCFCE', '#0A0A0A', '#CFCFCE'],
    Processing: ['#E4E4E3', '#0A0A0A', '#E4E4E3'],
    'Order Confirmed': ['#FFFFFF', '#0A0A0A', '#0A0A0A'],
    'Order Received': ['#FFFFFF', '#0A0A0A', '#9A9A99'],
    Cancelled: ['#FFFFFF', '#6A6A6A', '#C4C4C3'],
    Active: ['#0A0A0A', '#FFFFFF', '#0A0A0A'],
    Paused: ['#FFFFFF', '#6A6A6A', '#C4C4C3'],
    Published: ['#0A0A0A', '#FFFFFF', '#0A0A0A'],
    Draft: ['#F4F4F3', '#2E2E2E', '#CFCFCE'],
    Unpublished: ['#FFFFFF', '#6A6A6A', '#C4C4C3'],
    'Low Stock': ['#CFCFCE', '#0A0A0A', '#CFCFCE'],
    'Out of Stock': ['#0A0A0A', '#FFFFFF', '#0A0A0A'],
    'In Stock': ['#FFFFFF', '#0A0A0A', '#C4C4C3'],
  };
  const [bg, fg, bd] = palette[status] || palette['Order Received'];
  return {
    backgroundColor: bg,
    color: fg,
    border: `1px solid ${bd}`,
  };
}

export const AdminPage: React.FC = () => {
  const {
    serverConnected,
    adminSessionToken,
    setAdminSessionToken,
    refreshAdminData,
    adminProducts,
    categories,
    collections,
    coupons,
    reviews,
    orders,
    settings,
    upsertProduct,
    duplicateProduct,
    deleteProduct,
    upsertCategory,
    deleteCategory,
    upsertCollection,
    upsertCoupon,
    deleteCoupon,
    updateOrderDetails,
    updateStoreSettings,
    syncCatalog,
    showToast,
  } = useStore();

  const [checkingSession, setCheckingSession] = useState(true);
  const [passwordVerified, setPasswordVerified] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [loggingIn, setLoggingIn] = useState(false);

  const [activeTab, setActiveTab] = useState<AdminTab>('overview');
  const [isSeeding, setIsSeeding] = useState(false);

  // Order delivery notes local edits
  const [orderNotes, setOrderNotes] = useState<Record<string, string>>({});

  // Product editor & search/filter state
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [prodSearch, setProdSearch] = useState('');
  const [prodStatusFilter, setProdStatusFilter] = useState<'All' | ProductStatus>('All');
  const [prodCategoryFilter, setProdCategoryFilter] = useState<string>('All');
  const [brokenImages, setBrokenImages] = useState<Record<string, boolean>>({});
  const productFormRef = useRef<HTMLDivElement | null>(null);

  // Delete confirmation modal state
  const [confirmDelete, setConfirmDelete] = useState<
    | { kind: 'product'; id: string; name: string }
    | { kind: 'category'; id: string; name: string; productCount: number }
    | null
  >(null);

  // Category CRUD state
  const [catEditingId, setCatEditingId] = useState<string | null>(null);
  const [catNameInput, setCatNameInput] = useState('');
  const [catSlugInput, setCatSlugInput] = useState('');
  const [catDescInput, setCatDescInput] = useState('');
  const [catImageInput, setCatImageInput] = useState('');
  const [catSubcategories, setCatSubcategories] = useState<string[]>([]);
  const [catSubInput, setCatSubInput] = useState('');
  const [catUploadingImg, setCatUploadingImg] = useState(false);

  // Collection editor state
  const [colTitle, setColTitle] = useState('');
  const [colDesc, setColDesc] = useState('');
  const [colHero, setColHero] = useState<string>(EDITORIAL_MEDIA.prodBomberJacket);

  // Coupon editor state
  const [coupCode, setCoupCode] = useState('');
  const [coupType, setCoupType] = useState<'percentage' | 'fixed'>('percentage');
  const [coupValue, setCoupValue] = useState('10');
  const [coupMin, setCoupMin] = useState('1500');
  const [coupExpiry, setCoupExpiry] = useState('2026-12-31');
  const [coupLimit, setCoupLimit] = useState('200');

  // Store settings form state
  const [insideDhaka, setInsideDhaka] = useState(String(settings.insideDhakaCharge));
  const [outsideDhaka, setOutsideDhaka] = useState(String(settings.outsideDhakaCharge));
  const [expressSurcharge, setExpressSurcharge] = useState(String(settings.expressSurcharge));
  const [freeThreshold, setFreeThreshold] = useState(String(settings.freeShippingThreshold));
  const [announcement, setAnnouncement] = useState(settings.announcementText);
  const [businessAddress, setBusinessAddress] = useState(
    settings.businessAddress || BRAND_LOCATION
  );
  const [supportEmail, setSupportEmail] = useState(settings.supportEmail);
  const [supportPhone, setSupportPhone] = useState(settings.supportPhone);
  const [whatsappNumber, setWhatsappNumber] = useState(settings.whatsappNumber);
  const [messengerHandle, setMessengerHandle] = useState(settings.messengerHandle);
  const [facebookUrl, setFacebookUrl] = useState(settings.facebookUrl);
  const [instagramUrl, setInstagramUrl] = useState(settings.instagramUrl);
  const [metaPixelId, setMetaPixelId] = useState(settings.metaPixelId);
  const [heroImageUrl, setHeroImageUrl] = useState(settings.heroImageUrl || '');
  const [heroUploading, setHeroUploading] = useState(false);
  const [heroDragOver, setHeroDragOver] = useState(false);
  const heroFileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setInsideDhaka(String(settings.insideDhakaCharge ?? 80));
    setOutsideDhaka(String(settings.outsideDhakaCharge ?? 130));
    setExpressSurcharge(String(settings.expressSurcharge ?? 70));
    setFreeThreshold(String(settings.freeShippingThreshold ?? 3000));
    setAnnouncement(settings.announcementText || '');
    setBusinessAddress(settings.businessAddress || BRAND_LOCATION);
    setSupportEmail(settings.supportEmail || '');
    setSupportPhone(settings.supportPhone || '');
    setWhatsappNumber(settings.whatsappNumber || '');
    setMessengerHandle(settings.messengerHandle || '');
    setFacebookUrl(settings.facebookUrl || '');
    setInstagramUrl(settings.instagramUrl || '');
    setMetaPixelId(settings.metaPixelId || '');
    setHeroImageUrl(settings.heroImageUrl || '');
  }, [settings]);

  // Handover checklist state below

  // Handover checklist
  const [checks, setChecks] = useState<Record<number, boolean>>(() => {
    try {
      const saved = localStorage.getItem(CHECKLIST_STORAGE_KEY);
      if (saved) return JSON.parse(saved) as Record<number, boolean>;
    } catch {
      // Ignore storage error
    }
    return { 0: true, 1: true };
  });

  const toggleCheck = (index: number) => {
    setChecks((prev) => {
      const next = { ...prev, [index]: !prev[index] };
      try {
        localStorage.setItem(CHECKLIST_STORAGE_KEY, JSON.stringify(next));
      } catch {
        // Ignore storage error
      }
      return next;
    });
  };

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch('/api/admin/session', {
          credentials: 'include',
          headers: adminSessionToken ? { 'x-admin-session': adminSessionToken } : undefined,
        });
        if (res.ok && active) {
          const data = (await res.json()) as { authenticated?: boolean; sessionToken?: string };
          const ok = Boolean(data.authenticated);
          setPasswordVerified(ok);
          if (ok) {
            const effectiveToken = data.sessionToken || adminSessionToken || undefined;
            if (data.sessionToken && data.sessionToken !== adminSessionToken) {
              setAdminSessionToken(data.sessionToken);
            }
            void refreshAdminData(effectiveToken);
          }
        }
      } catch {
        if (active) setPasswordVerified(false);
      } finally {
        if (active) setCheckingSession(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [adminSessionToken, refreshAdminData]);

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passwordInput) {
      setLoginError('Please enter the administrator password.');
      return;
    }
    setLoggingIn(true);
    setLoginError('');
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ password: passwordInput }),
      });
      const data = (await res.json()) as {
        authenticated?: boolean;
        sessionToken?: string;
        error?: string;
      };
      if (res.ok && data.authenticated) {
        setPasswordVerified(true);
        if (data.sessionToken) setAdminSessionToken(data.sessionToken);
        void refreshAdminData(data.sessionToken);
        setPasswordInput('');
      } else {
        setLoginError(data.error || 'Incorrect administrator password.');
      }
    } catch {
      setLoginError('Unable to verify password right now. Please try again.');
    } finally {
      setLoggingIn(false);
    }
  };

  const handleLockSession = async () => {
    try {
      await fetch('/api/admin/logout', {
        method: 'POST',
        credentials: 'include',
        headers: adminSessionToken ? { 'x-admin-session': adminSessionToken } : undefined,
      });
    } catch {
      // Ignore network error
    }
    setAdminSessionToken('');
    setPasswordVerified(false);
  };

  const analytics = useMemo(() => {
    const validOrders = orders.filter((o) => o.status !== 'Cancelled');
    const totalSales = validOrders.reduce((sum, o) => sum + (Number(o.total) || 0), 0);
    const lowStockProducts = adminProducts
      .filter((p) => (p.inventory ?? 0) <= 15)
      .sort((a, b) => (a.inventory ?? 0) - (b.inventory ?? 0));
    const lowCountOnly = adminProducts.filter((p) => p.inventory > 0 && p.inventory <= 15).length;
    const outOfStockCount = adminProducts.filter((p) => p.inventory === 0 || p.status === 'Out of Stock').length;
    const publishedCount = adminProducts.filter((p) => p.status === 'Published').length;
    const draftCount = adminProducts.filter((p) => p.status === 'Draft').length;
    const unpublishedCount = adminProducts.filter((p) => p.status === 'Unpublished').length;
    const newOrdersCount = orders.filter((o) => o.status === 'Order Received').length;

    const customerMap = new Map<
      string,
      { name: string; email: string; phone: string; city: string; orders: number; spent: number }
    >();
    orders.forEach((o) => {
      const key = o.customerEmail || o.customerPhone || o.customerName;
      const existing = customerMap.get(key) || {
        name: o.customerName,
        email: o.customerEmail,
        phone: o.customerPhone,
        city: o.city,
        orders: 0,
        spent: 0,
      };
      existing.orders += 1;
      if (o.status !== 'Cancelled') existing.spent += Number(o.total) || 0;
      customerMap.set(key, existing);
    });

    const rawGroupStats = categories.map((cat) => {
      const catIds = new Set(
        adminProducts
          .filter(
            (p) =>
              p.category.toLowerCase() === cat.name.toLowerCase() ||
              cat.filterCategories?.some(
                (fc) => fc.toLowerCase() === p.category.toLowerCase()
              )
          )
          .map((p) => p.id)
      );
      const revenue = validOrders.reduce((sum, o) => {
        const itemsRev = (o.items ?? [])
          .filter((item) => catIds.has(item.productId))
          .reduce((s, item) => s + (Number(item.price) || 0) * (Number(item.quantity) || 0), 0);
        return sum + itemsRev;
      }, 0);
      return {
        category: cat.name,
        revenue,
      };
    });

    const sortedGroupStats = [...rawGroupStats].sort((a, b) => b.revenue - a.revenue);
    const maxCatRev = Math.max(1, ...sortedGroupStats.map((g) => g.revenue));
    const revByCategory = sortedGroupStats.map((g, idx) => ({
      ...g,
      pct: Math.round((g.revenue / maxCatRev) * 100),
      color: REVENUE_SHADES[Math.min(idx, REVENUE_SHADES.length - 1)],
    }));

    const productUnits = new Map<string, { name: string; units: number; rev: number }>();
    validOrders.forEach((o) => {
      (o.items ?? []).forEach((item) => {
        const prev = productUnits.get(item.productId) || {
          name: item.name,
          units: 0,
          rev: 0,
        };
        const qty = Number(item.quantity) || 0;
        const unitPrice = Number(item.price) || 0;
        prev.units += qty;
        prev.rev += unitPrice * qty;
        productUnits.set(item.productId, prev);
      });
    });

    const bestSelling = Array.from(productUnits.values())
      .sort((a, b) => b.units - a.units)
      .slice(0, 5);

    const reviewAvg =
      reviews.length > 0
        ? (reviews.reduce((sum, r) => sum + (Number(r.rating) || 0), 0) / reviews.length).toFixed(1)
        : '5.0';

    return {
      totalSales,
      orderCount: orders.length,
      newOrdersCount,
      customers: Array.from(customerMap.values()).sort((a, b) => b.spent - a.spent),
      lowStockProducts,
      lowCountOnly,
      outOfStockCount,
      publishedCount,
      draftCount,
      unpublishedCount,
      revByCategory,
      bestSelling,
      reviewAvg,
    };
  }, [orders, adminProducts, categories, reviews]);

  const filteredAdminProducts = useMemo(() => {
    const q = prodSearch.trim().toLowerCase();
    return adminProducts.filter((p) => {
      if (prodStatusFilter !== 'All' && p.status !== prodStatusFilter) return false;
      if (prodCategoryFilter !== 'All') {
        const matchedCat = categories.find((c) => c.name === prodCategoryFilter);
        const matchesDirect = p.category.toLowerCase() === prodCategoryFilter.toLowerCase();
        const matchesFilterList = matchedCat?.filterCategories?.some(
          (fc) => fc.toLowerCase() === p.category.toLowerCase()
        );
        if (!matchesDirect && !matchesFilterList) return false;
      }
      if (q) {
        const inName = p.name.toLowerCase().includes(q);
        const inSku = p.sku.toLowerCase().includes(q);
        const inCat = p.category.toLowerCase().includes(q);
        const inSub = (p.subcategory || '').toLowerCase().includes(q);
        const inTags = (p.tags || []).some((t) => t.toLowerCase().includes(q));
        if (!inName && !inSku && !inCat && !inSub && !inTags) return false;
      }
      return true;
    });
  }, [adminProducts, prodSearch, prodStatusFilter, prodCategoryFilter, categories]);

  // 1) Loading state
  if (checkingSession) {
    return (
      <div className="admin-console justify-center items-center p-4 sm:p-6">
        <SeoHead title="Restricted Access — PYTHOX WORLD" description="Protected Portal" />
        <div className="admin-card w-full max-w-sm p-8 text-center space-y-3 modal-enter">
          <div className="mx-auto h-9 w-9 rounded-full border-2 border-[#D4D4D3] border-t-[#0A0A0A] animate-spin" />
          <p className="admin-lbl">Verifying Session</p>
        </div>
      </div>
    );
  }

  // 2) Admin Panel Password Gate (server-verified password only)
  if (!passwordVerified) {
    return (
      <div className="admin-console justify-center items-center p-4 sm:p-6">
        <SeoHead title="Admin Login — PYTHOX WORLD" description="Protected Portal" />
        <div className="admin-card w-full max-w-md shadow-[0_20px_50px_rgba(10,10,10,0.08)] p-6 sm:p-9 space-y-6 modal-enter">
          <div className="flex items-center justify-between border-b border-[#ECECEB] pb-4">
            <div className="flex items-center gap-3">
              <div className="w-[38px] h-[38px] rounded-[10px] bg-[#0A0A0A] text-white flex items-center justify-center font-admin-display font-bold text-[17px]">
                P
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="font-admin-display font-semibold text-[15px] text-[#0A0A0A]">
                  PYTHOX WORLD
                </span>
                <span className="text-[11px] text-[#6A6A6A] tracking-[0.08em] uppercase">
                  Admin Console
                </span>
              </div>
            </div>
            <span className="admin-pill bg-[#0A0A0A] text-white">
              <Lock className="inline h-3 w-3 mr-1 -mt-0.5" />
              Restricted
            </span>
          </div>

          <div className="space-y-1.5">
            <h1 className="text-2xl text-[#0A0A0A]">Administrator Access</h1>
            <p className="text-[13px] text-[#6A6A6A] leading-relaxed">
              Enter your administrator password to unlock the console.
            </p>
          </div>

          <form onSubmit={(e) => void handlePasswordSubmit(e)} className="space-y-4">
            <div className="admin-fld">
              <label htmlFor="admin-password-input" className="admin-lbl">
                Password
              </label>
              <div className="relative">
                <input
                  id="admin-password-input"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  autoFocus
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  placeholder="Enter password"
                  className="admin-inp pr-11 h-11"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 h-8 w-8 rounded-lg flex items-center justify-center text-[#6A6A6A] hover:text-[#0A0A0A] cursor-pointer"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {loginError && (
              <p
                role="alert"
                aria-live="polite"
                className="rounded-[9px] border border-[#0A0A0A] bg-[#F1F1F0] px-3.5 py-2.5 text-xs font-medium text-[#0A0A0A]"
              >
                {loginError}
              </p>
            )}

            <button
              type="submit"
              disabled={loggingIn}
              className="admin-btn admin-btn-dark w-full h-11 font-semibold"
            >
              {loggingIn ? 'Verifying...' : 'Unlock Console'}
            </button>
          </form>

          <div className="pt-3 border-t border-[#ECECEB] flex items-center justify-between">
            <Link
              to="/"
              className="inline-flex items-center gap-2 text-xs font-medium text-[#6A6A6A] hover:text-[#0A0A0A]"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Return to Storefront
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Action handlers
  const handleSeedDatabase = async () => {
    setIsSeeding(true);
    try {
      await syncCatalog();
    } finally {
      setIsSeeding(false);
    }
  };

  const handleExportBackup = () => {
    const payload = {
      exportedAt: new Date().toISOString(),
      brand: 'PYTHOX WORLD',
      location: BRAND_LOCATION,
      settings,
      categories,
      collections,
      products: adminProducts,
      coupons,
      orders,
      reviews,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `pythox-world-backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    showToast('Backup JSON downloaded');
  };

  const startEditProduct = (p: Product) => {
    setEditingProductId(p.id);
    requestAnimationFrame(() => {
      productFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  };

  const resetCategoryForm = () => {
    setCatEditingId(null);
    setCatNameInput('');
    setCatSlugInput('');
    setCatDescInput('');
    setCatImageInput('');
    setCatSubcategories([]);
    setCatSubInput('');
  };

  const startEditCategory = (cat: Category) => {
    setCatEditingId(cat.id);
    setCatNameInput(cat.name);
    setCatSlugInput(cat.slug);
    setCatDescInput(cat.description);
    setCatImageInput(cat.image || '');
    setCatSubcategories(Array.isArray(cat.subcategories) ? cat.subcategories : []);
    setCatSubInput('');
  };

  const handleAddCatSub = () => {
    const parts = catSubInput
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (parts.length === 0) return;
    setCatSubcategories((prev) => Array.from(new Set([...prev, ...parts])));
    setCatSubInput('');
  };

  const handleCategoryImageUpload = async (file: File | undefined) => {
    if (!file) return;
    setCatUploadingImg(true);
    try {
      const res = await fetch(
        `/api/admin/upload-media?kind=image&filename=${encodeURIComponent(file.name)}`,
        {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': file.type || 'image/jpeg',
            ...(adminSessionToken ? { 'x-admin-session': adminSessionToken } : {}),
          },
          body: file,
        }
      );
      const data = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !data.url) {
        throw new Error(data.error || 'Image upload failed');
      }
      setCatImageInput(data.url);
      showToast('Category cover image uploaded');
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Unable to upload cover image.');
    } finally {
      setCatUploadingImg(false);
    }
  };

  const handleSaveCategoryForm = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = catNameInput.trim();
    if (!cleanName) {
      showToast('Category name is required.');
      return;
    }
    const cleanSlug = (catSlugInput.trim() || cleanName)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    const existing = catEditingId
      ? categories.find((c) => c.id === catEditingId)
      : undefined;
    const filterSet = Array.from(
      new Set([
        cleanName,
        ...(existing?.filterCategories || []),
        ...catSubcategories,
      ])
    );
    const safeCatImg = catImageInput.trim()
      ? sanitizeMediaUrl(catImageInput.trim(), '')
      : existing?.image || '';
    if (catImageInput.trim() && !safeCatImg) {
      showToast('Please enter a valid http(s) or /uploads/ cover image URL.');
      return;
    }
    const payload: Category = {
      id: existing?.id || `cat-${cleanSlug || Date.now()}`,
      name: cleanName,
      slug: cleanSlug || `cat-${Date.now()}`,
      filterCategories: filterSet,
      subcategories: catSubcategories,
      description: catDescInput.trim() || `${cleanName} collection from PYTHOX WORLD.`,
      image: safeCatImg,
      display_order: existing?.display_order ?? categories.length + 1,
    };
    try {
      await upsertCategory(payload);
      resetCategoryForm();
    } catch {
      // Toast already surfaced by StoreContext
    }
  };

  const handleAddCollection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!colTitle.trim()) return;
    const safeHero = colHero.trim()
      ? sanitizeMediaUrl(colHero.trim(), '')
      : EDITORIAL_MEDIA.prodBomberJacket;
    if (colHero.trim() && !safeHero) {
      showToast('Please provide a valid http(s) or /uploads/ collection hero URL.');
      return;
    }
    const slug = colTitle
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    const newCol: Collection = {
      id: `col-${slug}`,
      title: colTitle.trim(),
      slug,
      description: colDesc.trim() || 'Curated PYTHOX WORLD men’s seasonal capsule.',
      hero_image: safeHero,
      featured: true,
    };
    try {
      await upsertCollection(newCol);
      setColTitle('');
      setColDesc('');
    } catch {
      // Toast already surfaced by StoreContext
    }
  };

  const handleCreateCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!coupCode.trim()) return;
    const c: Coupon = {
      id: `coup-${Date.now()}`,
      code: coupCode.trim().toUpperCase(),
      discountType: coupType,
      value: Math.max(1, Number(coupValue) || 10),
      minOrder: Math.max(0, Number(coupMin) || 0),
      expiryDate: coupExpiry || undefined,
      usageLimit: Math.max(1, Number(coupLimit) || 100),
      active: true,
      usageCount: 0,
    };
    try {
      await upsertCoupon(c);
      setCoupCode('');
    } catch {
      // Toast already surfaced by StoreContext
    }
  };

  const handleHeroImageUpload = async (file: File | undefined) => {
    if (!file) return;
    if (file.type && !file.type.startsWith('image/')) {
      showToast('Please select a valid image file (JPG, PNG, WEBP).');
      return;
    }
    setHeroUploading(true);
    try {
      const res = await fetch(
        `/api/admin/upload-media?kind=image&filename=${encodeURIComponent(file.name)}`,
        {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': file.type || 'image/jpeg',
            ...(adminSessionToken ? { 'x-admin-session': adminSessionToken } : {}),
          },
          body: file,
        }
      );
      const data = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !data.url) {
        throw new Error(data.error || 'Hero banner upload failed.');
      }
      setHeroImageUrl(data.url);
      await updateStoreSettings({ heroImageUrl: data.url });
      showToast('Homepage hero image updated & live');
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Unable to upload hero image.');
    } finally {
      setHeroUploading(false);
    }
  };

  const handleHeroDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setHeroDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      void handleHeroImageUpload(file);
    }
  };

  const handleResetHeroImage = async () => {
    try {
      await updateStoreSettings({ heroImageUrl: '' });
      setHeroImageUrl('');
      showToast('Hero banner reset to default campaign image');
    } catch {
      // Toast already surfaced by StoreContext
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    const rawHero = heroImageUrl.trim();
    const safeHero = rawHero ? sanitizeMediaUrl(rawHero, '') : '';
    if (rawHero && !safeHero) {
      showToast('Hero banner URL must start with https://, http://, or /uploads/.');
      return;
    }

    const rawPixel = metaPixelId.trim();
    const safePixel = rawPixel ? sanitizePixelId(rawPixel) : '';
    if (rawPixel && !safePixel) {
      showToast('Meta Pixel ID must contain 5 to 25 numeric digits only.');
      return;
    }

    const safeFb = sanitizeExternalHref(facebookUrl.trim(), '');
    if (facebookUrl.trim() && !safeFb) {
      showToast('Facebook URL must be a valid https:// or http:// URL.');
      return;
    }

    const safeIg = sanitizeExternalHref(instagramUrl.trim(), '');
    if (instagramUrl.trim() && !safeIg) {
      showToast('Instagram URL must be a valid https:// or http:// URL.');
      return;
    }

    try {
      await updateStoreSettings({
        insideDhakaCharge: Math.max(0, Number(insideDhaka) || 80),
        outsideDhakaCharge: Math.max(0, Number(outsideDhaka) || 130),
        expressSurcharge: Math.max(0, Number(expressSurcharge) || 70),
        freeShippingThreshold: Math.max(0, Number(freeThreshold) || 3000),
        announcementText: announcement.trim(),
        businessAddress: businessAddress.trim() || BRAND_LOCATION,
        supportEmail: supportEmail.trim(),
        supportPhone: supportPhone.trim(),
        whatsappNumber: whatsappNumber.trim(),
        messengerHandle: messengerHandle.trim(),
        facebookUrl: safeFb || 'https://facebook.com/pythoxworld',
        instagramUrl: safeIg || 'https://instagram.com/pythoxworld',
        metaPixelId: safePixel,
        heroImageUrl: safeHero,
      });
    } catch {
      // Toast already surfaced by StoreContext
    }
  };

  const handleCopyDispatchSlip = async (
    orderNumber: string,
    customer: string,
    phone: string,
    address: string,
    total: number,
    status: string
  ) => {
    const summary = `[PYTHOX WORLD Dispatch] ${orderNumber} · ${customer} (${phone}) · ${address} · ${formatBDT(
      total
    )} · Status: ${status}`;
    try {
      await navigator.clipboard.writeText(summary);
      showToast(`Dispatch summary copied for ${orderNumber}`);
    } catch {
      showToast(`${orderNumber}: ${formatBDT(total)} — ${status}`);
    }
  };

  const currentTabMeta = TABS.find((t) => t.id === activeTab) || TABS[0];
  const editingProductObj = editingProductId
    ? adminProducts.find((p) => p.id === editingProductId)
    : null;

  const activePromosCount = coupons.filter((c) => c.active).length;
  const todayLabel = new Date().toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  return (
    <div className="admin-console">
      <SeoHead
        title="Admin Dashboard — PYTHOX WORLD"
        description="PYTHOX WORLD Store Operations & Merchandising Portal"
      />

      {/* SIDEBAR — Exact Desktop Left (248px) & Mobile Full-Width Vertical Stack */}
      <aside className="admin-side">
        <div className="flex items-center gap-3 px-1.5">
          <div className="w-[38px] h-[38px] rounded-[10px] bg-white text-[#0A0A0A] flex items-center justify-center font-admin-display font-bold text-[17px] shrink-0">
            P
          </div>
          <div className="flex flex-col gap-0.5 min-w-0">
            <span className="font-admin-display font-semibold text-[15px] text-white truncate">
              PYTHOX WORLD
            </span>
            <span className="text-[11px] text-[#9A9A9A] tracking-[0.08em] uppercase">
              Admin Console
            </span>
          </div>
        </div>

        <nav aria-label="Admin sections" className="flex flex-col gap-[3px]">
          {TABS.map((item) => {
            const on = activeTab === item.id;
            const badgeCount =
              item.id === 'orders'
                ? analytics.newOrdersCount
                : item.id === 'inventory'
                  ? analytics.lowStockProducts.length
                  : 0;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                className={`admin-nav ${
                  on
                    ? 'admin-nav-active bg-white text-[#0A0A0A] font-semibold'
                    : 'bg-transparent text-[#B5B5B4] font-medium'
                }`}
              >
                <span>{item.label}</span>
                {badgeCount > 0 && (
                  <span
                    className={`min-w-[22px] h-[20px] px-[6px] rounded-full text-[11px] font-semibold inline-flex items-center justify-center tabular-nums ${
                      on ? 'bg-[#0A0A0A] text-white' : 'bg-[#2E2E2E] text-white'
                    }`}
                  >
                    {badgeCount}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        <div className="mt-auto flex flex-col gap-2 pt-5 border-t border-[#262626]">
          <div className="px-1.5 pb-1.5 flex flex-col gap-[3px]">
            <span className="text-[11px] text-[#9A9A9A] tracking-[0.08em] uppercase">
              Session
            </span>
            <span className="text-[12px] text-[#D4D4D3]">
              Unlocked · {serverConnected ? 'Server Connected' : 'Local Ready'}
            </span>
            <Link
              to="/"
              className="text-[11px] text-[#9A9A9A] hover:text-white underline underline-offset-2 mt-0.5 w-fit"
            >
              Return to Storefront
            </Link>
          </div>
          <button
            type="button"
            onClick={() => void handleLockSession()}
            className="h-[40px] rounded-[9px] border border-[#3A3A3A] bg-transparent text-white text-[13px] flex items-center justify-center gap-2 hover:bg-[#1F1F1F] cursor-pointer"
          >
            <svg
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#fff"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <rect x="4" y="11" width="16" height="10" rx="2" />
              <path d="M8 11V7a4 4 0 0 1 8 0v4" />
            </svg>
            Lock Session
          </button>
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <main className="admin-main">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex flex-col gap-1.5 min-w-0">
            <span className="admin-lbl">{todayLabel}</span>
            <h1 className="text-[32px] leading-[1.1] text-[#0A0A0A]">{currentTabMeta.label}</h1>
            <span className="admin-sub text-[13px]">{currentTabMeta.subtitle}</span>
          </div>
          <div className="flex flex-wrap gap-2.5 items-center">
            <span className="admin-pill bg-white border border-[#D4D4D3] text-[#6A6A6A]">
              {serverConnected ? 'Server Connected' : 'Local Ready'}
            </span>
            <button
              type="button"
              className="admin-btn inline-flex items-center gap-1.5"
              onClick={() => setActiveTab('settings')}
            >
              <ImageIcon className="h-3.5 w-3.5" />
              Hero Banner
            </button>
            <button type="button" className="admin-btn" onClick={handleExportBackup}>
              Backup JSON
            </button>
            <button
              type="button"
              disabled={isSeeding}
              className="admin-btn admin-btn-dark"
              onClick={() => void handleSeedDatabase()}
            >
              {isSeeding ? 'Syncing...' : 'Sync Catalog'}
            </button>
          </div>
        </header>

        {/* ================= OVERVIEW ================= */}
        {activeTab === 'overview' && (
          <div className="flex flex-col gap-[22px]">
            <div className="grid grid-cols-[repeat(auto-fit,minmax(170px,1fr))] gap-[14px]">
              <div className="admin-card p-5 flex flex-col gap-2.5 !bg-[#0A0A0A] text-white !border-[#0A0A0A]">
                <span className="admin-lbl !text-[#B5B5B4]">Total Sales</span>
                <span className="font-admin-display text-[30px] font-semibold leading-none tabular-nums">
                  {formatBDT(analytics.totalSales)}
                </span>
                <span className="text-[12px] text-[#B5B5B4]">Cancelled orders excluded</span>
              </div>

              <div className="admin-card p-5 flex flex-col gap-2.5">
                <span className="admin-lbl">Total Orders</span>
                <span className="font-admin-display text-[30px] font-semibold leading-none tabular-nums text-[#0A0A0A]">
                  {analytics.orderCount}
                </span>
                <span className="text-[12px] text-[#6A6A6A]">
                  {analytics.newOrdersCount} awaiting confirmation
                </span>
              </div>

              <div className="admin-card p-5 flex flex-col gap-2.5">
                <span className="admin-lbl">Customers</span>
                <span className="font-admin-display text-[30px] font-semibold leading-none tabular-nums text-[#0A0A0A]">
                  {analytics.customers.length}
                </span>
                <span className="text-[12px] text-[#6A6A6A]">From order data</span>
              </div>

              <div className="admin-card p-5 flex flex-col gap-2.5">
                <span className="admin-lbl">Products</span>
                <span className="font-admin-display text-[30px] font-semibold leading-none tabular-nums text-[#0A0A0A]">
                  {adminProducts.length}
                </span>
                <span className="text-[12px] text-[#6A6A6A]">
                  {analytics.publishedCount} live · {analytics.draftCount} draft · {categories.length} categories
                </span>
              </div>

              <div className="admin-card p-5 flex flex-col gap-2.5 !bg-[#E4E4E3] !border-[#E4E4E3]">
                <span className="admin-lbl !text-[#4A4A4A]">Low Stock</span>
                <span className="font-admin-display text-[30px] font-semibold leading-none tabular-nums text-[#0A0A0A]">
                  {analytics.lowStockProducts.length}
                </span>
                <span className="text-[12px] text-[#4A4A4A]">15 units or fewer</span>
              </div>
            </div>

            <div className="flex flex-wrap gap-[22px] items-start">
              <div className="flex-[999_1_520px] min-w-0 flex flex-col gap-[22px]">
                <section className="admin-card p-6 flex flex-col gap-[18px]">
                  <div className="flex justify-between items-baseline gap-3">
                    <h2 className="text-[18px]">Revenue by Category</h2>
                    <span className="admin-sub">All time, cancelled excluded</span>
                  </div>
                  <div className="flex flex-col gap-[13px]">
                    {analytics.revByCategory.map((r) => (
                      <div
                        key={r.category}
                        className="grid grid-cols-[110px_minmax(0,1fr)_92px] gap-[14px] items-center text-[13px]"
                      >
                        <span className="truncate">{r.category}</span>
                        <div className="h-3 bg-[#EDEDEC] rounded-[6px] overflow-hidden">
                          <div
                            className="h-full rounded-[6px]"
                            style={{ width: `${r.pct}%`, backgroundColor: r.color }}
                          />
                        </div>
                        <span className="text-right tabular-nums font-medium">
                          {formatBDT(r.revenue)}
                        </span>
                      </div>
                    ))}
                  </div>
                </section>

                <div className="flex flex-wrap gap-[22px]">
                  <section className="admin-card flex-[1_1_300px] min-w-0 p-6 flex flex-col gap-[14px]">
                    <h2 className="text-[18px]">Best-Selling Products</h2>
                    <div className="flex flex-col">
                      {analytics.bestSelling.length === 0 ? (
                        <div className="py-[11px] border-t border-[#ECECEB] text-[13px] admin-mut">
                          No sales data yet.
                        </div>
                      ) : (
                        analytics.bestSelling.map((b, i) => (
                          <div
                            key={`${b.name}-${i}`}
                            className="grid grid-cols-[26px_minmax(0,1fr)_auto] gap-3 items-center py-[11px] border-t border-[#ECECEB] text-[13px]"
                          >
                            <span className="font-admin-display font-semibold text-[#6A6A6A]">
                              {i + 1}
                            </span>
                            <div className="flex flex-col gap-0.5 min-w-0">
                              <span className="font-medium truncate">{b.name}</span>
                              <span className="admin-sub">{b.units} units sold</span>
                            </div>
                            <span className="tabular-nums font-medium">{formatBDT(b.rev)}</span>
                          </div>
                        ))
                      )}
                    </div>
                  </section>

                  <section className="admin-card flex-[1_1_300px] min-w-0 p-6 flex flex-col gap-[14px]">
                    <h2 className="text-[18px]">Recent Orders</h2>
                    <div className="flex flex-col">
                      {orders.length === 0 ? (
                        <div className="py-[11px] border-t border-[#ECECEB] text-[13px] admin-mut">
                          No orders placed yet.
                        </div>
                      ) : (
                        orders.slice(0, 4).map((o) => (
                          <div
                            key={o.id}
                            className="flex flex-col gap-1.5 py-[11px] border-t border-[#ECECEB] text-[13px]"
                          >
                            <div className="flex justify-between gap-2.5">
                              <span className="font-semibold">{o.orderNumber}</span>
                              <span className="tabular-nums font-medium">{formatBDT(o.total)}</span>
                            </div>
                            <div className="flex justify-between items-center gap-2.5">
                              <span className="admin-mut truncate">
                                {o.customerName} · {o.city}
                              </span>
                              <span className="admin-pill" style={getPillStyle(o.status)}>
                                {o.status}
                              </span>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </section>
                </div>
              </div>

              <div className="flex-[1_1_320px] max-w-[400px] min-w-0 flex flex-col gap-[22px]">
                <section className="bg-[#0A0A0A] text-white rounded-[14px] p-6 flex flex-col gap-[18px]">
                  <div className="flex justify-between items-center">
                    <h2 className="text-[18px]">Storefront Pulse</h2>
                    <span className="flex items-center gap-1.5 text-[11px] text-[#C8C8C7]">
                      <span className="w-[7px] h-[7px] rounded-full bg-white" />
                      Live
                    </span>
                  </div>
                  <div className="flex flex-col">
                    <div className="flex justify-between py-3 border-t border-[#2A2A2A] text-[13px]">
                      <span className="text-[#B5B5B4]">Active categories</span>
                      <span className="font-semibold">{categories.length}</span>
                    </div>
                    <div className="flex justify-between py-3 border-t border-[#2A2A2A] text-[13px]">
                      <span className="text-[#B5B5B4]">Active promo codes</span>
                      <span className="font-semibold">{activePromosCount}</span>
                    </div>
                    <div className="flex justify-between py-3 border-t border-[#2A2A2A] text-[13px]">
                      <span className="text-[#B5B5B4]">Free shipping above</span>
                      <span className="font-semibold">
                        {formatBDT(settings.freeShippingThreshold)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center pt-3 border-t border-[#2A2A2A] text-[13px]">
                      <span className="text-[#B5B5B4]">Payments</span>
                      <span className="flex gap-1.5">
                        <span className="admin-pill border border-[#4A4A4A] text-white">COD</span>
                        <span className="admin-pill border border-[#4A4A4A] text-white">
                          bKash
                        </span>
                        <span className="admin-pill border border-[#4A4A4A] text-white">
                          Nagad
                        </span>
                      </span>
                    </div>
                  </div>
                </section>

                <section className="admin-card p-6 flex flex-col gap-[14px]">
                  <div className="flex justify-between items-baseline">
                    <h2 className="text-[18px]">Inventory Alerts</h2>
                    <span className="admin-sub">15 or fewer</span>
                  </div>
                  <div className="flex flex-col">
                    {analytics.lowStockProducts.length === 0 ? (
                      <div className="py-[11px] border-t border-[#ECECEB] text-[13px] admin-mut">
                        All products are well stocked.
                      </div>
                    ) : (
                      analytics.lowStockProducts.slice(0, 5).map((p) => {
                        const isOut = p.inventory === 0;
                        return (
                          <div
                            key={p.id}
                            className="grid grid-cols-[minmax(0,1fr)_auto] gap-2.5 items-center py-[11px] border-t border-[#ECECEB] text-[13px]"
                          >
                            <div className="flex flex-col gap-0.5 min-w-0">
                              <span className="font-medium truncate">{p.name}</span>
                              <span className="admin-sub">{p.sku}</span>
                            </div>
                            <span
                              className="admin-pill"
                              style={getPillStyle(isOut ? 'Out of Stock' : 'Low Stock')}
                            >
                              {isOut ? 'Out of Stock' : `${p.inventory} left`}
                            </span>
                          </div>
                        );
                      })
                    )}
                  </div>
                  <button
                    type="button"
                    className="admin-btn admin-btn-dark"
                    onClick={() => setActiveTab('inventory')}
                  >
                    Open Inventory Manager
                  </button>
                </section>
              </div>
            </div>
          </div>
        )}

        {/* ================= PRODUCTS ================= */}
        {activeTab === 'products' && (
          <div className="flex flex-col gap-[22px]">
            {/* Product Management Summary Strip */}
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
              {[
                { label: 'Total Products', val: adminProducts.length },
                { label: 'Published', val: analytics.publishedCount },
                { label: 'Draft', val: analytics.draftCount },
                { label: 'Unpublished', val: analytics.unpublishedCount },
                { label: 'Out of Stock', val: analytics.outOfStockCount },
                { label: 'Categories', val: categories.length },
                { label: 'Low Stock (≤15)', val: analytics.lowStockProducts.length },
              ].map((stat) => (
                <div key={stat.label} className="admin-card p-3.5 flex flex-col gap-1">
                  <span className="text-[10.5px] uppercase tracking-[0.08em] text-[#6A6A6A] font-medium">
                    {stat.label}
                  </span>
                  <span className="font-admin-display text-[22px] font-semibold tabular-nums text-[#0A0A0A]">
                    {stat.val}
                  </span>
                </div>
              ))}
            </div>

            <div ref={productFormRef}>
              <AdminProductUploadForm
                categories={categories}
                collections={collections}
                adminSessionToken={adminSessionToken}
                editingProduct={editingProductObj || null}
                onCancelEdit={() => setEditingProductId(null)}
                upsertProduct={upsertProduct}
                showToast={showToast}
              />
            </div>

            <section className="admin-card min-w-0 overflow-hidden">
              <div className="px-5 pt-5 pb-4 flex flex-wrap justify-between items-center gap-3 border-b border-[#ECECEB]">
                <div>
                  <h2 className="text-[18px]">All Products</h2>
                  <span className="admin-sub">
                    {analytics.publishedCount} published on website · {adminProducts.length} total in admin
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto">
                  <div className="relative flex-1 sm:w-56">
                    <Search className="h-3.5 w-3.5 text-[#6A6A6A] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      value={prodSearch}
                      onChange={(e) => setProdSearch(e.target.value)}
                      placeholder="Search name, SKU, tag..."
                      className="admin-inp admin-inp-sm !pl-8"
                    />
                  </div>
                  <select
                    aria-label="Filter by product status"
                    value={prodStatusFilter}
                    onChange={(e) =>
                      setProdStatusFilter(e.target.value as 'All' | ProductStatus)
                    }
                    className="admin-inp admin-inp-sm !w-auto"
                  >
                    <option value="All">All Statuses</option>
                    <option value="Published">Published</option>
                    <option value="Draft">Draft</option>
                    <option value="Unpublished">Unpublished</option>
                    <option value="Out of Stock">Out of Stock</option>
                  </select>
                  <select
                    aria-label="Filter by category"
                    value={prodCategoryFilter}
                    onChange={(e) => setProdCategoryFilter(e.target.value)}
                    className="admin-inp admin-inp-sm !w-auto"
                  >
                    <option value="All">All Categories</option>
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.name}>
                        {cat.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="overflow-x-auto">
                <div className="min-w-[980px]">
                  <div className="admin-rw admin-hd grid-cols-[2.2fr_1.1fr_1fr_0.65fr_0.95fr_2.1fr]">
                    <span>Product</span>
                    <span>Category</span>
                    <span>Price</span>
                    <span>Stock</span>
                    <span>Status</span>
                    <span>Actions</span>
                  </div>
                  {filteredAdminProducts.length === 0 ? (
                    <div className="p-8 text-center text-[13px] text-[#6A6A6A]">
                      {adminProducts.length === 0
                        ? 'No products added yet. Use the form above to add and publish your first product.'
                        : 'No products match the current search or filter criteria.'}
                    </div>
                  ) : (
                    filteredAdminProducts.map((p) => {
                      const thumbSrc = p.primaryImage || p.images?.[0];
                      const thumbBroken = brokenImages[p.id];
                      const isPublished = p.status === 'Published';
                      return (
                        <div
                          key={p.id}
                          className="admin-rw grid-cols-[2.2fr_1.1fr_1fr_0.65fr_0.95fr_2.1fr]"
                          style={{
                            backgroundColor: editingProductId === p.id ? '#F7F7F6' : '#FFFFFF',
                          }}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            {thumbSrc && !thumbBroken ? (
                              <img
                                src={thumbSrc}
                                alt={p.name}
                                onError={() =>
                                  setBrokenImages((prev) => ({ ...prev, [p.id]: true }))
                                }
                                className="w-[42px] h-[52px] rounded-[7px] shrink-0 object-cover bg-[#EFEFEE]"
                              />
                            ) : (
                              <div className="admin-stripe w-[42px] h-[52px] rounded-[7px] shrink-0" />
                            )}
                            <div className="flex flex-col gap-0.5 min-w-0">
                              <span className="font-medium truncate">{p.name}</span>
                              <span className="admin-sub truncate">
                                {p.sku} · {p.images?.length || 0} photo
                                {(p.images?.length || 0) === 1 ? '' : 's'}
                                {p.videoUrl ? ' · Video' : ''}
                              </span>
                            </div>
                          </div>

                          <div className="flex flex-col gap-0.5 min-w-0">
                            <span className="truncate">{p.category}</span>
                            {p.subcategory && (
                              <span className="admin-sub truncate">{p.subcategory}</span>
                            )}
                          </div>

                          <div className="flex flex-col gap-0.5 tabular-nums">
                            <span className="font-medium">{formatBDT(p.price)}</span>
                            {p.compare_at_price && p.compare_at_price > p.price ? (
                              <span className="admin-sub line-through">
                                {formatBDT(p.compare_at_price)}
                              </span>
                            ) : null}
                          </div>

                          <span className="tabular-nums">{p.inventory}</span>

                          <span>
                            <span
                              className="admin-pill"
                              style={getPillStyle(p.status || 'Draft')}
                            >
                              {p.status || 'Draft'}
                            </span>
                          </span>

                          <div className="flex flex-wrap gap-1.5">
                            <button
                              type="button"
                              className={`admin-btn admin-btn-sm ${
                                isPublished ? '' : 'admin-btn-dark'
                              }`}
                              onClick={() =>
                                void upsertProduct({
                                  ...p,
                                  status: isPublished ? 'Unpublished' : 'Published',
                                })
                              }
                            >
                              {isPublished ? 'Unpublish' : 'Publish'}
                            </button>
                            <button
                              type="button"
                              className="admin-btn admin-btn-sm"
                              onClick={() => startEditProduct(p)}
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              title="Duplicate as Draft"
                              className="admin-btn admin-btn-sm"
                              onClick={() => void duplicateProduct(p)}
                            >
                              <Copy className="h-3 w-3" />
                            </button>
                            <button
                              type="button"
                              className="admin-btn admin-btn-sm"
                              onClick={() =>
                                setConfirmDelete({
                                  kind: 'product',
                                  id: p.id,
                                  name: p.name,
                                })
                              }
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </section>
          </div>
        )}

        {/* ================= INVENTORY ================= */}
        {activeTab === 'inventory' && (
          <section className="admin-card overflow-hidden">
            <div className="px-5 pt-5 pb-4 flex flex-wrap justify-between items-baseline gap-2">
              <h2 className="text-[18px]">Stock Control</h2>
              <span className="admin-sub">
                {analytics.lowCountOnly} low, {analytics.outOfStockCount} out of stock
              </span>
            </div>
            <div className="overflow-x-auto">
              <div className="min-w-[860px]">
                <div className="admin-rw admin-hd grid-cols-[2.2fr_1fr_1.2fr_0.7fr_1.1fr_2fr]">
                  <span>Product</span>
                  <span>Category</span>
                  <span>Sizes</span>
                  <span>Stock</span>
                  <span>Status</span>
                  <span>Quick Adjust</span>
                </div>
                {adminProducts.length === 0 ? (
                  <div className="p-8 text-center text-[13px] text-[#6A6A6A]">
                    No products available in inventory yet.
                  </div>
                ) : (
                  adminProducts.map((p) => {
                    const statusKey =
                      p.inventory === 0
                        ? 'Out of Stock'
                        : p.inventory <= 15
                          ? 'Low Stock'
                          : 'In Stock';
                    return (
                      <div
                        key={p.id}
                        className="admin-rw grid-cols-[2.2fr_1fr_1.2fr_0.7fr_1.1fr_2fr]"
                      >
                        <div className="flex flex-col gap-0.5 min-w-0">
                          <span className="font-medium truncate">{p.name}</span>
                          <span className="admin-sub">
                            {p.sku} · {p.status}
                          </span>
                        </div>
                        <span>{p.category}</span>
                        <span className="admin-mut truncate">{(p.sizes ?? []).join(', ')}</span>
                        <span className="font-admin-display font-semibold text-[16px] tabular-nums">
                          {p.inventory}
                        </span>
                        <span>
                          <span className="admin-pill" style={getPillStyle(statusKey)}>
                            {statusKey}
                          </span>
                        </span>
                        <div className="flex gap-1.5">
                          <button
                            type="button"
                            className="admin-btn admin-btn-sm"
                            onClick={() =>
                              void upsertProduct({ ...p, inventory: p.inventory + 10 })
                            }
                          >
                            +10
                          </button>
                          <button
                            type="button"
                            className="admin-btn admin-btn-sm"
                            onClick={() =>
                              void upsertProduct({
                                ...p,
                                inventory: Math.max(0, p.inventory - 5),
                              })
                            }
                          >
                            -5
                          </button>
                          <button
                            type="button"
                            className="admin-btn admin-btn-sm"
                            onClick={() => void upsertProduct({ ...p, inventory: 0 })}
                          >
                            Set 0
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </section>
        )}

        {/* ================= ORDERS ================= */}
        {activeTab === 'orders' && (
          <section className="admin-card overflow-hidden">
            <div className="px-5 pt-5 pb-4 flex flex-wrap justify-between items-baseline gap-2">
              <h2 className="text-[18px]">All Orders</h2>
              <span className="admin-sub">
                Status changes appear on the customer&apos;s Track Order page
              </span>
            </div>
            <div className="overflow-x-auto">
              <div className="min-w-[1240px]">
                <div className="admin-rw admin-hd grid-cols-[1.1fr_1.5fr_1.2fr_1.6fr_0.9fr_1.5fr_1.5fr_0.9fr]">
                  <span>Order</span>
                  <span>Customer</span>
                  <span>Location</span>
                  <span>Payment</span>
                  <span>Total</span>
                  <span>Order Status</span>
                  <span>Delivery Note</span>
                  <span>Dispatch</span>
                </div>
                {orders.length === 0 ? (
                  <div className="admin-rw">
                    <span className="admin-mut">No orders found yet.</span>
                  </div>
                ) : (
                  orders.map((o) => {
                    const noteVal =
                      orderNotes[o.id] !== undefined ? orderNotes[o.id] : o.deliveryStatus || '';
                    const formattedDate = new Date(o.createdAt).toLocaleString('en-GB', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    });
                    const itemsSummary = (o.items ?? [])
                      .map((item) => `${item.name} (${item.size}) ×${item.quantity}`)
                      .join(', ');
                    return (
                      <div
                        key={o.id}
                        className="admin-rw grid-cols-[1.1fr_1.5fr_1.2fr_1.6fr_0.9fr_1.5fr_1.5fr_0.9fr] !items-start"
                      >
                        <div className="flex flex-col gap-[3px] min-w-0">
                          <span className="font-semibold">{o.orderNumber}</span>
                          <span className="admin-sub">{formattedDate}</span>
                          {itemsSummary && (
                            <span className="admin-sub text-[11px] leading-snug line-clamp-2">
                              {itemsSummary}
                            </span>
                          )}
                        </div>
                        <div className="flex flex-col gap-[3px] min-w-0">
                          <span className="font-medium truncate">{o.customerName}</span>
                          <span className="admin-sub">{o.customerPhone}</span>
                          {o.customerEmail && (
                            <span className="admin-sub truncate">{o.customerEmail}</span>
                          )}
                        </div>
                        <div className="flex flex-col gap-[3px] min-w-0">
                          <span className="truncate">{o.address}</span>
                          <span className="admin-sub truncate">
                            {o.area}, {o.city}
                            {o.postalCode && o.postalCode !== '0000' ? ` ${o.postalCode}` : ''}
                          </span>
                        </div>
                        <div className="flex flex-col gap-1.5 min-w-0">
                          <span className="admin-sub !font-semibold !text-[#0A0A0A]">
                            {o.paymentMethod}
                          </span>
                          {o.paymentReference && (
                            <span className="admin-sub text-[11px] truncate">
                              TrxID: {o.paymentReference}
                            </span>
                          )}
                          {o.paymentSenderNumber && (
                            <span className="admin-sub text-[11px] truncate">
                              From: {o.paymentSenderNumber}
                            </span>
                          )}
                          <select
                            className="admin-inp admin-inp-sm"
                            aria-label="Payment status"
                            value={o.paymentStatus}
                            onChange={(e) =>
                              void updateOrderDetails(o.id, {
                                paymentStatus: e.target.value as PaymentStatus,
                              }).catch(() => {})
                            }
                          >
                            {PAYMENT_STATUSES.map((ps) => (
                              <option key={ps} value={ps}>
                                {ps}
                              </option>
                            ))}
                          </select>
                        </div>
                        <span className="font-semibold tabular-nums">{formatBDT(o.total)}</span>
                        <div className="flex flex-col gap-1.5">
                          <span>
                            <span className="admin-pill" style={getPillStyle(o.status)}>
                              {o.status}
                            </span>
                          </span>
                          <select
                            className="admin-inp admin-inp-sm"
                            aria-label="Order status"
                            value={o.status}
                            onChange={(e) =>
                              void updateOrderDetails(o.id, {
                                status: e.target.value as OrderStatus,
                              }).catch(() => {})
                            }
                          >
                            {ORDER_STATUSES.map((st) => (
                              <option key={st} value={st}>
                                {st}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="flex flex-col gap-1.5 min-w-0">
                          {o.deliveryNote && (
                            <span className="admin-sub text-[11px] leading-snug truncate" title={o.deliveryNote}>
                              Customer: {o.deliveryNote}
                            </span>
                          )}
                          <input
                            className="admin-inp admin-inp-sm"
                            aria-label="Delivery note"
                            placeholder="Courier or tracking note"
                            value={noteVal}
                            onChange={(e) =>
                              setOrderNotes((prev) => ({ ...prev, [o.id]: e.target.value }))
                            }
                            onBlur={() => {
                              if (
                                orderNotes[o.id] !== undefined &&
                                orderNotes[o.id] !== (o.deliveryStatus || '')
                              ) {
                                void updateOrderDetails(o.id, {
                                  deliveryStatus: orderNotes[o.id],
                                }).catch(() => {});
                              }
                            }}
                          />
                        </div>
                        <button
                          type="button"
                          className="admin-btn admin-btn-sm"
                          onClick={() =>
                            void handleCopyDispatchSlip(
                              o.orderNumber,
                              o.customerName,
                              o.customerPhone,
                              `${o.address}, ${o.area}, ${o.city}`,
                              o.total,
                              o.status
                            )
                          }
                        >
                          Copy Slip
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </section>
        )}

        {/* ================= CUSTOMERS ================= */}
        {activeTab === 'customers' && (
          <section className="admin-card overflow-hidden">
            <div className="px-5 pt-5 pb-4 flex justify-between items-baseline">
              <h2 className="text-[18px]">Customer List</h2>
              <span className="admin-sub">Built automatically from order data</span>
            </div>
            <div className="overflow-x-auto">
              <div className="min-w-[820px]">
                <div className="admin-rw admin-hd grid-cols-[1.6fr_2fr_1.3fr_1.2fr_0.8fr_1fr]">
                  <span>Name</span>
                  <span>Email</span>
                  <span>Mobile</span>
                  <span>District</span>
                  <span>Orders</span>
                  <span className="text-right">Total Spend</span>
                </div>
                {analytics.customers.length === 0 ? (
                  <div className="admin-rw">
                    <span className="admin-mut">No customer records yet.</span>
                  </div>
                ) : (
                  analytics.customers.map((c, idx) => (
                    <div
                      key={`${c.email}-${idx}`}
                      className="admin-rw grid-cols-[1.6fr_2fr_1.3fr_1.2fr_0.8fr_1fr]"
                    >
                      <span className="font-medium truncate">{c.name}</span>
                      <span className="admin-mut truncate">{c.email}</span>
                      <span>{c.phone}</span>
                      <span>{c.city}</span>
                      <span className="tabular-nums">{c.orders}</span>
                      <span className="text-right font-semibold tabular-nums">
                        {formatBDT(c.spent)}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </section>
        )}

        {/* ================= CATEGORIES ================= */}
        {activeTab === 'categories' && (
          <div className="flex flex-wrap gap-[22px] items-start">
            <div className="flex-[999_1_520px] min-w-0 grid grid-cols-[repeat(auto-fill,minmax(290px,1fr))] gap-[18px]">
              {categories.length === 0 ? (
                <div className="admin-card p-8 col-span-full text-center text-[13px] text-[#6A6A6A]">
                  No categories defined yet. Create your first category using the panel.
                </div>
              ) : (
                categories.map((cat) => {
                  const count = adminProducts.filter(
                    (p) =>
                      p.category.toLowerCase() === cat.name.toLowerCase() ||
                      cat.filterCategories?.some(
                        (fc) => fc.toLowerCase() === p.category.toLowerCase()
                      )
                  ).length;
                  const imgBroken = brokenImages[`cat-${cat.id}`];
                  return (
                    <section key={cat.id} className="admin-card overflow-hidden flex flex-col">
                      <div className="admin-stripe relative h-[150px] flex items-end justify-between p-3">
                        {cat.image && !imgBroken && (
                          <img
                            src={cat.image}
                            alt={cat.name}
                            onError={() =>
                              setBrokenImages((prev) => ({ ...prev, [`cat-${cat.id}`]: true }))
                            }
                            className="absolute inset-0 w-full h-full object-cover"
                          />
                        )}
                        <span className="admin-pill relative z-10 bg-[#0A0A0A] text-white">
                          {count} product{count === 1 ? '' : 's'}
                        </span>
                      </div>
                      <div className="p-5 pt-[18px] flex flex-col gap-2.5 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="text-[17px]">{cat.name}</h3>
                          <span className="text-[11px] font-mono text-[#6A6A6A]">/{cat.slug}</span>
                        </div>
                        <span className="admin-sub text-[13px] leading-[1.5]">
                          {cat.description}
                        </span>
                        {cat.subcategories && cat.subcategories.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 pt-1">
                            {cat.subcategories.map((sub) => (
                              <span
                                key={sub}
                                className="px-2.5 py-0.5 rounded-full bg-[#F1F1F0] border border-[#D4D4D3] text-[11px] text-[#2E2E2E]"
                              >
                                {sub}
                              </span>
                            ))}
                          </div>
                        )}
                        <div className="mt-auto pt-3 flex items-center gap-2">
                          <button
                            type="button"
                            className="admin-btn admin-btn-sm"
                            onClick={() => startEditCategory(cat)}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            className="admin-btn admin-btn-sm"
                            onClick={() =>
                              setConfirmDelete({
                                kind: 'category',
                                id: cat.id,
                                name: cat.name,
                                productCount: count,
                              })
                            }
                          >
                            <Trash2 className="h-3 w-3" /> Delete
                          </button>
                        </div>
                      </div>
                    </section>
                  );
                })
              )}
            </div>

            <form
              onSubmit={(e) => void handleSaveCategoryForm(e)}
              className="admin-card flex-[1_1_320px] max-w-[420px] min-w-0 p-6 flex flex-col gap-4"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex flex-col gap-0.5">
                  <h2 className="text-[18px]">
                    {catEditingId ? 'Edit Category' : 'Add Category'}
                  </h2>
                  <span className="admin-sub">
                    Create categories and subcategories for your store
                  </span>
                </div>
                {catEditingId && (
                  <button
                    type="button"
                    onClick={resetCategoryForm}
                    className="admin-btn admin-btn-sm"
                  >
                    Cancel
                  </button>
                )}
              </div>

              <div className="admin-fld">
                <label className="admin-lbl" htmlFor="cat-name-inp">
                  Category Name <span className="text-[#B91C1C]">*</span>
                </label>
                <input
                  id="cat-name-inp"
                  className="admin-inp"
                  required
                  value={catNameInput}
                  onChange={(e) => setCatNameInput(e.target.value)}
                  placeholder="e.g. Heavyweight Tees"
                />
              </div>

              <div className="admin-fld">
                <label className="admin-lbl" htmlFor="cat-slug-inp">
                  Slug (URL Key)
                </label>
                <input
                  id="cat-slug-inp"
                  className="admin-inp"
                  value={catSlugInput}
                  onChange={(e) => setCatSlugInput(e.target.value)}
                  placeholder="Auto-generated if left blank"
                />
              </div>

              <div className="admin-fld">
                <label className="admin-lbl" htmlFor="cat-desc-inp">
                  Description
                </label>
                <textarea
                  id="cat-desc-inp"
                  rows={2}
                  className="admin-inp"
                  value={catDescInput}
                  onChange={(e) => setCatDescInput(e.target.value)}
                  placeholder="Short editorial description for this category"
                />
              </div>

              <div className="admin-fld">
                <label className="admin-lbl" htmlFor="cat-sub-inp">
                  Subcategories
                </label>
                <div className="flex gap-2">
                  <input
                    id="cat-sub-inp"
                    className="admin-inp"
                    value={catSubInput}
                    onChange={(e) => setCatSubInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ',') {
                        e.preventDefault();
                        handleAddCatSub();
                      }
                    }}
                    placeholder="e.g. Boxy Tee, Zip Hoodie"
                  />
                  <button
                    type="button"
                    onClick={handleAddCatSub}
                    className="admin-btn admin-btn-sm !h-[38px] shrink-0"
                  >
                    <Plus className="h-3.5 w-3.5" /> Add
                  </button>
                </div>
                {catSubcategories.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {catSubcategories.map((sub) => (
                      <span
                        key={sub}
                        className="inline-flex items-center gap-1 h-7 pl-2.5 pr-1.5 rounded-full bg-[#F1F1F0] border border-[#D4D4D3] text-[11.5px]"
                      >
                        <span>{sub}</span>
                        <button
                          type="button"
                          onClick={() =>
                            setCatSubcategories((prev) => prev.filter((x) => x !== sub))
                          }
                          aria-label={`Remove subcategory ${sub}`}
                          className="w-4 h-4 rounded-full hover:bg-[#E2E2E1] inline-flex items-center justify-center cursor-pointer"
                        >
                          <X className="h-2.5 w-2.5" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div className="admin-fld">
                <label className="admin-lbl" htmlFor="cat-img-inp">
                  Cover Image URL or Upload
                </label>
                <div className="flex gap-2">
                  <input
                    id="cat-img-inp"
                    className="admin-inp"
                    value={catImageInput}
                    onChange={(e) => setCatImageInput(e.target.value)}
                    placeholder="https:// or /uploads/..."
                  />
                  <label className="admin-btn admin-btn-sm !h-[38px] shrink-0 cursor-pointer">
                    <Upload className="h-3.5 w-3.5" />
                    {catUploadingImg ? '...' : 'Upload'}
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      className="hidden"
                      onChange={(e) => {
                        void handleCategoryImageUpload(e.target.files?.[0]);
                        e.target.value = '';
                      }}
                    />
                  </label>
                </div>
              </div>

              <button type="submit" className="admin-btn admin-btn-dark !h-[44px]">
                {catEditingId ? 'Update Category' : 'Create Category'}
              </button>
            </form>
          </div>
        )}

        {/* ================= COLLECTIONS ================= */}
        {activeTab === 'collections' && (
          <div className="flex flex-wrap gap-[22px] items-start">
            <div className="flex-[999_1_520px] min-w-0 grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-[18px]">
              {collections.map((c) => {
                const count = adminProducts.filter((p) => p.collection === c.slug).length;
                const imgBroken = brokenImages[`col-${c.id}`];
                return (
                  <section key={c.id} className="admin-card overflow-hidden flex flex-col">
                    <div className="admin-stripe relative h-[170px]">
                      {c.hero_image && !imgBroken && (
                        <img
                          src={c.hero_image}
                          alt={c.title}
                          onError={() =>
                            setBrokenImages((prev) => ({ ...prev, [`col-${c.id}`]: true }))
                          }
                          className="w-full h-full object-cover"
                        />
                      )}
                    </div>
                    <div className="p-5 pt-[18px] flex flex-col gap-2.5 flex-1">
                      <h3 className="text-[17px]">{c.title}</h3>
                      <span className="admin-sub text-[13px] leading-[1.5]">
                        {c.description}
                      </span>
                      <div className="mt-auto flex justify-between items-center gap-2">
                        <span className="admin-sub">{count} products</span>
                        <Link to={`/collection/${c.slug}`} className="admin-btn admin-btn-sm">
                          Visit Live Page
                        </Link>
                      </div>
                    </div>
                  </section>
                );
              })}
            </div>

            <form
              onSubmit={(e) => void handleAddCollection(e)}
              className="admin-card flex-[1_1_320px] max-w-[400px] min-w-0 p-6 flex flex-col gap-4"
            >
              <div className="flex flex-col gap-1">
                <h2 className="text-[18px]">Add Collection</h2>
                <span className="admin-sub">
                  A capsule appears on the storefront once published
                </span>
              </div>
              <div className="admin-fld">
                <label className="admin-lbl" htmlFor="cf-title">
                  Title
                </label>
                <input
                  className="admin-inp"
                  id="cf-title"
                  required
                  value={colTitle}
                  onChange={(e) => setColTitle(e.target.value)}
                  placeholder="Winter Capsule"
                />
              </div>
              <div className="admin-fld">
                <label className="admin-lbl" htmlFor="cf-desc">
                  Description
                </label>
                <textarea
                  className="admin-inp"
                  id="cf-desc"
                  value={colDesc}
                  onChange={(e) => setColDesc(e.target.value)}
                  placeholder="Short line shown on the collection page"
                />
              </div>
              <div className="admin-fld">
                <label className="admin-lbl" htmlFor="cf-img">
                  Cover Image
                </label>
                <input
                  className="admin-inp"
                  id="cf-img"
                  list="pw-image-presets"
                  value={colHero}
                  onChange={(e) => setColHero(e.target.value)}
                  placeholder="https://"
                />
              </div>
              <button type="submit" className="admin-btn admin-btn-dark !h-[44px]">
                Add Collection
              </button>
            </form>
          </div>
        )}

        {/* ================= COUPONS ================= */}
        {activeTab === 'coupons' && (
          <div className="flex flex-wrap gap-[22px] items-start">
            <section className="admin-card flex-[999_1_520px] min-w-0 overflow-hidden">
              <div className="px-5 pt-5 pb-4">
                <h2 className="text-[18px]">Promo Codes</h2>
              </div>
              <div className="overflow-x-auto">
                <div className="min-w-[820px]">
                  <div className="admin-rw admin-hd grid-cols-[1.3fr_1fr_1fr_1.1fr_1.1fr_1.3fr]">
                    <span>Code</span>
                    <span>Discount</span>
                    <span>Min. Order</span>
                    <span>Used</span>
                    <span>Expires</span>
                    <span>Actions</span>
                  </div>
                  {coupons.map((c) => {
                    const statusText = c.active ? 'Active' : 'Paused';
                    const limit = c.usageLimit || 100;
                    const pct = Math.min(100, Math.round(((c.usageCount || 0) / limit) * 100));
                    return (
                      <div
                        key={c.id}
                        className="admin-rw grid-cols-[1.3fr_1fr_1fr_1.1fr_1.1fr_1.3fr]"
                      >
                        <div className="flex flex-col gap-[5px] items-start">
                          <span className="font-semibold tracking-[0.04em]">{c.code}</span>
                          <span className="admin-pill" style={getPillStyle(statusText)}>
                            {statusText}
                          </span>
                        </div>
                        <span>
                          {c.discountType === 'percentage'
                            ? `${c.value}% off`
                            : `${formatBDT(c.value)} off`}
                        </span>
                        <span className="tabular-nums">{formatBDT(c.minOrder)}</span>
                        <div className="flex flex-col gap-[5px]">
                          <span className="tabular-nums">
                            {c.usageCount || 0} / {c.usageLimit || '∞'}
                          </span>
                          <div className="h-1 bg-[#E6E6E5] rounded-[2px] overflow-hidden">
                            <div
                              className="h-full bg-[#0A0A0A]"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                        <span className="admin-mut">{c.expiryDate || 'No expiry'}</span>
                        <div className="flex gap-1.5">
                          <button
                            type="button"
                            className="admin-btn admin-btn-sm"
                            onClick={() => void upsertCoupon({ ...c, active: !c.active }).catch(() => {})}
                          >
                            {c.active ? 'Pause' : 'Activate'}
                          </button>
                          <button
                            type="button"
                            className="admin-btn admin-btn-sm"
                            onClick={() => void deleteCoupon(c.id).catch(() => {})}
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </section>

            <form
              onSubmit={(e) => void handleCreateCoupon(e)}
              className="admin-card flex-[1_1_320px] max-w-[400px] min-w-0 p-6 flex flex-col gap-4"
            >
              <h2 className="text-[18px]">New Coupon</h2>
              <div className="admin-fld">
                <label className="admin-lbl" htmlFor="cp-code">
                  Code
                </label>
                <input
                  className="admin-inp uppercase"
                  id="cp-code"
                  required
                  value={coupCode}
                  onChange={(e) => setCoupCode(e.target.value)}
                  placeholder="WINTER10"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="admin-fld">
                  <label className="admin-lbl" htmlFor="cp-type">
                    Discount Type
                  </label>
                  <select
                    className="admin-inp"
                    id="cp-type"
                    value={coupType}
                    onChange={(e) => setCoupType(e.target.value as 'percentage' | 'fixed')}
                  >
                    <option value="percentage">Percentage %</option>
                    <option value="fixed">Fixed ৳</option>
                  </select>
                </div>
                <div className="admin-fld">
                  <label className="admin-lbl" htmlFor="cp-val">
                    Value
                  </label>
                  <input
                    className="admin-inp"
                    id="cp-val"
                    type="number"
                    value={coupValue}
                    onChange={(e) => setCoupValue(e.target.value)}
                    placeholder="10"
                  />
                </div>
                <div className="admin-fld">
                  <label className="admin-lbl" htmlFor="cp-min">
                    Minimum Order (৳)
                  </label>
                  <input
                    className="admin-inp"
                    id="cp-min"
                    type="number"
                    value={coupMin}
                    onChange={(e) => setCoupMin(e.target.value)}
                    placeholder="1500"
                  />
                </div>
                <div className="admin-fld">
                  <label className="admin-lbl" htmlFor="cp-lim">
                    Usage Limit
                  </label>
                  <input
                    className="admin-inp"
                    id="cp-lim"
                    type="number"
                    value={coupLimit}
                    onChange={(e) => setCoupLimit(e.target.value)}
                    placeholder="200"
                  />
                </div>
              </div>
              <div className="admin-fld">
                <label className="admin-lbl" htmlFor="cp-exp">
                  Expiry Date
                </label>
                <input
                  className="admin-inp"
                  id="cp-exp"
                  type="date"
                  value={coupExpiry}
                  onChange={(e) => setCoupExpiry(e.target.value)}
                />
              </div>
              <button type="submit" className="admin-btn admin-btn-dark !h-[44px]">
                Create Coupon
              </button>
            </form>
          </div>
        )}

        {/* ================= REVIEWS ================= */}
        {activeTab === 'reviews' && (
          <section className="admin-card overflow-hidden">
            <div className="px-5 pt-5 pb-4 flex justify-between items-baseline">
              <h2 className="text-[18px]">Customer Reviews</h2>
              <span className="admin-sub">Average {analytics.reviewAvg} out of 5</span>
            </div>
            <div>
              {reviews.length === 0 ? (
                <div className="admin-rw">
                  <span className="admin-mut">No reviews submitted yet.</span>
                </div>
              ) : (
                reviews.map((r) => {
                  const product = adminProducts.find((p) => p.id === r.productId);
                  const rating = Math.max(0, Math.min(5, Math.round(r.rating || 5)));
                  const stars = `${'★'.repeat(rating)}${'☆'.repeat(5 - rating)}`;
                  return (
                    <div
                      key={r.id}
                      className="flex flex-wrap gap-y-3 gap-x-7 px-5 py-[18px] border-t border-[#ECECEB]"
                    >
                      <div className="flex-[0_0_220px] min-w-0 flex flex-col gap-1">
                        <span className="font-semibold text-[14px]">{r.authorName}</span>
                        <span className="admin-sub truncate">
                          {product?.name || r.productName || r.productId}
                        </span>
                      </div>
                      <div className="flex-[1_1_300px] min-w-0 flex flex-col gap-1.5">
                        <span
                          className="text-[15px] tracking-[2px]"
                          aria-label={`${rating} out of 5 stars`}
                        >
                          {stars}
                        </span>
                        <span className="text-[13px] leading-[1.55] text-[#2B2B2B]">
                          {r.comment}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </section>
        )}

        {/* ================= SETTINGS ================= */}
        {activeTab === 'settings' && (
          <div className="flex flex-col gap-[22px]">
            {/* Homepage Hero Banner Drag & Drop Card */}
            <section className="admin-card p-6 flex flex-col gap-5">
              <div className="flex flex-wrap justify-between items-center gap-3">
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <h2 className="text-[18px]">Homepage Hero Banner</h2>
                    <span className="admin-pill bg-[#0A0A0A] text-white">
                      {heroImageUrl.trim() ? 'Custom Active' : 'Default Campaign'}
                    </span>
                  </div>
                  <span className="admin-sub">
                    Drag &amp; drop or select any photo to immediately update the hero image on the storefront homepage.
                  </span>
                </div>
                {heroImageUrl.trim() && (
                  <button
                    type="button"
                    onClick={() => void handleResetHeroImage()}
                    className="admin-btn inline-flex items-center gap-1.5"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    Reset Default
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
                {/* Drag & Drop Upload Zone */}
                <div
                  role="button"
                  tabIndex={0}
                  aria-label="Drag and drop homepage hero image or click to browse"
                  onClick={() => !heroUploading && heroFileInputRef.current?.click()}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      if (!heroUploading) heroFileInputRef.current?.click();
                    }
                  }}
                  onDragEnter={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setHeroDragOver(true);
                  }}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (!heroDragOver) setHeroDragOver(true);
                  }}
                  onDragLeave={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setHeroDragOver(false);
                  }}
                  onDrop={handleHeroDrop}
                  className={`lg:col-span-6 min-h-[210px] rounded-[12px] border-2 border-dashed p-6 flex flex-col items-center justify-center text-center gap-3 transition-colors cursor-pointer ${
                    heroDragOver
                      ? 'border-[#0A0A0A] bg-[#EAEAE8]'
                      : 'border-[#C8C8C6] bg-[#FAFAFA] hover:border-[#0A0A0A] hover:bg-[#F3F3F1]'
                  }`}
                >
                  <input
                    ref={heroFileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) void handleHeroImageUpload(f);
                      e.target.value = '';
                    }}
                  />
                  <div className="h-11 w-11 rounded-full bg-[#0A0A0A] text-white flex items-center justify-center">
                    <Upload className="h-5 w-5" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-[14px] font-semibold text-[#0A0A0A]">
                      {heroUploading
                        ? 'Uploading hero image...'
                        : heroDragOver
                          ? 'Drop image here to apply'
                          : 'Drag & drop hero image here'}
                    </p>
                    <p className="text-[12px] text-[#6A6A6A]">
                      or click to browse from your device · JPG, PNG, WEBP up to 10 MB
                    </p>
                  </div>
                </div>

                {/* Live Full-Color Hero Preview */}
                <div className="lg:col-span-6 flex flex-col gap-3">
                  <div className="relative h-[210px] rounded-[12px] overflow-hidden border border-[#E2E2E0] bg-[#141414]">
                    <img
                      src={sanitizeMediaUrl(heroImageUrl.trim(), EDITORIAL_MEDIA.heroCampaign)}
                      alt="Homepage hero banner preview"
                      className="h-full w-full object-cover object-[66%_18%]"
                    />
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 via-black/25 to-transparent p-3.5 flex items-center justify-between">
                      <span className="text-[11px] font-mono uppercase tracking-[0.14em] text-white">
                        Live Homepage Preview (Full Color)
                      </span>
                      <Link
                        to="/"
                        className="text-[11px] font-semibold text-white underline underline-offset-2"
                      >
                        View Storefront
                      </Link>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-end gap-2.5">
                <div className="admin-fld flex-1 min-w-[240px]">
                  <label className="admin-lbl" htmlFor="st-hero-url">
                    Or paste custom Hero Image URL
                  </label>
                  <input
                    className="admin-inp"
                    id="st-hero-url"
                    value={heroImageUrl}
                    onChange={(e) => setHeroImageUrl(e.target.value)}
                    placeholder="https://... or /uploads/..."
                  />
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const trimmed = heroImageUrl.trim();
                    const safeUrl = trimmed ? sanitizeMediaUrl(trimmed, '') : '';
                    if (trimmed && !safeUrl) {
                      showToast('Hero banner URL must start with https://, http://, or /uploads/.');
                      return;
                    }
                    void updateStoreSettings({ heroImageUrl: safeUrl }).catch(() => {});
                  }}
                  className="admin-btn admin-btn-dark !h-[42px]"
                >
                  Apply Hero URL
                </button>
              </div>
            </section>

            <form
              onSubmit={(e) => void handleSaveSettings(e)}
              className="admin-card p-6 flex flex-col gap-[18px]"
            >
              <div className="flex flex-wrap justify-between items-center gap-3">
                <div className="flex flex-col gap-1">
                  <h2 className="text-[18px]">Delivery &amp; Store Settings</h2>
                  <span className="admin-sub">
                    Charges, announcement bar, pixel and contact channels
                  </span>
                </div>
                <button type="submit" className="admin-btn admin-btn-dark">
                  Save Settings
                </button>
              </div>
              <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-4">
                <div className="admin-fld">
                  <label className="admin-lbl" htmlFor="st-0">
                    Inside Dhaka / Savar charge (৳)
                  </label>
                  <input
                    className="admin-inp"
                    id="st-0"
                    type="number"
                    value={insideDhaka}
                    onChange={(e) => setInsideDhaka(e.target.value)}
                  />
                </div>
                <div className="admin-fld">
                  <label className="admin-lbl" htmlFor="st-1">
                    Outside Dhaka charge (৳)
                  </label>
                  <input
                    className="admin-inp"
                    id="st-1"
                    type="number"
                    value={outsideDhaka}
                    onChange={(e) => setOutsideDhaka(e.target.value)}
                  />
                </div>
                <div className="admin-fld">
                  <label className="admin-lbl" htmlFor="st-2">
                    Express surcharge (৳)
                  </label>
                  <input
                    className="admin-inp"
                    id="st-2"
                    type="number"
                    value={expressSurcharge}
                    onChange={(e) => setExpressSurcharge(e.target.value)}
                  />
                </div>
                <div className="admin-fld">
                  <label className="admin-lbl" htmlFor="st-3">
                    Free shipping limit (৳)
                  </label>
                  <input
                    className="admin-inp"
                    id="st-3"
                    type="number"
                    value={freeThreshold}
                    onChange={(e) => setFreeThreshold(e.target.value)}
                  />
                </div>
                <div className="admin-fld">
                  <label className="admin-lbl" htmlFor="st-4">
                    Announcement bar text
                  </label>
                  <input
                    className="admin-inp"
                    id="st-4"
                    value={announcement}
                    onChange={(e) => setAnnouncement(e.target.value)}
                  />
                </div>
                <div className="admin-fld">
                  <label className="admin-lbl" htmlFor="st-5">
                    Business address
                  </label>
                  <input
                    className="admin-inp"
                    id="st-5"
                    value={businessAddress}
                    onChange={(e) => setBusinessAddress(e.target.value)}
                  />
                </div>
                <div className="admin-fld">
                  <label className="admin-lbl" htmlFor="st-6">
                    Meta Pixel ID
                  </label>
                  <input
                    className="admin-inp"
                    id="st-6"
                    value={metaPixelId}
                    onChange={(e) => setMetaPixelId(e.target.value)}
                  />
                </div>
                <div className="admin-fld">
                  <label className="admin-lbl" htmlFor="st-7">
                    Support email
                  </label>
                  <input
                    className="admin-inp"
                    id="st-7"
                    type="email"
                    value={supportEmail}
                    onChange={(e) => setSupportEmail(e.target.value)}
                  />
                </div>
                <div className="admin-fld">
                  <label className="admin-lbl" htmlFor="st-8">
                    Support phone
                  </label>
                  <input
                    className="admin-inp"
                    id="st-8"
                    value={supportPhone}
                    onChange={(e) => setSupportPhone(e.target.value)}
                  />
                </div>
                <div className="admin-fld">
                  <label className="admin-lbl" htmlFor="st-9">
                    WhatsApp number
                  </label>
                  <input
                    className="admin-inp"
                    id="st-9"
                    value={whatsappNumber}
                    onChange={(e) => setWhatsappNumber(e.target.value)}
                  />
                </div>
                <div className="admin-fld">
                  <label className="admin-lbl" htmlFor="st-10">
                    Messenger handle
                  </label>
                  <input
                    className="admin-inp"
                    id="st-10"
                    value={messengerHandle}
                    onChange={(e) => setMessengerHandle(e.target.value)}
                  />
                </div>
                <div className="admin-fld">
                  <label className="admin-lbl" htmlFor="st-11">
                    Facebook URL
                  </label>
                  <input
                    className="admin-inp"
                    id="st-11"
                    type="url"
                    value={facebookUrl}
                    onChange={(e) => setFacebookUrl(e.target.value)}
                  />
                </div>
                <div className="admin-fld">
                  <label className="admin-lbl" htmlFor="st-12">
                    Instagram URL
                  </label>
                  <input
                    className="admin-inp"
                    id="st-12"
                    type="url"
                    value={instagramUrl}
                    onChange={(e) => setInstagramUrl(e.target.value)}
                  />
                </div>
              </div>
            </form>

          </div>
        )}

        {/* ================= GUIDE ================= */}
        {activeTab === 'guide' && (
          <div className="flex flex-wrap gap-[22px] items-start">
            <section className="admin-card flex-[999_1_520px] min-w-0 p-6 flex flex-col gap-1.5">
              <h2 className="text-[18px] mb-2.5">Store Owner Manual</h2>
              {GUIDE_ITEMS.map((g, i) => (
                <div
                  key={g.title}
                  className="grid grid-cols-[34px_minmax(0,1fr)] gap-[14px] py-[13px] border-t border-[#ECECEB]"
                >
                  <span className="w-7 h-7 rounded-full bg-[#0A0A0A] text-white text-[12px] font-semibold flex items-center justify-center">
                    {i + 1}
                  </span>
                  <div className="flex flex-col gap-[3px]">
                    <span className="font-semibold text-[14px]">{g.title}</span>
                    <span className="admin-sub text-[13px] leading-[1.5]">{g.text}</span>
                  </div>
                </div>
              ))}
            </section>

            <div className="flex-[1_1_320px] max-w-[400px] min-w-0 flex flex-col gap-[22px]">
              <section className="bg-[#0A0A0A] text-white rounded-[14px] p-6 flex flex-col gap-[14px]">
                <h2 className="text-[18px]">Store Backup</h2>
                <span className="text-[13px] leading-[1.55] text-[#C8C8C7]">
                  Settings, categories, collections, products, coupons, orders and reviews in one
                  JSON file.
                </span>
                <button
                  type="button"
                  onClick={handleExportBackup}
                  className="h-[44px] rounded-[9px] border-0 bg-white text-[#0A0A0A] font-semibold text-[13px] cursor-pointer"
                >
                  Export Store Backup JSON
                </button>
              </section>

              <section className="admin-card p-6 flex flex-col gap-3">
                <h2 className="text-[18px]">Client Handover Checklist</h2>
                {HANDOVER_CHECKLIST.map((label, idx) => {
                  const done = Boolean(checks[idx]);
                  return (
                    <button
                      key={label}
                      type="button"
                      aria-pressed={done}
                      onClick={() => toggleCheck(idx)}
                      className="flex items-center gap-3 text-left border-0 bg-transparent py-1.5 text-[13px] cursor-pointer"
                    >
                      <span
                        className="w-5 h-5 rounded-[5px] shrink-0 flex items-center justify-center text-[12px] font-bold"
                        style={{
                          backgroundColor: done ? '#0A0A0A' : '#FFFFFF',
                          color: '#FFFFFF',
                          border: '1px solid #0A0A0A',
                        }}
                      >
                        {done ? '✓' : ''}
                      </span>
                      <span>{label}</span>
                    </button>
                  );
                })}
              </section>
            </div>
          </div>
        )}
      </main>

      {/* Delete Confirmation Modal */}
      {confirmDelete && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Confirm deletion"
          className="fixed inset-0 z-[120] bg-[#0A0A0A]/60 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div className="admin-card w-full max-w-md p-6 flex flex-col gap-4 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <span className="admin-lbl text-[#B91C1C]">Confirm Permanent Delete</span>
                <h3 className="text-[19px] mt-1">
                  Delete {confirmDelete.kind === 'product' ? 'Product' : 'Category'} &ldquo;
                  {confirmDelete.name}&rdquo;?
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setConfirmDelete(null)}
                aria-label="Close confirmation"
                className="w-8 h-8 rounded-full border border-[#D4D4D3] flex items-center justify-center cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="text-[13px] text-[#4A4A4A] leading-relaxed">
              {confirmDelete.kind === 'product'
                ? 'This will permanently remove the product from the Admin Panel and the public website. If you only want to hide it temporarily, choose Unpublish instead.'
                : confirmDelete.productCount > 0
                  ? `This category currently has ${confirmDelete.productCount} assigned product${
                      confirmDelete.productCount === 1 ? '' : 's'
                    }. Deleting the category removes it from storefront filters while keeping those products in your catalog.`
                  : 'This category will be permanently removed from your store taxonomy.'}
            </p>
            <div className="flex justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setConfirmDelete(null)}
                className="admin-btn"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  if (confirmDelete.kind === 'product') {
                    if (editingProductId === confirmDelete.id) setEditingProductId(null);
                    void deleteProduct(confirmDelete.id).catch(() => {});
                  } else {
                    if (catEditingId === confirmDelete.id) resetCategoryForm();
                    void deleteCategory(confirmDelete.id).catch(() => {});
                  }
                  setConfirmDelete(null);
                }}
                className="admin-btn !bg-[#B91C1C] !border-[#B91C1C] !text-white"
              >
                Delete Permanently
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
