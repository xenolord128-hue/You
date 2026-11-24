import { BlogPost, Category, Collection, Product, StoreSettings } from '../types/ecommerce';
import { sanitizeMediaUrl } from '../lib/formatters';
import { apiUrl } from '../lib/api';
import mensHeroCampaignImg from '../assets/images/mens_hero_campaign_1794997537605.jpg';
import heroMenImg from '../assets/images/pythox_hero_men_1794838924637.jpg';
import catMenImg from '../assets/images/cat_men_1794789696875.jpg';
import catAccessoriesImg from '../assets/images/cat_accessories_1794789697980.jpg';
import catShoesImg from '../assets/images/cat_shoes_1794789696209.jpg';
import oversizedTshirtImg from '../assets/images/pythox_oversized_tshirt_1794838926010.jpg';
import knitPoloImg from '../assets/images/prod_knit_polo_1794789700428.jpg';
import linenShirtImg from '../assets/images/prod_linen_shirt_1794789699510.jpg';
import hoodieCharcoalImg from '../assets/images/prod_hoodie_charcoal_1794789698601.jpg';
import hoodieCreamImg from '../assets/images/prod_hoodie_cream_1794789699056.jpg';
import denimJeansImg from '../assets/images/pythox_denim_jeans_1794838925818.jpg';
import bomberJacketImg from '../assets/images/pythox_bomber_jacket_1794838925756.jpg';
import watchMensImg from '../assets/images/pythox_watch_mens_1794838924892.jpg';

export const BRAND_LOGO_URL =
  'https://i.ibb.co.com/Xk6ykh3s/IMG-20261116-201445-227.jpg';

export const BRAND_LOCATION =
  'Savar Thana Road, Ciramix Bazar, 121/5, Savar, Dhaka';

export const HERO_CAMPAIGN_URL =
  'https://i.ibb.co.com/vxpcvRcm/file-00000000280c8230b404530156246db1.png';

export const HERO_CAMPAIGN_FALLBACK_URL =
  'https://i.ibb.co/vxpcvRcm/file-00000000280c8230b404530156246db1.png';

export const MOBILE_HERO_CAMPAIGN_URL =
  'https://i.ibb.co.com/Qv5bvhGW/file-00000000a24c821295a55f6b9125040a.png';

export const MOBILE_HERO_CAMPAIGN_FALLBACK_URL =
  'https://i.ibb.co/Qv5bvhGW/file-00000000a24c821295a55f6b9125040a.png';

const BUNDLED_ASSET_MAP: Record<string, string> = {
  'mens_hero_campaign_1794997537605.jpg': mensHeroCampaignImg,
  'pythox_hero_men_1794838924637.jpg': heroMenImg,
  'cat_men_1794789696875.jpg': catMenImg,
  'cat_accessories_1794789697980.jpg': catAccessoriesImg,
  'cat_shoes_1794789696209.jpg': catShoesImg,
  'pythox_oversized_tshirt_1794838926010.jpg': oversizedTshirtImg,
  'prod_knit_polo_1794789700428.jpg': knitPoloImg,
  'prod_linen_shirt_1794789699510.jpg': linenShirtImg,
  'prod_hoodie_charcoal_1794789698601.jpg': hoodieCharcoalImg,
  'prod_hoodie_cream_1794789699056.jpg': hoodieCreamImg,
  'pythox_denim_jeans_1794838925818.jpg': denimJeansImg,
  'pythox_bomber_jacket_1794838925756.jpg': bomberJacketImg,
  'pythox_watch_mens_1794838924892.jpg': watchMensImg,
};

export function resolveBundledMediaUrl(raw?: string | null, fallback = ''): string {
  const value = (raw || '').trim();
  if (!value) return fallback;
  const match = value.match(/(?:^|\/)src\/assets\/images\/([^/?#]+)/i);
  if (match?.[1]) {
    return BUNDLED_ASSET_MAP[match[1]] || fallback;
  }
  const safe = sanitizeMediaUrl(value, fallback);
  if (safe.startsWith('/api/media/')) {
    return apiUrl(safe);
  }
  return safe;
}

export function sanitizeHeroSettingUrl(raw?: string | null): string {
  return resolveBundledMediaUrl(raw, '');
}

export function normalizeCategoryMedia(cat: Category): Category {
  const fallbackMap: Record<string, string> = {
    'cat-tshirts-polos': oversizedTshirtImg,
    'cat-shirts': linenShirtImg,
    'cat-pants-jeans': denimJeansImg,
    'cat-hoodies-jackets': hoodieCharcoalImg,
    'cat-sneakers': catShoesImg,
    'cat-watches': watchMensImg,
    'cat-accessories': catAccessoriesImg,
  };
  const fallback = fallbackMap[cat.id] || catMenImg;
  return {
    ...cat,
    image: resolveBundledMediaUrl(cat.image, fallback),
  };
}

export function normalizeCollectionMedia(col: Collection): Collection {
  const fallbackMap: Record<string, string> = {
    'urban-essentials': mensHeroCampaignImg,
    'winter-collection': bomberJacketImg,
    'executive-minimal': catMenImg,
  };
  const fallback = fallbackMap[col.slug] || mensHeroCampaignImg;
  return {
    ...col,
    hero_image: resolveBundledMediaUrl(col.hero_image, fallback),
  };
}

export function normalizeProductMedia(product: Product): Product {
  const images = Array.isArray(product.images)
    ? product.images.map((img) => resolveBundledMediaUrl(img, '')).filter(Boolean)
    : [];
  const primaryImage = resolveBundledMediaUrl(product.primaryImage, images[0] || '');
  const orderedImages = primaryImage
    ? [primaryImage, ...images.filter((u) => u !== primaryImage)]
    : images;
  const videoUrl = product.videoUrl
    ? resolveBundledMediaUrl(product.videoUrl, '') || undefined
    : undefined;
  return {
    ...product,
    images: orderedImages,
    primaryImage,
    ...(videoUrl ? { videoUrl } : {}),
  };
}

export const EDITORIAL_MEDIA = {
  heroCampaign: HERO_CAMPAIGN_URL,
  heroMen: heroMenImg,
  catMen: catMenImg,
  catAccessories: catAccessoriesImg,
  catShoes: catShoesImg,
  prodOversizedTshirt: oversizedTshirtImg,
  prodKnitPolo: knitPoloImg,
  prodLinenShirt: linenShirtImg,
  prodHoodieCharcoal: hoodieCharcoalImg,
  prodHoodieCream: hoodieCreamImg,
  prodDenimJeans: denimJeansImg,
  prodBomberJacket: bomberJacketImg,
  prodWatchMens: watchMensImg,
};

export const DEFAULT_SETTINGS: StoreSettings = {
  id: 'store_config',
  insideDhakaCharge: 80,
  outsideDhakaCharge: 130,
  expressSurcharge: 70,
  freeShippingThreshold: 3000,
  businessAddress: BRAND_LOCATION,
  supportEmail: 'pythoxfashion@gmail.com',
  supportPhone: '+880 1887-602095',
  whatsappNumber: '8801887602095',
  messengerHandle: 'pythoxworld',
  facebookUrl: 'https://www.facebook.com/share/1A8c2wEDBX/',
  instagramUrl: 'https://www.instagram.com/pythoxworld?knvt=MW9kY2t5N3R5eHZwbA==',
  metaPixelId: '',
  announcementText: 'Free Delivery on orders over ৳3,000 across Bangladesh',
  heroImageUrl: '',
  mobileHeroImageUrl: '',
};

export const DEFAULT_CATEGORIES: Category[] = [
  {
    id: 'cat-tshirts-polos',
    name: 'T-Shirts & Polo Shirts',
    filterCategories: [
      'T-Shirts & Polo Shirts',
      'T-Shirts & Polos',
      'T-Shirt',
      'T-Shirts',
      'Polo Shirt',
      'Polo Shirts',
      'Oversized T-Shirts',
      'Regular Fit T-Shirts',
    ],
    subcategories: [
      'T-Shirts',
      'Polo Shirts',
      'Oversized T-Shirts',
      'Regular Fit T-Shirts',
    ],
    slug: 't-shirts-polo-shirts',
    image: oversizedTshirtImg,
    description:
      'Heavyweight ring-spun tees, knit polo shirts, oversized boxy fits, and regular tailored essentials.',
    display_order: 1,
  },
  {
    id: 'cat-shirts',
    name: 'Shirts',
    filterCategories: [
      'Shirts',
      'Shirt',
      'Casual Shirts',
      'Formal Shirts',
      'Overshirts',
      'Oxford Shirt',
    ],
    subcategories: ['Casual Shirts', 'Formal Shirts', 'Overshirts'],
    slug: 'shirts',
    image: linenShirtImg,
    description:
      'Crisp tailored formal shirts, breathable casual weaves, and structured men’s overshirts.',
    display_order: 2,
  },
  {
    id: 'cat-pants-jeans',
    name: 'Pants, Trousers & Jeans',
    filterCategories: [
      'Pants, Trousers & Jeans',
      'Jeans',
      'Trousers',
      'Trouser',
      'Casual Pants',
      'Cargo Pants',
      'Cargo Pant',
      'Chinos',
      'Pant',
      'Pants',
      'Selvedge Jeans',
    ],
    subcategories: ['Jeans', 'Trousers', 'Casual Pants', 'Cargo Pants', 'Chinos'],
    slug: 'pants-trousers-jeans',
    image: denimJeansImg,
    description:
      'Architectural pleated trousers, raw selvedge denim, tailored chinos, and utilitarian cargos.',
    display_order: 3,
  },
  {
    id: 'cat-hoodies-jackets',
    name: 'Hoodies & Jackets',
    filterCategories: [
      'Hoodies & Jackets',
      'Hoodies & Outerwear',
      'Hoodies',
      'Hoodie',
      'Sweatshirts',
      'Sweatshirt',
      'Jackets',
      'Jacket',
      'Winter Jackets',
      'Bomber Jacket',
    ],
    subcategories: ['Hoodies', 'Sweatshirts', 'Jackets', 'Winter Jackets'],
    slug: 'hoodies-jackets',
    image: hoodieCharcoalImg,
    description:
      '460 GSM brushed fleece hoodies, heavy crewneck sweatshirts, matte bombers, and winter outerwear.',
    display_order: 4,
  },
  {
    id: 'cat-sneakers',
    name: 'Sneakers',
    filterCategories: [
      'Sneakers',
      'Sneaker',
      'Casual Sneakers',
      'Sports Sneakers',
      'High-Top Sneakers',
      'Low-Top Sneakers',
    ],
    subcategories: [
      'Casual Sneakers',
      'Sports Sneakers',
      'High-Top Sneakers',
      'Low-Top Sneakers',
    ],
    slug: 'sneakers',
    image: catShoesImg,
    description:
      'Minimalist low-top leather court trainers, structured high-tops, and performance street sneakers.',
    display_order: 5,
  },
  {
    id: 'cat-watches',
    name: 'Watches',
    filterCategories: [
      'Watches',
      'Watch',
      'Classic Watches',
      'Sports Watches',
      'Minimal Watches',
      'Premium Watches',
    ],
    subcategories: [
      'Classic Watches',
      'Sports Watches',
      'Minimal Watches',
      'Premium Watches',
    ],
    slug: 'watches',
    image: watchMensImg,
    description:
      'Brushed stainless steel timepieces spanning minimal dials, classic dress cases, and sports chronographs.',
    display_order: 6,
  },
  {
    id: 'cat-accessories',
    name: 'Accessories',
    filterCategories: [
      'Accessories',
      'Wallets',
      'Wallet',
      'Belts',
      'Belt',
      'Caps',
      'Cap',
      'Sunglasses',
      'Bracelets',
      'Bracelet',
      'Bags',
      'Bag',
      'Other Men’s Accessories',
      'Leather Goods',
    ],
    subcategories: [
      'Wallets',
      'Belts',
      'Caps',
      'Sunglasses',
      'Bracelets',
      'Bags',
      'Other Men’s Accessories',
    ],
    slug: 'accessories',
    image: catAccessoriesImg,
    description:
      'Full-grain leather wallets and belts, structured caps, eyewear, steel bracelets, and carry bags.',
    display_order: 7,
  },
];

export const DEFAULT_COLLECTIONS: Collection[] = [
  {
    id: 'col-urban-essentials',
    title: 'Urban Essentials',
    slug: 'urban-essentials',
    description: 'Daily architectural menswear anchored in heavyweight cotton.',
    hero_image: mensHeroCampaignImg,
    featured: true,
  },
  {
    id: 'col-winter-collection',
    title: 'Winter Collection',
    slug: 'winter-collection',
    description: '460 GSM brushed hoodies, sweatshirts, and matte insulated bombers.',
    hero_image: bomberJacketImg,
    featured: true,
  },
  {
    id: 'col-executive-minimal',
    title: 'Executive Minimal',
    slug: 'executive-minimal',
    description: 'Clean smart-casual tailoring, pleated trousers, and minimal wristwear.',
    hero_image: catMenImg,
    featured: true,
  },
];

export const BLOG_POSTS: BlogPost[] = [
  {
    id: 'post-gsm-guide',
    slug: 'understanding-heavyweight-cotton-gsm',
    title: 'Why 260–460 GSM Heavyweight Cotton Defines Modern Streetwear',
    excerpt:
      'How yarn density, ring-spun combing, and collar ribbing transform everyday menswear silhouette.',
    content: [
      'A garment’s silhouette starts long before cutting begins—it starts with yarn twist and fabric weight measured in grams per square meter (GSM).',
      'Whereas standard retail tees hover around 150–170 GSM, PYTHOX WORLD builds tees at 260 GSM and winter hoodies at 460 GSM so every shoulder drop and chest line holds architectural poise all day.',
    ],
    category: 'Fabric Architecture',
    publishedAt: 'October 2026',
    readTime: '3 min read',
    image: oversizedTshirtImg,
  },
  {
    id: 'post-monochrome-layering',
    slug: 'monochrome-winter-layering-dhaka',
    title: 'Monochrome Winter Layering for Urban Evenings',
    excerpt:
      'Pairing brushed hoodies, matte flight bombers, and structured twill caps for effortless cold-weather proportion.',
    content: [
      'Contrast in monochrome dressing comes from texture rather than loud colors: matte nylon twill over heavy brushed French terry creates instant visual depth.',
      'Pair charcoal and cream midlayers with dark raw selvedge denim for a balanced silhouette from Savar to Gulshan.',
    ],
    category: 'Editorial Lookbook',
    publishedAt: 'November 2026',
    readTime: '4 min read',
    image: bomberJacketImg,
  },
];
