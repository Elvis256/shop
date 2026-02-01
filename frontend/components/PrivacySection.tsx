import { Lock, Package, EyeOff, Shield } from "lucide-react";

export default function PrivacySection() {
  return (
    <section className="bg-accent text-white py-16">
      <div className="container">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <h2 className="text-white mb-4">Your Privacy is Our Priority</h2>
          <p className="text-gray-300">
            We understand the importance of discretion. Every order is handled with
            the utmost care to protect your privacy.
          </p>
        </div>

        <div className="grid md:grid-cols-4 gap-8">
          <div className="text-center">
            <Package className="w-10 h-10 mx-auto mb-4 text-gray-300" />
            <h4 className="font-semibold mb-2 text-white">Plain Packaging</h4>
            <p className="text-small text-gray-400">
              Unmarked boxes with no indication of contents.
            </p>
          </div>

          <div className="text-center">
            <EyeOff className="w-10 h-10 mx-auto mb-4 text-gray-300" />
            <h4 className="font-semibold mb-2 text-white">Anonymous Billing</h4>
            <p className="text-small text-gray-400">
              Neutral name on bank statements.
            </p>
          </div>

          <div className="text-center">
            <Lock className="w-10 h-10 mx-auto mb-4 text-gray-300" />
            <h4 className="font-semibold mb-2 text-white">Secure Checkout</h4>
            <p className="text-small text-gray-400">
              256-bit encryption protects your data.
            </p>
          </div>

          <div className="text-center">
            <Shield className="w-10 h-10 mx-auto mb-4 text-gray-300" />
            <h4 className="font-semibold mb-2 text-white">No Data Selling</h4>
            <p className="text-small text-gray-400">
              We never share your information.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
