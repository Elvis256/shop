"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import Section from "@/components/Section";
import { CheckCircle, XCircle, Loader2, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useCart } from "@/lib/hooks/useCart";
import { useAuth } from "@/lib/hooks/useAuth";

const API_URL = typeof window !== "undefined" ? "" : (process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000");

function ConfirmContent() {
  const searchParams = useSearchParams();
  const orderId = searchParams.get("orderId");
  const transactionId = searchParams.get("transaction_id");
  const flwStatus = searchParams.get("status"); // Flutterwave appends status=successful|cancelled|failed
  const [status, setStatus] = useState<"loading" | "success" | "failed" | "cancelled" | "pending">("loading");
  const [orderNumber, setOrderNumber] = useState<string | null>(null);
  const { clearCart } = useCart();
  const { user } = useAuth();
  const clearCartRef = useRef(clearCart);
  clearCartRef.current = clearCart;

  useEffect(() => {
    if (!orderId) {
      setStatus("failed");
      return;
    }

    let isCancelled = false;

    const handleSuccess = (data: any) => {
      setStatus("success");
      if (data.orderNumber) setOrderNumber(data.orderNumber);
      clearCartRef.current();
    };

    const run = async () => {
      // ── Flutterwave returned cancelled/failed status ──
      // The user cancelled/failed on Flutterwave's payment page.
      // No transaction_id is provided in this case.
      // Call the backend cancel endpoint to release stock immediately.
      if (flwStatus === "cancelled" || flwStatus === "failed") {
        try {
          await fetch(`${API_URL}/api/checkout/cancel?orderId=${encodeURIComponent(orderId)}`, {
            credentials: "include",
            redirect: "manual", // Don't follow the redirect, we handle UI here
          });
        } catch {} // Best-effort; stock reservation cleanup will catch it anyway
        setStatus(flwStatus === "cancelled" ? "cancelled" : "failed");
        return;
      }

      // ── Flutterwave returned successful status ──
      // Step 1: Verify directly with Flutterwave API via our backend.
      // This is the primary confirmation path — no webhook dependency.
      if (transactionId) {
        try {
          const res = await fetch(`${API_URL}/api/orders/${orderId}/verify-payment`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ transactionId }),
          });
          const data = await res.json();

          if (isCancelled) return;

          if (data.paymentStatus === "SUCCESSFUL" || data.status === "CONFIRMED") {
            handleSuccess(data);
            return;
          }
          if (data.paymentStatus === "FAILED" || data.status === "CANCELLED") {
            setStatus("failed");
            return;
          }
          // If pending/error, fall through to polling
        } catch {
          // Verification endpoint unavailable, fall through to polling
        }
      }

      if (isCancelled) return;

      // Step 2: Poll payment-status as fallback (webhook may have already processed).
      let attempts = 0;
      const maxAttempts = 20;

      const checkStatus = async () => {
        try {
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

          if (isCancelled) return;

          if (data.paymentStatus === "SUCCESSFUL" || data.status === "CONFIRMED") {
            handleSuccess(data);
            return;
          }
          if (data.paymentStatus === "FAILED" || data.status === "CANCELLED") {
            setStatus("failed");
            return;
          }

          attempts++;
          if (attempts < maxAttempts && !isCancelled) {
            setTimeout(checkStatus, 3000);
          } else {
            setStatus("pending");
          }
        } catch {
          attempts++;
          if (attempts < maxAttempts && !isCancelled) {
            setTimeout(checkStatus, 3000);
          } else {
            setStatus("pending");
          }
        }
      };

      checkStatus();
    };

    run();

    return () => { isCancelled = true; };
  }, [orderId, transactionId, flwStatus]);

  // Manual retry for stuck "pending" state
  const handleRetry = async () => {
    if (!orderId) return;
    setStatus("loading");

    if (transactionId) {
      try {
        const res = await fetch(`${API_URL}/api/orders/${orderId}/verify-payment`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ transactionId }),
        });
        const data = await res.json();
        if (data.paymentStatus === "SUCCESSFUL" || data.status === "CONFIRMED") {
          setStatus("success");
          if (data.orderNumber) setOrderNumber(data.orderNumber);
          clearCartRef.current();
          return;
        }
      } catch {}
    }

    try {
      const res = await fetch(`${API_URL}/api/orders/${orderId}/payment-status`, { credentials: "include" });
      const data = await res.json();
      if (data.paymentStatus === "SUCCESSFUL" || data.status === "CONFIRMED") {
        setStatus("success");
        if (data.orderNumber) setOrderNumber(data.orderNumber);
        clearCartRef.current();
        return;
      }
    } catch {}

    setStatus("pending");
  };

  if (status === "loading") {
    return (
      <Section>
        <div className="max-w-md mx-auto text-center py-16">
          <Loader2 className="w-16 h-16 mx-auto mb-6 text-accent animate-spin" />
          <h2 className="mb-4">Verifying Payment</h2>
          <p className="text-text-muted mb-6">
            Please wait while we confirm your payment...
          </p>
          <p className="text-small text-text-muted">Order ID: {orderId}</p>
        </div>
      </Section>
    );
  }

  if (status === "cancelled") {
    return (
      <Section>
        <div className="max-w-md mx-auto text-center py-16">
          <XCircle className="w-16 h-16 mx-auto mb-6 text-yellow-500" />
          <h2 className="mb-4">Payment Cancelled</h2>
          <p className="text-text-muted mb-6">
            You cancelled the payment. No charges were made. You can try again whenever you&apos;re ready.
          </p>
          <div className="space-y-4">
            <Link href="/checkout" className="btn-primary w-full">
              Return to Checkout
            </Link>
            <Link href="/" className="btn-secondary w-full">
              Continue Shopping
            </Link>
          </div>
        </div>
      </Section>
    );
  }

  if (status === "pending") {
    return (
      <Section>
        <div className="max-w-md mx-auto text-center py-16">
          <Loader2 className="w-16 h-16 mx-auto mb-6 text-yellow-500" />
          <h2 className="mb-4">Payment Processing</h2>
          <p className="text-text-muted mb-6">
            Your payment is being processed. This may take a moment.
            If you approved the payment on your phone, click the button below.
          </p>
          <div className="space-y-4">
            <button onClick={handleRetry} className="btn-primary w-full inline-flex items-center justify-center gap-2">
              <RefreshCw className="w-4 h-4" />
              Check Again
            </button>
            <Link href="/" className="btn-secondary w-full">
              Return to Shop
            </Link>
          </div>
          <p className="text-xs text-text-muted mt-4">Order ID: {orderId}</p>
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
          Thank you for your order. You will receive a confirmation shortly.
        </p>
        <div className="card text-left mb-8">
          <p className="text-small text-text-muted">Order Number</p>
          <p className="font-mono font-semibold">{orderNumber || orderId}</p>
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
