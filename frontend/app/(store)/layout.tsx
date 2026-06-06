import type { Metadata } from "next";
import AgeGate from "@/components/AgeGate";
import PageTracker from "@/components/PageTracker";
import AffiliateTracker from "@/components/AffiliateTracker";
import ErrorBoundary from "@/components/ErrorBoundary";
import TrackingScripts from "@/components/TrackingScripts";
import { DiscreetModeProvider } from "@/components/DiscreetMode";
import { CountryProvider } from "@/contexts/CountryContext";
import { OrganizationSchema, WebsiteSchema } from "@/components/StructuredData";
import StoreChrome from "@/components/StoreChrome";
import LazyWidgets from "@/components/LazyWidgets";

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
    <CountryProvider>
    <DiscreetModeProvider>
      <div className="min-h-screen flex flex-col pb-16 lg:pb-0">
        <OrganizationSchema />
        <WebsiteSchema />
        <PageTracker />
        <AffiliateTracker />
        <AgeGate />
        <StoreChrome>
          {children}
        </StoreChrome>
        <LazyWidgets />
        <TrackingScripts />
      </div>
    </DiscreetModeProvider>
    </CountryProvider>
  );
}
