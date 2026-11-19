import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Minus, Plus, ShoppingBag, Trash2, X } from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { formatBDT } from '../lib/formatters';

export const CartDrawer: React.FC = () => {
  const {
    cart,
    settings,
    isCartOpen,
    setIsCartOpen,
    updateCartQuantity,
    removeFromCart,
  } = useStore();
  const navigate = useNavigate();

  if (!isCartOpen) return null;

  const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const threshold = settings.freeShippingThreshold || 3000;
  const remaining = Math.max(0, threshold - subtotal);
  const progressPct = Math.min(100, Math.round((subtotal / threshold) * 100));

  const handleGo = (path: string) => {
    setIsCartOpen(false);
    navigate(path);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end"
      role="dialog"
      aria-modal="true"
      aria-label="Shopping Bag"
    >
      <div
        className="fixed inset-0 bg-[#0A0A0A]/55 backdrop-enter"
        onClick={() => setIsCartOpen(false)}
      />
      <aside className="relative z-10 flex h-full w-full max-w-md flex-col bg-[#F3F2EE] border-l border-[#D9D9D9] shadow-2xl drawer-enter">
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 h-16 bg-white border-b border-[#D9D9D9]">
          <h2 className="text-lg font-editorial font-bold tracking-wide text-[#0A0A0A]">
            Shopping Bag ({cart.reduce((s, i) => s + i.quantity, 0)})
          </h2>
          <button
            type="button"
            onClick={() => setIsCartOpen(false)}
            aria-label="Close shopping bag"
            className="btn-base btn-secondary btn-icon"
          >
            <X className="h-4 w-4" strokeWidth={1.85} />
          </button>
        </div>

        {/* Free Delivery Progress */}
        <div className="px-4 sm:px-6 py-4 bg-white border-b border-[#D9D9D9]">
          <p className="text-xs text-[#0A0A0A] font-medium tabular-nums">
            {remaining > 0
              ? `Add ${formatBDT(remaining)} more for FREE DELIVERY`
              : 'You have unlocked FREE DELIVERY across Bangladesh'}
          </p>
          <div className="mt-2 h-1.5 w-full rounded-full bg-[#EAE9E4] overflow-hidden">
            <div
              className="h-full rounded-full bg-[#0A0A0A] transition-all duration-300"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>

        {/* Items */}
        <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4">
          {cart.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center text-center py-12">
              <div className="h-14 w-14 rounded-2xl bg-[#EAE9E4] border border-[#D4D3CE] flex items-center justify-center mb-4">
                <ShoppingBag className="h-7 w-7 text-[#0A0A0A]" strokeWidth={1.5} />
              </div>
              <p className="text-lg font-editorial font-bold text-[#0A0A0A]">
                Your bag is empty
              </p>
              <p className="mt-1.5 text-xs text-[#5C5C5C] max-w-[240px]">
                Explore PYTHOX WORLD menswear, sneakers, watches, and essentials.
              </p>
              <button
                type="button"
                onClick={() => handleGo('/shop')}
                className="mt-6 btn-base btn-primary"
              >
                Explore Shop
              </button>
            </div>
          ) : (
            <ul className="space-y-3">
              {cart.map((item) => (
                <li
                  key={item.id}
                  className="p-3.5 rounded-2xl bg-white border border-[#D9D9D9] flex gap-3.5"
                >
                  <Link
                    to={`/product/${item.slug}`}
                    onClick={() => setIsCartOpen(false)}
                    className="h-24 w-20 shrink-0 rounded-xl bg-[#EAE9E4] overflow-hidden"
                  >
                    <img
                      src={item.image}
                      alt={item.name}
                      referrerPolicy="no-referrer"
                      className="h-full w-full object-cover"
                    />
                  </Link>
                  <div className="flex flex-1 flex-col justify-between min-w-0">
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <Link
                          to={`/product/${item.slug}`}
                          onClick={() => setIsCartOpen(false)}
                          className="text-sm font-semibold text-[#0A0A0A] truncate hover:underline"
                        >
                          {item.name}
                        </Link>
                        <button
                          type="button"
                          onClick={() => removeFromCart(item.id)}
                          aria-label={`Remove ${item.name}`}
                          className="h-8 w-8 -mt-1 -mr-1 rounded-lg flex items-center justify-center text-[#5C5C5C] hover:text-[#0A0A0A] hover:bg-[#F3F2EE] transition-colors shrink-0 cursor-pointer"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      <p className="mt-0.5 text-xs text-[#5C5C5C]">
                        {item.color} · Size {item.size}
                      </p>
                      {item.sku && (
                        <p className="text-[10px] font-mono text-[#5C5C5C]">
                          SKU: {item.sku}
                        </p>
                      )}
                    </div>

                    <div className="mt-3 flex items-center justify-between gap-2">
                      <div className="inline-flex items-center rounded-[10px] border border-[#D4D3CE] bg-[#F3F2EE]">
                        <button
                          type="button"
                          onClick={() =>
                            updateCartQuantity(item.id, item.quantity - 1)
                          }
                          aria-label="Decrease quantity"
                          className="h-9 w-9 flex items-center justify-center text-[#0A0A0A] hover:bg-[#EAE9E4] rounded-l-[9px] transition-colors cursor-pointer"
                        >
                          <Minus className="h-3.5 w-3.5" />
                        </button>
                        <span className="w-8 text-center text-xs font-mono font-semibold tabular-nums text-[#0A0A0A]">
                          {item.quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            updateCartQuantity(item.id, item.quantity + 1)
                          }
                          aria-label="Increase quantity"
                          className="h-9 w-9 flex items-center justify-center text-[#0A0A0A] hover:bg-[#EAE9E4] rounded-r-[9px] transition-colors cursor-pointer"
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      <span className="text-sm font-mono font-bold tabular-nums text-[#0A0A0A]">
                        {formatBDT(item.price * item.quantity)}
                      </span>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Footer */}
        {cart.length > 0 && (
          <div className="border-t border-[#D9D9D9] px-4 sm:px-6 py-4 sm:py-5 bg-white">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium text-[#292929]">Subtotal</span>
              <span className="text-base font-mono font-bold tabular-nums text-[#0A0A0A]">
                {formatBDT(subtotal)}
              </span>
            </div>
            <p className="mt-1 text-xs text-[#5C5C5C]">
              Delivery charge calculated at checkout.
            </p>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => handleGo('/cart')}
                className="btn-base btn-secondary w-full"
              >
                View Cart
              </button>
              <button
                type="button"
                onClick={() => handleGo('/checkout')}
                className="btn-base btn-primary w-full"
              >
                Checkout
              </button>
            </div>
          </div>
        )}
      </aside>
    </div>
  );
};
