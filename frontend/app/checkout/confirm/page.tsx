"use client";

import { useSearchParams } from "next/navigation";
import Section from "@/components/Section";
import { CheckCircle, XCircle, Loader2 } from "lucide-react";
import Link from "next/link";

export default function CheckoutConfirmPage() {
  const searchParams = useSearchParams();
  const orderId = searchParams.get("orderId");
  const status = searchParams.get("status") || "success";

  if (status === "pending") {
    return (
      <Section>
        <div className="max-w-md mx-auto text-center py-16">
          <Loader2 className="w-16 h-16 mx-auto mb-6 text-accent animate-spin" />
          <h2 className="mb-4">Processing Payment</h2>
          <p className="text-text-muted mb-6">
            Please approve the payment on your phone. This page will update automatically.
          </p>
          <p className="text-small text-text-muted">Order ID: {orderId}</p>
        </div>
      </Section>
    );
  }

  if (status === "failed") {
    return (
      <Section>
        <div className="max-w-md mx-auto text-center py-16">
          <XCircle className="w-16 h-16 mx-auto mb-6 text-red-500" />
          <h2 className="mb-4">Payment Failed</h2>
          <p className="text-text-muted mb-6">
            Unfortunately, your payment could not be processed. Please try again.
          </p>
          <div className="space-y-4">
            <Link href="/checkout" className="btn-primary w-full">
              Try Again
            </Link>
            <Link href="/" className="btn-secondary w-full">
              Return to Shop
            </Link>
          </div>
        </div>
      </Section>
    );
  }

  return (
    <Section>
      <div className="max-w-md mx-auto text-center py-16">
        <CheckCircle className="w-16 h-16 mx-auto mb-6 text-green-500" />
        <h2 className="mb-4">Order Confirmed!</h2>
        <p className="text-text-muted mb-6">
          Thank you for your order. You will receive a confirmation email shortly.
        </p>
        <div className="card text-left mb-8">
          <p className="text-small text-text-muted">Order ID</p>
          <p className="font-mono font-semibold">{orderId || "ORD-123456"}</p>
        </div>
        <div className="space-y-4">
          <Link href={`/orders/${orderId}`} className="btn-primary w-full">
            View Order
          </Link>
          <Link href="/" className="btn-secondary w-full">
            Continue Shopping
          </Link>
        </div>
      </div>
    </Section>
  );
}
