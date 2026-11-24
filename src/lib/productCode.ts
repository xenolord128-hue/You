const CODE_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';

export function normalizeProductCode(code: string | undefined | null): string {
  return String(code || '')
    .trim()
    .replace(/^#+/, '')
    .replace(/\s+/g, '-')
    .toUpperCase()
    .slice(0, 80);
}

export function productCodeSearchKey(code: string | undefined | null): string {
  return String(code || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

export function isProductCodeTaken(
  code: string,
  products: ReadonlyArray<{ id: string; sku?: string }>,
  excludeProductId?: string
): boolean {
  const normalized = normalizeProductCode(code);
  const compact = productCodeSearchKey(code);
  if (!normalized) return false;
  return products.some((p) => {
    if (excludeProductId && p.id === excludeProductId) return false;
    const pNorm = normalizeProductCode(p.sku);
    const pCompact = productCodeSearchKey(p.sku);
    return pNorm === normalized || (Boolean(compact) && pCompact === compact);
  });
}

export function generateUniqueProductCode(
  existingProducts: ReadonlyArray<{ id: string; sku?: string }> = [],
  excludeProductId?: string
): string {
  for (let attempt = 0; attempt < 250; attempt += 1) {
    let suffix = '';
    if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
      const bytes = new Uint8Array(6);
      crypto.getRandomValues(bytes);
      for (let i = 0; i < bytes.length; i += 1) {
        suffix += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
      }
    } else {
      for (let i = 0; i < 6; i += 1) {
        suffix += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
      }
    }
    const candidate = `PW-${suffix}`;
    if (!isProductCodeTaken(candidate, existingProducts, excludeProductId)) {
      return candidate;
    }
  }
  return `PW-${Date.now().toString(36).toUpperCase().slice(-6)}`;
}
