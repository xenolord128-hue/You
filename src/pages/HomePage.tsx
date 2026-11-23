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
import {
  EDITORIAL_MEDIA,
  HERO_CAMPAIGN_FALLBACK_URL,
  HERO_CAMPAIGN_URL,
  MOBILE_HERO_CAMPAIGN_FALLBACK_URL,
  MOBILE_HERO_CAMPAIGN_URL,
} from '../config/storeConfig';
import { formatBDT, sanitizeExternalHref, sanitizeMediaUrl } from '../lib/formatters';
import { trackPixelEvent } from '../lib/metaPixel';

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
    to: '/category/t-shirts-polo-shirts',
    image: EDITORIAL_MEDIA.prodKnitPolo,
    objectPos: 'object-center',
  },
  {
    id: 'tile-hoodies',
    title: 'HOODIES & JACKETS',
    cta: 'Shop Now',
    to: '/category/hoodies-jackets',
    image: EDITORIAL_MEDIA.prodHoodieCharcoal,
    objectPos: 'object-center',
  },
  {
    id: 'tile-watches',
    title: 'WATCHES & ACCESSORIES',
    cta: 'Shop Now',
    to: '/category/watches',
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
  const { products, productsLoading, productsError, refreshProducts, settings } = useStore();
  const [brokenImg, setBrokenImg] = useState<Record<string, boolean>>({});

  const featuredProducts = useMemo(() => {
    const marked = products.filter((p) => p.featured);
    const pool = marked.length >= 5 ? marked : [...marked, ...products.filter((p) => !p.featured)];
    return pool.slice(0, 5);
  }, [products]);

  const cleanWa = settings.whatsappNumber.replace(/\D/g, '');
  const waHref = `https://wa.me/${cleanWa || '8801887602095'}?text=${encodeURIComponent(
    'Hello PYTHOX WORLD, I would like to explore the latest menswear drop.'
  )}`;

  const [isMobileViewport, setIsMobileViewport] = useState<boolean>(() =>
    typeof window !== 'undefined' ? window.matchMedia('(max-width: 767px)').matches : false
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(max-width: 767px)');
    const onChange = (e: MediaQueryListEvent) => setIsMobileViewport(e.matches);
    setIsMobileViewport(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  const rawConfiguredHero = sanitizeMediaUrl(
    settings.heroImageUrl,
    HERO_CAMPAIGN_URL
  );
  const resolvedPrimaryHero =
    rawConfiguredHero.includes('i.ibb.co.com/JwC1M9WR/')
      ? HERO_CAMPAIGN_URL
      : rawConfiguredHero;
  const [heroUseFallback, setHeroUseFallback] = useState(false);
  const heroImgSrc = heroUseFallback ? HERO_CAMPAIGN_FALLBACK_URL : resolvedPrimaryHero;

  const [mobileHeroUseFallback, setMobileHeroUseFallback] = useState(false);
  const resolvedPrimaryMobileHero = sanitizeMediaUrl(
    settings.mobileHeroImageUrl,
    MOBILE_HERO_CAMPAIGN_URL
  );
  const mobileHeroImgSrc = mobileHeroUseFallback
    ? MOBILE_HERO_CAMPAIGN_FALLBACK_URL
    : resolvedPrimaryMobileHero;

  useEffect(() => {
    setHeroUseFallback(false);
    setBrokenImg((prev) => (prev.hero ? { ...prev, hero: false } : prev));
  }, [resolvedPrimaryHero]);

  useEffect(() => {
    setMobileHeroUseFallback(false);
    setBrokenImg((prev) => (prev.mobileHero ? { ...prev, mobileHero: false } : prev));
  }, [resolvedPrimaryMobileHero]);

  const handleHeroImgError = () => {
    if (!heroUseFallback && heroImgSrc !== HERO_CAMPAIGN_FALLBACK_URL) {
      setHeroUseFallback(true);
      return;
    }
    markBroken('hero');
  };

  const handleMobileHeroImgError = () => {
    if (!mobileHeroUseFallback && mobileHeroImgSrc !== MOBILE_HERO_CAMPAIGN_FALLBACK_URL) {
      setMobileHeroUseFallback(true);
      return;
    }
    markBroken('mobileHero');
  };

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
      <section className="relative w-full bg-[#060814] text-white overflow-hidden">
        {!isMobileViewport ? (
          /* Desktop & Tablet Wide Cinematic 16:9 Composition (Existing Desktop Hero Image Preserved) */
          <div className="flex relative mx-auto max-w-[1600px] aspect-[16/9] min-h-[540px] max-h-[780px] w-full items-center pt-16 bg-[#0B0B0B]">
            <div className="absolute inset-0 z-[1]">
              {!brokenImg.hero ? (
                <img
                  key={`desktop-${heroImgSrc}`}
                  src={heroImgSrc}
                  alt="PYTHOX WORLD Men's Streetwear Campaign"
                  loading="eager"
                  decoding="async"
                  fetchPriority="high"
                  referrerPolicy="no-referrer"
                  onError={handleHeroImgError}
                  className="h-full w-full object-cover object-[62%_20%]"
                />
              ) : (
                <div className="h-full w-full bg-[#121212]" />
              )}

              {/* Left Editorial Contrast Scrim for Text Legibility */}
              <div
                aria-hidden="true"
                className="absolute inset-y-0 left-0 w-3/4 bg-gradient-to-r from-[#0A0A0A]/82 via-[#0A0A0A]/36 to-transparent pointer-events-none"
              />
            </div>

            <div className="relative z-10 w-full max-w-[1400px] mx-auto px-8 lg:px-12 py-14 flex items-center justify-between gap-8">
              <div className="max-w-[400px] space-y-5">
                <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-[#D4D4D3]">
                  STREETWEAR / CULTURE / YOU
                </p>

                <h1 className="font-street font-bold uppercase text-white tracking-[-0.025em] leading-[0.95] text-[clamp(2.75rem,4.8vw,4.15rem)]">
                  BUILT FOR
                  <br />
                  THE REAL
                  <br />
                  ONES.
                </h1>

                <p className="text-[14px] text-[#E4E4E2]/90 leading-[1.6] max-w-[340px]">
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

              <div className="flex flex-col items-end self-end text-right font-mono text-[10px] uppercase tracking-[0.2em] text-white/70 space-y-1.5">
                <span>EST. 2024</span>
                <span className="tabular-nums text-white/55">23.8583° N</span>
                <div className="flex items-center gap-3">
                  <span className="h-[1px] w-7 bg-white/40" />
                  <span className="tabular-nums text-white/55">90.2667° E</span>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* Dedicated Mobile Responsive Layout (4:5 aspect ratio with overlay inside, zero empty space below) */
          <div className="relative w-full aspect-[4/5] overflow-hidden bg-[#060814]">
            {!brokenImg.mobileHero ? (
              <img
                key={`mobile-${mobileHeroImgSrc}`}
                src={mobileHeroImgSrc}
                alt="PYTHOX WORLD Men's Streetwear Campaign"
                loading="eager"
                decoding="sync"
                fetchPriority="high"
                referrerPolicy="no-referrer"
                onError={handleMobileHeroImgError}
                className="h-full w-full object-cover object-[50%_40%]"
              />
            ) : (
              <div className="h-full w-full bg-[#0B0E24]" />
            )}

            {/* Subtle top-left & header vignette for crisp text legibility */}
            <div
              aria-hidden="true"
              className="absolute inset-x-0 top-0 h-[52%] bg-gradient-to-b from-[#040611]/78 via-[#040611]/38 to-transparent pointer-events-none"
            />

            {/* Subtle bottom floor scrim for SHOP NOW CTA */}
            <div
              aria-hidden="true"
              className="absolute inset-x-0 bottom-0 h-[26%] bg-gradient-to-t from-[#040611]/88 via-[#040611]/40 to-transparent pointer-events-none"
            />

            {/* Upper-Left Overlaid Hero Copy in Empty Studio Space */}
            <div className="absolute top-[82px] sm:top-[96px] left-3.5 sm:left-6 z-10 w-[50%] sm:w-[49%] max-w-[205px] sm:max-w-[260px] space-y-1 sm:space-y-1.5">
              <p className="font-mono text-[8px] sm:text-[9.5px] uppercase tracking-[0.14em] sm:tracking-[0.2em] text-[#D4D4E6]">
                STREETWEAR / CULTURE / YOU
              </p>

              <h1 className="font-street font-bold uppercase text-white tracking-[-0.025em] leading-[0.94] text-[clamp(1.25rem,5.8vw,1.95rem)] drop-shadow-[0_2px_8px_rgba(4,6,17,0.65)]">
                BUILT FOR
                <br />
                THE REAL ONES.
              </h1>

              <p className="text-[10px] sm:text-[11.5px] text-[#E6E6F2]/90 leading-[1.34] drop-shadow-[0_1px_4px_rgba(4,6,17,0.75)]">
                More than clothing — it&apos;s a mindset. PYTHOX WORLD is for the
                dreamers, the doers, and the ones who stay solid.
              </p>
            </div>

            {/* Mobile-only decorative curved S-arrow guiding eye from hero copy to SHOP NOW */}
            <div
              aria-hidden="true"
              className="md:hidden pointer-events-none select-none absolute left-3.5 sm:left-6 top-[200px] sm:top-[212px] bottom-[58px] sm:bottom-[68px] w-[150px] sm:w-[168px] z-[9]"
            >
              <svg
                viewBox="0 0 120 180"
                fill="none"
                preserveAspectRatio="none"
                className="h-full w-full drop-shadow-[0_0_8px_rgba(167,139,250,0.34)]"
              >
                <defs>
                  <linearGradient id="mobileHeroArrowGrad" x1="62" y1="4" x2="54" y2="175" gradientUnits="userSpaceOnUse">
                    <stop offset="0%" stopColor="#C4B5FD" stopOpacity="0.30" />
                    <stop offset="45%" stopColor="#DDD6FE" stopOpacity="0.74" />
                    <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0.95" />
                  </linearGradient>
                </defs>
                <path
                  d="M 62 4 C 98 34, 96 76, 68 106 C 44 132, 46 154, 54 174"
                  stroke="url(#mobileHeroArrowGrad)"
                  strokeWidth="1.4"
                  strokeLinecap="round"
                  vectorEffect="non-scaling-stroke"
                />
                <path
                  d="M 47 166 L 54 174 L 61 166"
                  stroke="#FFFFFF"
                  strokeOpacity="0.95"
                  strokeWidth="1.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  vectorEffect="non-scaling-stroke"
                />
              </svg>
            </div>

            {/* Bottom CTA & Coordinates Bar */}
            <div className="absolute inset-x-0 bottom-0 z-10 px-3.5 sm:px-6 pb-3.5 sm:pb-5 flex items-center justify-between gap-2">
              <Link
                to="/shop"
                className="btn-base btn-outline-light !min-h-[38px] sm:!min-h-[42px] !px-4 sm:!px-5 !text-[10.5px] sm:!text-[11px] bg-[#060814]/55 backdrop-blur-sm group gap-3"
              >
                <span>SHOP NOW</span>
                <ArrowRight className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-1" />
              </Link>

              <span className="font-mono text-[8px] sm:text-[9px] uppercase tracking-[0.14em] text-white/55 tabular-nums whitespace-nowrap">
                EST. 2024 · 23.8583° N
              </span>
            </div>
          </div>
        )}
      </section>

      {/* ================= 2. 4-CARD EDITORIAL CATEGORY TILES (SINGLE 4-COL ROW ON ALL DEVICES) ================= */}
      <section className="mx-auto max-w-[1400px] px-3 sm:px-8 lg:px-12 py-4 sm:py-10 lg:py-12">
        <div className="grid grid-cols-4 gap-2 sm:gap-4 lg:gap-6">
          {CATEGORY_TILES.map((tile) => (
            <Link
              key={tile.id}
              to={tile.to}
              className="group relative aspect-square rounded-[12px] sm:rounded-[22px] lg:rounded-[26px] bg-[#141414] border border-black/10 ring-1 ring-inset ring-white/10 shadow-[0_10px_26px_rgba(10,10,10,0.08)] hover:shadow-[0_18px_38px_rgba(10,10,10,0.16)] hover:-translate-y-1 transition-all duration-300 overflow-hidden block"
            >
              {!brokenImg[tile.id] ? (
                <img
                  src={tile.image}
                  alt={tile.title}
                  loading="lazy"
                  referrerPolicy="no-referrer"
                  onError={() => markBroken(tile.id)}
                  className={`h-full w-full object-cover ${tile.objectPos || 'object-center'} transition-transform duration-500 ease-out [@media(hover:hover)]:group-hover:scale-[1.06]`}
                />
              ) : (
                <div className="h-full w-full flex items-center justify-center bg-[#181818] text-white/60">
                  <Shirt className="h-5 w-5 sm:h-8 sm:w-8" />
                </div>
              )}

              <div
                aria-hidden="true"
                className="absolute inset-x-0 bottom-0 h-[70%] sm:h-[58%] bg-gradient-to-t from-black/92 via-black/52 to-transparent pointer-events-none"
              />

              <div className="absolute inset-x-1.5 bottom-1.5 sm:inset-x-4 sm:bottom-4 lg:inset-x-5 lg:bottom-5 z-10 space-y-0.5 sm:space-y-1">
                <h2 className="font-street font-bold uppercase text-white drop-shadow-[0_1px_4px_rgba(0,0,0,0.85)] text-[8.5px] sm:text-[13px] lg:text-[17px] tracking-[0.02em] sm:tracking-[0.06em] leading-[1.1] sm:leading-tight">
                  {tile.title}
                </h2>
                <span className="inline-flex items-center gap-0.5 sm:gap-1.5 text-[7.5px] sm:text-[11px] lg:text-xs font-medium text-[#E0DFDB] drop-shadow-[0_1px_3px_rgba(0,0,0,0.85)] group-hover:text-white transition-colors">
                  <span>{tile.cta}</span>
                  <ArrowRight className="h-2 w-2 sm:h-3 sm:w-3 transition-transform duration-200 group-hover:translate-x-1" />
                </span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* ================= 3. NEW ARRIVALS / FRESH DROPS UNIFIED EDITORIAL BANNER ================= */}
      <Reveal>
        <section className="mx-auto max-w-[1400px] px-3 sm:px-8 lg:px-12 pb-8 sm:pb-12 pt-1 sm:pt-2">
          <div className="relative rounded-[18px] sm:rounded-[24px] lg:rounded-[28px] bg-[#EAE9E4] border border-[#DCDBD6] overflow-hidden">
            <div className="grid grid-cols-[minmax(0,1.12fr)_minmax(0,1.02fr)_minmax(0,0.88fr)] sm:grid-cols-[minmax(0,1.1fr)_minmax(0,1.15fr)_minmax(0,0.85fr)] lg:grid-cols-12 items-stretch min-h-[205px] sm:h-[290px] md:h-[330px] lg:h-[390px] xl:h-[430px]">
              {/* LEFT: Editorial Copy + View All CTA */}
              <div className="lg:col-span-4 relative z-10 pl-3 pr-1 py-4 sm:pl-7 sm:pr-3 sm:py-8 lg:pl-12 lg:pr-4 lg:py-12 flex flex-col justify-center items-start gap-1.5 sm:gap-3 lg:gap-4 min-w-0">
                <p className="font-mono text-[8px] sm:text-[10px] lg:text-[11px] uppercase tracking-[0.16em] sm:tracking-[0.22em] text-[#4A4A4A] font-medium">
                  NEW ARRIVALS
                </p>

                <h2 className="font-street font-bold uppercase text-[#0A0A0A] leading-[0.94] tracking-[-0.025em] text-[18px] sm:text-[32px] md:text-[38px] lg:text-[48px] xl:text-[54px]">
                  FRESH
                  <br />
                  DROPS
                </h2>

                <p className="text-[9.5px] sm:text-[12px] lg:text-[13.5px] text-[#404040] leading-[1.35] sm:leading-[1.55] max-w-[260px]">
                  The latest pieces from PYTHOX WORLD. Small-batch heavyweight cotton.
                  Limited stock. Don&apos;t miss out.
                </p>

                <div className="pt-1 sm:pt-1.5 lg:pt-2">
                  <Link
                    to="/new-arrivals"
                    className="inline-flex items-center justify-center gap-1.5 sm:gap-3 bg-[#0A0A0A] text-white border border-[#0A0A0A] rounded-[7px] sm:rounded-[10px] px-2.5 py-2 sm:px-5 sm:min-h-[40px] lg:min-h-[44px] font-sans text-[8.5px] sm:text-[11px] lg:text-[12px] font-semibold uppercase tracking-[0.08em] sm:tracking-[0.1em] whitespace-nowrap hover:bg-[#242424] hover:border-[#242424] transition-colors group"
                  >
                    <span>VIEW ALL</span>
                    <ArrowRight className="h-2.5 w-2.5 sm:h-3.5 sm:w-3.5 lg:h-4 lg:w-4 transition-transform duration-200 group-hover:translate-x-1" />
                  </Link>
                </div>
              </div>

              {/* CENTER: Blended Lifestyle Editorial Model Image */}
              <div className="lg:col-span-5 relative h-full bg-[#E6E4DE] overflow-hidden min-w-0">
                {!brokenImg.freshDrops ? (
                  <img
                    src={EDITORIAL_MEDIA.catMen}
                    alt="PYTHOX WORLD Fresh Drops Menswear"
                    loading="lazy"
                    referrerPolicy="no-referrer"
                    onError={() => markBroken('freshDrops')}
                    className="absolute inset-0 h-full w-full object-cover object-[50%_14%] contrast-[1.03]"
                  />
                ) : (
                  <div className="h-full w-full bg-[#DCDAD4]" />
                )}

                {/* Seamless Horizontal Side Feather Blending into #EAE9E4 */}
                <div
                  aria-hidden="true"
                  className="absolute inset-y-0 left-0 w-5 sm:w-12 lg:w-24 bg-gradient-to-r from-[#EAE9E4] via-[#EAE9E4]/60 to-transparent pointer-events-none"
                />
                <div
                  aria-hidden="true"
                  className="absolute inset-y-0 right-0 w-5 sm:w-12 lg:w-24 bg-gradient-to-l from-[#EAE9E4] via-[#EAE9E4]/60 to-transparent pointer-events-none"
                />
              </div>

              {/* RIGHT: Promotional Headline, Supporting Copy & Minimal Signature Detail */}
              <div className="lg:col-span-3 relative z-10 pr-3 pl-1 py-4 sm:pr-7 sm:pl-3 sm:py-8 lg:pr-12 lg:pl-4 lg:py-12 flex flex-col justify-center items-end text-right gap-1.5 sm:gap-3 lg:gap-4 min-w-0">
                <p className="font-mono text-[7.5px] sm:text-[9.5px] lg:text-[10.5px] uppercase tracking-[0.14em] sm:tracking-[0.2em] text-[#595959]">
                  SERIES 04
                </p>

                <div className="space-y-0.5 font-street uppercase text-[#0A0A0A] tracking-[0.03em] sm:tracking-[0.06em] text-[9.5px] sm:text-[14px] md:text-[16px] lg:text-[18px] leading-[1.2] sm:leading-[1.3] font-semibold">
                  <p>SAME MINDSET.</p>
                  <p>DIFFERENT</p>
                  <p>ENERGY.</p>
                </div>

                <p className="text-[8.5px] sm:text-[11px] lg:text-[12.5px] text-[#4A4A4A] leading-[1.3] sm:leading-[1.5] max-w-[185px]">
                  460 GSM heavyweight cuts engineered for daily movement.
                </p>

                <div className="h-[1px] w-7 sm:w-12 lg:w-14 bg-[#0A0A0A]/40 my-0.5" aria-hidden="true" />

                {/* Signature Script Mark */}
                <div className="-rotate-6 select-none" aria-label="Pythox signature">
                  <span className="font-editorial italic font-bold text-[15px] sm:text-[22px] lg:text-[28px] text-[#0A0A0A] tracking-tight underline decoration-1 underline-offset-4">
                    Pythox
                  </span>
                </div>
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
            <div aria-busy="true" aria-label="Loading featured products">
              <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-[#5C5C5C] mb-4">
                Loading products...
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5 sm:gap-5">
                {[0, 1, 2, 3, 4].map((slot) => (
                  <div key={slot} className="space-y-3 animate-pulse">
                    <div className="aspect-[4/5] bg-[#E4E3DF]" />
                    <div className="space-y-1.5">
                      <div className="h-3.5 w-3/4 bg-[#E4E3DF]" />
                      <div className="h-3 w-1/3 bg-[#E4E3DF]" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : productsError && featuredProducts.length === 0 ? (
            <div className="border border-[#DCDBD6] bg-[#EAE9E4] px-6 py-14 text-center space-y-3">
              <p className="font-street text-sm sm:text-base font-semibold uppercase tracking-[0.14em] text-[#0A0A0A]">
                Unable to load products. Please try again.
              </p>
              <p className="text-xs text-[#555555]">
                Our store catalog is temporarily unreachable. Tap retry to reload.
              </p>
              <div className="pt-1">
                <button
                  type="button"
                  onClick={() => void refreshProducts()}
                  className="btn-base btn-primary btn-sm"
                >
                  Retry
                </button>
              </div>
            </div>
          ) : featuredProducts.length === 0 ? (
            <div className="border border-[#DCDBD6] bg-[#EAE9E4] px-6 py-14 text-center">
              <p className="font-street text-sm sm:text-base font-semibold uppercase tracking-[0.14em] text-[#0A0A0A]">
                No products are publicly available.
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
                    <div className="aspect-[4/5] bg-[#E8E7E3] overflow-hidden relative">
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
                <div className="aspect-[4/5] bg-[#0A0A0A] text-white p-5 flex flex-col justify-between transition-colors group-hover:bg-[#191919]">
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
                href={sanitizeExternalHref(settings.facebookUrl, 'https://www.facebook.com/share/1A8c2wEDBX/')}
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
                onClick={() =>
                  trackPixelEvent('Contact', {
                    content_name: 'Homepage WhatsApp Concierge',
                  })
                }
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
