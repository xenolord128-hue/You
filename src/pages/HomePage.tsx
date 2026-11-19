import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Award,
  Instagram,
  MessageCircle,
  RotateCcw,
  Share2,
  ShieldCheck,
  Shirt,
  Truck,
} from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { SeoHead } from '../components/SeoHead';
import { BrandLogo } from '../components/BrandLogo';
import { Reveal } from '../components/Motion';
import { EDITORIAL_MEDIA } from '../config/storeConfig';
import { formatBDT, sanitizeExternalHref, sanitizeMediaUrl } from '../lib/formatters';

interface EditorialCategoryTile {
  id: string;
  title: string;
  cta: string;
  to: string;
  image: string;
  objectPos?: string;
}

const CATEGORY_TILES: EditorialCategoryTile[] = [
  {
    id: 'tile-tshirts',
    title: 'T-SHIRTS & POLOS',
    cta: 'Shop Now',
    to: '/shop?category=T-Shirt',
    image: EDITORIAL_MEDIA.prodKnitPolo,
    objectPos: 'object-center',
  },
  {
    id: 'tile-collections',
    title: 'COLLECTIONS',
    cta: 'Shop Now',
    to: '/winter-collection',
    image: EDITORIAL_MEDIA.catShoes,
    objectPos: 'object-center',
  },
  {
    id: 'tile-accessories',
    title: 'ACCESSORIES',
    cta: 'Shop Now',
    to: '/shop?category=Watches',
    image: EDITORIAL_MEDIA.catAccessories,
    objectPos: 'object-center',
  },
  {
    id: 'tile-new-arrivals',
    title: 'NEW ARRIVALS',
    cta: 'Shop Now',
    to: '/new-arrivals',
    image: EDITORIAL_MEDIA.prodDenimJeans,
    objectPos: 'object-center',
  },
];

const BENEFIT_ITEMS = [
  {
    icon: Truck,
    title: 'FAST SHIPPING',
    subtitle: 'Nationwide Delivery',
  },
  {
    icon: ShieldCheck,
    title: 'SECURE PAYMENTS',
    subtitle: 'Shop with Confidence',
  },
  {
    icon: RotateCcw,
    title: 'EASY RETURNS',
    subtitle: '7-Day Size Exchange',
  },
  {
    icon: Award,
    title: 'PREMIUM QUALITY',
    subtitle: 'Built to Last',
  },
];

export const HomePage: React.FC = () => {
  const { products, productsLoading, settings } = useStore();
  const [brokenImg, setBrokenImg] = useState<Record<string, boolean>>({});

  const featuredProducts = useMemo(() => {
    const marked = products.filter((p) => p.featured);
    const pool = marked.length >= 5 ? marked : [...marked, ...products.filter((p) => !p.featured)];
    return pool.slice(0, 5);
  }, [products]);

  const cleanWa = settings.whatsappNumber.replace(/\D/g, '');
  const waHref = `https://wa.me/${cleanWa || '8801XXXXXXXXX'}?text=${encodeURIComponent(
    'Hello PYTHOX WORLD, I would like to explore the latest menswear drop.'
  )}`;

  const heroImgSrc = sanitizeMediaUrl(
    settings.heroImageUrl,
    EDITORIAL_MEDIA.heroCampaign
  );

  useEffect(() => {
    setBrokenImg((prev) => (prev.hero ? { ...prev, hero: false } : prev));
  }, [heroImgSrc]);

  const markBroken = (id: string) => {
    setBrokenImg((prev) => ({ ...prev, [id]: true }));
  };

  return (
    <div className="bg-[#F3F2EE] text-[#0A0A0A] overflow-x-clip">
      <SeoHead
        title="PYTHOX WORLD — Men's Streetwear & Fashion Archive"
        description="PYTHOX WORLD — Premium men's streetwear & tailored menswear crafted in small batches across Bangladesh."
      />

      {/* ================= 1. CINEMATIC CAMPAIGN HERO ================= */}
      <section className="relative w-full bg-[#0B0B0B] text-white overflow-hidden">
        <div className="relative mx-auto max-w-[1600px] min-h-[470px] sm:min-h-[540px] lg:min-h-[600px] flex flex-col justify-end md:justify-center">
          {/* Dominant Full-Color Menswear Campaign Photograph */}
          <div className="absolute inset-0 z-[1]">
            {!brokenImg.hero ? (
              <img
                key={heroImgSrc}
                src={heroImgSrc}
                alt="PYTHOX WORLD Men's Streetwear Campaign"
                referrerPolicy="no-referrer"
                onError={() => markBroken('hero')}
                className="h-full w-full object-cover object-[66%_16%] md:object-[58%_16%] contrast-[1.03]"
              />
            ) : (
              <div className="h-full w-full bg-[#121212]" />
            )}

            {/* Focused Text-Area Contrast Scrims (keeps hero vivid & colorful) */}
            <div
              aria-hidden="true"
              className="hidden md:block absolute inset-0 bg-gradient-to-r from-[#0A0A0A]/80 via-[#0A0A0A]/35 to-transparent"
            />
            <div
              aria-hidden="true"
              className="md:hidden absolute inset-x-0 bottom-0 h-3/4 bg-gradient-to-t from-[#0A0A0A]/85 via-[#0A0A0A]/35 to-transparent"
            />
          </div>

          {/* Left Editorial Poster Copy & Primary CTA */}
          <div className="relative z-10 w-full max-w-[1400px] mx-auto px-5 sm:px-8 lg:px-12 py-10 sm:py-14 md:py-24 flex items-end md:items-center justify-between gap-8">
            <div className="max-w-[390px] space-y-4 sm:space-y-5">
              <p className="font-mono text-[10.5px] sm:text-[11px] uppercase tracking-[0.24em] text-[#D4D4D3]">
                STREETWEAR / CULTURE / YOU
              </p>

              <h1 className="font-street font-bold uppercase text-white tracking-[-0.025em] leading-[0.96] text-[clamp(2.5rem,5.2vw,4.1rem)]">
                BUILT FOR
                <br />
                THE REAL
                <br />
                ONES.
              </h1>

              <p className="text-[13px] sm:text-[14px] text-[#D9D9D9]/90 leading-[1.6] max-w-[330px]">
                More than clothing — it&apos;s a mindset. PYTHOX WORLD is for the
                dreamers, the doers, and the ones who stay solid.
              </p>

              <div className="pt-2">
                <Link
                  to="/shop"
                  className="btn-base btn-outline-light group gap-5"
                >
                  <span>SHOP NOW</span>
                  <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" />
                </Link>
              </div>
            </div>

            {/* Bottom-Right Subtle Edition Coordinates */}
            <div className="hidden md:flex flex-col items-end self-end text-right font-mono text-[10px] uppercase tracking-[0.2em] text-white/65 space-y-1.5">
              <span>EST. 2024</span>
              <span className="tabular-nums text-white/50">23.8583° N</span>
              <div className="flex items-center gap-3">
                <span className="h-[1px] w-7 bg-white/40" />
                <span className="tabular-nums text-white/50">90.2667° E</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ================= 2. 4-CARD EDITORIAL CATEGORY TILES ================= */}
      <section className="mx-auto max-w-[1400px] px-4 sm:px-8 lg:px-12 py-8 sm:py-11">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-5">
          {CATEGORY_TILES.map((tile) => (
            <Link
              key={tile.id}
              to={tile.to}
              className="group relative aspect-[4/5] sm:aspect-[4/3] bg-[#141414] overflow-hidden block"
            >
              {!brokenImg[tile.id] ? (
                <img
                  src={tile.image}
                  alt={tile.title}
                  loading="lazy"
                  referrerPolicy="no-referrer"
                  onError={() => markBroken(tile.id)}
                  className={`h-full w-full object-cover ${tile.objectPos || 'object-center'} transition-transform duration-500 ease-out [@media(hover:hover)]:group-hover:scale-[1.04]`}
                />
              ) : (
                <div className="h-full w-full flex items-center justify-center bg-[#181818] text-white/60">
                  <Shirt className="h-8 w-8" />
                </div>
              )}

              <div
                aria-hidden="true"
                className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/75 via-black/25 to-transparent pointer-events-none"
              />

              <div className="absolute inset-x-4 bottom-4 sm:inset-x-5 sm:bottom-5 z-10 space-y-1">
                <h2 className="font-street font-bold uppercase text-white text-sm sm:text-[17px] tracking-[0.06em] leading-tight">
                  {tile.title}
                </h2>
                <span className="inline-flex items-center gap-1.5 text-[11px] sm:text-xs font-medium text-[#D9D9D9] group-hover:text-white transition-colors">
                  <span>{tile.cta}</span>
                  <ArrowRight className="h-3 w-3 transition-transform duration-200 group-hover:translate-x-1" />
                </span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* ================= 3. NEW ARRIVALS / FRESH DROPS SPLIT CAMPAIGN ================= */}
      <Reveal>
        <section className="w-full bg-[#EAE9E4] border-y border-[#DCDBD6]">
          <div className="mx-auto max-w-[1400px] grid grid-cols-1 lg:grid-cols-12 items-stretch">
            {/* LEFT: Editorial Copy + View All CTA */}
            <div className="lg:col-span-4 px-5 sm:px-8 lg:px-12 py-10 sm:py-12 lg:py-16 flex flex-col justify-center space-y-4">
              <p className="font-mono text-[10.5px] sm:text-[11px] uppercase tracking-[0.22em] text-[#4A4A4A] font-medium">
                NEW ARRIVALS
              </p>

              <h2 className="font-street font-bold uppercase text-[#0A0A0A] leading-[0.95] tracking-[-0.025em] text-[clamp(2.3rem,4.5vw,3.4rem)]">
                FRESH
                <br />
                DROPS
              </h2>

              <p className="text-[13px] sm:text-sm text-[#404040] leading-[1.6] max-w-[270px]">
                The latest pieces from PYTHOX WORLD. Small-batch heavyweight cotton.
                Limited stock. Don&apos;t miss out.
              </p>

              <div className="pt-2">
                <Link
                  to="/new-arrivals"
                  className="btn-base btn-primary group gap-4"
                >
                  <span>VIEW ALL</span>
                  <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" />
                </Link>
              </div>
            </div>

            {/* CENTER: Blended Lifestyle Editorial Photo */}
            <div className="lg:col-span-5 relative min-h-[320px] sm:min-h-[380px] lg:min-h-[420px] bg-[#DCDAD4] overflow-hidden">
              {!brokenImg.freshDrops ? (
                <img
                  src={EDITORIAL_MEDIA.catMen}
                  alt="PYTHOX WORLD Fresh Drops Menswear"
                  loading="lazy"
                  referrerPolicy="no-referrer"
                  onError={() => markBroken('freshDrops')}
                  className="h-full w-full object-cover object-[50%_14%] contrast-[1.03]"
                />
              ) : (
                <div className="h-full w-full bg-[#DCDAD4]" />
              )}

              {/* Smooth Desktop Side Feather Blending into #EAE9E4 */}
              <div
                aria-hidden="true"
                className="hidden lg:block absolute inset-y-0 left-0 w-28 bg-gradient-to-r from-[#EAE9E4] via-[#EAE9E4]/55 to-transparent pointer-events-none"
              />
              <div
                aria-hidden="true"
                className="hidden lg:block absolute inset-y-0 right-0 w-28 bg-gradient-to-l from-[#EAE9E4] via-[#EAE9E4]/55 to-transparent pointer-events-none"
              />
            </div>

            {/* RIGHT: Campaign Manifesto + Stylized Script Wordmark */}
            <div className="lg:col-span-3 px-5 sm:px-8 lg:px-10 py-8 sm:py-10 lg:py-16 flex flex-col justify-center items-start lg:items-end text-left lg:text-right space-y-5">
              <div className="space-y-1 font-street uppercase text-[#0A0A0A] tracking-[0.06em] text-[15px] sm:text-[17px] leading-[1.35] font-medium">
                <p>SAME MINDSET.</p>
                <p>DIFFERENT</p>
                <p>ENERGY.</p>
              </div>

              <div className="h-[1px] w-14 bg-[#0A0A0A]/45" aria-hidden="true" />

              {/* Signature Script Mark */}
              <div className="-rotate-6 select-none pt-1" aria-label="Pythox signature">
                <span className="font-editorial italic font-bold text-2xl sm:text-[28px] text-[#0A0A0A] tracking-tight underline decoration-1 underline-offset-4">
                  Pythox
                </span>
              </div>
            </div>
          </div>
        </section>
      </Reveal>

      {/* ================= 4. TRUST / BRAND BENEFITS STRIP ================= */}
      <Reveal>
        <section className="w-full bg-[#F7F6F3] border-b border-[#E2E1DC]">
          <div className="mx-auto max-w-[1400px] px-5 sm:px-8 lg:px-12 py-7 sm:py-9 grid grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-8">
            {BENEFIT_ITEMS.map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.title} className="flex items-center gap-3.5 sm:gap-4">
                  <Icon
                    className="h-6 w-6 sm:h-7 sm:w-7 text-[#0A0A0A] shrink-0"
                    strokeWidth={1.35}
                  />
                  <div className="min-w-0">
                    <p className="font-street text-[11px] sm:text-xs font-bold uppercase tracking-[0.12em] text-[#0A0A0A] leading-snug">
                      {item.title}
                    </p>
                    <p className="text-[11px] sm:text-xs text-[#6A6A6A] truncate mt-0.5">
                      {item.subtitle}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </Reveal>

      {/* ================= 5. FEATURED PRODUCTS (5-ITEM ROW) ================= */}
      <Reveal>
        <section className="mx-auto max-w-[1400px] px-4 sm:px-8 lg:px-12 py-12 sm:py-16">
          <div className="flex items-center justify-between gap-4 mb-6 sm:mb-8">
            <h2 className="font-street text-xs sm:text-[13px] font-semibold uppercase tracking-[0.22em] text-[#0A0A0A]">
              FEATURED PRODUCTS
            </h2>
            <Link
              to="/shop"
              className="btn-base btn-secondary btn-sm group"
            >
              <span>VIEW ALL</span>
              <ArrowRight className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-1" />
            </Link>
          </div>

          {productsLoading && featuredProducts.length === 0 ? (
            <div
              className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5 sm:gap-5"
              aria-busy="true"
              aria-label="Loading featured products"
            >
              {[0, 1, 2, 3, 4].map((slot) => (
                <div key={slot} className="space-y-3 animate-pulse">
                  <div className="aspect-square bg-[#E4E3DF]" />
                  <div className="space-y-1.5">
                    <div className="h-3.5 w-3/4 bg-[#E4E3DF]" />
                    <div className="h-3 w-1/3 bg-[#E4E3DF]" />
                  </div>
                </div>
              ))}
            </div>
          ) : featuredProducts.length === 0 ? (
            <div className="border border-[#DCDBD6] bg-[#EAE9E4] px-6 py-14 text-center">
              <p className="font-street text-sm sm:text-base font-semibold uppercase tracking-[0.14em] text-[#0A0A0A]">
                No products available at the moment.
              </p>
              <p className="mt-2 text-xs text-[#555555]">
                New pieces added and published from the store catalog will appear here.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5 sm:gap-5">
              {featuredProducts.map((product) => {
                const imgSrc = product.primaryImage || product.images[0] || '';
                return (
                  <Link
                    key={product.id}
                    to={`/product/${product.slug}`}
                    className="group block"
                  >
                    <div className="aspect-square bg-[#E8E7E3] overflow-hidden relative">
                      {imgSrc && !brokenImg[product.id] ? (
                        <img
                          src={imgSrc}
                          alt={product.name}
                          loading="lazy"
                          referrerPolicy="no-referrer"
                          onError={() => markBroken(product.id)}
                          className="h-full w-full object-cover object-center transition-transform duration-500 ease-out [@media(hover:hover)]:group-hover:scale-[1.03]"
                        />
                      ) : (
                        <div className="h-full w-full flex flex-col items-center justify-center bg-[#E4E3DF] text-[#6A6A6A] p-4 text-center">
                          <Shirt className="h-6 w-6 mb-1.5" />
                          <span className="text-xs font-medium text-[#0A0A0A]">
                            {product.name}
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="pt-3 flex items-end justify-between gap-2">
                      <div className="min-w-0">
                        <h3 className="text-[12.5px] sm:text-[13px] font-medium text-[#0A0A0A] leading-snug line-clamp-1">
                          {product.name}
                        </h3>
                        <p className="font-mono text-[11.5px] text-[#555555] tabular-nums mt-0.5">
                          {formatBDT(product.price)}
                        </p>
                      </div>
                      <ArrowRight className="h-3.5 w-3.5 text-[#0A0A0A] shrink-0 mb-0.5 transition-transform duration-200 group-hover:translate-x-1" />
                    </div>
                  </Link>
                );
              })}
              {/* 6th Balanced Archive Tile on Mobile/Tablet (hidden on Desktop 5-col row) */}
              <Link
                to="/shop"
                className="lg:hidden group block"
              >
                <div className="aspect-square bg-[#0A0A0A] text-white p-5 flex flex-col justify-between transition-colors group-hover:bg-[#191919]">
                  <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-white/60">
                    ARCHIVE
                  </span>
                  <div className="space-y-1.5">
                    <p className="font-street text-lg font-bold uppercase leading-[1.02] tracking-[-0.01em]">
                      ALL PIECES
                    </p>
                    <span className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.18em] text-[#D4D4D3]">
                      <span>EXPLORE</span>
                      <ArrowRight className="h-3 w-3 transition-transform duration-200 group-hover:translate-x-1" />
                    </span>
                  </div>
                </div>
                <div className="pt-3 flex items-end justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[12.5px] sm:text-[13px] font-medium text-[#0A0A0A] leading-snug">
                      Full Catalog
                    </p>
                    <p className="font-mono text-[11.5px] text-[#555555] mt-0.5">
                      {products.length} Pieces
                    </p>
                  </div>
                  <ArrowRight className="h-3.5 w-3.5 text-[#0A0A0A] shrink-0 mb-0.5 transition-transform duration-200 group-hover:translate-x-1" />
                </div>
              </Link>
            </div>
          )}
        </section>
      </Reveal>

      {/* ================= 6. FINAL DARK BRAND CAMPAIGN CLOSING BAND ================= */}
      <section className="relative bg-[#0A0A0A] text-white overflow-hidden border-t border-[#1F1F1F]">
        {/* Atmospheric Low-Key Background Photo */}
        <img
          src={EDITORIAL_MEDIA.prodBomberJacket}
          alt=""
          aria-hidden="true"
          loading="lazy"
          referrerPolicy="no-referrer"
          className="absolute inset-0 h-full w-full object-cover object-center opacity-25 pointer-events-none"
        />
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-gradient-to-r from-[#0A0A0A] via-[#0A0A0A]/85 to-[#0A0A0A]/90 pointer-events-none"
        />

        <div className="relative z-10 mx-auto max-w-[1400px] px-5 sm:px-8 lg:px-12 py-12 sm:py-16 flex flex-col md:flex-row md:items-center justify-between gap-8">
          {/* Brand Wordmark Lockup */}
          <div className="flex items-center gap-4">
            <BrandLogo className="h-10 w-10" zoomOnly />
            <span className="h-7 w-[1px] bg-white/25" aria-hidden="true" />
            <span className="font-street text-base sm:text-lg font-semibold uppercase tracking-[0.26em] text-white whitespace-nowrap">
              PYTHOX WORLD
            </span>
          </div>

          {/* Closing Campaign Manifesto */}
          <div className="font-mono text-[11px] sm:text-xs uppercase tracking-[0.2em] text-[#D4D4D3] leading-relaxed">
            <p>ROOTED IN CULTURE.</p>
            <p className="text-white/75">BUILT FOR TOMORROW.</p>
          </div>

          {/* Social Links & Movement CTA */}
          <div className="flex flex-col items-start md:items-end gap-3">
            <div className="flex items-center gap-2 text-white/85">
              <a
                href={sanitizeExternalHref(settings.instagramUrl, 'https://instagram.com/pythoxworld')}
                target="_blank"
                rel="noreferrer"
                aria-label="Instagram"
                className="btn-base btn-dark-ghost btn-icon"
              >
                <Instagram className="h-4 w-4" />
              </a>
              <a
                href={sanitizeExternalHref(settings.facebookUrl, 'https://facebook.com/pythoxworld')}
                target="_blank"
                rel="noreferrer"
                aria-label="Facebook"
                className="btn-base btn-dark-ghost btn-icon"
              >
                <Share2 className="h-4 w-4" />
              </a>
              <a
                href={waHref}
                target="_blank"
                rel="noreferrer"
                aria-label="WhatsApp"
                className="btn-base btn-dark-ghost btn-icon"
              >
                <MessageCircle className="h-4 w-4" />
              </a>
            </div>
            <Link
              to="/shop"
              className="btn-base btn-inverted btn-sm group"
            >
              <span>JOIN THE MOVEMENT</span>
              <ArrowRight className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-1" />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
};
