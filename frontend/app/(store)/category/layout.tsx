import { Metadata } from "next";
import { SITE_NAME, SITE_URL, DEFAULT_OG_IMAGE } from "@/lib/seo-config";

export const metadata: Metadata = {
  title: `Shop by Category | ${SITE_NAME}`,
  description:
    "Browse all product categories at PleasureZone Uganda. Vibrators, lingerie, lubricants, couples toys & more with fast discreet delivery nationwide.",
  alternates: {
    canonical: `${SITE_URL}/category`,
  },
  openGraph: {
    title: `Shop by Category | ${SITE_NAME}`,
    description: "Browse all product categories at PleasureZone Uganda. Fast discreet delivery.",
    url: `${SITE_URL}/category`,
    siteName: SITE_NAME,
    images: [DEFAULT_OG_IMAGE],
    type: "website",
  },
};

export default function CategoryLayout({ children }: { children: React.ReactNode }) {
  return children;
}
