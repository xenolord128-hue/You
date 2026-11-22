import { Category, Product } from '../types/ecommerce';

export function normalizeCategoryKey(value?: string | null): string {
  return (value || '')
    .trim()
    .toLowerCase()
    .replace(/[’']/g, "'")
    .replace(/\s+/g, ' ');
}

export function slugifyCategoryName(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[’']/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * Legacy pre-upgrade default category IDs (4 broad groups before the 7-category Men's Fashion taxonomy).
 */
const LEGACY_SEED_CATEGORY_IDS = new Set([
  'cat-tees',
  'cat-outerwear',
  'cat-shirts-bottoms',
  'cat-footwear-acc',
]);

const LEGACY_SEED_CATEGORY_NAMES = new Set([
  't-shirts & polos',
  'hoodies & outerwear',
  'shirts & bottoms',
  'caps, footwear & steel',
]);

export function isLegacySeedCategorySet(list: Category[]): boolean {
  if (list.length === 0) return true;
  return list.every(
    (c) =>
      LEGACY_SEED_CATEGORY_IDS.has(c.id) &&
      LEGACY_SEED_CATEGORY_NAMES.has(normalizeCategoryKey(c.name))
  );
}

export function getSortedCategories(list: Category[]): Category[] {
  return [...list].sort(
    (a, b) => (Number(a.display_order) || 999) - (Number(b.display_order) || 999)
  );
}

/**
 * Finds a Category record by slug, ID, name, or filterCategory alias.
 */
export function findCategoryByIdentifier(
  categories: Category[],
  identifier?: string | null
): Category | undefined {
  const key = normalizeCategoryKey(identifier);
  if (!key || key === 'all') return undefined;

  return (
    categories.find((c) => normalizeCategoryKey(c.slug) === key) ||
    categories.find((c) => normalizeCategoryKey(c.name) === key) ||
    categories.find((c) => normalizeCategoryKey(c.id) === key) ||
    categories.find((c) =>
      (c.filterCategories || []).some((fc) => normalizeCategoryKey(fc) === key)
    )
  );
}

/**
 * Returns all unique assigned category labels on a Product (primary + additionalCategories).
 */
export function getProductAssignedCategories(product: Product): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  [product.category, ...(product.additionalCategories || [])].forEach((entry) => {
    const clean = (entry || '').trim();
    if (!clean) return;
    const norm = normalizeCategoryKey(clean);
    if (!seen.has(norm)) {
      seen.add(norm);
      out.push(clean);
    }
  });
  return out;
}

/**
 * Checks whether a product belongs to a Category record or raw category identifier string.
 * Supports primary category, multi-category `additionalCategories`, slugs, and filter aliases.
 */
export function productMatchesCategory(
  product: Product,
  categoryOrIdentifier: Category | string,
  allCategories: Category[] = []
): boolean {
  const assigned = getProductAssignedCategories(product);
  const resolvedCat =
    typeof categoryOrIdentifier === 'string'
      ? findCategoryByIdentifier(allCategories, categoryOrIdentifier)
      : categoryOrIdentifier;

  if (resolvedCat) {
    const validTokens = new Set<string>(
      [
        resolvedCat.name,
        resolvedCat.slug,
        resolvedCat.id,
        ...(resolvedCat.filterCategories || []),
        ...(resolvedCat.subcategories || []),
      ]
        .map(normalizeCategoryKey)
        .filter(Boolean)
    );

    const directMatch = assigned.some((val) =>
      validTokens.has(normalizeCategoryKey(val))
    );
    if (directMatch) return true;

    // If product has a subcategory listed under this Category (e.g. legacy generic category), allow match
    if (
      product.subcategory &&
      (resolvedCat.subcategories || []).some(
        (sub) => normalizeCategoryKey(sub) === normalizeCategoryKey(product.subcategory)
      )
    ) {
      return true;
    }

    return false;
  }

  const targetKey = normalizeCategoryKey(
    typeof categoryOrIdentifier === 'string' ? categoryOrIdentifier : ''
  );
  if (!targetKey || targetKey === 'all') return true;
  return assigned.some((val) => normalizeCategoryKey(val) === targetKey);
}

export function productMatchesSubcategory(
  product: Product,
  subcategoryName?: string | null
): boolean {
  const target = normalizeCategoryKey(subcategoryName);
  if (!target || target === 'all') return true;
  return normalizeCategoryKey(product.subcategory) === target;
}

export function countProductsInCategory(
  products: Product[],
  category: Category,
  allCategories: Category[] = []
): number {
  return products.filter((p) => productMatchesCategory(p, category, allCategories)).length;
}

export function countProductsInSubcategory(
  products: Product[],
  category: Category | undefined,
  subcategoryName: string,
  allCategories: Category[] = []
): number {
  return products.filter((p) => {
    if (category && !productMatchesCategory(p, category, allCategories)) {
      return false;
    }
    return productMatchesSubcategory(p, subcategoryName);
  }).length;
}
