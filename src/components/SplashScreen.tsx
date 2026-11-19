import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { BRAND_LOGO_URL } from '../config/storeConfig';

const SPLASH_KEY = 'pythox_splash_shown_v1';

export const SplashScreen: React.FC = () => {
  const [visible, setVisible] = useState(() => {
    try {
      return !sessionStorage.getItem(SPLASH_KEY);
    } catch {
      return false;
    }
  });

  useEffect(() => {
    if (!visible) return;
    try {
      sessionStorage.setItem(SPLASH_KEY, '1');
    } catch {
      // ignore storage errors
    }
    const timer = setTimeout(() => setVisible(false), 1350);
    return () => clearTimeout(timer);
  }, [visible]);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.45, ease: [0.16, 1, 0.3, 1] } }}
          className="fixed inset-0 z-[120] bg-[#0A0A0A] flex flex-col items-center justify-center px-6 text-center select-none"
          aria-hidden="true"
        >
          <div className="absolute h-72 w-72 rounded-full bg-white/[0.04] blur-3xl pointer-events-none" />
          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
            className="relative flex flex-col items-center gap-4"
          >
            <div className="h-20 w-20 rounded-full p-1 border-2 border-[#D9D9D9] bg-white shadow-[0_12px_40px_rgba(255,255,255,0.12)] flex items-center justify-center overflow-hidden">
              <img
                src={BRAND_LOGO_URL}
                alt="PYTHOX WORLD"
                referrerPolicy="no-referrer"
                className="h-full w-full object-contain rounded-full"
              />
            </div>
            <div className="space-y-1">
              <p className="font-mono text-[10px] uppercase tracking-[0.34em] text-[#808080]">
                SAVAR ATELIER · EST. 2026
              </p>
              <h2 className="font-editorial text-3xl sm:text-4xl font-bold text-[#FFFFFF] tracking-wide">
                PYTHOX <span className="italic text-[#D9D9D9] font-normal">WORLD</span>
              </h2>
            </div>
            <div className="w-32 h-[1px] bg-gradient-to-r from-transparent via-[#808080] to-transparent mt-1" />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
