import Link from "next/link";
import { Shield, Package, CreditCard, Eye, Lock } from "lucide-react";

export default function DiscreetPackagingPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero */}
      <section className="bg-gradient-to-br from-gray-900 to-gray-800 text-white py-20">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <Lock className="w-16 h-16 mx-auto mb-6 text-green-400" />
          <h1 className="text-4xl font-bold mb-4">100% Discreet Packaging</h1>
          <p className="text-xl text-gray-300 max-w-2xl mx-auto">
            Your privacy is our priority. No one will ever know what's inside.
          </p>
        </div>
      </section>

      <div className="max-w-4xl mx-auto px-4 py-12">
        {/* Main Promise */}
        <div className="bg-green-50 border border-green-200 rounded-2xl p-8 mb-12">
          <h2 className="text-2xl font-bold text-green-800 mb-4 text-center">
            Our Privacy Promise
          </h2>
          <p className="text-green-700 text-center text-lg">
            Every order is packaged and shipped with complete discretion. 
            We take your privacy as seriously as you do.
          </p>
        </div>

        {/* Features Grid */}
        <div className="grid md:grid-cols-2 gap-6 mb-12">
          <div className="bg-white rounded-xl p-6">
            <div className="w-12 h-12 bg-accent/10 rounded-xl flex items-center justify-center mb-4">
              <Package className="w-6 h-6 text-accent" />
            </div>
            <h3 className="font-semibold text-lg mb-2">Plain Packaging</h3>
            <p className="text-gray-600">
              All orders are shipped in plain brown or white boxes with no logos, 
              product names, or any indication of the contents.
            </p>
          </div>

          <div className="bg-white rounded-xl p-6">
            <div className="w-12 h-12 bg-accent/10 rounded-xl flex items-center justify-center mb-4">
              <Eye className="w-6 h-6 text-accent" />
            </div>
            <h3 className="font-semibold text-lg mb-2">Anonymous Sender</h3>
            <p className="text-gray-600">
              The return address shows a generic company name — no mention of 
              adult products or anything that could reveal the contents.
            </p>
          </div>

          <div className="bg-white rounded-xl p-6">
            <div className="w-12 h-12 bg-accent/10 rounded-xl flex items-center justify-center mb-4">
              <CreditCard className="w-6 h-6 text-accent" />
            </div>
            <h3 className="font-semibold text-lg mb-2">Discreet Billing</h3>
            <p className="text-gray-600">
              Charges appear on your bank statement with a generic business name, 
              not as an adult store purchase.
            </p>
          </div>

          <div className="bg-white rounded-xl p-6">
            <div className="w-12 h-12 bg-accent/10 rounded-xl flex items-center justify-center mb-4">
              <Shield className="w-6 h-6 text-accent" />
            </div>
            <h3 className="font-semibold text-lg mb-2">Sealed & Secure</h3>
            <p className="text-gray-600">
              All packages are securely sealed with tamper-evident tape. 
              You'll know immediately if anyone tried to open it.
            </p>
          </div>
        </div>

        {/* Visual Example */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold mb-6 text-center">What to Expect</h2>
          
          <div className="bg-white rounded-xl p-8">
            <div className="grid md:grid-cols-3 gap-8 text-center">
              <div>
                <div className="w-32 h-24 bg-amber-100 rounded-lg mx-auto mb-4 flex items-center justify-center border-2 border-amber-200">
                  <span className="text-4xl">📦</span>
                </div>
                <h4 className="font-medium mb-2">Plain Box</h4>
                <p className="text-sm text-gray-600">
                  Unmarked cardboard box with no branding
                </p>
              </div>
              
              <div>
                <div className="w-32 h-24 bg-gray-100 rounded-lg mx-auto mb-4 flex items-center justify-center border-2 border-gray-200">
                  <div className="text-xs text-gray-400">
                    <div>From: ABC Trading</div>
                    <div>123 Business St</div>
                  </div>
                </div>
                <h4 className="font-medium mb-2">Generic Label</h4>
                <p className="text-sm text-gray-600">
                  Return address shows neutral business name
                </p>
              </div>
              
              <div>
                <div className="w-32 h-24 bg-blue-50 rounded-lg mx-auto mb-4 flex items-center justify-center border-2 border-blue-200">
                  <span className="text-4xl">🔒</span>
                </div>
                <h4 className="font-medium mb-2">Tamper-Proof</h4>
                <p className="text-sm text-gray-600">
                  Security tape ensures privacy
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold mb-6">Common Questions</h2>
          
          <div className="bg-white rounded-xl divide-y">
            <div className="p-6">
              <h4 className="font-medium mb-2">What name appears on the shipping label?</h4>
              <p className="text-gray-600">
                A generic business name like "ABC Trading" or "General Merchandise Co." — 
                nothing that indicates adult products.
              </p>
            </div>
            <div className="p-6">
              <h4 className="font-medium mb-2">What about the delivery person?</h4>
              <p className="text-gray-600">
                Couriers see only the plain package with no product information. 
                They have no way of knowing what's inside.
              </p>
            </div>
            <div className="p-6">
              <h4 className="font-medium mb-2">Can I add extra discretion?</h4>
              <p className="text-gray-600">
                Yes! During checkout, you can add delivery instructions like 
                "leave at door" or arrange pickup at a secure location.
              </p>
            </div>
            <div className="p-6">
              <h4 className="font-medium mb-2">Is pickup available?</h4>
              <p className="text-gray-600">
                Yes, you can choose pickup at designated partner locations if you 
                prefer not to have items delivered to your home.
              </p>
            </div>
          </div>
        </section>

        {/* CTA */}
        <div className="bg-accent text-white rounded-2xl p-8 text-center">
          <h3 className="text-2xl font-bold mb-4">Shop with Confidence</h3>
          <p className="text-white/80 mb-6 max-w-lg mx-auto">
            Your order will arrive in completely plain packaging. 
            Only you will know what's inside.
          </p>
          <Link
            href="/category"
            className="inline-block bg-white text-accent px-8 py-3 rounded-lg font-semibold hover:bg-gray-100 transition-colors"
          >
            Start Shopping
          </Link>
        </div>
      </div>
    </div>
  );
}
