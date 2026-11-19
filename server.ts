import express, { NextFunction, Request, Response } from 'express';
import fs from 'fs/promises';
import { createWriteStream } from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { GoogleGenAI, Type } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const IS_PRODUCTION = process.env.NODE_ENV === 'production';

// Server-side Admin Session & Credential Protection (no hardcoded credential fallback)
const ADMIN_COOKIE_NAME = 'pythox_admin_session';
const SESSION_TTL_MS = 8 * 60 * 60 * 1000;
const RAW_SESSION_SECRET = (process.env.ADMIN_SESSION_SECRET || '').trim();
if (!RAW_SESSION_SECRET && IS_PRODUCTION) {
  console.warn(
    '[SECURITY WARNING] ADMIN_SESSION_SECRET is not configured. Using ephemeral per-process secret.'
  );
}
const SESSION_SECRET = RAW_SESSION_SECRET || crypto.randomBytes(32).toString('hex');

const PASSWORD_SALT = crypto.randomBytes(16).toString('hex');
const RAW_ADMIN_PASSWORD = (process.env.ADMIN_PASSWORD || '').trim();

let INITIAL_ADMIN_KEY: Buffer | null = null;
let IS_ADMIN_CONFIGURED = false;

if (RAW_ADMIN_PASSWORD) {
  INITIAL_ADMIN_KEY = crypto.scryptSync(RAW_ADMIN_PASSWORD, PASSWORD_SALT, 64);
  IS_ADMIN_CONFIGURED = true;
} else if (!IS_PRODUCTION) {
  const devPassword = crypto.randomBytes(12).toString('base64url');
  INITIAL_ADMIN_KEY = crypto.scryptSync(devPassword, PASSWORD_SALT, 64);
  IS_ADMIN_CONFIGURED = true;
  console.warn(
    `[DEV SECURITY NOTICE] ADMIN_PASSWORD is not set in environment. Ephemeral dev password for this process: ${devPassword}`
  );
} else {
  console.error(
    '[SECURITY ERROR] ADMIN_PASSWORD is not configured in production. Admin login is disabled until ADMIN_PASSWORD is set.'
  );
}

const failedAttempts = new Map<string, { count: number; lockedUntil: number; lastSeen: number }>();
const MAX_FAILED_ATTEMPTS = 6;
const LOCKOUT_MS = 10 * 60 * 1000;

// Self-hosted file-backed persistence for store catalog, orders, reviews & settings
const DATA_DIR = path.resolve(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'store-data.json');
const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');

const IMAGE_MIME_EXT: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/jpg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
};

const VIDEO_MIME_EXT: Record<string, string> = {
  'video/mp4': '.mp4',
  'video/webm': '.webm',
  'video/quicktime': '.mov',
};

const ALLOWED_IMAGE_EXTS = new Set(['.jpg', '.jpeg', '.png', '.webp']);
const ALLOWED_VIDEO_EXTS = new Set(['.mp4', '.webm', '.mov']);
const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // 10 MB
const MAX_VIDEO_BYTES = 50 * 1024 * 1024; // 50 MB

const ORDER_STATUSES = new Set([
  'Order Received',
  'Order Confirmed',
  'Processing',
  'Packed',
  'Shipped',
  'Out for Delivery',
  'Delivered',
  'Cancelled',
]);

const PAYMENT_STATUSES = new Set(['Pending', 'Paid', 'Failed', 'Refunded']);

const DEFAULT_STORE_SETTINGS = {
  insideDhakaCharge: 80,
  outsideDhakaCharge: 130,
  expressSurcharge: 70,
  freeShippingThreshold: 3000,
};

interface StoreRecord {
  id: string;
  [key: string]: unknown;
}

interface PersistedStore {
  products?: StoreRecord[];
  categories?: StoreRecord[];
  collections?: StoreRecord[];
  coupons?: StoreRecord[];
  reviews?: StoreRecord[];
  orders?: StoreRecord[];
  settings?: Record<string, unknown>;
}

let storeCache: PersistedStore | null = null;
let writeQueue: Promise<void> = Promise.resolve();

async function loadStore(): Promise<PersistedStore> {
  if (storeCache) return storeCache;
  try {
    const raw = await fs.readFile(DATA_FILE, 'utf8');
    storeCache = JSON.parse(raw) as PersistedStore;
  } catch {
    storeCache = {};
  }
  return storeCache;
}

async function saveStore(next: PersistedStore): Promise<void> {
  storeCache = next;
  writeQueue = writeQueue.then(async () => {
    await fs.mkdir(DATA_DIR, { recursive: true });
    const tmpFile = `${DATA_FILE}.tmp`;
    await fs.writeFile(tmpFile, JSON.stringify(next, null, 2), 'utf8');
    await fs.rename(tmpFile, DATA_FILE);
  });
  return writeQueue;
}

function getClientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.trim()) {
    return forwarded.split(',')[0].trim().slice(0, 64);
  }
  return (req.socket?.remoteAddress || req.ip || 'unknown').slice(0, 64);
}

function createRateLimiter(maxRequests: number, windowMs: number, message: string) {
  const hits = new Map<string, { count: number; resetAt: number }>();

  return (req: Request, res: Response, next: NextFunction) => {
    const now = Date.now();
    if (hits.size > 1000) {
      for (const [k, v] of hits.entries()) {
        if (v.resetAt <= now) hits.delete(k);
      }
    }
    const ip = getClientIp(req);
    const existing = hits.get(ip);
    if (!existing || existing.resetAt <= now) {
      hits.set(ip, { count: 1, resetAt: now + windowMs });
      next();
      return;
    }
    if (existing.count >= maxRequests) {
      const retrySecs = Math.max(1, Math.ceil((existing.resetAt - now) / 1000));
      res.setHeader('Retry-After', String(retrySecs));
      res.status(429).json({ error: message });
      return;
    }
    existing.count += 1;
    next();
  };
}

function isSafeMediaUrl(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const trimmed = value.trim();
  if (!trimmed) return false;
  if (/^(javascript|vbscript|data|file):/i.test(trimmed)) return false;
  if (trimmed.startsWith('/uploads/') || trimmed.startsWith('/assets/')) {
    return !trimmed.includes('..');
  }
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

function isSafeHttpUrl(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const trimmed = value.trim();
  if (!trimmed) return false;
  if (/^(javascript|vbscript|data|file):/i.test(trimmed)) return false;
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

function sanitizeSafeId(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value.trim().replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 80);
}

function isDhakaCityServer(city: string): boolean {
  const c = city.trim().toLowerCase();
  return c === 'dhaka' || c === 'savar' || c.includes('dhaka') || c.includes('savar');
}

function normalizePhoneLast10(phone: string): string {
  return phone.replace(/\D/g, '').slice(-10);
}

function isValidBdPhone(phone: string): boolean {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 11 && /^01[3-9]\d{8}$/.test(digits)) return true;
  if (digits.length === 13 && /^8801[3-9]\d{8}$/.test(digits)) return true;
  return false;
}

function isValidEmail(email: string): boolean {
  if (!email) return true;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 200;
}

async function verifyUploadedMagicBytes(filePath: string, ext: string): Promise<boolean> {
  let handle: fs.FileHandle | null = null;
  try {
    handle = await fs.open(filePath, 'r');
    const buf = Buffer.alloc(32);
    const { bytesRead } = await handle.read(buf, 0, 32, 0);
    if (bytesRead < 4) return false;

    const cleanExt = ext.toLowerCase();
    if (cleanExt === '.jpg' || cleanExt === '.jpeg') {
      return buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
    }
    if (cleanExt === '.png') {
      return (
        bytesRead >= 8 &&
        buf[0] === 0x89 &&
        buf[1] === 0x50 &&
        buf[2] === 0x4e &&
        buf[3] === 0x47 &&
        buf[4] === 0x0d &&
        buf[5] === 0x0a &&
        buf[6] === 0x1a &&
        buf[7] === 0x0a
      );
    }
    if (cleanExt === '.webp') {
      return (
        bytesRead >= 12 &&
        buf.toString('ascii', 0, 4) === 'RIFF' &&
        buf.toString('ascii', 8, 12) === 'WEBP'
      );
    }
    if (cleanExt === '.webm') {
      return (
        buf[0] === 0x1a &&
        buf[1] === 0x45 &&
        buf[2] === 0xdf &&
        buf[3] === 0xa3
      );
    }
    if (cleanExt === '.mp4' || cleanExt === '.mov') {
      if (bytesRead < 8) return false;
      const boxType = buf.toString('ascii', 4, 8);
      return (
        boxType === 'ftyp' ||
        boxType === 'moov' ||
        boxType === 'mdat' ||
        boxType === 'wide' ||
        boxType === 'free' ||
        boxType === 'pnot'
      );
    }
    return false;
  } catch {
    return false;
  } finally {
    await handle?.close().catch(() => {});
  }
}

function parseCookies(cookieHeader: string | undefined): Record<string, string> {
  if (!cookieHeader) return {};
  const result: Record<string, string> = {};
  cookieHeader.split(';').forEach((part) => {
    const idx = part.indexOf('=');
    if (idx === -1) return;
    const key = part.slice(0, idx).trim();
    const val = part.slice(idx + 1).trim();
    if (key) {
      try {
        result[key] = decodeURIComponent(val);
      } catch {
        result[key] = val;
      }
    }
  });
  return result;
}

function createSignedAdminToken(): string {
  const payload = JSON.stringify({
    role: 'admin',
    exp: Date.now() + SESSION_TTL_MS,
    nonce: crypto.randomBytes(12).toString('hex'),
  });
  const encoded = Buffer.from(payload, 'utf8').toString('base64url');
  const sig = crypto
    .createHmac('sha256', SESSION_SECRET)
    .update(encoded)
    .digest('base64url');
  return `${encoded}.${sig}`;
}

function verifySignedAdminToken(token: string | undefined): boolean {
  if (!token || typeof token !== 'string') return false;
  const parts = token.split('.');
  if (parts.length !== 2) return false;
  const [encoded, sig] = parts;
  if (!encoded || !sig) return false;

  const expectedSig = crypto
    .createHmac('sha256', SESSION_SECRET)
    .update(encoded)
    .digest('base64url');

  const sigBuf = Buffer.from(sig, 'utf8');
  const expectedBuf = Buffer.from(expectedSig, 'utf8');
  if (sigBuf.length !== expectedBuf.length) return false;
  if (!crypto.timingSafeEqual(sigBuf, expectedBuf)) return false;

  try {
    const parsed = JSON.parse(
      Buffer.from(encoded, 'base64url').toString('utf8')
    ) as { role?: string; exp?: number };
    return parsed.role === 'admin' && typeof parsed.exp === 'number' && parsed.exp > Date.now();
  } catch {
    return false;
  }
}

function isSameOriginMutation(req: Request): boolean {
  const host = req.get('host');
  if (!host) return false;
  const origin = req.get('origin');
  const referer = req.get('referer');
  const candidate = origin || referer;
  if (!candidate) return false;
  try {
    const parsed = new URL(candidate);
    return parsed.host === host;
  } catch {
    return false;
  }
}

function isAdminRequestAuthenticated(req: Request): boolean {
  const headerToken = req.headers['x-admin-session'];
  if (typeof headerToken === 'string' && verifySignedAdminToken(headerToken)) {
    return true;
  }

  const cookies = parseCookies(req.headers.cookie);
  const cookieValid = verifySignedAdminToken(cookies[ADMIN_COOKIE_NAME]);
  if (!cookieValid) return false;

  // Guard cookie-only state-changing requests against cross-site CSRF
  const isMutation =
    req.method === 'POST' ||
    req.method === 'PUT' ||
    req.method === 'PATCH' ||
    req.method === 'DELETE';
  if (isMutation) {
    return isSameOriginMutation(req);
  }
  return true;
}

function setAdminSessionCookie(req: Request, res: Response, token: string) {
  const isHttps =
    req.secure || req.headers['x-forwarded-proto'] === 'https';
  res.cookie(ADMIN_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: isHttps ? 'none' : 'lax',
    secure: isHttps,
    maxAge: SESSION_TTL_MS,
    path: '/',
  });
}

function clearAdminSessionCookie(req: Request, res: Response) {
  const isHttps =
    req.secure || req.headers['x-forwarded-proto'] === 'https';
  res.clearCookie(ADMIN_COOKIE_NAME, {
    httpOnly: true,
    sameSite: isHttps ? 'none' : 'lax',
    secure: isHttps,
    path: '/',
  });
}

function getGeminiClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('AI service is not configured.');
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function sanitizeCouponRecord(raw: unknown): StoreRecord | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const id = sanitizeSafeId(r.id) || `coup-${Date.now()}`;
  const code = typeof r.code === 'string' ? r.code.trim().toUpperCase().slice(0, 40) : '';
  if (!code) return null;
  const discountType = r.discountType === 'fixed' ? 'fixed' : 'percentage';
  const rawValue = Number(r.value);
  const value =
    discountType === 'percentage'
      ? Math.min(90, Math.max(1, Math.round(rawValue || 10)))
      : Math.max(1, Math.round(rawValue || 100));
  const minOrder = Math.max(0, Math.round(Number(r.minOrder) || 0));
  const usageLimit =
    r.usageLimit !== undefined && r.usageLimit !== null && Number(r.usageLimit) > 0
      ? Math.round(Number(r.usageLimit))
      : undefined;
  const usageCount = Math.max(0, Math.round(Number(r.usageCount) || 0));
  const expiryDate =
    typeof r.expiryDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(r.expiryDate.trim())
      ? r.expiryDate.trim()
      : undefined;

  return {
    id,
    code,
    discountType,
    value,
    minOrder,
    ...(expiryDate ? { expiryDate } : {}),
    ...(usageLimit ? { usageLimit } : {}),
    active: Boolean(r.active),
    usageCount,
  };
}

function sanitizeCategoryRecord(raw: unknown): StoreRecord | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const id = sanitizeSafeId(r.id);
  const name = typeof r.name === 'string' ? r.name.trim().slice(0, 80) : '';
  const slug =
    typeof r.slug === 'string' && r.slug.trim()
      ? r.slug
          .trim()
          .toLowerCase()
          .replace(/[^a-z0-9-]+/g, '-')
          .replace(/^-|-$/g, '')
          .slice(0, 80)
      : name
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-|-$/g, '');
  if (!id || !name || !slug) return null;

  const filterCategories = Array.isArray(r.filterCategories)
    ? r.filterCategories.map((fc) => String(fc).trim().slice(0, 60)).filter(Boolean)
    : [name];
  const subcategories = Array.isArray(r.subcategories)
    ? r.subcategories.map((sc) => String(sc).trim().slice(0, 60)).filter(Boolean)
    : [];
  const image = isSafeMediaUrl(r.image) ? r.image.trim() : '';

  return {
    id,
    name,
    slug,
    filterCategories,
    subcategories,
    description:
      typeof r.description === 'string' ? r.description.trim().slice(0, 400) : '',
    image,
    display_order: Math.max(1, Math.round(Number(r.display_order) || 1)),
  };
}

function sanitizeCollectionRecord(raw: unknown): StoreRecord | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const id = sanitizeSafeId(r.id);
  const title = typeof r.title === 'string' ? r.title.trim().slice(0, 100) : '';
  const slug =
    typeof r.slug === 'string' && r.slug.trim()
      ? r.slug
          .trim()
          .toLowerCase()
          .replace(/[^a-z0-9-]+/g, '-')
          .replace(/^-|-$/g, '')
          .slice(0, 100)
      : '';
  if (!id || !title || !slug) return null;

  return {
    id,
    title,
    slug,
    description:
      typeof r.description === 'string' ? r.description.trim().slice(0, 500) : '',
    hero_image: isSafeMediaUrl(r.hero_image) ? r.hero_image.trim() : '',
    featured: Boolean(r.featured),
  };
}

function sanitizeSettingsRecord(
  raw: Record<string, unknown>,
  prev?: Record<string, unknown>
): Record<string, unknown> {
  const base = prev || {};
  const pickNum = (key: string, fallback: number) => {
    const val = raw[key] !== undefined ? Number(raw[key]) : Number(base[key]);
    return Number.isFinite(val) && val >= 0 ? Math.round(val) : fallback;
  };
  const pickStr = (key: string, maxLen: number, fallback = '') => {
    if (typeof raw[key] === 'string') return raw[key].trim().slice(0, maxLen);
    if (typeof base[key] === 'string') return (base[key] as string).trim().slice(0, maxLen);
    return fallback;
  };

  const rawPixel =
    typeof raw.metaPixelId === 'string'
      ? raw.metaPixelId.trim()
      : typeof base.metaPixelId === 'string'
      ? base.metaPixelId.trim()
      : '';
  const metaPixelId = /^\d{5,25}$/.test(rawPixel) ? rawPixel : '';

  const rawFb = raw.facebookUrl !== undefined ? raw.facebookUrl : base.facebookUrl;
  const facebookUrl = isSafeHttpUrl(rawFb)
    ? rawFb.trim().slice(0, 300)
    : 'https://facebook.com/pythoxworld';

  const rawIg = raw.instagramUrl !== undefined ? raw.instagramUrl : base.instagramUrl;
  const instagramUrl = isSafeHttpUrl(rawIg)
    ? rawIg.trim().slice(0, 300)
    : 'https://instagram.com/pythoxworld';

  const rawHero = raw.heroImageUrl !== undefined ? raw.heroImageUrl : base.heroImageUrl;
  const heroImageUrl =
    rawHero === ''
      ? ''
      : isSafeMediaUrl(rawHero)
      ? rawHero.trim().slice(0, 500)
      : typeof base.heroImageUrl === 'string' && isSafeMediaUrl(base.heroImageUrl)
      ? base.heroImageUrl
      : '';

  return {
    id: 'store_config',
    insideDhakaCharge: pickNum('insideDhakaCharge', DEFAULT_STORE_SETTINGS.insideDhakaCharge),
    outsideDhakaCharge: pickNum('outsideDhakaCharge', DEFAULT_STORE_SETTINGS.outsideDhakaCharge),
    expressSurcharge: pickNum('expressSurcharge', DEFAULT_STORE_SETTINGS.expressSurcharge),
    freeShippingThreshold: pickNum(
      'freeShippingThreshold',
      DEFAULT_STORE_SETTINGS.freeShippingThreshold
    ),
    businessAddress: pickStr('businessAddress', 200),
    supportEmail: pickStr('supportEmail', 160),
    supportPhone: pickStr('supportPhone', 30),
    whatsappNumber: pickStr('whatsappNumber', 30).replace(/[^\d+]/g, ''),
    messengerHandle: pickStr('messengerHandle', 100).replace(/[^a-zA-Z0-9._-]/g, ''),
    facebookUrl,
    instagramUrl,
    metaPixelId,
    announcementText: pickStr('announcementText', 300),
    heroImageUrl,
  };
}

function adjustProductInventoryForOrder(
  products: StoreRecord[],
  items: { productId: string; color: string; size: string; quantity: number }[],
  direction: 'deduct' | 'restore'
): StoreRecord[] {
  const sign = direction === 'deduct' ? -1 : 1;
  return products.map((p) => {
    const productItems = items.filter((it) => it.productId === p.id);
    if (productItems.length === 0) return p;

    const totalQty = productItems.reduce((sum, it) => sum + it.quantity, 0);
    const currentInv = Math.max(0, Number(p.inventory) || 0);
    const nextInv = Math.max(0, currentInv + sign * totalQty);

    let nextVariantStock =
      p.variantStock && typeof p.variantStock === 'object'
        ? { ...(p.variantStock as Record<string, number>) }
        : undefined;

    if (nextVariantStock) {
      for (const it of productItems) {
        const key = `${it.color}__${it.size}`;
        if (typeof nextVariantStock[key] === 'number') {
          nextVariantStock[key] = Math.max(0, nextVariantStock[key] + sign * it.quantity);
        }
      }
    }

    return {
      ...p,
      inventory: nextInv,
      ...(nextVariantStock ? { variantStock: nextVariantStock } : {}),
    };
  });
}

async function startServer() {
  await fs.mkdir(UPLOADS_DIR, { recursive: true });
  const app = express();
  app.disable('x-powered-by');

  // Security headers (preserving iframe preview compatibility by avoiding X-Frame-Options/frame-ancestors)
  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader(
      'Permissions-Policy',
      'camera=(self), microphone=(), geolocation=(), payment=(), usb=()'
    );
    next();
  });

  app.use(express.json({ limit: '5mb' }));
  app.use(
    '/uploads',
    express.static(UPLOADS_DIR, {
      maxAge: '7d',
      dotfiles: 'deny',
      setHeaders: (res) => {
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('Content-Security-Policy', "default-src 'none'; sandbox");
        res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
      },
    })
  );

  const loginIpLimiter = createRateLimiter(
    20,
    10 * 60 * 1000,
    'Too many authentication requests. Please wait before trying again.'
  );
  const orderLimiter = createRateLimiter(
    12,
    10 * 60 * 1000,
    'Too many orders submitted from this network. Please wait a few minutes.'
  );
  const trackLimiter = createRateLimiter(
    25,
    5 * 60 * 1000,
    'Too many order tracking lookups. Please wait a few minutes.'
  );
  const couponLimiter = createRateLimiter(
    25,
    5 * 60 * 1000,
    'Too many promo code attempts. Please try again shortly.'
  );
  const reviewLimiter = createRateLimiter(
    10,
    10 * 60 * 1000,
    'Too many review submissions. Please wait a few minutes.'
  );
  const aiLimiter = createRateLimiter(
    20,
    5 * 60 * 1000,
    'Style assistant rate limit reached. Please try again shortly.'
  );
  const paymentLimiter = createRateLimiter(
    15,
    5 * 60 * 1000,
    'Too many payment initiation requests.'
  );

  // Public runtime configuration
  app.get('/api/public-config', (_req, res) => {
    const mapsApiKey =
      process.env.VITE_GOOGLE_MAPS_API_KEY ||
      process.env.GOOGLE_MAPS_API_KEY ||
      '';
    res.json({ mapsApiKey });
  });

  // Public Storefront Catalog & Settings (returns ONLY Admin-published products; excludes orders PII & private coupon list)
  app.get('/api/store', async (_req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    const store = await loadStore();
    const allStoredProducts = Array.isArray(store.products) ? store.products : [];
    const publishedProducts = allStoredProducts.filter(
      (p) => p.status === 'Published'
    );
    res.json({
      connected: true,
      products: publishedProducts,
      categories: store.categories,
      collections: store.collections,
      reviews: Array.isArray(store.reviews) ? store.reviews : [],
      settings: store.settings,
    });
  });

  // Public Dynamic Product Query Endpoint (strictly returns Published products from database)
  app.get('/api/products', async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    const store = await loadStore();
    const allStoredProducts = Array.isArray(store.products) ? store.products : [];
    let publishedProducts = allStoredProducts.filter(
      (p) => p.status === 'Published'
    );

    const categoryQuery =
      typeof req.query.category === 'string' ? req.query.category.trim().toLowerCase() : '';
    if (categoryQuery && categoryQuery !== 'all') {
      publishedProducts = publishedProducts.filter(
        (p) => typeof p.category === 'string' && p.category.toLowerCase() === categoryQuery
      );
    }

    if (req.query.featured === 'true') {
      publishedProducts = publishedProducts.filter((p) => Boolean(p.featured));
    }

    const limitParam = Number(req.query.limit);
    if (Number.isFinite(limitParam) && limitParam > 0) {
      publishedProducts = publishedProducts.slice(0, Math.min(200, Math.floor(limitParam)));
    }

    res.json({
      connected: true,
      count: publishedProducts.length,
      products: publishedProducts,
    });
  });

  // Server-side Promo Code Validation (without dumping active coupons publicly)
  app.post('/api/coupons/validate', couponLimiter, async (req, res) => {
    const { code, subtotal } = (req.body || {}) as {
      code?: unknown;
      subtotal?: unknown;
    };
    const normalized = typeof code === 'string' ? code.trim().toUpperCase() : '';
    if (!normalized || normalized.length > 40) {
      return res.status(400).json({ valid: false, message: 'Enter a valid promo code.' });
    }

    const numericSubtotal = Math.max(0, Number(subtotal) || 0);
    const store = await loadStore();
    const coupons = Array.isArray(store.coupons) ? store.coupons : [];
    const found = coupons.find(
      (c) => String(c.code || '').toUpperCase() === normalized && Boolean(c.active)
    );

    if (!found) {
      return res.status(404).json({ valid: false, message: 'Invalid or expired promo code.' });
    }
    if (typeof found.expiryDate === 'string' && found.expiryDate) {
      const exp = new Date(`${found.expiryDate}T23:59:59Z`);
      if (!Number.isNaN(exp.getTime()) && exp < new Date()) {
        return res.status(400).json({ valid: false, message: 'This promo code has expired.' });
      }
    }
    const usageLimit = Number(found.usageLimit);
    const usageCount = Number(found.usageCount) || 0;
    if (Number.isFinite(usageLimit) && usageLimit > 0 && usageCount >= usageLimit) {
      return res
        .status(400)
        .json({ valid: false, message: 'This promo code has reached its usage limit.' });
    }
    const minOrder = Number(found.minOrder) || 0;
    if (numericSubtotal < minOrder) {
      return res.status(400).json({
        valid: false,
        message: `Minimum order of ৳${minOrder.toLocaleString('en-US')} required for ${normalized}.`,
      });
    }

    return res.json({
      valid: true,
      message: `Promo code ${normalized} applied.`,
      coupon: {
        id: found.id,
        code: normalized,
        discountType: found.discountType === 'fixed' ? 'fixed' : 'percentage',
        value: Number(found.value) || 0,
        minOrder,
        active: true,
        usageCount,
      },
    });
  });

  // Public Customer Order Submission (Authoritative server-side price, stock, shipping & coupon verification)
  app.post('/api/orders', orderLimiter, async (req, res) => {
    const body = (req.body || {}) as Record<string, unknown>;
    const customerName =
      typeof body.customerName === 'string' ? body.customerName.trim().slice(0, 120) : '';
    const customerEmail =
      typeof body.customerEmail === 'string' ? body.customerEmail.trim().slice(0, 200) : '';
    const customerPhone =
      typeof body.customerPhone === 'string' ? body.customerPhone.trim().slice(0, 20) : '';
    const address =
      typeof body.address === 'string' ? body.address.trim().slice(0, 300) : '';
    const city = typeof body.city === 'string' ? body.city.trim().slice(0, 80) : '';
    const area = typeof body.area === 'string' ? body.area.trim().slice(0, 80) : '';
    const postalCode =
      typeof body.postalCode === 'string' && body.postalCode.trim()
        ? body.postalCode.trim().slice(0, 12)
        : '0000';
    const deliveryMethod =
      body.deliveryMethod === 'Express Delivery' ? 'Express Delivery' : 'Standard Delivery';
    const paymentMethod =
      body.paymentMethod === 'bKash' || body.paymentMethod === 'Nagad'
        ? body.paymentMethod
        : body.paymentMethod === 'Cash on Delivery'
        ? 'Cash on Delivery'
        : null;
    const deliveryNote =
      typeof body.deliveryNote === 'string' ? body.deliveryNote.trim().slice(0, 400) : '';
    const paymentReference =
      typeof body.paymentReference === 'string'
        ? body.paymentReference.trim().slice(0, 80)
        : '';
    const paymentSenderNumber =
      typeof body.paymentSenderNumber === 'string'
        ? body.paymentSenderNumber.trim().slice(0, 20)
        : '';
    const rawCouponCode =
      typeof body.couponCode === 'string' ? body.couponCode.trim().toUpperCase().slice(0, 40) : '';
    const rawItems = Array.isArray(body.items) ? body.items : [];

    if (customerName.length < 2) {
      return res.status(400).json({ error: 'Valid customer name is required.' });
    }
    if (!isValidEmail(customerEmail)) {
      return res.status(400).json({ error: 'Invalid customer email address.' });
    }
    if (!isValidBdPhone(customerPhone)) {
      return res.status(400).json({ error: 'Valid Bangladesh mobile number is required.' });
    }
    if (address.length < 5 || city.length < 2) {
      return res.status(400).json({ error: 'Valid delivery address and city are required.' });
    }
    if (!paymentMethod) {
      return res.status(400).json({ error: 'Unsupported payment method.' });
    }
    if (paymentMethod === 'bKash' || paymentMethod === 'Nagad') {
      if (paymentReference.length < 4 || !isValidBdPhone(paymentSenderNumber)) {
        return res.status(400).json({
          error: `${paymentMethod} Transaction ID and valid sender mobile number are required.`,
        });
      }
    }
    if (rawItems.length === 0 || rawItems.length > 30) {
      return res.status(400).json({ error: 'Order must include between 1 and 30 items.' });
    }

    const store = await loadStore();
    const products = Array.isArray(store.products) ? store.products : [];
    const existingOrders = Array.isArray(store.orders) ? store.orders : [];
    const storeSettings = (store.settings || {}) as Record<string, unknown>;

    const authoritativeItems: {
      productId: string;
      sku: string;
      name: string;
      slug: string;
      image: string;
      color: string;
      size: string;
      quantity: number;
      price: number;
    }[] = [];

    const requestedByProduct = new Map<string, number>();
    const requestedByVariant = new Map<string, number>();

    for (const rawItem of rawItems) {
      if (!rawItem || typeof rawItem !== 'object') {
        return res.status(400).json({ error: 'Invalid order line item.' });
      }
      const itemObj = rawItem as Record<string, unknown>;
      const productId = typeof itemObj.productId === 'string' ? itemObj.productId.trim() : '';
      const qty = Math.floor(Number(itemObj.quantity));
      if (!productId || !Number.isFinite(qty) || qty < 1 || qty > 20) {
        return res
          .status(400)
          .json({ error: 'Each item must have a valid product and quantity between 1 and 20.' });
      }

      const product = products.find((p) => p.id === productId);
      if (!product || product.status !== 'Published') {
        return res.status(400).json({
          error: 'One or more ordered products are no longer available.',
        });
      }

      const unitPrice = Number(product.price);
      if (!Number.isFinite(unitPrice) || unitPrice <= 0) {
        return res.status(400).json({ error: 'Product pricing unavailable.' });
      }

      const allowedColors = Array.isArray(product.colors)
        ? (product.colors as { name?: string }[]).map((c) => String(c.name || '')).filter(Boolean)
        : [];
      const reqColor = typeof itemObj.color === 'string' ? itemObj.color.trim() : '';
      const resolvedColor =
        allowedColors.find((c) => c.toLowerCase() === reqColor.toLowerCase()) ||
        allowedColors[0] ||
        'Black';

      const allowedSizes = Array.isArray(product.sizes)
        ? product.sizes.map((s) => String(s)).filter(Boolean)
        : [];
      const reqSize = typeof itemObj.size === 'string' ? itemObj.size.trim() : '';
      const resolvedSize =
        allowedSizes.find((s) => s.toLowerCase() === reqSize.toLowerCase()) ||
        allowedSizes[0] ||
        'M';

      const prevProdQty = requestedByProduct.get(productId) || 0;
      const nextProdQty = prevProdQty + qty;
      const availableInv = Math.max(0, Number(product.inventory) || 0);
      if (nextProdQty > availableInv) {
        return res.status(409).json({
          error:
            availableInv === 0
              ? `"${String(product.name)}" is currently out of stock.`
              : `Only ${availableInv} unit${availableInv === 1 ? '' : 's'} of "${String(product.name)}" remaining.`,
        });
      }
      requestedByProduct.set(productId, nextProdQty);

      const variantKey = `${resolvedColor}__${resolvedSize}`;
      const variantStockMap =
        product.variantStock && typeof product.variantStock === 'object'
          ? (product.variantStock as Record<string, number>)
          : null;
      if (variantStockMap && typeof variantStockMap[variantKey] === 'number') {
        const prevVarQty = requestedByVariant.get(`${productId}:${variantKey}`) || 0;
        const nextVarQty = prevVarQty + qty;
        if (nextVarQty > Math.max(0, variantStockMap[variantKey])) {
          return res.status(409).json({
            error: `Selected variant (${resolvedColor} / ${resolvedSize}) of "${String(product.name)}" is out of stock.`,
          });
        }
        requestedByVariant.set(`${productId}:${variantKey}`, nextVarQty);
      }

      const images = Array.isArray(product.images) ? product.images : [];
      const primaryImage =
        typeof product.primaryImage === 'string' && product.primaryImage
          ? product.primaryImage
          : typeof images[0] === 'string'
          ? images[0]
          : '';

      authoritativeItems.push({
        productId,
        sku: String(product.sku || ''),
        name: String(product.name || ''),
        slug: String(product.slug || ''),
        image: primaryImage,
        color: resolvedColor,
        size: resolvedSize,
        quantity: qty,
        price: unitPrice,
      });
    }

    const subtotal = authoritativeItems.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0
    );

    const insideCharge = Math.max(
      0,
      Number(storeSettings.insideDhakaCharge ?? DEFAULT_STORE_SETTINGS.insideDhakaCharge)
    );
    const outsideCharge = Math.max(
      0,
      Number(storeSettings.outsideDhakaCharge ?? DEFAULT_STORE_SETTINGS.outsideDhakaCharge)
    );
    const expressSurcharge = Math.max(
      0,
      Number(storeSettings.expressSurcharge ?? DEFAULT_STORE_SETTINGS.expressSurcharge)
    );
    const freeThreshold = Math.max(
      0,
      Number(storeSettings.freeShippingThreshold ?? DEFAULT_STORE_SETTINGS.freeShippingThreshold)
    );

    const baseShipping = isDhakaCityServer(city) ? insideCharge : outsideCharge;
    const freeEligible = subtotal >= freeThreshold && subtotal > 0;
    const shipping =
      deliveryMethod === 'Express Delivery'
        ? (freeEligible ? 0 : baseShipping) + expressSurcharge
        : freeEligible
        ? 0
        : baseShipping;

    let discount = 0;
    let appliedCouponCode: string | undefined;
    let nextCoupons = store.coupons;

    if (rawCouponCode && Array.isArray(store.coupons)) {
      const coupon = store.coupons.find(
        (c) => String(c.code || '').toUpperCase() === rawCouponCode && Boolean(c.active)
      );
      if (coupon) {
        const expOk =
          typeof coupon.expiryDate !== 'string' ||
          !coupon.expiryDate ||
          new Date(`${coupon.expiryDate}T23:59:59Z`) >= new Date();
        const limit = Number(coupon.usageLimit);
        const used = Number(coupon.usageCount) || 0;
        const limitOk = !Number.isFinite(limit) || limit <= 0 || used < limit;
        const minOrder = Number(coupon.minOrder) || 0;
        if (expOk && limitOk && subtotal >= minOrder) {
          const val = Number(coupon.value) || 0;
          discount =
            coupon.discountType === 'percentage'
              ? Math.min(subtotal, Math.round((subtotal * val) / 100))
              : Math.min(subtotal, Math.max(0, Math.round(val)));
          appliedCouponCode = rawCouponCode;
          nextCoupons = store.coupons.map((c) =>
            c.id === coupon.id ? { ...c, usageCount: used + 1 } : c
          );
        }
      }
    }

    const total = Math.max(0, subtotal + shipping - discount);

    // Server-generated unique ID and Order Number (never allow client to overwrite existing orders)
    const nowIso = new Date().toISOString();
    const orderId = `ord-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
    let orderNumber = `PYX-${Date.now().toString().slice(-5)}${crypto
      .randomInt(100, 999)}`;
    while (existingOrders.some((o) => o.orderNumber === orderNumber)) {
      orderNumber = `PYX-${crypto.randomInt(100000, 999999)}`;
    }

    const savedOrder: StoreRecord = {
      id: orderId,
      orderNumber,
      isGuest: true,
      customerName,
      customerEmail,
      customerPhone,
      address,
      city,
      area: area || city,
      postalCode,
      deliveryMethod,
      ...(deliveryNote ? { deliveryNote } : {}),
      paymentMethod,
      ...(paymentMethod !== 'Cash on Delivery'
        ? {
            paymentReference,
            paymentSenderNumber,
          }
        : {}),
      paymentStatus: 'Pending',
      deliveryStatus: 'Awaiting studio confirmation',
      items: authoritativeItems,
      subtotal,
      shipping,
      discount,
      ...(appliedCouponCode ? { couponCode: appliedCouponCode } : {}),
      total,
      status: 'Order Received',
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    const nextOrders = [savedOrder, ...existingOrders];
    const nextProducts = adjustProductInventoryForOrder(
      products,
      authoritativeItems,
      'deduct'
    );

    await saveStore({
      ...store,
      orders: nextOrders,
      products: nextProducts,
      ...(nextCoupons ? { coupons: nextCoupons } : {}),
    });

    return res.status(201).json({ order: savedOrder });
  });

  // Public Order Tracking (requires exact matching Order ID + Customer Phone)
  app.get('/api/orders/track', trackLimiter, async (req, res) => {
    const orderNumber = String(req.query.orderNumber || '').trim().toUpperCase();
    const phone = normalizePhoneLast10(String(req.query.phone || ''));
    if (!orderNumber || orderNumber.length < 4 || phone.length < 10) {
      return res.status(400).json({ error: 'Valid Order ID and mobile number are required.' });
    }

    const store = await loadStore();
    const orders = Array.isArray(store.orders) ? store.orders : [];
    const found = orders.find((o) => {
      const ordMatch = String(o.orderNumber || '').toUpperCase() === orderNumber;
      const phoneMatch =
        normalizePhoneLast10(String(o.customerPhone || '')) === phone;
      return ordMatch && phoneMatch;
    });

    if (!found) {
      return res.status(404).json({ error: 'Order not found.' });
    }

    // Return sanitized customer tracking projection (omit email and internal metadata)
    return res.json({
      order: {
        id: found.id,
        orderNumber: found.orderNumber,
        customerName: found.customerName,
        customerEmail: '',
        customerPhone: found.customerPhone,
        address: found.address,
        city: found.city,
        area: found.area,
        postalCode: found.postalCode,
        deliveryMethod: found.deliveryMethod,
        paymentMethod: found.paymentMethod,
        paymentStatus: found.paymentStatus,
        deliveryStatus: found.deliveryStatus,
        items: found.items,
        subtotal: found.subtotal,
        shipping: found.shipping,
        discount: found.discount,
        total: found.total,
        status: found.status,
        createdAt: found.createdAt,
        updatedAt: found.updatedAt,
      },
    });
  });

  // Public Product Review Submission (verifies Published product & recalculates rating)
  app.post('/api/reviews', reviewLimiter, async (req, res) => {
    const body = (req.body || {}) as Record<string, unknown>;
    const productId = typeof body.productId === 'string' ? body.productId.trim() : '';
    const rawComment = typeof body.comment === 'string' ? body.comment.trim() : '';
    if (!productId || rawComment.length < 2) {
      return res.status(400).json({ error: 'Valid productId and review comment are required.' });
    }

    const store = await loadStore();
    const products = Array.isArray(store.products) ? store.products : [];
    const targetProduct = products.find(
      (p) => p.id === productId && p.status === 'Published'
    );
    if (!targetProduct) {
      return res.status(404).json({ error: 'Product not found.' });
    }

    const existingReviews = Array.isArray(store.reviews) ? store.reviews : [];
    const savedReview: StoreRecord = {
      id: `rev-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`,
      productId: targetProduct.id,
      productName: String(targetProduct.name || '').slice(0, 140),
      authorName:
        typeof body.authorName === 'string' && body.authorName.trim()
          ? body.authorName.trim().slice(0, 80)
          : 'Verified Customer',
      rating: Math.min(5, Math.max(1, Math.round(Number(body.rating) || 5))),
      comment: rawComment.slice(0, 1000),
      createdAt: new Date().toISOString(),
    };

    const nextReviews = [savedReview, ...existingReviews];
    const prodReviews = nextReviews.filter((r) => r.productId === targetProduct.id);
    const avgRating =
      prodReviews.length > 0
        ? Number(
            (
              prodReviews.reduce((sum, r) => sum + (Number(r.rating) || 5), 0) /
              prodReviews.length
            ).toFixed(1)
          )
        : 5;

    const nextProducts = products.map((p) =>
      p.id === targetProduct.id
        ? { ...p, reviews_count: prodReviews.length, rating: avgRating }
        : p
    );

    await saveStore({
      ...store,
      reviews: nextReviews,
      products: nextProducts,
    });

    return res.status(201).json({ review: savedReview });
  });

  // Server-side Password-Only Admin Session Verification & Authentication
  app.get('/api/admin/session', (req, res) => {
    const authed = isAdminRequestAuthenticated(req);
    if (!authed) {
      return res.json({ authenticated: false });
    }
    const headerToken = req.headers['x-admin-session'];
    const sessionToken =
      typeof headerToken === 'string' && verifySignedAdminToken(headerToken)
        ? headerToken
        : createSignedAdminToken();
    return res.json({ authenticated: true, sessionToken });
  });

  app.post('/api/admin/login', loginIpLimiter, (req, res) => {
    if (!IS_ADMIN_CONFIGURED || !INITIAL_ADMIN_KEY) {
      return res.status(503).json({
        authenticated: false,
        error: 'Administrator authentication is not configured on the server.',
      });
    }

    const clientIp = getClientIp(req);
    const now = Date.now();
    if (failedAttempts.size > 500) {
      for (const [ip, rec] of failedAttempts.entries()) {
        if (rec.lockedUntil <= now && now - rec.lastSeen > LOCKOUT_MS) {
          failedAttempts.delete(ip);
        }
      }
    }

    const record = failedAttempts.get(clientIp);
    if (record && record.lockedUntil > now) {
      const waitMins = Math.ceil((record.lockedUntil - now) / 60000);
      return res.status(429).json({
        authenticated: false,
        error: `Too many failed attempts. Try again in ${waitMins} minute${waitMins === 1 ? '' : 's'}.`,
      });
    }

    const { password } = (req.body || {}) as { password?: unknown };
    if (typeof password !== 'string' || !password) {
      return res.status(400).json({
        authenticated: false,
        error: 'Password is required.',
      });
    }

    const candidateKey = crypto.scryptSync(password, PASSWORD_SALT, 64);
    const valid = crypto.timingSafeEqual(candidateKey, INITIAL_ADMIN_KEY);

    if (!valid) {
      const prevCount = record && record.lockedUntil <= now ? record.count : 0;
      const nextCount = prevCount + 1;
      failedAttempts.set(clientIp, {
        count: nextCount,
        lockedUntil: nextCount >= MAX_FAILED_ATTEMPTS ? now + LOCKOUT_MS : 0,
        lastSeen: now,
      });
      return res.status(401).json({
        authenticated: false,
        error: 'Incorrect administrator password.',
      });
    }

    failedAttempts.delete(clientIp);
    const sessionToken = createSignedAdminToken();
    setAdminSessionCookie(req, res, sessionToken);
    return res.json({ authenticated: true, sessionToken });
  });

  app.post('/api/admin/logout', (req, res) => {
    clearAdminSessionCookie(req, res);
    res.json({ authenticated: false });
  });

  // Admin-Protected Store Management Endpoints
  app.get('/api/admin/orders', async (req, res) => {
    if (!isAdminRequestAuthenticated(req)) {
      return res.status(401).json({ error: 'Unauthorized admin session.' });
    }
    const store = await loadStore();
    return res.json({
      orders: Array.isArray(store.orders) ? store.orders : [],
      coupons: store.coupons,
      products: Array.isArray(store.products) ? store.products : [],
      categories: store.categories,
      collections: store.collections,
      reviews: Array.isArray(store.reviews) ? store.reviews : [],
    });
  });

  app.get('/api/admin/catalog', async (req, res) => {
    if (!isAdminRequestAuthenticated(req)) {
      return res.status(401).json({ error: 'Unauthorized admin session.' });
    }
    const store = await loadStore();
    return res.json({
      products: Array.isArray(store.products) ? store.products : [],
      categories: store.categories,
      collections: store.collections,
      coupons: store.coupons,
      orders: Array.isArray(store.orders) ? store.orders : [],
      reviews: Array.isArray(store.reviews) ? store.reviews : [],
    });
  });

  app.patch('/api/admin/orders/:id', async (req, res) => {
    if (!isAdminRequestAuthenticated(req)) {
      return res.status(401).json({ error: 'Unauthorized admin session.' });
    }
    const orderId = sanitizeSafeId(req.params.id);
    if (!orderId) {
      return res.status(400).json({ error: 'Invalid order ID.' });
    }

    const { status, paymentStatus, deliveryStatus } = (req.body || {}) as {
      status?: unknown;
      paymentStatus?: unknown;
      deliveryStatus?: unknown;
    };

    if (status !== undefined && (typeof status !== 'string' || !ORDER_STATUSES.has(status))) {
      return res.status(400).json({ error: 'Invalid order status value.' });
    }
    if (
      paymentStatus !== undefined &&
      (typeof paymentStatus !== 'string' || !PAYMENT_STATUSES.has(paymentStatus))
    ) {
      return res.status(400).json({ error: 'Invalid payment status value.' });
    }
    if (deliveryStatus !== undefined && typeof deliveryStatus !== 'string') {
      return res.status(400).json({ error: 'Invalid delivery note.' });
    }

    const store = await loadStore();
    const existingOrders = Array.isArray(store.orders) ? store.orders : [];
    const targetOrder = existingOrders.find((o) => o.id === orderId);
    if (!targetOrder) {
      return res.status(404).json({ error: 'Order not found.' });
    }

    const prevStatus = String(targetOrder.status || '');
    const nextStatus = typeof status === 'string' ? status : prevStatus;

    let nextProducts = store.products;
    if (Array.isArray(store.products) && Array.isArray(targetOrder.items)) {
      const orderItems = (
        targetOrder.items as {
          productId?: string;
          color?: string;
          size?: string;
          quantity?: number;
        }[]
      )
        .filter((it) => typeof it.productId === 'string' && Number(it.quantity) > 0)
        .map((it) => ({
          productId: String(it.productId),
          color: String(it.color || 'Black'),
          size: String(it.size || 'M'),
          quantity: Math.max(1, Math.floor(Number(it.quantity))),
        }));

      if (prevStatus !== 'Cancelled' && nextStatus === 'Cancelled') {
        nextProducts = adjustProductInventoryForOrder(store.products, orderItems, 'restore');
      } else if (prevStatus === 'Cancelled' && nextStatus !== 'Cancelled') {
        nextProducts = adjustProductInventoryForOrder(store.products, orderItems, 'deduct');
      }
    }

    const nextOrders = existingOrders.map((o) => {
      if (o.id !== orderId) return o;
      return {
        ...o,
        ...(typeof status === 'string' ? { status } : {}),
        ...(typeof paymentStatus === 'string' ? { paymentStatus } : {}),
        ...(typeof deliveryStatus === 'string'
          ? { deliveryStatus: deliveryStatus.trim().slice(0, 240) }
          : {}),
        updatedAt: new Date().toISOString(),
      };
    });

    await saveStore({
      ...store,
      orders: nextOrders,
      ...(nextProducts ? { products: nextProducts } : {}),
    });
    return res.json({ ok: true });
  });

  // Admin Real Media Upload Endpoint (Images up to 10MB, Videos up to 50MB + Magic Byte Verification)
  app.post('/api/admin/upload-media', async (req, res) => {
    if (!isAdminRequestAuthenticated(req)) {
      return res.status(401).json({ error: 'Unauthorized admin session.' });
    }

    const kind = String(req.query.kind || '').toLowerCase();
    if (kind !== 'image' && kind !== 'video') {
      return res.status(400).json({ error: 'Invalid upload kind. Expected image or video.' });
    }

    const rawMime = String(req.headers['content-type'] || '')
      .split(';')[0]
      .trim()
      .toLowerCase();
    const rawFilename = String(req.query.filename || '');
    const originalExt = path.extname(rawFilename).toLowerCase();

    const isImage = kind === 'image';
    const maxBytes = isImage ? MAX_IMAGE_BYTES : MAX_VIDEO_BYTES;
    const allowedExts = isImage ? ALLOWED_IMAGE_EXTS : ALLOWED_VIDEO_EXTS;
    const mimeMap = isImage ? IMAGE_MIME_EXT : VIDEO_MIME_EXT;

    const extFromMime = mimeMap[rawMime] || '';
    const resolvedExt = allowedExts.has(originalExt) ? originalExt : extFromMime;

    if (!resolvedExt || (rawMime && rawMime !== 'application/octet-stream' && !mimeMap[rawMime])) {
      return res.status(400).json({
        error: isImage
          ? 'Unsupported image format. Allowed formats: JPG, JPEG, PNG, WEBP.'
          : 'Unsupported video format. Allowed formats: MP4, WEBM, MOV.',
      });
    }

    const declaredLength = Number(req.headers['content-length'] || 0);
    if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
      return res.status(413).json({
        error: isImage
          ? 'Image exceeds the 10 MB size limit.'
          : 'Video exceeds the 50 MB size limit.',
      });
    }

    await fs.mkdir(UPLOADS_DIR, { recursive: true });
    const fileId = `${kind}-${Date.now()}-${crypto.randomBytes(6).toString('hex')}`;
    const finalName = `${fileId}${resolvedExt}`;
    const tempPath = path.join(UPLOADS_DIR, `${finalName}.part`);
    const finalPath = path.join(UPLOADS_DIR, finalName);

    let receivedBytes = 0;
    let aborted = false;
    let settled = false;

    const cleanupTemp = async () => {
      await fs.unlink(tempPath).catch(() => {});
    };

    const writeStream = createWriteStream(tempPath);

    const failRequest = async (status: number, message: string) => {
      if (settled) return;
      settled = true;
      aborted = true;
      writeStream.destroy();
      req.pause();
      await cleanupTemp();
      if (!res.headersSent) {
        res.status(status).json({ error: message });
      }
    };

    req.on('data', (chunk: Buffer) => {
      if (aborted) return;
      receivedBytes += chunk.length;
      if (receivedBytes > maxBytes) {
        void failRequest(
          413,
          isImage
            ? 'Image exceeds the 10 MB size limit.'
            : 'Video exceeds the 50 MB size limit.'
        );
        return;
      }
      if (!writeStream.write(chunk)) {
        req.pause();
      }
    });

    writeStream.on('drain', () => {
      if (!aborted) req.resume();
    });

    req.on('aborted', () => {
      void failRequest(499, 'Upload aborted.');
    });

    req.on('error', () => {
      void failRequest(500, 'Upload stream failed.');
    });

    writeStream.on('error', () => {
      void failRequest(500, 'Unable to store uploaded media file.');
    });

    req.on('end', () => {
      if (aborted || settled) return;
      if (receivedBytes === 0) {
        void failRequest(400, 'Uploaded file is empty.');
        return;
      }
      writeStream.end(async () => {
        if (aborted || settled) return;
        settled = true;
        try {
          const validSignature = await verifyUploadedMagicBytes(tempPath, resolvedExt);
          if (!validSignature) {
            await cleanupTemp();
            if (!res.headersSent) {
              res.status(400).json({
                error: 'File content does not match the declared media format.',
              });
            }
            return;
          }

          await fs.rename(tempPath, finalPath);
          if (!res.headersSent) {
            res.status(201).json({
              url: `/uploads/${finalName}`,
              filename: finalName,
              size: receivedBytes,
              mimeType: rawMime || 'application/octet-stream',
              kind,
            });
          }
        } catch {
          await cleanupTemp();
          if (!res.headersSent) {
            res.status(500).json({ error: 'Failed to finalize uploaded file.' });
          }
        }
      });
    });
  });

  app.post('/api/admin/products', async (req, res) => {
    if (!isAdminRequestAuthenticated(req)) {
      return res.status(401).json({ error: 'Unauthorized admin session.' });
    }
    const { product } = (req.body || {}) as {
      product?: StoreRecord;
    };
    const cleanId = product ? sanitizeSafeId(product.id) : '';
    if (!product || !cleanId) {
      return res.status(400).json({ error: 'Invalid product payload.' });
    }

    const cleanName = typeof product.name === 'string' ? product.name.trim().slice(0, 140) : '';
    const cleanSku =
      typeof product.sku === 'string' ? product.sku.trim().toUpperCase().slice(0, 60) : '';
    const cleanCategory =
      typeof product.category === 'string' && product.category.trim()
        ? product.category.trim().slice(0, 80)
        : '';
    const cleanSubcategory =
      typeof product.subcategory === 'string' && product.subcategory.trim()
        ? product.subcategory.trim().slice(0, 80)
        : undefined;
    const cleanShortDesc =
      typeof product.shortDescription === 'string' && product.shortDescription.trim()
        ? product.shortDescription.trim().slice(0, 300)
        : undefined;
    const cleanDescription =
      typeof product.description === 'string' ? product.description.trim().slice(0, 5000) : '';
    const cleanSizes = Array.isArray(product.sizes)
      ? product.sizes.map((s) => String(s).trim().slice(0, 20)).filter(Boolean)
      : [];
    const cleanColors = Array.isArray(product.colors)
      ? product.colors.filter(
          (c): c is { name: string; hex: string } =>
            Boolean(c) &&
            typeof c === 'object' &&
            typeof (c as { name?: unknown }).name === 'string' &&
            Boolean((c as { name: string }).name.trim())
        )
      : [];
    const cleanImages = Array.isArray(product.images)
      ? product.images.map((img) => String(img).trim()).filter(isSafeMediaUrl)
      : [];
    const cleanTags = Array.isArray(product.tags)
      ? Array.from(
          new Set(product.tags.map((t) => String(t).trim().slice(0, 40)).filter(Boolean))
        )
      : [];

    const allowedStatuses = new Set(['Draft', 'Published', 'Unpublished', 'Out of Stock']);
    const rawStatus = typeof product.status === 'string' ? product.status.trim() : 'Draft';
    const cleanStatus = allowedStatuses.has(rawStatus) ? rawStatus : 'Draft';

    const numericPrice = Number(product.price);
    const rawCompare =
      product.compare_at_price !== null && product.compare_at_price !== undefined
        ? Number(product.compare_at_price)
        : null;
    const compareAtPrice =
      rawCompare !== null && Number.isFinite(rawCompare) && rawCompare > 0
        ? rawCompare
        : null;
    const numericInventory = Math.max(0, Math.round(Number(product.inventory) || 0));

    if (!cleanName) {
      return res.status(400).json({ error: 'Product Name is required.' });
    }
    if (!cleanSku) {
      return res.status(400).json({ error: 'Product SKU / ID is required.' });
    }
    if (!cleanCategory) {
      return res.status(400).json({ error: 'Product Category is required.' });
    }
    if (!Number.isFinite(numericPrice) || numericPrice <= 0) {
      return res.status(400).json({ error: 'Valid Product Price greater than 0 is required.' });
    }
    if (cleanSizes.length === 0) {
      return res.status(400).json({ error: 'Select at least one available size.' });
    }
    if (cleanColors.length === 0) {
      return res.status(400).json({ error: 'Add at least one available color.' });
    }
    if (!cleanDescription) {
      return res.status(400).json({ error: 'Product Description is required.' });
    }
    if (cleanImages.length === 0) {
      return res.status(400).json({ error: 'Upload at least one valid product image.' });
    }

    const rawPrimary =
      typeof product.primaryImage === 'string' ? product.primaryImage.trim() : '';
    const primaryImage =
      rawPrimary && cleanImages.includes(rawPrimary) ? rawPrimary : cleanImages[0];
    const orderedImages = [
      primaryImage,
      ...cleanImages.filter((url) => url !== primaryImage),
    ];
    const cleanVideoUrl =
      typeof product.videoUrl === 'string' && isSafeMediaUrl(product.videoUrl)
        ? product.videoUrl.trim()
        : undefined;

    const cleanSlug =
      typeof product.slug === 'string' && product.slug.trim()
        ? product.slug
            .trim()
            .toLowerCase()
            .replace(/[^a-z0-9-]+/g, '-')
            .replace(/^-|-$/g, '')
            .slice(0, 120)
        : cleanName
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-|-$/g, '') || cleanId;

    const nowIso = new Date().toISOString();
    const hasSaleDiscount =
      Boolean(compareAtPrice && compareAtPrice > numericPrice) || Boolean(product.sale);

    const cleanVariantStock =
      product.variantStock && typeof product.variantStock === 'object'
        ? Object.fromEntries(
            Object.entries(product.variantStock as Record<string, unknown>)
              .filter(([, v]) => Number.isFinite(Number(v)))
              .map(([k, v]) => [k.slice(0, 60), Math.max(0, Math.round(Number(v)))])
          )
        : undefined;

    const cleanFeatures = Array.isArray(product.features)
      ? product.features.map((f) => String(f).trim().slice(0, 160)).filter(Boolean)
      : [];

    const normalizedProduct: StoreRecord = {
      id: cleanId,
      name: cleanName,
      slug: cleanSlug,
      sku: cleanSku,
      category: cleanCategory,
      ...(cleanSubcategory ? { subcategory: cleanSubcategory } : {}),
      collection:
        typeof product.collection === 'string' ? product.collection.trim().slice(0, 80) : '',
      ...(cleanShortDesc ? { shortDescription: cleanShortDesc } : {}),
      description: cleanDescription,
      price: numericPrice,
      compare_at_price: compareAtPrice,
      inventory: numericInventory,
      ...(cleanVariantStock ? { variantStock: cleanVariantStock } : {}),
      tags: cleanTags,
      status: cleanStatus,
      rating: Math.min(5, Math.max(0, Number(product.rating) || 5)),
      reviews_count: Math.max(0, Math.round(Number(product.reviews_count) || 0)),
      featured: Boolean(product.featured),
      new_arrival: Boolean(product.new_arrival),
      best_seller: Boolean(product.best_seller),
      trending: Boolean(product.trending),
      winter_collection: Boolean(product.winter_collection),
      sale: hasSaleDiscount,
      materials: typeof product.materials === 'string' ? product.materials.trim().slice(0, 300) : '',
      size_fit: typeof product.size_fit === 'string' ? product.size_fit.trim().slice(0, 300) : '',
      care_instructions:
        typeof product.care_instructions === 'string'
          ? product.care_instructions.trim().slice(0, 300)
          : '',
      features: cleanFeatures,
      sizes: Array.from(new Set(cleanSizes)),
      colors: cleanColors.map((c) => ({
        name: c.name.trim().slice(0, 40),
        hex:
          typeof c.hex === 'string' && /^#[0-9a-fA-F]{3,8}$/.test(c.hex.trim())
            ? c.hex.trim()
            : '#111111',
      })),
      images: orderedImages,
      primaryImage,
      ...(cleanVideoUrl ? { videoUrl: cleanVideoUrl } : {}),
      created_at:
        typeof product.created_at === 'string' && product.created_at
          ? product.created_at
          : nowIso,
      updated_at: nowIso,
    };

    const store = await loadStore();
    const base = Array.isArray(store.products) ? store.products : [];
    const exists = base.some((p) => p.id === normalizedProduct.id);
    const nextProducts = exists
      ? base.map((p) => (p.id === normalizedProduct.id ? normalizedProduct : p))
      : [normalizedProduct, ...base];
    await saveStore({ ...store, products: nextProducts });
    return res.json({ ok: true, product: normalizedProduct });
  });

  app.delete('/api/admin/products/:id', async (req, res) => {
    if (!isAdminRequestAuthenticated(req)) {
      return res.status(401).json({ error: 'Unauthorized admin session.' });
    }
    const cleanId = sanitizeSafeId(req.params.id);
    if (!cleanId) {
      return res.status(400).json({ error: 'Invalid product ID.' });
    }
    const store = await loadStore();
    const current = Array.isArray(store.products) ? store.products : [];
    await saveStore({
      ...store,
      products: current.filter((p) => p.id !== cleanId),
    });
    return res.json({ ok: true });
  });

  app.post('/api/admin/categories', async (req, res) => {
    if (!isAdminRequestAuthenticated(req)) {
      return res.status(401).json({ error: 'Unauthorized admin session.' });
    }
    const { category, allCategories } = (req.body || {}) as {
      category?: unknown;
      allCategories?: unknown[];
    };
    const cleanCategory = sanitizeCategoryRecord(category);
    if (!cleanCategory) {
      return res.status(400).json({ error: 'Invalid category payload.' });
    }
    const store = await loadStore();
    const base = Array.isArray(store.categories)
      ? store.categories
      : Array.isArray(allCategories)
      ? (allCategories.map(sanitizeCategoryRecord).filter(Boolean) as StoreRecord[])
      : [];
    const exists = base.some((c) => c.id === cleanCategory.id);
    const nextCategories = exists
      ? base.map((c) => (c.id === cleanCategory.id ? cleanCategory : c))
      : [...base, cleanCategory];
    await saveStore({ ...store, categories: nextCategories });
    return res.json({ ok: true, categories: nextCategories });
  });

  app.delete('/api/admin/categories/:id', async (req, res) => {
    if (!isAdminRequestAuthenticated(req)) {
      return res.status(401).json({ error: 'Unauthorized admin session.' });
    }
    const cleanId = sanitizeSafeId(req.params.id);
    if (!cleanId) {
      return res.status(400).json({ error: 'Invalid category ID.' });
    }
    const { allCategories } = (req.body || {}) as {
      allCategories?: unknown[];
    };
    const store = await loadStore();
    const base = Array.isArray(store.categories)
      ? store.categories
      : Array.isArray(allCategories)
      ? (allCategories.map(sanitizeCategoryRecord).filter(Boolean) as StoreRecord[])
      : [];
    const nextCategories = base.filter((c) => c.id !== cleanId);
    await saveStore({ ...store, categories: nextCategories });
    return res.json({ ok: true, categories: nextCategories });
  });

  app.post('/api/admin/collections', async (req, res) => {
    if (!isAdminRequestAuthenticated(req)) {
      return res.status(401).json({ error: 'Unauthorized admin session.' });
    }
    const { collection: col, allCollections } = (req.body || {}) as {
      collection?: unknown;
      allCollections?: unknown[];
    };
    const cleanCol = sanitizeCollectionRecord(col);
    if (!cleanCol) {
      return res.status(400).json({ error: 'Invalid collection payload.' });
    }
    const store = await loadStore();
    const base = Array.isArray(store.collections)
      ? store.collections
      : Array.isArray(allCollections)
      ? (allCollections.map(sanitizeCollectionRecord).filter(Boolean) as StoreRecord[])
      : [];
    const exists = base.some((c) => c.id === cleanCol.id);
    const nextCollections = exists
      ? base.map((c) => (c.id === cleanCol.id ? cleanCol : c))
      : [...base, cleanCol];
    await saveStore({ ...store, collections: nextCollections });
    return res.json({ ok: true });
  });

  app.post('/api/admin/coupons', async (req, res) => {
    if (!isAdminRequestAuthenticated(req)) {
      return res.status(401).json({ error: 'Unauthorized admin session.' });
    }
    const { coupon, allCoupons } = (req.body || {}) as {
      coupon?: unknown;
      allCoupons?: unknown[];
    };
    const cleanCoupon = sanitizeCouponRecord(coupon);
    if (!cleanCoupon) {
      return res.status(400).json({ error: 'Invalid coupon payload.' });
    }
    const store = await loadStore();
    const base = Array.isArray(store.coupons)
      ? store.coupons
      : Array.isArray(allCoupons)
      ? (allCoupons.map(sanitizeCouponRecord).filter(Boolean) as StoreRecord[])
      : [];
    const exists = base.some((c) => c.id === cleanCoupon.id);
    const nextCoupons = exists
      ? base.map((c) => (c.id === cleanCoupon.id ? cleanCoupon : c))
      : [...base, cleanCoupon];
    await saveStore({ ...store, coupons: nextCoupons });
    return res.json({ ok: true, coupon: cleanCoupon });
  });

  app.delete('/api/admin/coupons/:id', async (req, res) => {
    if (!isAdminRequestAuthenticated(req)) {
      return res.status(401).json({ error: 'Unauthorized admin session.' });
    }
    const cleanId = sanitizeSafeId(req.params.id);
    if (!cleanId) {
      return res.status(400).json({ error: 'Invalid coupon ID.' });
    }
    const store = await loadStore();
    if (Array.isArray(store.coupons)) {
      await saveStore({
        ...store,
        coupons: store.coupons.filter((c) => c.id !== cleanId),
      });
    }
    return res.json({ ok: true });
  });

  app.put('/api/admin/settings', async (req, res) => {
    if (!isAdminRequestAuthenticated(req)) {
      return res.status(401).json({ error: 'Unauthorized admin session.' });
    }
    const nextSettings = req.body as Record<string, unknown> | undefined;
    if (!nextSettings || typeof nextSettings !== 'object' || Array.isArray(nextSettings)) {
      return res.status(400).json({ error: 'Invalid settings payload.' });
    }
    const store = await loadStore();
    const sanitized = sanitizeSettingsRecord(nextSettings, store.settings);
    await saveStore({ ...store, settings: sanitized });
    return res.json({ ok: true, settings: sanitized });
  });

  app.post('/api/admin/sync-catalog', async (req, res) => {
    if (!isAdminRequestAuthenticated(req)) {
      return res.status(401).json({ error: 'Unauthorized admin session.' });
    }
    const payload = (req.body || {}) as PersistedStore;
    const store = await loadStore();
    await saveStore({
      ...store,
      ...(Array.isArray(payload.categories)
        ? {
            categories: payload.categories
              .map(sanitizeCategoryRecord)
              .filter(Boolean) as StoreRecord[],
          }
        : {}),
      ...(Array.isArray(payload.collections)
        ? {
            collections: payload.collections
              .map(sanitizeCollectionRecord)
              .filter(Boolean) as StoreRecord[],
          }
        : {}),
      ...(Array.isArray(payload.coupons)
        ? {
            coupons: payload.coupons
              .map(sanitizeCouponRecord)
              .filter(Boolean) as StoreRecord[],
          }
        : {}),
      ...(payload.settings && typeof payload.settings === 'object'
        ? { settings: sanitizeSettingsRecord(payload.settings, store.settings) }
        : {}),
    });
    return res.json({ ok: true });
  });

  // Clean payment initiation hooks ready for future gateway integration (validated against server order if present)
  app.post('/api/payments/bkash/initiate', paymentLimiter, async (req, res) => {
    const { orderNumber, amount, customerPhone } = (req.body || {}) as {
      orderNumber?: unknown;
      amount?: unknown;
      customerPhone?: unknown;
    };
    const cleanOrderNo =
      typeof orderNumber === 'string' ? orderNumber.trim().toUpperCase().slice(0, 40) : '';
    const numericAmount = Number(amount);
    if (!cleanOrderNo || !Number.isFinite(numericAmount) || numericAmount <= 0) {
      return res.status(400).json({ error: 'Valid order number and amount are required.' });
    }
    const store = await loadStore();
    const matchedOrder = Array.isArray(store.orders)
      ? store.orders.find((o) => String(o.orderNumber || '').toUpperCase() === cleanOrderNo)
      : undefined;
    if (!matchedOrder) {
      return res.status(404).json({ error: 'Order record not found.' });
    }
    const authoritativeAmount = Number(matchedOrder.total) || 0;
    return res.json({
      mode: 'pending_verification',
      gateway: 'bKash',
      orderNumber: cleanOrderNo,
      amount: authoritativeAmount,
      payerReference:
        typeof customerPhone === 'string' && customerPhone.trim()
          ? customerPhone.trim().slice(0, 20)
          : cleanOrderNo,
      message: 'bKash order recorded with Pending payment status.',
    });
  });

  app.post('/api/payments/nagad/initiate', paymentLimiter, async (req, res) => {
    const { orderNumber, amount } = (req.body || {}) as {
      orderNumber?: unknown;
      amount?: unknown;
    };
    const cleanOrderNo =
      typeof orderNumber === 'string' ? orderNumber.trim().toUpperCase().slice(0, 40) : '';
    const numericAmount = Number(amount);
    if (!cleanOrderNo || !Number.isFinite(numericAmount) || numericAmount <= 0) {
      return res.status(400).json({ error: 'Valid order number and amount are required.' });
    }
    const store = await loadStore();
    const matchedOrder = Array.isArray(store.orders)
      ? store.orders.find((o) => String(o.orderNumber || '').toUpperCase() === cleanOrderNo)
      : undefined;
    if (!matchedOrder) {
      return res.status(404).json({ error: 'Order record not found.' });
    }
    return res.json({
      mode: 'pending_verification',
      gateway: 'Nagad',
      orderNumber: cleanOrderNo,
      amount: Number(matchedOrder.total) || 0,
      message: 'Nagad order recorded with Pending payment status.',
    });
  });

  // Low-latency Menswear Fit & Styling Advisor
  app.post('/api/style-advice', aiLimiter, async (req, res) => {
    try {
      const { productName, category, materials, question, sizes } = req.body || {};
      if (!question || typeof question !== 'string' || question.trim().length < 2) {
        return res.status(400).json({ error: 'Question is required.' });
      }

      const ai = getGeminiClient();
      const response = await ai.models.generateContent({
        model: 'gemini-3.1-flash-lite',
        contents: `Customer question about "${String(productName || 'PYTHOX WORLD menswear piece').slice(0, 120)}" (${String(category || 'Menswear').slice(0, 60)}, materials: ${String(materials || 'Combed cotton blend').slice(0, 120)}, available sizes: ${Array.isArray(sizes) ? sizes.slice(0, 10).join(', ') : 'S-XXL'}): ${question.slice(0, 400)}`,
        config: {
          systemInstruction:
            'You are a PYTHOX WORLD menswear fit and styling specialist based in Savar, Dhaka, Bangladesh. Give crisp, confident, masculine styling, sizing, and fabric-care advice in 2 to 3 concise sentences. Avoid emojis.',
        },
      });

      res.json({
        answer:
          response.text ||
          'We recommend choosing your regular size for a clean tailored silhouette, or sizing up one step if layering over heavyweight knitwear.',
      });
    } catch (error: unknown) {
      console.error('Style advice error:', error instanceof Error ? error.message : error);
      res.status(503).json({ error: 'Style advisor is temporarily unavailable.' });
    }
  });

  // Low-latency Smart Search Suggestions
  app.post('/api/smart-search', aiLimiter, async (req, res) => {
    try {
      const { query, catalogSummary } = req.body || {};
      if (!query || typeof query !== 'string' || !query.trim()) {
        return res.status(400).json({ error: 'Search query is required.' });
      }

      const ai = getGeminiClient();
      const response = await ai.models.generateContent({
        model: 'gemini-3.1-flash-lite',
        contents: `Menswear search query: "${query.slice(0, 150)}". Catalog items: ${JSON.stringify(catalogSummary || []).slice(0, 3500)}`,
        config: {
          systemInstruction:
            'Match the men\'s fashion shopper query to the most relevant product IDs and provide a brief 6-10 word styling curation note.',
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              matchedIds: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
              curationNote: { type: Type.STRING },
            },
          },
        },
      });

      const parsed = JSON.parse(response.text || '{"matchedIds":[],"curationNote":""}');
      res.json(parsed);
    } catch (error: unknown) {
      console.error('Smart search error:', error instanceof Error ? error.message : error);
      res.status(503).json({
        error: 'Smart search assistant unavailable.',
        matchedIds: [],
        curationNote: '',
      });
    }
  });

  // Admin Product Copy Generator (Protected by server-side admin session)
  app.post('/api/admin/generate-copy', aiLimiter, async (req, res) => {
    if (!isAdminRequestAuthenticated(req)) {
      return res.status(401).json({ error: 'Unauthorized admin session.' });
    }
    try {
      const { name, category, materials } = req.body || {};
      if (!name || typeof name !== 'string') {
        return res.status(400).json({ error: 'Product name is required.' });
      }
      const ai = getGeminiClient();
      const response = await ai.models.generateContent({
        model: 'gemini-3.1-flash-lite',
        contents: `Write a luxury minimalist men's fashion e-commerce description (2 sentences) and a 1-sentence size & fit note for PYTHOX WORLD product: ${name.slice(0, 120)} (${String(category || 'Menswear').slice(0, 60)}, materials: ${String(materials || 'Combed heavy cotton').slice(0, 120)}).`,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              description: { type: Type.STRING },
              sizeFit: { type: Type.STRING },
            },
          },
        },
      });

      res.json(JSON.parse(response.text || '{}'));
    } catch (error: unknown) {
      console.error('Copy generation error:', error instanceof Error ? error.message : error);
      res.status(503).json({ error: 'Copy generation service is unavailable right now.' });
    }
  });

  if (!IS_PRODUCTION) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`PYTHOX WORLD server listening on http://localhost:${PORT}`);
  });
}

startServer();
