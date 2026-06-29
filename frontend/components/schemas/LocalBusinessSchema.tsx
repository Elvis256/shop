const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://ugsex.com";

export default function LocalBusinessSchema() {
  const schema = {
    "@context": "https://schema.org",
    "@type": "Store",
    name: "PleasureZone Uganda",
    description:
      "Premium intimate wellness products with discreet delivery across Uganda. Same-day delivery in Kampala.",
    url: SITE_URL,
    logo: `${SITE_URL}/logo.png`,
    image: `${SITE_URL}/og-image.png`,
    telephone: process.env.NEXT_PUBLIC_SUPPORT_PHONE || "",
    email: process.env.NEXT_PUBLIC_SUPPORT_EMAIL || "support@ugsex.com",
    address: {
      "@type": "PostalAddress",
      addressLocality: "Kampala",
      addressCountry: "UG",
    },
    geo: {
      "@type": "GeoCoordinates",
      latitude: "0.3476",
      longitude: "32.5825",
    },
    areaServed: {
      "@type": "Country",
      name: "Uganda",
    },
    priceRange: "$$",
    currenciesAccepted: "UGX",
    paymentAccepted: "Mobile Money, Credit Card, Cash on Delivery, PayPal",
    openingHoursSpecification: {
      "@type": "OpeningHoursSpecification",
      dayOfWeek: [
        "Monday",
        "Tuesday",
        "Wednesday",
        "Thursday",
        "Friday",
        "Saturday",
        "Sunday",
      ],
      opens: "00:00",
      closes: "23:59",
    },
    sameAs: [
      "https://www.facebook.com/PleasureZoneUG",
      "https://www.instagram.com/pleasurezoneug",
      "https://twitter.com/PleasureZoneUG",
      "https://www.tiktok.com/@pleasurezoneug",
    ],
    hasOfferCatalog: {
      "@type": "OfferCatalog",
      name: "PleasureZone Products",
      itemListElement: [
        {
          "@type": "OfferCatalog",
          name: "Toys & Vibrators",
          itemListElement: [],
        },
        {
          "@type": "OfferCatalog",
          name: "Lingerie",
          itemListElement: [],
        },
        {
          "@type": "OfferCatalog",
          name: "Wellness Products",
          itemListElement: [],
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
