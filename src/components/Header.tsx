import React, { useEffect, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import {
  ChevronRight,
  Globe,
  Heart,
  Menu,
  PackageSearch,
  QrCode,
  Search,
  ShoppingBag,
  X,
} from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { BrandLogo } from './BrandLogo';

const PRIMARY_LINKS = [
  { label: 'Shop', to: '/shop' },
  { label: 'Categories', to: '/categories' },
  { label: 'New Arrivals', to: '/new-arrivals' },
  { label: 'Offers', to: '/sale' },
];

export const Header: React.FC = () => {
  const {
    cart,
    wishlist,
    language,
    setLanguage,
    isSearchOpen,
    isMobileMenuOpen,
    setIsMobileMenuOpen,
    setIsCartOpen,
    setIsSearchOpen,
    setIsQrScannerOpen,
  } = useStore();
  const location = useLocation();

  const [isScrolled, setIsScrolled] = useState(false);

  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [location.pathname, location.search, setIsMobileMenuOpen]);

  useEffect(() => {
    setIsScrolled(window.scrollY > 20);

    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    if (!isMobileMenuOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsMobileMenuOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isMobileMenuOpen, setIsMobileMenuOpen]);

  // Hide the header while the full-screen search overlay is open
  if (isSearchOpen) return null;

  return (
    <>
      <header className={`glass-pill-nav${isScrolled ? ' scrolled' : ''}`}>
        <div className="glass-pill-nav-inner">
          {/* Left: Prominent Framed Logo Emblem + Separated Brand Wordmark */}
          <div className="flex items-center gap-3 shrink-0">
            <Link
              to="/"
              aria-label="PYTHOX WORLD Home"
              className="flex items-center gap-3 shrink-0 rounded-[12px] group focus-visible:outline-none"
            >
              <BrandLogo
                className="h-10 w-10 sm:h-11 sm:w-11 transition-transform duration-200 group-hover:scale-[1.04]"
                zoomOnly
              />
              <div className="flex flex-col leading-none">
                <span className="font-editorial font-bold tracking-[0.12em] text-white text-[13px] sm:text-[15px] whitespace-nowrap">
                  PYTHOX WORLD
                </span>
                <span className="hidden sm:block font-mono text-[9px] uppercase tracking-[0.22em] text-white/60 mt-1">
                  Dhaka · Archive
                </span>
              </div>
            </Link>
            <span
              aria-hidden="true"
              className="hidden min-[860px]:block h-6 w-px bg-white/15 ml-2"
            />
          </div>

          {/* Center: Clean Editorial Navigation Links (>= 820px) */}
          <nav
            aria-label="Primary Navigation"
            className="hidden min-[820px]:flex items-center gap-1.5"
          >
            {PRIMARY_LINKS.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `relative px-3.5 py-2 rounded-[11px] text-[13px] whitespace-nowrap transition-all duration-150 ${
                    isActive
                      ? 'text-white bg-white/[0.15] border border-white/20 font-semibold shadow-[inset_0_1px_0_rgba(255,255,255,0.2)]'
                      : 'text-white/75 hover:text-white hover:bg-white/[0.08] border border-transparent font-medium'
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>

          {/* Right: Frosted Glass Search, Cart, and Menu Controls */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <button
              type="button"
              onClick={() => {
                setIsMobileMenuOpen(false);
                setIsSearchOpen(true);
              }}
              aria-label="Search products"
              className="h-9 w-9 sm:h-10 sm:w-10 rounded-[11px] bg-white/[0.08] border border-white/12 hover:bg-white/[0.18] hover:border-white/25 active:scale-[0.96] text-white flex items-center justify-center transition-all duration-150 cursor-pointer"
            >
              <Search className="h-[17px] w-[17px]" strokeWidth={1.85} />
            </button>

            <button
              type="button"
              onClick={() => {
                setIsMobileMenuOpen(false);
                setIsCartOpen(true);
              }}
              aria-label={`Shopping bag, ${cartCount} item${cartCount === 1 ? '' : 's'}`}
              className="relative h-9 w-9 sm:h-10 sm:w-10 rounded-[11px] bg-white/[0.08] border border-white/12 hover:bg-white/[0.18] hover:border-white/25 active:scale-[0.96] text-white flex items-center justify-center transition-all duration-150 cursor-pointer"
            >
              <ShoppingBag className="h-[17px] w-[17px]" strokeWidth={1.85} />
              {cartCount > 0 && (
                <span
                  key={cartCount}
                  className="badge-pop absolute -top-1 -right-1 min-w-[17px] h-[17px] px-1 rounded-full bg-[#ff3b2f] text-white text-[9.5px] font-semibold leading-none flex items-center justify-center tabular-nums shadow-sm pointer-events-none"
                >
                  {cartCount}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              aria-label={
                isMobileMenuOpen
                  ? 'Close navigation menu'
                  : 'Open navigation menu'
              }
              aria-expanded={isMobileMenuOpen}
              aria-controls="header-menu-dropdown"
              className={`h-9 sm:h-10 px-3 sm:px-4 rounded-[11px] border inline-flex items-center justify-center gap-1.5 font-semibold text-[12px] sm:text-[13px] leading-none active:scale-[0.97] transition-all duration-150 cursor-pointer ${
                isMobileMenuOpen
                  ? 'bg-white/[0.16] border-white/30 text-white'
                  : 'bg-white/95 border-white text-[#0A0A0A] hover:bg-white shadow-sm'
              }`}
            >
              {isMobileMenuOpen ? (
                <X className="h-4 w-4" strokeWidth={2.1} />
              ) : (
                <Menu className="h-4 w-4" strokeWidth={2.1} />
              )}
              <span className="hidden sm:inline">
                {isMobileMenuOpen ? 'Close' : 'Menu'}
              </span>
            </button>
          </div>
        </div>
      </header>

      {/* Animated Menu Popup */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <>
            <motion.div
              key="menu-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18, ease: 'easeOut' }}
              className="fixed inset-0 z-[68] bg-black/45"
              aria-hidden="true"
              onClick={() => setIsMobileMenuOpen(false)}
            />
            <motion.nav
              key="menu-panel"
              id="header-menu-dropdown"
              aria-label="Store Menu"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              className={`glass-pill-dropdown flex flex-col gap-4${
                isScrolled ? ' scrolled' : ''
              }`}
            >
              {/* Popup Top Header */}
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <span className="font-mono text-[10.5px] uppercase tracking-[0.2em] text-[#A8A39B]">
                  Menu · PYTHOX WORLD
                </span>
                <button
                  type="button"
                  onClick={() => setIsMobileMenuOpen(false)}
                  aria-label="Close navigation menu"
                  className="h-9 w-9 rounded-[10px] bg-white/[0.08] border border-white/10 hover:bg-white/[0.16] text-white flex items-center justify-center active:scale-[0.96] transition-all cursor-pointer"
                >
                  <X className="h-4 w-4" strokeWidth={2} />
                </button>
              </div>

              {/* Section 1: Primary Storefront Links (comfortable mobile stack < 820px) */}
              <div className="min-[820px]:hidden space-y-2">
                <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#8E8A82] px-1">
                  Collections
                </p>
                <div className="grid grid-cols-1 gap-1.5">
                  {PRIMARY_LINKS.map((item) => (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      className={({ isActive }) =>
                        `min-h-[46px] px-3.5 py-2.5 rounded-[12px] flex items-center justify-between text-[14px] transition-colors duration-150 ${
                          isActive
                            ? 'bg-[#F3F2EE] text-[#0A0A0A] font-semibold'
                            : 'bg-white/[0.04] border border-white/[0.06] text-[#EAE8E3] hover:bg-white/[0.1] hover:text-white font-medium'
                        }`
                      }
                    >
                      <span>{item.label}</span>
                      <ChevronRight className="h-4 w-4 opacity-60 shrink-0" />
                    </NavLink>
                  ))}
                </div>
              </div>

              {/* Section 2: Quick Utilities */}
              <div className="space-y-2">
                <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#8E8A82] px-1">
                  Quick Actions
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <NavLink
                    to="/track-order"
                    className={({ isActive }) =>
                      `min-h-[46px] flex items-center justify-between px-3.5 py-2.5 rounded-[12px] border text-[13px] font-medium transition-colors duration-150 ${
                        isActive
                          ? 'bg-[#F3F2EE] border-[#F3F2EE] text-[#0A0A0A] font-semibold'
                          : 'bg-white/[0.04] border-white/[0.08] hover:bg-white/[0.1] hover:border-white/20 text-[#EAE8E3] hover:text-white'
                      }`
                    }
                  >
                    <span className="flex items-center gap-2.5">
                      <PackageSearch className="h-4 w-4 shrink-0" />
                      <span>Track Order</span>
                    </span>
                    <ChevronRight className="h-3.5 w-3.5 opacity-55 sm:hidden" />
                  </NavLink>

                  <NavLink
                    to="/wishlist"
                    className={({ isActive }) =>
                      `min-h-[46px] flex items-center justify-between px-3.5 py-2.5 rounded-[12px] border text-[13px] font-medium transition-colors duration-150 ${
                        isActive
                          ? 'bg-[#F3F2EE] border-[#F3F2EE] text-[#0A0A0A] font-semibold'
                          : 'bg-white/[0.04] border-white/[0.08] hover:bg-white/[0.1] hover:border-white/20 text-[#EAE8E3] hover:text-white'
                      }`
                    }
                  >
                    {({ isActive }) => (
                      <>
                        <span className="flex items-center gap-2.5">
                          <Heart className="h-4 w-4 shrink-0" />
                          <span>Wishlist</span>
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded-md text-[11px] font-mono tabular-nums ${
                            isActive
                              ? 'bg-[#0A0A0A] text-white'
                              : 'bg-white/[0.12] text-white'
                          }`}
                        >
                          {wishlist.length}
                        </span>
                      </>
                    )}
                  </NavLink>

                  <button
                    type="button"
                    onClick={() => {
                      setIsMobileMenuOpen(false);
                      setIsQrScannerOpen(true);
                    }}
                    className="min-h-[46px] flex items-center justify-between px-3.5 py-2.5 rounded-[12px] bg-white/[0.04] border border-white/[0.08] hover:bg-white/[0.1] hover:border-white/20 text-[#EAE8E3] hover:text-white text-[13px] font-medium transition-colors duration-150 cursor-pointer text-left"
                  >
                    <span className="flex items-center gap-2.5">
                      <QrCode className="h-4 w-4 shrink-0" />
                      <span>Scan QR Tag</span>
                    </span>
                    <ChevronRight className="h-3.5 w-3.5 opacity-55 sm:hidden" />
                  </button>
                </div>
              </div>

              {/* Section 3: Support Links & Language Toggle */}
              <div className="pt-3 border-t border-white/10 flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-1.5 text-[12.5px]">
                  {[
                    { label: 'About', to: '/about' },
                    { label: 'Size Guide', to: '/size-guide' },
                    { label: 'Contact', to: '/contact' },
                  ].map((link) => (
                    <NavLink
                      key={link.to}
                      to={link.to}
                      className={({ isActive }) =>
                        `min-h-[36px] inline-flex items-center px-3 rounded-[9px] transition-colors ${
                          isActive
                            ? 'bg-white/[0.16] text-white font-semibold'
                            : 'text-[#B5B1A9] hover:text-white hover:bg-white/[0.08]'
                        }`
                      }
                    >
                      {link.label}
                    </NavLink>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={() => setLanguage(language === 'en' ? 'bn' : 'en')}
                  aria-label="Toggle language"
                  className="btn-base btn-dark-ghost min-h-[38px] px-3.5 font-mono text-[11px]"
                >
                  <Globe className="h-3.5 w-3.5 text-[#B5B1A9]" />
                  <span>{language === 'en' ? 'EN · বাংলা' : 'বাংলা · EN'}</span>
                </button>
              </div>
            </motion.nav>
          </>
        )}
      </AnimatePresence>
    </>
  );
};
