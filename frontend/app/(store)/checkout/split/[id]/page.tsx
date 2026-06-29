"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { CreditCard, CheckCircle, Loader2, Users, AlertCircle, Lock } from "lucide-react";

const API_URL = typeof window !== "undefined" ? "" : (process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000");

interface SplitOrderItem {
  id: string;
  name: string;
  quantity: number;
  price: number;
}

interface SplitOrderDetails {
  id: string;
  orderNumber: string;
  totalAmount: number;
  splitPaidAmount: number;
  splitPartnerPhone: string | null;
  splitPartnerPaid: boolean;
  customerName: string | null;
  status: string;
  items?: SplitOrderItem[];
}

export default function SplitPartnerPaymentPage() {
  const { id } = useParams() as { id: string };
  const router = useRouter();
  const [order, setOrder] = useState<SplitOrderDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [paying, setPaying] = useState(false);

  useEffect(() => {
    fetch(`${API_URL}/api/checkout/split/${id}`)
      .then((r) => {
        if (!r.ok) throw new Error("Could not find split order.");
        return r.json();
      })
      .then((d) => {
        if (d.error) setError(d.error);
        else setOrder(d.order);
      })
      .catch((err) => setError(err.message || "Failed to load split payment details."))
      .finally(() => setLoading(false));
  }, [id]);

  const handlePay = async () => {
    setPaying(true);
    setError("");
    try {
      const res = await fetch(`${API_URL}/api/checkout/split/${id}/pay`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentMethod: "card" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to initiate partner payment");
      
      if (data.paymentLink) {
        window.location.href = data.paymentLink;
      } else {
        throw new Error("No secure payment URL received");
      }
    } catch (err: any) {
      setError(err.message || "Something went wrong. Please try again.");
      setPaying(false);
    }
  };

  const formatPrice = (amount: number) => {
    return new Intl.NumberFormat("en-UG", {
      style: "currency",
      currency: "UGX",
      maximumFractionDigits: 0,
    }).format(amount);
  };

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen">
      <Loader2 className="w-8 h-8 animate-spin text-primary" />
    </div>
  );

  if (error) return (
    <div className="flex items-center justify-center min-h-screen px-4">
      <div className="text-center max-w-sm">
        <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
        <h1 className="text-lg font-bold mb-2">Split Payment Error</h1>
        <p className="text-sm text-gray-600 mb-4">{error}</p>
        <button
          onClick={() => window.location.reload()}
          className="px-4 py-2 bg-primary text-white text-xs font-semibold rounded-lg hover:bg-primary/95 transition-colors"
        >
          Try Again
        </button>
      </div>
    </div>
  );

  if (!order) return null;

  if (order.status === "CANCELLED") return (
    <div className="flex items-center justify-center min-h-screen px-4">
      <div className="text-center max-w-sm bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700">
        <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Payment Link Expired</h1>
        <p className="text-gray-600 dark:text-gray-300 text-sm">This payment link has expired. The order was cancelled because payment was not completed within the 15-minute stock reservation window.</p>
        <p className="text-xs text-gray-400 mt-4">Please ask your friend to place the order again 🔒</p>
      </div>
    </div>
  );

  if (order.splitPartnerPaid) return (
    <div className="flex items-center justify-center min-h-screen px-4">
      <div className="text-center max-w-sm bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700">
        <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Paid successfully!</h1>
        <p className="text-gray-600 dark:text-gray-300 text-sm">Your share of the split payment for order <span className="font-semibold">{order.orderNumber}</span> has been paid.</p>
        <p className="text-xs text-gray-400 mt-4">Thank you for shopping together 🔒</p>
      </div>
    </div>
  );

  const initiatorShare = Number(order.splitPaidAmount);
  const partnerShare = Number(order.totalAmount) - initiatorShare;
  const isPayForMe = initiatorShare === 0;

  return (
    <div className="min-h-screen bg-gradient-to-b from-primary-50 to-white dark:from-gray-950 dark:to-gray-900 px-4 py-12">
      <div className="max-w-md mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-accent/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <Users className="w-10 h-10 text-accent animate-pulse" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            {isPayForMe ? "Pay for a Friend 💸" : "Partner Split Payment 👥"}
          </h1>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
            {isPayForMe ? (
              <>
                Your friend <strong className="text-gray-900 dark:text-white">{order.customerName || "A friend"}</strong> has sent you their bill to pay for their PleasureZone order.
              </>
            ) : (
              <>
                Your partner <strong className="text-gray-900 dark:text-white">{order.customerName || "Someone special"}</strong> split the cost of their PleasureZone order with you 50/50.
              </>
            )}
          </p>
        </div>

        {/* Breakdown Card */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-6 mb-6 space-y-4">
          <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-200 border-b pb-2">Order {order.orderNumber}</h2>
          
          {order.items && order.items.length > 0 && (
            <div className="space-y-2 border-b pb-3 pt-1">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Items in Order</p>
              {order.items.map((item) => (
                <div key={item.id} className="flex justify-between text-xs font-sans">
                  <span className="text-gray-600 dark:text-gray-300">
                    {item.name} <strong className="text-gray-400">x{item.quantity}</strong>
                  </span>
                  <span className="font-semibold text-gray-900 dark:text-white">
                    {formatPrice(Number(item.price) * item.quantity)}
                  </span>
                </div>
              ))}
            </div>
          )}

          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Total Order Amount:</span>
              <span className="font-medium text-gray-900 dark:text-white">{formatPrice(order.totalAmount)}</span>
            </div>
            
            {!isPayForMe && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Initiator Paid (50%):</span>
                <span className="text-green-600 font-semibold">{formatPrice(initiatorShare)}</span>
              </div>
            )}

            <div className="flex justify-between text-base border-t border-dashed pt-3">
              <span className="font-bold text-gray-900 dark:text-white">
                {isPayForMe ? "Total bill to pay:" : "Your share to pay (50%):"}
              </span>
              <span className="font-extrabold text-accent">{formatPrice(partnerShare)}</span>
            </div>
          </div>

          <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg flex items-start gap-2.5">
            <Lock className="w-4 h-4 text-accent shrink-0 mt-0.5" />
            <p className="text-[11px] text-gray-500 dark:text-gray-400 leading-relaxed">
              Payments are processed securely via Flutterwave. We accept Credit/Debit cards, MTN MoMo, and Airtel Money. Shipped in 100% plain packaging with absolute discretion.
            </p>
          </div>
        </div>

        {/* Action Form */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-6 space-y-4">
          <div className="flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-accent" />
            <p className="font-semibold text-gray-900 dark:text-white">Complete Payment</p>
          </div>

          <p className="text-xs text-gray-500 dark:text-gray-400">
            {isPayForMe 
              ? "Clicking the button below will redirect you to the secure payment page to pay this bill."
              : "Clicking the button below will redirect you to the secure checkout page to complete your 50% split payment."}
          </p>

          <button
            onClick={handlePay}
            disabled={paying}
            className="w-full bg-primary hover:bg-primary/90 disabled:opacity-50 text-white rounded-lg py-3 font-semibold text-sm transition-all flex items-center justify-center gap-2"
          >
            {paying ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" /> Redirecting to Secure Gateway...
              </>
            ) : (
              isPayForMe ? `Pay Order Bill (${formatPrice(partnerShare)})` : `Pay Share (${formatPrice(partnerShare)})`
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
