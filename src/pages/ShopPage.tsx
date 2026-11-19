import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search, SlidersHorizontal, X } from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { ProductCard } from '../components/ProductCard';
import { SeoHead } from '../components/SeoHead';
import { calculateDiscountPercent } from '../lib/formatters';

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
  const { products, categories } = useStore();
  const [searchParams, setSearchParams] = useSearchParams();

  const initialCat = searchParams.get('category') || 'All';
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

  // Sync URL query params if navigation links change ?category= or ?q=
  useEffect(() => {
    const paramCat = searchParams.get('category') || 'All';
    const paramSub = searchParams.get('subcategory') || 'All';
    const paramQ = searchParams.get('q') || '';
    setSelectedCategory(paramCat);
    setSelectedSubcategory(paramSub);
    if (paramQ) setSearchText(paramQ);
  }, [searchParams]);

  // Dynamic category list from Admin Categories + any extra published product category
  const categoryOptions = useMemo(() => {
    const names = new Set<string>(['All']);
    categories.forEach((c) => {
      if (c.name) names.add(c.name);
    });
    products.forEach((p) => {
      if (p.category) names.add(p.category);
    });
    if (selectedCategory && selectedCategory !== 'All') {
      names.add(selectedCategory);
    }
    return Array.from(names);
  }, [categories, products, selectedCategory]);

  // Selected Category record (for subcategories and filterCategories matching)
  const activeCategoryRecord = useMemo(() => {
    if (selectedCategory === 'All') return undefined;
    const target = selectedCategory.toLowerCase();
    return categories.find(
      (c) =>
        c.name.toLowerCase() === target ||
        c.slug.toLowerCase() === target ||
        c.filterCategories.some((fc) => fc.toLowerCase() === target)
    );
  }, [categories, selectedCategory]);

  // Dynamic subcategory chips based on active category + published products
  const subcategoryOptions = useMemo(() => {
    const subs = new Set<string>();
    if (activeCategoryRecord?.subcategories) {
      activeCategoryRecord.subcategories.forEach((s) => {
        if (s.trim()) subs.add(s.trim());
      });
    }
    products.forEach((p) => {
      if (!p.subcategory?.trim()) return;
      if (selectedCategory === 'All') {
        subs.add(p.subcategory.trim());
      } else {
        const target = selectedCategory.toLowerCase();
        const matchesCat =
          p.category.toLowerCase() === target ||
          activeCategoryRecord?.name.toLowerCase() === p.category.toLowerCase() ||
          activeCategoryRecord?.filterCategories.some(
            (fc) => fc.toLowerCase() === p.category.toLowerCase()
          );
        if (matchesCat) subs.add(p.subcategory.trim());
      }
    });
    return Array.from(subs);
  }, [activeCategoryRecord, products, selectedCategory]);

  const availableSizes = useMemo(() => {
    const set = new Set<string>();
    products.forEach((p) => p.sizes.forEach((s) => s && set.add(s)));
    return Array.from(set);
  }, [products]);

  const availableColors = useMemo(() => {
    const set = new Set<string>();
    products.forEach((p) => p.colors.forEach((c) => c.name && set.add(c.name)));
    return Array.from(set);
  }, [products]);

  const sliderMax = useMemo(() => {
    const highest = products.reduce((max, p) => Math.max(max, p.price), 0);
    return Math.max(10000, Math.ceil(highest / 500) * 500);
  }, [products]);

  const effectiveMaxPrice = maxPrice ?? sliderMax;

  const filtered = useMemo(() => {
    const q = searchText.trim().toLowerCase();

    const list = products.filter((p) => {
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

      if (selectedCategory !== 'All') {
        const target = selectedCategory.toLowerCase();
        const directMatch = p.category.toLowerCase() === target;
        const groupMatch = activeCategoryRecord
          ? p.category.toLowerCase() === activeCategoryRecord.name.toLowerCase() ||
            activeCategoryRecord.filterCategories.some(
              (fc) => fc.toLowerCase() === p.category.toLowerCase()
            )
          : false;
        if (!directMatch && !groupMatch) return false;
      }

      if (
        selectedSubcategory !== 'All' &&
        (p.subcategory || '').toLowerCase() !== selectedSubcategory.toLowerCase()
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
    products,
    mode,
    selectedCategory,
    activeCategoryRecord,
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
    setSearchParams({});
  };

  const copy = MODE_COPY[mode];

  const filterPanel = (
    <div className="space-y-6 text-sm">
      {/* Category */}
      <div>
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#5C5C5C] mb-3">
          Category
        </h3>
        <div className="flex flex-wrap gap-2">
          {categoryOptions.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => {
                setSelectedCategory(cat);
                setSelectedSubcategory('All');
              }}
              className={`chip-btn ${
                selectedCategory.toLowerCase() === cat.toLowerCase()
                  ? 'chip-btn-active'
                  : ''
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Subcategory (if available) */}
      {subcategoryOptions.length > 0 && (
        <div>
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#5C5C5C] mb-2.5">
            Subcategory
          </h3>
          <div className="flex flex-wrap gap-2">
            {['All', ...subcategoryOptions].map((sub) => (
              <button
                key={sub}
                type="button"
                onClick={() => setSelectedSubcategory(sub)}
                className={`chip-btn ${
                  selectedSubcategory.toLowerCase() === sub.toLowerCase()
                    ? 'chip-btn-active'
                    : ''
                }`}
              >
                {sub}
              </button>
            ))}
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
      <SeoHead title={`${copy.title} — PYTHOX WORLD`} description={copy.desc} />

      {/* Page Heading & Search */}
      <div className="border-b border-[#D9D9D9] pb-6 sm:pb-7 flex flex-col lg:flex-row lg:items-end justify-between gap-5">
        <div>
          <p className="text-[11px] font-mono font-semibold uppercase tracking-[0.2em] text-[#5C5C5C]">
            {copy.eyebrow}
          </p>
          <h1 className="mt-1.5 text-3xl sm:text-4xl font-editorial font-semibold text-[#0A0A0A]">
            {copy.title}
          </h1>
          <p className="mt-2 text-sm text-[#292929] max-w-xl">{copy.desc}</p>
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

      {/* Main Content */}
      <div className="mt-7 sm:mt-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
        <aside className="hidden lg:block lg:col-span-3 border-r border-[#D9D9D9] pr-6">
          {filterPanel}
        </aside>

        <section className="lg:col-span-9">
          <div className="mb-5 flex items-center justify-between text-xs text-[#5C5C5C]">
            <span className="font-mono tabular-nums">
              {filtered.length} {filtered.length === 1 ? 'product' : 'products'}
            </span>
            {(selectedCategory !== 'All' ||
              selectedSubcategory !== 'All' ||
              selectedSize !== 'All' ||
              selectedColor !== 'All' ||
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

          {filtered.length === 0 ? (
            <div className="rounded-3xl border border-[#D9D9D9] bg-[#EAE9E4] p-10 sm:p-12 text-center space-y-3">
              <p className="text-lg font-editorial font-medium text-[#0A0A0A]">
                {products.length === 0
                  ? 'No products available at the moment.'
                  : 'No matching pieces found'}
              </p>
              {products.length === 0 ? (
                <p className="text-xs text-[#5C5C5C]">
                  Products published from the Admin Panel will appear here automatically.
                </p>
              ) : (
                <button
                  type="button"
                  onClick={resetFilters}
                  className="btn-base btn-primary mt-2"
                >
                  Reset Filters
                </button>
              )}
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
          <div className="fixed inset-0 bg-[#0A0A0A]/55 backdrop-enter" onClick={() => setMobileFiltersOpen(false)} />
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
