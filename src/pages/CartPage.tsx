import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Minus, Plus, Trash2, X } from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { formatBDT } from '../lib/formatters';
import { SeoHead } from '../components/SeoHead';

export const CartPage: React.FC = () => {
  const {
    cart,
    settings,
    appliedCoupon,
    updateCartQuantity,
    removeFromCart,
    applyCouponCode,
    removeCoupon,
  } = useStore();
  const navigate = useNavigate();

  const [promoInput, setPromoInput] = useState('');
  const [applyingPromo, setApplyingPromo] = useState(false);
  const [promoMsg, setPromoMsg] = useState<{ ok: boolean; text: string } | null>(
    null
  );

  const subtotal = cart.reduce((sum, i) => sum + i.price * i.quantity, 0);
  const freeThreshold = settings.freeShippingThreshold || 3000;
  const estimatedShipping =
    subtotal === 0 ? 0 : subtotal >= freeThreshold ? 0 : settings.insideDhakaCharge;

  const discount = appliedCoupon
    ? appliedCoupon.discountType === 'percentage'
      ? Math.round((subtotal * appliedCoupon.value) / 100)
      : appliedCoupon.value
    : 0;

  const total = Math.max(0, subtotal + estimatedShipping - discount);

  const handleApplyPromo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!promoInput.trim() || applyingPromo) return;
    setApplyingPromo(true);
    try {
      const res = await applyCouponCode(promoInput);
      setPromoMsg({ ok: res.ok, text: res.message });
      if (res.ok) setPromoInput('');
    } finally {
      setApplyingPromo(false);
    }
  };

  return (
    <main className="mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-10 py-6 sm:py-8 lg:py-12 pb-20 sm:pb-16">
      <SeoHead
        title="Shopping Bag — PYTHOX WORLD"
        description="Review your selected men's apparel and accessories, apply promo codes, and proceed to checkout."
      />

      <div className="border-b border-[#D9D9D9] pb-5">
        <p className="text-[11px] font-mono font-semibold uppercase tracking-[0.2em] text-[#5C5C5C]">
          PYTHOX WORLD
        </p>
        <h1 className="mt-1 text-3xl sm:text-4xl font-editorial font-semibold text-[#0A0A0A]">
          Shopping Bag
        </h1>
      </div>

      {cart.length === 0 ? (
        <div className="mt-8 rounded-3xl border border-[#D9D9D9] bg-[#EAE9E4] py-14 px-6 text-center">
          <p className="font-editorial text-2xl text-[#0A0A0A]">
            Your shopping bag is empty
          </p>
          <p className="mt-2 text-sm text-[#292929]">
            Discover our men&apos;s oversized tees, polos, denim, bombers, sneakers, and watches.
          </p>
          <Link
            to="/shop"
            className="mt-6 btn-base btn-primary"
          >
            Continue Shopping
          </Link>
        </div>
      ) : (
        <div className="mt-8 grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-start">
          {/* Left: Cart Items */}
          <div className="lg:col-span-8 divide-y divide-[#D9D9D9] border-t border-b border-[#D9D9D9]">
            {cart.map((item) => (
              <div
                key={item.id}
                className="py-5 sm:py-6 flex gap-4 sm:gap-6 items-start"
              >
                <Link
                  to={`/product/${item.slug}`}
                  className="h-24 w-20 sm:h-32 sm:w-26 shrink-0 rounded-2xl bg-[#EAE9E4] overflow-hidden border border-[#D9D9D9]"
                >
                  <img
                    src={item.image}
                    alt={item.name}
                    referrerPolicy="no-referrer"
                    className="h-full w-full object-cover"
                  />
                </Link>

                <div className="flex-1 min-w-0 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="min-w-0">
                    <Link
                      to={`/product/${item.slug}`}
                      className="text-base font-medium text-[#0A0A0A] hover:underline block truncate"
                    >
                      {item.name}
                    </Link>
                    <p className="mt-1 text-xs text-[#292929]">
                      Color: {item.color} · Size: {item.size}
                    </p>
                    {item.sku && (
                      <p className="text-[11px] font-mono text-[#5C5C5C]">
                        SKU: {item.sku}
                      </p>
                    )}
                    <p className="mt-1 text-xs font-mono tabular-nums text-[#292929]">
                      {formatBDT(item.price)} each
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center justify-between sm:justify-end gap-3 sm:gap-5">
                    <div className="inline-flex items-center rounded-[10px] border border-[#D4D3CE] bg-white">
                      <button
                        type="button"
                        onClick={() =>
                          updateCartQuantity(item.id, item.quantity - 1)
                        }
                        aria-label="Decrease quantity"
                        className="h-10 w-10 flex items-center justify-center text-[#0A0A0A] hover:bg-[#F3F2EE] rounded-l-[9px] transition-colors cursor-pointer"
                      >
                        <Minus className="h-3.5 w-3.5" />
                      </button>
                      <span className="w-9 text-center text-xs font-mono tabular-nums font-semibold text-[#0A0A0A]">
                        {item.quantity}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          updateCartQuantity(item.id, item.quantity + 1)
                        }
                        aria-label="Increase quantity"
                        className="h-10 w-10 flex items-center justify-center text-[#0A0A0A] hover:bg-[#F3F2EE] rounded-r-[9px] transition-colors cursor-pointer"
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    <div className="flex items-center gap-2 sm:gap-4">
                      <span className="sm:min-w-[84px] text-right text-sm font-mono font-semibold tabular-nums text-[#0A0A0A]">
                        {formatBDT(item.price * item.quantity)}
                      </span>

                      <button
                        type="button"
                        onClick={() => removeFromCart(item.id)}
                        aria-label={`Remove ${item.name}`}
                        className="btn-base btn-secondary btn-icon h-9 w-9 min-h-[36px] min-w-[36px] text-[#5C5C5C] hover:text-[#0A0A0A]"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Right: Order Summary */}
          <aside className="lg:col-span-4 rounded-2xl sm:rounded-3xl border border-[#D9D9D9] bg-white p-5 sm:p-7 space-y-5 lg:sticky lg:top-[72px]">
            <h2 className="text-xl font-editorial font-semibold text-[#0A0A0A]">
              Order Summary
            </h2>

            <form onSubmit={handleApplyPromo} className="space-y-2">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={promoInput}
                  onChange={(e) => setPromoInput(e.target.value)}
                  placeholder="Enter promo code"
                  className="flex-1 min-w-0 min-h-[42px] rounded-[10px] border border-[#D4D3CE] bg-white px-3 py-2 text-xs text-[#0A0A0A] placeholder:text-[#6A6A6A] focus:border-[#0A0A0A] focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={applyingPromo}
                  className="btn-base btn-secondary min-h-[42px] px-4 shrink-0"
                >
                  {applyingPromo ? 'Checking...' : 'Apply'}
                </button>
              </div>
              {promoMsg && (
                <p
                  className={`text-xs rounded-xl px-3 py-2 border ${
                    promoMsg.ok
                      ? 'text-[#0A0A0A] bg-[#F3F2EE] border-[#D9D9D9]'
                      : 'text-[#0A0A0A] bg-[#EAE9E4] border-[#0A0A0A] font-medium'
                  }`}
                >
                  {promoMsg.text}
                </p>
              )}
              {appliedCoupon && (
                <div className="flex items-center justify-between text-xs rounded-xl bg-[#F3F2EE] border border-[#D9D9D9] px-3 py-2 text-[#0A0A0A]">
                  <span className="font-mono font-medium">
                    Applied: {appliedCoupon.code}
                  </span>
                  <button
                    type="button"
                    onClick={removeCoupon}
                    aria-label="Remove coupon"
                    className="p-1 text-[#5C5C5C] hover:text-[#0A0A0A] cursor-pointer"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
            </form>

            <div className="space-y-3 pt-4 border-t border-[#D9D9D9] text-sm tabular-nums">
              <div className="flex justify-between text-[#292929]">
                <span>Subtotal</span>
                <span>{formatBDT(subtotal)}</span>
              </div>
              <div className="flex justify-between text-[#292929]">
                <span>Estimated Delivery (Dhaka / Savar)</span>
                <span>
                  {estimatedShipping === 0 ? 'Free' : formatBDT(estimatedShipping)}
                </span>
              </div>
              {discount > 0 && (
                <div className="flex justify-between text-[#0A0A0A] font-medium">
                  <span>Discount</span>
                  <span>-{formatBDT(discount)}</span>
                </div>
              )}
              <div className="flex justify-between pt-3 border-t border-[#D9D9D9] text-base font-semibold text-[#0A0A0A]">
                <span>Total</span>
                <span>{formatBDT(total)}</span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => navigate('/checkout')}
              className="btn-base btn-primary btn-lg w-full"
            >
              Proceed to Checkout
            </button>
          </aside>
        </div>
      )}
    </main>
  );
};
