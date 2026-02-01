import Link from "next/link";
import { ArrowRight } from "lucide-react";

export default function Hero() {
  return (
    <section className="bg-gradient-to-br from-gray-50 to-gray-100">
      <div className="container py-16 md:py-24">
        <div className="max-w-2xl">
          <h1 className="text-4xl md:text-5xl font-bold leading-tight mb-6">
            Premium Products.<br />
            <span className="text-text-muted">Total Discretion.</span>
          </h1>
          <p className="text-lg text-text-muted mb-8">
            Shop with confidence. Plain packaging, anonymous billing,
            and secure checkout guaranteed.
          </p>
          <div className="flex flex-col sm:flex-row gap-4">
            <Link href="/category" className="btn-primary gap-2">
              Shop Now
              <ArrowRight className="w-5 h-5" />
            </Link>
            <Link href="/about" className="btn-secondary">
              Learn More
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
