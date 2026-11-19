import { BlogPost, Category, Collection, StoreSettings } from '../types/ecommerce';
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

export const EDITORIAL_MEDIA = {
  heroCampaign: mensHeroCampaignImg,
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
  supportPhone: '+880 1700-000000',
  whatsappNumber: '8801700000000',
  messengerHandle: 'pythoxworld',
  facebookUrl: 'https://facebook.com/pythoxworld',
  instagramUrl: 'https://instagram.com/pythoxworld',
  metaPixelId: '',
  announcementText: 'Free Delivery on orders over ৳3,000 across Bangladesh',
  heroImageUrl: '',
};

export const DEFAULT_CATEGORIES: Category[] = [
  {
    id: 'cat-tees',
    name: 'T-Shirts & Polos',
    filterCategories: ['T-Shirt', 'Polo Shirt'],
    subcategories: ['Oversized Tee', 'Boxy Tee', 'Polo Shirt', 'Long Sleeve Tee'],
    slug: 't-shirts',
    image: oversizedTshirtImg,
    description: '260 GSM combed ring-spun boxy tees and fine-gauge knit polos.',
    display_order: 1,
  },
  {
    id: 'cat-outerwear',
    name: 'Hoodies & Outerwear',
    filterCategories: ['Hoodie', 'Jacket'],
    subcategories: ['Pullover Hoodie', 'Zip Hoodie', 'Sweatshirt', 'Bomber Jacket'],
    slug: 'hoodies-outerwear',
    image: hoodieCharcoalImg,
    description: '460 GSM heavyweight winter fleece, sweatshirts, and matte bombers.',
    display_order: 2,
  },
  {
    id: 'cat-shirts-bottoms',
    name: 'Shirts & Bottoms',
    filterCategories: ['Shirt', 'Pant', 'Trouser', 'Jeans'],
    subcategories: ['Oxford Shirt', 'Trouser', 'Cargo Pant', 'Selvedge Jeans'],
    slug: 'shirts-bottoms',
    image: denimJeansImg,
    description: 'Tailored Oxford shirts, pleated wool trousers, and raw selvedge denim.',
    display_order: 3,
  },
  {
    id: 'cat-footwear-acc',
    name: 'Caps, Footwear & Steel',
    filterCategories: [
      'Cap',
      'Sneakers',
      'Watches',
      'Wallet',
      'Belt',
      'Sunglasses',
      'Bracelet',
      'Accessories',
    ],
    subcategories: ['Cap', 'Sneakers', 'Watches', 'Leather Goods', 'Accessories'],
    slug: 'footwear-accessories',
    image: catAccessoriesImg,
    description: 'Structured streetwear caps, court suede sneakers, and brushed steel horology.',
    display_order: 4,
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
