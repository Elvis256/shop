import type { Metadata } from "next";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import AgeGate from "@/components/AgeGate";
import CartDrawer from "@/components/CartDrawer";
import MobileNav from "@/components/MobileNav";
import PageTracker from "@/components/PageTracker";
import AffiliateTracker from "@/components/AffiliateTracker";
import { OrganizationSchema, WebsiteSchema } from "@/components/StructuredData";

export const metadata: Metadata = {
  title: {
    default: "Shop Premium Wellness Products",
    template: "%s | PleasureZone",
  },
  description:
    "Browse premium wellness products with discreet packaging, fast delivery, and secure checkout. Same-day delivery in Kampala.",
  openGraph: {
    type: "website",
    title: "PleasureZone — Premium Wellness Products",
    description:
      "Browse premium wellness products with discreet packaging, fast delivery, and secure checkout.",
  },
};

export default function StoreLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col pb-16 lg:pb-0">
      <OrganizationSchema />
      <WebsiteSchema />
      <PageTracker />
      <AffiliateTracker />
      <AgeGate />
      <Header />
      <main className="flex-1">{children}</main>
      <Footer />
      <CartDrawer />
      <MobileNav />
    </div>
  );
}
