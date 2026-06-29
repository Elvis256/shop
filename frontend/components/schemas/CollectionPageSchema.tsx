const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://ugsex.com";

interface CollectionPageSchemaProps {
  name: string;
  slug: string;
  description?: string;
  productCount?: number;
}

export default function CollectionPageSchema({
  name,
  slug,
  description,
  productCount,
}: CollectionPageSchemaProps) {
  const schema = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name,
    description:
      description ||
      `Browse ${name} at PleasureZone Uganda. Quality products with fast, discreet delivery.`,
    url: `${SITE_URL}/category/${slug}`,
    isPartOf: {
      "@type": "WebSite",
      name: "PleasureZone Uganda",
      url: SITE_URL,
    },
    ...(productCount && {
      numberOfItems: productCount,
    }),
    breadcrumb: {
      "@type": "BreadcrumbList",
      itemListElement: [
        {
          "@type": "ListItem",
          position: 1,
          name: "Home",
          item: SITE_URL,
        },
        {
          "@type": "ListItem",
          position: 2,
          name: "Shop",
          item: `${SITE_URL}/category`,
        },
        {
          "@type": "ListItem",
          position: 3,
          name,
          item: `${SITE_URL}/category/${slug}`,
        },
      ],
    },
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}
