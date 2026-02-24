import "./globals.css";
import type { Metadata } from "next";
import { Suspense } from "react";
import LoadingBar from "@/components/LoadingBar";
import { AuthProvider } from "@/lib/hooks/useAuth";
import { CartProvider } from "@/lib/hooks/useCart";
import { ToastProvider } from "@/lib/hooks/useToast";
import { WishlistProvider } from "@/lib/hooks/useWishlist";
import { ThemeProvider } from "@/lib/hooks/useTheme";
import { CurrencyProvider } from "@/contexts/CurrencyContext";
import { GoogleAnalytics } from "@/components/GoogleAnalytics";
import { ServiceWorkerRegistration } from "@/components/ServiceWorker";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://pleasurezone.ug";

export const metadata: Metadata = {
  title: {
    default: "PleasureZone - Premium Wellness Products",
    template: "%s | PleasureZone",
  },
  description: "Shop premium wellness products with discreet shipping and secure checkout. Anonymous billing, plain packaging guaranteed.",
  keywords: ["wellness products", "discreet shipping", "adult store", "Uganda", "Kenya", "East Africa"],
  authors: [{ name: "PleasureZone" }],
  creator: "PleasureZone",
  metadataBase: new URL(SITE_URL),
  openGraph: {
    type: "website",
    locale: "en_US",
    url: SITE_URL,
    siteName: "PleasureZone",
    title: "PleasureZone - Premium Wellness Products",
    description: "Shop premium wellness products with discreet shipping and secure checkout.",
    images: [
      {
        url: `${SITE_URL}/og-image.png`,
        width: 1200,
        height: 630,
        alt: "PleasureZone",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "PleasureZone - Premium Wellness Products",
    description: "Shop premium wellness products with discreet shipping and secure checkout.",
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
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="icon" href="/favicon-32x32.png" type="image/png" sizes="32x32" />
        <link rel="icon" href="/favicon-16x16.png" type="image/png" sizes="16x16" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#0071e3" />
      </head>
      <body className="min-h-screen flex flex-col bg-bg text-text transition-colors" suppressHydrationWarning>
        <GoogleAnalytics />
        <ServiceWorkerRegistration />
        <ThemeProvider>
        <ToastProvider>
          <AuthProvider>
            <CurrencyProvider>
              <WishlistProvider>
                <CartProvider>
                  <Suspense fallback={null}>
                    <LoadingBar />
                  </Suspense>
                  {children}
                </CartProvider>
              </WishlistProvider>
            </CurrencyProvider>
          </AuthProvider>
        </ToastProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
