/**
 * Organization Schema Markup
 * Adds structured data for the Organization to Google Knowledge Graph
 * Helps with brand searches and knowledge panel appearance
 */

interface OrganizationSchemaProps {
  name?: string;
  url?: string;
  logo?: string;
  description?: string;
  sameAs?: string[];
  addressCountry?: string;
  contactEmail?: string;
  supportPhone?: string;
}

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://ugsex.com";

export default function OrganizationSchema({
  name = "PleasureZone Uganda",
  url = SITE_URL,
  logo = `${SITE_URL}/logo.png`,
  description = "Uganda's premier online store for intimate wellness products. Discreet shipping, secure checkout & fast delivery nationwide.",
  sameAs = [
    "https://www.facebook.com/PleasureZoneUG",
    "https://www.instagram.com/pleasurezone_ug",
    "https://twitter.com/PleasureZoneUG",
    "https://www.tiktok.com/@pleasurezoneug",
  ],
  addressCountry = "UG",
  contactEmail = "support@ugsex.com",
  supportPhone = "+256700123456",
}: OrganizationSchemaProps) {
  const schema = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name,
    url,
    logo,
    description,
    sameAs,
    contactPoint: {
      "@type": "ContactPoint",
      contactType: "Customer Service",
      email: contactEmail,
      telephone: supportPhone,
    },
    address: {
      "@type": "PostalAddress",
      addressCountry,
    },
    // Additional organization info
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${url}/search?q={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
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
