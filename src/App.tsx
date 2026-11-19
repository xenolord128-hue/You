import React, { useEffect, useState } from 'react';
import { BrowserRouter, Route, Routes, useLocation } from 'react-router-dom';
import { MotionConfig } from 'motion/react';
import { APIProvider } from '@vis.gl/react-google-maps';
import { StoreProvider, useStore } from './context/StoreContext';
import { Header } from './components/Header';
import { Footer } from './components/Footer';
import { CartDrawer } from './components/CartDrawer';
import { SearchOverlay } from './components/SearchOverlay';
import { FloatingContact } from './components/FloatingContact';
import { SplashScreen } from './components/SplashScreen';
import { QrScannerModal } from './components/QrScannerModal';
import { ErrorBoundary } from './components/ErrorBoundary';
import { HomePage } from './pages/HomePage';
import { ShopPage } from './pages/ShopPage';
import { ProductDetailPage } from './pages/ProductDetailPage';
import { CollectionPage } from './pages/CollectionPage';
import { CartPage } from './pages/CartPage';
import { CheckoutPage } from './pages/CheckoutPage';
import { OrderConfirmationPage } from './pages/OrderConfirmationPage';
import { TrackOrderPage } from './pages/TrackOrderPage';
import { WishlistPage } from './pages/WishlistPage';
import { AboutPage } from './pages/AboutPage';
import { ContactPage } from './pages/ContactPage';
import { BlogPage } from './pages/BlogPage';
import { SizeGuidePage } from './pages/SizeGuidePage';
import { LegalPage } from './pages/LegalPage';
import { AdminPage } from './pages/AdminPage';

const ScrollToTop: React.FC = () => {
  const { pathname, search } = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, [pathname, search]);
  return null;
};

const QuotaBanner: React.FC<{ visible: boolean; onDismiss: () => void }> = ({
  visible,
  onDismiss,
}) => {
  if (!visible) return null;
  return (
    <div className="sticky top-0 z-50 bg-[#EAE9E4] border-b border-[#D9D9D9] text-[#0A0A0A] px-4 py-2.5 text-xs sm:text-sm flex items-center justify-between gap-4">
      <p>
        Demo Google Maps quota exceeded.{' '}
        <a
          href="https://developers.google.com/maps/ai/ai-studio?utm_campaign=gmp_mcp_codeassist_v1_aistudio#quota_exceeded_errors"
          target="_blank"
          rel="noreferrer"
          className="font-semibold underline underline-offset-2"
        >
          Link a Cloud Billing project in AI Studio
        </a>{' '}
        to continue using interactive maps and address autocomplete without limits.
      </p>
      <button
        type="button"
        onClick={onDismiss}
        className="btn-base btn-secondary btn-sm shrink-0"
      >
        Dismiss
      </button>
    </div>
  );
};

const AppShell: React.FC = () => {
  const { mapsApiKey, toast } = useStore();
  const location = useLocation();
  const isAdminRoute = location.pathname.startsWith('/admin');
  const [quotaExceeded, setQuotaExceeded] = useState(false);

  useEffect(() => {
    const handler = () => setQuotaExceeded(true);
    window.addEventListener('gmp-quota-exceeded', handler);
    return () => window.removeEventListener('gmp-quota-exceeded', handler);
  }, []);

  const routes = (
    <MotionConfig reducedMotion="user">
      <div className="min-h-screen bg-[#F3F2EE] text-[#0A0A0A] flex flex-col">
        {!isAdminRoute && <SplashScreen />}
        <ScrollToTop />
        <QuotaBanner
          visible={quotaExceeded}
          onDismiss={() => setQuotaExceeded(false)}
        />

        {!isAdminRoute && <Header />}
        {!isAdminRoute && <div className="h-[54px] shrink-0" aria-hidden="true" />}

        <main className="flex-1">
          <div key={location.pathname} className="page-enter">
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/shop" element={<ShopPage />} />
              <Route path="/categories" element={<ShopPage />} />
              <Route path="/search" element={<ShopPage />} />
              <Route path="/new-arrivals" element={<ShopPage mode="new" />} />
              <Route path="/best-sellers" element={<ShopPage mode="best-sellers" />} />
              <Route path="/trending" element={<ShopPage mode="trending" />} />
              <Route path="/winter-collection" element={<ShopPage mode="winter" />} />
              <Route path="/sale" element={<ShopPage mode="sale" />} />
              <Route path="/product/:slug" element={<ProductDetailPage />} />
              <Route path="/collection/:slug" element={<CollectionPage />} />
              <Route path="/cart" element={<CartPage />} />
              <Route path="/checkout" element={<CheckoutPage />} />
              <Route path="/order-confirmation/:orderNumber" element={<OrderConfirmationPage />} />
              <Route path="/track-order" element={<TrackOrderPage />} />
              <Route path="/wishlist" element={<WishlistPage />} />
              <Route path="/about" element={<AboutPage />} />
              <Route path="/contact" element={<ContactPage />} />
              <Route path="/size-guide" element={<SizeGuidePage />} />
              <Route path="/shipping-policy" element={<LegalPage mode="shipping" />} />
              <Route path="/return-policy" element={<LegalPage mode="returns" />} />
              <Route path="/privacy-policy" element={<LegalPage mode="privacy" />} />
              <Route path="/privacy" element={<LegalPage mode="privacy" />} />
              <Route path="/terms-and-conditions" element={<LegalPage mode="terms" />} />
              <Route path="/terms" element={<LegalPage mode="terms" />} />
              <Route path="/blog" element={<BlogPage />} />
              <Route path="/admin/*" element={<AdminPage />} />
              <Route path="*" element={<HomePage />} />
            </Routes>
          </div>
        </main>

        {!isAdminRoute && <Footer />}
        {!isAdminRoute && <CartDrawer />}
        {!isAdminRoute && <SearchOverlay />}
        {!isAdminRoute && <QrScannerModal />}
        {!isAdminRoute && <FloatingContact />}

        {toast && (
          <div
            role="status"
            aria-live="polite"
            className="fixed bottom-5 left-4 right-4 sm:left-auto sm:right-5 z-[95] bg-[#0A0A0A] text-white border border-[#292929] rounded-xl px-5 py-3 text-xs font-medium tracking-[0.04em] shadow-lg modal-enter text-center sm:text-left"
          >
            {toast}
          </div>
        )}
      </div>
    </MotionConfig>
  );

  if (mapsApiKey) {
    return (
      <APIProvider apiKey={mapsApiKey} language="en" region="BD">
        {routes}
      </APIProvider>
    );
  }

  return routes;
};

export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <StoreProvider>
          <AppShell />
        </StoreProvider>
      </BrowserRouter>
    </ErrorBoundary>
  );
}
