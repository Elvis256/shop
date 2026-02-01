import Link from "next/link";
import { Shield, Lock, Truck, CreditCard } from "lucide-react";

export default function Footer() {
  return (
    <footer className="border-t border-border mt-16 bg-gray-50">
      <div className="container py-12">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          {/* Shop */}
          <div>
            <h4 className="font-semibold mb-4">Shop</h4>
            <nav className="space-y-2 text-small text-text-muted">
              <Link href="/category" className="block hover:text-accent">All Products</Link>
              <Link href="/category?cat=toys" className="block hover:text-accent">Toys</Link>
              <Link href="/category?cat=lingerie" className="block hover:text-accent">Lingerie</Link>
              <Link href="/category?cat=wellness" className="block hover:text-accent">Wellness</Link>
              <Link href="/category?cat=accessories" className="block hover:text-accent">Accessories</Link>
            </nav>
          </div>

          {/* Help */}
          <div>
            <h4 className="font-semibold mb-4">Help</h4>
            <nav className="space-y-2 text-small text-text-muted">
              <Link href="/help/shipping" className="block hover:text-accent">Shipping Info</Link>
              <Link href="/help/returns" className="block hover:text-accent">Returns</Link>
              <Link href="/help/faq" className="block hover:text-accent">FAQ</Link>
              <Link href="/help/contact" className="block hover:text-accent">Contact Us</Link>
            </nav>
          </div>

          {/* Legal */}
          <div>
            <h4 className="font-semibold mb-4">Legal</h4>
            <nav className="space-y-2 text-small text-text-muted">
              <Link href="/privacy" className="block hover:text-accent">Privacy Policy</Link>
              <Link href="/terms" className="block hover:text-accent">Terms of Service</Link>
              <Link href="/age-policy" className="block hover:text-accent">Age Verification</Link>
            </nav>
          </div>

          {/* Trust */}
          <div>
            <h4 className="font-semibold mb-4">Your Privacy Matters</h4>
            <div className="space-y-3 text-small text-text-muted">
              <div className="flex items-center gap-2">
                <Lock className="w-4 h-4" />
                <span>Secure Checkout</span>
              </div>
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4" />
                <span>Discreet Packaging</span>
              </div>
              <div className="flex items-center gap-2">
                <Truck className="w-4 h-4" />
                <span>Plain Shipping</span>
              </div>
              <div className="flex items-center gap-2">
                <CreditCard className="w-4 h-4" />
                <span>Anonymous Billing</span>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom */}
        <div className="mt-12 pt-8 border-t border-border flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-small text-text-muted">
            © 2024 AdultStore. All rights reserved. 18+ Only.
          </p>
          <div className="flex items-center gap-4 text-text-muted">
            <span className="text-small">We accept:</span>
            <div className="flex gap-2">
              <span className="badge">M-Pesa</span>
              <span className="badge">Airtel</span>
              <span className="badge">Visa</span>
              <span className="badge">Mastercard</span>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
