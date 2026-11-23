import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import emailjs from '@emailjs/browser';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Check,
  Clock,
  Loader2,
  Lock,
  MapPin,
  Minus,
  PackageCheck,
  Pencil,
  Plus,
  ShoppingBag,
  Smartphone,
} from 'lucide-react';
import { useStore } from '../context/StoreContext';
import {
  formatBDT,
  isDhakaCity,
  validateBangladeshPhone,
} from '../lib/formatters';
import { DeliveryMethod, OrderItem, PaymentMethod } from '../types/ecommerce';
import {
  DhakaAddressAutocomplete,
  SelectedAddressResult,
} from '../components/DhakaAddressAutocomplete';
import { CustomerDeliveryMap } from '../components/BoutiqueLocatorMap';
import { BrandLogo } from '../components/BrandLogo';
import { SeoHead } from '../components/SeoHead';
import { SuccessCheckmark } from '../components/Motion';
import {
  CheckoutStepMeta,
  CheckoutStepper,
} from '../components/CheckoutStepper';
import { trackPixelEvent } from '../lib/metaPixel';

const EMAILJS_SERVICE_ID = 'service_jlw1nj9';
const EMAILJS_TEMPLATE_ID = 'template_ytbv3oj';
const EMAILJS_PUBLIC_KEY = 'mq7QXXen_i72fccjy';
const CHECKOUT_DRAFT_KEY = 'pythox_checkout_draft_v1';

const BD_DISTRICTS = [
  'Dhaka',
  'Savar (Dhaka)',
  'Chattogram',
  'Sylhet',
  'Rajshahi',
  'Khulna',
  'Barishal',
  'Rangpur',
  'Mymensingh',
  'Gazipur',
  'Narayanganj',
];

const CHECKOUT_STEPS: CheckoutStepMeta[] = [
  {
    number: 1,
    shortTitle: 'Customer',
    title: 'Customer Information',
    subtitle: 'Enter your contact details for delivery updates.',
  },
  {
    number: 2,
    shortTitle: 'Delivery',
    title: 'Delivery Information',
    subtitle: 'Provide your delivery address and preferred courier speed.',
  },
  {
    number: 3,
    shortTitle: 'Product',
    title: 'Product Information',
    subtitle: 'Confirm your selected items, sizes, colors, and quantities.',
  },
  {
    number: 4,
    shortTitle: 'Payment',
    title: 'Payment Information',
    subtitle: 'Choose Cash on Delivery or complete mobile payment.',
  },
  {
    number: 5,
    shortTitle: 'Confirm',
    title: 'Order Summary & Confirmation',
    subtitle: 'Review all details and place your order.',
  },
];

function sanitizeInput(value: string, maxLen = 400): string {
  return value
    .replace(/[<>]/g, '')
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .trim()
    .slice(0, maxLen);
}

function isValidEmailAddress(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim());
}

function isValidPhoneNumber(phone: string): boolean {
  const digits = phone.replace(/\D/g, '');
  if (validateBangladeshPhone(phone)) return true;
  if (digits.startsWith('01')) return /^01[3-9]\d{8}$/.test(digits);
  return digits.length >= 10 && digits.length <= 15;
}

interface FieldErrors {
  customer_name?: string;
  customer_email?: string;
  customer_phone?: string;
  delivery_address?: string;
  city?: string;
  area?: string;
  postal_code?: string;
  quantity?: string;
  transaction_id?: string;
  payment_sender_number?: string;
}

interface CheckoutDraft {
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  deliveryAddress?: string;
  city?: string;
  area?: string;
  postalCode?: string;
  deliveryNote?: string;
  deliveryMethod?: DeliveryMethod;
  deliveryLocation?: { lat: number; lng: number; label: string } | null;
  selectedProductId?: string;
  selectedSize?: string;
  selectedColor?: string;
  directQuantity?: number;
  paymentMethod?: PaymentMethod;
  transactionId?: string;
  paymentSenderNumber?: string;
  additionalInformation?: string;
}

function readCheckoutDraft(): CheckoutDraft {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.sessionStorage.getItem(CHECKOUT_DRAFT_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? (parsed as CheckoutDraft) : {};
  } catch {
    return {};
  }
}

interface ConfirmedOrderView {
  order_id: string;
  order_date: string;
  order_status: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  delivery_address: string;
  area: string;
  city: string;
  postal_code: string;
  delivery_method: DeliveryMethod;
  delivery_note: string;
  expected_delivery: string;
  items: OrderItem[];
  payment_method: PaymentMethod;
  transaction_id?: string;
  sender_phone?: string;
  subtotal: number;
  delivery_charge: number;
  discount: number;
  total_amount: number;
}

const stepVariants = {
  enter: (direction: number) => ({
    opacity: 0,
    x: direction >= 0 ? 16 : -16,
  }),
  center: {
    opacity: 1,
    x: 0,
  },
  exit: (direction: number) => ({
    opacity: 0,
    x: direction >= 0 ? -16 : 16,
  }),
};

export const CheckoutPage: React.FC = () => {
  const {
    products,
    productsLoading,
    productsError,
    refreshProducts,
    cart,
    settings,
    appliedCoupon,
    mapsApiKey,
    placeOrder,
    updateCartQuantity,
    applyCouponCode,
    removeCoupon,
    showToast,
  } = useStore();

  const [searchParams, setSearchParams] = useSearchParams();
  const initialDraft = useMemo(() => readCheckoutDraft(), []);

  const defaultProduct = useMemo(
    () => products.find((p) => p.inventory > 0) || products[0],
    [products]
  );

  // Initialize EmailJS Browser SDK
  useEffect(() => {
    emailjs.init({
      publicKey: EMAILJS_PUBLIC_KEY,
    });
  }, []);

  // 1. Customer Information (Email is optional for direct checkout)
  const [customerName, setCustomerName] = useState(
    initialDraft.customerName ?? ''
  );
  const [customerEmail, setCustomerEmail] = useState(
    initialDraft.customerEmail ?? ''
  );
  const [customerPhone, setCustomerPhone] = useState(
    initialDraft.customerPhone ?? ''
  );

  // 2. Delivery Information
  const [deliveryAddress, setDeliveryAddress] = useState(
    initialDraft.deliveryAddress ?? ''
  );
  const [city, setCity] = useState(initialDraft.city ?? 'Dhaka');
  const [area, setArea] = useState(initialDraft.area ?? '');
  const [postalCode, setPostalCode] = useState(initialDraft.postalCode ?? '');
  const [deliveryNote, setDeliveryNote] = useState(
    initialDraft.deliveryNote ?? ''
  );
  const [deliveryLocation, setDeliveryLocation] = useState<{
    lat: number;
    lng: number;
    label: string;
  } | null>(initialDraft.deliveryLocation ?? null);
  const [deliveryMethod, setDeliveryMethod] = useState<DeliveryMethod>(
    initialDraft.deliveryMethod ?? 'Standard Delivery'
  );

  // 3. Product Information (synced cleanly with cart when present, or direct selection)
  const [selectedProductId, setSelectedProductId] = useState<string>(
    cart[0]?.productId ||
      initialDraft.selectedProductId ||
      defaultProduct?.id ||
      ''
  );
  const [selectedSize, setSelectedSize] = useState<string>(
    cart[0]?.size ||
      initialDraft.selectedSize ||
      defaultProduct?.sizes[0] ||
      ''
  );
  const [selectedColor, setSelectedColor] = useState<string>(
    cart[0]?.color ||
      initialDraft.selectedColor ||
      defaultProduct?.colors[0]?.name ||
      ''
  );
  const [directQuantity, setDirectQuantity] = useState<number>(
    cart[0]?.quantity || initialDraft.directQuantity || 1
  );

  // 4. Payment Information
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(
    initialDraft.paymentMethod ?? 'Cash on Delivery'
  );
  const [transactionId, setTransactionId] = useState(
    initialDraft.transactionId ?? ''
  );
  const [paymentSenderNumber, setPaymentSenderNumber] = useState(
    initialDraft.paymentSenderNumber ?? ''
  );
  const paymentStatus = 'Pending';

  // 5. Additional Info & Promo
  const [additionalInformation, setAdditionalInformation] = useState(
    initialDraft.additionalInformation ?? ''
  );
  const [promoCodeInput, setPromoCodeInput] = useState('');
  const [promoStatus, setPromoStatus] = useState<{
    ok: boolean;
    message: string;
  } | null>(null);

  // Multi-Step Navigation & Confirmation State
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [maxReachedStep, setMaxReachedStep] = useState<number>(1);
  const [stepDirection, setStepDirection] = useState<number>(1);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [submitError, setSubmitError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [confirmedOrder, setConfirmedOrder] =
    useState<ConfirmedOrderView | null>(null);

  const usingCart = cart.length > 0;
  const activeDirectProduct = useMemo(
    () => products.find((p) => p.id === selectedProductId) || defaultProduct,
    [products, selectedProductId, defaultProduct]
  );

  useEffect(() => {
    if (!usingCart && activeDirectProduct) {
      if (
        !selectedProductId ||
        !products.some((p) => p.id === selectedProductId)
      ) {
        setSelectedProductId(activeDirectProduct.id);
      }
      if (
        activeDirectProduct.sizes.length > 0 &&
        !activeDirectProduct.sizes.includes(selectedSize)
      ) {
        setSelectedSize(activeDirectProduct.sizes[0]);
      }
      if (
        activeDirectProduct.colors.length > 0 &&
        !activeDirectProduct.colors.some((c) => c.name === selectedColor)
      ) {
        setSelectedColor(activeDirectProduct.colors[0].name);
      }
    }
  }, [
    usingCart,
    products,
    activeDirectProduct,
    selectedProductId,
    selectedSize,
    selectedColor,
  ]);

  // Persist in-progress checkout draft to sessionStorage so no input is lost
  useEffect(() => {
    if (confirmedOrder || typeof window === 'undefined') return;
    try {
      const draft: CheckoutDraft = {
        customerName,
        customerEmail,
        customerPhone,
        deliveryAddress,
        city,
        area,
        postalCode,
        deliveryNote,
        deliveryMethod,
        deliveryLocation,
        selectedProductId,
        selectedSize,
        selectedColor,
        directQuantity,
        paymentMethod,
        transactionId,
        paymentSenderNumber,
        additionalInformation,
      };
      window.sessionStorage.setItem(CHECKOUT_DRAFT_KEY, JSON.stringify(draft));
    } catch {
      // ignore storage failures
    }
  }, [
    confirmedOrder,
    customerName,
    customerEmail,
    customerPhone,
    deliveryAddress,
    city,
    area,
    postalCode,
    deliveryNote,
    deliveryMethod,
    deliveryLocation,
    selectedProductId,
    selectedSize,
    selectedColor,
    directQuantity,
    paymentMethod,
    transactionId,
    paymentSenderNumber,
    additionalInformation,
  ]);

  const resolvedProductInfo = useMemo(() => {
    if (usingCart) {
      if (cart.length === 1) {
        const item = cart[0];
        const catalogMatch = products.find((p) => p.id === item.productId);
        const unitPrice = catalogMatch ? catalogMatch.price : item.price;
        return {
          product_name: item.name,
          product_id: item.sku || item.productId,
          size: item.size,
          color: item.color,
          quantity: item.quantity,
          price: unitPrice,
          subtotal: unitPrice * item.quantity,
          cartItemId: item.id,
          availableSizes: catalogMatch?.sizes || [item.size],
          availableColors:
            catalogMatch?.colors.map((c) => c.name) || [item.color],
          maxStock: catalogMatch?.inventory ?? 99,
        };
      }

      const aggregatedQty = cart.reduce((s, i) => s + i.quantity, 0);
      const authoritativeSubtotal = cart.reduce((sum, i) => {
        const catalogMatch = products.find((p) => p.id === i.productId);
        const unitPrice = catalogMatch ? catalogMatch.price : i.price;
        return sum + unitPrice * i.quantity;
      }, 0);

      return {
        product_name: cart
          .map((i) => `${i.name} (${i.size}/${i.color} ×${i.quantity})`)
          .join(', '),
        product_id: cart.map((i) => i.sku || i.productId).join(', '),
        size: Array.from(new Set(cart.map((i) => i.size))).join(', '),
        color: Array.from(new Set(cart.map((i) => i.color))).join(', '),
        quantity: aggregatedQty,
        price:
          aggregatedQty > 0
            ? Math.round(authoritativeSubtotal / aggregatedQty)
            : 0,
        subtotal: authoritativeSubtotal,
        cartItemId: null,
        availableSizes: [],
        availableColors: [],
        maxStock: 99,
      };
    }

    const p = activeDirectProduct;
    const unitPrice = p ? p.price : 0;
    const safeQty = Math.max(1, Math.floor(directQuantity || 1));
    return {
      product_name: p?.name || '',
      product_id: p?.sku || p?.id || '',
      size: selectedSize,
      color: selectedColor,
      quantity: safeQty,
      price: unitPrice,
      subtotal: unitPrice * safeQty,
      cartItemId: null,
      availableSizes: p?.sizes || ['S', 'M', 'L', 'XL'],
      availableColors: p?.colors.map((c) => c.name) || ['Jet Black'],
      maxStock: p?.inventory ?? 99,
    };
  }, [
    usingCart,
    cart,
    products,
    activeDirectProduct,
    directQuantity,
    selectedSize,
    selectedColor,
  ]);

  const subtotal = resolvedProductInfo.subtotal;
  const inDhaka = isDhakaCity(city);
  const baseShipping = inDhaka
    ? settings.insideDhakaCharge
    : settings.outsideDhakaCharge;
  const freeEligible = subtotal >= settings.freeShippingThreshold && subtotal > 0;

  const deliveryCharge =
    subtotal === 0
      ? 0
      : deliveryMethod === 'Express Delivery'
      ? (freeEligible ? 0 : baseShipping) + settings.expressSurcharge
      : freeEligible
      ? 0
      : baseShipping;

  const discount = appliedCoupon
    ? subtotal >= appliedCoupon.minOrder
      ? appliedCoupon.discountType === 'percentage'
        ? Math.round((subtotal * appliedCoupon.value) / 100)
        : Math.min(subtotal, appliedCoupon.value)
      : 0
    : 0;

  const totalAmount = Math.max(0, subtotal + deliveryCharge - discount);

  const hasTrackedInitiateCheckoutRef = useRef(false);

  useEffect(() => {
    if (hasTrackedInitiateCheckoutRef.current || confirmedOrder || subtotal <= 0) {
      return;
    }

    const checkoutItems = usingCart
      ? cart.map((c) => {
          const catalogMatch = products.find((p) => p.id === c.productId);
          return {
            id: c.productId,
            quantity: c.quantity,
            item_price: catalogMatch ? catalogMatch.price : c.price,
            category: catalogMatch?.category || '',
          };
        })
      : activeDirectProduct
      ? [
          {
            id: activeDirectProduct.id,
            quantity: resolvedProductInfo.quantity,
            item_price: activeDirectProduct.price,
            category: activeDirectProduct.category || '',
          },
        ]
      : [];

    if (checkoutItems.length === 0) return;

    hasTrackedInitiateCheckoutRef.current = true;
    const checkoutCategories = Array.from(
      new Set(checkoutItems.map((i) => i.category).filter(Boolean))
    );

    trackPixelEvent('InitiateCheckout', {
      content_ids: Array.from(new Set(checkoutItems.map((i) => i.id))),
      ...(checkoutCategories.length > 0
        ? { content_category: checkoutCategories.join(', ') }
        : {}),
      content_type: 'product',
      contents: checkoutItems.map((i) => ({
        id: i.id,
        quantity: i.quantity,
        item_price: i.item_price,
      })),
      num_items: checkoutItems.reduce((sum, i) => sum + i.quantity, 0),
      value: subtotal,
      currency: 'BDT',
    });
  }, [
    subtotal,
    confirmedOrder,
    usingCart,
    cart,
    products,
    activeDirectProduct,
    resolvedProductInfo.quantity,
  ]);

  const validateStep = useCallback(
    (stepNum: number): FieldErrors => {
      const errs: FieldErrors = {};

      if (stepNum === 1) {
        if (sanitizeInput(customerName, 120).length < 2) {
          errs.customer_name =
            'Please enter your full name (at least 2 characters).';
        }
        if (
          customerEmail.trim().length > 0 &&
          !isValidEmailAddress(customerEmail)
        ) {
          errs.customer_email =
            'Please enter a valid email address or leave it blank.';
        }
        if (!isValidPhoneNumber(customerPhone)) {
          errs.customer_phone =
            'Please enter a valid mobile number (e.g., 017XXXXXXXX or +88017XXXXXXXX).';
        }
      }

      if (stepNum === 2) {
        if (sanitizeInput(deliveryAddress, 300).length < 5) {
          errs.delivery_address =
            'Please provide your full street/house delivery address.';
        }
        if (sanitizeInput(city, 80).length < 2) {
          errs.city = 'Please enter or select your district / city.';
        }
        if (sanitizeInput(area, 80).length < 2) {
          errs.area =
            'Please enter your area / upazila (e.g., Dhanmondi, Savar).';
        }
        if (
          postalCode.trim().length > 0 &&
          sanitizeInput(postalCode, 20).length < 3
        ) {
          errs.postal_code =
            'Postal code must be at least 3 characters if provided.';
        }
      }

      if (stepNum === 3) {
        if (
          !Number.isFinite(resolvedProductInfo.quantity) ||
          resolvedProductInfo.quantity < 1 ||
          resolvedProductInfo.quantity > 99
        ) {
          errs.quantity = 'Quantity must be between 1 and 99.';
        }
        if (!resolvedProductInfo.product_name || !resolvedProductInfo.product_id) {
          errs.quantity = 'Please select a valid product.';
        }
      }

      if (stepNum === 4) {
        if (paymentMethod === 'bKash' || paymentMethod === 'Nagad') {
          if (sanitizeInput(transactionId, 80).length < 4) {
            errs.transaction_id = `Please enter your ${paymentMethod} Transaction ID (TrxID, min 4 characters).`;
          }
          if (!isValidPhoneNumber(paymentSenderNumber)) {
            errs.payment_sender_number = `Please enter the ${paymentMethod} sender mobile number (e.g., 017XXXXXXXX).`;
          }
        }
      }

      return errs;
    },
    [
      customerName,
      customerEmail,
      customerPhone,
      deliveryAddress,
      city,
      area,
      postalCode,
      resolvedProductInfo.quantity,
      resolvedProductInfo.product_name,
      resolvedProductInfo.product_id,
      paymentMethod,
      transactionId,
      paymentSenderNumber,
    ]
  );

  const validateForm = useCallback((): {
    errors: FieldErrors;
    firstInvalidStep: number | null;
  } => {
    const step1 = validateStep(1);
    const step2 = validateStep(2);
    const step3 = validateStep(3);
    const step4 = validateStep(4);

    const errors: FieldErrors = {
      ...step1,
      ...step2,
      ...step3,
      ...step4,
    };

    const firstInvalidStep =
      Object.keys(step1).length > 0
        ? 1
        : Object.keys(step2).length > 0
        ? 2
        : Object.keys(step3).length > 0
        ? 3
        : Object.keys(step4).length > 0
        ? 4
        : null;

    return { errors, firstInvalidStep };
  }, [validateStep]);

  // Sync step with ?step=1..5 so browser Back/Forward works seamlessly without reloading
  useEffect(() => {
    if (confirmedOrder) return;
    const rawParam = searchParams.get('step');
    const parsed = rawParam ? Number.parseInt(rawParam, 10) : 1;
    if (!Number.isFinite(parsed) || parsed < 1 || parsed > 5) {
      setSearchParams({ step: '1' }, { replace: true });
      return;
    }

    if (parsed === currentStep) return;

    // Prevent skipping ahead over incomplete required steps via manual URL edits
    if (parsed > maxReachedStep) {
      let highestValid = 1;
      for (let s = 1; s < parsed; s++) {
        if (Object.keys(validateStep(s)).length === 0) {
          highestValid = s + 1;
        } else {
          break;
        }
      }
      const allowed = Math.min(parsed, highestValid);
      if (allowed !== parsed) {
        setStepDirection(allowed >= currentStep ? 1 : -1);
        setCurrentStep(allowed);
        setMaxReachedStep((prev) => Math.max(prev, allowed));
        setSearchParams({ step: String(allowed) }, { replace: true });
        return;
      }
    }

    setStepDirection(parsed >= currentStep ? 1 : -1);
    setCurrentStep(parsed);
  }, [
    searchParams,
    currentStep,
    maxReachedStep,
    confirmedOrder,
    setSearchParams,
    validateStep,
  ]);

  const navigateToStep = useCallback(
    (targetStep: number) => {
      const clamped = Math.min(5, Math.max(1, targetStep));
      setStepDirection(clamped >= currentStep ? 1 : -1);
      setCurrentStep(clamped);
      setMaxReachedStep((prev) => Math.max(prev, clamped));
      setSubmitError('');
      setSearchParams({ step: String(clamped) });
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },
    [currentStep, setSearchParams]
  );

  const handleStepSelect = useCallback(
    (targetStep: number) => {
      const clamped = Math.min(5, Math.max(1, targetStep));
      if (clamped === currentStep) return;

      if (clamped < currentStep) {
        navigateToStep(clamped);
        return;
      }

      for (let s = currentStep; s < clamped; s++) {
        const errs = validateStep(s);
        if (Object.keys(errs).length > 0) {
          if (s !== currentStep) {
            navigateToStep(s);
          }
          setFieldErrors((prev) => ({ ...prev, ...errs }));
          setSubmitError(
            'Please review and complete the highlighted required fields.'
          );
          return;
        }
      }

      navigateToStep(clamped);
    },
    [currentStep, navigateToStep, validateStep]
  );

  const handleNextStep = () => {
    const errs = validateStep(currentStep);
    setFieldErrors((prev) => {
      const next = { ...prev };
      // Clear previous errors belonging to current step before setting fresh ones
      if (currentStep === 1) {
        delete next.customer_name;
        delete next.customer_phone;
        delete next.customer_email;
      } else if (currentStep === 2) {
        delete next.delivery_address;
        delete next.city;
        delete next.area;
        delete next.postal_code;
      } else if (currentStep === 3) {
        delete next.quantity;
      } else if (currentStep === 4) {
        delete next.transaction_id;
        delete next.payment_sender_number;
      }
      return { ...next, ...errs };
    });

    if (Object.keys(errs).length > 0) {
      setSubmitError('Please review and complete the highlighted required fields.');
      return;
    }

    setSubmitError('');
    if (currentStep < 5) {
      navigateToStep(currentStep + 1);
    }
  };

  const handlePrevStep = () => {
    if (currentStep <= 1) return;
    setSubmitError('');
    navigateToStep(currentStep - 1);
  };

  const handleAddressAutocomplete = (res: SelectedAddressResult) => {
    setDeliveryAddress(res.formattedAddress);
    if (res.city) setCity(res.city);
    if (res.area) setArea(res.area);
    if (res.postalCode) setPostalCode(res.postalCode);
    if (res.location) {
      setDeliveryLocation({
        lat: res.location.lat,
        lng: res.location.lng,
        label: res.formattedAddress,
      });
    }
  };

  const handleApplyPromo = async () => {
    if (!promoCodeInput.trim()) return;
    const res = await applyCouponCode(promoCodeInput, subtotal);
    setPromoStatus(res);
    if (res.ok) setPromoCodeInput('');
  };

  const handlePaymentMethodChange = (method: PaymentMethod) => {
    setPaymentMethod(method);
    if (method === 'Cash on Delivery') {
      setTransactionId('');
      setPaymentSenderNumber('');
      setFieldErrors((p) => ({
        ...p,
        transaction_id: undefined,
        payment_sender_number: undefined,
      }));
    }
  };

  const resetFormFields = () => {
    setDeliveryNote('');
    setTransactionId('');
    setPaymentSenderNumber('');
    setAdditionalInformation('');
    setFieldErrors({});
    setSubmitError('');
    try {
      if (typeof window !== 'undefined') {
        window.sessionStorage.removeItem(CHECKOUT_DRAFT_KEY);
      }
    } catch {
      // ignore storage failure
    }
  };

  const handleConfirmOrder = async () => {
    if (isSubmitting) return;

    setSubmitError('');
    const { errors, firstInvalidStep } = validateForm();
    setFieldErrors(errors);

    if (Object.keys(errors).length > 0) {
      setSubmitError(
        firstInvalidStep && firstInvalidStep !== currentStep
          ? `Please complete required details in Step ${firstInvalidStep} before placing your order.`
          : 'Please review and correct the highlighted required fields.'
      );
      if (firstInvalidStep && firstInvalidStep !== currentStep) {
        navigateToStep(firstInvalidStep);
        setFieldErrors(errors);
        setSubmitError(
          'Please review and correct the highlighted required fields.'
        );
      }
      return;
    }

    const orderItems: OrderItem[] = usingCart
      ? cart.map((c) => {
          const cat = products.find((p) => p.id === c.productId);
          return {
            productId: c.productId,
            sku: c.sku,
            name: c.name,
            slug: c.slug,
            image: c.image,
            color: c.color,
            size: c.size,
            quantity: c.quantity,
            price: cat ? cat.price : c.price,
          };
        })
      : activeDirectProduct
      ? [
          {
            productId: activeDirectProduct.id,
            sku: activeDirectProduct.sku,
            name: activeDirectProduct.name,
            slug: activeDirectProduct.slug,
            image: activeDirectProduct.images[0] || '',
            color: resolvedProductInfo.color,
            size: resolvedProductInfo.size,
            quantity: resolvedProductInfo.quantity,
            price: activeDirectProduct.price,
          },
        ]
      : [];

    if (orderItems.length === 0) {
      setSubmitError('Please select at least one product before confirming.');
      return;
    }

    const generatedOrderDate = new Date().toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
    const generatedOrderStatus = 'Pending';

    const cleanCustomerName = sanitizeInput(customerName, 120);
    const cleanCustomerEmail = sanitizeInput(customerEmail, 160);
    const cleanCustomerPhone = sanitizeInput(customerPhone, 20);
    const cleanDeliveryAddress = sanitizeInput(deliveryAddress, 300);
    const cleanCity = sanitizeInput(city, 80);
    const cleanArea = sanitizeInput(area, 80);
    const cleanPostalCode = sanitizeInput(postalCode, 10) || '0000';
    const rawDeliveryNote = sanitizeInput(deliveryNote, 400);
    const cleanDeliveryNote = rawDeliveryNote || 'None';
    const isDigitalPayment =
      paymentMethod === 'bKash' || paymentMethod === 'Nagad';
    const cleanTrxId = isDigitalPayment
      ? sanitizeInput(transactionId, 80)
      : '';
    const cleanSenderPhone = isDigitalPayment
      ? sanitizeInput(paymentSenderNumber, 20)
      : '';
    const cleanAdditionalInfo =
      sanitizeInput(additionalInformation, 500) || 'None';

    const expectedDelivery =
      deliveryMethod === 'Express Delivery'
        ? inDhaka
          ? 'Same-day / Next-morning (Within 24 hrs)'
          : '1–2 business days (Priority Dispatch)'
        : inDhaka
        ? '24–48 hours inside Dhaka & Savar'
        : '3–5 business days nationwide';

    setIsSubmitting(true);
    try {
      const savedOrder = await placeOrder({
        customerName: cleanCustomerName,
        customerEmail: cleanCustomerEmail,
        customerPhone: cleanCustomerPhone,
        address: cleanDeliveryAddress,
        city: cleanCity,
        area: cleanArea,
        postalCode: cleanPostalCode,
        deliveryMethod,
        deliveryNote: rawDeliveryNote || undefined,
        paymentMethod,
        paymentReference: isDigitalPayment ? cleanTrxId : undefined,
        paymentSenderNumber: isDigitalPayment ? cleanSenderPhone : undefined,
        items: orderItems,
        subtotal,
        shipping: deliveryCharge,
        discount,
        couponCode: appliedCoupon?.code,
        total: totalAmount,
      });

      const authoritativeOrderId = savedOrder.orderNumber;
      const authoritativeSubtotal = savedOrder.subtotal;
      const authoritativeShipping = savedOrder.shipping;
      const authoritativeDiscount = savedOrder.discount;
      const authoritativeTotal = savedOrder.total;
      const authoritativeItems = savedOrder.items;

      const templateParams = {
        order_id: authoritativeOrderId,
        order_date: generatedOrderDate,
        order_status: generatedOrderStatus,
        customer_name: cleanCustomerName,
        customer_email: cleanCustomerEmail || 'Not provided',
        customer_phone: cleanCustomerPhone,
        delivery_address: `${cleanDeliveryAddress}, ${cleanArea}`,
        city: cleanCity,
        postal_code: cleanPostalCode,
        delivery_note: cleanDeliveryNote,
        product_name: resolvedProductInfo.product_name,
        product_id: resolvedProductInfo.product_id,
        size: resolvedProductInfo.size,
        color: resolvedProductInfo.color,
        quantity: resolvedProductInfo.quantity,
        price: resolvedProductInfo.price,
        payment_method: paymentMethod,
        transaction_id: isDigitalPayment
          ? `${cleanTrxId} (Sender: ${cleanSenderPhone})`
          : 'N/A (Cash on Delivery)',
        payment_status: paymentStatus,
        subtotal: authoritativeSubtotal,
        delivery_charge: authoritativeShipping,
        discount: authoritativeDiscount,
        total_amount: authoritativeTotal,
        additional_information: cleanAdditionalInfo,
      };

      try {
        await emailjs.send(
          EMAILJS_SERVICE_ID,
          EMAILJS_TEMPLATE_ID,
          templateParams,
          { publicKey: EMAILJS_PUBLIC_KEY }
        );
      } catch (emailErr) {
        console.warn('EmailJS dispatch skipped or deferred:', emailErr);
      }

      setConfirmedOrder({
        order_id: authoritativeOrderId,
        order_date: generatedOrderDate,
        order_status: generatedOrderStatus,
        customer_name: cleanCustomerName,
        customer_email: cleanCustomerEmail,
        customer_phone: cleanCustomerPhone,
        delivery_address: cleanDeliveryAddress,
        area: cleanArea,
        city: cleanCity,
        postal_code: cleanPostalCode,
        delivery_method: deliveryMethod,
        delivery_note: rawDeliveryNote,
        expected_delivery: expectedDelivery,
        items: authoritativeItems,
        payment_method: paymentMethod,
        transaction_id: isDigitalPayment ? cleanTrxId : undefined,
        sender_phone: isDigitalPayment ? cleanSenderPhone : undefined,
        subtotal: authoritativeSubtotal,
        delivery_charge: authoritativeShipping,
        discount: authoritativeDiscount,
        total_amount: authoritativeTotal,
      });
      resetFormFields();
      showToast(`Order ${authoritativeOrderId} confirmed successfully.`);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : 'Unable to complete your order right now.';
      setSubmitError(
        `We could not submit your order (${msg}). Your form details have been preserved—please check your connection and try again.`
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (currentStep < 5) {
      handleNextStep();
    } else {
      void handleConfirmOrder();
    }
  };

  // ANIMATED ORDER CONFIRMATION VIEW
  if (confirmedOrder) {
    const trackUrl = `/track-order?order=${encodeURIComponent(
      confirmedOrder.order_id
    )}&phone=${encodeURIComponent(confirmedOrder.customer_phone)}`;

    return (
      <main className="mx-auto max-w-3xl px-4 sm:px-6 py-6 sm:py-8 lg:py-12 pb-20 sm:pb-16">
        <SeoHead
          title={`Order Confirmed (${confirmedOrder.order_id}) — PYTHOX WORLD`}
          description="Your PYTHOX WORLD order has been confirmed successfully."
        />

        <section className="rounded-3xl border border-[#D9D9D9] bg-white p-6 sm:p-10 space-y-6 shadow-[0_20px_50px_rgba(10,10,10,0.06)] modal-enter">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#D9D9D9] pb-5">
            <BrandLogo className="h-10" />
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-[#0A0A0A]">
                <PackageCheck className="h-3.5 w-3.5" />{' '}
                {confirmedOrder.order_status}
              </span>
            </div>
          </div>

          <div className="flex items-start gap-4">
            <SuccessCheckmark size={52} />
            <div className="space-y-1.5">
              <h1 className="text-2xl sm:text-3xl font-editorial font-semibold text-[#0A0A0A]">
                Order Confirmed Successfully
              </h1>
              <p className="text-sm text-[#292929]">
                Thank you,{' '}
                <span className="font-semibold text-[#0A0A0A]">
                  {confirmedOrder.customer_name}
                </span>
                . Your order has been received.
              </p>
              <div className="flex flex-wrap items-center gap-3 pt-1">
                <p className="font-mono text-sm font-bold text-[#0A0A0A]">
                  Order ID: {confirmedOrder.order_id}
                </p>
                <span className="text-[#D9D9D9]">·</span>
                <span className="inline-flex items-center gap-1.5 text-xs text-[#292929]">
                  <Clock className="h-3.5 w-3.5 text-[#0A0A0A]" />
                  {confirmedOrder.expected_delivery}
                </span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 rounded-2xl border border-[#D9D9D9] bg-[#F3F2EE] p-5 text-xs text-[#292929]">
            <div className="space-y-1">
              <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-[#5C5C5C]">
                Customer &amp; Delivery Info
              </p>
              <p className="font-semibold text-[#0A0A0A]">
                {confirmedOrder.customer_name}
              </p>
              <p className="font-mono">{confirmedOrder.customer_phone}</p>
              {confirmedOrder.customer_email && (
                <p>{confirmedOrder.customer_email}</p>
              )}
              <p className="pt-1">
                {confirmedOrder.delivery_address}, {confirmedOrder.area},{' '}
                {confirmedOrder.city}{' '}
                {confirmedOrder.postal_code !== '0000'
                  ? confirmedOrder.postal_code
                  : ''}
              </p>
              <p className="text-[#5C5C5C]">
                Method: {confirmedOrder.delivery_method}
              </p>
              {confirmedOrder.delivery_note && (
                <p className="text-[#292929] italic pt-0.5">
                  Note: &ldquo;{confirmedOrder.delivery_note}&rdquo;
                </p>
              )}
            </div>

            <div className="space-y-1">
              <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-[#5C5C5C]">
                Payment Summary
              </p>
              <p className="font-medium text-[#0A0A0A]">
                Method: {confirmedOrder.payment_method}
              </p>
              {confirmedOrder.transaction_id && (
                <p className="font-mono text-[#0A0A0A]">
                  TrxID: {confirmedOrder.transaction_id}
                </p>
              )}
              {confirmedOrder.sender_phone && (
                <p className="font-mono text-[#0A0A0A]">
                  Sender: {confirmedOrder.sender_phone}
                </p>
              )}
              <p>Date: {confirmedOrder.order_date}</p>
              <p className="pt-1 font-mono text-sm font-bold text-[#0A0A0A]">
                Total Payable: {formatBDT(confirmedOrder.total_amount)}
              </p>
            </div>
          </div>

          {/* Ordered Items List */}
          <div className="rounded-2xl border border-[#D9D9D9] bg-[#F3F2EE] p-5 space-y-3 text-xs tabular-nums">
            <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-[#5C5C5C]">
              Ordered Items (
              {confirmedOrder.items.reduce((s, i) => s + i.quantity, 0)})
            </p>
            <div className="divide-y divide-[#D9D9D9]">
              {confirmedOrder.items.map((item, idx) => (
                <div
                  key={`${item.productId}-${idx}`}
                  className="py-2.5 flex items-center justify-between gap-3 first:pt-0 last:pb-0"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {item.image && (
                      <img
                        src={item.image}
                        alt={item.name}
                        referrerPolicy="no-referrer"
                        className="h-11 w-9 rounded-lg object-cover border border-[#D9D9D9] shrink-0"
                      />
                    )}
                    <div className="min-w-0">
                      <p className="font-semibold text-[#0A0A0A] truncate">
                        {item.name}
                      </p>
                      <p className="text-[11px] text-[#5C5C5C]">
                        {item.color} · Size {item.size} × {item.quantity}
                      </p>
                    </div>
                  </div>
                  <span className="font-mono font-semibold text-[#0A0A0A] shrink-0">
                    {formatBDT(item.price * item.quantity)}
                  </span>
                </div>
              ))}
            </div>
            <div className="pt-3 border-t border-[#D9D9D9] space-y-1 text-xs text-[#292929]">
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span className="font-mono">
                  {formatBDT(confirmedOrder.subtotal)}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Delivery ({confirmedOrder.delivery_method})</span>
                <span className="font-mono">
                  {confirmedOrder.delivery_charge === 0
                    ? 'Free'
                    : formatBDT(confirmedOrder.delivery_charge)}
                </span>
              </div>
              {confirmedOrder.discount > 0 && (
                <div className="flex justify-between text-[#0A0A0A] font-medium">
                  <span>Discount</span>
                  <span className="font-mono">
                    -{formatBDT(confirmedOrder.discount)}
                  </span>
                </div>
              )}
              <div className="flex justify-between pt-2 border-t border-[#D9D9D9] text-sm font-bold text-[#0A0A0A]">
                <span>Total Amount</span>
                <span className="font-mono">
                  {formatBDT(confirmedOrder.total_amount)}
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-3 pt-2">
            <Link to="/shop" className="btn-base btn-primary btn-lg">
              <span>Back to Shopping</span>
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link to={trackUrl} className="btn-base btn-secondary btn-lg">
              Track Order
            </Link>
          </div>
        </section>
      </main>
    );
  }

  const activeStepMeta = CHECKOUT_STEPS[currentStep - 1] || CHECKOUT_STEPS[0];
  const nextStepMeta =
    currentStep < 5 ? CHECKOUT_STEPS[currentStep] : undefined;

  return (
    <main className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-5 sm:py-8 lg:py-10 pb-20 sm:pb-16">
      <SeoHead
        title={`Checkout · ${activeStepMeta.title} — PYTHOX WORLD`}
        description="Complete your PYTHOX WORLD order with nationwide Bangladesh delivery."
      />

      {/* Minimal Checkout Header */}
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[#D9D9D9] pb-4 sm:pb-5">
        <div className="flex items-center gap-3.5 min-w-0">
          <BrandLogo className="h-9 sm:h-10 shrink-0" />
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-editorial font-semibold text-[#0A0A0A] truncate">
              Checkout
            </h1>
            <p className="mt-0.5 text-[11px] sm:text-xs text-[#5C5C5C] inline-flex items-center gap-1.5">
              <Lock className="h-3 w-3 text-[#0A0A0A] shrink-0" />
              <span>Direct checkout — no account required</span>
            </p>
          </div>
        </div>

        {/* Quiet live total indicator across Steps 1–4 */}
        {currentStep < 5 && resolvedProductInfo.quantity > 0 && (
          <div className="text-right tabular-nums shrink-0">
            <p className="text-[11px] text-[#5C5C5C]">
              {resolvedProductInfo.quantity} item
              {resolvedProductInfo.quantity === 1 ? '' : 's'} · Est. Total
            </p>
            <p className="font-mono text-sm sm:text-base font-bold text-[#0A0A0A]">
              {formatBDT(totalAmount)}
            </p>
          </div>
        )}
      </header>

      {/* 1 — 2 — 3 — 4 — 5 Progress Indicator */}
      <div className="mt-5 sm:mt-6">
        <CheckoutStepper
          steps={CHECKOUT_STEPS}
          currentStep={currentStep}
          maxReachedStep={maxReachedStep}
          onStepSelect={handleStepSelect}
        />
      </div>

      {/* Focused Single-Step Form Container */}
      <form noValidate onSubmit={handleFormSubmit} className="mt-5 sm:mt-6">
        <div className="rounded-2xl sm:rounded-3xl border border-[#D9D9D9] bg-white p-5 sm:p-8 shadow-[0_8px_28px_rgba(10,10,10,0.04)] overflow-hidden">
          <AnimatePresence mode="wait" custom={stepDirection} initial={false}>
            <motion.div
              key={currentStep}
              custom={stepDirection}
              variants={stepVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
              className="space-y-5"
            >
              {/* Step Title Bar */}
              <div className="border-b border-[#D9D9D9] pb-4">
                <p className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-[#5C5C5C]">
                  Step {activeStepMeta.number} of {CHECKOUT_STEPS.length}
                </p>
                <h2 className="mt-1 text-xl sm:text-2xl font-editorial font-semibold text-[#0A0A0A]">
                  {activeStepMeta.number}. {activeStepMeta.title}
                </h2>
                <p className="mt-1 text-xs sm:text-sm text-[#5C5C5C]">
                  {activeStepMeta.subtitle}
                </p>
              </div>

              {/* STEP 1: CUSTOMER INFORMATION */}
              {currentStep === 1 && (
                <section aria-label="Customer Information" className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label
                        htmlFor="customer_name"
                        className="block text-xs font-medium text-[#292929] mb-1.5"
                      >
                        Full Name *
                      </label>
                      <input
                        id="customer_name"
                        name="customer_name"
                        type="text"
                        required
                        autoComplete="name"
                        value={customerName}
                        onChange={(e) => {
                          setCustomerName(e.target.value);
                          if (fieldErrors.customer_name)
                            setFieldErrors((p) => ({
                              ...p,
                              customer_name: undefined,
                            }));
                        }}
                        aria-invalid={Boolean(fieldErrors.customer_name)}
                        placeholder="e.g., Tanvir Hasan"
                        className={`w-full min-h-[46px] rounded-xl border bg-white px-3.5 py-3 text-sm text-[#0A0A0A] placeholder:text-[#808080] focus:outline-none transition-colors ${
                          fieldErrors.customer_name
                            ? 'border-[#0A0A0A] bg-[#F5F5F5]'
                            : 'border-[#D9D9D9] focus:border-[#0A0A0A]'
                        }`}
                      />
                      {fieldErrors.customer_name && (
                        <p className="mt-1 text-[11px] font-medium text-[#0A0A0A]">
                          {fieldErrors.customer_name}
                        </p>
                      )}
                    </div>

                    <div>
                      <label
                        htmlFor="customer_phone"
                        className="block text-xs font-medium text-[#292929] mb-1.5"
                      >
                        Phone Number *
                      </label>
                      <input
                        id="customer_phone"
                        name="customer_phone"
                        type="tel"
                        required
                        autoComplete="tel"
                        value={customerPhone}
                        onChange={(e) => {
                          setCustomerPhone(e.target.value);
                          if (fieldErrors.customer_phone)
                            setFieldErrors((p) => ({
                              ...p,
                              customer_phone: undefined,
                            }));
                        }}
                        aria-invalid={Boolean(fieldErrors.customer_phone)}
                        placeholder="017XXXXXXXX"
                        className={`w-full min-h-[46px] rounded-xl border bg-white px-3.5 py-3 text-sm font-mono text-[#0A0A0A] placeholder:text-[#808080] focus:outline-none transition-colors ${
                          fieldErrors.customer_phone
                            ? 'border-[#0A0A0A] bg-[#F5F5F5]'
                            : 'border-[#D9D9D9] focus:border-[#0A0A0A]'
                        }`}
                      />
                      {fieldErrors.customer_phone && (
                        <p className="mt-1 text-[11px] font-medium text-[#0A0A0A]">
                          {fieldErrors.customer_phone}
                        </p>
                      )}
                    </div>
                  </div>

                  <div>
                    <label
                      htmlFor="customer_email"
                      className="block text-xs font-medium text-[#292929] mb-1.5"
                    >
                      Email Address (Optional)
                    </label>
                    <input
                      id="customer_email"
                      name="customer_email"
                      type="email"
                      autoComplete="email"
                      value={customerEmail}
                      onChange={(e) => {
                        setCustomerEmail(e.target.value);
                        if (fieldErrors.customer_email)
                          setFieldErrors((p) => ({
                            ...p,
                            customer_email: undefined,
                          }));
                      }}
                      aria-invalid={Boolean(fieldErrors.customer_email)}
                      placeholder="name@example.com (optional for receipt)"
                      className={`w-full min-h-[46px] rounded-xl border bg-white px-3.5 py-3 text-sm text-[#0A0A0A] placeholder:text-[#808080] focus:outline-none transition-colors ${
                        fieldErrors.customer_email
                          ? 'border-[#0A0A0A] bg-[#F5F5F5]'
                          : 'border-[#D9D9D9] focus:border-[#0A0A0A]'
                      }`}
                    />
                    {fieldErrors.customer_email && (
                      <p className="mt-1 text-[11px] font-medium text-[#0A0A0A]">
                        {fieldErrors.customer_email}
                      </p>
                    )}
                  </div>
                </section>
              )}

              {/* STEP 2: DELIVERY INFORMATION */}
              {currentStep === 2 && (
                <section aria-label="Delivery Information" className="space-y-4">
                  <div>
                    <label
                      htmlFor="delivery_address"
                      className="block text-xs font-medium text-[#292929] mb-1.5"
                    >
                      Full Delivery Address *
                    </label>
                    {mapsApiKey ? (
                      <DhakaAddressAutocomplete
                        value={deliveryAddress}
                        onChange={(val) => {
                          setDeliveryAddress(val);
                          if (fieldErrors.delivery_address)
                            setFieldErrors((p) => ({
                              ...p,
                              delivery_address: undefined,
                            }));
                        }}
                        onSelectAddress={handleAddressAutocomplete}
                      />
                    ) : (
                      <input
                        id="delivery_address"
                        name="delivery_address"
                        type="text"
                        required
                        autoComplete="street-address"
                        value={deliveryAddress}
                        onChange={(e) => {
                          setDeliveryAddress(e.target.value);
                          if (fieldErrors.delivery_address)
                            setFieldErrors((p) => ({
                              ...p,
                              delivery_address: undefined,
                            }));
                        }}
                        aria-invalid={Boolean(fieldErrors.delivery_address)}
                        placeholder="House, Road, Block, Apartment"
                        className={`w-full min-h-[46px] rounded-xl border bg-white px-3.5 py-3 text-sm text-[#0A0A0A] placeholder:text-[#808080] focus:outline-none transition-colors ${
                          fieldErrors.delivery_address
                            ? 'border-[#0A0A0A] bg-[#F5F5F5]'
                            : 'border-[#D9D9D9] focus:border-[#0A0A0A]'
                        }`}
                      />
                    )}
                    {fieldErrors.delivery_address && (
                      <p className="mt-1 text-[11px] font-medium text-[#0A0A0A]">
                        {fieldErrors.delivery_address}
                      </p>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label
                        htmlFor="city"
                        className="block text-xs font-medium text-[#292929] mb-1.5"
                      >
                        District / City *
                      </label>
                      <div className="space-y-2">
                        <select
                          id="city"
                          name="city"
                          value={BD_DISTRICTS.includes(city) ? city : 'Other'}
                          onChange={(e) => {
                            const v = e.target.value;
                            setCity(v === 'Other' ? '' : v);
                            if (fieldErrors.city)
                              setFieldErrors((p) => ({ ...p, city: undefined }));
                          }}
                          className="w-full min-h-[46px] rounded-xl border border-[#D9D9D9] bg-white px-3.5 py-3 text-sm text-[#0A0A0A] focus:border-[#0A0A0A] focus:outline-none"
                        >
                          {BD_DISTRICTS.map((c) => (
                            <option key={c} value={c}>
                              {c}
                            </option>
                          ))}
                          <option value="Other">Other City</option>
                        </select>
                        {!BD_DISTRICTS.includes(city) && (
                          <input
                            type="text"
                            required
                            value={city}
                            onChange={(e) => {
                              setCity(e.target.value);
                              if (fieldErrors.city)
                                setFieldErrors((p) => ({
                                  ...p,
                                  city: undefined,
                                }));
                            }}
                            placeholder="Enter district / city"
                            className="w-full min-h-[44px] rounded-xl border border-[#D9D9D9] bg-white px-3.5 py-2.5 text-sm text-[#0A0A0A] focus:border-[#0A0A0A] focus:outline-none"
                          />
                        )}
                      </div>
                      {fieldErrors.city && (
                        <p className="mt-1 text-[11px] font-medium text-[#0A0A0A]">
                          {fieldErrors.city}
                        </p>
                      )}
                    </div>

                    <div>
                      <label
                        htmlFor="area"
                        className="block text-xs font-medium text-[#292929] mb-1.5"
                      >
                        Area / Upazila *
                      </label>
                      <input
                        id="area"
                        name="area"
                        type="text"
                        required
                        value={area}
                        onChange={(e) => {
                          setArea(e.target.value);
                          if (fieldErrors.area)
                            setFieldErrors((p) => ({ ...p, area: undefined }));
                        }}
                        aria-invalid={Boolean(fieldErrors.area)}
                        placeholder="e.g., Dhanmondi / Savar"
                        className={`w-full min-h-[46px] rounded-xl border bg-white px-3.5 py-3 text-sm text-[#0A0A0A] placeholder:text-[#808080] focus:outline-none transition-colors ${
                          fieldErrors.area
                            ? 'border-[#0A0A0A] bg-[#F5F5F5]'
                            : 'border-[#D9D9D9] focus:border-[#0A0A0A]'
                        }`}
                      />
                      {fieldErrors.area && (
                        <p className="mt-1 text-[11px] font-medium text-[#0A0A0A]">
                          {fieldErrors.area}
                        </p>
                      )}
                    </div>

                    <div>
                      <label
                        htmlFor="postal_code"
                        className="block text-xs font-medium text-[#292929] mb-1.5"
                      >
                        Postal Code (Optional)
                      </label>
                      <input
                        id="postal_code"
                        name="postal_code"
                        type="text"
                        autoComplete="postal-code"
                        value={postalCode}
                        onChange={(e) => {
                          setPostalCode(e.target.value);
                          if (fieldErrors.postal_code)
                            setFieldErrors((p) => ({
                              ...p,
                              postal_code: undefined,
                            }));
                        }}
                        aria-invalid={Boolean(fieldErrors.postal_code)}
                        placeholder="e.g., 1340"
                        className={`w-full min-h-[46px] rounded-xl border bg-white px-3.5 py-3 text-sm font-mono text-[#0A0A0A] placeholder:text-[#808080] focus:outline-none transition-colors ${
                          fieldErrors.postal_code
                            ? 'border-[#0A0A0A] bg-[#F5F5F5]'
                            : 'border-[#D9D9D9] focus:border-[#0A0A0A]'
                        }`}
                      />
                      {fieldErrors.postal_code && (
                        <p className="mt-1 text-[11px] font-medium text-[#0A0A0A]">
                          {fieldErrors.postal_code}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Shipping Speed Selection */}
                  <div className="space-y-1.5 pt-1">
                    <span className="block text-xs font-medium text-[#292929]">
                      Delivery Speed *
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {(
                        [
                          {
                            id: 'Standard Delivery' as DeliveryMethod,
                            desc: inDhaka
                              ? '24–48 hrs inside Dhaka & Savar'
                              : '3–5 business days nationwide',
                            cost: freeEligible ? 0 : baseShipping,
                          },
                          {
                            id: 'Express Delivery' as DeliveryMethod,
                            desc: inDhaka
                              ? 'Same-day / next-morning courier'
                              : 'Priority nationwide dispatch',
                            cost:
                              (freeEligible ? 0 : baseShipping) +
                              settings.expressSurcharge,
                          },
                        ]
                      ).map((opt) => (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => setDeliveryMethod(opt.id)}
                          className={`min-h-[64px] p-3.5 rounded-2xl text-left border transition-colors ui-press cursor-pointer ${
                            deliveryMethod === opt.id
                              ? 'border-[#0A0A0A] bg-[#EAE9E4]'
                              : 'border-[#D9D9D9] bg-white hover:border-[#0A0A0A]'
                          }`}
                        >
                          <div className="flex items-center justify-between text-xs font-semibold text-[#0A0A0A]">
                            <span>{opt.id}</span>
                            <span className="font-mono tabular-nums">
                              {opt.cost === 0 ? 'Free' : formatBDT(opt.cost)}
                            </span>
                          </div>
                          <p className="mt-1 text-[11px] text-[#5C5C5C]">
                            {opt.desc}
                          </p>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label
                      htmlFor="delivery_note"
                      className="block text-xs font-medium text-[#292929] mb-1.5"
                    >
                      Delivery Note (Optional)
                    </label>
                    <textarea
                      id="delivery_note"
                      name="delivery_note"
                      rows={2}
                      value={deliveryNote}
                      onChange={(e) => setDeliveryNote(e.target.value)}
                      placeholder="Landmark, preferred delivery window, or gate instructions"
                      className="w-full rounded-xl border border-[#D9D9D9] bg-white px-3.5 py-2.5 text-sm text-[#0A0A0A] placeholder:text-[#808080] focus:border-[#0A0A0A] focus:outline-none"
                    />
                  </div>

                  {mapsApiKey && (
                    <div className="pt-2 space-y-2">
                      <div className="flex items-center justify-between text-xs text-[#5C5C5C]">
                        <span className="inline-flex items-center gap-1.5">
                          <MapPin className="h-3.5 w-3.5 text-[#0A0A0A]" />
                          {inDhaka
                            ? `Inside Dhaka / Savar Zone (${formatBDT(settings.insideDhakaCharge)} standard)`
                            : `Outside Dhaka Zone (${formatBDT(settings.outsideDhakaCharge)} standard)`}
                        </span>
                        {deliveryLocation && (
                          <span className="font-mono text-[#0A0A0A]">
                            Pin verified
                          </span>
                        )}
                      </div>
                      <CustomerDeliveryMap
                        address={deliveryAddress}
                        area={area}
                        city={city}
                        postalCode={postalCode}
                        deliveryLocation={deliveryLocation}
                        onLocationChange={setDeliveryLocation}
                        onReverseGeocodeAddress={(info) => {
                          if (info.formattedAddress) {
                            setDeliveryAddress(info.formattedAddress);
                          }
                          if (info.city) setCity(info.city);
                          if (info.area) setArea(info.area);
                          if (info.postalCode) setPostalCode(info.postalCode);
                          setFieldErrors((p) => ({
                            ...p,
                            delivery_address: undefined,
                            city: undefined,
                            area: undefined,
                          }));
                        }}
                        heightClass="h-[240px] sm:h-[260px]"
                      />
                    </div>
                  )}
                </section>
              )}

              {/* STEP 3: PRODUCT INFORMATION */}
              {currentStep === 3 && (
                <section aria-label="Product Information" className="space-y-4">
                  <div className="flex items-center justify-between text-xs text-[#5C5C5C]">
                    <span>
                      {usingCart
                        ? `${cart.length} bag item${cart.length > 1 ? 's' : ''}`
                        : 'Direct Order'}
                    </span>
                    <span className="font-mono font-semibold text-[#0A0A0A] tabular-nums">
                      Subtotal: {formatBDT(subtotal)}
                    </span>
                  </div>

                  {!usingCart && products.length === 0 ? (
                    <div className="rounded-2xl border border-[#D9D9D9] bg-[#F3F2EE] p-6 text-center space-y-3">
                      <p className="text-sm font-medium text-[#0A0A0A]">
                        {productsLoading
                          ? 'Loading products...'
                          : productsError
                            ? 'Unable to load products. Please try again.'
                            : 'No products are publicly available.'}
                      </p>
                      {productsError ? (
                        <button
                          type="button"
                          onClick={() => void refreshProducts()}
                          className="btn-base btn-secondary btn-sm"
                        >
                          Retry
                        </button>
                      ) : !productsLoading ? (
                        <>
                          <p className="text-xs text-[#5C5C5C]">
                            Products published from the Admin Panel will appear here
                            for direct ordering.
                          </p>
                          <Link to="/shop" className="btn-base btn-secondary btn-sm">
                            Browse Shop
                          </Link>
                        </>
                      ) : null}
                    </div>
                  ) : (
                    <>
                      {!usingCart && (
                        <div>
                          <label
                            htmlFor="direct_product_select"
                            className="block text-xs font-medium text-[#292929] mb-1.5"
                          >
                            Select Product *
                          </label>
                          <select
                            id="direct_product_select"
                            value={activeDirectProduct?.id || ''}
                            onChange={(e) => {
                              const nextProd = products.find(
                                (p) => p.id === e.target.value
                              );
                              setSelectedProductId(e.target.value);
                              if (nextProd) {
                                setSelectedSize(nextProd.sizes[0] || '');
                                setSelectedColor(nextProd.colors[0]?.name || '');
                                setDirectQuantity(1);
                              }
                            }}
                            className="w-full min-h-[46px] rounded-xl border border-[#D9D9D9] bg-white px-3.5 py-3 text-sm text-[#0A0A0A] focus:border-[#0A0A0A] focus:outline-none"
                          >
                            {products.map((p) => (
                              <option
                                key={p.id}
                                value={p.id}
                                disabled={p.inventory <= 0}
                              >
                                {p.name} — {formatBDT(p.price)}{' '}
                                {p.inventory <= 0 ? '(Out of Stock)' : ''}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}

                      {usingCart && cart.length > 1 && (
                        <ul className="divide-y divide-[#D9D9D9] rounded-2xl border border-[#D9D9D9] bg-[#F3F2EE] px-4 py-1 max-h-60 overflow-y-auto">
                          {cart.map((item) => {
                            const match = products.find(
                              (p) => p.id === item.productId
                            );
                            const unitPrice = match ? match.price : item.price;
                            return (
                              <li
                                key={item.id}
                                className="py-3 flex items-center justify-between gap-3"
                              >
                                <div className="flex items-center gap-3 min-w-0">
                                  {item.image && (
                                    <img
                                      src={item.image}
                                      alt={item.name}
                                      referrerPolicy="no-referrer"
                                      className="h-12 w-10 rounded-lg object-cover border border-[#D9D9D9] shrink-0"
                                    />
                                  )}
                                  <div className="min-w-0">
                                    <p className="text-xs font-semibold text-[#0A0A0A] truncate">
                                      {item.name}
                                    </p>
                                    <p className="text-[11px] text-[#5C5C5C]">
                                      {item.color} · {item.size}
                                    </p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-3 shrink-0">
                                  <div className="flex items-center rounded-lg border border-[#D9D9D9] bg-white h-9 overflow-hidden">
                                    <button
                                      type="button"
                                      aria-label={`Decrease quantity for ${item.name}`}
                                      onClick={() =>
                                        updateCartQuantity(
                                          item.id,
                                          Math.max(1, item.quantity - 1)
                                        )
                                      }
                                      className="h-full w-8 flex items-center justify-center hover:bg-[#EAE9E4] text-[#0A0A0A] cursor-pointer"
                                    >
                                      <Minus className="h-3 w-3" />
                                    </button>
                                    <span className="w-7 text-center font-mono text-xs font-semibold tabular-nums">
                                      {item.quantity}
                                    </span>
                                    <button
                                      type="button"
                                      aria-label={`Increase quantity for ${item.name}`}
                                      onClick={() =>
                                        updateCartQuantity(
                                          item.id,
                                          Math.min(20, item.quantity + 1)
                                        )
                                      }
                                      className="h-full w-8 flex items-center justify-center hover:bg-[#EAE9E4] text-[#0A0A0A] cursor-pointer"
                                    >
                                      <Plus className="h-3 w-3" />
                                    </button>
                                  </div>
                                  <span className="font-mono text-xs font-semibold tabular-nums text-[#0A0A0A] min-w-[64px] text-right">
                                    {formatBDT(unitPrice * item.quantity)}
                                  </span>
                                </div>
                              </li>
                            );
                          })}
                        </ul>
                      )}

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label
                            htmlFor="product_name"
                            className="block text-xs font-medium text-[#292929] mb-1.5"
                          >
                            Product Name *
                          </label>
                          <input
                            id="product_name"
                            name="product_name"
                            type="text"
                            readOnly
                            value={resolvedProductInfo.product_name}
                            className="w-full min-h-[44px] rounded-xl border border-[#D9D9D9] bg-[#F5F5F5] px-3.5 py-2.5 text-sm text-[#0A0A0A] focus:outline-none"
                          />
                        </div>
                        <div>
                          <label
                            htmlFor="product_id"
                            className="block text-xs font-medium text-[#292929] mb-1.5"
                          >
                            Product ID *
                          </label>
                          <input
                            id="product_id"
                            name="product_id"
                            type="text"
                            readOnly
                            value={resolvedProductInfo.product_id}
                            className="w-full min-h-[44px] rounded-xl border border-[#D9D9D9] bg-[#F5F5F5] px-3.5 py-2.5 text-sm font-mono text-[#0A0A0A] focus:outline-none"
                          />
                        </div>
                      </div>

                      {cart.length <= 1 ? (
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                          <div>
                            <label
                              htmlFor="size"
                              className="block text-xs font-medium text-[#292929] mb-1.5"
                            >
                              Size *
                            </label>
                            {!usingCart ? (
                              <select
                                id="size"
                                name="size"
                                value={resolvedProductInfo.size}
                                onChange={(e) =>
                                  setSelectedSize(e.target.value)
                                }
                                className="w-full min-h-[46px] rounded-xl border border-[#D9D9D9] bg-white px-3 py-2.5 text-sm text-[#0A0A0A] focus:border-[#0A0A0A] focus:outline-none"
                              >
                                {resolvedProductInfo.availableSizes.map((s) => (
                                  <option key={s} value={s}>
                                    {s}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              <input
                                id="size"
                                name="size"
                                type="text"
                                readOnly
                                value={resolvedProductInfo.size}
                                className="w-full min-h-[46px] rounded-xl border border-[#D9D9D9] bg-[#F5F5F5] px-3 py-2.5 text-sm text-[#0A0A0A] focus:outline-none"
                              />
                            )}
                          </div>

                          <div>
                            <label
                              htmlFor="color"
                              className="block text-xs font-medium text-[#292929] mb-1.5"
                            >
                              Color *
                            </label>
                            {!usingCart ? (
                              <select
                                id="color"
                                name="color"
                                value={resolvedProductInfo.color}
                                onChange={(e) =>
                                  setSelectedColor(e.target.value)
                                }
                                className="w-full min-h-[46px] rounded-xl border border-[#D9D9D9] bg-white px-3 py-2.5 text-sm text-[#0A0A0A] focus:border-[#0A0A0A] focus:outline-none"
                              >
                                {resolvedProductInfo.availableColors.map(
                                  (c) => (
                                    <option key={c} value={c}>
                                      {c}
                                    </option>
                                  )
                                )}
                              </select>
                            ) : (
                              <input
                                id="color"
                                name="color"
                                type="text"
                                readOnly
                                value={resolvedProductInfo.color}
                                className="w-full min-h-[46px] rounded-xl border border-[#D9D9D9] bg-[#F5F5F5] px-3 py-2.5 text-sm text-[#0A0A0A] focus:outline-none"
                              />
                            )}
                          </div>

                          <div>
                            <label
                              htmlFor="quantity"
                              className="block text-xs font-medium text-[#292929] mb-1.5"
                            >
                              Quantity *
                            </label>
                            <div className="flex items-center rounded-xl border border-[#D9D9D9] bg-white h-[46px] overflow-hidden">
                              <button
                                type="button"
                                aria-label="Decrease quantity"
                                onClick={() => {
                                  const next = Math.max(
                                    1,
                                    resolvedProductInfo.quantity - 1
                                  );
                                  if (
                                    usingCart &&
                                    resolvedProductInfo.cartItemId
                                  ) {
                                    updateCartQuantity(
                                      resolvedProductInfo.cartItemId,
                                      next
                                    );
                                  } else {
                                    setDirectQuantity(next);
                                  }
                                }}
                                className="h-full w-10 flex items-center justify-center hover:bg-[#EAE9E4] text-[#0A0A0A] transition-colors cursor-pointer ui-press"
                              >
                                <Minus className="h-3.5 w-3.5" />
                              </button>
                              <input
                                id="quantity"
                                name="quantity"
                                type="number"
                                min={1}
                                max={Math.min(
                                  99,
                                  resolvedProductInfo.maxStock || 99
                                )}
                                value={resolvedProductInfo.quantity}
                                onChange={(e) => {
                                  const parsed = Math.max(
                                    1,
                                    Math.min(
                                      99,
                                      parseInt(e.target.value || '1', 10) || 1
                                    )
                                  );
                                  if (
                                    usingCart &&
                                    resolvedProductInfo.cartItemId
                                  ) {
                                    updateCartQuantity(
                                      resolvedProductInfo.cartItemId,
                                      parsed
                                    );
                                  } else {
                                    setDirectQuantity(parsed);
                                  }
                                }}
                                className="w-full text-center font-mono text-sm font-semibold text-[#0A0A0A] bg-transparent focus:outline-none"
                              />
                              <button
                                type="button"
                                aria-label="Increase quantity"
                                onClick={() => {
                                  const next = Math.min(
                                    Math.min(
                                      99,
                                      resolvedProductInfo.maxStock || 99
                                    ),
                                    resolvedProductInfo.quantity + 1
                                  );
                                  if (
                                    usingCart &&
                                    resolvedProductInfo.cartItemId
                                  ) {
                                    updateCartQuantity(
                                      resolvedProductInfo.cartItemId,
                                      next
                                    );
                                  } else {
                                    setDirectQuantity(next);
                                  }
                                }}
                                className="h-full w-10 flex items-center justify-center hover:bg-[#EAE9E4] text-[#0A0A0A] transition-colors cursor-pointer ui-press"
                              >
                                <Plus className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>

                          <div>
                            <label
                              htmlFor="price"
                              className="block text-xs font-medium text-[#292929] mb-1.5"
                            >
                              Unit Price (৳)
                            </label>
                            <input
                              id="price"
                              name="price"
                              type="text"
                              readOnly
                              value={formatBDT(resolvedProductInfo.price)}
                              className="w-full min-h-[46px] rounded-xl border border-[#D9D9D9] bg-[#F5F5F5] px-3 py-2.5 text-sm font-mono font-semibold text-[#0A0A0A] focus:outline-none"
                            />
                          </div>
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                          <div>
                            <label className="block text-xs font-medium text-[#292929] mb-1.5">
                              Sizes
                            </label>
                            <input
                              name="size"
                              type="text"
                              readOnly
                              value={resolvedProductInfo.size}
                              className="w-full min-h-[44px] rounded-xl border border-[#D9D9D9] bg-[#F5F5F5] px-3 py-2.5 text-sm text-[#0A0A0A] focus:outline-none"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-[#292929] mb-1.5">
                              Colors
                            </label>
                            <input
                              name="color"
                              type="text"
                              readOnly
                              value={resolvedProductInfo.color}
                              className="w-full min-h-[44px] rounded-xl border border-[#D9D9D9] bg-[#F5F5F5] px-3 py-2.5 text-sm text-[#0A0A0A] focus:outline-none"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-[#292929] mb-1.5">
                              Total Quantity
                            </label>
                            <input
                              name="quantity"
                              type="text"
                              readOnly
                              value={resolvedProductInfo.quantity}
                              className="w-full min-h-[44px] rounded-xl border border-[#D9D9D9] bg-[#F5F5F5] px-3 py-2.5 text-sm font-mono font-semibold text-[#0A0A0A] focus:outline-none"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-[#292929] mb-1.5">
                              Avg Unit Price
                            </label>
                            <input
                              name="price"
                              type="text"
                              readOnly
                              value={formatBDT(resolvedProductInfo.price)}
                              className="w-full min-h-[44px] rounded-xl border border-[#D9D9D9] bg-[#F5F5F5] px-3 py-2.5 text-sm font-mono font-semibold text-[#0A0A0A] focus:outline-none"
                            />
                          </div>
                        </div>
                      )}

                      {fieldErrors.quantity && (
                        <p className="text-[11px] font-medium text-[#0A0A0A]">
                          {fieldErrors.quantity}
                        </p>
                      )}
                    </>
                  )}
                </section>
              )}

              {/* STEP 4: PAYMENT INFORMATION */}
              {currentStep === 4 && (
                <section aria-label="Payment Information" className="space-y-4">
                  <div>
                    <span className="block text-xs font-medium text-[#292929] mb-2">
                      Payment Method *
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {(
                        ['Cash on Delivery', 'bKash', 'Nagad'] as PaymentMethod[]
                      ).map((method) => (
                        <button
                          key={method}
                          type="button"
                          onClick={() => handlePaymentMethodChange(method)}
                          className={`min-h-[48px] px-4 rounded-xl text-xs font-semibold uppercase tracking-[0.12em] border text-center transition-colors ui-press cursor-pointer ${
                            paymentMethod === method
                              ? 'border-[#0A0A0A] bg-[#0A0A0A] text-white'
                              : 'border-[#D9D9D9] bg-white text-[#0A0A0A] hover:border-[#0A0A0A] hover:bg-[#F3F2EE]'
                          }`}
                        >
                          {method}
                        </button>
                      ))}
                    </div>
                  </div>

                  {paymentMethod === 'Cash on Delivery' ? (
                    <div className="rounded-2xl border border-[#D9D9D9] bg-[#F3F2EE] px-4 py-4 text-xs text-[#292929] flex flex-wrap items-center justify-between gap-3">
                      <span>
                        Pay{' '}
                        <strong className="font-mono text-[#0A0A0A]">
                          {formatBDT(totalAmount)}
                        </strong>{' '}
                        in cash upon parcel arrival. No advance Transaction ID
                        required.
                      </span>
                      <span className="inline-flex items-center gap-1.5 font-mono text-[11px] font-semibold text-[#0A0A0A] shrink-0">
                        <Check className="h-3.5 w-3.5" /> COD Ready
                      </span>
                    </div>
                  ) : (
                    <div className="space-y-4 rounded-2xl border border-[#D9D9D9] bg-[#F3F2EE] p-4 sm:p-5">
                      <div className="space-y-1 border-b border-[#D9D9D9] pb-3">
                        <p className="inline-flex items-center gap-1.5 font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-[#0A0A0A]">
                          <Smartphone className="h-3.5 w-3.5" /> {paymentMethod}{' '}
                          Payment Instructions
                        </p>
                        <p className="text-xs text-[#292929]">
                          Send Money / Payment to{' '}
                          <span className="font-mono font-bold text-[#0A0A0A] select-all">
                            {settings.supportPhone}
                          </span>{' '}
                          for total amount{' '}
                          <span className="font-mono font-bold text-[#0A0A0A]">
                            {formatBDT(totalAmount)}
                          </span>
                          , then enter your TrxID and sender mobile number below.
                        </p>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label
                            htmlFor="transaction_id"
                            className="block text-xs font-medium text-[#292929] mb-1.5"
                          >
                            {paymentMethod} Transaction ID (TrxID) *
                          </label>
                          <input
                            id="transaction_id"
                            name="transaction_id"
                            type="text"
                            required
                            value={transactionId}
                            onChange={(e) => {
                              setTransactionId(e.target.value);
                              if (fieldErrors.transaction_id)
                                setFieldErrors((p) => ({
                                  ...p,
                                  transaction_id: undefined,
                                }));
                            }}
                            aria-invalid={Boolean(fieldErrors.transaction_id)}
                            placeholder="e.g., 9H3K7L2P1Q"
                            className={`w-full min-h-[46px] rounded-xl border bg-white px-3.5 py-3 text-sm font-mono text-[#0A0A0A] placeholder:text-[#808080] focus:outline-none ${
                              fieldErrors.transaction_id
                                ? 'border-[#0A0A0A] bg-[#F5F5F5]'
                                : 'border-[#D9D9D9] focus:border-[#0A0A0A]'
                            }`}
                          />
                          {fieldErrors.transaction_id && (
                            <p className="mt-1 text-[11px] font-medium text-[#0A0A0A]">
                              {fieldErrors.transaction_id}
                            </p>
                          )}
                        </div>

                        <div>
                          <label
                            htmlFor="payment_sender_number"
                            className="block text-xs font-medium text-[#292929] mb-1.5"
                          >
                            Sender Phone Number *
                          </label>
                          <input
                            id="payment_sender_number"
                            name="payment_sender_number"
                            type="tel"
                            required
                            value={paymentSenderNumber}
                            onChange={(e) => {
                              setPaymentSenderNumber(e.target.value);
                              if (fieldErrors.payment_sender_number)
                                setFieldErrors((p) => ({
                                  ...p,
                                  payment_sender_number: undefined,
                                }));
                            }}
                            aria-invalid={Boolean(
                              fieldErrors.payment_sender_number
                            )}
                            placeholder="017XXXXXXXX"
                            className={`w-full min-h-[46px] rounded-xl border bg-white px-3.5 py-3 text-sm font-mono text-[#0A0A0A] placeholder:text-[#808080] focus:outline-none ${
                              fieldErrors.payment_sender_number
                                ? 'border-[#0A0A0A] bg-[#F5F5F5]'
                                : 'border-[#D9D9D9] focus:border-[#0A0A0A]'
                            }`}
                          />
                          {fieldErrors.payment_sender_number && (
                            <p className="mt-1 text-[11px] font-medium text-[#0A0A0A]">
                              {fieldErrors.payment_sender_number}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  <div>
                    <label
                      htmlFor="additional_information"
                      className="block text-xs font-medium text-[#292929] mb-1.5"
                    >
                      Additional Information (Optional)
                    </label>
                    <textarea
                      id="additional_information"
                      name="additional_information"
                      rows={2}
                      value={additionalInformation}
                      onChange={(e) => setAdditionalInformation(e.target.value)}
                      placeholder="Gift packaging request, sizing note, or extra details"
                      className="w-full rounded-xl border border-[#D9D9D9] bg-white px-3.5 py-2.5 text-sm text-[#0A0A0A] placeholder:text-[#808080] focus:border-[#0A0A0A] focus:outline-none"
                    />
                  </div>
                </section>
              )}

              {/* STEP 5: ORDER SUMMARY & CONFIRMATION */}
              {currentStep === 5 && (
                <section
                  aria-label="Order Summary and Confirmation"
                  className="space-y-6"
                >
                  {/* Collected Checkout Details Review (Steps 1, 2, 4) */}
                  <div className="divide-y divide-[#D9D9D9] border-y border-[#D9D9D9] text-xs">
                    <div className="py-3.5 flex items-start justify-between gap-4">
                      <div className="space-y-0.5 min-w-0">
                        <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-[#5C5C5C]">
                          1. Customer
                        </p>
                        <p className="font-semibold text-[#0A0A0A]">
                          {customerName} ·{' '}
                          <span className="font-mono">{customerPhone}</span>
                        </p>
                        {customerEmail.trim() && (
                          <p className="text-[#5C5C5C] truncate">
                            {customerEmail}
                          </p>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => navigateToStep(1)}
                        className="inline-flex items-center gap-1 text-[11px] font-medium text-[#0A0A0A] hover:underline shrink-0 py-1 cursor-pointer"
                      >
                        <Pencil className="h-3 w-3" /> Edit
                      </button>
                    </div>

                    <div className="py-3.5 flex items-start justify-between gap-4">
                      <div className="space-y-0.5 min-w-0">
                        <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-[#5C5C5C]">
                          2. Delivery
                        </p>
                        <p className="font-medium text-[#0A0A0A]">
                          {deliveryAddress}, {area}, {city}
                          {postalCode.trim() ? ` ${postalCode.trim()}` : ''}
                        </p>
                        <p className="text-[#5C5C5C]">
                          {deliveryMethod}
                          {deliveryNote.trim()
                            ? ` · Note: "${deliveryNote.trim()}"`
                            : ''}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => navigateToStep(2)}
                        className="inline-flex items-center gap-1 text-[11px] font-medium text-[#0A0A0A] hover:underline shrink-0 py-1 cursor-pointer"
                      >
                        <Pencil className="h-3 w-3" /> Edit
                      </button>
                    </div>

                    <div className="py-3.5 flex items-start justify-between gap-4">
                      <div className="space-y-0.5 min-w-0">
                        <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-[#5C5C5C]">
                          4. Payment
                        </p>
                        <p className="font-medium text-[#0A0A0A]">
                          {paymentMethod}
                          {(paymentMethod === 'bKash' ||
                            paymentMethod === 'Nagad') &&
                          transactionId.trim()
                            ? ` · TrxID: ${transactionId.trim()} (${paymentSenderNumber.trim()})`
                            : ''}
                        </p>
                        {additionalInformation.trim() && (
                          <p className="text-[#5C5C5C] truncate">
                            Note: {additionalInformation.trim()}
                          </p>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => navigateToStep(4)}
                        className="inline-flex items-center gap-1 text-[11px] font-medium text-[#0A0A0A] hover:underline shrink-0 py-1 cursor-pointer"
                      >
                        <Pencil className="h-3 w-3" /> Edit
                      </button>
                    </div>
                  </div>

                  {/* Itemized Order Summary */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="flex items-center gap-2 text-xs font-mono uppercase tracking-[0.14em] text-[#5C5C5C]">
                        <ShoppingBag className="h-3.5 w-3.5 text-[#0A0A0A]" />
                        <span>
                          3. Items ({resolvedProductInfo.quantity})
                        </span>
                      </h3>
                      <button
                        type="button"
                        onClick={() => navigateToStep(3)}
                        className="inline-flex items-center gap-1 text-[11px] font-medium text-[#0A0A0A] hover:underline py-1 cursor-pointer"
                      >
                        <Pencil className="h-3 w-3" /> Edit
                      </button>
                    </div>

                    {usingCart ? (
                      <ul className="divide-y divide-[#D9D9D9] max-h-60 overflow-y-auto pr-1">
                        {cart.map((item) => {
                          const cat = products.find(
                            (p) => p.id === item.productId
                          );
                          const unitPrice = cat ? cat.price : item.price;
                          return (
                            <li
                              key={item.id}
                              className="py-2.5 flex gap-3 items-center"
                            >
                              <div className="h-14 w-11 shrink-0 rounded-xl bg-[#EAE9E4] border border-[#D9D9D9] overflow-hidden">
                                <img
                                  src={item.image}
                                  alt={item.name}
                                  referrerPolicy="no-referrer"
                                  className="h-full w-full object-cover"
                                />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-medium text-[#0A0A0A] truncate">
                                  {item.name}
                                </p>
                                <p className="text-[11px] text-[#5C5C5C]">
                                  {item.color} · {item.size} × {item.quantity}
                                </p>
                              </div>
                              <span className="font-mono text-xs font-semibold tabular-nums text-[#0A0A0A]">
                                {formatBDT(unitPrice * item.quantity)}
                              </span>
                            </li>
                          );
                        })}
                      </ul>
                    ) : activeDirectProduct ? (
                      <div className="flex gap-3 items-center py-2">
                        <div className="h-14 w-12 shrink-0 rounded-xl bg-[#EAE9E4] border border-[#D9D9D9] overflow-hidden">
                          <img
                            src={activeDirectProduct.images[0]}
                            alt={activeDirectProduct.name}
                            referrerPolicy="no-referrer"
                            className="h-full w-full object-cover"
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-[#0A0A0A] truncate">
                            {activeDirectProduct.name}
                          </p>
                          <p className="text-[11px] text-[#5C5C5C]">
                            {resolvedProductInfo.color} ·{' '}
                            {resolvedProductInfo.size} ×{' '}
                            {resolvedProductInfo.quantity}
                          </p>
                        </div>
                        <span className="font-mono text-xs font-semibold tabular-nums text-[#0A0A0A]">
                          {formatBDT(subtotal)}
                        </span>
                      </div>
                    ) : null}
                  </div>

                  {/* Promo Code */}
                  <div className="space-y-2 pt-3 border-t border-[#D9D9D9]">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={promoCodeInput}
                        onChange={(e) =>
                          setPromoCodeInput(e.target.value.toUpperCase())
                        }
                        placeholder="Promo code (optional)"
                        className="flex-1 min-w-0 min-h-[44px] rounded-xl border border-[#D9D9D9] bg-white px-3.5 py-2 text-xs font-mono uppercase text-[#0A0A0A] placeholder:text-[#6A6A6A] focus:border-[#0A0A0A] focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={handleApplyPromo}
                        className="btn-base btn-secondary min-h-[44px] shrink-0"
                      >
                        Apply
                      </button>
                    </div>
                    {promoStatus && (
                      <p className="text-[11px] text-[#0A0A0A] font-medium">
                        {promoStatus.message}
                      </p>
                    )}
                    {appliedCoupon && (
                      <div className="flex items-center justify-between rounded-xl bg-[#EAE9E4] px-3 py-2 text-[11px]">
                        <span className="font-mono font-semibold text-[#0A0A0A]">
                          Applied: {appliedCoupon.code}
                        </span>
                        <button
                          type="button"
                          onClick={removeCoupon}
                          className="text-[#5C5C5C] hover:text-[#0A0A0A] underline cursor-pointer"
                        >
                          Remove
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Calculated Totals */}
                  <div className="space-y-2 pt-3 border-t border-[#D9D9D9] text-sm tabular-nums">
                    <div className="flex justify-between text-[#292929]">
                      <span>Subtotal</span>
                      <span className="font-mono">{formatBDT(subtotal)}</span>
                    </div>
                    <div className="flex justify-between text-[#292929]">
                      <span>
                        Delivery Charge (
                        {inDhaka ? 'Inside Dhaka' : 'Outside Dhaka'})
                      </span>
                      <span className="font-mono">
                        {deliveryCharge === 0
                          ? 'Free'
                          : formatBDT(deliveryCharge)}
                      </span>
                    </div>
                    <div className="flex justify-between text-[#292929]">
                      <span>Discount</span>
                      <span className="font-mono">
                        {discount > 0 ? `-${formatBDT(discount)}` : formatBDT(0)}
                      </span>
                    </div>
                    <div className="flex justify-between pt-3 border-t border-[#D9D9D9] text-base font-semibold text-[#0A0A0A]">
                      <span>Total Amount</span>
                      <span className="font-mono">{formatBDT(totalAmount)}</span>
                    </div>
                  </div>
                </section>
              )}

              {/* Validation / Submission Error Banner */}
              {submitError && (
                <div
                  role="alert"
                  aria-live="polite"
                  className="flex items-start gap-2.5 rounded-xl border border-[#0A0A0A] bg-[#EEEEEE] px-4 py-3 text-xs font-medium text-[#0A0A0A]"
                >
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>{submitError}</span>
                </div>
              )}

              {/* Step Navigation Footer */}
              <div className="pt-4 border-t border-[#D9D9D9] flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-3">
                {currentStep > 1 ? (
                  <button
                    type="button"
                    onClick={handlePrevStep}
                    disabled={isSubmitting}
                    className="btn-base btn-secondary min-h-[48px] sm:min-w-[130px]"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    <span>Back</span>
                  </button>
                ) : (
                  <Link
                    to="/shop"
                    className="btn-base btn-secondary min-h-[48px] sm:min-w-[140px]"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    <span>Back to Shop</span>
                  </Link>
                )}

                {currentStep < 5 ? (
                  <button
                    type="submit"
                    className="btn-base btn-primary btn-lg min-h-[48px] flex-1 sm:flex-none sm:min-w-[230px]"
                  >
                    <span>
                      Continue to {nextStepMeta?.shortTitle || 'Next'}
                    </span>
                    <ArrowRight className="h-4 w-4" />
                  </button>
                ) : (
                  <button
                    type="submit"
                    disabled={isSubmitting || subtotal <= 0}
                    className="btn-base btn-primary btn-lg min-h-[48px] flex-1 sm:flex-none sm:min-w-[240px]"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>Confirming Order...</span>
                      </>
                    ) : (
                      <span>Confirm Order</span>
                    )}
                  </button>
                )}
              </div>

              {currentStep === 5 && (
                <p className="text-[11px] text-[#5C5C5C] text-center">
                  Order ID, Order Date, and Pending status are generated
                  automatically upon confirmation.
                </p>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </form>
    </main>
  );
};
