"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { PiggyBank, CreditCard, XCircle, Clock, CheckCircle, Loader2, ArrowLeft, ChevronDown, ChevronUp } from "lucide-react";
import { useAuth } from "@/lib/hooks/useAuth";
import { useToast } from "@/lib/hooks/useToast";
import { useCurrency } from "@/contexts/CurrencyContext";
import { apiFetch } from "@/lib/api";

interface LayawayPayment {
  id: string;
  amount: number;
  status: string;
  paidAt: string | null;
  createdAt: string;
}

interface LayawayPlan {
  id: string;
  targetAmount: number;
  paidAmount: number;
  installmentAmount: number;
  frequency: string;
  status: string;
  nextPaymentDate: string;
  completedAt: string | null;
  orderId: string | null;
  progress: number;
  remaining: number;
  product: {
    id: string;
    name: string;
    slug: string;
    price: number;
    images: Array<{ url: string }>;
  };
  payments: LayawayPayment[];
}

export default function LayawayDashboard() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const { formatPrice } = useCurrency();

  const [plans, setPlans] = useState<LayawayPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [payingPlan, setPayingPlan] = useState<string | null>(null);
  const [cancellingPlan, setCancellingPlan] = useState<string | null>(null);
  const [expandedPlan, setExpandedPlan] = useState<string | null>(null);
  const [mobilePhone, setMobilePhone] = useState("");
  const [mobileNetwork, setMobileNetwork] = useState("MTN");

  useEffect(() => {
    if (!user) return;
    apiFetch("/api/layaway")
      .then((data: any) => setPlans(data.plans || []))
      .catch(() => showToast("Failed to load plans", "error"))
      .finally(() => setLoading(false));
  }, [user]);

  const handlePay = async (planId: string) => {
    if (!mobilePhone) {
      showToast("Enter your mobile money number", "error");
      return;
    }
    setPayingPlan(planId);
    try {
      const result: any = await apiFetch(`/api/layaway/${planId}/pay`, {
        method: "POST",
        body: JSON.stringify({ paymentMethod: "mobile_money", mobileNetwork, mobilePhone }),
      });
      if (result.paymentLink) {
        window.location.href = result.paymentLink;
      }
    } catch (err: any) {
      showToast(err.message || "Payment failed", "error");
    } finally {
      setPayingPlan(null);
    }
  };

  const handleCancel = async (planId: string) => {
    if (!confirm("Are you sure? Your paid amount will be added to store credit.")) return;
    setCancellingPlan(planId);
    try {
      const result: any = await apiFetch(`/api/layaway/${planId}/cancel`, { method: "POST" });
      showToast(result.message || "Plan cancelled", "success");
      setPlans(plans.map(p => p.id === planId ? { ...p, status: "CANCELLED" } : p));
    } catch (err: any) {
      showToast(err.message || "Cancel failed", "error");
    } finally {
      setCancellingPlan(null);
    }
  };

  const statusColors: Record<string, string> = {
    ACTIVE: "bg-green-100 text-green-700",
    COMPLETED: "bg-blue-100 text-blue-700",
    CANCELLED: "bg-gray-100 text-gray-500",
    EXPIRED: "bg-red-100 text-red-700",
  };

  const statusIcons: Record<string, any> = {
    ACTIVE: Clock,
    COMPLETED: CheckCircle,
    CANCELLED: XCircle,
    EXPIRED: XCircle,
  };

  if (!user) {
    return (
      <div className="container py-16 text-center">
        <p className="text-gray-500">Please log in to view your layaway plans.</p>
        <Link href="/login" className="btn-primary mt-4 inline-block">Log In</Link>
      </div>
    );
  }

  return (
    <div className="container py-8">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/account" className="text-gray-400 hover:text-gray-600">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <PiggyBank className="w-6 h-6 text-teal-600" />
        <h1 className="text-2xl font-bold text-gray-900">My Layaway Plans</h1>
      </div>

      {loading ? (
        <div className="space-y-4">
          {[1,2].map(i => (
            <div key={i} className="animate-pulse bg-white rounded-2xl border p-6">
              <div className="flex gap-4">
                <div className="w-20 h-20 bg-gray-200 rounded-xl" />
                <div className="flex-1 space-y-2">
                  <div className="h-5 bg-gray-200 rounded w-1/2" />
                  <div className="h-4 bg-gray-200 rounded w-1/3" />
                  <div className="h-3 bg-gray-200 rounded w-full" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : plans.length === 0 ? (
        <div className="text-center py-16">
          <PiggyBank className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-gray-900 mb-2">No layaway plans yet</h2>
          <p className="text-gray-500 mb-6">Start saving for products you love!</p>
          <Link href="/layaway" className="btn-primary">Browse Products</Link>
        </div>
      ) : (
        <div className="space-y-4">
          {plans.map((plan) => {
            const StatusIcon = statusIcons[plan.status] || Clock;
            const isExpanded = expandedPlan === plan.id;

            return (
              <div key={plan.id} className="bg-white rounded-2xl border shadow-sm overflow-hidden">
                <div className="p-6">
                  <div className="flex gap-4">
                    {plan.product.images[0]?.url ? (
                      <Image
                        src={plan.product.images[0].url}
                        alt={plan.product.name}
                        width={80}
                        height={80}
                        className="rounded-xl object-cover flex-shrink-0"
                      />
                    ) : (
                      <div className="w-20 h-20 bg-gray-100 rounded-xl flex-shrink-0" />
                    )}

                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <Link href={`/product/${plan.product.slug}`} className="font-semibold text-gray-900 hover:text-teal-600 truncate">
                          {plan.product.name}
                        </Link>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium flex items-center gap-1 ${statusColors[plan.status] || "bg-gray-100"}`}>
                          <StatusIcon className="w-3 h-3" />
                          {plan.status}
                        </span>
                      </div>

                      <p className="text-sm text-gray-500 mt-1">
                        {formatPrice(plan.installmentAmount)} {plan.frequency.toLowerCase()} &bull; {formatPrice(plan.remaining)} remaining
                      </p>

                      {/* Progress bar */}
                      <div className="mt-3">
                        <div className="flex justify-between text-xs text-gray-500 mb-1">
                          <span>{plan.progress}% saved</span>
                          <span>{formatPrice(plan.paidAmount)} / {formatPrice(plan.targetAmount)}</span>
                        </div>
                        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-teal-500 rounded-full transition-all duration-500"
                            style={{ width: `${plan.progress}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  {plan.status === "ACTIVE" && (
                    <div className="mt-4 flex flex-wrap gap-3">
                      <div className="flex-1 min-w-[200px] flex gap-2">
                        <select
                          value={mobileNetwork}
                          onChange={(e) => setMobileNetwork(e.target.value)}
                          className="px-3 py-2 border rounded-lg text-sm"
                        >
                          <option value="MTN">MTN</option>
                          <option value="AIRTEL">Airtel</option>
                        </select>
                        <input
                          type="tel"
                          placeholder="Phone number"
                          value={mobilePhone}
                          onChange={(e) => setMobilePhone(e.target.value)}
                          className="flex-1 px-3 py-2 border rounded-lg text-sm"
                        />
                      </div>
                      <button
                        onClick={() => handlePay(plan.id)}
                        disabled={payingPlan === plan.id}
                        className="px-4 py-2 bg-teal-600 text-white rounded-lg text-sm font-medium hover:bg-teal-700 disabled:opacity-50"
                      >
                        {payingPlan === plan.id ? (
                          <><Loader2 className="w-4 h-4 animate-spin inline mr-1" />Paying...</>
                        ) : (
                          <><CreditCard className="w-4 h-4 inline mr-1" />Pay {formatPrice(plan.installmentAmount)}</>
                        )}
                      </button>
                      <button
                        onClick={() => handleCancel(plan.id)}
                        disabled={cancellingPlan === plan.id}
                        className="px-4 py-2 text-red-600 border border-red-200 rounded-lg text-sm font-medium hover:bg-red-50 disabled:opacity-50"
                      >
                        Cancel
                      </button>
                    </div>
                  )}

                  {plan.status === "COMPLETED" && plan.orderId && (
                    <div className="mt-4 p-3 bg-blue-50 rounded-xl text-sm text-blue-700">
                      <CheckCircle className="w-4 h-4 inline mr-1" />
                      Plan complete! <Link href="/account/orders" className="underline font-medium">View your order</Link>
                    </div>
                  )}
                </div>

                {/* Payment history toggle */}
                {plan.payments.length > 0 && (
                  <>
                    <button
                      onClick={() => setExpandedPlan(isExpanded ? null : plan.id)}
                      className="w-full px-6 py-3 border-t text-sm text-gray-500 hover:bg-gray-50 flex items-center justify-center gap-1"
                    >
                      Payment History ({plan.payments.length})
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>

                    {isExpanded && (
                      <div className="px-6 pb-4 space-y-2">
                        {plan.payments.map((p) => (
                          <div key={p.id} className="flex justify-between items-center text-sm py-2 border-b last:border-0">
                            <div>
                              <span className={`inline-block w-2 h-2 rounded-full mr-2 ${p.status === "PAID" ? "bg-green-400" : p.status === "FAILED" ? "bg-red-400" : "bg-yellow-400"}`} />
                              {formatPrice(Number(p.amount))}
                            </div>
                            <span className="text-gray-400">
                              {p.paidAt ? new Date(p.paidAt).toLocaleDateString() : p.status}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
