"use client";

/**
 * StoreChrome — wraps the store layout chrome (header, footer, nav).
 * On /checkout routes the header/footer/mobile-nav are hidden so the
 * checkout layout can render its own minimal CheckoutHeader instead.
 */

import { usePathname } from "next/navigation";
import dynamic from "next/dynamic";
import ErrorBoundary from "@/components/ErrorBoundary";
import CheckoutHeader from "@/components/CheckoutHeader";

// Lazy-load heavy layout components to avoid SSR cost on checkout
const AnnouncementBar = dynamic(() => import("@/components/AnnouncementBar"), { ssr: false });
const Header = dynamic(() => import("@/components/Header"), { ssr: true });
const Footer = dynamic(() => import("@/components/Footer"), { ssr: true });
const CartDrawer = dynamic(() => import("@/components/CartDrawer"), { ssr: false });
const MobileNav = dynamic(() => import("@/components/MobileNav"), { ssr: false });

export default function StoreChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isCheckout = pathname.startsWith("/checkout");

  return (
    <>
      {isCheckout ? (
        <CheckoutHeader />
      ) : (
        <>
          <ErrorBoundary><AnnouncementBar /></ErrorBoundary>
          <ErrorBoundary><Header /></ErrorBoundary>
        </>
      )}

      <main id="main-content" className="flex-1">{children}</main>

      {!isCheckout && (
        <>
          <ErrorBoundary><Footer /></ErrorBoundary>
          <ErrorBoundary><MobileNav /></ErrorBoundary>
        </>
      )}

      {/* CartDrawer available on all pages (checkout uses it too) */}
      <ErrorBoundary><CartDrawer /></ErrorBoundary>
    </>
  );
}
