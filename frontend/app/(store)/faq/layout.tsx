import { Metadata } from "next";
import { SITE_NAME } from "@/lib/seo-config";

export const metadata: Metadata = {
  title: `FAQ - Shipping, Payments & Privacy | ${SITE_NAME}`,
  description:
    "Frequently asked questions about PleasureZone Uganda. Learn about discreet shipping, payment methods, returns policy, and privacy guarantees.",
  openGraph: {
    title: `FAQ | ${SITE_NAME}`,
    description: "Answers about shipping, payments, returns & privacy at PleasureZone Uganda.",
    type: "website",
  },
};

export default function FAQLayout({ children }: { children: React.ReactNode }) {
  return children;
}
