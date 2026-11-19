import React, { useEffect, useRef, useState } from 'react';

export function useLowMotion(): boolean {
  const [lowMotion, setLowMotion] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    const prefersReduced =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const cores = navigator.hardwareConcurrency || 4;
    const mem = (navigator as Navigator & { deviceMemory?: number }).deviceMemory || 4;
    const saveData =
      (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData ===
      true;
    return prefersReduced || cores <= 2 || mem <= 2 || saveData;
  });

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = () => setLowMotion(mq.matches);
    mq.addEventListener?.('change', onChange);
    return () => mq.removeEventListener?.('change', onChange);
  }, []);

  return lowMotion;
}

interface RevealProps {
  children: React.ReactNode;
  className?: string;
  delayMs?: number;
}

/**
 * Lightweight IntersectionObserver scroll reveal using GPU-only CSS transform + opacity.
 * Automatically renders immediately without animation on low-end or reduced-motion devices.
 */
export const Reveal: React.FC<RevealProps> = ({
  children,
  className = '',
  delayMs = 0,
}) => {
  const lowMotion = useLowMotion();
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(lowMotion);

  useEffect(() => {
    if (lowMotion) {
      setVisible(true);
      return;
    }
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') {
      setVisible(true);
      return;
    }

    const rect = el.getBoundingClientRect();
    if (rect.top < window.innerHeight * 0.96) {
      setVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.05, rootMargin: '0px 0px -24px 0px' }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [lowMotion]);

  return (
    <div
      ref={ref}
      className={`reveal-item${visible ? ' is-visible' : ''} ${className}`}
      style={!lowMotion && delayMs > 0 ? { transitionDelay: `${delayMs}ms` } : undefined}
    >
      {children}
    </div>
  );
};

export const SuccessCheckmark: React.FC<{ className?: string; size?: number }> = ({
  className = '',
  size = 56,
}) => {
  const boxCls = size <= 48 ? 'h-12 w-12' : 'h-14 w-14';
  const iconCls = size <= 48 ? 'h-6 w-6' : 'h-7 w-7';
  return (
    <div
      className={`relative rounded-full bg-[#0A0A0A] text-white flex items-center justify-center shrink-0 success-pop ${boxCls} ${className}`}
      aria-hidden="true"
    >
      <svg
        viewBox="0 0 32 32"
        fill="none"
        className={iconCls}
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M8.5 16.5L13.5 21.5L23.5 10.5"
          stroke="currentColor"
          strokeWidth="2.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="success-check-path"
        />
      </svg>
    </div>
  );
};
