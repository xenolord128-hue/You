import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Instagram, Lock, Mail, MapPin, MessageCircle, PhoneCall, Share2 } from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { BRAND_LOGO_URL } from '../config/storeConfig';
import { trackPixelEvent } from '../lib/metaPixel';
import { sanitizeExternalHref } from '../lib/formatters';

export const Footer: React.FC = () => {
  const { settings, showToast, t } = useStore();
  const [email, setEmail] = useState('');
  const [subscribed, setSubscribed] = useState(false);

  const handleSubscribe = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !email.includes('@')) {
      showToast('Please enter a valid email address.');
      return;
    }
    setSubscribed(true);
    setEmail('');
    trackPixelEvent('Lead', { content_name: 'Footer VIP Club' });
    showToast('Welcome to the PYTHOX WORLD VIP Club.');
  };

  const cleanWa = settings.whatsappNumber.replace(/\D/g, '');
  const waHref = `https://wa.me/${cleanWa || '8801XXXXXXXXX'}`;

  return (
    <footer className="bg-[#0A0A0A] text-[#F5F5F5] border-t border-[#292929]">
      <div className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-10 py-14 lg:py-16">
        {/* Top 12-Column Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-start">
          {/* Left (5 cols): Brand Logo, Story & Social Links */}
          <div className="lg:col-span-5 space-y-5">
            <div className="flex items-center gap-3.5">
              <Link
                to="/"
                aria-label="PYTHOX WORLD"
                className="h-14 w-14 rounded-full p-1 border border-[#D9D9D9] bg-white overflow-hidden shrink-0"
              >
                <img
                  src={BRAND_LOGO_URL}
                  alt="PYTHOX WORLD"
                  referrerPolicy="no-referrer"
                  className="h-full w-full object-contain rounded-full"
                />
              </Link>
              <div>
                <h3 className="font-editorial text-2xl font-bold text-white tracking-tight">
                  PYTHOX <span className="italic text-[#D9D9D9] font-semibold">WORLD</span>
                </h3>
                <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-[#808080]">
                  STYLE · CONFIDENCE · QUALITY
                </p>
              </div>
            </div>

            <p className="text-sm text-[#D9D9D9] leading-relaxed max-w-md">
              Exclusively curated men&apos;s fashion crafted in small batches—combining 260–460 GSM combed cotton, tailored shirting, footwear, and brushed steel horology delivered across Bangladesh.
            </p>

            <div className="flex flex-wrap items-center gap-2.5 pt-1">
              <a
                href={sanitizeExternalHref(settings.instagramUrl, 'https://instagram.com/pythoxworld')}
                target="_blank"
                rel="noreferrer"
                className="btn-base btn-dark-ghost btn-sm"
              >
                <Instagram className="h-3.5 w-3.5" /> Instagram
              </a>
              <a
                href={sanitizeExternalHref(settings.facebookUrl, 'https://facebook.com/pythoxworld')}
                target="_blank"
                rel="noreferrer"
                className="btn-base btn-dark-ghost btn-sm"
              >
                <Share2 className="h-3.5 w-3.5" /> Facebook
              </a>
              <a
                href={waHref}
                target="_blank"
                rel="noreferrer"
                className="btn-base btn-dark-ghost btn-sm"
              >
                <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
              </a>
            </div>
          </div>

          {/* Middle (4 cols): VIP Club Newsletter Signup */}
          <div className="lg:col-span-4 rounded-2xl sm:rounded-3xl bg-[#111111] border border-[#292929] p-5 sm:p-6 space-y-3.5">
            <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-[#A8A39B]">
              PRIVATE ATELIER ACCESS
            </p>
            <h4 className="font-editorial text-xl font-bold text-white">
              {t('vipClubTitle')}
            </h4>
            <p className="text-xs text-[#D9D9D9] leading-relaxed">
              {t('vipClubSub')}
            </p>
            <form onSubmit={handleSubscribe} className="flex flex-col sm:flex-row gap-2 pt-1">
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email"
                className="flex-1 min-w-0 min-h-[42px] rounded-[10px] bg-[#0A0A0A] border border-[#343434] px-3.5 py-2 text-xs text-white placeholder:text-[#A8A39B] focus:border-white focus:outline-none"
              />
              <button
                type="submit"
                className="btn-base btn-inverted shrink-0"
              >
                {t('joinBtn')}
              </button>
            </form>
            {subscribed && (
              <p className="text-xs text-[#D9D9D9] font-medium">
                Invitation confirmed. Welcome to PYTHOX WORLD.
              </p>
            )}
          </div>

          {/* Right (3 cols): Store Address, Support Email & WhatsApp Link */}
          <div className="lg:col-span-3 space-y-4">
            <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-[#A8A39B]">
              FLAGSHIP &amp; CONCIERGE
            </p>
            <ul className="space-y-3 text-xs text-[#D9D9D9]">
              <li className="flex items-start gap-3">
                <span className="h-8 w-8 rounded-lg bg-[#161616] border border-[#292929] flex items-center justify-center shrink-0 text-white">
                  <MapPin className="h-4 w-4" />
                </span>
                <div>
                  <p className="font-semibold text-white">Savar Flagship</p>
                  <p className="text-[#A8A39B] leading-relaxed">{settings.businessAddress}</p>
                </div>
              </li>
              <li className="flex items-center gap-3">
                <span className="h-8 w-8 rounded-lg bg-[#161616] border border-[#292929] flex items-center justify-center shrink-0 text-white">
                  <Mail className="h-4 w-4" />
                </span>
                <a href={`mailto:${settings.supportEmail}`} className="hover:text-white transition-colors truncate">
                  {settings.supportEmail}
                </a>
              </li>
              <li className="flex items-center gap-3">
                <span className="h-8 w-8 rounded-lg bg-[#161616] border border-[#292929] flex items-center justify-center shrink-0 text-white">
                  <PhoneCall className="h-4 w-4" />
                </span>
                <a
                  href={waHref}
                  target="_blank"
                  rel="noreferrer"
                  className="font-mono hover:text-white transition-colors"
                >
                  +{settings.whatsappNumber}
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="mt-10 pt-7 border-t border-[#292929] flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-[#A8A39B] flex items-center gap-2 text-center sm:text-left">
            <span>© 2026 PYTHOX WORLD · {settings.businessAddress}</span>
            <Link
              to="/admin"
              aria-label="Portal"
              className="inline-flex items-center justify-center text-[#555555] hover:text-[#A8A39B] opacity-60 hover:opacity-100 transition-opacity duration-200"
            >
              <Lock className="h-3 w-3" strokeWidth={1.6} />
            </Link>
          </p>
          <nav
            aria-label="Footer Navigation"
            className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 font-mono text-[11px] uppercase tracking-wider text-[#A8A39B]"
          >
            <Link to="/shop" className="py-1 hover:text-white transition-colors">
              Shop All
            </Link>
            <Link to="/about" className="py-1 hover:text-white transition-colors">
              About Us
            </Link>
            <Link to="/contact" className="py-1 hover:text-white transition-colors">
              Contact
            </Link>
            <Link to="/track-order" className="py-1 hover:text-white transition-colors">
              Track Order
            </Link>
            <Link to="/privacy" className="py-1 hover:text-white transition-colors">
              Privacy
            </Link>
            <Link to="/terms" className="py-1 hover:text-white transition-colors">
              Terms
            </Link>
          </nav>
        </div>
      </div>
    </footer>
  );
};
