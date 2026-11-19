export function formatBDT(amount: number): string {
  const safe = Number.isFinite(amount) ? Math.round(amount) : 0;
  return `৳${safe.toLocaleString('en-US')}`;
}

export function validateBangladeshPhone(raw: string): boolean {
  const cleaned = raw.replace(/[\s\-()]/g, '');
  return /^(\+?88)?01[3-9]\d{8}$/.test(cleaned);
}

export function normalizeBangladeshPhone(raw: string): string {
  const cleaned = raw.replace(/[\s\-()]/g, '');
  if (cleaned.startsWith('+880')) return cleaned;
  if (cleaned.startsWith('880')) return `+${cleaned}`;
  if (cleaned.startsWith('01')) return `+88${cleaned}`;
  return cleaned;
}

export function isDhakaCity(city: string): boolean {
  const normalized = city.trim().toLowerCase();
  return (
    normalized === 'dhaka' ||
    normalized.includes('dhaka') ||
    normalized === 'savar' ||
    normalized === 'keraniganj' ||
    normalized === 'gazipur' ||
    normalized === 'narayanganj'
  );
}

export function calculateDiscountPercent(
  price: number,
  compareAtPrice?: number | null
): number {
  if (!compareAtPrice || compareAtPrice <= price) return 0;
  return Math.round(((compareAtPrice - price) / compareAtPrice) * 100);
}

export function sanitizeDocId(raw: string): string {
  return raw
    .trim()
    .replace(/[^a-zA-Z0-9_\-]/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 100);
}

export function getVariantStockKey(color: string, size: string): string {
  return `${color.trim()}__${size.trim()}`;
}

export function sanitizeExternalHref(raw?: string | null, fallback = ''): string {
  const value = (raw || '').trim();
  if (!value) return fallback;
  try {
    const parsed = new URL(value);
    if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
      return parsed.toString();
    }
    return fallback;
  } catch {
    return fallback;
  }
}

export function sanitizeMediaUrl(raw?: string | null, fallback = ''): string {
  const value = (raw || '').trim();
  if (!value) return fallback;
  if (value.startsWith('/uploads/') || value.startsWith('/assets/')) {
    return value;
  }
  if (/^data:image\/(png|jpe?g|webp|gif|avif);base64,[a-zA-Z0-9+/=]+$/i.test(value)) {
    return value;
  }
  try {
    const parsed = new URL(value);
    if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
      return parsed.toString();
    }
    return fallback;
  } catch {
    return fallback;
  }
}

export function sanitizePixelId(raw?: string | null): string {
  const value = (raw || '').trim();
  return /^\d{5,25}$/.test(value) ? value : '';
}
