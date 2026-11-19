import React from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { Clock, PackageSearch } from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { formatBDT, isDhakaCity } from '../lib/formatters';
import { Order } from '../types/ecommerce';
import { BrandLogo } from '../components/BrandLogo';
import { SeoHead } from '../components/SeoHead';
import { SuccessCheckmark } from '../components/Motion';

export const OrderConfirmationPage: React.FC = () => {
  const { orderNumber } = useParams<{ orderNumber: string }>();
  const location = useLocation();
  const stateOrder = (location.state as { order?: Order } | null)?.order;
  const { orders } = useStore();

  const order =
    stateOrder ||
    orders.find(
      (o) =>
        o.orderNumber.toUpperCase() ===
        decodeURIComponent(orderNumber || '').toUpperCase()
    ) ||
    orders[0];

  if (!order) {
    return (
      <main className="mx-auto max-w-2xl px-4 sm:px-6 py-12 sm:py-16 text-center">
        <BrandLogo className="h-12 mx-auto" />
        <h1 className="mt-6 text-2xl font-editorial font-semibold text-[#0A0A0A]">
          Order Not Found
        </h1>
        <p className="mt-2 text-sm text-[#5C5C5C]">
          Use your Order ID and mobile number on our tracking page to view status updates.
        </p>
        <div className="mt-6 flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3">
          <Link
            to="/track-order"
            className="btn-base btn-primary"
          >
            Track Order
          </Link>
          <Link
            to="/shop"
            className="btn-base btn-secondary"
          >
            Shop Men&apos;s
          </Link>
        </div>
      </main>
    );
  }

  const trackUrl = `/track-order?order=${encodeURIComponent(
    order.orderNumber
  )}&phone=${encodeURIComponent(order.customerPhone)}`;

  const inDhaka = isDhakaCity(order.city);
  const expectedDelivery =
    order.deliveryMethod === 'Express Delivery'
      ? inDhaka
        ? 'Same-day / Next-morning (Within 24 hrs)'
        : '1–2 business days (Priority Dispatch)'
      : inDhaka
      ? '24–48 hours inside Dhaka & Savar'
      : '3–5 business days nationwide';

  return (
    <main className="mx-auto max-w-3xl px-4 sm:px-6 py-6 sm:py-8 lg:py-12 pb-20 sm:pb-16">
      <SeoHead
        title={`Order ${order.orderNumber} Confirmed — PYTHOX WORLD`}
        description="Your PYTHOX WORLD order confirmation and tracking link."
      />

      <div className="rounded-3xl border border-[#D9D9D9] bg-white p-6 sm:p-10 space-y-6 modal-enter">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#D9D9D9] pb-5">
          <BrandLogo className="h-11" />
          <div className="flex items-center gap-2">
            <span className="px-3 py-1 rounded-full bg-[#0A0A0A] text-white text-[11px] font-mono uppercase tracking-[0.14em]">
              {order.status}
            </span>
          </div>
        </div>

        <div className="flex items-start gap-4">
          <SuccessCheckmark size={48} />
          <div>
            <p className="text-xs font-mono uppercase tracking-[0.14em] text-[#5C5C5C]">
              Order Number: {order.orderNumber}
            </p>
            <h1 className="text-2xl sm:text-3xl font-editorial font-semibold text-[#0A0A0A]">
              Thank You, {order.customerName}
            </h1>
            <p className="mt-1 inline-flex items-center gap-1.5 text-xs text-[#292929]">
              <Clock className="h-3.5 w-3.5 text-[#0A0A0A]" /> Estimated delivery: {expectedDelivery}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 rounded-2xl bg-[#F3F2EE] border border-[#D9D9D9] p-4 text-xs text-[#292929]">
          <div>
            <p className="font-semibold uppercase tracking-[0.12em] text-[#0A0A0A]">
              Delivery Address
            </p>
            <p className="mt-1">{order.address}</p>
            <p>
              {order.area}, {order.city} {order.postalCode !== '0000' ? order.postalCode : ''}
            </p>
            <p className="mt-1 font-mono text-[#0A0A0A]">{order.customerPhone}</p>
            {order.deliveryNote && (
              <p className="mt-1 italic text-[#292929]">Note: &ldquo;{order.deliveryNote}&rdquo;</p>
            )}
          </div>
          <div>
            <p className="font-semibold uppercase tracking-[0.12em] text-[#0A0A0A]">
              Payment Details
            </p>
            <p className="mt-1">Method: {order.paymentMethod}</p>
            <p>Payment Status: {order.paymentStatus}</p>
            {order.paymentReference && (
              <p className="font-mono mt-1">TrxID: {order.paymentReference}</p>
            )}
            {order.paymentSenderNumber && (
              <p className="font-mono mt-0.5">Sender: {order.paymentSenderNumber}</p>
            )}
          </div>
        </div>

        <div className="rounded-2xl bg-[#F3F2EE] border border-[#D9D9D9] p-5 space-y-3 text-sm tabular-nums">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#5C5C5C]">
            Purchased Items
          </p>
          {order.items.map((item, i) => (
            <div key={i} className="flex justify-between items-start gap-4 border-b border-[#D9D9D9] pb-2.5 last:border-b-0 last:pb-0">
              <div>
                <p className="font-medium text-[#0A0A0A]">{item.name}</p>
                <p className="text-xs text-[#5C5C5C]">
                  Size: {item.size} · Colour: {item.color} · Qty: {item.quantity}
                </p>
              </div>
              <span className="font-medium text-[#0A0A0A]">
                {formatBDT(item.price * item.quantity)}
              </span>
            </div>
          ))}

          <div className="pt-3 border-t border-[#D9D9D9] space-y-1.5 text-xs">
            <div className="flex justify-between text-[#292929]">
              <span>Subtotal</span>
              <span>{formatBDT(order.subtotal)}</span>
            </div>
            <div className="flex justify-between text-[#292929]">
              <span>Delivery Charge ({order.deliveryMethod})</span>
              <span>
                {order.shipping === 0 ? 'Free' : formatBDT(order.shipping)}
              </span>
            </div>
            {order.discount > 0 && (
              <div className="flex justify-between text-[#0A0A0A] font-medium">
                <span>Discount</span>
                <span>-{formatBDT(order.discount)}</span>
              </div>
            )}
            <div className="pt-2 border-t border-[#D9D9D9] flex justify-between font-semibold text-[#0A0A0A] text-base">
              <span>Total</span>
              <span>{formatBDT(order.total)}</span>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center justify-end gap-3 pt-2">
          <Link
            to={trackUrl}
            className="btn-base btn-primary"
          >
            <PackageSearch className="h-4 w-4" />
            <span>Track Your Order</span>
          </Link>
          <Link
            to="/shop"
            className="btn-base btn-secondary"
          >
            Continue Shopping
          </Link>
        </div>
      </div>
    </main>
  );
};
