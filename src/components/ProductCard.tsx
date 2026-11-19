import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Heart, ShoppingBag, Star } from 'lucide-react';
import { Product } from '../types/ecommerce';
import { calculateDiscountPercent, formatBDT } from '../lib/formatters';
import { useStore } from '../context/StoreContext';

interface ProductCardProps {
  product: Product;
  compact?: boolean;
  showBestSellerTag?: boolean;
}

export const ProductCard: React.FC<ProductCardProps> = ({
  product,
}) => {
  const { addToCart, toggleWishlist, isInWishlist } = useStore();
  const [imgError, setImgError] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);

  const wishlisted = isInWishlist(product.id);
  const discountPct = calculateDiscountPercent(product.price, product.compare_at_price);

  const handleQuickAdd = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (product.inventory <= 0) return;
    addToCart(product, {
      color: product.colors[0]?.name || 'Black',
      size: product.sizes[0] || 'M',
      quantity: 1,
    });
  };

  const handleWishlist = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    toggleWishlist(product.id);
  };

  const mainImage = product.primaryImage || product.images[0] || '';

  return (
    <article className="group relative aspect-square rounded-2xl sm:rounded-3xl overflow-hidden bg-white border border-[#D9D9D9] navy-shadow transition-[transform,border-color,box-shadow] duration-250 ease-out [@media(hover:hover)]:hover:-translate-y-0.5 hover:border-[#0A0A0A]">
      <Link
        to={`/product/${product.slug}`}
        className="block h-full w-full relative"
        aria-label={`View ${product.name}`}
      >
        {!imgError && mainImage ? (
          <>
            {!imgLoaded && (
              <div aria-hidden="true" className="absolute inset-0 skeleton-shimmer" />
            )}
            <img
              src={mainImage}
              alt={product.name}
              loading="lazy"
              referrerPolicy="no-referrer"
              onLoad={() => setImgLoaded(true)}
              onError={() => setImgError(true)}
              className={`h-full w-full object-cover object-center transition-[transform,opacity] duration-500 ease-out [@media(hover:hover)]:group-hover:scale-105 ${
                imgLoaded ? 'opacity-100' : 'opacity-0'
              }`}
            />
          </>
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center bg-[#EAE9E4] p-4 text-center">
            <ShoppingBag className="h-7 w-7 text-[#5C5C5C] mb-2" />
            <span className="font-editorial text-sm font-bold text-[#0A0A0A]">{product.name}</span>
          </div>
        )}

        {/* Bottom Dark Monochrome Vignette Gradient */}
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-gradient-to-t from-[#0A0A0A]/95 via-[#0A0A0A]/30 to-transparent pointer-events-none"
        />

        {/* Top-Left Badge: Discount, NEW, or SOLD OUT */}
        <div className="absolute top-3 left-3 sm:top-3.5 sm:left-3.5 z-10 pointer-events-none">
          {product.inventory <= 0 ? (
            <span className="inline-block px-2.5 py-1 rounded-lg bg-[#292929] text-white font-mono text-[10px] font-bold uppercase tracking-wider">
              SOLD OUT
            </span>
          ) : discountPct > 0 ? (
            <span className="inline-block px-2.5 py-1 rounded-lg bg-white text-[#0A0A0A] font-mono text-[10px] font-bold uppercase tracking-wider">
              -{discountPct}%
            </span>
          ) : product.new_arrival ? (
            <span className="inline-block px-2.5 py-1 rounded-lg bg-[#0A0A0A]/90 border border-[#292929] text-white font-mono text-[10px] font-bold uppercase tracking-wider">
              NEW
            </span>
          ) : null}
        </div>

        {/* Bottom-Left: Product Title, Price & Rating */}
        <div className="absolute bottom-3 left-3 right-14 sm:bottom-3.5 sm:left-3.5 sm:right-16 z-10 space-y-0.5 sm:space-y-1">
          <h3 className="text-[13px] sm:text-[15px] font-semibold text-white leading-snug line-clamp-1">
            {product.name}
          </h3>
          <div className="flex flex-wrap items-baseline gap-1.5 sm:gap-2 font-mono tabular-nums">
            <span className="text-[13px] sm:text-sm font-bold text-white">
              {formatBDT(product.price)}
            </span>
            {product.compare_at_price && product.compare_at_price > product.price && (
              <span className="text-[10.5px] sm:text-[11px] text-[#D9D9D9]/85 line-through">
                {formatBDT(product.compare_at_price)}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1 text-[10.5px] sm:text-[11px] text-[#D9D9D9] font-mono">
            <Star className="h-3 w-3 fill-white text-white" />
            <span>{product.rating.toFixed(1)}</span>
            <span className="text-[#C4C0B8]">({product.reviews_count})</span>
          </div>
        </div>
      </Link>

      {/* Top-Right: Frosted Wishlist Heart Toggle */}
      <button
        type="button"
        onClick={handleWishlist}
        aria-label={wishlisted ? `Remove ${product.name} from wishlist` : `Save ${product.name} to wishlist`}
        className={`btn-base btn-icon absolute top-2.5 right-2.5 sm:top-3 sm:right-3 z-20 frosted-glass border border-[#D4D3CE] text-[#0A0A0A] hover:border-[#0A0A0A] ${
          wishlisted ? 'badge-pop' : ''
        }`}
      >
        <Heart className="h-4 w-4" strokeWidth={1.85} fill={wishlisted ? '#0A0A0A' : 'none'} />
      </button>

      {/* Bottom-Right: Crisp White Quick Add-to-Cart Bag Button */}
      <button
        type="button"
        disabled={product.inventory <= 0}
        onClick={handleQuickAdd}
        aria-label={`Add ${product.name} to bag`}
        className="btn-base btn-icon absolute bottom-2.5 right-2.5 sm:bottom-3 sm:right-3 z-20 bg-white text-[#0A0A0A] border border-white/80 shadow-sm hover:bg-[#F3F2EE]"
      >
        <ShoppingBag className="h-4 w-4" strokeWidth={2} />
      </button>
    </article>
  );
};
