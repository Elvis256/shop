/**
 * SEO Configuration & Content Strategy
 * Central keyword mapping, meta templates, and content pillars
 */

export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://ugsex.com";
export const SITE_NAME = "PleasureZone Uganda";
export const DEFAULT_OG_IMAGE = `${SITE_URL}/og-image.png`;

/** Target keywords per category for meta generation */
export const CATEGORY_KEYWORDS: Record<string, {
  primary: string;
  secondary: string[];
  metaTitle: string;
  metaDescription: string;
}> = {
  vibrators: {
    primary: "vibrators Uganda",
    secondary: ["buy vibrators online", "best vibrators Kampala", "discreet vibrator delivery"],
    metaTitle: "Vibrators - Buy Online with Discreet Delivery | PleasureZone Uganda",
    metaDescription: "Shop premium vibrators online in Uganda. Wide selection with fast, discreet delivery to Kampala & nationwide. Secure checkout & plain packaging guaranteed.",
  },
  lingerie: {
    primary: "lingerie Uganda",
    secondary: ["buy lingerie online Uganda", "sexy lingerie Kampala", "affordable lingerie"],
    metaTitle: "Lingerie - Sexy & Affordable | PleasureZone Uganda",
    metaDescription: "Discover beautiful lingerie in Uganda. From elegant to daring, find your perfect fit with fast delivery & discreet packaging. Shop now at PleasureZone.",
  },
  lubricants: {
    primary: "lubricants Uganda",
    secondary: ["buy lubricant online", "personal lubricant Kampala", "water-based lube"],
    metaTitle: "Lubricants & Personal Care | PleasureZone Uganda",
    metaDescription: "Quality personal lubricants with discreet delivery across Uganda. Water-based, silicone & flavored options. Fast shipping & secure checkout.",
  },
  "couples-toys": {
    primary: "couples toys Uganda",
    secondary: ["couples intimacy products", "relationship toys Kampala", "couples wellness"],
    metaTitle: "Couples Toys & Intimacy Products | PleasureZone Uganda",
    metaDescription: "Explore couples toys & intimacy products in Uganda. Enhance your relationship with discreet delivery & plain packaging. Shop PleasureZone today.",
  },
  wellness: {
    primary: "sexual wellness Uganda",
    secondary: ["wellness products online", "intimate health", "self-care products"],
    metaTitle: "Sexual Wellness & Self-Care | PleasureZone Uganda",
    metaDescription: "Premium sexual wellness & self-care products delivered discreetly across Uganda. Expert-curated selection for your intimate health needs.",
  },
  accessories: {
    primary: "intimate accessories Uganda",
    secondary: ["adult accessories", "bedroom accessories Kampala"],
    metaTitle: "Intimate Accessories | PleasureZone Uganda",
    metaDescription: "Shop intimate accessories with fast, discreet delivery in Uganda. Quality products, secure checkout & plain packaging. Browse our collection.",
  },
};

/** Content pillars for blog strategy */
export const CONTENT_PILLARS = [
  {
    pillar: "Product Guides",
    description: "Buying guides and product comparisons",
    targetKeywords: ["how to choose", "best", "guide", "vs", "review"],
    frequency: "2x/month",
  },
  {
    pillar: "Wellness Education",
    description: "Sexual health and wellness information",
    targetKeywords: ["sexual health", "wellness tips", "intimacy", "self-care"],
    frequency: "2x/month",
  },
  {
    pillar: "Relationship Tips",
    description: "Communication, intimacy building",
    targetKeywords: ["couples", "relationship", "intimacy tips", "communication"],
    frequency: "1x/month",
  },
  {
    pillar: "Local Content",
    description: "Uganda-specific content for local SEO",
    targetKeywords: ["Uganda", "Kampala", "East Africa", "delivery"],
    frequency: "1x/month",
  },
];

/** Generate dynamic meta description for a category */
export function getCategoryMeta(categorySlug: string, categoryName: string) {
  const config = CATEGORY_KEYWORDS[categorySlug];
  if (config) {
    return { title: config.metaTitle, description: config.metaDescription };
  }
  return {
    title: `${categoryName} - Shop Online | ${SITE_NAME}`,
    description: `Browse ${categoryName} at PleasureZone Uganda. Quality products with fast, discreet delivery across Uganda. Secure checkout & plain packaging.`,
  };
}

/** Generate keyword-rich product meta */
export function getProductMeta(productName: string, categoryName?: string) {
  const categoryPart = categoryName ? ` - ${categoryName}` : "";
  return {
    title: `${productName}${categoryPart} | ${SITE_NAME}`,
    description: `Buy ${productName} online at PleasureZone Uganda.${categoryName ? ` Best ${categoryName} with` : " Fast"} discreet delivery & secure checkout.`,
  };
}

/** Blog post SEO title template */
export function getBlogMeta(title: string, excerpt?: string) {
  return {
    title: `${title} | ${SITE_NAME} Blog`,
    description: excerpt
      ? `${excerpt.slice(0, 130)} Read more on PleasureZone Blog.`.slice(0, 160)
      : `Read ${title} on PleasureZone Blog. Tips, guides & product reviews.`,
  };
}
