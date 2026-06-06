import "./globals.css";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Suspense } from "react";
import LoadingBar from "@/components/LoadingBar";
import { AuthProvider } from "@/lib/hooks/useAuth";
import { CartProvider } from "@/lib/hooks/useCart";
import { ToastProvider } from "@/lib/hooks/useToast";
import { WishlistProvider } from "@/lib/hooks/useWishlist";
import { CompareProvider } from "@/contexts/CompareContext";
import { LiteModeProvider } from "@/components/BandwidthToggle";
import { ThemeProvider } from "@/lib/hooks/useTheme";
import { CurrencyProvider } from "@/contexts/CurrencyContext";
import { LanguageProvider } from "@/lib/i18n/LanguageContext";
import { GoogleAnalytics } from "@/components/GoogleAnalytics";
import { ServiceWorkerRegistration } from "@/components/ServiceWorker";
import OrganizationSchema from "@/components/schemas/OrganizationSchema";

const inter = Inter({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  display: "swap",
  variable: "--font-inter",
});

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://ugsex.com";

export const metadata: Metadata = {
  title: {
    default: "PleasureZone Uganda - Intimate Wellness Products | Discreet Delivery",
    template: "%s | PleasureZone Uganda",
  },
  description: "Uganda's #1 online store for intimate wellness products. Shop vibrators, lingerie, lubricants & more with fast discreet delivery, plain packaging & secure checkout.",
  keywords: [
    "pleasure zone Uganda", "adult store Uganda", "buy vibrators Uganda",
    "lingerie Kampala", "discreet delivery Uganda", "intimate products online",
    "sexual wellness East Africa", "adult toys Kampala",
  ],
  authors: [{ name: "PleasureZone Uganda" }],
  creator: "PleasureZone Uganda",
  metadataBase: new URL(SITE_URL),
  openGraph: {
    type: "website",
    locale: "en_US",
    url: SITE_URL,
    siteName: "PleasureZone Uganda",
    title: "PleasureZone Uganda - Intimate Wellness Products",
    description: "Uganda's #1 online store for intimate wellness. Discreet delivery, plain packaging & secure checkout.",
    images: [
      {
        url: `${SITE_URL}/og-image.png`,
        width: 1200,
        height: 630,
        alt: "PleasureZone Uganda - Intimate Wellness Products",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "PleasureZone Uganda - Intimate Wellness Products",
    description: "Uganda's #1 online store for intimate wellness. Discreet delivery & secure checkout.",
    images: [`${SITE_URL}/og-image.png`],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  verification: {
    google: process.env.GOOGLE_SITE_VERIFICATION,
  },
  other: {
    "google-adsense-account": "ca-pub-2159433666559208",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <head>
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="icon" href="/favicon-32x32.png" type="image/png" sizes="32x32" />
        <link rel="icon" href="/favicon-16x16.png" type="image/png" sizes="16x16" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <link rel="manifest" href="/manifest.json" />
        <link rel="preconnect" href="https://www.googletagmanager.com" />
        <link rel="preconnect" href="https://res.cloudinary.com" />
        <link rel="dns-prefetch" href="https://connect.facebook.net" />
        <link rel="dns-prefetch" href="https://analytics.tiktok.com" />
        <meta name="theme-color" content="#0071e3" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
      </head>
      <body className="min-h-screen flex flex-col bg-bg text-text transition-colors" suppressHydrationWarning>
        <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-[9999] focus:bg-pink-600 focus:text-white focus:px-4 focus:py-2 focus:rounded-lg focus:text-sm">Skip to content</a>
        <GoogleAnalytics />
        <ServiceWorkerRegistration />
        <OrganizationSchema />
        <ThemeProvider>
        <LanguageProvider>
        <ToastProvider>
          <AuthProvider>
            <CurrencyProvider>
              <WishlistProvider>
                <CompareProvider>
                <LiteModeProvider>
                <CartProvider>
                  <Suspense fallback={null}>
                    <LoadingBar />
                  </Suspense>
                  {children}
                </CartProvider>
                </LiteModeProvider>
                </CompareProvider>
              </WishlistProvider>
            </CurrencyProvider>
          </AuthProvider>
        </ToastProvider>
        </LanguageProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
