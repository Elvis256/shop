/**
 * Enhanced Product Schema Markup
 * Includes pricing, currency, reviews, availability, and more
 * Better support for rich snippets and product comparison
 */

interface ProductOffer {
  priceCurrency: string;
  price: number | string;
  availability?: "InStock" | "OutOfStock" | "PreOrder";
  url?: string;
  priceValidUntil?: string;
}

interface ProductSchemaProps {
  name: string;
  description: string;
  image?: string;
  sku?: string;
  brand?: string;
  offers: ProductOffer;
  reviewCount?: number;
  ratingValue?: number;
  productUrl?: string;
  category?: string;
  manufacturer?: string;
  weight?: string;
  depth?: string;
  height?: string;
  width?: string;
}

export default function ProductSchema({
  name,
  description,
  image,
  sku,
  brand = "PleasureZone",
  offers,
  reviewCount,
  ratingValue,
  productUrl = "https://ugsex.com",
  category,
  manufacturer,
  weight,
  depth,
  height,
  width,
}: ProductSchemaProps) {
  const schema: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Product",
    name,
    description,
    ...(image && { image }),
    ...(sku && { sku }),
    brand: {
      "@type": "Brand",
      name: brand,
    },
    ...(category && { category }),
    ...(manufacturer && { manufacturer }),
    // Dimensions
    ...(weight && { weight }),
    ...(depth || height || width) && {
      dimensions: {
        "@type": "QuantitativeValue",
        ...(depth && { depth }),
        ...(height && { height }),
        ...(width && { width }),
      },
    },
    // Pricing and availability
    offers: {
      "@type": "Offer",
      url: productUrl,
      priceCurrency: offers.priceCurrency || "UGX",
      price: offers.price.toString(),
      availability:
        offers.availability === "InStock"
          ? "https://schema.org/InStock"
          : offers.availability === "PreOrder"
            ? "https://schema.org/PreOrder"
            : "https://schema.org/OutOfStock",
      seller: {
        "@type": "Organization",
        name: brand,
      },
      ...(offers.priceValidUntil && { priceValidUntil: offers.priceValidUntil }),
    },
  };

  // Add reviews if available
  if (ratingValue && reviewCount && reviewCount > 0) {
    schema.aggregateRating = {
      "@type": "AggregateRating",
      ratingValue: ratingValue.toString(),
      reviewCount: reviewCount.toString(),
      bestRating: "5",
      worstRating: "1",
    };
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(schema),
      }}
    />
  );
}

/**
 * Review Schema Markup
 * Add individual review structured data
 */

interface ReviewSchemaProps {
  authorName: string;
  reviewText: string;
  rating: number;
  publishedDate: string;
  productName: string;
  productUrl?: string;
}

export function ReviewSchema({
  authorName,
  reviewText,
  rating,
  publishedDate,
  productName,
  productUrl = "https://ugsex.com",
}: ReviewSchemaProps) {
  const schema = {
    "@context": "https://schema.org",
    "@type": "Review",
    author: {
      "@type": "Person",
      name: authorName,
    },
    reviewRating: {
      "@type": "Rating",
      ratingValue: rating.toString(),
      bestRating: "5",
      worstRating: "1",
    },
    reviewBody: reviewText,
    datePublished: publishedDate,
    itemReviewed: {
      "@type": "Product",
      name: productName,
      url: productUrl,
    },
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(schema),
      }}
    />
  );
}
