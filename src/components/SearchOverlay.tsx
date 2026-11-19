import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Search, X } from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { formatBDT } from '../lib/formatters';
import { trackPixelEvent } from '../lib/metaPixel';

// Suggestions are derived strictly from published products

export const SearchOverlay: React.FC = () => {
  const {
    products,
    recentSearches,
    addRecentSearch,
    isSearchOpen,
    setIsSearchOpen,
  } = useStore();
  const [query, setQuery] = useState('');
  const [smartNote, setSmartNote] = useState('');
  const [smartIds, setSmartIds] = useState<string[]>([]);
  const [isSmartLoading, setIsSmartLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (isSearchOpen) {
      setTimeout(() => inputRef.current?.focus(), 60);
    } else {
      setQuery('');
      setSmartNote('');
      setSmartIds([]);
    }
  }, [isSearchOpen]);

  useEffect(() => {
    if (!isSearchOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsSearchOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isSearchOpen, setIsSearchOpen]);

  const popularSuggestions = useMemo(() => {
    const terms = new Set<string>();
    products.forEach((p) => {
      if (p.category) terms.add(p.category);
    });
    return Array.from(terms).slice(0, 6);
  }, [products]);

  const localResults = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const matched = products.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q) ||
        (p.subcategory || '').toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        (p.shortDescription || '').toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q) ||
        (p.tags || []).some((t) => t.toLowerCase().includes(q))
    );
    if (smartIds.length > 0) {
      const smartProducts = smartIds
        .map((id) => products.find((p) => p.id === id))
        .filter((p): p is NonNullable<typeof p> => Boolean(p));
      const combined = [...matched];
      smartProducts.forEach((sp) => {
        if (!combined.some((c) => c.id === sp.id)) combined.push(sp);
      });
      return combined.slice(0, 6);
    }
    return matched.slice(0, 6);
  }, [query, products, smartIds]);

  const handleSmartSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = query.trim();
    if (!trimmed) return;
    addRecentSearch(trimmed);
    trackPixelEvent('Search', { search_string: trimmed });

    setIsSmartLoading(true);
    try {
      const res = await fetch('/api/smart-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: trimmed,
          catalogSummary: products.map((p) => ({
            id: p.id,
            name: p.name,
            category: p.category,
            price: p.price,
          })),
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.matchedIds)) setSmartIds(data.matchedIds);
        if (data.curationNote) setSmartNote(data.curationNote);
      }
    } catch {
      // Fallback to local filter cleanly
    } finally {
      setIsSmartLoading(false);
    }
  };

  const goToShopQuery = (term: string) => {
    addRecentSearch(term);
    trackPixelEvent('Search', { search_string: term });
    setIsSearchOpen(false);
    navigate(`/shop?q=${encodeURIComponent(term)}`);
  };

  if (!isSearchOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[80] flex items-start justify-center px-3 sm:px-6 pt-5 sm:pt-12 pb-6 bg-[#0A0A0A]/65 overflow-y-auto backdrop-enter"
      role="dialog"
      aria-modal="true"
      aria-label="Search PYTHOX WORLD"
      onClick={(e) => {
        if (e.target === e.currentTarget) setIsSearchOpen(false);
      }}
    >
      <div className="w-full max-w-[820px] rounded-2xl sm:rounded-[24px] bg-[#F3F2EE] border border-[#D9D9D9] shadow-2xl p-4 sm:p-6 modal-enter">
        <div className="flex items-center justify-between mb-3 px-0.5">
          <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-[#5C5C5C]">
            Search PYTHOX WORLD Catalog
          </span>
          <button
            type="button"
            onClick={() => setIsSearchOpen(false)}
            aria-label="Close search popup"
            className="btn-base btn-secondary btn-icon"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form
          onSubmit={handleSmartSubmit}
          className="flex items-center gap-2.5 sm:gap-3 rounded-xl bg-white pl-3.5 pr-2 py-2 border border-[#D4D3CE] focus-within:border-[#0A0A0A] transition-colors"
        >
          <Search className="h-5 w-5 text-[#0A0A0A] shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name, category, tag, or SKU..."
            className="flex-1 min-w-0 bg-transparent text-sm sm:text-base text-[#0A0A0A] placeholder:text-[#6A6A6A] focus:outline-none py-1.5"
          />
          {query && (
            <button
              type="submit"
              disabled={isSmartLoading}
              className="btn-base btn-primary btn-sm shrink-0"
            >
              {isSmartLoading ? 'Searching...' : 'Search'}
            </button>
          )}
        </form>

        {!query ? (
          products.length === 0 ? (
            <p className="mt-5 text-sm text-[#5C5C5C] px-1">
              No products available at the moment.
            </p>
          ) : (
            <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-5 text-sm">
              {popularSuggestions.length > 0 && (
                <div>
                  <p className="text-[11px] font-mono font-semibold uppercase tracking-[0.14em] text-[#5C5C5C] mb-3">
                    Browse Categories
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {popularSuggestions.map((term) => (
                      <button
                        key={term}
                        type="button"
                        onClick={() => setQuery(term)}
                        className="chip-btn"
                      >
                        {term}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {recentSearches.length > 0 && (
                <div>
                  <p className="text-[11px] font-mono font-semibold uppercase tracking-[0.14em] text-[#5C5C5C] mb-3">
                    Recent Searches
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {recentSearches.map((term) => (
                      <button
                        key={term}
                        type="button"
                        onClick={() => setQuery(term)}
                        className="chip-btn"
                      >
                        {term}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )
        ) : (
          <div className="mt-5 space-y-4">
            {smartNote && (
              <p className="text-xs text-[#0A0A0A] bg-white rounded-xl px-4 py-2 border border-[#D9D9D9]">
                {smartNote}
              </p>
            )}
            {localResults.length === 0 ? (
              <p className="text-sm text-[#5C5C5C]">
                No men&apos;s pieces matching &ldquo;{query}&rdquo;.
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[55vh] overflow-y-auto pr-0.5">
                {localResults.map((p) => (
                  <Link
                    key={p.id}
                    to={`/product/${p.slug}`}
                    onClick={() => setIsSearchOpen(false)}
                    className="flex items-center gap-3 p-2.5 rounded-xl bg-white border border-[#D9D9D9] hover:border-[#0A0A0A] transition-colors"
                  >
                    <img
                      src={p.images[0]}
                      alt={p.name}
                      className="h-16 w-16 rounded-lg object-cover bg-[#EAE9E4] shrink-0"
                    />
                    <div className="min-w-0">
                      <p className="text-[10px] font-mono uppercase tracking-[0.12em] text-[#5C5C5C] font-semibold">
                        {p.category} · {p.sku}
                      </p>
                      <p className="text-sm font-semibold text-[#0A0A0A] truncate">
                        {p.name}
                      </p>
                      <p className="text-xs font-mono font-bold text-[#0A0A0A] tabular-nums">
                        {formatBDT(p.price)}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            )}
            <button
              type="button"
              onClick={() => goToShopQuery(query)}
              className="btn-base btn-secondary btn-sm"
            >
              <span>View all results in Shop</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
