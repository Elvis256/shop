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
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
