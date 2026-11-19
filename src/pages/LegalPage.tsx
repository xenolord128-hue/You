import React from 'react';
import { Link } from 'react-router-dom';
import { SeoHead } from '../components/SeoHead';
import { BRAND_LOCATION } from '../config/storeConfig';

interface LegalPageProps {
  mode: 'shipping' | 'returns' | 'privacy' | 'terms';
}

const META: Record<
  LegalPageProps['mode'],
  { title: string; heading: string; description: string }
> = {
  shipping: {
    title: 'Shipping Policy — PYTHOX WORLD',
    heading: 'Shipping Policy',
    description:
      'Delivery charges, timelines inside Dhaka/Savar and nationwide across Bangladesh for PYTHOX WORLD orders.',
  },
  returns: {
    title: 'Return & Exchange Policy — PYTHOX WORLD',
    heading: 'Return & Exchange Policy',
    description:
      '7-day size exchange and return policy for PYTHOX WORLD men’s clothing and accessories.',
  },
  privacy: {
    title: 'Privacy Policy — PYTHOX WORLD',
    heading: 'Privacy Policy',
    description:
      'How PYTHOX WORLD protects customer contact, payment, and delivery data across Bangladesh.',
  },
  terms: {
    title: 'Terms & Conditions — PYTHOX WORLD',
    heading: 'Terms & Conditions',
    description:
      'Terms governing purchases, pricing, and location services on PYTHOX WORLD.',
  },
};

export const LegalPage: React.FC<LegalPageProps> = ({ mode }) => {
  const meta = META[mode];

  return (
    <main className="mx-auto max-w-[960px] px-4 sm:px-6 lg:px-10 py-6 sm:py-8 lg:py-12 pb-20 sm:pb-16">
      <SeoHead title={meta.title} description={meta.description} />

      <div className="border-b border-[#D9D9D9] pb-8">
        <p className="text-[11px] font-mono font-semibold uppercase tracking-[0.2em] text-[#5C5C5C]">
          PYTHOX WORLD Policy
        </p>
        <h1 className="mt-2 text-3xl sm:text-5xl font-editorial font-semibold text-[#0A0A0A]">
          {meta.heading}
        </h1>
        <p className="mt-3 text-xs font-mono text-[#5C5C5C]">
          Updated 2026 · PYTHOX WORLD · {BRAND_LOCATION}
        </p>
      </div>

      <div className="mt-10 space-y-8 text-sm text-[#292929] leading-relaxed">
        {mode === 'shipping' && (
          <>
            <section className="space-y-3">
              <h2 className="text-xl font-editorial font-semibold text-[#0A0A0A]">
                1. Delivery Charges &amp; Free Delivery Threshold
              </h2>
              <p>
                Inside Dhaka Metro &amp; Savar: <strong className="text-[#0A0A0A]">৳80</strong> for Standard Delivery. Outside Dhaka (nationwide 64 districts): <strong className="text-[#0A0A0A]">৳130</strong>. Orders subtotaling <strong className="text-[#0A0A0A]">৳3,000 or more</strong> receive complimentary standard shipping across Bangladesh.
              </p>
            </section>
            <section className="space-y-3">
              <h2 className="text-xl font-editorial font-semibold text-[#0A0A0A]">
                2. Dispatch &amp; Transit Timelines
              </h2>
              <p>
                Orders confirmed before 3:00 PM BST dispatch the same afternoon from our Savar hub ({BRAND_LOCATION}). Delivery takes 24–48 hours inside Dhaka/Savar and 3–5 business days outside Dhaka.
              </p>
            </section>
            <section className="space-y-3">
              <h2 className="text-xl font-editorial font-semibold text-[#0A0A0A]">
                3. Live Order Tracking
              </h2>
              <p>
                Every parcel includes real-time milestone updates. Visit{' '}
                <Link to="/track-order" className="text-[#0A0A0A] underline underline-offset-4">
                  Track Order
                </Link>{' '}
                with your Order ID and mobile number at any time.
              </p>
            </section>
          </>
        )}

        {mode === 'returns' && (
          <>
            <section className="space-y-3">
              <h2 className="text-xl font-editorial font-semibold text-[#0A0A0A]">
                1. 7-Day Easy Size Exchange &amp; Return
              </h2>
              <p>
                We gladly offer size exchanges or returns within 7 days of receiving your order. Items must be unworn, unwashed, and complete with original PYTHOX WORLD tags and packaging.
              </p>
            </section>
            <section className="space-y-3">
              <h2 className="text-xl font-editorial font-semibold text-[#0A0A0A]">
                2. Defective or Incorrect Items
              </h2>
              <p>
                If you receive an incorrect size or manufacturing defect, courier exchange charges are 100% covered by PYTHOX WORLD. Reach out within 48 hours of delivery via{' '}
                <Link to="/contact" className="text-[#0A0A0A] underline underline-offset-4">
                  Contact Us
                </Link>{' '}
                or WhatsApp.
              </p>
            </section>
            <section className="space-y-3">
              <h2 className="text-xl font-editorial font-semibold text-[#0A0A0A]">
                3. Refund Processing
              </h2>
              <p>
                Approved refunds for prepaid bKash or Nagad orders are processed back to the sender mobile wallet within 3–5 business days after parcel inspection at {BRAND_LOCATION}.
              </p>
            </section>
          </>
        )}

        {mode === 'privacy' && (
          <>
            <section className="space-y-3">
              <h2 className="text-xl font-editorial font-semibold text-[#0A0A0A]">
                1. Customer Information Collected
              </h2>
              <p>
                PYTHOX WORLD collects your name, mobile number, email address, and delivery address solely to process men&apos;s fashion orders, compute Inside/Outside Dhaka shipping rates, and provide order tracking support.
              </p>
            </section>
            <section className="space-y-3">
              <h2 className="text-xl font-editorial font-semibold text-[#0A0A0A]">
                2. Meta Pixel &amp; Analytics
              </h2>
              <p>
                When configured by the store administrator, Meta Pixel event signals (PageView, ViewContent, AddToCart, InitiateCheckout, Purchase) may be used to measure storefront performance and ad relevance without selling personal contact lists.
              </p>
            </section>
            <section className="space-y-3">
              <h2 className="text-xl font-editorial font-semibold text-[#0A0A0A]">
                3. Location Services
              </h2>
              <p>
                Address autocomplete and store locator maps utilize Google Maps Platform and are subject to the{' '}
                <a
                  href="https://policies.google.com/privacy"
                  target="_blank"
                  rel="noreferrer"
                  className="text-[#0A0A0A] underline underline-offset-4"
                >
                  Google Privacy Policy
                </a>
                .
              </p>
            </section>
          </>
        )}

        {mode === 'terms' && (
          <>
            <section className="space-y-3">
              <h2 className="text-xl font-editorial font-semibold text-[#0A0A0A]">
                1. Pricing, Currency &amp; Payment
              </h2>
              <p>
                All prices on PYTHOX WORLD are stated in Bangladeshi Taka (BDT ৳). Accepted payment methods are Cash on Delivery, bKash, and Nagad.
              </p>
            </section>
            <section className="space-y-3">
              <h2 className="text-xl font-editorial font-semibold text-[#0A0A0A]">
                2. Order Acceptance &amp; Cancellations
              </h2>
              <p>
                Orders may be tracked anytime on{' '}
                <Link to="/track-order" className="text-[#0A0A0A] underline underline-offset-4">
                  Order Tracking
                </Link>{' '}
                and cancelled prior to packing and dispatch by contacting our Savar office ({BRAND_LOCATION}).
              </p>
            </section>
            <section className="space-y-3">
              <h2 className="text-xl font-editorial font-semibold text-[#0A0A0A]">
                3. Google Maps End User Terms
              </h2>
              <p>
                Location autocomplete and interactive map features are powered by Google Maps Platform and subject to the{' '}
                <a
                  href="https://www.google.com/help/terms_maps/"
                  target="_blank"
                  rel="noreferrer"
                  className="text-[#0A0A0A] underline underline-offset-4"
                >
                  Google Maps / Google Earth Additional Terms of Service
                </a>
                .
              </p>
            </section>
          </>
        )}
      </div>
    </main>
  );
};
