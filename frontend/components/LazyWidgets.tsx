"use client";

import dynamic from "next/dynamic";
import ErrorBoundary from "@/components/ErrorBoundary";

const ExitIntent = dynamic(() => import("@/components/ExitIntent"), { ssr: false });
const SpinWheel = dynamic(() => import("@/components/SpinWheel"), { ssr: false });
const InstallPrompt = dynamic(() => import("@/components/InstallPrompt"), { ssr: false });
const PushNotifications = dynamic(() => import("@/components/PushNotifications"), { ssr: false });
const LivePurchaseFeed = dynamic(() => import("@/components/LivePurchaseFeed"), { ssr: false });
const DailyCheckIn = dynamic(() => import("@/components/DailyCheckIn"), { ssr: false });
const AppDownloadBanner = dynamic(() => import("@/components/AppDownloadBanner"), { ssr: false });
const FloatingWhatsApp = dynamic(() => import("@/components/FloatingWhatsApp"), { ssr: false });
const CompareBar = dynamic(() => import("@/components/CompareBar"), { ssr: false });
const LiveChat = dynamic(() => import("@/components/LiveChat"), { ssr: false });
const DiscreetModeButton = dynamic(() => import("@/components/DiscreetMode").then(m => ({ default: m.default })), { ssr: false });
const CookieConsent = dynamic(() => import("@/components/CookieConsent"), { ssr: false });

export default function LazyWidgets() {
  return (
    <>
      <ErrorBoundary><ExitIntent /></ErrorBoundary>
      <ErrorBoundary><SpinWheel /></ErrorBoundary>
      <ErrorBoundary><InstallPrompt /></ErrorBoundary>
      <ErrorBoundary><PushNotifications /></ErrorBoundary>
      <ErrorBoundary><LivePurchaseFeed /></ErrorBoundary>
      <ErrorBoundary><DailyCheckIn /></ErrorBoundary>
      <ErrorBoundary><AppDownloadBanner /></ErrorBoundary>
      <ErrorBoundary><FloatingWhatsApp /></ErrorBoundary>
      <ErrorBoundary><CompareBar /></ErrorBoundary>
      <ErrorBoundary><LiveChat /></ErrorBoundary>
      <ErrorBoundary><DiscreetModeButton /></ErrorBoundary>
      <ErrorBoundary><CookieConsent /></ErrorBoundary>
    </>
  );
}
