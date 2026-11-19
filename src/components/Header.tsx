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

  const [isHidden, setIsHidden] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);

  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [location.pathname, location.search, setIsMobileMenuOpen]);

  useEffect(() => {
    let lastY = window.scrollY;
    setIsScrolled(lastY > 20);

    const handleScroll = () => {
      const y = window.scrollY;
      setIsHidden(y > lastY && y > 120);
      setIsScrolled(y > 20);
      lastY = y;
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

  // Hide the header completely while the search popup is open
  if (isSearchOpen) return null;

  const shouldHide = isHidden && !isMobileMenuOpen;

  return (
    <>
      <header
        className={`glass-pill-nav${isScrolled ? ' scrolled' : ''}${
          shouldHide ? ' hide' : ''
        }`}
      >
        <div className="glass-pill-nav-inner">
          {/* Left: Logo + Brand Wordmark */}
          <Link
            to="/"
            aria-label="PYTHOX WORLD Home"
            className="flex items-center gap-2.5 shrink-0 rounded-[10px] group"
          >
            <BrandLogo className="h-7 w-7 transition-transform duration-200 group-hover:scale-[1.03]" zoomOnly />
            <span className="font-semibold tracking-[0.04em] text-[#fbf9f5] text-[13px] sm:text-[14px] whitespace-nowrap">
              PYTHOX WORLD
            </span>
          </Link>

          {/* Center: Navigation Links (>= 820px) */}
          <nav
            aria-label="Primary Navigation"
            className="hidden min-[820px]:flex items-center gap-1"
          >
            {PRIMARY_LINKS.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `relative px-3.5 py-1.5 rounded-[10px] text-[13px] font-medium whitespace-nowrap transition-colors duration-150 ${
                    isActive
                      ? 'text-[#0A0A0A] bg-[#F3F2EE] font-semibold'
                      : 'text-[#B5B1A9] hover:text-[#FBF9F5] hover:bg-white/[0.08]'
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>

          {/* Right: Search, Cart, and Menu Button */}
          <div className="flex items-center gap-1.5 shrink-0">
            {/* Search Icon Button */}
            <button
              type="button"
              onClick={() => {
                setIsMobileMenuOpen(false);
                setIsSearchOpen(true);
              }}
              aria-label="Search products"
              className="h-9 w-9 rounded-[10px] bg-transparent hover:bg-white/[0.1] active:scale-[0.96] text-[#FBF9F5] flex items-center justify-center transition-all duration-150 cursor-pointer"
            >
              <Search className="h-[17px] w-[17px]" strokeWidth={1.85} />
            </button>

            {/* Cart Icon Button with Real Cart Count Badge */}
            <button
              type="button"
              onClick={() => {
                setIsMobileMenuOpen(false);
                setIsCartOpen(true);
              }}
              aria-label={`Shopping bag, ${cartCount} item${cartCount === 1 ? '' : 's'}`}
              className="relative h-9 w-9 rounded-[10px] bg-transparent hover:bg-white/[0.1] active:scale-[0.96] text-[#FBF9F5] flex items-center justify-center transition-all duration-150 cursor-pointer"
            >
              <ShoppingBag className="h-[17px] w-[17px]" strokeWidth={1.85} />
              {cartCount > 0 && (
                <span
                  key={cartCount}
                  className="badge-pop absolute top-1 right-1 min-w-[16px] h-[16px] px-1 rounded-full bg-[#ff3b2f] text-[#fbf9f5] text-[9.5px] font-semibold leading-none flex items-center justify-center tabular-nums pointer-events-none"
                >
                  {cartCount}
                </span>
              )}
            </button>

            {/* Menu Button */}
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
              className={`h-9 px-3 sm:px-3.5 rounded-[10px] border inline-flex items-center justify-center gap-1.5 font-semibold text-[12px] sm:text-[13px] leading-none active:scale-[0.97] transition-all duration-150 cursor-pointer ${
                isMobileMenuOpen
                  ? 'bg-white/[0.14] border-white/30 text-white'
                  : 'bg-[#F3F2EE] border-[#F3F2EE] text-[#0A0A0A] hover:bg-white'
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
              initial={{ opacity: 0, y: -10, x: '-50%' }}
              animate={{ opacity: 1, y: 0, x: '-50%' }}
              exit={{ opacity: 0, y: -8, x: '-50%' }}
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
