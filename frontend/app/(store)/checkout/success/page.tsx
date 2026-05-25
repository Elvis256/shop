"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import Section from "@/components/Section";
import { CheckCircle, Package, Mail, ArrowRight, Loader2, MessageCircle } from "lucide-react";
import { apiFetch } from "@/lib/api";

function SuccessContent() {
  const searchParams = useSearchParams();
  const orderId = searchParams.get("orderId");
  const txRef = searchParams.get("tx_ref");

  const [orderData, setOrderData] = useState<{ id: string; orderNumber: string } | null>(null);
  const [resolving, setResolving] = useState(false);

  useEffect(() => {
    if (orderId) {
      // Direct order ID — fetch to get the order number for display
      setResolving(true);
      apiFetch(`/api/orders/${orderId}`)
        .then((d: any) => setOrderData({ id: d.id, orderNumber: d.orderNumber }))
        .catch(() => setOrderData({ id: orderId, orderNumber: orderId }))
        .finally(() => setResolving(false));
    } else if (txRef) {
      // Flutterwave redirect — resolve tx_ref to internal order
      setResolving(true);
      apiFetch(`/api/orders/by-ref/${txRef}`)
        .then((d: any) => setOrderData({ id: d.id, orderNumber: d.orderNumber }))
        .catch(() => setOrderData({ id: txRef, orderNumber: txRef }))
        .finally(() => setResolving(false));
    }
  }, [orderId, txRef]);

  return (
    <Section>
      <div className="max-w-lg mx-auto text-center py-12">
        {/* Success Icon */}
        <div className="w-24 h-24 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-8 ring-8 ring-green-50 dark:ring-green-900/10">
          <CheckCircle className="w-12 h-12 text-green-600 dark:text-green-400" />
        </div>

        <h1 className="text-3xl font-bold mb-3 text-text">Order Confirmed!</h1>
        <p className="text-text-muted mb-8 leading-relaxed">
          Thank you for your order. We&apos;ve received your payment and will begin processing shortly.
          You&apos;ll receive a WhatsApp confirmation within a few minutes.
        </p>

        {/* Order Number Card */}
        {resolving ? (
          <div className="bg-surface-secondary border border-border rounded-2xl p-6 mb-8 flex items-center justify-center gap-3">
            <Loader2 className="w-5 h-5 animate-spin text-primary" />
            <span className="text-text-muted text-sm">Loading order details...</span>
          </div>
        ) : orderData ? (
          <div className="bg-surface-secondary border border-border rounded-2xl p-6 mb-8">
            <p className="text-sm text-text-muted mb-2">Order Number</p>
            <p className="text-xl font-mono font-bold text-text tracking-wider">
              #{orderData.orderNumber.split("-").slice(-1)[0]}
            </p>
            <p className="text-xs text-text-muted mt-1 font-mono">{orderData.orderNumber}</p>
          </div>
        ) : null}

        {/* What's Next */}
        <div className="text-left bg-surface border border-border rounded-2xl p-6 mb-8 space-y-5">
          <h3 className="font-semibold text-text">What happens next?</h3>
          {[
            {
              icon: MessageCircle,
              title: "WhatsApp Confirmation",
              desc: "You'll receive an order confirmation on WhatsApp with your order details and tracking updates.",
              color: "bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400",
            },
            {
              icon: Mail,
              title: "Email Receipt",
              desc: "A receipt will be sent to your email address shortly.",
              color: "bg-accent/10 text-accent",
            },
            {
              icon: Package,
              title: "Discreet Packaging",
              desc: "Your order will be packed in plain, unmarked packaging with no logos or product names visible.",
              color: "bg-primary/10 text-primary",
            },
          ].map(({ icon: Icon, title, desc, color }) => (
            <div key={title} className="flex gap-4">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${color}`}>
                <Icon className="w-5 h-5" />
              </div>
              <div>
                <p className="font-medium text-text">{title}</p>
                <p className="text-sm text-text-muted mt-0.5">{desc}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          {orderData && (
            <Link
              href={`/orders/${orderData.id}`}
              className="btn-primary inline-flex items-center justify-center gap-2"
            >
              Track Your Order
              <ArrowRight className="w-4 h-4" />
            </Link>
          )}
          <Link href="/" className="btn-secondary inline-flex items-center justify-center">
            Continue Shopping
          </Link>
        </div>
      </div>
    </Section>
  );
}

export default function CheckoutSuccessPage() {
  return (
    <Suspense fallback={
      <Section>
        <div className="max-w-lg mx-auto text-center py-20">
          <Loader2 className="w-10 h-10 animate-spin mx-auto text-primary" />
        </div>
      </Section>
    }>
      <SuccessContent />
    </Suspense>
  );
}
