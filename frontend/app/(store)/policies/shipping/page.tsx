import Link from "next/link";
import { Truck, RotateCcw, Clock, MapPin } from "lucide-react";

export default function ShippingPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero */}
      <section className="bg-accent text-white py-16">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h1 className="text-4xl font-bold mb-4">Shipping & Returns</h1>
          <p className="text-lg text-white/80">
            Fast, discreet delivery and hassle-free returns.
          </p>
        </div>
      </section>

      <div className="max-w-4xl mx-auto px-4 py-12">
        {/* Shipping Info */}
        <section className="mb-12">
          <div className="flex items-center gap-3 mb-6">
            <Truck className="w-8 h-8 text-accent" />
            <h2 className="text-2xl font-bold">Shipping Information</h2>
          </div>

          <div className="bg-white rounded-xl p-6 space-y-6">
            <div>
              <h3 className="font-semibold text-lg mb-3">Delivery Options</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-3 px-4">Option</th>
                      <th className="text-left py-3 px-4">Coverage</th>
                      <th className="text-left py-3 px-4">Time</th>
                      <th className="text-left py-3 px-4">Cost</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    <tr>
                      <td className="py-3 px-4 font-medium">Same-Day Delivery</td>
                      <td className="py-3 px-4">Nairobi CBD & Suburbs</td>
                      <td className="py-3 px-4">3-6 hours</td>
                      <td className="py-3 px-4">KES 500</td>
                    </tr>
                    <tr>
                      <td className="py-3 px-4 font-medium">Express Delivery</td>
                      <td className="py-3 px-4">Nairobi & Environs</td>
                      <td className="py-3 px-4">24 hours</td>
                      <td className="py-3 px-4">KES 350</td>
                    </tr>
                    <tr>
                      <td className="py-3 px-4 font-medium">Standard Delivery</td>
                      <td className="py-3 px-4">Major Towns</td>
                      <td className="py-3 px-4">1-2 days</td>
                      <td className="py-3 px-4">KES 300</td>
                    </tr>
                    <tr>
                      <td className="py-3 px-4 font-medium">Countrywide</td>
                      <td className="py-3 px-4">All Areas</td>
                      <td className="py-3 px-4">2-4 days</td>
                      <td className="py-3 px-4">KES 400</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <p className="text-sm text-gray-500 mt-3">
                * Free shipping on orders over KES 5,000
              </p>
            </div>

            <div>
              <h3 className="font-semibold text-lg mb-3">Discreet Packaging</h3>
              <p className="text-gray-600">
                Your privacy is our priority. All orders are shipped in:
              </p>
              <ul className="mt-2 space-y-2 text-gray-600">
                <li className="flex items-start gap-2">
                  <span className="text-green-500 mt-1">✓</span>
                  Plain, unmarked brown or white boxes
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-500 mt-1">✓</span>
                  No product names or descriptions on the outside
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-500 mt-1">✓</span>
                  Generic sender name (no adult store branding)
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-500 mt-1">✓</span>
                  Sealed packaging to prevent tampering
                </li>
              </ul>
            </div>

            <div>
              <h3 className="font-semibold text-lg mb-3">Order Tracking</h3>
              <p className="text-gray-600">
                Once your order ships, you'll receive:
              </p>
              <ul className="mt-2 space-y-2 text-gray-600">
                <li>• SMS notification with tracking link</li>
                <li>• Email confirmation with delivery estimate</li>
                <li>• Real-time tracking in your account dashboard</li>
              </ul>
            </div>
          </div>
        </section>

        {/* Returns Info */}
        <section className="mb-12">
          <div className="flex items-center gap-3 mb-6">
            <RotateCcw className="w-8 h-8 text-accent" />
            <h2 className="text-2xl font-bold">Returns Policy</h2>
          </div>

          <div className="bg-white rounded-xl p-6 space-y-6">
            <div>
              <h3 className="font-semibold text-lg mb-3">Return Window</h3>
              <p className="text-gray-600">
                We accept returns within <strong>14 days</strong> of delivery for most items. 
                Items must be unopened, unused, and in original packaging.
              </p>
            </div>

            <div>
              <h3 className="font-semibold text-lg mb-3">Eligible for Return</h3>
              <ul className="space-y-2 text-gray-600">
                <li className="flex items-start gap-2">
                  <span className="text-green-500 mt-1">✓</span>
                  Unopened products in original sealed packaging
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-500 mt-1">✓</span>
                  Defective or damaged products (report within 48 hours)
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-500 mt-1">✓</span>
                  Wrong item received
                </li>
              </ul>
            </div>

            <div>
              <h3 className="font-semibold text-lg mb-3">Non-Returnable Items</h3>
              <p className="text-gray-600 mb-2">
                For hygiene and safety reasons, the following cannot be returned:
              </p>
              <ul className="space-y-2 text-gray-600">
                <li className="flex items-start gap-2">
                  <span className="text-red-500 mt-1">✗</span>
                  Opened intimate products (vibrators, toys, etc.)
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-red-500 mt-1">✗</span>
                  Lubricants and massage oils (opened or unsealed)
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-red-500 mt-1">✗</span>
                  Lingerie and intimate apparel (if worn or tags removed)
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-red-500 mt-1">✗</span>
                  Gift cards
                </li>
              </ul>
            </div>

            <div>
              <h3 className="font-semibold text-lg mb-3">How to Return</h3>
              <ol className="space-y-3 text-gray-600">
                <li className="flex gap-3">
                  <span className="flex-shrink-0 w-6 h-6 bg-accent text-white rounded-full flex items-center justify-center text-sm">1</span>
                  <span>Contact us via email or WhatsApp with your order number</span>
                </li>
                <li className="flex gap-3">
                  <span className="flex-shrink-0 w-6 h-6 bg-accent text-white rounded-full flex items-center justify-center text-sm">2</span>
                  <span>Receive return authorization and shipping label</span>
                </li>
                <li className="flex gap-3">
                  <span className="flex-shrink-0 w-6 h-6 bg-accent text-white rounded-full flex items-center justify-center text-sm">3</span>
                  <span>Pack item securely and drop off at designated courier</span>
                </li>
                <li className="flex gap-3">
                  <span className="flex-shrink-0 w-6 h-6 bg-accent text-white rounded-full flex items-center justify-center text-sm">4</span>
                  <span>Refund processed within 3-5 business days after inspection</span>
                </li>
              </ol>
            </div>

            <div>
              <h3 className="font-semibold text-lg mb-3">Refund Methods</h3>
              <p className="text-gray-600">
                Refunds are processed to your original payment method:
              </p>
              <ul className="mt-2 space-y-1 text-gray-600">
                <li>• M-Pesa: 1-2 business days</li>
                <li>• Card payments: 5-7 business days</li>
                <li>• Store credit: Immediate</li>
              </ul>
            </div>
          </div>
        </section>

        {/* Contact CTA */}
        <div className="bg-accent/5 border border-accent/20 rounded-xl p-8 text-center">
          <h3 className="text-xl font-semibold mb-2">Need Help?</h3>
          <p className="text-gray-600 mb-6">
            Questions about shipping or returns? We're here to help.
          </p>
          <Link href="/contact" className="btn-primary">
            Contact Support
          </Link>
        </div>
      </div>
    </div>
  );
}
