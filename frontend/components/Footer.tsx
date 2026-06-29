import Link from "next/link";
import { Shield, Lock, Truck, Package, Smartphone, Store } from "lucide-react";
import Logo from "@/components/Logo";
import BandwidthToggle from "@/components/BandwidthToggle";

export default function Footer() {
  const currentYear = new Date().getFullYear();
  const showApk = process.env.NEXT_PUBLIC_SHOW_APK === "true";

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
              <Link href="/sales" className="block text-text-muted hover:text-text transition-colors duration-200">Sales & Deals</Link>
              <Link href="/subscription-boxes" className="block text-text-muted hover:text-text transition-colors duration-200">Subscription Boxes</Link>
              <Link href="/category?cat=toys" className="block text-text-muted hover:text-text transition-colors duration-200">Toys</Link>
              <Link href="/category?cat=lingerie" className="block text-text-muted hover:text-text transition-colors duration-200">Lingerie</Link>
              <Link href="/category?cat=wellness" className="block text-text-muted hover:text-text transition-colors duration-200">Wellness</Link>
              <Link href="/store" className="block text-text-muted hover:text-text transition-colors duration-200">Browse Stores</Link>
              <Link href="/gift-finder" className="block text-text-muted hover:text-text transition-colors duration-200">Gift Finder</Link>
              <Link href="/build-your-box" className="block text-text-muted hover:text-text transition-colors duration-200">Build Your Box</Link>
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
              <Link href="/affiliate/signup" className="block text-text-muted hover:text-text transition-colors duration-200">Affiliate Program</Link>
              <Link href="/seller/register" className="inline-flex items-center gap-1.5 text-primary hover:text-primary/80 font-medium transition-colors duration-200">
                <Store className="w-3.5 h-3.5" />
                Sell on PleasureZone
              </Link>
{showApk && (
    <a href="/shop-app.apk" download="PleasureZone.apk" className="inline-flex items-center gap-1.5 text-text-muted hover:text-text transition-colors duration-200">
      <Smartphone className="w-3.5 h-3.5" />
      Get Android App
    </a>
)}
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
            <p>© {currentYear} PleasureZone Uganda. All rights reserved. 18+ Only.</p>
            <div className="flex items-center gap-6">
              <Link href="/policies/privacy" className="hover:text-text transition-colors duration-200">Privacy</Link>
              <Link href="/policies/terms" className="hover:text-text transition-colors duration-200">Terms</Link>
              <Link href="/sitemap.xml" className="hover:text-text transition-colors duration-200">Sitemap</Link>
              <BandwidthToggle />
            </div>
            <div className="flex items-center gap-4 mt-3 sm:mt-0">
              <a href="https://twitter.com/pleasurezoneug" target="_blank" rel="noopener noreferrer" className="hover:text-text transition-colors duration-200" aria-label="Twitter">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
              </a>
              <a href="https://instagram.com/pleasurezoneug" target="_blank" rel="noopener noreferrer" className="hover:text-text transition-colors duration-200" aria-label="Instagram">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg>
              </a>
              <a href="https://wa.me/256700000000" target="_blank" rel="noopener noreferrer" className="hover:text-text transition-colors duration-200" aria-label="WhatsApp">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
              </a>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
