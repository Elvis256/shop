"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import Section from "@/components/Section";
import { CheckCircle, XCircle, Loader2 } from "lucide-react";
import Link from "next/link";
import { useCart } from "@/lib/hooks/useCart";
import { useAuth } from "@/lib/hooks/useAuth";

const API_URL = typeof window !== "undefined" ? "" : (process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000");

function ConfirmContent() {
  const searchParams = useSearchParams();
  const orderId = searchParams.get("orderId");
  const [status, setStatus] = useState<"loading" | "success" | "failed" | "pending">("loading");
  const { clearCart } = useCart();
  const { user } = useAuth();
  const clearCartRef = useRef(clearCart);
  clearCartRef.current = clearCart;

  useEffect(() => {
    if (!orderId) {
      setStatus("failed");
      return;
    }

    let attempts = 0;
    const maxAttempts = 30;
    let timeoutId: ReturnType<typeof setTimeout>;
    let cancelled = false;

    const checkStatus = async () => {
      try {
        // For guest checkouts, pass stored checkout email/phone for verification
        // (payment-status endpoint requires these to prevent IDOR)
        let verifyParams = "";
        if (!user) {
          try {
            const savedEmail = sessionStorage.getItem("checkout_email");
            const savedPhone = sessionStorage.getItem("checkout_phone");
            if (savedEmail) verifyParams += `?email=${encodeURIComponent(savedEmail)}`;
            else if (savedPhone) verifyParams += `?phone=${encodeURIComponent(savedPhone)}`;
          } catch {}
        }
        const res = await fetch(`${API_URL}/api/orders/${orderId}/payment-status${verifyParams}`, { credentials: "include" });
        const data = await res.json();

        if (cancelled) return;

        if (data.paymentStatus === "SUCCESSFUL" || data.status === "CONFIRMED") {
          setStatus("success");
          clearCartRef.current();
          return;
        }
        if (data.paymentStatus === "FAILED" || data.status === "CANCELLED") {
          setStatus("failed");
          return;
        }

        attempts++;
        if (attempts < maxAttempts && !cancelled) {
          timeoutId = setTimeout(checkStatus, 3000);
        } else {
          setStatus("pending");
        }
      } catch {
        attempts++;
        if (attempts < maxAttempts && !cancelled) {
          timeoutId = setTimeout(checkStatus, 3000);
        } else {
          setStatus("pending");
        }
      }
    };

    checkStatus();

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, [orderId]);

  if (status === "loading" || status === "pending") {
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
          <p className="font-mono font-semibold">{orderId}</p>
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

export default function CheckoutConfirmPage() {
  return (
    <Suspense fallback={
      <Section>
        <div className="max-w-md mx-auto text-center py-16">
          <Loader2 className="w-16 h-16 mx-auto mb-6 text-accent animate-spin" />
          <h2 className="mb-4">Loading...</h2>
        </div>
      </Section>
    }>
      <ConfirmContent />
    </Suspense>
  );
}
