import { sanitizePixelId } from './formatters';

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
    _fbq?: unknown;
  }
}

let initializedPixelId: string | null = null;

export function initMetaPixel(pixelId?: string): void {
  const cleanId = sanitizePixelId(pixelId);
  if (!cleanId || initializedPixelId === cleanId || typeof window === 'undefined') {
    return;
  }

  if (!window.fbq) {
    const n: any = function (...args: unknown[]) {
      if (n.callMethod) {
        n.callMethod.apply(n, args);
      } else {
        n.queue.push(args);
      }
    };
    if (!window._fbq) window._fbq = n;
    n.push = n;
    n.loaded = true;
    n.version = '2.0';
    n.queue = [];
    window.fbq = n;

    const script = document.createElement('script');
    script.async = true;
    script.src = 'https://connect.facebook.net/en_US/fbevents.js';
    const firstScript = document.getElementsByTagName('script')[0];
    firstScript?.parentNode?.insertBefore(script, firstScript);
  }

  window.fbq?.('init', cleanId);
  initializedPixelId = cleanId;
}

export type MetaPixelEventName =
  | 'PageView'
  | 'ViewContent'
  | 'Search'
  | 'AddToCart'
  | 'InitiateCheckout'
  | 'Purchase'
  | 'Lead';

export function trackPixelEvent(
  eventName: MetaPixelEventName,
  params?: Record<string, unknown>
): void {
  if (typeof window === 'undefined') return;
  if (window.fbq && initializedPixelId) {
    window.fbq('track', eventName, params || {});
  }
}
