import React, { useEffect } from 'react';

const DEFAULT_OG_IMAGE = 'https://i.ibb.co.com/Xk6ykh3s/IMG-20261116-201445-227.jpg';

export interface ProductSeoMeta {
  priceAmount: number;
  currency?: string;
  availability: 'in stock' | 'out of stock';
  brand?: string;
  category?: string;
  sku?: string;
  condition?: 'new' | 'used' | 'refurbished';
}

interface SeoHeadProps {
  title: string;
  description: string;
  ogType?: 'website' | 'product';
  image?: string;
  productMeta?: ProductSeoMeta;
  jsonLd?: Record<string, unknown>;
  noIndex?: boolean;
}

export const SeoHead: React.FC<SeoHeadProps> = ({
  title,
  description,
  ogType = 'website',
  image,
  productMeta,
  jsonLd,
  noIndex = false,
}) => {
  useEffect(() => {
    const fullTitle = title.includes('PYTHOX WORLD')
      ? title
      : `${title} | PYTHOX WORLD`;
    document.title = fullTitle;

    const upsertMeta = (
      attrName: 'name' | 'property',
      attrValue: string,
      content: string
    ) => {
      let el = document.querySelector(`meta[${attrName}="${attrValue}"]`);
      if (!el) {
        el = document.createElement('meta');
        el.setAttribute(attrName, attrValue);
        document.head.appendChild(el);
      }
      el.setAttribute('content', content);
    };

    const canonicalUrl = `${window.location.origin}${window.location.pathname}`;
    const rawImage = (image || DEFAULT_OG_IMAGE).trim();
    const resolvedImage =
      rawImage.startsWith('/') ? `${window.location.origin}${rawImage}` : rawImage;

    upsertMeta('name', 'description', description);
    upsertMeta('name', 'robots', noIndex ? 'noindex, nofollow' : 'index, follow');
    upsertMeta('property', 'og:type', ogType);
    upsertMeta('property', 'og:url', canonicalUrl);
    upsertMeta('property', 'og:title', fullTitle);
    upsertMeta('property', 'og:description', description);
    upsertMeta('property', 'og:image', resolvedImage);
    upsertMeta('property', 'og:image:alt', fullTitle);

    upsertMeta('name', 'twitter:title', fullTitle);
    upsertMeta('name', 'twitter:description', description);
    upsertMeta('name', 'twitter:image', resolvedImage);
    upsertMeta('name', 'twitter:image:alt', fullTitle);

    if (productMeta) {
      upsertMeta('property', 'product:brand', productMeta.brand || 'PYTHOX WORLD');
      upsertMeta('property', 'product:availability', productMeta.availability);
      upsertMeta('property', 'product:condition', productMeta.condition || 'new');
      upsertMeta('property', 'product:price:amount', String(productMeta.priceAmount));
      upsertMeta('property', 'product:price:currency', productMeta.currency || 'BDT');
      if (productMeta.category) {
        upsertMeta('property', 'product:category', productMeta.category);
      }
      if (productMeta.sku) {
        upsertMeta('property', 'product:retailer_item_id', productMeta.sku);
      }
    } else {
      upsertMeta('property', 'product:brand', 'PYTHOX WORLD');
      upsertMeta('property', 'product:availability', 'in stock');
      upsertMeta('property', 'product:condition', 'new');
      upsertMeta('property', 'product:price:amount', '1490');
      upsertMeta('property', 'product:price:currency', 'BDT');
      upsertMeta('property', 'product:category', "Men's Apparel & Lifestyle");
      upsertMeta('property', 'product:retailer_item_id', 'PYTHOX-CATALOG');
    }

    let canonical = document.querySelector('link[rel="canonical"]');
    if (!canonical) {
      canonical = document.createElement('link');
      canonical.setAttribute('rel', 'canonical');
      document.head.appendChild(canonical);
    }
    canonical.setAttribute('href', canonicalUrl);

    const scriptId = 'pythox-dynamic-jsonld';
    const existing = document.getElementById(scriptId);
    if (existing) existing.remove();

    if (jsonLd) {
      const script = document.createElement('script');
      script.id = scriptId;
      script.type = 'application/ld+json';
      script.text = JSON.stringify(jsonLd);
      document.head.appendChild(script);
    }

    return () => {
      const el = document.getElementById(scriptId);
      if (el) el.remove();
    };
  }, [title, description, ogType, image, productMeta, jsonLd, noIndex]);

  return null;
};
