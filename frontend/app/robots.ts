import { MetadataRoute } from "next";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://ugsex.com";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/admin/",
          "/api/",
          "/auth/",
          "/checkout/",
          "/account/",
          "/cart",
          "/wishlist",
          "/compare",
        ],
      },
      {
        userAgent: "Googlebot",
        allow: "/",
        disallow: ["/admin/", "/api/", "/auth/", "/checkout/", "/account/"],
      },
      // AI search engine crawlers — allow full access to public content
      {
        userAgent: "GPTBot",
        allow: ["/", "/llms.txt", "/llms-full.txt"],
        disallow: ["/admin/", "/api/", "/auth/", "/checkout/", "/account/", "/cart", "/wishlist"],
      },
      {
        userAgent: "ChatGPT-User",
        allow: ["/", "/llms.txt", "/llms-full.txt"],
        disallow: ["/admin/", "/api/", "/auth/", "/checkout/", "/account/", "/cart", "/wishlist"],
      },
      {
        userAgent: "Claude-Web",
        allow: ["/", "/llms.txt", "/llms-full.txt"],
        disallow: ["/admin/", "/api/", "/auth/", "/checkout/", "/account/", "/cart", "/wishlist"],
      },
      {
        userAgent: "Applebot",
        allow: ["/", "/llms.txt", "/llms-full.txt"],
        disallow: ["/admin/", "/api/", "/auth/", "/checkout/", "/account/"],
      },
      {
        userAgent: "PerplexityBot",
        allow: ["/", "/llms.txt", "/llms-full.txt"],
        disallow: ["/admin/", "/api/", "/auth/", "/checkout/", "/account/", "/cart", "/wishlist"],
      },
      // Bing/Copilot
      {
        userAgent: "Bingbot",
        allow: "/",
        disallow: ["/admin/", "/api/", "/auth/", "/checkout/", "/account/"],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
