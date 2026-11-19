import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { motion } from 'motion/react';
import {
  CheckCircle2,
  ClipboardCheck,
  Cog,
  Navigation,
  Package,
  Search,
  Sparkles,
  Truck,
  XCircle,
} from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { formatBDT } from '../lib/formatters';
import { Order, OrderStatus } from '../types/ecommerce';
import { SeoHead } from '../components/SeoHead';

interface LedgerStage {
  key: 'placed' | 'processing' | 'transit' | 'delivery' | 'delivered';
  label: string;
  insight: string;
  eta: string;
}

const LEDGER_STAGES: LedgerStage[] = [
  {
    key: 'placed',
    label: 'Order Placed',
    insight: 'Your consignment has been registered in our Savar Atelier ledger and assigned a dispatch code.',
    eta: 'Confirmed within 30 mins',
  },
  {
    key: 'processing',
    label: 'Processing',
    insight: 'Garments are undergoing 260–460 GSM fabric inspection, steam-pressing, and sealed packaging.',
    eta: 'Atelier Quality Check',
  },
  {
    key: 'transit',
    label: 'In Transit',
    insight: 'Parcel has departed Savar Thana Road and is moving through our express courier hub network.',
    eta: 'Express Courier Linehaul',
  },
  {
    key: 'delivery',
    label: 'Out for Delivery',
    insight: 'Our local courier rider is en route to your specified street address—keep your phone reachable.',
    eta: 'Arriving Today',
  },
  {
    key: 'delivered',
    label: 'Delivered',
    insight: 'Consignment successfully handed over and verified. Enjoy your 7-day size exchange guarantee.',
    eta: 'Completed',
  },
];

function mapOrderStatusToStageIndex(status: OrderStatus): number {
  switch (status) {
    case 'Order Received':
    case 'Order Confirmed':
      return 0;
    case 'Processing':
    case 'Packed':
      return 1;
    case 'Shipped':
      return 2;
    case 'Out for Delivery':
      return 3;
    case 'Delivered':
      return 4;
    default:
      return 0;
  }
}

export const TrackOrderPage: React.FC = () => {
  const { fetchTrackedOrder } = useStore();
  const [searchParams] = useSearchParams();

  const initialOrder = searchParams.get('order') || '';
  const initialPhone = searchParams.get('phone') || '';

  const [orderInput, setOrderInput] = useState(initialOrder);
  const [phoneInput, setPhoneInput] = useState(initialPhone);
  const [matchedOrder, setMatchedOrder] = useState<Order | null>(null);
  const [searched, setSearched] = useState(false);

  // Interactive stage preview override so users can inspect stage animations too
  const [previewStageIdx, setPreviewStageIdx] = useState<number | null>(null);

  useEffect(() => {
    let active = true;
    if (initialOrder && initialPhone) {
      void fetchTrackedOrder(initialOrder, initialPhone).then((res) => {
        if (!active) return;
        setMatchedOrder(res);
        setSearched(true);
        setPreviewStageIdx(null);
      });
    }
    return () => {
      active = false;
    };
  }, [initialOrder, initialPhone, fetchTrackedOrder]);

  const handleTrack = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetchTrackedOrder(orderInput, phoneInput);
    setMatchedOrder(res);
    setSearched(true);
    setPreviewStageIdx(null);
  };

  const actualIdx = matchedOrder ? mapOrderStatusToStageIndex(matchedOrder.status) : 0;
  const activeStageIdx = previewStageIdx !== null ? previewStageIdx : actualIdx;
  const activeStage = LEDGER_STAGES[activeStageIdx];
  const progressPct = Math.round(((activeStageIdx + 1) / LEDGER_STAGES.length) * 100);

  const renderAnimatedStageGraphic = (key: LedgerStage['key']) => {
    switch (key) {
      case 'placed':
        return (
          <motion.div
            animate={{ scale: [1, 1.08, 1] }}
            transition={{ repeat: Infinity, duration: 2.2 }}
            className="h-16 w-16 rounded-2xl bg-[#292929] border border-[#808080] flex items-center justify-center text-white"
          >
            <ClipboardCheck className="h-8 w-8" />
          </motion.div>
        );
      case 'processing':
        return (
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ repeat: Infinity, duration: 6, ease: 'linear' }}
            className="h-16 w-16 rounded-2xl bg-[#292929] border border-[#808080] flex items-center justify-center text-white"
          >
            <Cog className="h-8 w-8" />
          </motion.div>
        );
      case 'transit':
        return (
          <motion.div
            animate={{ x: [-4, 4, -4] }}
            transition={{ repeat: Infinity, duration: 1.8, ease: 'easeInOut' }}
            className="h-16 w-16 rounded-2xl bg-[#292929] border border-[#808080] flex items-center justify-center text-white"
          >
            <Truck className="h-8 w-8" />
          </motion.div>
        );
      case 'delivery':
        return (
          <motion.div
            animate={{ y: [-3, 3, -3] }}
            transition={{ repeat: Infinity, duration: 1.5, ease: 'easeInOut' }}
            className="h-16 w-16 rounded-2xl bg-white border border-white flex items-center justify-center text-[#0A0A0A]"
          >
            <Navigation className="h-8 w-8" />
          </motion.div>
        );
      case 'delivered':
        return (
          <motion.div
            initial={{ scale: 0.9 }}
            animate={{ scale: [0.96, 1.04, 0.96] }}
            transition={{ repeat: Infinity, duration: 2.5 }}
            className="h-16 w-16 rounded-2xl bg-white border border-white flex items-center justify-center text-[#0A0A0A]"
          >
            <CheckCircle2 className="h-8 w-8" />
          </motion.div>
        );
    }
  };

  return (
    <main className="mx-auto max-w-5xl px-4 sm:px-6 py-6 sm:py-8 lg:py-12 pb-20 sm:pb-16 space-y-8">
      <SeoHead
        title="Live Order Tracking — PYTHOX WORLD"
        description="Track your PYTHOX WORLD consignment in real time via our Live Ledger."
      />

      <div className="space-y-2">
        <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.22em] text-[#5C5C5C]">
          CONSIGNMENT LEDGER
        </p>
        <h1 className="font-editorial text-3xl sm:text-5xl font-bold text-[#0A0A0A]">
          Track Your <span className="italic text-[#292929]">Order</span>
        </h1>
        <p className="text-sm text-[#292929]">
          Enter your Order ID and checkout phone number to inspect live Savar dispatch updates.
        </p>
      </div>

      {/* Lookup Form */}
      <div className="rounded-3xl bg-white border border-[#D9D9D9] navy-shadow p-5 sm:p-8 space-y-4">
        <form onSubmit={handleTrack} className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-end">
          <div className="sm:col-span-5">
            <label className="block font-mono text-[11px] font-semibold uppercase tracking-wider text-[#0A0A0A] mb-1.5">
              Order ID *
            </label>
            <input
              type="text"
              required
              value={orderInput}
              onChange={(e) => setOrderInput(e.target.value)}
              placeholder="PYX-2042"
              className="w-full rounded-xl border border-[#D9D9D9] bg-[#F3F2EE] px-4 py-3 text-sm font-mono uppercase text-[#0A0A0A] placeholder:text-[#6A6A6A] focus:border-[#0A0A0A] focus:bg-white focus:outline-none"
            />
          </div>
          <div className="sm:col-span-5">
            <label className="block font-mono text-[11px] font-semibold uppercase tracking-wider text-[#0A0A0A] mb-1.5">
              Mobile Number *
            </label>
            <input
              type="tel"
              required
              value={phoneInput}
              onChange={(e) => setPhoneInput(e.target.value)}
              placeholder="01XXXXXXXXX"
              className="w-full rounded-xl border border-[#D9D9D9] bg-[#F3F2EE] px-4 py-3 text-sm font-mono text-[#0A0A0A] placeholder:text-[#6A6A6A] focus:border-[#0A0A0A] focus:bg-white focus:outline-none"
            />
          </div>
          <div className="sm:col-span-2">
            <button
              type="submit"
              className="btn-base btn-primary w-full min-h-[46px]"
            >
              <Search className="h-4 w-4 text-[#D9D9D9]" />
              <span>Track</span>
            </button>
          </div>
        </form>
      </div>

      {/* Not Found State */}
      {searched && !matchedOrder && (
        <div className="rounded-3xl bg-white border border-[#D9D9D9] navy-shadow p-8 sm:p-10 text-center space-y-2">
          <Package className="h-8 w-8 mx-auto text-[#5C5C5C]" />
          <p className="font-editorial text-xl font-bold text-[#0A0A0A]">
            No matching consignment found
          </p>
          <p className="text-xs text-[#5C5C5C]">
            Double-check your Order ID (e.g. PYX-XXXX) and the exact mobile number used at checkout.
          </p>
        </div>
      )}

      {/* Primary Black Consignment Card with LIVE LEDGER */}
      {matchedOrder && (
        <section className="rounded-3xl bg-[#0A0A0A] text-white border border-[#292929] navy-shadow-lg overflow-hidden">
          <div className="p-6 sm:p-10 space-y-8">
            {/* Top Header */}
            <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[#292929] pb-6">
              <div className="space-y-2">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#111111] border border-[#292929]">
                  <span className="h-2 w-2 rounded-full bg-white" />
                  <span className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-white">
                    LIVE LEDGER
                  </span>
                </div>
                <h2 className="font-editorial text-2xl sm:text-3xl font-bold text-white">
                  Consignment <span className="text-[#D9D9D9] font-mono">#{matchedOrder.orderNumber}</span>
                </h2>
                <p className="text-xs text-[#D9D9D9]/80">
                  {matchedOrder.deliveryStatus} · Placed{' '}
                  {new Date(matchedOrder.createdAt).toLocaleDateString('en-GB', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  })}
                </p>
              </div>

              <div className="text-left sm:text-right">
                <p className="font-mono text-2xl font-bold text-white tabular-nums">
                  {formatBDT(matchedOrder.total)}
                </p>
                <p className="font-mono text-[11px] uppercase tracking-wider text-[#D9D9D9] mt-1">
                  {matchedOrder.paymentMethod} · {matchedOrder.paymentStatus}
                </p>
              </div>
            </div>

            {matchedOrder.status === 'Cancelled' ? (
              <div className="rounded-2xl bg-[#111111] border border-[#808080]/50 p-5 flex items-center gap-4">
                <XCircle className="h-7 w-7 text-white shrink-0" />
                <div>
                  <p className="font-semibold text-white">Consignment Cancelled</p>
                  <p className="text-xs text-[#D9D9D9] mt-0.5">
                    This order was cancelled. Digital payments refund within 3–5 business days.
                  </p>
                </div>
              </div>
            ) : (
              <>
                {/* Interactive 5-Step Progress Beam */}
                <div className="space-y-4">
                  <div className="relative h-2.5 rounded-full bg-[#292929] overflow-hidden">
                    <div
                      className="relative h-full rounded-full bg-gradient-to-r from-[#D9D9D9] to-white transition-all duration-500 overflow-hidden"
                      style={{ width: `${progressPct}%` }}
                    >
                      <span className="absolute inset-0 w-1/3 bg-gradient-to-r from-transparent via-[#808080]/50 to-transparent animate-beam" />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
                    {LEDGER_STAGES.map((stage, idx) => {
                      const completed = idx <= activeStageIdx;
                      const current = idx === activeStageIdx;
                      return (
                        <button
                          key={stage.key}
                          type="button"
                          onClick={() => setPreviewStageIdx(idx)}
                          className={`min-h-[56px] p-3 rounded-2xl border text-left transition-colors ui-press cursor-pointer ${
                            current
                              ? 'bg-white text-[#0A0A0A] border-white shadow-md'
                              : completed
                              ? 'bg-[#292929] text-white border-[#808080]/40 hover:border-white/60'
                              : 'bg-[#111111] text-[#A8A39B] border-[#292929] hover:border-[#A8A39B]'
                          }`}
                        >
                          <p className="font-mono text-[10px] font-bold">0{idx + 1}</p>
                          <p className="text-xs font-bold mt-1">{stage.label}</p>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Stage Animated Vector Graphic + Stage Insight Card */}
                <div className="rounded-2xl bg-[#111111] border border-[#292929] p-5 sm:p-6 flex flex-col sm:flex-row items-start sm:items-center gap-5">
                  {renderAnimatedStageGraphic(activeStage.key)}
                  <div className="flex-1 space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#D9D9D9] font-bold">
                        STAGE INSIGHT · {activeStage.eta}
                      </span>
                      {previewStageIdx !== null && previewStageIdx !== actualIdx && (
                        <button
                          type="button"
                          onClick={() => setPreviewStageIdx(null)}
                          className="text-[10px] font-mono underline text-white"
                        >
                          Reset to Live Stage
                        </button>
                      )}
                    </div>
                    <h3 className="font-editorial text-xl font-bold text-white flex items-center gap-2">
                      {activeStage.label}
                      <Sparkles className="h-4 w-4 text-[#D9D9D9]" />
                    </h3>
                    <p className="text-xs sm:text-sm text-[#D9D9D9] leading-relaxed">
                      {activeStage.insight}
                    </p>
                  </div>
                </div>
              </>
            )}

            {/* Items & Destination */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-6 border-t border-[#292929] text-xs">
              <div className="space-y-2.5">
                <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#A8A39B]">
                  ITEMS IN CONSIGNMENT
                </p>
                {matchedOrder.items.map((item, idx) => (
                  <div key={idx} className="flex justify-between text-[#F5F5F5]">
                    <span>
                      {item.name} ({item.color}, {item.size}) × {item.quantity}
                    </span>
                    <span className="font-mono tabular-nums text-white font-semibold">
                      {formatBDT(item.price * item.quantity)}
                    </span>
                  </div>
                ))}
              </div>
              <div className="space-y-1.5">
                <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#A8A39B]">
                  DELIVERY DESTINATION
                </p>
                <p className="font-semibold text-white">{matchedOrder.customerName}</p>
                <p className="text-[#D9D9D9]">{matchedOrder.address}</p>
                <p className="text-[#D9D9D9]">
                  {matchedOrder.area}, {matchedOrder.city} {matchedOrder.postalCode}
                </p>
                <p className="pt-2">
                  <Link to="/contact" className="text-white underline underline-offset-4">
                    Contact Savar Dispatch Desk
                  </Link>
                </p>
              </div>
            </div>
          </div>
        </section>
      )}
    </main>
  );
};
