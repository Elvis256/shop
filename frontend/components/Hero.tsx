import Link from "next/link";
import { ArrowRight, Shield, Package, Lock } from "lucide-react";

export default function Hero() {
  return (
    <section className="bg-surface-secondary overflow-hidden">
      <div className="container py-20 md:py-32 lg:py-40">
        <div className="max-w-3xl mx-auto text-center animate-fade-up">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-surface shadow-soft mb-8">
            <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
            <span className="text-sm text-text-muted">Free discreet shipping on orders over USh 100,000 in Kampala</span>
          </div>

          {/* Headline */}
          <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-semibold tracking-tighter leading-[1.1] mb-6">
            Premium wellness.
            <br />
            <span className="text-text-muted">Complete privacy.</span>
          </h1>

          {/* Subtitle */}
          <p className="text-lg sm:text-xl text-text-muted max-w-xl mx-auto mb-10">
            Discover our curated collection with discreet packaging, 
            anonymous billing, and secure checkout.
          </p>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
            <Link href="/category" className="btn-primary text-base px-8 py-4">
              Shop Collection
              <ArrowRight className="w-5 h-5" />
            </Link>
            <Link href="/category?cat=bestsellers" className="btn-secondary text-base px-8 py-4">
              View Bestsellers
            </Link>
          </div>

          {/* Trust indicators */}
          <div className="flex flex-wrap items-center justify-center gap-8 text-text-muted">
            <div className="flex items-center gap-2">
              <Package className="w-5 h-5" />
              <span className="text-sm">Plain Packaging</span>
            </div>
            <div className="flex items-center gap-2">
              <Shield className="w-5 h-5" />
              <span className="text-sm">Anonymous Billing</span>
            </div>
            <div className="flex items-center gap-2">
              <Lock className="w-5 h-5" />
              <span className="text-sm">Secure Checkout</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
