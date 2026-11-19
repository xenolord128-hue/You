import React, { useState } from 'react';
import { Clock, Mail, MapPin, MessageCircle, Phone } from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { BoutiqueLocatorMap } from '../components/BoutiqueLocatorMap';
import { validateBangladeshPhone } from '../lib/formatters';
import { SeoHead } from '../components/SeoHead';
import { trackPixelEvent } from '../lib/metaPixel';
import { BRAND_LOCATION } from '../config/storeConfig';
import { sanitizeExternalHref } from '../lib/formatters';

export const ContactPage: React.FC = () => {
  const { settings, mapsApiKey, showToast } = useStore();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [message, setMessage] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const whatsappHref = `https://wa.me/${(settings.whatsappNumber || '8801XXXXXXXXX').replace(
    /\D/g,
    ''
  )}?text=${encodeURIComponent('Hello PYTHOX WORLD, I would like assistance with an order.')}`;
  const cleanMessenger = (settings.messengerHandle || 'pythoxworld').replace(
    /[^a-zA-Z0-9._-]/g,
    ''
  );
  const messengerHref = `https://m.me/${cleanMessenger || 'pythoxworld'}`;

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (phone && !validateBangladeshPhone(phone)) {
      showToast('Please enter a valid Bangladesh mobile number.');
      return;
    }
    trackPixelEvent('Lead', { content_name: 'Contact Inquiry' });
    setSubmitted(true);
    setName('');
    setEmail('');
    setPhone('');
    setMessage('');
    showToast('Inquiry received. Our Savar support desk will reply shortly.');
  };

  return (
    <main className="mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-10 py-6 sm:py-8 lg:py-12 pb-20 sm:pb-16">
      <SeoHead
        title="Contact Us — PYTHOX WORLD"
        description={`Contact PYTHOX WORLD at ${BRAND_LOCATION} or connect via WhatsApp, Messenger, email, and phone.`}
      />

      <div className="border-b border-[#D9D9D9] pb-8">
        <p className="text-[11px] font-mono font-semibold uppercase tracking-[0.2em] text-[#5C5C5C]">
          Customer Care &amp; Flagship Store
        </p>
        <h1 className="mt-2 text-3xl sm:text-5xl font-editorial font-semibold text-[#0A0A0A]">
          Contact Us
        </h1>
        <p className="mt-2 text-sm text-[#292929]">
          Business Location: <strong className="text-[#0A0A0A]">{settings.businessAddress || BRAND_LOCATION}</strong>
        </p>
      </div>

      <div className="mt-10 grid grid-cols-1 lg:grid-cols-12 gap-12">
        {/* Left: Form */}
        <div className="lg:col-span-6 space-y-6">
          {submitted ? (
            <div className="rounded-3xl border border-[#D9D9D9] bg-white p-8 space-y-3">
              <h2 className="text-2xl font-editorial font-semibold text-[#0A0A0A]">
                Message Received
              </h2>
              <p className="text-sm text-[#292929]">
                Thank you for contacting PYTHOX WORLD. Our Savar team responds within 2–4 business hours.
              </p>
              <button
                type="button"
                onClick={() => setSubmitted(false)}
                className="btn-base btn-secondary btn-sm mt-2"
              >
                Send another inquiry
              </button>
            </div>
          ) : (
            <form onSubmit={handleFormSubmit} className="space-y-4 rounded-3xl border border-[#D9D9D9] bg-white p-6 sm:p-8">
              <div>
                <label className="block text-xs font-medium text-[#292929] mb-1.5">
                  Full Name *
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full min-h-[42px] rounded-xl border border-[#D9D9D9] bg-white px-3.5 py-2.5 text-sm text-[#0A0A0A] focus:border-[#0A0A0A] focus:outline-none"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-[#292929] mb-1.5">
                    Email *
                  </label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full min-h-[42px] rounded-xl border border-[#D9D9D9] bg-white px-3.5 py-2.5 text-sm text-[#0A0A0A] focus:border-[#0A0A0A] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#292929] mb-1.5">
                    Mobile Number
                  </label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="01XXXXXXXXX"
                    className="w-full min-h-[42px] rounded-xl border border-[#D9D9D9] bg-white px-3.5 py-2.5 text-sm font-mono text-[#0A0A0A] placeholder:text-[#6A6A6A] focus:border-[#0A0A0A] focus:outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-[#292929] mb-1.5">
                  Message *
                </label>
                <textarea
                  rows={5}
                  required
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Ask about sizing, availability, wholesale, or order delivery..."
                  className="w-full rounded-xl border border-[#D9D9D9] bg-white px-3.5 py-2.5 text-sm text-[#0A0A0A] placeholder:text-[#6A6A6A] focus:border-[#0A0A0A] focus:outline-none"
                />
              </div>
              <div className="flex flex-wrap items-center gap-4 pt-2">
                <button
                  type="submit"
                  className="btn-base btn-primary w-full sm:w-auto"
                >
                  Send Message
                </button>
              </div>
            </form>
          )}

          {/* Direct Chat CTAs */}
          <div className="rounded-3xl border border-[#D9D9D9] bg-[#EAE9E4] p-6 space-y-3">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#0A0A0A]">
              Instant Chat Support
            </p>
            <div className="flex flex-col sm:flex-row flex-wrap gap-3">
              <a
                href={whatsappHref}
                target="_blank"
                rel="noreferrer"
                className="btn-base btn-primary"
              >
                <MessageCircle className="h-4 w-4" />
                <span>WhatsApp Support</span>
              </a>
              <a
                href={messengerHref}
                target="_blank"
                rel="noreferrer"
                className="btn-base btn-secondary"
              >
                <MessageCircle className="h-4 w-4" />
                <span>Facebook Messenger</span>
              </a>
            </div>
          </div>
        </div>

        {/* Right: Contact Details & Map */}
        <div className="lg:col-span-6 space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 rounded-3xl border border-[#D9D9D9] bg-white p-6 text-sm">
            <div className="space-y-1.5">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#5C5C5C] flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5" /> Store Address
              </p>
              <p className="text-[#0A0A0A] font-medium">
                {settings.businessAddress || BRAND_LOCATION}
              </p>
            </div>
            <div className="space-y-1.5">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#5C5C5C] flex items-center gap-1.5">
                <Phone className="h-3.5 w-3.5" /> Phone
              </p>
              <p className="font-mono text-[#0A0A0A]">{settings.supportPhone}</p>
            </div>
            <div className="space-y-1.5">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#5C5C5C] flex items-center gap-1.5">
                <Mail className="h-3.5 w-3.5" /> Email
              </p>
              <p className="text-[#0A0A0A]">{settings.supportEmail}</p>
            </div>
            <div className="space-y-1.5">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#5C5C5C] flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5" /> Store Hours
              </p>
              <p className="text-[#0A0A0A]">Daily 10:30 AM – 9:30 PM BST</p>
            </div>
          </div>

          <div className="rounded-2xl border border-[#D9D9D9] bg-white px-5 py-3.5 flex flex-wrap items-center justify-between gap-2 text-xs">
            <span className="text-[#5C5C5C] uppercase tracking-[0.12em] font-semibold">
              Follow PYTHOX WORLD
            </span>
            <div className="flex items-center gap-4">
              <a
                href={sanitizeExternalHref(settings.facebookUrl, 'https://facebook.com/pythoxworld')}
                target="_blank"
                rel="noreferrer"
                className="text-[#0A0A0A] underline underline-offset-4"
              >
                Facebook Page
              </a>
              <a
                href={sanitizeExternalHref(settings.instagramUrl, 'https://instagram.com/pythoxworld')}
                target="_blank"
                rel="noreferrer"
                className="text-[#0A0A0A] underline underline-offset-4"
              >
                Instagram
              </a>
            </div>
          </div>

          {mapsApiKey ? (
            <BoutiqueLocatorMap heightClass="h-[340px]" />
          ) : (
            <div className="rounded-3xl border border-[#D9D9D9] bg-[#EAE9E4] p-6 space-y-2 text-xs text-[#292929]">
              <p className="font-semibold uppercase tracking-[0.12em] text-[#0A0A0A]">
                PYTHOX WORLD Flagship Showroom
              </p>
              <p>{BRAND_LOCATION}</p>
              <p>Open Daily · 10:30 AM – 9:30 PM</p>
            </div>
          )}
        </div>
      </div>
    </main>
  );
};
