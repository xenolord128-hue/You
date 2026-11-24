import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  BadgeCheck,
  Check,
  ChevronLeft,
  ChevronRight,
  Film,
  Heart,
  Maximize2,
  MessageCircle,
  Minus,
  Plus,
  QrCode,
  RotateCcw,
  Ruler,
  Share2,
  ShoppingBag,
  Star,
  Truck,
  X,
} from 'lucide-react';
import { collection, doc, getDoc, getDocs, query, where } from 'firebase/firestore';
import { useStore } from '../context/StoreContext';
import { Product } from '../types/ecommerce';
import { db } from '../lib/firebase';
import { normalizeProductMedia } from '../config/storeConfig';
import { CloudMediaImage } from '../components/CloudMediaImage';
import {
  calculateDiscountPercent,
  formatBDT,
  getVariantStockKey,
} from '../lib/formatters';
import { ProductCard } from '../components/ProductCard';
import { ProductQrModal } from '../components/ProductQrModal';
import { SeoHead } from '../components/SeoHead';
import { Reveal } from '../components/Motion';
import { trackPixelEvent } from '../lib/metaPixel';
import { findCategoryByIdentifier } from '../lib/categoryUtils';
import { apiUrl } from '../lib/api';

type TabKey = 'description' | 'material' | 'size' | 'care' | 'shipping';

export const ProductDetailPage: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const {
    products,
    adminProducts,
    isAdminAuthenticated,
    productsLoading,
    productsError,
    refreshProducts,
    categories,
    reviews,
    settings,
    t,
    addToCart,
    toggleWishlist,
    isInWishlist,
    submitReview,
    showToast,
  } = useStore();

  const decodedSlug = useMemo(() => {
    if (!slug) return '';
    try {
      return decodeURIComponent(slug).trim();
    } catch {
      return slug.trim();
    }
  }, [slug]);

  const [directProduct, setDirectProduct] = useState<Product | null>(null);
  const [directLookupLoading, setDirectLookupLoading] = useState(false);

  const catalogMatch = useMemo(() => {
    if (!decodedSlug) return null;
    const pool = isAdminAuthenticated ? [...products, ...adminProducts] : products;
    const lower = decodedSlug.toLowerCase();
    return (
      pool.find((p) => p.slug === decodedSlug || p.id === decodedSlug || p.sku === decodedSlug) ||
      pool.find(
        (p) =>
          p.slug.toLowerCase() === lower ||
          p.id.toLowerCase() === lower ||
          p.sku.toLowerCase() === lower
      ) ||
      null
    );
  }, [products, adminProducts, isAdminAuthenticated, decodedSlug]);

  useEffect(() => {
    setDirectProduct(null);
    if (!decodedSlug || catalogMatch || productsLoading) {
      setDirectLookupLoading(false);
      return;
    }

    let active = true;
    setDirectLookupLoading(true);

    const lookupDirect = async () => {
      try {
        // 1. Check backend single-product route if available
        const res = await fetch(apiUrl(`/api/products/${encodeURIComponent(decodedSlug)}`), {
          cache: 'no-store',
        }).catch(() => null);
        const ct = res?.headers.get('content-type') || '';
        if (res && res.ok && ct.toLowerCase().includes('application/json')) {
          const data = (await res.json()) as { product?: Product };
          if (data?.product && active) {
            setDirectProduct(normalizeProductMedia(data.product));
            return;
          }
        }

        // 2. Fallback to direct Firestore lookup by slug or doc ID (ensures live/static direct links always resolve)
        const slugQuery = isAdminAuthenticated
          ? query(collection(db, 'products'), where('slug', '==', decodedSlug))
          : query(
              collection(db, 'products'),
              where('slug', '==', decodedSlug),
              where('status', '==', 'Published')
            );
        const slugSnap = await getDocs(slugQuery).catch(() => null);
        if (slugSnap && !slugSnap.empty && active) {
          setDirectProduct(normalizeProductMedia(slugSnap.docs[0].data() as Product));
          return;
        }

        const docSnap = await getDoc(doc(db, 'products', decodedSlug)).catch(() => null);
        if (docSnap && docSnap.exists() && active) {
          const data = docSnap.data() as Product;
          if (data.status === 'Published' || isAdminAuthenticated) {
            setDirectProduct(normalizeProductMedia(data));
          }
        }
      } finally {
        if (active) setDirectLookupLoading(false);
      }
    };

    void lookupDirect();
    return () => {
      active = false;
    };
  }, [decodedSlug, catalogMatch, productsLoading, isAdminAuthenticated]);

  const product = catalogMatch || directProduct;

  // Put primaryImage first, followed by all unique gallery images in saved order
  const galleryImages = useMemo(() => {
    if (!product) return [];
    const base = (product.images || []).filter(Boolean);
    const ordered =
      product.primaryImage && base.includes(product.primaryImage)
        ? [product.primaryImage, ...base.filter((u) => u !== product.primaryImage)]
        : product.primaryImage
        ? [product.primaryImage, ...base]
        : base;
    return Array.from(new Set(ordered)).slice(0, 20);
  }, [product]);

  const [failedImageUrls, setFailedImageUrls] = useState<Record<string, boolean>>({});
  const handleImageFailed = useCallback((failedUrl: string) => {
    setFailedImageUrls((prev) => (prev[failedUrl] ? prev : { ...prev, [failedUrl]: true }));
  }, []);

  const visibleGalleryImages = useMemo(
    () => galleryImages.filter((url) => !failedImageUrls[url]),
    [galleryImages, failedImageUrls]
  );

  const [activeImageIdx, setActiveImageIdx] = useState(0);
  const safeImageIdx =
    visibleGalleryImages.length > 0
      ? Math.min(activeImageIdx, visibleGalleryImages.length - 1)
      : 0;
  const activeImageSrc = visibleGalleryImages[safeImageIdx] || '';

  const [showingVideo, setShowingVideo] = useState(false);
  const [zoomed, setZoomed] = useState(false);
  const [fullscreenOpen, setFullscreenOpen] = useState(false);
  const [selectedColor, setSelectedColor] = useState(product?.colors[0]?.name || '');
  const [selectedSize, setSelectedSize] = useState(product?.sizes[0] || '');
  const [quantity, setQuantity] = useState(1);
  const [activeTab, setActiveTab] = useState<TabKey>('description');
  const [sizeGuideOpen, setSizeGuideOpen] = useState(false);

  // Share & QR Modal state
  const [qrModalOpen, setQrModalOpen] = useState(false);
  const [qrModalTab, setQrModalTab] = useState<'share' | 'qr'>('share');

  // Review state
  const [reviewAuthor, setReviewAuthor] = useState('');
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewText, setReviewText] = useState('');
  const [reviewBusy, setReviewBusy] = useState(false);

  // Fit Concierge state
  const [fitQuestion, setFitQuestion] = useState('');
  const [fitAnswer, setFitAnswer] = useState('');
  const [fitLoading, setFitLoading] = useState(false);

  const productReviews = useMemo(
    () => (product ? reviews.filter((r) => r.productId === product.id) : []),
    [reviews, product]
  );

  const relatedProducts = useMemo(
    () =>
      product
        ? products
            .filter(
              (p) =>
                p.id !== product.id &&
                (p.category === product.category || p.collection === product.collection)
            )
            .slice(0, 4)
        : [],
    [products, product]
  );

  const lastTrackedProductIdRef = useRef<string | null>(null);

  useEffect(() => {
    setFailedImageUrls({});
    setActiveImageIdx(0);
    setShowingVideo(false);
    setZoomed(false);
  }, [product?.id]);

  useEffect(() => {
    if (activeImageIdx > 0 && activeImageIdx >= visibleGalleryImages.length && visibleGalleryImages.length > 0) {
      setActiveImageIdx(0);
    }
  }, [activeImageIdx, visibleGalleryImages.length]);

  useEffect(() => {
    if (!product) return;
    if (lastTrackedProductIdRef.current === product.id) return;
    lastTrackedProductIdRef.current = product.id;

    setSelectedColor(product.colors[0]?.name || '');
    setSelectedSize(product.sizes[0] || '');
    setQuantity(1);
    trackPixelEvent('ViewContent', {
      content_name: product.name,
      content_ids: [product.id],
      content_category: product.category,
      content_type: 'product',
      contents: [
        {
          id: product.id,
          quantity: 1,
          item_price: product.price,
        },
      ],
      value: product.price,
      currency: 'BDT',
    });
  }, [product]);

  const touchStartRef = useRef<{ x: number; y: number } | null>(null);

  if (!product) {
    const stillFetching = productsLoading || directLookupLoading;
    return (
      <main className="mx-auto max-w-[1400px] px-4 sm:px-6 py-12 sm:py-16 text-center space-y-4">
        <h1 className="font-editorial text-2xl font-bold text-[#0A0A0A]">
          {stillFetching
            ? 'Loading products...'
            : productsError
              ? 'Unable to load products. Please try again.'
              : products.length === 0
                ? 'No products are publicly available.'
                : 'Product not found'}
        </h1>
        <p className="text-sm text-[#5C5C5C]">
          {stillFetching
            ? 'Fetching the latest catalog items.'
            : productsError
              ? productsError
              : products.length === 0
                ? 'Check back once products are published from the store catalog.'
                : 'This product may have been unpublished or removed.'}
        </p>
        {productsError ? (
          <button
            type="button"
            onClick={() => void refreshProducts()}
            className="btn-base btn-primary"
          >
            Retry
          </button>
        ) : !stillFetching ? (
          <Link
            to="/shop"
            className="btn-base btn-primary"
          >
            Back to Catalog
          </Link>
        ) : null}
      </main>
    );
  }

  const variantKey = getVariantStockKey(selectedColor, selectedSize);
  const variantQty =
    product.variantStock && variantKey in product.variantStock
      ? product.variantStock[variantKey]
      : product.inventory;

  const discountPct = calculateDiscountPercent(product.price, product.compare_at_price);
  const wishlisted = isInWishlist(product.id);

  const cleanWa = settings.whatsappNumber.replace(/\D/g, '');
  const waOrderLink = `https://wa.me/${cleanWa || '8801887602095'}?text=${encodeURIComponent(
    `Hello PYTHOX WORLD, I would like to order:\nProduct: ${product.name} (${product.sku})\nColour: ${selectedColor}\nSize: ${selectedSize}\nQuantity: ${quantity}\nPrice: ${formatBDT(
      product.price * quantity
    )}`
  )}`;

  const handleAddToCart = () => {
    if (variantQty <= 0) return;
    addToCart(product, { color: selectedColor, size: selectedSize, quantity });
  };

  const handleBuyNow = () => {
    if (variantQty <= 0) return;
    addToCart(product, {
      color: selectedColor,
      size: selectedSize,
      quantity,
      openDrawer: false,
    });
    navigate('/checkout');
  };

  const handleReviewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reviewText.trim()) return;
    setReviewBusy(true);
    try {
      await submitReview({
        productId: product.id,
        productName: product.name,
        authorName: reviewAuthor.trim() || undefined,
        rating: reviewRating,
        comment: reviewText,
      });
      setReviewText('');
      setReviewAuthor('');
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Unable to post review.');
    } finally {
      setReviewBusy(false);
    }
  };

  const handleAskFitAdvisor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fitQuestion.trim()) return;
    setFitLoading(true);
    try {
      const res = await fetch(apiUrl('/api/style-advice'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productName: product.name,
          category: product.category,
          materials: product.materials,
          sizes: product.sizes,
          question: fitQuestion,
        }),
      });
      const ct = res.headers.get('content-type') || '';
      if (res.ok && ct.toLowerCase().includes('application/json')) {
        const data = await res.json();
        setFitAnswer(data.answer || 'True to size with a clean contemporary drape.');
      } else {
        setFitAnswer('Select your regular size for a tailored silhouette.');
      }
    } catch {
      setFitAnswer('Select your regular size for a tailored silhouette.');
    } finally {
      setFitLoading(false);
    }
  };

  return (
    <main className="mx-auto max-w-[1400px] px-4 sm:px-6 py-6 lg:py-10 pb-24 md:pb-14">
      <SeoHead
        title={`${product.name} — PYTHOX WORLD`}
        description={product.description}
        ogType="product"
        image={galleryImages[0] || product.primaryImage}
        productMeta={{
          priceAmount: product.price,
          currency: 'BDT',
          availability: variantQty > 0 ? 'in stock' : 'out of stock',
          brand: 'PYTHOX WORLD',
          category: product.category,
          sku: product.sku,
          condition: 'new',
        }}
        jsonLd={{
          '@context': 'https://schema.org',
          '@type': 'Product',
          name: product.name,
          url: `${window.location.origin}/product/${product.slug}`,
          image: galleryImages.length > 0 ? galleryImages : [product.primaryImage].filter(Boolean),
          sku: product.sku,
          category: product.category,
          description: product.description,
          brand: { '@type': 'Brand', name: 'PYTHOX WORLD' },
          offers: {
            '@type': 'Offer',
            url: `${window.location.origin}/product/${product.slug}`,
            priceCurrency: 'BDT',
            price: product.price,
            availability:
              variantQty > 0
                ? 'https://schema.org/InStock'
                : 'https://schema.org/OutOfStock',
          },
        }}
      />

      {/* Admin Preview Status Notice when viewing non-Published product */}
      {isAdminAuthenticated && product.status !== 'Published' && (
        <div className="mb-4 rounded-xl bg-[#0A0A0A] text-white px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs">
          <span className="font-mono uppercase tracking-wider">
            Admin Preview · Status: {product.status} (Hidden from public storefront)
          </span>
          <Link to="/admin" className="underline underline-offset-2 font-semibold">
            Back to Admin Panel
          </Link>
        </div>
      )}

      {/* Breadcrumb */}
      {(() => {
        const matchedCat = findCategoryByIdentifier(categories, product.category);
        const catPath = matchedCat
          ? `/category/${matchedCat.slug}`
          : `/shop?category=${encodeURIComponent(product.category)}`;
        const subcatPath = matchedCat
          ? `/category/${matchedCat.slug}?subcategory=${encodeURIComponent(product.subcategory || '')}`
          : `/shop?category=${encodeURIComponent(product.category)}&subcategory=${encodeURIComponent(product.subcategory || '')}`;
        return (
          <nav aria-label="Breadcrumb" className="mb-5 sm:mb-6 font-mono text-[11px] uppercase tracking-wider text-[#5C5C5C] flex flex-wrap items-center gap-2">
            <Link to="/" className="hover:text-[#0A0A0A] py-0.5">Home</Link>
            <span>/</span>
            <Link to={catPath} className="hover:text-[#0A0A0A] py-0.5">
              {matchedCat?.name || product.category}
            </Link>
            {product.subcategory && (
              <>
                <span>/</span>
                <Link to={subcatPath} className="hover:text-[#0A0A0A] py-0.5">
                  {product.subcategory}
                </Link>
              </>
            )}
            <span>/</span>
            <span className="text-[#0A0A0A] font-semibold truncate">{product.name}</span>
          </nav>
        );
      })()}

      {/* Main 12-Col Split Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-start">
        {/* Left (7 Cols): Main Product Gallery + Thumbnails */}
        <div className="lg:col-span-7 min-w-0 space-y-3 sm:space-y-4">
          <div
            onTouchStart={(e) => {
              if (e.touches.length === 1) {
                touchStartRef.current = {
                  x: e.touches[0].clientX,
                  y: e.touches[0].clientY,
                };
              }
            }}
            onTouchEnd={(e) => {
              if (!touchStartRef.current || visibleGalleryImages.length <= 1 || showingVideo) return;
              const touch = e.changedTouches[0];
              const dx = touch.clientX - touchStartRef.current.x;
              const dy = touch.clientY - touchStartRef.current.y;
              touchStartRef.current = null;
              if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy) * 1.2) {
                setZoomed(false);
                setActiveImageIdx((i) =>
                  dx < 0
                    ? (i + 1) % visibleGalleryImages.length
                    : (i - 1 + visibleGalleryImages.length) % visibleGalleryImages.length
                );
              }
            }}
            className="relative aspect-[4/5] rounded-2xl sm:rounded-3xl bg-[#F7F6F2] border border-[#D9D9D9] navy-shadow overflow-hidden touch-pan-y"
          >
            {showingVideo && product.videoUrl ? (
              <video
                src={product.videoUrl}
                controls
                playsInline
                autoPlay
                className="h-full w-full object-contain bg-[#0A0A0A]"
              />
            ) : activeImageSrc ? (
              <CloudMediaImage
                key={`${product.id}-${activeImageSrc}`}
                src={activeImageSrc}
                alt={`${product.name} view ${safeImageIdx + 1}`}
                onAllFailed={handleImageFailed}
                onClick={() => setZoomed((z) => !z)}
                className={`h-full w-full object-cover object-center transition-transform duration-300 cursor-zoom-in ${
                  zoomed ? 'scale-125 cursor-zoom-out' : 'scale-100'
                }`}
              />
            ) : (
              <div className="flex h-full w-full flex-col items-center justify-center bg-[#EAE9E4] p-8 text-center">
                <ShoppingBag className="h-10 w-10 text-[#5C5C5C] mb-3" strokeWidth={1.4} />
                <span className="font-editorial text-lg font-bold text-[#0A0A0A]">
                  {product.name}
                </span>
                <span className="mt-1 font-mono text-xs text-[#5C5C5C]">
                  {product.sku}
                </span>
              </div>
            )}

            {discountPct > 0 && !showingVideo && (
              <span className="absolute top-3.5 left-3.5 sm:top-4 sm:left-4 px-3 py-1 rounded-full bg-[#0A0A0A] text-white font-mono text-xs font-bold border border-[#292929]">
                -{discountPct}% OFF
              </span>
            )}

            {!showingVideo && activeImageSrc && (
              <button
                type="button"
                onClick={() => setFullscreenOpen(true)}
                aria-label="Open full-screen view"
                className="btn-base btn-icon !min-h-[44px] !min-w-[44px] absolute top-3 right-3 sm:top-3.5 sm:right-3.5 frosted-glass border border-[#D4D3CE] text-[#0A0A0A] hover:border-[#0A0A0A]"
              >
                <Maximize2 className="h-4 w-4" />
              </button>
            )}

            {visibleGalleryImages.length > 1 && !showingVideo && (
              <>
                <button
                  type="button"
                  onClick={() =>
                    setActiveImageIdx(
                      (i) => (i - 1 + visibleGalleryImages.length) % visibleGalleryImages.length
                    )
                  }
                  aria-label="Previous image"
                  className="btn-base btn-icon !min-h-[44px] !min-w-[44px] absolute left-2.5 sm:left-3.5 top-1/2 -translate-y-1/2 frosted-glass border border-[#D4D3CE] text-[#0A0A0A] hover:border-[#0A0A0A]"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setActiveImageIdx((i) => (i + 1) % visibleGalleryImages.length)
                  }
                  aria-label="Next image"
                  className="btn-base btn-icon !min-h-[44px] !min-w-[44px] absolute right-2.5 sm:right-3.5 top-1/2 -translate-y-1/2 frosted-glass border border-[#D4D3CE] text-[#0A0A0A] hover:border-[#0A0A0A]"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </>
            )}
          </div>

          {/* Mobile Pagination Dots & Counter */}
          {visibleGalleryImages.length > 1 && !showingVideo && (
            <div className="flex lg:hidden items-center justify-between px-1">
              <div className="flex items-center gap-1.5" role="tablist" aria-label="Product gallery slides">
                {visibleGalleryImages.map((_, idx) => (
                  <button
                    key={`dot-${idx}`}
                    type="button"
                    aria-label={`View image ${idx + 1}`}
                    aria-selected={safeImageIdx === idx}
                    onClick={() => {
                      setShowingVideo(false);
                      setActiveImageIdx(idx);
                    }}
                    className={`h-2 rounded-full transition-all cursor-pointer ${
                      safeImageIdx === idx ? 'w-5 bg-[#0A0A0A]' : 'w-2 bg-[#BDBDBD]'
                    }`}
                  />
                ))}
              </div>
              <span className="font-mono text-[11px] font-semibold text-[#5C5C5C] tabular-nums">
                {safeImageIdx + 1} / {visibleGalleryImages.length}
              </span>
            </div>
          )}

          {/* Rounded-Rectangle Portrait Thumbnail Strip */}
          {(visibleGalleryImages.length > 0 || product.videoUrl) && (
            <div className="flex lg:grid lg:grid-cols-5 gap-2.5 lg:gap-3 overflow-x-auto no-scrollbar pb-1">
              {visibleGalleryImages.map((img, idx) => (
                <button
                  key={`${img}-${idx}`}
                  type="button"
                  onClick={() => {
                    setShowingVideo(false);
                    setActiveImageIdx(idx);
                  }}
                  aria-label={`Select image ${idx + 1}`}
                  className={`w-16 sm:w-20 lg:w-auto shrink-0 aspect-[4/5] rounded-xl lg:rounded-2xl overflow-hidden border-2 bg-[#EAE9E4] transition-all cursor-pointer ${
                    !showingVideo && safeImageIdx === idx
                      ? 'border-[#0A0A0A] shadow-md scale-[0.98]'
                      : 'border-[#D9D9D9] opacity-80 hover:opacity-100'
                  }`}
                >
                  <CloudMediaImage
                    src={img}
                    alt={`${product.name} thumbnail ${idx + 1}`}
                    onAllFailed={handleImageFailed}
                    className="h-full w-full object-cover object-center"
                  />
                </button>
              ))}
              {product.videoUrl && (
                <button
                  type="button"
                  onClick={() => {
                    setZoomed(false);
                    setShowingVideo(true);
                  }}
                  className={`w-16 sm:w-20 lg:w-auto shrink-0 aspect-[4/5] rounded-xl lg:rounded-2xl overflow-hidden border-2 bg-[#0A0A0A] text-white flex flex-col items-center justify-center gap-1 transition-all cursor-pointer ${
                    showingVideo
                      ? 'border-[#0A0A0A] shadow-md scale-[0.98]'
                      : 'border-[#D9D9D9] opacity-85 hover:opacity-100'
                  }`}
                >
                  <Film className="h-5 w-5" />
                  <span className="font-mono text-[10px] font-bold uppercase tracking-wider">
                    Video
                  </span>
                </button>
              )}
            </div>
          )}
        </div>

        {/* Right (5 Cols): Purchase Module */}
        <div className="lg:col-span-5 min-w-0 rounded-2xl sm:rounded-3xl bg-white border border-[#D9D9D9] navy-shadow p-4 sm:p-8 space-y-6 lg:sticky lg:top-[72px]">
          <div className="space-y-3 border-b border-[#D9D9D9] pb-5">
            <div className="flex items-center justify-between gap-2">
              <span className="px-3 py-1 rounded-lg bg-[#EAE9E4] text-[#0A0A0A] font-mono text-[10px] font-bold uppercase tracking-widest border border-[#D4D3CE]">
                {product.category}{product.subcategory ? ` · ${product.subcategory}` : ''}
              </span>
              <div className="flex items-center gap-2">
                <span className="font-mono text-[11px] text-[#5C5C5C]">{product.sku}</span>
                <button
                  type="button"
                  onClick={() => toggleWishlist(product.id)}
                  aria-label="Toggle wishlist"
                  className={`btn-base btn-icon !min-h-[44px] !min-w-[44px] border ${
                    wishlisted
                      ? 'bg-[#0A0A0A] border-[#0A0A0A] text-white'
                      : 'bg-[#F3F2EE] border-[#D4D3CE] text-[#0A0A0A] hover:border-[#0A0A0A]'
                  }`}
                >
                  <Heart className="h-4 w-4" fill={wishlisted ? '#FFFFFF' : 'none'} />
                </button>
              </div>
            </div>

            <h1 className="font-editorial text-2xl sm:text-3xl font-bold text-[#0A0A0A] leading-tight">
              {product.name}
            </h1>
            {product.shortDescription && (
              <p className="text-sm text-[#4A4A4A] leading-relaxed">
                {product.shortDescription}
              </p>
            )}

            <div className="flex flex-wrap items-center gap-3 text-xs">
              <a
                href="#reviews-section"
                className="inline-flex items-center gap-1.5 font-mono text-[#0A0A0A] hover:underline"
              >
                <Star className="h-3.5 w-3.5 fill-[#0A0A0A] text-[#0A0A0A]" />
                <span className="font-bold">{product.rating.toFixed(1)}</span>
                <span className="text-[#5C5C5C]">
                  ({product.reviews_count + productReviews.length} reviews)
                </span>
              </a>
              <span className="text-[#D4D3CE]">·</span>
              <span
                className={`font-mono font-semibold ${
                  variantQty > 0 ? 'text-[#0A0A0A]' : 'text-[#5C5C5C]'
                }`}
              >
                {variantQty > 0 ? `IN STOCK (${variantQty} LEFT)` : 'SOLD OUT'}
              </span>
            </div>

            <div className="pt-1 flex flex-wrap items-baseline gap-2.5 sm:gap-3 font-mono tabular-nums">
              <span className="text-2xl sm:text-3xl font-bold text-[#0A0A0A]">
                {formatBDT(product.price)}
              </span>
              {product.compare_at_price && product.compare_at_price > product.price && (
                <>
                  <span className="text-sm text-[#5C5C5C] line-through">
                    {formatBDT(product.compare_at_price)}
                  </span>
                  <span className="text-[11px] font-semibold text-[#0A0A0A] bg-[#EAE9E4] border border-[#D4D3CE] px-2 py-0.5 rounded-md">
                    Save {formatBDT(product.compare_at_price - product.price)}
                  </span>
                </>
              )}
            </div>
          </div>

          {/* Colour Variant Pills */}
          <div>
            <p className="font-mono text-[11px] uppercase tracking-wider text-[#5C5C5C] mb-2.5">
              Colour: <span className="text-[#0A0A0A] font-bold">{selectedColor}</span>
            </p>
            <div className="flex flex-wrap gap-2">
              {product.colors.map((c) => {
                const active = selectedColor === c.name;
                return (
                  <button
                    key={c.name}
                    type="button"
                    onClick={() => setSelectedColor(c.name)}
                    className={`chip-btn min-h-[44px] ${active ? 'chip-btn-active' : ''}`}
                  >
                    <span
                      className="h-3.5 w-3.5 rounded-full border border-[#D4D3CE] shadow-xs"
                      style={{ backgroundColor: c.hex }}
                    />
                    <span>{c.name}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Size Variant Pills */}
          <div>
            <div className="flex items-center justify-between mb-2.5">
              <p className="font-mono text-[11px] uppercase tracking-wider text-[#5C5C5C]">
                Size: <span className="text-[#0A0A0A] font-bold">{selectedSize}</span>
              </p>
              <button
                type="button"
                onClick={() => setSizeGuideOpen(true)}
                className="inline-flex items-center gap-1.5 min-h-[36px] text-xs font-semibold text-[#0A0A0A] hover:text-[#5C5C5C] transition-colors cursor-pointer py-1"
              >
                <Ruler className="h-3.5 w-3.5" /> Size Guide
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {product.sizes.map((sz) => (
                <button
                  key={sz}
                  type="button"
                  onClick={() => setSelectedSize(sz)}
                  className={`chip-btn min-h-[44px] min-w-[48px] font-mono font-semibold ${
                    selectedSize === sz ? 'chip-btn-active' : ''
                  }`}
                >
                  {sz}
                </button>
              ))}
            </div>
          </div>

          <p className="text-sm text-[#292929] leading-relaxed whitespace-pre-line">
            {product.description}
          </p>

          {/* Quantity + Primary Black Add to Bag + Secondary Instant Checkout + WhatsApp + Share/QR */}
          <div className="space-y-3">
            <div className="flex flex-wrap min-[420px]:flex-nowrap items-center gap-2.5 sm:gap-3">
              <div className="inline-flex items-center rounded-[10px] bg-[#F3F2EE] border border-[#D4D3CE] h-12 shrink-0">
                <button
                  type="button"
                  onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                  aria-label="Decrease quantity"
                  className="w-11 h-full flex items-center justify-center text-[#0A0A0A] hover:bg-[#EAE9E4] rounded-l-[9px] transition-colors cursor-pointer"
                >
                  <Minus className="h-3.5 w-3.5" />
                </button>
                <span className="w-9 text-center font-mono text-sm font-bold text-[#0A0A0A] tabular-nums">
                  {quantity}
                </span>
                <button
                  type="button"
                  onClick={() => setQuantity((q) => Math.min(Math.max(1, variantQty), q + 1))}
                  aria-label="Increase quantity"
                  className="w-11 h-full flex items-center justify-center text-[#0A0A0A] hover:bg-[#EAE9E4] rounded-r-[9px] transition-colors cursor-pointer"
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
              </div>

              <button
                type="button"
                disabled={variantQty <= 0}
                onClick={handleAddToCart}
                className="btn-base btn-primary btn-lg flex-1 min-w-[180px]"
              >
                {variantQty > 0 ? t('addToBag') : 'SOLD OUT'}
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                disabled={variantQty <= 0}
                onClick={handleBuyNow}
                className="btn-base btn-secondary w-full"
              >
                Instant Checkout
              </button>
              <a
                href={waOrderLink}
                target="_blank"
                rel="noreferrer"
                onClick={() =>
                  trackPixelEvent('Contact', {
                    content_name: product.name,
                    content_ids: [product.id],
                    content_category: product.category,
                    value: product.price * quantity,
                    currency: 'BDT',
                  })
                }
                className="btn-base btn-secondary w-full"
              >
                <MessageCircle className="h-4 w-4" />
                <span>{t('orderWhatsapp')}</span>
              </a>
            </div>

            {/* 2-Col Share & Product QR Buttons */}
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => {
                  setQrModalTab('share');
                  setQrModalOpen(true);
                }}
                className="btn-base btn-secondary btn-sm w-full"
              >
                <Share2 className="h-3.5 w-3.5" />
                <span>{t('share')}</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setQrModalTab('qr');
                  setQrModalOpen(true);
                }}
                className="btn-base btn-secondary btn-sm w-full"
              >
                <QrCode className="h-3.5 w-3.5" />
                <span>{t('productQr')}</span>
              </button>
            </div>
          </div>

          {/* 3 Trust Icons */}
          <div className="grid grid-cols-3 gap-2 pt-4 border-t border-[#D9D9D9] text-[11px] text-[#292929]">
            <div className="flex flex-col items-center text-center gap-1 p-2.5 rounded-xl bg-[#F3F2EE] border border-[#D4D3CE]">
              <Truck className="h-4 w-4 text-[#0A0A0A]" />
              <span className="font-medium">Dhaka ৳{settings.insideDhakaCharge}</span>
            </div>
            <div className="flex flex-col items-center text-center gap-1 p-2.5 rounded-xl bg-[#F3F2EE] border border-[#D4D3CE]">
              <RotateCcw className="h-4 w-4 text-[#0A0A0A]" />
              <span className="font-medium">7-Day Exchange</span>
            </div>
            <div className="flex flex-col items-center text-center gap-1 p-2.5 rounded-xl bg-[#F3F2EE] border border-[#D4D3CE]">
              <BadgeCheck className="h-4 w-4 text-[#0A0A0A]" />
              <span className="font-medium">100% Authentic</span>
            </div>
          </div>

          {/* PYTHOX Fit Concierge */}
          <form onSubmit={handleAskFitAdvisor} className="rounded-2xl bg-[#F3F2EE] border border-[#D4D3CE] p-4 space-y-2.5">
            <p className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-[#5C5C5C]">
              ATELIER FIT CONCIERGE
            </p>
            <div className="flex gap-2">
              <input
                type="text"
                value={fitQuestion}
                onChange={(e) => setFitQuestion(e.target.value)}
                placeholder="Ask height/weight fit or fabric care..."
                className="flex-1 min-w-0 min-h-[40px] rounded-[10px] border border-[#D4D3CE] bg-white px-3 py-2 text-xs text-[#0A0A0A] placeholder:text-[#6A6A6A] focus:border-[#0A0A0A] focus:outline-none"
              />
              <button
                type="submit"
                disabled={fitLoading}
                className="btn-base btn-primary btn-sm shrink-0"
              >
                {fitLoading ? '...' : 'Ask'}
              </button>
            </div>
            {fitAnswer && <p className="text-xs text-[#0A0A0A] leading-relaxed">{fitAnswer}</p>}
          </form>
        </div>
      </div>

      {/* Product Information Tabs */}
      <Reveal className="mt-14">
        <section className="rounded-3xl bg-white border border-[#D9D9D9] navy-shadow p-6 sm:p-10">
          <div className="flex gap-3 overflow-x-auto border-b border-[#D9D9D9] pb-4 no-scrollbar">
            {(
              [
                ['description', 'Description'],
                ['material', 'Material & Colour'],
                ['size', 'Size & Fit'],
                ['care', 'Care Instructions'],
                ['shipping', 'Shipping & Returns'],
              ] as [TabKey, string][]
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setActiveTab(key)}
                className={`chip-btn min-h-[44px] shrink-0 font-mono text-xs uppercase tracking-wider ${
                  activeTab === key ? 'chip-btn-active' : ''
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="pt-6 text-sm text-[#292929] leading-relaxed max-w-3xl space-y-3">
            {activeTab === 'description' && (
              <>
                <p className="whitespace-pre-line">{product.description}</p>
                {Array.isArray(product.features) && product.features.length > 0 && (
                  <ul className="space-y-1.5 pt-2">
                    {product.features.map((f) => (
                      <li key={f} className="flex items-center gap-2 text-[#0A0A0A] font-medium">
                        <Check className="h-4 w-4 text-[#0A0A0A]" />
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                )}
                {product.tags && product.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-3">
                    {product.tags.map((tag) => (
                      <span
                        key={tag}
                        className="px-2.5 py-1 rounded-lg bg-[#F3F2EE] border border-[#D4D3CE] font-mono text-[11px] text-[#292929]"
                      >
                        #{tag}
                      </span>
                    ))}
                  </div>
                )}
              </>
            )}
            {activeTab === 'material' && (
              <>
                <p><strong className="text-[#0A0A0A]">Material:</strong> {product.materials}</p>
                <p><strong className="text-[#0A0A0A]">Available Colours:</strong> {product.colors.map((c) => c.name).join(', ')}</p>
              </>
            )}
            {activeTab === 'size' && <p>{product.size_fit}</p>}
            {activeTab === 'care' && <p>{product.care_instructions}</p>}
            {activeTab === 'shipping' && (
              <div className="space-y-2">
                <p>
                  Dispatched directly from PYTHOX WORLD ({settings.businessAddress}). Inside Dhaka delivery is ৳{settings.insideDhakaCharge}; Outside Dhaka delivery is ৳{settings.outsideDhakaCharge}. Free delivery applies on orders over {formatBDT(settings.freeShippingThreshold)}.
                </p>
                <p>Unworn garments with tags intact may be exchanged within 7 days of delivery.</p>
              </div>
            )}
          </div>
        </section>
      </Reveal>

      {/* Bottom Section: Customer Reviews List & Submission Form */}
      <Reveal className="mt-10" delayMs={40}>
        <section
          id="reviews-section"
          className="rounded-2xl sm:rounded-3xl bg-white border border-[#D9D9D9] navy-shadow p-5 sm:p-10 grid grid-cols-1 lg:grid-cols-12 gap-8 sm:gap-10"
        >
          <div className="lg:col-span-5 space-y-4">
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#5C5C5C] font-semibold">
              VERIFIED CLIENT IMPRESSIONS
            </p>
            <h2 className="font-editorial text-2xl sm:text-3xl font-bold text-[#0A0A0A]">
              Customer Reviews
            </h2>
            <form
              onSubmit={(e) => void handleReviewSubmit(e)}
              className="space-y-3 rounded-2xl border border-[#D4D3CE] p-5 bg-[#F3F2EE]"
            >
              <p className="font-mono text-[11px] font-bold uppercase tracking-wider text-[#0A0A0A]">
                Write a Review
              </p>
              <div className="flex items-center gap-1.5">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setReviewRating(n)}
                    aria-label={`Rate ${n} stars`}
                    className="h-8 w-8 rounded-lg flex items-center justify-center hover:bg-white cursor-pointer"
                  >
                    <Star
                      className="h-4 w-4 text-[#0A0A0A]"
                      fill={n <= reviewRating ? '#0A0A0A' : 'none'}
                    />
                  </button>
                ))}
              </div>
              <input
                type="text"
                value={reviewAuthor}
                onChange={(e) => setReviewAuthor(e.target.value)}
                placeholder="Your name (optional)"
                className="w-full min-h-[40px] rounded-[10px] border border-[#D4D3CE] bg-white px-3 py-2 text-xs text-[#0A0A0A] placeholder:text-[#6A6A6A] focus:border-[#0A0A0A] focus:outline-none"
              />
              <textarea
                rows={3}
                required
                value={reviewText}
                onChange={(e) => setReviewText(e.target.value)}
                placeholder="Share fit, fabric weight, and finish feedback..."
                className="w-full rounded-[10px] border border-[#D4D3CE] bg-white p-3 text-xs text-[#0A0A0A] placeholder:text-[#6A6A6A] focus:border-[#0A0A0A] focus:outline-none"
              />
              <button
                type="submit"
                disabled={reviewBusy}
                className="btn-base btn-primary"
              >
                {reviewBusy ? 'Submitting...' : 'Submit Review'}
              </button>
            </form>
          </div>

          <div className="lg:col-span-7 space-y-4">
            {productReviews.length === 0 ? (
              <div className="rounded-2xl bg-[#F3F2EE] p-8 border border-[#D4D3CE] text-center">
                <p className="text-sm text-[#5C5C5C]">No reviews yet for this SKU. Be the first to review it.</p>
              </div>
            ) : (
              productReviews.map((rev) => (
                <div key={rev.id} className="rounded-2xl bg-[#F3F2EE] border border-[#D4D3CE] p-5 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-[#0A0A0A]">{rev.authorName}</span>
                    <span className="font-mono text-[#0A0A0A]">{'★'.repeat(rev.rating)}</span>
                  </div>
                  <p className="text-sm text-[#292929]">{rev.comment}</p>
                </div>
              ))
            )}
          </div>
        </section>
      </Reveal>

      {/* Related Men's Products */}
      {relatedProducts.length > 0 && (
        <Reveal className="mt-14" delayMs={60}>
          <section>
            <h2 className="font-editorial text-2xl sm:text-3xl font-bold text-[#0A0A0A] mb-7">
              Related Menswear Pieces
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5 sm:gap-6">
              {relatedProducts.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          </section>
        </Reveal>
      )}

      {/* Mobile Sticky Quick Buy Bar */}
      <div className="fixed bottom-0 inset-x-0 z-30 md:hidden bg-white/95 backdrop-blur-sm border-t border-[#D9D9D9] px-4 pt-2.5 pb-[max(0.625rem,env(safe-area-inset-bottom))] flex items-center justify-between gap-3 shadow-[0_-8px_24px_rgba(10,10,10,0.08)]">
        <div className="min-w-0">
          <p className="text-xs font-semibold text-[#0A0A0A] truncate">{product.name}</p>
          <div className="flex items-baseline gap-2">
            <span className="text-sm font-mono font-bold text-[#0A0A0A] tabular-nums">
              {formatBDT(product.price)}
            </span>
            {product.compare_at_price && product.compare_at_price > product.price && (
              <span className="text-[11px] font-mono text-[#5C5C5C] line-through tabular-nums">
                {formatBDT(product.compare_at_price)}
              </span>
            )}
          </div>
        </div>
        <button
          type="button"
          disabled={variantQty <= 0}
          onClick={handleAddToCart}
          className="btn-base btn-primary min-h-[44px] px-5 shrink-0"
        >
          {variantQty > 0 ? 'Add to Bag' : 'Sold Out'}
        </button>
      </div>

      {/* Full-Screen Gallery Lightbox */}
      {fullscreenOpen && activeImageSrc && (
        <div
          className="fixed inset-0 z-[100] bg-[#0A0A0A]/95 flex items-center justify-center p-4 backdrop-enter"
          onClick={() => setFullscreenOpen(false)}
        >
          <button
            type="button"
            onClick={() => setFullscreenOpen(false)}
            aria-label="Close full-screen image"
            className="btn-base btn-dark-ghost btn-icon absolute top-5 right-5 z-20"
          >
            <X className="h-5 w-5" />
          </button>

          {visibleGalleryImages.length > 1 && (
            <>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setActiveImageIdx(
                    (i) => (i - 1 + visibleGalleryImages.length) % visibleGalleryImages.length
                  );
                }}
                aria-label="Previous image"
                className="btn-base btn-dark-ghost btn-icon absolute left-4 top-1/2 -translate-y-1/2 z-20"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setActiveImageIdx((i) => (i + 1) % visibleGalleryImages.length);
                }}
                aria-label="Next image"
                className="btn-base btn-dark-ghost btn-icon absolute right-4 top-1/2 -translate-y-1/2 z-20"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </>
          )}

          <div onClick={(e) => e.stopPropagation()} className="flex flex-col items-center gap-3">
            <CloudMediaImage
              key={`lightbox-${product.id}-${activeImageSrc}`}
              src={activeImageSrc}
              alt={`${product.name} full-screen view ${safeImageIdx + 1}`}
              onAllFailed={handleImageFailed}
              className="max-h-[84vh] max-w-full rounded-2xl object-contain modal-enter"
            />
            {visibleGalleryImages.length > 1 && (
              <span className="font-mono text-xs text-white/75 tabular-nums">
                {safeImageIdx + 1} / {visibleGalleryImages.length}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Size Guide Modal */}
      {sizeGuideOpen && (
        <div className="fixed inset-0 z-[100] bg-[#0A0A0A]/65 flex items-center justify-center p-4 backdrop-enter">
          <div className="bg-[#F3F2EE] border border-[#D9D9D9] rounded-2xl sm:rounded-3xl max-w-lg w-full p-5 sm:p-6 space-y-4 navy-shadow-lg modal-enter">
            <div className="flex items-center justify-between border-b border-[#D9D9D9] pb-3">
              <h3 className="text-lg font-editorial font-bold text-[#0A0A0A]">
                Men&apos;s Size Chart (Inches)
              </h3>
              <button
                type="button"
                onClick={() => setSizeGuideOpen(false)}
                aria-label="Close size chart"
                className="btn-base btn-secondary btn-icon"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <table className="w-full text-xs text-left font-mono bg-white rounded-2xl overflow-hidden border border-[#D9D9D9]">
              <thead className="bg-[#0A0A0A] text-white">
                <tr>
                  <th className="py-2.5 px-3">Size</th>
                  <th className="py-2.5 px-3">Chest</th>
                  <th className="py-2.5 px-3">Length</th>
                  <th className="py-2.5 px-3">Shoulder</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#D9D9D9] text-[#0A0A0A]">
                <tr><td className="py-2.5 px-3 font-bold">S</td><td className="px-3">38&quot;</td><td className="px-3">27&quot;</td><td className="px-3">17.5&quot;</td></tr>
                <tr><td className="py-2.5 px-3 font-bold">M</td><td className="px-3">40&quot;</td><td className="px-3">28&quot;</td><td className="px-3">18.5&quot;</td></tr>
                <tr><td className="py-2.5 px-3 font-bold">L</td><td className="px-3">42&quot;</td><td className="px-3">29&quot;</td><td className="px-3">19.5&quot;</td></tr>
                <tr><td className="py-2.5 px-3 font-bold">XL</td><td className="px-3">44&quot;</td><td className="px-3">30&quot;</td><td className="px-3">20.5&quot;</td></tr>
                <tr><td className="py-2.5 px-3 font-bold">XXL</td><td className="px-3">46&quot;</td><td className="px-3">31&quot;</td><td className="px-3">21.5&quot;</td></tr>
              </tbody>
            </table>
            <Link
              to="/size-guide"
              onClick={() => setSizeGuideOpen(false)}
              className="inline-block text-xs font-semibold text-[#0A0A0A] underline underline-offset-4"
            >
              View full Size Guide for Pants, Denim &amp; Sneakers
            </Link>
          </div>
        </div>
      )}

      {/* Product Share & Dynamic QR Code Modal */}
      <ProductQrModal
        open={qrModalOpen}
        initialTab={qrModalTab}
        product={product}
        onClose={() => setQrModalOpen(false)}
      />
    </main>
  );
};
