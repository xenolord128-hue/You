import React from 'react';
import { Link, useParams } from 'react-router-dom';
import { useStore } from '../context/StoreContext';
import { ProductCard } from '../components/ProductCard';
import { SeoHead } from '../components/SeoHead';
import { sanitizeMediaUrl } from '../lib/formatters';
import { EDITORIAL_MEDIA } from '../config/storeConfig';

export const CollectionPage: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const { collections, products } = useStore();

  const currentCollection =
    collections.find((c) => c.slug === slug) || collections[0];

  const matchingProducts = products.filter(
    (p) =>
      p.collection === currentCollection?.slug ||
      (currentCollection?.slug === 'winter-collection' && p.winter_collection)
  );
  const displayed = matchingProducts;

  return (
    <main>
      <SeoHead
        title={`${currentCollection?.title || 'Collections'} — PYTHOX WORLD`}
        description={
          currentCollection?.description ||
          "Curated PYTHOX WORLD men's capsule collections."
        }
      />

      {/* Editorial Hero */}
      <section className="relative h-[340px] sm:h-[420px] w-full overflow-hidden bg-[#0A0A0A]">
        <img
          src={sanitizeMediaUrl(currentCollection?.hero_image, EDITORIAL_MEDIA.heroCampaign)}
          alt={currentCollection?.title}
          referrerPolicy="no-referrer"
          className="h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0A0A0A]/85 via-[#0A0A0A]/45 to-[#0A0A0A]/20" />
        <div className="absolute inset-0 mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-10 flex flex-col justify-end pb-10 sm:pb-14">
          <p className="text-[11px] font-mono font-semibold uppercase tracking-[0.2em] text-[#D9D9D9]">
            PYTHOX WORLD Capsule
          </p>
          <h1 className="mt-2 text-3xl sm:text-5xl font-editorial font-semibold text-white">
            {currentCollection?.title}
          </h1>
          <p className="mt-3 text-sm sm:text-base text-[#D9D9D9] max-w-xl">
            {currentCollection?.description}
          </p>
        </div>
      </section>

      {/* Collection Switcher */}
      <div className="border-b border-[#D9D9D9] bg-[#EAE9E4]">
        <div className="mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-10 py-3.5 flex items-center gap-2.5 overflow-x-auto no-scrollbar">
          {collections.map((c) => (
            <Link
              key={c.id}
              to={`/collection/${c.slug}`}
              className={`chip-btn whitespace-nowrap ${
                c.slug === currentCollection?.slug ? 'chip-btn-active' : ''
              }`}
            >
              {c.title}
            </Link>
          ))}
        </div>
      </div>

      {/* Product Grid */}
      <section className="mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-10 py-10 lg:py-16 pb-20 sm:pb-16">
        {displayed.length === 0 ? (
          <div className="rounded-3xl border border-[#D9D9D9] bg-[#EAE9E4] p-10 sm:p-12 text-center space-y-4">
            <p className="text-lg font-editorial font-medium text-[#0A0A0A]">
              No products available at the moment.
            </p>
            <Link
              to="/shop"
              className="btn-base btn-primary"
            >
              Browse Shop
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3.5 gap-y-7 sm:gap-x-6 sm:gap-y-10">
            {displayed.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        )}
      </section>
    </main>
  );
};
