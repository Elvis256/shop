import Link from "next/link";
import { Shield, Lock, Truck, Package } from "lucide-react";
import Logo from "@/components/Logo";

export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="border-t border-border mt-20 bg-surface">
      {/* Main Footer */}
      <div className="container py-16">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-10">
          {/* Brand */}
          <div className="col-span-2 md:col-span-1">
            <Logo variant="default" href="/" />
            <p className="mt-5 text-sm text-text-muted leading-relaxed">
              Premium wellness products with complete privacy and discreet delivery.
            </p>
          </div>

          {/* Shop */}
          <div>
            <h4 className="font-semibold text-text text-sm mb-5">Shop</h4>
            <nav className="space-y-3 text-sm">
              <Link href="/category" className="block text-text-muted hover:text-text transition-colors duration-200">All Products</Link>
              <Link href="/category?cat=toys" className="block text-text-muted hover:text-text transition-colors duration-200">Toys</Link>
              <Link href="/category?cat=lingerie" className="block text-text-muted hover:text-text transition-colors duration-200">Lingerie</Link>
              <Link href="/category?cat=wellness" className="block text-text-muted hover:text-text transition-colors duration-200">Wellness</Link>
            </nav>
          </div>

          {/* Help */}
          <div>
            <h4 className="font-semibold text-text text-sm mb-5">Support</h4>
            <nav className="space-y-3 text-sm">
              <Link href="/track-order" className="block text-text-muted hover:text-text transition-colors duration-200">Track Order</Link>
              <Link href="/policies/shipping" className="block text-text-muted hover:text-text transition-colors duration-200">Shipping</Link>
              <Link href="/faq" className="block text-text-muted hover:text-text transition-colors duration-200">FAQ</Link>
              <Link href="/contact" className="block text-text-muted hover:text-text transition-colors duration-200">Contact</Link>
            </nav>
          </div>

          {/* Company */}
          <div>
            <h4 className="font-semibold text-text text-sm mb-5">Company</h4>
            <nav className="space-y-3 text-sm">
              <Link href="/about" className="block text-text-muted hover:text-text transition-colors duration-200">About</Link>
              <Link href="/blog" className="block text-text-muted hover:text-text transition-colors duration-200">Blog</Link>
              <Link href="/policies/privacy" className="block text-text-muted hover:text-text transition-colors duration-200">Privacy</Link>
              <Link href="/policies/terms" className="block text-text-muted hover:text-text transition-colors duration-200">Terms</Link>
            </nav>
          </div>

          {/* Privacy Features */}
          <div>
            <h4 className="font-semibold text-text text-sm mb-5">Your Privacy</h4>
            <div className="space-y-4 text-sm">
              <div className="flex items-center gap-3 text-text-muted">
                <Lock className="w-4 h-4" />
                <span>Secure Checkout</span>
              </div>
              <div className="flex items-center gap-3 text-text-muted">
                <Package className="w-4 h-4" />
                <span>Discreet Packaging</span>
              </div>
              <div className="flex items-center gap-3 text-text-muted">
                <Truck className="w-4 h-4" />
                <span>Plain Shipping</span>
              </div>
              <div className="flex items-center gap-3 text-text-muted">
                <Shield className="w-4 h-4" />
                <span>Anonymous Billing</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Payment Methods */}
      <div className="border-t border-border">
        <div className="container py-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-sm text-text-muted">We accept:</p>
            <div className="flex items-center gap-3">
              {/* MTN MoMo */}
              <div className="flex items-center gap-1.5 px-3 py-2 bg-yellow-400 rounded-8">
                <span className="font-semibold text-xs text-black">MTN MoMo</span>
              </div>
              {/* Airtel Money */}
              <div className="flex items-center gap-1.5 px-3 py-2 bg-red-600 rounded-8">
                <span className="font-semibold text-xs text-white">Airtel Money</span>
              </div>
              {/* Visa */}
              <div className="flex items-center px-3 py-2 bg-blue-900 rounded-8">
                <span className="font-semibold text-xs text-white italic">VISA</span>
              </div>
              {/* Mastercard */}
              <div className="flex items-center gap-0.5 px-3 py-2 bg-gray-800 rounded-8">
                <div className="w-3.5 h-3.5 rounded-full bg-red-500 -mr-1" />
                <div className="w-3.5 h-3.5 rounded-full bg-yellow-500" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Copyright */}
      <div className="border-t border-border bg-surface-secondary">
        <div className="container py-5">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-text-muted">
            <p>© {currentYear} Pleasure Zone. All rights reserved. 18+ Only.</p>
            <div className="flex items-center gap-6">
              <Link href="/policies/privacy" className="hover:text-text transition-colors duration-200">Privacy</Link>
              <Link href="/policies/terms" className="hover:text-text transition-colors duration-200">Terms</Link>
              <Link href="/sitemap" className="hover:text-text transition-colors duration-200">Sitemap</Link>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
