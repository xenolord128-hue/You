import React, { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Facebook, Headphones, MessageCircle, X } from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { sanitizeExternalHref } from '../lib/formatters';

export const FloatingContact: React.FC = () => {
  const { settings } = useStore();
  const [expanded, setExpanded] = useState(false);

  const cleanWa = settings.whatsappNumber.replace(/\D/g, '');
  const whatsappUrl = `https://wa.me/${cleanWa || '8801XXXXXXXXX'}?text=${encodeURIComponent(
    'Hello PYTHOX WORLD Concierge, I would like sizing or order assistance.'
  )}`;
  const facebookUrl = sanitizeExternalHref(
    settings.facebookUrl,
    'https://facebook.com/pythoxworld'
  );

  return (
    <div className="fixed bottom-4 right-4 sm:bottom-5 sm:right-5 z-40 flex flex-col items-end gap-2.5">
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.96 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            className="flex flex-col items-end gap-2"
          >
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noreferrer"
              className="btn-base btn-primary btn-sm rounded-xl shadow-lg"
            >
              <MessageCircle className="h-4 w-4" />
              <span>WhatsApp Concierge</span>
            </a>
            <a
              href={facebookUrl}
              target="_blank"
              rel="noreferrer"
              className="btn-base btn-secondary btn-sm rounded-xl shadow-lg"
            >
              <Facebook className="h-4 w-4 text-[#0A0A0A]" />
              <span>Official Facebook Page</span>
            </a>
          </motion.div>
        )}
      </AnimatePresence>

      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-label="Customer Support Concierge"
        aria-expanded={expanded}
        className="relative h-12 w-12 sm:h-13 sm:w-13 rounded-2xl bg-[#0A0A0A] border border-white/25 text-white flex items-center justify-center shadow-lg hover:bg-[#242424] active:scale-[0.95] transition-all duration-150 cursor-pointer"
      >
        {expanded ? (
          <X className="h-5 w-5 text-white" />
        ) : (
          <Headphones className="h-5 w-5 text-white" />
        )}
      </button>
    </div>
  );
};
