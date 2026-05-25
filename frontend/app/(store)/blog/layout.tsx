import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Blog - Tips, Guides & Reviews | PleasureZone Uganda",
  description:
    "Explore our blog for product reviews, buying guides, and wellness tips. PleasureZone Uganda's expert content helps you make informed choices.",
  openGraph: {
    title: "Blog | PleasureZone Uganda",
    description: "Product reviews, guides & wellness tips from PleasureZone Uganda.",
    type: "website",
  },
};

export default function BlogLayout({ children }: { children: React.ReactNode }) {
  return children;
}
