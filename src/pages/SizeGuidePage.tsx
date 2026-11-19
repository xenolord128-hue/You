import React from 'react';
import { Link } from 'react-router-dom';
import { SeoHead } from '../components/SeoHead';

export const SizeGuidePage: React.FC = () => {
  return (
    <main className="mx-auto max-w-[1100px] px-4 sm:px-6 lg:px-10 py-6 sm:py-8 lg:py-12 pb-20 sm:pb-16 space-y-10 sm:space-y-12">
      <SeoHead
        title="Men's Size Guide — PYTHOX WORLD"
        description="Accurate chest, length, waist, and EU footwear size charts for PYTHOX WORLD menswear."
      />

      <div className="border-b border-[#D9D9D9] pb-6">
        <p className="text-[11px] font-mono font-semibold uppercase tracking-[0.2em] text-[#5C5C5C]">
          Fit &amp; Measurements
        </p>
        <h1 className="mt-2 text-3xl sm:text-5xl font-editorial font-semibold text-[#0A0A0A]">
          Men&apos;s Size Guide
        </h1>
        <p className="mt-2 text-sm text-[#292929]">
          All garment measurements are listed in inches with a ±0.5&quot; manufacturing tolerance.
        </p>
      </div>

      {/* Oversized T-Shirts & Polos */}
      <section className="space-y-4">
        <h2 className="text-xl font-editorial font-semibold text-[#0A0A0A]">
          01. T-Shirts &amp; Polo Shirts
        </h2>
        <div className="overflow-x-auto rounded-2xl border border-[#D9D9D9] bg-white">
          <table className="w-full text-left text-xs tabular-nums">
            <thead className="bg-[#EAE9E4] border-b border-[#D9D9D9] uppercase tracking-[0.1em] text-[#292929]">
              <tr>
                <th className="py-3 px-4">Size</th>
                <th className="py-3 px-4">Chest (Round)</th>
                <th className="py-3 px-4">Length</th>
                <th className="py-3 px-4">Shoulder (Drop Cut)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#D9D9D9] font-mono text-[#0A0A0A]">
              <tr><td className="py-3 px-4 font-semibold">S</td><td className="py-3 px-4">40&quot;</td><td className="py-3 px-4">27.5&quot;</td><td className="py-3 px-4">19.5&quot;</td></tr>
              <tr><td className="py-3 px-4 font-semibold">M</td><td className="py-3 px-4">42&quot;</td><td className="py-3 px-4">28.5&quot;</td><td className="py-3 px-4">20.5&quot;</td></tr>
              <tr><td className="py-3 px-4 font-semibold">L</td><td className="py-3 px-4">44&quot;</td><td className="py-3 px-4">29.5&quot;</td><td className="py-3 px-4">21.5&quot;</td></tr>
              <tr><td className="py-3 px-4 font-semibold">XL</td><td className="py-3 px-4">46&quot;</td><td className="py-3 px-4">30.5&quot;</td><td className="py-3 px-4">22.5&quot;</td></tr>
              <tr><td className="py-3 px-4 font-semibold">XXL</td><td className="py-3 px-4">48&quot;</td><td className="py-3 px-4">31.5&quot;</td><td className="py-3 px-4">23.5&quot;</td></tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* Shirts, Hoodies & Jackets */}
      <section className="space-y-4">
        <h2 className="text-xl font-editorial font-semibold text-[#0A0A0A]">
          02. Shirts, Hoodies &amp; Bomber Jackets
        </h2>
        <div className="overflow-x-auto rounded-2xl border border-[#D9D9D9] bg-white">
          <table className="w-full text-left text-xs tabular-nums">
            <thead className="bg-[#EAE9E4] border-b border-[#D9D9D9] uppercase tracking-[0.1em] text-[#292929]">
              <tr>
                <th className="py-3 px-4">Size</th>
                <th className="py-3 px-4">Chest</th>
                <th className="py-3 px-4">Body Length</th>
                <th className="py-3 px-4">Sleeve Length</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#D9D9D9] font-mono text-[#0A0A0A]">
              <tr><td className="py-3 px-4 font-semibold">S</td><td className="py-3 px-4">40&quot;</td><td className="py-3 px-4">27&quot;</td><td className="py-3 px-4">24.5&quot;</td></tr>
              <tr><td className="py-3 px-4 font-semibold">M</td><td className="py-3 px-4">42&quot;</td><td className="py-3 px-4">28&quot;</td><td className="py-3 px-4">25&quot;</td></tr>
              <tr><td className="py-3 px-4 font-semibold">L</td><td className="py-3 px-4">44&quot;</td><td className="py-3 px-4">29&quot;</td><td className="py-3 px-4">25.5&quot;</td></tr>
              <tr><td className="py-3 px-4 font-semibold">XL</td><td className="py-3 px-4">46&quot;</td><td className="py-3 px-4">30&quot;</td><td className="py-3 px-4">26&quot;</td></tr>
              <tr><td className="py-3 px-4 font-semibold">XXL</td><td className="py-3 px-4">48&quot;</td><td className="py-3 px-4">31&quot;</td><td className="py-3 px-4">26.5&quot;</td></tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* Pants & Jeans */}
      <section className="space-y-4">
        <h2 className="text-xl font-editorial font-semibold text-[#0A0A0A]">
          03. Denim Jeans &amp; Cargo Trousers
        </h2>
        <div className="overflow-x-auto rounded-2xl border border-[#D9D9D9] bg-white">
          <table className="w-full text-left text-xs tabular-nums">
            <thead className="bg-[#EAE9E4] border-b border-[#D9D9D9] uppercase tracking-[0.1em] text-[#292929]">
              <tr>
                <th className="py-3 px-4">Waist Tag / Size</th>
                <th className="py-3 px-4">Waist</th>
                <th className="py-3 px-4">Outseam Length</th>
                <th className="py-3 px-4">Leg Opening</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#D9D9D9] font-mono text-[#0A0A0A]">
              <tr><td className="py-3 px-4 font-semibold">30 / S</td><td className="py-3 px-4">30.5&quot;</td><td className="py-3 px-4">40&quot;</td><td className="py-3 px-4">6.8&quot;</td></tr>
              <tr><td className="py-3 px-4 font-semibold">32 / M</td><td className="py-3 px-4">32.5&quot;</td><td className="py-3 px-4">40.5&quot;</td><td className="py-3 px-4">7.0&quot;</td></tr>
              <tr><td className="py-3 px-4 font-semibold">34 / L</td><td className="py-3 px-4">34.5&quot;</td><td className="py-3 px-4">41&quot;</td><td className="py-3 px-4">7.3&quot;</td></tr>
              <tr><td className="py-3 px-4 font-semibold">36 / XL</td><td className="py-3 px-4">36.5&quot;</td><td className="py-3 px-4">41.5&quot;</td><td className="py-3 px-4">7.5&quot;</td></tr>
              <tr><td className="py-3 px-4 font-semibold">38 / XXL</td><td className="py-3 px-4">38.5&quot;</td><td className="py-3 px-4">42&quot;</td><td className="py-3 px-4">7.8&quot;</td></tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* Sneakers */}
      <section className="space-y-4">
        <h2 className="text-xl font-editorial font-semibold text-[#0A0A0A]">
          04. Men&apos;s Sneakers (EU Sizing)
        </h2>
        <div className="overflow-x-auto rounded-2xl border border-[#D9D9D9] bg-white">
          <table className="w-full text-left text-xs tabular-nums">
            <thead className="bg-[#EAE9E4] border-b border-[#D9D9D9] uppercase tracking-[0.1em] text-[#292929]">
              <tr>
                <th className="py-3 px-4">EU Size</th>
                <th className="py-3 px-4">UK Equivalent</th>
                <th className="py-3 px-4">Foot Length (cm)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#D9D9D9] font-mono text-[#0A0A0A]">
              <tr><td className="py-3 px-4 font-semibold">40</td><td className="py-3 px-4">6.5</td><td className="py-3 px-4">25.3 cm</td></tr>
              <tr><td className="py-3 px-4 font-semibold">41</td><td className="py-3 px-4">7.5</td><td className="py-3 px-4">26.0 cm</td></tr>
              <tr><td className="py-3 px-4 font-semibold">42</td><td className="py-3 px-4">8.0</td><td className="py-3 px-4">26.7 cm</td></tr>
              <tr><td className="py-3 px-4 font-semibold">43</td><td className="py-3 px-4">9.0</td><td className="py-3 px-4">27.3 cm</td></tr>
              <tr><td className="py-3 px-4 font-semibold">44</td><td className="py-3 px-4">10.0</td><td className="py-3 px-4">28.0 cm</td></tr>
            </tbody>
          </table>
        </div>
      </section>

      <div className="rounded-3xl border border-[#D9D9D9] bg-white p-6 flex flex-col sm:flex-row flex-wrap items-start sm:items-center justify-between gap-4">
        <p className="text-sm text-[#292929]">
          Unsure between two sizes? Message our Savar fit team for live chest/waist recommendations.
        </p>
        <Link
          to="/contact"
          className="btn-base btn-primary w-full sm:w-auto"
        >
          Ask Fit Concierge
        </Link>
      </div>
    </main>
  );
};
