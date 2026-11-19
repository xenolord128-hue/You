import React from 'react';
import { Link } from 'react-router-dom';
import { Heart, Trash2 } from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { formatBDT } from '../lib/formatters';
import { SeoHead } from '../components/SeoHead';

export const WishlistPage: React.FC = () => {
  const { products, wishlist, toggleWishlist, addToCart } = useStore();
  const saved = products.filter((p) => wishlist.includes(p.id));

  return (
    <main className="mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-10 py-6 sm:py-8 lg:py-12">
      <SeoHead
        title="Wishlist — PYTHOX WORLD"
        description="Your saved PYTHOX WORLD men's fashion pieces."
      />

      <div className="border-b border-[#D9D9D9] pb-6">
        <p className="text-[11px] font-mono font-semibold uppercase tracking-[0.2em] text-[#5C5C5C]">
          Saved Edit
        </p>
        <h1 className="mt-1 text-3xl sm:text-4xl font-editorial font-semibold text-[#0A0A0A]">
          Wishlist ({saved.length})
        </h1>
      </div>

      {saved.length === 0 ? (
        <div className="mt-8 rounded-3xl border border-[#D9D9D9] bg-[#EAE9E4] py-14 px-6 text-center">
          <Heart className="h-7 w-7 mx-auto text-[#5C5C5C] mb-3" strokeWidth={1.35} />
          <p className="font-editorial text-2xl text-[#0A0A0A]">
            No saved pieces yet
          </p>
          <p className="mt-2 text-sm text-[#292929]">
            Tap the heart icon on any men&apos;s garment or accessory to save it here.
          </p>
          <Link
            to="/shop"
            className="mt-6 btn-base btn-primary"
          >
            Explore Shop
          </Link>
        </div>
      ) : (
        <div className="mt-8 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3.5 sm:gap-6">
          {saved.map((product) => (
            <article key={product.id} className="flex flex-col rounded-2xl sm:rounded-3xl overflow-hidden bg-white border border-[#D9D9D9] hover:border-[#0A0A0A] transition-colors">
              <Link
                to={`/product/${product.slug}`}
                className="aspect-[3/4] bg-[#EAE9E4] overflow-hidden block"
              >
                <img
                  src={product.images[0]}
                  alt={product.name}
                  referrerPolicy="no-referrer"
                  className="h-full w-full object-cover hover:scale-[1.03] transition-transform duration-300"
                />
              </Link>
              <div className="p-3.5 sm:p-4 flex-1 flex flex-col justify-between gap-3">
                <div>
                  <p className="text-[10.5px] font-mono uppercase tracking-[0.12em] text-[#5C5C5C]">
                    {product.category} · {product.inventory > 0 ? 'In Stock' : 'Out of Stock'}
                  </p>
                  <Link
                    to={`/product/${product.slug}`}
                    className="mt-1 block text-sm font-medium text-[#0A0A0A] hover:underline truncate"
                  >
                    {product.name}
                  </Link>
                  <p className="mt-1 text-sm font-mono font-semibold tabular-nums text-[#0A0A0A]">
                    {formatBDT(product.price)}
                  </p>
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    disabled={product.inventory <= 0}
                    onClick={() =>
                      addToCart(product, {
                        color: product.colors[0]?.name || 'Black',
                        size: product.sizes[0] || 'M',
                        quantity: 1,
                      })
                    }
                    className="btn-base btn-primary btn-sm flex-1"
                  >
                    Add to Bag
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleWishlist(product.id)}
                    aria-label={`Remove ${product.name}`}
                    className="btn-base btn-secondary btn-icon min-h-[36px] min-w-[36px] text-[#5C5C5C] hover:text-[#0A0A0A]"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </main>
  );
};
