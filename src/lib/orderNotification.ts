import { Order, OrderItem } from '../types/ecommerce';

export const DEFAULT_PUBLIC_STORE_ORIGIN = 'https://pythoxworld.com';
export const DEFAULT_STORE_NAME = 'PYTHOX WORLD';
export const ADMIN_NOTIFICATION_EMAIL = 'pythoxfashion@gmail.com';

export interface NotificationProductLike {
  id: string;
  slug?: string;
  name?: string;
}

export interface NotificationProductEntry {
  product_name: string;
  product_link: string;
  size: string;
  color: string;
  quantity: string;
  price: string;
}

export interface AdminOrderNotificationTemplateParams {
  to_email: string;
  order_id: string;
  order_date: string;
  order_status: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  delivery_address: string;
  city: string;
  postal_code: string;
  delivery_note: string;
  product_name: string;
  product_link: string;
  size: string;
  color: string;
  quantity: string;
  price: string;
  products_list: string;
  payment_method: string;
  transaction_id: string;
  payment_status: string;
  subtotal: string;
  delivery_charge: string;
  discount: string;
  total_amount: string;
  additional_information: string;
  store_name: string;
  message: string;
}

export interface BuiltAdminOrderNotification {
  orderId: string;
  orderNumber: string;
  productEntries: NotificationProductEntry[];
  templateParams: AdminOrderNotificationTemplateParams;
  messageText: string;
}

function strOrNA(val: unknown): string {
  if (typeof val === 'number' && Number.isFinite(val)) {
    return String(val);
  }
  if (typeof val === 'string') {
    const trimmed = val.trim();
    return trimmed.length > 0 ? trimmed : 'N/A';
  }
  return 'N/A';
}

export function resolvePublicStoreOrigin(candidate?: string | null): string {
  const raw = (candidate || '').trim();
  if (raw) {
    try {
      const parsed = new URL(raw);
      if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
        return parsed.origin;
      }
    } catch {
      // fallback below
    }
  }
  return DEFAULT_PUBLIC_STORE_ORIGIN;
}

function sanitizeSlugSegment(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Generates the direct public storefront product page URL (/product/:slug).
 * Never returns an admin URL, Firebase/Firestore URL, API URL, or bare ID.
 */
export function buildPublicProductUrl(
  item: Pick<OrderItem, 'productId' | 'slug' | 'name'>,
  catalogProducts: readonly NotificationProductLike[] = [],
  publicOrigin?: string
): string {
  const origin = resolvePublicStoreOrigin(publicOrigin);
  const catalogMatch = catalogProducts.find((p) => p && p.id === item.productId);

  const candidates = [
    typeof item.slug === 'string' ? item.slug.trim() : '',
    typeof catalogMatch?.slug === 'string' ? catalogMatch.slug.trim() : '',
    typeof item.name === 'string' ? sanitizeSlugSegment(item.name) : '',
    typeof item.productId === 'string' ? item.productId.trim() : '',
  ];

  const resolvedSlug = candidates.find((c) => c.length > 0) || 'product';
  return `${origin}/product/${encodeURIComponent(resolvedSlug)}`;
}

export function formatOrderDateForNotification(isoOrDate?: string): string {
  const raw = (isoOrDate || '').trim();
  if (!raw) {
    return new Date().toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) {
    return raw;
  }
  return parsed.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatDeliveryAddressLine(order: Partial<Order>): string {
  const addr = typeof order.address === 'string' ? order.address.trim() : '';
  const area = typeof order.area === 'string' ? order.area.trim() : '';
  if (!addr && !area) return 'N/A';
  if (!area || addr.toLowerCase().includes(area.toLowerCase())) {
    return addr || area;
  }
  return `${addr}, ${area}`;
}

function formatTransactionIdField(order: Partial<Order>): string {
  const method = typeof order.paymentMethod === 'string' ? order.paymentMethod.trim() : '';
  const ref =
    typeof order.paymentReference === 'string' ? order.paymentReference.trim() : '';
  const sender =
    typeof order.paymentSenderNumber === 'string' ? order.paymentSenderNumber.trim() : '';

  if (method === 'Cash on Delivery') {
    return ref || 'N/A';
  }
  if (!ref) {
    return 'N/A';
  }
  return sender ? `${ref} (Sender: ${sender})` : ref;
}

export function buildAdminOrderNotification(
  order: Pick<
    Order,
    | 'id'
    | 'orderNumber'
    | 'createdAt'
    | 'status'
    | 'customerName'
    | 'customerEmail'
    | 'customerPhone'
    | 'address'
    | 'area'
    | 'city'
    | 'postalCode'
    | 'deliveryNote'
    | 'paymentMethod'
    | 'paymentReference'
    | 'paymentSenderNumber'
    | 'paymentStatus'
    | 'items'
    | 'subtotal'
    | 'shipping'
    | 'discount'
    | 'total'
  >,
  options?: {
    products?: readonly NotificationProductLike[];
    publicOrigin?: string;
    additionalInformation?: string;
    storeName?: string;
    adminEmail?: string;
  }
): BuiltAdminOrderNotification {
  const catalogProducts = options?.products || [];
  const origin = resolvePublicStoreOrigin(options?.publicOrigin);
  const storeName = strOrNA(options?.storeName || DEFAULT_STORE_NAME);
  const adminEmail = (options?.adminEmail || ADMIN_NOTIFICATION_EMAIL).trim();
  const rawItems = Array.isArray(order.items) ? order.items : [];

  const productEntries: NotificationProductEntry[] = rawItems.map((item) => {
    const qty = Math.max(1, Math.floor(Number(item.quantity) || 1));
    const unitPrice = Math.max(0, Math.round(Number(item.price) || 0));
    return {
      product_name: strOrNA(item.name),
      product_link: buildPublicProductUrl(item, catalogProducts, origin),
      size: strOrNA(item.size),
      color: strOrNA(item.color),
      quantity: String(qty),
      price: String(unitPrice),
    };
  });

  const orderId = strOrNA(order.orderNumber || order.id);
  const orderDate = formatOrderDateForNotification(order.createdAt);
  const orderStatus = strOrNA(order.status);

  const customerName = strOrNA(order.customerName);
  const customerEmail = strOrNA(order.customerEmail);
  const customerPhone = strOrNA(order.customerPhone);

  const fullAddress = formatDeliveryAddressLine(order);
  const city = strOrNA(order.city);
  const rawPostal = typeof order.postalCode === 'string' ? order.postalCode.trim() : '';
  const postalCode = rawPostal && rawPostal !== '0000' ? rawPostal : 'N/A';
  const deliveryNote = strOrNA(order.deliveryNote);

  const paymentMethod = strOrNA(order.paymentMethod);
  const transactionId = formatTransactionIdField(order);
  const paymentStatus = strOrNA(order.paymentStatus);

  const subtotal = String(Math.max(0, Math.round(Number(order.subtotal) || 0)));
  const deliveryCharge = String(Math.max(0, Math.round(Number(order.shipping) || 0)));
  const discount = String(Math.max(0, Math.round(Number(order.discount) || 0)));
  const totalAmount = String(Math.max(0, Math.round(Number(order.total) || 0)));

  const additionalInfo = strOrNA(options?.additionalInformation);

  let productNameField = 'N/A';
  let productLinkField = 'N/A';
  let sizeField = 'N/A';
  let colorField = 'N/A';
  let quantityField = '0';
  let priceField = '0';
  let productsBlockText = '';

  if (productEntries.length === 1) {
    const single = productEntries[0];
    productNameField = single.product_name;
    productLinkField = single.product_link;
    sizeField = single.size;
    colorField = single.color;
    quantityField = single.quantity;
    priceField = single.price;
    productsBlockText = [
      `Product Name: ${single.product_name}`,
      '',
      `Product Link: ${single.product_link}`,
      '',
      `Selected Size: ${single.size}`,
      '',
      `Selected Color: ${single.color}`,
      '',
      `Quantity: ${single.quantity}`,
      '',
      `Unit Price: ৳${single.price}`,
    ].join('\n');
  } else if (productEntries.length > 1) {
    productNameField = productEntries
      .map((entry, idx) => `${idx + 1}. ${entry.product_name}`)
      .join(' | ');
    productLinkField = productEntries
      .map((entry, idx) => `${idx + 1}. ${entry.product_link}`)
      .join('\n');
    sizeField = productEntries
      .map((entry, idx) => `${idx + 1}. ${entry.size}`)
      .join(' | ');
    colorField = productEntries
      .map((entry, idx) => `${idx + 1}. ${entry.color}`)
      .join(' | ');
    quantityField = productEntries
      .map((entry, idx) => `${idx + 1}. ${entry.quantity}`)
      .join(' | ');
    priceField = productEntries
      .map((entry, idx) =>
        idx === 0 ? `${entry.price} (#1)` : `৳${entry.price} (#${idx + 1})`
      )
      .join(', ');
    productsBlockText = productEntries
      .map((entry, idx) =>
        [
          `Item ${idx + 1}:`,
          `Product Name: ${entry.product_name}`,
          `Product Link: ${entry.product_link}`,
          `Selected Size: ${entry.size}`,
          `Selected Color: ${entry.color}`,
          `Quantity: ${entry.quantity}`,
          `Unit Price: ৳${entry.price}`,
        ].join('\n')
      )
      .join('\n\n');
  } else {
    productsBlockText = [
      'Product Name: N/A',
      '',
      'Product Link: N/A',
      '',
      'Selected Size: N/A',
      '',
      'Selected Color: N/A',
      '',
      'Quantity: 0',
      '',
      'Unit Price: ৳0',
    ].join('\n');
  }

  const messageText = [
    '🛍️ NEW ORDER RECEIVED',
    '',
    'Hello Admin,',
    '',
    'A new order has been successfully placed on your website.',
    '',
    '━━━━━━━━━━━━━━━━━━━━',
    '📦 ORDER INFORMATION',
    '━━━━━━━━━━━━━━━━━━━━',
    '',
    `Order ID: ${orderId}`,
    '',
    `Order Date: ${orderDate}`,
    '',
    `Order Status: ${orderStatus}`,
    '',
    '━━━━━━━━━━━━━━━━━━━━',
    '👤 CUSTOMER INFORMATION',
    '━━━━━━━━━━━━━━━━━━━━',
    '',
    `Customer Name: ${customerName}`,
    '',
    `Email Address: ${customerEmail}`,
    '',
    `Phone Number: ${customerPhone}`,
    '',
    '━━━━━━━━━━━━━━━━━━━━',
    '📍 DELIVERY INFORMATION',
    '━━━━━━━━━━━━━━━━━━━━',
    '',
    `Full Address: ${fullAddress}`,
    '',
    `City: ${city}`,
    '',
    `Postal Code: ${postalCode}`,
    '',
    `Delivery Note: ${deliveryNote}`,
    '',
    '━━━━━━━━━━━━━━━━━━━━',
    '🛍️ PRODUCT INFORMATION',
    '━━━━━━━━━━━━━━━━━━━━',
    '',
    productsBlockText,
    '',
    '━━━━━━━━━━━━━━━━━━━━',
    '💳 PAYMENT INFORMATION',
    '━━━━━━━━━━━━━━━━━━━━',
    '',
    `Payment Method: ${paymentMethod}`,
    '',
    `Transaction ID: ${transactionId}`,
    '',
    `Payment Status: ${paymentStatus}`,
    '',
    '━━━━━━━━━━━━━━━━━━━━',
    '💰 ORDER SUMMARY',
    '━━━━━━━━━━━━━━━━━━━━',
    '',
    `Subtotal: ৳${subtotal}`,
    '',
    `Delivery Charge: ৳${deliveryCharge}`,
    '',
    `Discount: ৳${discount}`,
    '',
    `Total Amount: ৳${totalAmount}`,
    '',
    '━━━━━━━━━━━━━━━━━━━━',
    '📝 ADDITIONAL INFORMATION',
    '━━━━━━━━━━━━━━━━━━━━',
    '',
    additionalInfo,
    '',
    '━━━━━━━━━━━━━━━━━━━━',
    '',
    'Please review this order and process it as soon as possible.',
    '',
    'Best Regards,',
    storeName,
  ].join('\n');

  return {
    orderId: order.id,
    orderNumber: orderId,
    productEntries,
    messageText,
    templateParams: {
      to_email: adminEmail,
      order_id: orderId,
      order_date: orderDate,
      order_status: orderStatus,
      customer_name: customerName,
      customer_email: customerEmail,
      customer_phone: customerPhone,
      delivery_address: fullAddress,
      city,
      postal_code: postalCode,
      delivery_note: deliveryNote,
      product_name: productNameField,
      product_link: productLinkField,
      size: sizeField,
      color: colorField,
      quantity: quantityField,
      price: priceField,
      products_list: productsBlockText,
      payment_method: paymentMethod,
      transaction_id: transactionId,
      payment_status: paymentStatus,
      subtotal,
      delivery_charge: deliveryCharge,
      discount,
      total_amount: totalAmount,
      additional_information: additionalInfo,
      store_name: storeName,
      message: messageText,
    },
  };
}
