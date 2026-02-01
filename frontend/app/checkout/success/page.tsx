"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import Section from "@/components/Section";
import { CheckCircle, Package, Mail, ArrowRight } from "lucide-react";

function SuccessContent() {
  const searchParams = useSearchParams();
  const orderId = searchParams.get("orderId");
  const txRef = searchParams.get("tx_ref");
  
  const [orderNumber, setOrderNumber] = useState<string | null>(null);

  useEffect(() => {
    // If coming from Flutterwave redirect, tx_ref is the order ID
    if (txRef) {
      setOrderNumber(txRef);
    } else if (orderId) {
      setOrderNumber(orderId);
    }
  }, [orderId, txRef]);

  return (
    <Section>
      <div className="max-w-lg mx-auto text-center py-12">
        {/* Success Icon */}
        <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-8">
          <CheckCircle className="w-12 h-12 text-green-600" />
        </div>

        <h1 className="text-3xl font-bold mb-4">Order Confirmed!</h1>
        
        <p className="text-gray-600 mb-8">
          Thank you for your order. We've received your payment and will begin processing your order shortly.
        </p>

        {orderNumber && (
          <div className="bg-gray-50 rounded-lg p-6 mb-8">
            <p className="text-sm text-gray-500 mb-1">Order Number</p>
            <p className="text-2xl font-mono font-bold">{orderNumber}</p>
          </div>
        )}

        {/* What's Next */}
        <div className="text-left bg-white border rounded-lg p-6 mb-8">
          <h3 className="font-semibold mb-4">What happens next?</h3>
          <div className="space-y-4">
            <div className="flex gap-4">
              <div className="w-10 h-10 bg-accent/10 rounded-full flex items-center justify-center flex-shrink-0">
                <Mail className="w-5 h-5 text-accent" />
              </div>
              <div>
                <p className="font-medium">Confirmation Email</p>
                <p className="text-sm text-gray-600">
                  You'll receive an order confirmation email shortly with your order details.
                </p>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="w-10 h-10 bg-accent/10 rounded-full flex items-center justify-center flex-shrink-0">
                <Package className="w-5 h-5 text-accent" />
              </div>
              <div>
                <p className="font-medium">Discreet Packaging</p>
                <p className="text-sm text-gray-600">
                  Your order will be carefully packed in plain, unmarked packaging for your privacy.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          {orderNumber && (
            <Link
              href={`/orders/${orderNumber}`}
              className="btn-primary inline-flex items-center justify-center gap-2"
            >
              Track Order
              <ArrowRight className="w-4 h-4" />
            </Link>
          )}
          <Link href="/" className="btn-secondary">
            Continue Shopping
          </Link>
        </div>
      </div>
    </Section>
  );
}

export default function CheckoutSuccessPage() {
  return (
    <Suspense fallback={<Section><div className="text-center py-12">Loading...</div></Section>}>
      <SuccessContent />
    </Suspense>
  );
}
