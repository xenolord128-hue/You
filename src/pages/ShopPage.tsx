import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Search, SlidersHorizontal, X } from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { ProductCard } from '../components/ProductCard';
import { SeoHead } from '../components/SeoHead';
import { calculateDiscountPercent } from '../lib/formatters';
import { trackSearchEvent } from '../lib/metaPixel';
import {
  countProductsInCategory,
  countProductsInSubcategory,
  findCategoryByIdentifier,
  getSortedCategories,
  normalizeCategoryKey,
  productMatchesCategory,
  productMatchesSubcategory,
} from '../lib/categoryUtils';
import { Category } from '../types/ecommerce';

export type ShopMode =
  | 'all'
  | 'new'
  | 'best-sellers'
  | 'trending'
  | 'winter'
  | 'sale';

interface ShopPageProps {
  mode?: ShopMode;
}

const MODE_COPY: Record<ShopMode, { title: string; eyebrow: string; desc: string }> = {
  all: {
    eyebrow: "Men's Catalog",
    title: 'Shop All Menswear',
    desc: 'Every garment, sneaker, timepiece, and accessory crafted for PYTHOX WORLD.',
  },
  new: {
    eyebrow: 'Latest Release',
    title: 'New Arrivals',
    desc: 'Fresh men’s essentials and seasonal drops delivered across Bangladesh.',
  },
  'best-sellers': {
    eyebrow: 'Customer Favorites',
    title: 'Best Sellers',
    desc: 'Our highest-rated, most reordered menswear silhouettes.',
  },
  trending: {
    eyebrow: 'In Demand',
    title: 'Trending Now',
    desc: 'Elevated street and smart-casual pieces leading the season.',
  },
  winter: {
    eyebrow: 'Seasonal Capsule',
    title: 'Winter, Redefined.',
    desc: '460 GSM hoodies, structured bomber jackets, and heavyweight sweatshirts.',
  },
  sale: {
    eyebrow: 'Special Offers',
    title: 'Archive & Seasonal Sale',
    desc: 'Selected PYTHOX WORLD men’s pieces at limited-time markdown pricing.',
  },
};

export const ShopPage: React.FC<ShopPageProps> = ({ mode = 'all' }) => {
  const { products, categories, productsLoading, productsError, refreshProducts } = useStore();
  const { categorySlug } = useParams<{ categorySlug?: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const sortedCategories = useMemo(
    () => getSortedCategories(categories),
    [categories]
  );

  const initialCat = categorySlug || searchParams.get('category') || 'All';
  const initialSubcat = searchParams.get('subcategory') || 'All';
  const initialQuery = searchParams.get('q') || '';

  const [searchText, setSearchText] = useState(initialQuery);
  const [selectedCategory, setSelectedCategory] = useState<string>(initialCat);
  const [selectedSubcategory, setSelectedSubcategory] = useState<string>(initialSubcat);
  const [selectedSize, setSelectedSize] = useState<string>('All');
  const [selectedColor, setSelectedColor] = useState<string>('All');
  const [maxPrice, setMaxPrice] = useState<number | null>(null);
  const [inStockOnly, setInStockOnly] = useState(false);
  const [minRating, setMinRating] = useState<number>(0);
  const [discountOnly, setDiscountOnly] = useState(false);
  const [sortBy, setSortBy] = useState<
    'featured' | 'newest' | 'best-selling' | 'price-asc' | 'price-desc' | 'rating'
  >('featured');
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  // Sync URL route slug (/category/:categorySlug) or query params (?category=, ?subcategory=, ?q=)
  useEffect(() => {
    const nextCat = categorySlug || searchParams.get('category') || 'All';
    const nextSub = searchParams.get('subcategory') || 'All';
    const nextQ = searchParams.get('q') || '';
    setSelectedCategory(nextCat);
    setSelectedSubcategory(nextSub);
    if (nextQ) setSearchText(nextQ);
  }, [categorySlug, searchParams]);

  const lastTrackedShopSearchRef = useRef<string>('');
  useEffect(() => {
    const trimmed = searchText.trim();
    if (trimmed.length < 2) return;
    const normalized = trimmed.toLowerCase();
    if (lastTrackedShopSearchRef.current === normalized) return;

    const timer = window.setTimeout(() => {
      lastTrackedShopSearchRef.current = normalized;
      trackSearchEvent(trimmed);
    }, 550);

    return () => window.clearTimeout(timer);
  }, [searchText]);

  // Products scoped by the curated page mode (All, New Arrivals, Best Sellers, etc.)
  const modeFilteredProducts = useMemo(() => {
    return products.filter((p) => {
      if (mode === 'new' && !p.new_arrival) return false;
      if (mode === 'best-sellers' && !p.best_seller) return false;
      if (mode === 'trending' && !p.trending) return false;
      if (mode === 'winter' && !p.winter_collection) return false;
      if (
        mode === 'sale' &&
        !p.sale &&
        !(p.compare_at_price && p.compare_at_price > p.price)
      ) {
        return false;
      }
      return true;
    });
  }, [products, mode]);

  // Active Category record (matched by slug, id, name, or filterCategory alias)
  const activeCategoryRecord = useMemo(() => {
    return findCategoryByIdentifier(sortedCategories, selectedCategory);
  }, [sortedCategories, selectedCategory]);

  // Helper to navigate or switch category cleanly with clean SEO URLs
  const selectCategory = (catOrAll: Category | 'All') => {
    setSelectedSubcategory('All');
    setSelectedSize('All');
    setSelectedColor('All');

    const preservedParams = new URLSearchParams();
    if (searchText.trim()) preservedParams.set('q', searchText.trim());

    if (catOrAll === 'All') {
      setSelectedCategory('All');
      if (mode === 'all') {
        const qs = preservedParams.toString();
        navigate(qs ? `/shop?${qs}` : '/shop');
      } else {
        setSearchParams(preservedParams);
      }
      return;
    }

    setSelectedCategory(catOrAll.slug);
    if (mode === 'all') {
      const qs = preservedParams.toString();
      navigate(qs ? `/category/${catOrAll.slug}?${qs}` : `/category/${catOrAll.slug}`);
    } else {
      preservedParams.set('category', catOrAll.slug);
      setSearchParams(preservedParams);
    }
  };

  const selectSubcategory = (sub: string) => {
    setSelectedSubcategory(sub);
    const next = new URLSearchParams(searchParams);
    if (sub === 'All') {
      next.delete('subcategory');
    } else {
      next.set('subcategory', sub);
    }
    setSearchParams(next, { replace: true });
  };

  // Products matching the active category (used to auto-update available subcategories, sizes, and colors)
  const categoryScopedProducts = useMemo(() => {
    if (selectedCategory === 'All') return modeFilteredProducts;
    return modeFilteredProducts.filter((p) =>
      productMatchesCategory(p, activeCategoryRecord || selectedCategory, sortedCategories)
    );
  }, [modeFilteredProducts, selectedCategory, activeCategoryRecord, sortedCategories]);

  // Subcategories for active category (predefined + dynamically discovered from available products)
  const subcategoryOptions = useMemo(() => {
    if (selectedCategory === 'All' && !activeCategoryRecord) return [];
    const seen = new Set<string>();
    const list: string[] = [];

    if (activeCategoryRecord?.subcategories) {
      activeCategoryRecord.subcategories.forEach((sub) => {
        const clean = sub.trim();
        const key = normalizeCategoryKey(clean);
        if (clean && !seen.has(key)) {
          seen.add(key);
          list.push(clean);
        }
      });
    }

    categoryScopedProducts.forEach((p) => {
      const clean = (p.subcategory || '').trim();
      const key = normalizeCategoryKey(clean);
      if (clean && !seen.has(key)) {
        seen.add(key);
        list.push(clean);
      }
    });

    return list;
  }, [selectedCategory, activeCategoryRecord, categoryScopedProducts]);

  // Sizes and colors auto-update based on available products in the active category
  const availableSizes = useMemo(() => {
    const source = categoryScopedProducts.length > 0 ? categoryScopedProducts : modeFilteredProducts;
    const set = new Set<string>();
    source.forEach((p) => p.sizes.forEach((s) => s && set.add(s)));
    return Array.from(set);
  }, [categoryScopedProducts, modeFilteredProducts]);

  const availableColors = useMemo(() => {
    const source = categoryScopedProducts.length > 0 ? categoryScopedProducts : modeFilteredProducts;
    const set = new Set<string>();
    source.forEach((p) => p.colors.forEach((c) => c.name && set.add(c.name)));
    return Array.from(set);
  }, [categoryScopedProducts, modeFilteredProducts]);

  const sliderMax = useMemo(() => {
    const highest = products.reduce((max, p) => Math.max(max, p.price), 0);
    return Math.max(10000, Math.ceil(highest / 500) * 500);
  }, [products]);

  const effectiveMaxPrice = maxPrice ?? sliderMax;

  const filtered = useMemo(() => {
    const q = searchText.trim().toLowerCase();

    const list = categoryScopedProducts.filter((p) => {
      if (
        selectedSubcategory !== 'All' &&
        !productMatchesSubcategory(p, selectedSubcategory)
      ) {
        return false;
      }

      if (selectedSize !== 'All' && !p.sizes.includes(selectedSize)) return false;
      if (
        selectedColor !== 'All' &&
        !p.colors.some((c) => c.name.toLowerCase().includes(selectedColor.toLowerCase()))
      ) {
        return false;
      }
      if (p.price > effectiveMaxPrice) return false;
      if (inStockOnly && p.inventory <= 0) return false;
      if (p.rating < minRating) return false;
      if (discountOnly && calculateDiscountPercent(p.price, p.compare_at_price) <= 0) {
        return false;
      }
      if (q) {
        const hay = [
          p.name,
          p.category,
          ...(p.additionalCategories || []),
          p.subcategory || '',
          p.sku,
          p.shortDescription || '',
          ...(p.tags || []),
        ]
          .join(' ')
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    return [...list].sort((a, b) => {
      switch (sortBy) {
        case 'newest':
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        case 'best-selling':
          return Number(b.best_seller) - Number(a.best_seller) || b.reviews_count - a.reviews_count;
        case 'price-asc':
          return a.price - b.price;
        case 'price-desc':
          return b.price - a.price;
        case 'rating':
          return b.rating - a.rating;
        default:
          return Number(b.featured) - Number(a.featured);
      }
    });
  }, [
    categoryScopedProducts,
    selectedSubcategory,
    selectedSize,
    selectedColor,
    effectiveMaxPrice,
    inStockOnly,
    minRating,
    discountOnly,
    searchText,
    sortBy,
  ]);

  const resetFilters = () => {
    setSelectedCategory('All');
    setSelectedSubcategory('All');
    setSelectedSize('All');
    setSelectedColor('All');
    setMaxPrice(null);
    setInStockOnly(false);
    setMinRating(0);
    setDiscountOnly(false);
    setSearchText('');
    if (categorySlug) {
      navigate('/shop');
    } else {
      setSearchParams({});
    }
  };

  const baseCopy = MODE_COPY[mode];
  const isAllCategoryView = selectedCategory === 'All' && !categorySlug;

  // Dynamic SEO title, description, and heading for category pages vs mode pages
  const activeHeading = useMemo(() => {
    if (activeCategoryRecord) {
      return {
        eyebrow: mode === 'all' ? "Men's Fashion Category" : `${baseCopy.title} · Men's Category`,
        title: activeCategoryRecord.name,
        desc:
          activeCategoryRecord.description ||
          `Explore premium men’s ${activeCategoryRecord.name.toLowerCase()} from PYTHOX WORLD.`,
      };
    }
    if (categorySlug) {
      const readableSlug = categorySlug
        .replace(/-/g, ' ')
        .replace(/\b\w/g, (ch) => ch.toUpperCase());
      return {
        eyebrow: "Men's Fashion Category",
        title: readableSlug,
        desc: `Curated men’s ${readableSlug.toLowerCase()} engineered for architectural fit and daily utility.`,
      };
    }
    return baseCopy;
  }, [activeCategoryRecord, categorySlug, mode, baseCopy]);

  const seoTitle = activeCategoryRecord
    ? `${activeCategoryRecord.name} — Men's Fashion | PYTHOX WORLD`
    : `${activeHeading.title} — PYTHOX WORLD`;

  const categoryJsonLd = useMemo(() => {
    if (typeof window === 'undefined') return undefined;
    const origin = window.location.origin;
    if (!activeCategoryRecord) return undefined;

    return {
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'CollectionPage',
          name: `${activeCategoryRecord.name} — PYTHOX WORLD Men's Fashion`,
          description: activeCategoryRecord.description,
          url: `${origin}/category/${activeCategoryRecord.slug}`,
          numberOfItems: filtered.length,
        },
        {
          '@type': 'BreadcrumbList',
          itemListElement: [
            {
              '@type': 'ListItem',
              position: 1,
              name: 'Home',
              item: `${origin}/`,
            },
            {
              '@type': 'ListItem',
              position: 2,
              name: 'Shop',
              item: `${origin}/shop`,
            },
            {
              '@type': 'ListItem',
              position: 3,
              name: activeCategoryRecord.name,
              item: `${origin}/category/${activeCategoryRecord.slug}`,
            },
          ],
        },
      ],
    };
  }, [activeCategoryRecord, filtered.length]);

  const isCategorySelected = (cat: Category) => {
    if (activeCategoryRecord) return activeCategoryRecord.id === cat.id;
    return (
      normalizeCategoryKey(selectedCategory) === normalizeCategoryKey(cat.name) ||
      normalizeCategoryKey(selectedCategory) === normalizeCategoryKey(cat.slug)
    );
  };

  const filterPanel = (
    <div className="space-y-6 text-sm">
      {/* Category */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#5C5C5C]">
            Men&apos;s Categories
          </h3>
          <span className="font-mono text-[10px] text-[#5C5C5C] tabular-nums">
            {sortedCategories.length}
          </span>
        </div>
        <div className="flex flex-col gap-1.5">
          <button
            type="button"
            onClick={() => {
              selectCategory('All');
              setMobileFiltersOpen(false);
            }}
            className={`flex items-center justify-between rounded-[10px] px-3 py-2 text-left text-xs font-medium transition-colors cursor-pointer ${
              isAllCategoryView
                ? 'bg-[#0A0A0A] text-white font-semibold'
                : 'bg-white border border-[#D4D3CE] text-[#0A0A0A] hover:border-[#0A0A0A]'
            }`}
          >
            <span>All Products</span>
            <span
              className={`font-mono text-[11px] tabular-nums ${
                isAllCategoryView ? 'text-white/75' : 'text-[#5C5C5C]'
              }`}
            >
              {modeFilteredProducts.length}
            </span>
          </button>

          {sortedCategories.map((cat) => {
            const active = isCategorySelected(cat);
            const catCount = countProductsInCategory(
              modeFilteredProducts,
              cat,
              sortedCategories
            );
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => {
                  selectCategory(cat);
                  setMobileFiltersOpen(false);
                }}
                className={`flex items-center justify-between rounded-[10px] px-3 py-2 text-left text-xs font-medium transition-colors cursor-pointer ${
                  active
                    ? 'bg-[#0A0A0A] text-white font-semibold'
                    : 'bg-white border border-[#D4D3CE] text-[#0A0A0A] hover:border-[#0A0A0A]'
                }`}
              >
                <span className="truncate pr-2">{cat.name}</span>
                <span
                  className={`font-mono text-[11px] tabular-nums shrink-0 ${
                    active ? 'text-white/75' : 'text-[#5C5C5C]'
                  }`}
                >
                  {catCount}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Subcategory (if available) */}
      {subcategoryOptions.length > 0 && (
        <div>
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#5C5C5C] mb-2.5">
            Subcategory
          </h3>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => selectSubcategory('All')}
              className={`chip-btn ${
                selectedSubcategory === 'All' ? 'chip-btn-active' : ''
              }`}
            >
              All
            </button>
            {subcategoryOptions.map((sub) => {
              const subCount = countProductsInSubcategory(
                categoryScopedProducts,
                activeCategoryRecord,
                sub,
                sortedCategories
              );
              const active =
                normalizeCategoryKey(selectedSubcategory) === normalizeCategoryKey(sub);
              return (
                <button
                  key={sub}
                  type="button"
                  onClick={() => selectSubcategory(sub)}
                  className={`chip-btn ${active ? 'chip-btn-active' : ''}`}
                >
                  <span>{sub}</span>
                  {subCount > 0 && (
                    <span className="ml-1 font-mono text-[10px] opacity-70 tabular-nums">
                      ({subCount})
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Price */}
      <div>
        <div className="flex items-center justify-between text-xs mb-2">
          <span className="font-semibold uppercase tracking-[0.12em] text-[#5C5C5C] text-[11px]">
            Max Price
          </span>
          <span className="font-mono font-semibold tabular-nums text-[#0A0A0A]">
            ৳{effectiveMaxPrice.toLocaleString('en-US')}
          </span>
        </div>
        <input
          type="range"
          min={500}
          max={sliderMax}
          step={250}
          value={effectiveMaxPrice}
          onChange={(e) => setMaxPrice(Number(e.target.value))}
          className="w-full accent-[#0A0A0A]"
        />
      </div>

      {/* Size */}
      {availableSizes.length > 0 && (
        <div>
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#5C5C5C] mb-2.5">
            Size
          </h3>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setSelectedSize('All')}
              className={`chip-btn ${selectedSize === 'All' ? 'chip-btn-active' : ''}`}
            >
              All
            </button>
            {availableSizes.map((sz) => (
              <button
                key={sz}
                type="button"
                onClick={() => setSelectedSize(sz)}
                className={`chip-btn font-mono ${
                  selectedSize === sz ? 'chip-btn-active' : ''
                }`}
              >
                {sz}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Colour */}
      {availableColors.length > 0 && (
        <div>
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#5C5C5C] mb-2.5">
            Colour
          </h3>
          <div className="flex flex-wrap gap-2">
            {['All', ...availableColors].map((col) => (
              <button
                key={col}
                type="button"
                onClick={() => setSelectedColor(col)}
                className={`chip-btn ${
                  selectedColor === col ? 'chip-btn-active' : ''
                }`}
              >
                {col}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Availability, Rating, Discount */}
      <div className="space-y-3 pt-3 border-t border-[#D9D9D9] text-xs text-[#292929]">
        <label className="flex items-center gap-2.5 min-h-[28px] cursor-pointer">
          <input
            type="checkbox"
            checked={inStockOnly}
            onChange={(e) => setInStockOnly(e.target.checked)}
            className="h-4 w-4 accent-[#0A0A0A]"
          />
          In Stock Only
        </label>
        <label className="flex items-center gap-2.5 min-h-[28px] cursor-pointer">
          <input
            type="checkbox"
            checked={discountOnly}
            onChange={(e) => setDiscountOnly(e.target.checked)}
            className="h-4 w-4 accent-[#0A0A0A]"
          />
          Discounted Items Only
        </label>
        <div>
          <label className="block text-[11px] font-semibold uppercase tracking-[0.12em] text-[#5C5C5C] mb-1.5">
            Minimum Rating
          </label>
          <select
            value={minRating}
            onChange={(e) => setMinRating(Number(e.target.value))}
            className="w-full min-h-[40px] rounded-[10px] border border-[#D4D3CE] px-3 py-2 text-xs bg-white text-[#0A0A0A] focus:border-[#0A0A0A] focus:outline-none"
          >
            <option value={0}>All Ratings</option>
            <option value={4.5}>4.5 ★ &amp; above</option>
            <option value={4.8}>4.8 ★ &amp; above</option>
          </select>
        </div>
      </div>

      <button
        type="button"
        onClick={resetFilters}
        className="btn-base btn-secondary w-full"
      >
        Reset All Filters
      </button>
    </div>
  );

  return (
    <main className="mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-10 py-6 sm:py-8 lg:py-12">
      <SeoHead
        title={seoTitle}
        description={activeHeading.desc}
        image={activeCategoryRecord?.image}
        jsonLd={categoryJsonLd}
      />

      {/* Category Breadcrumb (visible when browsing a specific Men's category) */}
      {(activeCategoryRecord || categorySlug) && (
        <nav
          aria-label="Category Breadcrumb"
          className="mb-4 font-mono text-[11px] uppercase tracking-[0.16em] text-[#5C5C5C] flex flex-wrap items-center gap-2"
        >
          <Link to="/" className="hover:text-[#0A0A0A]">
            Home
          </Link>
          <span>/</span>
          <Link to="/shop" className="hover:text-[#0A0A0A]">
            Shop All Menswear
          </Link>
          <span>/</span>
          <span className="text-[#0A0A0A] font-semibold">
            {activeHeading.title}
          </span>
          {selectedSubcategory !== 'All' && (
            <>
              <span>/</span>
              <span className="text-[#0A0A0A] font-semibold">
                {selectedSubcategory}
              </span>
            </>
          )}
        </nav>
      )}

      {/* Page Heading & Search */}
      <div className="border-b border-[#D9D9D9] pb-6 sm:pb-7 flex flex-col lg:flex-row lg:items-end justify-between gap-5">
        <div>
          <p className="text-[11px] font-mono font-semibold uppercase tracking-[0.2em] text-[#5C5C5C]">
            {activeHeading.eyebrow}
          </p>
          <h1 className="mt-1.5 text-3xl sm:text-4xl font-editorial font-semibold text-[#0A0A0A]">
            {activeHeading.title}
          </h1>
          <p className="mt-2 text-sm text-[#292929] max-w-xl">
            {activeHeading.desc}
          </p>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center gap-2.5 w-full lg:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#5C5C5C]" />
            <input
              type="text"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              placeholder="Search name, tag, or SKU..."
              className="w-full min-h-[42px] rounded-[10px] border border-[#D4D3CE] bg-white pl-9 pr-3 py-2 text-xs text-[#0A0A0A] placeholder:text-[#6A6A6A] focus:border-[#0A0A0A] focus:outline-none"
            />
          </div>
          <div className="flex items-center gap-2.5">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
              aria-label="Sort products"
              className="flex-1 sm:flex-none min-h-[42px] rounded-[10px] border border-[#D4D3CE] bg-white px-3 py-2 text-xs font-medium text-[#0A0A0A] focus:border-[#0A0A0A] focus:outline-none"
            >
              <option value="featured">Sort: Featured</option>
              <option value="newest">Sort: Newest</option>
              <option value="best-selling">Sort: Best Selling</option>
              <option value="price-asc">Price: Low to High</option>
              <option value="price-desc">Price: High to Low</option>
              <option value="rating">Highest Rated</option>
            </select>
            <button
              type="button"
              onClick={() => setMobileFiltersOpen(true)}
              className="lg:hidden btn-base btn-secondary min-h-[42px] px-4 shrink-0"
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              <span>Filters</span>
            </button>
          </div>
        </div>
      </div>

      {/* Monochrome Premium Men's Category Navigation Strip (Horizontal Scroll on Mobile) */}
      <div className="border-b border-[#D9D9D9] py-4 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <nav
            aria-label="Men's Product Categories"
            className="flex-1 min-w-0 flex items-center gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            <button
              type="button"
              onClick={() => selectCategory('All')}
              className={`shrink-0 inline-flex items-center gap-1.5 rounded-[10px] px-3.5 py-2 text-xs font-medium transition-colors cursor-pointer whitespace-nowrap border ${
                isAllCategoryView
                  ? 'bg-[#0A0A0A] text-white border-[#0A0A0A]'
                  : 'bg-white text-[#0A0A0A] border-[#D4D3CE] hover:border-[#0A0A0A]'
              }`}
            >
              <span>All Products</span>
              <span
                className={`font-mono text-[10.5px] tabular-nums ${
                  isAllCategoryView ? 'text-white/75' : 'text-[#5C5C5C]'
                }`}
              >
                ({modeFilteredProducts.length})
              </span>
            </button>

            {sortedCategories.map((cat) => {
              const active = isCategorySelected(cat);
              const count = countProductsInCategory(
                modeFilteredProducts,
                cat,
                sortedCategories
              );
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => selectCategory(cat)}
                  className={`shrink-0 inline-flex items-center gap-1.5 rounded-[10px] px-3.5 py-2 text-xs font-medium transition-colors cursor-pointer whitespace-nowrap border ${
                    active
                      ? 'bg-[#0A0A0A] text-white border-[#0A0A0A]'
                      : 'bg-white text-[#0A0A0A] border-[#D4D3CE] hover:border-[#0A0A0A]'
                  }`}
                >
                  <span>{cat.name}</span>
                  <span
                    className={`font-mono text-[10.5px] tabular-nums ${
                      active ? 'text-white/75' : 'text-[#5C5C5C]'
                    }`}
                  >
                    ({count})
                  </span>
                </button>
              );
            })}
          </nav>

          {/* Compact Mobile Quick-Category Dropdown */}
          <div className="sm:hidden shrink-0">
            <select
              aria-label="Quick category selector"
              value={activeCategoryRecord?.slug || 'All'}
              onChange={(e) => {
                const val = e.target.value;
                if (val === 'All') {
                  selectCategory('All');
                } else {
                  const found = sortedCategories.find((c) => c.slug === val);
                  if (found) selectCategory(found);
                }
              }}
              className="max-w-[138px] min-h-[36px] rounded-[10px] border border-[#D4D3CE] bg-white px-2.5 py-1.5 text-[11px] font-medium text-[#0A0A0A] focus:border-[#0A0A0A] focus:outline-none"
            >
              <option value="All">All ({modeFilteredProducts.length})</option>
              {sortedCategories.map((cat) => (
                <option key={cat.id} value={cat.slug}>
                  {cat.name} (
                  {countProductsInCategory(
                    modeFilteredProducts,
                    cat,
                    sortedCategories
                  )}
                  )
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Dynamic Subcategory Filter Strip for Active Category */}
        {subcategoryOptions.length > 0 && (
          <div className="flex items-center gap-2 overflow-x-auto pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <span className="shrink-0 font-mono text-[10px] uppercase tracking-[0.16em] text-[#5C5C5C] pr-1">
              Type:
            </span>
            <button
              type="button"
              onClick={() => selectSubcategory('All')}
              className={`shrink-0 chip-btn ${
                selectedSubcategory === 'All' ? 'chip-btn-active' : ''
              }`}
            >
              All {activeCategoryRecord?.name || ''}
            </button>
            {subcategoryOptions.map((sub) => {
              const subCount = countProductsInSubcategory(
                categoryScopedProducts,
                activeCategoryRecord,
                sub,
                sortedCategories
              );
              const active =
                normalizeCategoryKey(selectedSubcategory) === normalizeCategoryKey(sub);
              return (
                <button
                  key={sub}
                  type="button"
                  onClick={() => selectSubcategory(sub)}
                  className={`shrink-0 chip-btn ${active ? 'chip-btn-active' : ''}`}
                >
                  <span>{sub}</span>
                  {subCount > 0 && (
                    <span className="ml-1 font-mono text-[10px] opacity-70 tabular-nums">
                      ({subCount})
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Main Content */}
      <div className="mt-7 sm:mt-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
        <aside className="hidden lg:block lg:col-span-3 border-r border-[#D9D9D9] pr-6">
          {filterPanel}
        </aside>

        <section className="lg:col-span-9">
          <div className="mb-5 flex items-center justify-between text-xs text-[#5C5C5C]">
            <span className="font-mono tabular-nums">
              {filtered.length} {filtered.length === 1 ? 'product' : 'products'}
              {activeCategoryRecord ? ` in ${activeCategoryRecord.name}` : ''}
              {selectedSubcategory !== 'All' ? ` · ${selectedSubcategory}` : ''}
            </span>
            {(selectedCategory !== 'All' ||
              selectedSubcategory !== 'All' ||
              selectedSize !== 'All' ||
              selectedColor !== 'All' ||
              inStockOnly ||
              discountOnly ||
              minRating > 0 ||
              searchText) && (
              <button
                type="button"
                onClick={resetFilters}
                className="btn-base btn-secondary btn-sm"
              >
                Clear filters
              </button>
            )}
          </div>

          {productsLoading && products.length === 0 ? (
            <div aria-busy="true" aria-label="Loading products">
              <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-[#5C5C5C] mb-4">
                Loading products...
              </p>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3.5 sm:gap-5 lg:gap-6">
                {[0, 1, 2, 3, 4, 5, 6, 7].map((slot) => (
                  <div
                    key={slot}
                    className="aspect-[4/5] rounded-2xl sm:rounded-3xl bg-[#E4E3DF] animate-pulse"
                  />
                ))}
              </div>
            </div>
          ) : productsError && products.length === 0 ? (
            <div className="rounded-3xl border border-[#D9D9D9] bg-[#EAE9E4] p-8 sm:p-12 text-center space-y-4">
              <p className="font-mono text-[10.5px] uppercase tracking-[0.2em] text-[#5C5C5C]">
                Catalog Connection
              </p>
              <p className="text-xl font-editorial font-medium text-[#0A0A0A]">
                Unable to load products. Please try again.
              </p>
              <p className="text-xs text-[#5C5C5C] max-w-md mx-auto leading-relaxed">
                We couldn&apos;t reach the product database right now. Please check your connection and retry.
              </p>
              <button
                type="button"
                onClick={() => void refreshProducts()}
                className="btn-base btn-primary"
              >
                Retry
              </button>
            </div>
          ) : filtered.length === 0 ? (
            <div className="rounded-3xl border border-[#D9D9D9] bg-[#EAE9E4] p-8 sm:p-12 text-center space-y-4">
              <p className="font-mono text-[10.5px] uppercase tracking-[0.2em] text-[#5C5C5C]">
                {activeCategoryRecord
                  ? activeCategoryRecord.name
                  : "Men's Catalog"}
              </p>
              <p className="text-xl font-editorial font-medium text-[#0A0A0A]">
                {products.length === 0
                  ? 'No products are publicly available.'
                  : activeCategoryRecord && categoryScopedProducts.length === 0
                  ? `New ${activeCategoryRecord.name} pieces arriving soon.`
                  : 'No matching pieces found.'}
              </p>
              <p className="text-xs text-[#5C5C5C] max-w-md mx-auto leading-relaxed">
                {products.length === 0
                  ? 'Published menswear items from the Admin Console will appear here automatically.'
                  : activeCategoryRecord && categoryScopedProducts.length === 0
                  ? activeCategoryRecord.description
                  : 'Try clearing a subcategory, size, or price filter to explore more silhouettes.'}
              </p>

              <div className="flex flex-wrap items-center justify-center gap-2.5 pt-1">
                {selectedSubcategory !== 'All' && categoryScopedProducts.length > 0 && (
                  <button
                    type="button"
                    onClick={() => selectSubcategory('All')}
                    className="btn-base btn-primary"
                  >
                    View All {activeCategoryRecord?.name || 'Items'}
                  </button>
                )}
                <button
                  type="button"
                  onClick={resetFilters}
                  className="btn-base btn-secondary"
                >
                  Browse All Men&apos;s Products
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3.5 sm:gap-5 lg:gap-6">
              {filtered.map((p) => (
                <ProductCard
                  key={p.id}
                  product={p}
                  showBestSellerTag={mode === 'best-sellers'}
                />
              ))}
            </div>
          )}
        </section>
      </div>

      {/* Mobile Filters Drawer */}
      {mobileFiltersOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-[#0A0A0A]/55 backdrop-enter"
            onClick={() => setMobileFiltersOpen(false)}
          />
          <div className="relative z-10 w-[88%] max-w-xs bg-[#F3F2EE] h-full flex flex-col modal-enter shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#D9D9D9] bg-white px-5 py-3.5">
              <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[#0A0A0A]">
                Filter Men&apos;s Catalog
              </span>
              <button
                type="button"
                onClick={() => setMobileFiltersOpen(false)}
                aria-label="Close filters"
                className="btn-base btn-secondary btn-icon"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-5">{filterPanel}</div>
            <div className="border-t border-[#D9D9D9] bg-white p-4">
              <button
                type="button"
                onClick={() => setMobileFiltersOpen(false)}
                className="btn-base btn-primary w-full"
              >
                Show {filtered.length} {filtered.length === 1 ? 'Piece' : 'Pieces'}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
};
