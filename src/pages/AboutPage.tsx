import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Check, Layers, Scissors, ShieldCheck, Shirt } from 'lucide-react';
import { BRAND_LOCATION, EDITORIAL_MEDIA } from '../config/storeConfig';
import { BrandLogo } from '../components/BrandLogo';
import { SeoHead } from '../components/SeoHead';
import { Reveal, useLowMotion } from '../components/Motion';

interface SweatshirtColorOption {
  id: string;
  name: string;
  note: string;
  fillHex: string;
  stitchHex: string;
  isLight: boolean;
}

const SWEATSHIRT_COLORS: SweatshirtColorOption[] = [
  {
    id: 'black',
    name: 'Black',
    note: 'ক্লাসিক ও স্টাইলিশ',
    fillHex: '#141414',
    stitchHex: '#3D3D3D',
    isLight: false,
  },
  {
    id: 'navy',
    name: 'Navy Blue',
    note: 'এলিগ্যান্ট ও প্রিমিয়াম',
    fillHex: '#16243E',
    stitchHex: '#3B527A',
    isLight: false,
  },
  {
    id: 'seagreen',
    name: 'Sea Green',
    note: 'ইউনিক ও আধুনিক',
    fillHex: '#2E6F65',
    stitchHex: '#63A398',
    isLight: false,
  },
  {
    id: 'beige',
    name: 'Beige/Cream',
    note: 'সিম্পল ও রিফাইন্ড',
    fillHex: '#EAE0CE',
    stitchHex: '#BFB29B',
    isLight: true,
  },
];

export const AboutPage: React.FC = () => {
  const lowMotion = useLowMotion();
  const [selectedColor, setSelectedColor] = useState<SweatshirtColorOption>(
    SWEATSHIRT_COLORS[0]
  );
  const [brokenImages, setBrokenImages] = useState<Record<string, boolean>>({});

  const markBroken = (key: string) => {
    setBrokenImages((prev) => ({ ...prev, [key]: true }));
  };

  return (
    <main className="font-bengali page-enter">
      <SeoHead
        title="আমাদের সম্পর্কে (About Us) — PYTHOX WORLD"
        description="Pythox World — মারুফ পাঠান প্রতিষ্ঠিত আধুনিক মেনসওয়্যার ও প্রিমিয়াম উইন্টার কালেকশন। Wear Your Style. Express Yourself."
      />

      {/* 1. HERO: আমাদের সম্পর্কে */}
      <section className="mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-10 py-6 sm:py-10 lg:py-16 border-b border-[#D9D9D9]">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-stretch">
          <div className="lg:col-span-6 flex flex-col justify-center space-y-6">
            <div className="space-y-3">
              <BrandLogo className="h-12" />
              <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-[0.18em] text-[#5C5C5C]">
                <span>আমাদের সম্পর্কে</span>
                <span aria-hidden="true">·</span>
                <span>About Us</span>
              </div>
            </div>

            <h1 className="text-3xl sm:text-5xl lg:text-[52px] font-bold text-[#0A0A0A] leading-[1.16] [text-wrap:balance]">
              Pythox World-এ আপনাকে স্বাগতম!
            </h1>

            <div className="space-y-4 text-[15.5px] sm:text-base text-[#292929] leading-[1.75] max-w-xl">
              <p>
                আমাদের কাছে পোশাক মানে শুধু ফ্যাশন নয়—পোশাক একজন মানুষের ব্যক্তিত্ব, রুচি
                এবং আত্মপ্রকাশের অন্যতম প্রধান মাধ্যম। এই বিশ্বাস ও দর্শন থেকেই{' '}
                <strong className="font-semibold text-[#0A0A0A]">মারুফ পাঠান</strong>{' '}
                প্রতিষ্ঠা করেন{' '}
                <strong className="font-semibold text-[#0A0A0A]">Pythox World</strong>।
              </p>
              <p>
                আমাদের উদ্দেশ্য এমন পোশাক ও ফ্যাশন পণ্য আপনাদের কাছে পৌঁছে দেওয়া, যা
                একইসাথে স্টাইলিশ, আরামদায়ক এবং মানসম্মত। বিশেষ করে নতুন প্রজন্মের রুচি,
                চাহিদা ও আধুনিক ফ্যাশন ট্রেন্ডকে গুরুত্ব দিয়ে আমরা আমাদের প্রতিটি কালেকশন
                নির্বাচন করি।
              </p>
            </div>

            <div className="pt-2 flex flex-col sm:flex-row flex-wrap gap-3">
              <Link
                to="/shop"
                className="btn-base btn-primary btn-lg"
              >
                <span>Explore Collection</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
              <Link
                to="/shop?winter=true"
                className="btn-base btn-secondary btn-lg"
              >
                Winter Collection
              </Link>
            </div>
          </div>

          {/* Right Editorial Media + Tailoring Graphic Frame */}
          <div className="lg:col-span-6 relative min-h-[360px] lg:min-h-[480px] rounded-3xl border border-[#D9D9D9] bg-[#EAE9E4] overflow-hidden navy-shadow group">
            {!brokenImages.hero ? (
              <img
                src={EDITORIAL_MEDIA.heroCampaign}
                alt="Pythox World Menswear Editorial"
                referrerPolicy="no-referrer"
                onError={() => markBroken('hero')}
                className="h-full w-full object-cover object-[66%_16%] transition-transform duration-700 ease-out [@media(hover:hover)]:group-hover:scale-[1.03]"
              />
            ) : (
              <div className="h-full w-full flex flex-col items-center justify-center bg-[#181818] text-white p-8 text-center space-y-3">
                <Shirt className="h-10 w-10 text-white/75" />
                <span className="font-editorial text-2xl font-bold">PYTHOX WORLD</span>
              </div>
            )}

            <div
              aria-hidden="true"
              className="absolute inset-0 bg-gradient-to-t from-[#0A0A0A]/80 via-[#0A0A0A]/15 to-transparent pointer-events-none"
            />

            {/* Architectural Atelier Vector Overlay */}
            <svg
              aria-hidden="true"
              viewBox="0 0 400 120"
              fill="none"
              className={`absolute top-5 right-5 w-36 sm:w-44 text-white/40 pointer-events-none ${
                lowMotion ? '' : 'about-float'
              }`}
            >
              <rect
                x="12"
                y="12"
                width="376"
                height="96"
                rx="16"
                stroke="currentColor"
                strokeWidth="1"
                strokeDasharray="5 5"
              />
              <circle cx="52" cy="60" r="22" stroke="currentColor" strokeWidth="1.2" />
              <path
                d="M52 30V90M22 60H82"
                stroke="currentColor"
                strokeWidth="1"
                strokeDasharray="3 3"
              />
              <text
                x="92"
                y="55"
                fill="currentColor"
                fontSize="11"
                fontFamily="JetBrains Mono, monospace"
                letterSpacing="2"
              >
                EST. PYTHOX WORLD
              </text>
              <text
                x="92"
                y="74"
                fill="currentColor"
                fontSize="10"
                fontFamily="JetBrains Mono, monospace"
                letterSpacing="1.4"
              >
                WEAR YOUR STYLE
              </text>
            </svg>

            <div className="absolute bottom-6 left-6 right-6 text-white space-y-1">
              <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-white/75">
                Founder · মারুফ পাঠান
              </p>
              <p className="text-sm sm:text-base font-medium text-white">
                Wear Your Style. Express Yourself.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 2. OUR GOAL: আমাদের লক্ষ্য + Animated Atelier Pattern Graphic */}
      <section className="mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-10 py-16 lg:py-20 border-b border-[#D9D9D9]">
        <Reveal>
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center">
            {/* Vector Pattern Blueprint Graphic */}
            <div className="lg:col-span-5 rounded-3xl border border-[#D9D9D9] bg-white p-7 sm:p-9 navy-shadow flex flex-col justify-between gap-6">
              <div className="flex items-center justify-between text-xs font-mono text-[#5C5C5C]">
                <span>Craft &amp; Pattern Architecture</span>
                <span>01 / 04</span>
              </div>

              <div className="relative py-4 flex items-center justify-center">
                <svg
                  viewBox="0 0 320 220"
                  fill="none"
                  className="w-full max-w-[300px] text-[#0A0A0A]"
                  role="img"
                  aria-label="Tailored menswear pattern graphic"
                >
                  {/* Precision grid lines */}
                  <path
                    d="M20 40H300M20 110H300M20 180H300M80 16V204M160 16V204M240 16V204"
                    stroke="#E5E5E5"
                    strokeWidth="1"
                  />
                  {/* Animated tailored pattern outline */}
                  <path
                    d="M112 36L82 54L56 96L82 114L96 90V188H224V90L238 114L264 96L238 54L208 36C198 52 180 60 160 60C140 60 122 52 112 36Z"
                    stroke="#0A0A0A"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className={lowMotion ? '' : 'about-draw'}
                  />
                  {/* Neckline & seam measurement marks */}
                  <path
                    d="M132 42C140 50 150 54 160 54C170 54 180 50 188 42"
                    stroke="#808080"
                    strokeWidth="1.4"
                    strokeDasharray="4 4"
                  />
                  <line
                    x1="96"
                    y1="176"
                    x2="224"
                    y2="176"
                    stroke="#0A0A0A"
                    strokeWidth="1.2"
                    strokeDasharray="3 3"
                  />
                  <circle cx="160" cy="110" r="3" fill="#0A0A0A" />
                </svg>
              </div>

              <div className="grid grid-cols-3 gap-4 border-t border-[#ECECEC] pt-5 text-center">
                <div>
                  <Scissors className="h-4 w-4 mx-auto text-[#0A0A0A] mb-1.5" />
                  <p className="text-xs font-semibold text-[#0A0A0A]">আধুনিক ডিজাইন</p>
                </div>
                <div>
                  <Layers className="h-4 w-4 mx-auto text-[#0A0A0A] mb-1.5" />
                  <p className="text-xs font-semibold text-[#0A0A0A]">প্রিমিয়াম ফেব্রিক</p>
                </div>
                <div>
                  <ShieldCheck className="h-4 w-4 mx-auto text-[#0A0A0A] mb-1.5" />
                  <p className="text-xs font-semibold text-[#0A0A0A]">নিখুঁত মান</p>
                </div>
              </div>
            </div>

            {/* Goal Prose */}
            <div className="lg:col-span-7 space-y-6">
              <div className="space-y-2">
                <p className="font-mono text-xs uppercase tracking-[0.18em] text-[#5C5C5C]">
                  Our Vision &amp; Purpose
                </p>
                <h2 className="text-3xl sm:text-4xl font-bold text-[#0A0A0A]">
                  আমাদের লক্ষ্য
                </h2>
              </div>

              <div className="space-y-4 text-[15.5px] sm:text-base text-[#292929] leading-[1.8]">
                <p>
                  আমাদের লক্ষ্য শুধুমাত্র পণ্য বিক্রি করা নয়; বরং দেশের প্রতিটি মানুষের কাছে সেরা
                  মানের প্রিমিয়াম পোশাক পৌঁছে দেওয়া।
                </p>
                <p>
                  নতুন প্রজন্মের জন্য ইউনিক ফ্যাশন, আধুনিক ডিজাইন এবং প্রিমিয়াম কোয়ালিটির
                  সমন্বয় তৈরি করাই আমাদের অন্যতম প্রধান উদ্দেশ্য। আমরা চাই, Pythox World-এর
                  প্রতিটি পোশাক আপনার নিজস্ব স্টাইল ও ব্যক্তিত্বকে আরও সুন্দরভাবে প্রকাশ করুক।
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 pt-4 border-t border-[#D9D9D9]">
                <div>
                  <p className="font-editorial text-2xl font-bold text-[#0A0A0A]">01.</p>
                  <p className="mt-1 text-sm font-semibold text-[#0A0A0A]">ইউনিক ফ্যাশন</p>
                  <p className="mt-1 text-xs text-[#6A6A6A] leading-relaxed">
                    নতুন প্রজন্মের আধুনিক রুচি ও সমসাময়িক স্টাইলের সাথে সামঞ্জস্যপূর্ণ।
                  </p>
                </div>
                <div>
                  <p className="font-editorial text-2xl font-bold text-[#0A0A0A]">02.</p>
                  <p className="mt-1 text-sm font-semibold text-[#0A0A0A]">আধুনিক ডিজাইন</p>
                  <p className="mt-1 text-xs text-[#6A6A6A] leading-relaxed">
                    প্রতিটি কাটিং, ফিনিশিং এবং স্টিচিংয়ে আধুনিক ও পরিশীলিত ছোঁয়া।
                  </p>
                </div>
                <div>
                  <p className="font-editorial text-2xl font-bold text-[#0A0A0A]">03.</p>
                  <p className="mt-1 text-sm font-semibold text-[#0A0A0A]">প্রিমিয়াম কোয়ালিটি</p>
                  <p className="mt-1 text-xs text-[#6A6A6A] leading-relaxed">
                    দীর্ঘস্থায়ী আরাম ও টেকসই কাপড়ের নিশ্চয়তা প্রতিটি পোশাকে।
                  </p>
                </div>
              </div>
            </div>
          </div>
        </Reveal>
      </section>

      {/* 3. OUR COLLECTION & INTERACTIVE COLOR VARIATION: আমাদের কালেকশন */}
      <section className="mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-10 py-16 lg:py-20 border-b border-[#D9D9D9] space-y-12">
        <Reveal>
          <div className="max-w-2xl space-y-3">
            <p className="font-mono text-xs uppercase tracking-[0.18em] text-[#5C5C5C]">
              Curated Menswear Lineup
            </p>
            <h2 className="text-3xl sm:text-4xl font-bold text-[#0A0A0A]">
              আমাদের কালেকশন
            </h2>
            <p className="text-[15.5px] sm:text-base text-[#292929] leading-[1.75]">
              আমরা সবসময় ট্রেন্ডি, স্টাইলিশ এবং আরামদায়ক পোশাকের সমাহার নিয়ে আসার চেষ্টা
              করি।
            </p>
          </div>
        </Reveal>

        {/* Interactive Sweatshirt Color Studio + Winter Collection Showcase */}
        <Reveal delayMs={40}>
          <div className="rounded-3xl border border-[#D9D9D9] bg-white p-6 sm:p-10 navy-shadow grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-center">
            {/* Interactive Animated Vector Sweatshirt Graphic */}
            <div className="lg:col-span-5 rounded-2xl bg-[#F3F2EE] border border-[#D9D9D9] p-6 sm:p-8 flex flex-col items-center justify-between gap-5">
              <div className="w-full flex items-center justify-between text-xs font-mono text-[#5C5C5C]">
                <span>US Polo Sweatshirt</span>
                <span>{selectedColor.name}</span>
              </div>

              <div className="relative py-2 flex items-center justify-center w-full">
                <svg
                  viewBox="0 0 280 250"
                  className={`w-56 sm:w-64 transition-transform duration-300 ${
                    lowMotion ? '' : 'about-float'
                  }`}
                  role="img"
                  aria-label={`US Polo Sweatshirt illustration in ${selectedColor.name}`}
                >
                  {/* Subtle backdrop concentric rings */}
                  <circle
                    cx="140"
                    cy="126"
                    r="102"
                    fill="none"
                    stroke="#DCDCDC"
                    strokeWidth="1"
                    strokeDasharray="4 4"
                  />
                  {/* Sweatshirt silhouette with smooth color transitions */}
                  <path
                    d="M98 38C108 54 123 61 140 61C157 61 172 54 182 38L216 54L250 112L224 129L204 94V210H76V94L56 129L30 112L64 54L98 38Z"
                    fill={selectedColor.fillHex}
                    stroke={selectedColor.isLight ? '#8C7E68' : '#0A0A0A'}
                    strokeWidth="2.5"
                    strokeLinejoin="round"
                    style={{ transition: 'fill 300ms cubic-bezier(0.16, 1, 0.3, 1)' }}
                  />
                  {/* Collar & V-insert rib detail */}
                  <path
                    d="M98 38C108 58 123 66 140 66C157 66 172 58 182 38"
                    fill="none"
                    stroke={selectedColor.stitchHex}
                    strokeWidth="2.5"
                  />
                  <path
                    d="M128 65L140 83L152 65"
                    fill="none"
                    stroke={selectedColor.stitchHex}
                    strokeWidth="2"
                  />
                  {/* Ribbed cuffs & hem lines */}
                  <line
                    x1="76"
                    y1="196"
                    x2="204"
                    y2="196"
                    stroke={selectedColor.stitchHex}
                    strokeWidth="2.5"
                  />
                  <line
                    x1="36"
                    y1="103"
                    x2="60"
                    y2="119"
                    stroke={selectedColor.stitchHex}
                    strokeWidth="2.5"
                  />
                  <line
                    x1="244"
                    y1="103"
                    x2="220"
                    y2="119"
                    stroke={selectedColor.stitchHex}
                    strokeWidth="2.5"
                  />
                  {/* Chest emblem mark */}
                  <rect
                    x="166"
                    y="98"
                    width="16"
                    height="16"
                    rx="3"
                    fill="none"
                    stroke={selectedColor.isLight ? '#0A0A0A' : '#FFFFFF'}
                    strokeOpacity="0.7"
                    strokeWidth="1.5"
                  />
                  <circle
                    cx="174"
                    cy="106"
                    r="2.5"
                    fill={selectedColor.isLight ? '#0A0A0A' : '#FFFFFF'}
                    fillOpacity="0.8"
                  />
                </svg>
              </div>

              <div className="w-full text-center border-t border-[#E5E5E5] pt-4">
                <p className="text-sm font-semibold text-[#0A0A0A]">
                  {selectedColor.name} — {selectedColor.note}
                </p>
              </div>
            </div>

            {/* Winter Collection & Color Variation Details */}
            <div className="lg:col-span-7 space-y-6">
              <div className="space-y-3">
                <p className="font-mono text-xs uppercase tracking-[0.16em] text-[#5C5C5C]">
                  Winter Collection Spotlight
                </p>
                <h3 className="text-2xl sm:text-3xl font-bold text-[#0A0A0A]">
                  প্রিমিয়াম উইন্টার কালেকশন
                </h3>
                <p className="text-[15.5px] text-[#292929] leading-[1.75]">
                  শীতের ফ্যাশনকে আরও আকর্ষণীয় করে তুলতে আমাদের কালেকশনে রয়েছে প্রিমিয়াম{' '}
                  <strong className="font-semibold text-[#0A0A0A]">
                    US Polo Sweatshirt
                  </strong>
                  । আধুনিক ডিজাইন ও আরামদায়ক ব্যবহারের কথা মাথায় রেখে এই কালেকশন সাজানো
                  হয়েছে।
                </p>
              </div>

              <div className="space-y-3 pt-2 border-t border-[#ECECEC]">
                <h4 className="text-lg font-bold text-[#0A0A0A]">কালার ভ্যারিয়েশন</h4>
                <p className="text-sm text-[#292929]">
                  আপনার পছন্দকে গুরুত্ব দিয়ে আমাদের Sweatshirt কালেকশনে রয়েছে চারটি আকর্ষণীয়
                  রঙ:
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  {SWEATSHIRT_COLORS.map((color) => {
                    const active = selectedColor.id === color.id;
                    return (
                      <button
                        key={color.id}
                        type="button"
                        onClick={() => setSelectedColor(color)}
                        className={`min-h-[56px] flex items-center justify-between gap-3 rounded-2xl border p-3.5 text-left transition-colors cursor-pointer ui-press ${
                          active
                            ? 'bg-[#0A0A0A] text-white border-[#0A0A0A] shadow-sm'
                            : 'bg-[#F3F2EE] text-[#0A0A0A] border-[#D9D9D9] hover:border-[#0A0A0A] hover:bg-white'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <span
                            className="h-6 w-6 rounded-full border shrink-0"
                            style={{
                              backgroundColor: color.fillHex,
                              borderColor: active ? '#FFFFFF' : '#BDBDBD',
                            }}
                          />
                          <div className="min-w-0">
                            <p className="text-sm font-semibold truncate">{color.name}</p>
                            <p
                              className={`text-xs truncate ${
                                active ? 'text-[#D4D4D3]' : 'text-[#5C5C5C]'
                              }`}
                            >
                              {color.note}
                            </p>
                          </div>
                        </div>
                        {active && <Check className="h-4 w-4 shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </Reveal>

        {/* Premium Hoodies Split Feature */}
        <Reveal delayMs={60}>
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
            <div className="lg:col-span-6 rounded-3xl border border-[#D9D9D9] bg-white p-7 sm:p-10 flex flex-col justify-between gap-6">
              <div className="space-y-4">
                <p className="font-mono text-xs uppercase tracking-[0.16em] text-[#5C5C5C]">
                  Winter Essentials · Heavyweight Fleece
                </p>
                <h3 className="text-2xl sm:text-3xl font-bold text-[#0A0A0A]">
                  প্রিমিয়াম Hoodies
                </h3>
                <p className="text-[15.5px] text-[#292929] leading-[1.8]">
                  শীতের ফ্যাশনকে আরও সম্পূর্ণ করতে আমাদের কালেকশনে রয়েছে দারুণ সব{' '}
                  <strong className="font-semibold text-[#0A0A0A]">
                    Premium Hoodies
                  </strong>
                  । স্টাইল ও কমফোর্ট—দুটোর সমন্বয় রেখে আমাদের Hoodies কালেকশন তৈরি করা হয়েছে।
                </p>
              </div>

              <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-3 pt-4 border-t border-[#ECECEC]">
                <Link
                  to="/shop?category=Hoodie"
                  className="btn-base btn-primary"
                >
                  <span>Shop Hoodies</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
                <Link
                  to="/shop"
                  className="btn-base btn-secondary"
                >
                  View All Menswear
                </Link>
              </div>
            </div>

            <div className="lg:col-span-6 grid grid-cols-2 gap-4">
              <div className="rounded-3xl border border-[#D9D9D9] bg-[#EAE9E4] overflow-hidden aspect-[4/5] group">
                {!brokenImages.hoodieCharcoal ? (
                  <img
                    src={EDITORIAL_MEDIA.prodHoodieCharcoal}
                    alt="Premium Charcoal Hoodie"
                    referrerPolicy="no-referrer"
                    onError={() => markBroken('hoodieCharcoal')}
                    className="h-full w-full object-cover transition-transform duration-500 [@media(hover:hover)]:group-hover:scale-105"
                  />
                ) : (
                  <div className="h-full w-full flex items-center justify-center bg-[#1C1C1C] text-white text-xs">
                    Premium Hoodie
                  </div>
                )}
              </div>
              <div className="rounded-3xl border border-[#D9D9D9] bg-[#EAE9E4] overflow-hidden aspect-[4/5] group">
                {!brokenImages.hoodieCream ? (
                  <img
                    src={EDITORIAL_MEDIA.prodHoodieCream}
                    alt="Premium Cream Hoodie"
                    referrerPolicy="no-referrer"
                    onError={() => markBroken('hoodieCream')}
                    className="h-full w-full object-cover transition-transform duration-500 [@media(hover:hover)]:group-hover:scale-105"
                  />
                ) : (
                  <div className="h-full w-full flex items-center justify-center bg-[#E5DEC9] text-[#0A0A0A] text-xs">
                    Premium Hoodie
                  </div>
                )}
              </div>
            </div>
          </div>
        </Reveal>
      </section>

      {/* 4. OUR PROMISE: আমাদের প্রতিশ্রুতি & BRAND MANIFESTO */}
      <section className="mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-10 py-16 lg:py-20 border-b border-[#D9D9D9]">
        <Reveal>
          <div className="rounded-3xl bg-[#0A0A0A] text-white p-8 sm:p-12 lg:p-14 relative overflow-hidden">
            {/* Subtle Architectural Concentric Thread Vector Graphic */}
            <svg
              aria-hidden="true"
              viewBox="0 0 360 360"
              fill="none"
              className="absolute -right-20 -bottom-24 w-72 sm:w-96 text-white/[0.06] pointer-events-none"
            >
              <circle cx="180" cy="180" r="165" stroke="currentColor" strokeWidth="1.5" />
              <circle
                cx="180"
                cy="180"
                r="125"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeDasharray="6 6"
              />
              <circle cx="180" cy="180" r="82" stroke="currentColor" strokeWidth="1.5" />
              <path d="M180 15V345M15 180H345" stroke="currentColor" strokeWidth="1" />
            </svg>

            <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
              <div className="lg:col-span-7 space-y-5">
                <p className="font-mono text-xs uppercase tracking-[0.18em] text-[#B5B5B4]">
                  Our Commitment to Craft &amp; Trust
                </p>
                <h2 className="text-3xl sm:text-4xl font-bold text-white">
                  আমাদের প্রতিশ্রুতি
                </h2>
                <div className="space-y-4 text-[15.5px] sm:text-base text-[#E2E2E1] leading-[1.8]">
                  <p>
                    গুণগত মানের ক্ষেত্রে আমরা কখনোই আপস করি না। আমাদের প্রতিটি পণ্যের ক্ষেত্রে
                    আমরা মান, স্টাইল এবং ব্যবহারযোগ্যতাকে সর্বোচ্চ গুরুত্ব দিই।
                  </p>
                  <p>
                    আমাদের বিশ্বাস, আপনার হাতে পণ্য পৌঁছানোর পর আপনি যেন তার মান ও সৌন্দর্য
                    নিয়ে সম্পূর্ণ সন্তুষ্ট থাকেন—এটাই আমাদের সবচেয়ে বড় প্রতিশ্রুতি।
                  </p>
                  <p>আমরা সবসময় আপনাদের কাছে পৌঁছে দিতে চাই:</p>
                </div>

                <div className="pt-2">
                  <p className="font-editorial text-2xl sm:text-3xl font-bold text-white tracking-tight">
                    Best Quality at the Best Price
                  </p>
                </div>
              </div>

              <div className="lg:col-span-5 rounded-2xl border border-white/15 bg-white/[0.04] p-7 sm:p-8 space-y-5">
                <p className="text-[15px] sm:text-base text-[#E2E2E1] leading-[1.8]">
                  আপনার স্টাইল, আপনার ব্যক্তিত্ব, আপনার আত্মপ্রকাশ—সবকিছুর সাথে Pythox
                  World-কে এগিয়ে নিতে আমাদের সাথেই থাকুন।
                </p>
                <div className="border-t border-white/15 pt-5 space-y-2">
                  <p className="font-editorial text-xl sm:text-2xl font-bold text-white">
                    Pythox World — Wear Your Style. Express Yourself.
                  </p>
                  <p className="font-mono text-xs text-[#A3A3A2]">{BRAND_LOCATION}</p>
                </div>
                <div className="pt-2 flex flex-col sm:flex-row flex-wrap gap-3">
                  <Link
                    to="/shop"
                    className="btn-base btn-inverted"
                  >
                    <span>Shop Now</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                  <Link
                    to="/contact"
                    className="btn-base btn-dark-ghost"
                  >
                    Contact Us
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </Reveal>
      </section>

      {/* 5. Storefront Assurance Quick Links */}
      <section className="mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-10 py-14 pb-20 sm:pb-14 grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="space-y-3 rounded-3xl border border-[#D9D9D9] bg-white p-7">
          <h3 className="text-xl font-editorial font-semibold text-[#0A0A0A]">
            Nationwide Shipping
          </h3>
          <p className="text-sm text-[#292929] leading-relaxed">
            Inside Dhaka &amp; Savar: ৳80 standard delivery (24–48 hrs). Outside Dhaka:
            ৳130 (3–5 days). Orders over ৳3,000 qualify for free delivery.
          </p>
          <Link
            to="/shipping-policy"
            className="inline-block text-xs font-semibold uppercase tracking-[0.12em] text-[#0A0A0A] underline underline-offset-4"
          >
            Read Shipping Policy
          </Link>
        </div>
        <div className="space-y-3 rounded-3xl border border-[#D9D9D9] bg-white p-7">
          <h3 className="text-xl font-editorial font-semibold text-[#0A0A0A]">
            Easy Exchanges
          </h3>
          <p className="text-sm text-[#292929] leading-relaxed">
            7-day unworn size exchange guarantee with original tags and packaging intact.
            Fast pickup from your home or office.
          </p>
          <Link
            to="/return-policy"
            className="inline-block text-xs font-semibold uppercase tracking-[0.12em] text-[#0A0A0A] underline underline-offset-4"
          >
            Return &amp; Exchange Policy
          </Link>
        </div>
        <div className="space-y-3 rounded-3xl border border-[#D9D9D9] bg-white p-7">
          <h3 className="text-xl font-editorial font-semibold text-[#0A0A0A]">
            Direct Concierge
          </h3>
          <p className="text-sm text-[#292929] leading-relaxed">
            Need help with chest/waist sizing or order status? Message our Savar desk on
            WhatsApp, Messenger, or view our Size Guide.
          </p>
          <Link
            to="/size-guide"
            className="inline-block text-xs font-semibold uppercase tracking-[0.12em] text-[#0A0A0A] underline underline-offset-4"
          >
            Open Men&apos;s Size Guide
          </Link>
        </div>
      </section>
    </main>
  );
};
