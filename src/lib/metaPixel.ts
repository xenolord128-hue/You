import { sanitizePixelId } from './formatters';
import { Order } from '../types/ecommerce';

declare global {
  interface Window {
    fbq?: ((...args: unknown[]) => void) & {
      callMethod?: (...args: unknown[]) => void;
      queue?: unknown[];
      push?: (...args: unknown[]) => void;
      loaded?: boolean;
      version?: string;
      disablePushState?: boolean;
    };
    _fbq?: unknown;
  }
}

export type MetaPixelEventName =
  | 'PageView'
  | 'ViewContent'
  | 'Search'
  | 'AddToCart'
  | 'InitiateCheckout'
  | 'Purchase'
  | 'Contact'
  | 'CompleteRegistration'
  | 'Lead';

export interface MetaPixelTrackOptions {
  eventID?: string;
}

export interface MetaPixelContentItem {
  id: string;
  quantity: number;
  item_price: number;
}

interface PendingPixelEvent {
  eventName: MetaPixelEventName;
  params: Record<string, unknown>;
  options?: MetaPixelTrackOptions;
  timestamp: number;
}

const PURCHASE_DEDUP_STORAGE_KEY = 'pythox_pixel_tracked_purchases';
const MAX_PENDING_EVENTS = 25;
const PENDING_EVENT_TTL_MS = 15_000;
const SEARCH_DEDUP_WINDOW_MS = 5_000;

let activePixelId: string | null = null;
const initializedPixelIds = new Set<string>();
const pendingEvents: PendingPixelEvent[] = [];
const memoryTrackedPurchases = new Set<string>();
let lastTrackedSearch: { normalized: string; timestamp: number } | null = null;

function isAdminPath(): boolean {
  if (typeof window === 'undefined') return false;
  return window.location.pathname.startsWith('/admin');
}

function sanitizeEventParams(
  params?: Record<string, unknown>
): Record<string, unknown> {
  if (!params) return {};
  const cleaned: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null) continue;
    if (typeof value === 'number') {
      if (!Number.isFinite(value)) continue;
      cleaned[key] = Math.round(value * 100) / 100;
    } else if (typeof value === 'string') {
      const trimmed = value.trim();
      if (!trimmed) continue;
      cleaned[key] = trimmed;
    } else if (Array.isArray(value)) {
      if (value.length === 0) continue;
      cleaned[key] = value;
    } else {
      cleaned[key] = value;
    }
  }

  return cleaned;
}

function emitPixelEvent(
  eventName: MetaPixelEventName,
  params: Record<string, unknown>,
  options?: MetaPixelTrackOptions
): void {
  if (typeof window === 'undefined' || !window.fbq || !activePixelId) return;
  if (isAdminPath()) return;

  const eventOptions =
    options?.eventID && options.eventID.trim()
      ? { eventID: options.eventID.trim() }
      : undefined;

  if (initializedPixelIds.size > 1) {
    if (eventOptions) {
      window.fbq(
        'trackSingle',
        activePixelId,
        eventName,
        params,
        eventOptions
      );
    } else {
      window.fbq('trackSingle', activePixelId, eventName, params);
    }
  } else if (eventOptions) {
    window.fbq('track', eventName, params, eventOptions);
  } else {
    window.fbq('track', eventName, params);
  }
}

function ensureFbqBootstrap(): void {
  if (typeof window === 'undefined' || window.fbq) return;

  const n: NonNullable<Window['fbq']> = function (...args: unknown[]) {
    if (n.callMethod) {
      n.callMethod(...args);
    } else if (n.queue) {
      n.queue.push(args);
    }
  };
  if (!window._fbq) window._fbq = n;
  n.push = n;
  n.loaded = true;
  n.version = '2.0';
  n.disablePushState = true;
  n.queue = [];
  window.fbq = n;

  const existingScript = document.querySelector<HTMLScriptElement>(
    'script[src*="connect.facebook.net/en_US/fbevents.js"]'
  );
  if (!existingScript) {
    const script = document.createElement('script');
    script.async = true;
    script.src = 'https://connect.facebook.net/en_US/fbevents.js';
    const firstScript = document.getElementsByTagName('script')[0];
    if (firstScript?.parentNode) {
      firstScript.parentNode.insertBefore(script, firstScript);
    } else {
      document.head?.appendChild(script);
    }
  }
}

export function isMetaPixelActive(): boolean {
  return Boolean(activePixelId);
}

export function getActiveMetaPixelId(): string | null {
  return activePixelId;
}

export function clearPendingPixelEvents(): void {
  pendingEvents.length = 0;
}

export function initMetaPixel(pixelId?: string): void {
  if (typeof window === 'undefined') return;
  const cleanId = sanitizePixelId(pixelId);

  if (!cleanId) {
    activePixelId = null;
    pendingEvents.length = 0;
    return;
  }

  if (activePixelId === cleanId && initializedPixelIds.has(cleanId)) {
    return;
  }

  ensureFbqBootstrap();

  if (!initializedPixelIds.has(cleanId)) {
    window.fbq?.('init', cleanId);
    initializedPixelIds.add(cleanId);
  }
  activePixelId = cleanId;

  if (!isAdminPath() && pendingEvents.length > 0) {
    const now = Date.now();
    const toFlush = pendingEvents.splice(0, pendingEvents.length);
    for (const evt of toFlush) {
      if (now - evt.timestamp <= PENDING_EVENT_TTL_MS) {
        emitPixelEvent(evt.eventName, evt.params, evt.options);
      }
    }
  }
}

export function trackPixelEvent(
  eventName: MetaPixelEventName,
  params?: Record<string, unknown>,
  options?: MetaPixelTrackOptions
): void {
  if (typeof window === 'undefined' || isAdminPath()) return;
  const cleanParams = sanitizeEventParams(params);

  if (window.fbq && activePixelId) {
    emitPixelEvent(eventName, cleanParams, options);
    return;
  }

  // Queue storefront events that fire just before settings finish loading
  if (eventName !== 'PageView') {
    if (pendingEvents.length >= MAX_PENDING_EVENTS) {
      pendingEvents.shift();
    }
    pendingEvents.push({
      eventName,
      params: cleanParams,
      options,
      timestamp: Date.now(),
    });
  }
}

export function trackSearchEvent(
  query: string,
  category?: string
): void {
  const trimmed = query.trim();
  if (trimmed.length < 2) return;

  const normalized = trimmed.toLowerCase();
  const now = Date.now();
  if (
    lastTrackedSearch &&
    lastTrackedSearch.normalized === normalized &&
    now - lastTrackedSearch.timestamp < SEARCH_DEDUP_WINDOW_MS
  ) {
    return;
  }

  lastTrackedSearch = { normalized, timestamp: now };
  trackPixelEvent('Search', {
    search_string: trimmed,
    ...(category ? { content_category: category } : {}),
  });
}

function readStoredPurchaseKeys(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.sessionStorage.getItem(PURCHASE_DEDUP_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((v): v is string => typeof v === 'string')
      : [];
  } catch {
    return [];
  }
}

function markPurchaseKeyTracked(key: string): void {
  const cleanKey = key.trim();
  if (!cleanKey) return;
  memoryTrackedPurchases.add(cleanKey);

  if (typeof window === 'undefined') return;
  try {
    const existing = readStoredPurchaseKeys();
    if (!existing.includes(cleanKey)) {
      const next = [...existing.slice(-49), cleanKey];
      window.sessionStorage.setItem(
        PURCHASE_DEDUP_STORAGE_KEY,
        JSON.stringify(next)
      );
    }
  } catch {
    // ignore storage access issues
  }
}

export function hasTrackedPurchase(orderKey?: string | null): boolean {
  const cleanKey = (orderKey || '').trim();
  if (!cleanKey) return false;
  if (memoryTrackedPurchases.has(cleanKey)) return true;
  return readStoredPurchaseKeys().includes(cleanKey);
}

export function trackPurchaseEvent(
  order: Order,
  categoryByProductId?: Map<string, string>
): boolean {
  if (!order) return false;

  const idKey = (order.id || '').trim();
  const numberKey = (order.orderNumber || '').trim();
  if (!idKey && !numberKey) return false;

  if (hasTrackedPurchase(idKey) || hasTrackedPurchase(numberKey)) {
    return false;
  }

  const items = Array.isArray(order.items) ? order.items : [];
  const contentIds = Array.from(
    new Set(items.map((i) => i.productId).filter(Boolean))
  );
  const contents: MetaPixelContentItem[] = items
    .filter((i) => Boolean(i.productId))
    .map((i) => ({
      id: i.productId,
      quantity: Math.max(1, Math.round(Number(i.quantity) || 1)),
      item_price: Math.max(0, Number(i.price) || 0),
    }));

  const categories = Array.from(
    new Set(
      items
        .map((i) => categoryByProductId?.get(i.productId))
        .filter((c): c is string => Boolean(c && c.trim()))
    )
  );

  const numItems = items.reduce(
    (sum, i) => sum + Math.max(1, Math.round(Number(i.quantity) || 1)),
    0
  );
  const orderValue = Number.isFinite(Number(order.total))
    ? Math.max(0, Number(order.total))
    : 0;

  if (idKey) markPurchaseKeyTracked(idKey);
  if (numberKey) markPurchaseKeyTracked(numberKey);

  const eventId = `purchase_${numberKey || idKey}`;

  trackPixelEvent(
    'Purchase',
    {
      order_id: numberKey || idKey,
      value: orderValue,
      currency: 'BDT',
      content_type: 'product',
      content_ids: contentIds,
      content_name: items.map((i) => i.name).filter(Boolean).join(', '),
      ...(categories.length > 0
        ? { content_category: categories.join(', ') }
        : {}),
      contents,
      num_items: numItems,
    },
    { eventID: eventId }
  );

  return true;
}
