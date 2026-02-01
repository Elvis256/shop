import "./globals.css";
import type { Metadata } from "next";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import AgeGate from "@/components/AgeGate";
import CartDrawer from "@/components/CartDrawer";
import MobileNav from "@/components/MobileNav";
import { AuthProvider } from "@/lib/hooks/useAuth";
import { CartProvider } from "@/lib/hooks/useCart";
import { ToastProvider } from "@/lib/hooks/useToast";

export const metadata: Metadata = {
  title: "Adult Store - Premium Products",
  description: "Shop premium adult products with discreet shipping and secure checkout.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen flex flex-col pb-16 lg:pb-0">
        <ToastProvider>
          <AuthProvider>
            <CartProvider>
              <AgeGate />
              <Header />
              <main className="flex-1">{children}</main>
              <Footer />
              <CartDrawer />
              <MobileNav />
            </CartProvider>
          </AuthProvider>
        </ToastProvider>
      </body>
    </html>
  );
}
