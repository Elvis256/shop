/**
 * Article/BlogPosting Schema Markup
 * Adds structured data for blog posts
 * Enables rich snippets, eligible for featured snippets, Google News
 */

interface BlogPostSchemaProps {
  title: string;
  description: string;
  image: string;
  publishedAt: string;
  updatedAt?: string;
  author?: {
    name: string;
    url?: string;
  };
  content?: string;
  siteUrl?: string;
  postUrl?: string;
  isNews?: boolean; // Use NewsArticle instead of BlogPosting
}

export default function ArticleSchema({
  title,
  description,
  image,
  publishedAt,
  updatedAt,
  author = { name: "PleasureZone" },
  content,
  siteUrl = "https://ugsex.com",
  postUrl,
  isNews = false,
}: BlogPostSchemaProps) {
  const schema = {
    "@context": "https://schema.org",
    "@type": isNews ? "NewsArticle" : "BlogPosting",
    headline: title,
    description,
    image,
    datePublished: publishedAt,
    dateModified: updatedAt || publishedAt,
    author: {
      "@type": "Person",
      name: author.name,
      ...(author.url && { url: author.url }),
    },
    publisher: {
      "@type": "Organization",
      name: "PleasureZone",
      logo: {
        "@type": "ImageObject",
        url: `${siteUrl}/logo.png`,
        width: 200,
        height: 50,
      },
    },
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": postUrl || siteUrl,
    },
    // Include full article body for better indexing
    ...(content && { articleBody: content }),
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

/**
 * FAQ Schema Markup
 * Use for FAQ pages to enable FAQ rich snippets
 */

interface FAQItem {
  question: string;
  answer: string;
}

interface FAQSchemaProps {
  faqs: FAQItem[];
}

export function FAQSchema({ faqs }: FAQSchemaProps) {
  const schema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: faq.answer,
      },
    })),
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
