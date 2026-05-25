/**
 * Breadcrumb Schema Markup & Component
 * Displays breadcrumb navigation and schema for product/category pages
 * Improves SERP appearance with breadcrumb links
 */

import Link from "next/link";

interface BreadcrumbItem {
  name: string;
  url: string;
}

interface BreadcrumbProps {
  items: BreadcrumbItem[];
  className?: string;
}

export default function Breadcrumb({ items, className = "" }: BreadcrumbProps) {
  // Schema markup for breadcrumbs
  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  };

  return (
    <>
      {/* Schema Markup */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(breadcrumbSchema),
        }}
      />

      {/* Breadcrumb Navigation */}
      <nav
        aria-label="Breadcrumb"
        className={`text-sm text-gray-600 mb-4 ${className}`}
      >
        <ol className="flex items-center gap-2">
          {items.map((item, index) => (
            <li key={item.url} className="flex items-center gap-2">
              {index > 0 && <span className="text-gray-400">/</span>}
              {index === items.length - 1 ? (
                <span className="text-gray-900 font-medium">{item.name}</span>
              ) : (
                <Link
                  href={item.url}
                  className="text-pink-600 hover:text-pink-700 hover:underline"
                >
                  {item.name}
                </Link>
              )}
            </li>
          ))}
        </ol>
      </nav>
    </>
  );
}

/**
 * Helper function to generate breadcrumb items for product page
 */
export function generateProductBreadcrumbs(
  categorySlug: string,
  categoryName: string,
  productName: string,
  siteUrl: string = "https://ugsex.com"
): BreadcrumbItem[] {
  return [
    { name: "Home", url: siteUrl },
    { name: "Categories", url: `${siteUrl}/category` },
    {
      name: categoryName,
      url: `${siteUrl}/category?cat=${categorySlug}`,
    },
    { name: productName, url: "" }, // Current page, no URL
  ];
}

/**
 * Helper function to generate breadcrumb items for category page
 */
export function generateCategoryBreadcrumbs(
  categoryName: string,
  siteUrl: string = "https://ugsex.com"
): BreadcrumbItem[] {
  return [
    { name: "Home", url: siteUrl },
    { name: "Categories", url: `${siteUrl}/category` },
    { name: categoryName, url: "" }, // Current page, no URL
  ];
}

/**
 * Helper function to generate breadcrumb items for blog page
 */
export function generateBlogBreadcrumbs(
  postTitle: string,
  siteUrl: string = "https://ugsex.com"
): BreadcrumbItem[] {
  return [
    { name: "Home", url: siteUrl },
    { name: "Blog", url: `${siteUrl}/blog` },
    { name: postTitle, url: "" }, // Current page, no URL
  ];
}
