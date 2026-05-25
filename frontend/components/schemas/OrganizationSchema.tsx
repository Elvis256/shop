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

export default function OrganizationSchema({
  name = "PleasureZone",
  url = "https://ugsex.com",
  logo = "https://ugsex.com/logo.png",
  description = "Premium wellness products with discreet shipping and secure checkout",
  sameAs = [
    "https://facebook.com/pleasurezone",
    "https://instagram.com/pleasurezone",
    "https://twitter.com/pleasurezone",
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
