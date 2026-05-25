import type { Metadata } from "next";
import AgeGate from "@/components/AgeGate";
import PageTracker from "@/components/PageTracker";
import AffiliateTracker from "@/components/AffiliateTracker";
import ExitIntent from "@/components/ExitIntent";
import SpinWheel from "@/components/SpinWheel";
import InstallPrompt from "@/components/InstallPrompt";
import PushNotifications from "@/components/PushNotifications";
import LivePurchaseFeed from "@/components/LivePurchaseFeed";
import DailyCheckIn from "@/components/DailyCheckIn";
import ErrorBoundary from "@/components/ErrorBoundary";
import TrackingScripts from "@/components/TrackingScripts";
import AppDownloadBanner from "@/components/AppDownloadBanner";
import FloatingWhatsApp from "@/components/FloatingWhatsApp";
import DiscreetModeButton, { DiscreetModeProvider } from "@/components/DiscreetMode";
import { CountryProvider } from "@/contexts/CountryContext";
import { OrganizationSchema, WebsiteSchema } from "@/components/StructuredData";
import StoreChrome from "@/components/StoreChrome";

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
        <ErrorBoundary><ExitIntent /></ErrorBoundary>
        <ErrorBoundary><SpinWheel /></ErrorBoundary>
        <ErrorBoundary><InstallPrompt /></ErrorBoundary>
        <ErrorBoundary><PushNotifications /></ErrorBoundary>
        <ErrorBoundary><LivePurchaseFeed /></ErrorBoundary>
        <ErrorBoundary><DailyCheckIn /></ErrorBoundary>
        <ErrorBoundary><AppDownloadBanner /></ErrorBoundary>
        <ErrorBoundary><FloatingWhatsApp /></ErrorBoundary>
        <ErrorBoundary><DiscreetModeButton /></ErrorBoundary>
        <TrackingScripts />
      </div>
    </DiscreetModeProvider>
    </CountryProvider>
  );
}
