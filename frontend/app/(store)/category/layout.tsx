import { Metadata } from "next";
import { SITE_NAME } from "@/lib/seo-config";

export const metadata: Metadata = {
  title: `Shop by Category | ${SITE_NAME}`,
  description:
    "Browse all product categories at PleasureZone Uganda. Vibrators, lingerie, lubricants, couples toys & more with fast discreet delivery nationwide.",
  openGraph: {
    title: `Shop by Category | ${SITE_NAME}`,
    description: "Browse all product categories at PleasureZone Uganda. Fast discreet delivery.",
    type: "website",
  },
};

export default function CategoryLayout({ children }: { children: React.ReactNode }) {
  return children;
}
