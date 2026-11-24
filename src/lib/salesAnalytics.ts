export interface ProductSaleStat {
  id: string;
  productId: string;
  sku?: string;
  productName: string;
  unitsSold: number;
  revenue: number;
  orderCount: number;
  lastSoldAt?: string;
  updatedAt: string;
}

export const COUNTABLE_SALE_STATUSES = new Set<string>([
  'Order Confirmed',
  'Processing',
  'Packed',
  'Shipped',
  'Out for Delivery',
  'Delivered',
]);

export interface SaleOrderItemLike {
  productId?: unknown;
  sku?: unknown;
  name?: unknown;
  quantity?: unknown;
  price?: unknown;
}

export interface SaleOrderLike {
  id?: unknown;
  status?: unknown;
  paymentStatus?: unknown;
  paymentMethod?: unknown;
  items?: unknown;
  createdAt?: unknown;
  total?: unknown;
  deleted?: unknown;
  isTest?: unknown;
}

export interface SaleProductLike {
  id?: unknown;
  sku?: unknown;
  name?: unknown;
  status?: unknown;
}

export function sanitizeSaleDocId(raw: unknown): string {
  const clean = String(raw || '')
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, '');
  return clean.slice(0, 128);
}

/**
 * Determines whether an order represents a genuine, confirmed/fulfilled sale.
 * Excludes unconfirmed 'Order Received', 'Cancelled', 'Failed', 'Refunded',
 * and unpaid prepaid (bKash/Nagad) attempts.
 */
export function isCountableSaleOrder(order: unknown): boolean {
  if (!order || typeof order !== 'object') return false;
  const o = order as SaleOrderLike;
  if (o.deleted === true || o.isTest === true) return false;

  const status = typeof o.status === 'string' ? o.status.trim() : '';
  if (!COUNTABLE_SALE_STATUSES.has(status)) return false;

  const paymentStatus = typeof o.paymentStatus === 'string' ? o.paymentStatus.trim() : '';
  if (paymentStatus === 'Failed' || paymentStatus === 'Refunded') return false;

  const paymentMethod = typeof o.paymentMethod === 'string' ? o.paymentMethod.trim() : '';
  if (paymentMethod && paymentMethod !== 'Cash on Delivery' && paymentStatus !== 'Paid') {
    return false;
  }

  return true;
}

export function sortProductSalesDescending(sales: ProductSaleStat[]): ProductSaleStat[] {
  return [...sales].sort((a, b) => {
    if (b.unitsSold !== a.unitsSold) return b.unitsSold - a.unitsSold;
    if (b.revenue !== a.revenue) return b.revenue - a.revenue;
    if (b.orderCount !== a.orderCount) return b.orderCount - a.orderCount;
    const tA = a.lastSoldAt ? Date.parse(a.lastSoldAt) || 0 : 0;
    const tB = b.lastSoldAt ? Date.parse(b.lastSoldAt) || 0 : 0;
    if (tB !== tA) return tB - tA;
    return a.productName.localeCompare(b.productName);
  });
}

export function computeProductSalesFromOrders(
  orders: readonly unknown[],
  products: readonly unknown[] = [],
  nowIso: string = new Date().toISOString()
): ProductSaleStat[] {
  const productLookup = new Map<string, { name: string; sku: string }>();
  for (const rawProd of products) {
    if (!rawProd || typeof rawProd !== 'object') continue;
    const p = rawProd as SaleProductLike;
    const pid = sanitizeSaleDocId(p.id);
    if (!pid) continue;
    productLookup.set(pid, {
      name: typeof p.name === 'string' ? p.name.trim() : '',
      sku: typeof p.sku === 'string' ? p.sku.trim() : '',
    });
  }

  const aggMap = new Map<string, ProductSaleStat>();

  for (const rawOrder of orders) {
    if (!isCountableSaleOrder(rawOrder)) continue;
    const order = rawOrder as SaleOrderLike;
    const items = Array.isArray(order.items) ? order.items : [];
    const orderCreatedAt =
      typeof order.createdAt === 'string' ? order.createdAt.slice(0, 64) : '';
    const seenProductsInOrder = new Set<string>();

    for (const rawItem of items) {
      if (!rawItem || typeof rawItem !== 'object') continue;
      const item = rawItem as SaleOrderItemLike;
      const pid = sanitizeSaleDocId(item.productId);
      if (!pid) continue;

      const qty = Math.floor(Number(item.quantity));
      if (!Number.isFinite(qty) || qty <= 0) continue;

      const unitPrice = Math.max(0, Number(item.price) || 0);
      const catalogInfo = productLookup.get(pid);
      const itemName =
        catalogInfo?.name ||
        (typeof item.name === 'string' ? item.name.trim() : '') ||
        'Product';
      const itemSku =
        catalogInfo?.sku ||
        (typeof item.sku === 'string' ? item.sku.trim() : '');

      const prev = aggMap.get(pid) || {
        id: pid,
        productId: pid,
        ...(itemSku ? { sku: itemSku.slice(0, 80) } : {}),
        productName: itemName.slice(0, 200),
        unitsSold: 0,
        revenue: 0,
        orderCount: 0,
        ...(orderCreatedAt ? { lastSoldAt: orderCreatedAt } : {}),
        updatedAt: nowIso.slice(0, 64),
      };

      prev.unitsSold += qty;
      prev.revenue = Math.round((prev.revenue + unitPrice * qty) * 100) / 100;
      if (!seenProductsInOrder.has(pid)) {
        prev.orderCount += 1;
        seenProductsInOrder.add(pid);
      }
      if (itemName) prev.productName = itemName.slice(0, 200);
      if (itemSku) prev.sku = itemSku.slice(0, 80);
      if (orderCreatedAt) {
        const prevMs = prev.lastSoldAt ? Date.parse(prev.lastSoldAt) || 0 : 0;
        const nextMs = Date.parse(orderCreatedAt) || 0;
        if (nextMs >= prevMs) {
          prev.lastSoldAt = orderCreatedAt;
        }
      }

      aggMap.set(pid, prev);
    }
  }

  return sortProductSalesDescending(Array.from(aggMap.values()));
}

export function buildProductSalesMap(
  sales: readonly ProductSaleStat[]
): Record<string, ProductSaleStat> {
  const map: Record<string, ProductSaleStat> = {};
  for (const s of sales) {
    if (!s || typeof s.productId !== 'string') continue;
    const pid = sanitizeSaleDocId(s.productId || s.id);
    if (!pid) continue;
    const unitsSold = Math.max(0, Math.round(Number(s.unitsSold) || 0));
    if (unitsSold <= 0) continue;
    map[pid] = {
      ...s,
      id: pid,
      productId: pid,
      unitsSold,
      revenue: Math.max(0, Number(s.revenue) || 0),
      orderCount: Math.max(0, Math.round(Number(s.orderCount) || 0)),
    };
  }
  return map;
}

export function getBestSellingProducts<
  T extends { id: string; status?: string; reviews_count?: number }
>(
  products: readonly T[],
  salesInput: readonly ProductSaleStat[] | Record<string, ProductSaleStat>,
  limit?: number
): T[] {
  const salesMap = Array.isArray(salesInput)
    ? buildProductSalesMap(salesInput)
    : (salesInput as Record<string, ProductSaleStat>);

  const ranked = products
    .filter((p) => p.status === 'Published' && (salesMap[p.id]?.unitsSold ?? 0) > 0)
    .sort((a, b) => {
      const sa = salesMap[a.id];
      const sb = salesMap[b.id];
      const unitsDiff = (sb?.unitsSold ?? 0) - (sa?.unitsSold ?? 0);
      if (unitsDiff !== 0) return unitsDiff;
      const revDiff = (sb?.revenue ?? 0) - (sa?.revenue ?? 0);
      if (revDiff !== 0) return revDiff;
      const ordDiff = (sb?.orderCount ?? 0) - (sa?.orderCount ?? 0);
      if (ordDiff !== 0) return ordDiff;
      const tA = sa?.lastSoldAt ? Date.parse(sa.lastSoldAt) || 0 : 0;
      const tB = sb?.lastSoldAt ? Date.parse(sb.lastSoldAt) || 0 : 0;
      if (tB !== tA) return tB - tA;
      return (b.reviews_count ?? 0) - (a.reviews_count ?? 0);
    });

  return typeof limit === 'number' && limit > 0 ? ranked.slice(0, limit) : ranked;
}

export function diffProductSalesForSync(
  nextSales: readonly ProductSaleStat[],
  existingSales: readonly ProductSaleStat[]
): {
  toUpsert: ProductSaleStat[];
  toDeleteIds: string[];
  hasChanges: boolean;
} {
  const existingMap = new Map<string, ProductSaleStat>();
  for (const s of existingSales) {
    const pid = sanitizeSaleDocId(s.productId || s.id);
    if (pid) existingMap.set(pid, s);
  }

  const nextMap = new Map<string, ProductSaleStat>();
  for (const s of nextSales) {
    const pid = sanitizeSaleDocId(s.productId || s.id);
    if (pid && s.unitsSold > 0) {
      nextMap.set(pid, { ...s, id: pid, productId: pid });
    }
  }

  const toUpsert: ProductSaleStat[] = [];
  for (const [pid, nextStat] of nextMap.entries()) {
    const prev = existingMap.get(pid);
    if (
      !prev ||
      prev.unitsSold !== nextStat.unitsSold ||
      Math.round(prev.revenue) !== Math.round(nextStat.revenue) ||
      prev.orderCount !== nextStat.orderCount ||
      prev.productName !== nextStat.productName ||
      (prev.sku || '') !== (nextStat.sku || '') ||
      (prev.lastSoldAt || '') !== (nextStat.lastSoldAt || '')
    ) {
      toUpsert.push(nextStat);
    }
  }

  const toDeleteIds: string[] = [];
  for (const pid of existingMap.keys()) {
    if (!nextMap.has(pid)) {
      toDeleteIds.push(pid);
    }
  }

  return {
    toUpsert,
    toDeleteIds,
    hasChanges: toUpsert.length > 0 || toDeleteIds.length > 0,
  };
}
