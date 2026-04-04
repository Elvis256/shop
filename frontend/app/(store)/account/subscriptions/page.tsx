"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import ProductImage from "@/components/ProductImage";
import { useRouter } from "next/navigation";
import Section from "@/components/Section";
import { useAuth } from "@/lib/hooks/useAuth";
import { useToast } from "@/lib/hooks/useToast";
import { useCurrency } from "@/contexts/CurrencyContext";
import {
  ArrowLeft,
  Package,
  Pause,
  Play,
  Trash2,
  RefreshCw,
  Calendar,
  AlertCircle,
} from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "";

interface Subscription {
  id: string;
  productId: string;
  productName: string;
  productImage?: string | null;
  quantity: number;
  interval: string;
  nextDelivery: string;
  price: number;
  status: string;
}

const intervals = [
  { value: "WEEKLY", label: "Every week" },
  { value: "BIWEEKLY", label: "Every 2 weeks" },
  { value: "MONTHLY", label: "Every month" },
  { value: "BIMONTHLY", label: "Every 2 months" },
  { value: "QUARTERLY", label: "Every 3 months" },
];

export default function SubscriptionsPage() {
  const router = useRouter();
  const { user, isLoading } = useAuth();
  const { showToast } = useToast();
  const { formatPrice } = useCurrency();
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [cancelConfirm, setCancelConfirm] = useState<string | null>(null);
  const [updating, setUpdating] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoading && !user) {
      router.push("/auth/login");
    }
  }, [user, isLoading, router]);

  useEffect(() => {
    if (user) fetchSubscriptions();
  }, [user]);

  const fetchSubscriptions = async () => {
    try {
      const res = await fetch(`${API_URL}/api/subscriptions`, {
        credentials: "include",
      });
      if (res.ok) {
        const data = await res.json();
        setSubscriptions(data.subscriptions || data || []);
      }
    } catch {
      console.error("Failed to fetch subscriptions");
    } finally {
      setLoading(false);
    }
  };

  const updateSubscription = async (
    id: string,
    updates: Partial<Pick<Subscription, "quantity" | "interval" | "status">>
  ) => {
    setUpdating(id);
    try {
      const res = await fetch(`${API_URL}/api/subscriptions/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(updates),
      });
      if (res.ok) {
        showToast("Subscription updated", "success");
        fetchSubscriptions();
      } else {
        const data = await res.json().catch(() => ({}));
        showToast(data.error || "Failed to update subscription", "error");
      }
    } catch {
      showToast("Failed to update subscription", "error");
    } finally {
      setUpdating(null);
    }
  };

  const cancelSubscription = async (id: string) => {
    setUpdating(id);
    try {
      const res = await fetch(`${API_URL}/api/subscriptions/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (res.ok) {
        showToast("Subscription cancelled", "success");
        setCancelConfirm(null);
        fetchSubscriptions();
      } else {
        const data = await res.json().catch(() => ({}));
        showToast(data.error || "Failed to cancel subscription", "error");
      }
    } catch {
      showToast("Failed to cancel subscription", "error");
    } finally {
      setUpdating(null);
    }
  };

  const togglePause = (sub: Subscription) => {
    const newStatus = sub.status === "PAUSED" ? "ACTIVE" : "PAUSED";
    updateSubscription(sub.id, { status: newStatus });
  };

  if (isLoading || !user) {
    return (
      <Section>
        <div className="text-center py-16">Loading...</div>
      </Section>
    );
  }

  return (
    <Section>
      <div className="max-w-3xl mx-auto">
        <Link
          href="/account"
          className="inline-flex items-center gap-2 text-text-muted hover:text-text mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Account
        </Link>

        <h1 className="text-2xl font-semibold mb-8">My Subscriptions</h1>

        {loading ? (
          <div className="text-center py-16">Loading...</div>
        ) : subscriptions.length === 0 ? (
          <div className="card text-center py-16">
            <RefreshCw className="w-12 h-12 text-text-muted mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">No Active Subscriptions</h3>
            <p className="text-text-muted mb-6">
              Subscribe to products you love and never run out!
            </p>
            <Link href="/" className="btn btn-primary">
              Browse Products
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {subscriptions.map((sub) => (
              <div
                key={sub.id}
                className={`card border transition-all ${
                  sub.status === "PAUSED"
                    ? "opacity-70 border-yellow-200 bg-yellow-50/30"
                    : "border-border"
                }`}
              >
                <div className="flex gap-4">
                  {/* Product Image */}
                  <div className="w-20 h-20 bg-surface-secondary rounded-xl overflow-hidden shrink-0">
                    <ProductImage
                      src={sub.productImage}
                      alt={sub.productName}
                      width={80}
                      height={80}
                      className="w-full h-full object-cover"
                    />
                  </div>

                  {/* Details */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div>
                        <h3 className="font-medium text-text line-clamp-1">
                          {sub.productName}
                        </h3>
                        <p className="text-sm font-semibold text-text mt-0.5">
                          {formatPrice(Number(sub.price))}
                        </p>
                      </div>
                      <span
                        className={`text-xs px-2 py-1 rounded-full font-medium shrink-0 ${
                          sub.status === "ACTIVE"
                            ? "bg-green-100 text-green-700"
                            : sub.status === "PAUSED"
                            ? "bg-yellow-100 text-yellow-700"
                            : "bg-gray-100 text-gray-700"
                        }`}
                      >
                        {sub.status}
                      </span>
                    </div>

                    {/* Meta row */}
                    <div className="flex flex-wrap items-center gap-3 text-xs text-text-muted mb-3">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5" />
                        Next:{" "}
                        {new Date(sub.nextDelivery).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </span>
                    </div>

                    {/* Controls */}
                    <div className="flex flex-wrap items-center gap-3">
                      {/* Quantity */}
                      <div className="flex items-center gap-1.5">
                        <label className="text-xs text-text-muted">Qty:</label>
                        <input
                          type="number"
                          min={1}
                          max={99}
                          defaultValue={sub.quantity}
                          disabled={updating === sub.id}
                          className="w-16 border border-border rounded-lg px-2 py-1 text-sm text-center bg-surface"
                          onBlur={(e) => {
                            const val = parseInt(e.target.value, 10);
                            if (val > 0 && val !== sub.quantity) {
                              updateSubscription(sub.id, { quantity: val });
                            }
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                          }}
                        />
                      </div>

                      {/* Interval */}
                      <div className="flex items-center gap-1.5">
                        <label className="text-xs text-text-muted">Frequency:</label>
                        <select
                          defaultValue={sub.interval}
                          disabled={updating === sub.id}
                          className="border border-border rounded-lg px-2 py-1 text-sm bg-surface"
                          onChange={(e) =>
                            updateSubscription(sub.id, { interval: e.target.value })
                          }
                        >
                          {intervals.map((int) => (
                            <option key={int.value} value={int.value}>
                              {int.label}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2 ml-auto">
                        <button
                          onClick={() => togglePause(sub)}
                          disabled={updating === sub.id}
                          className="p-2 rounded-lg border border-border hover:bg-surface-secondary text-text-muted hover:text-text transition-colors disabled:opacity-50"
                          title={sub.status === "PAUSED" ? "Resume" : "Pause"}
                        >
                          {sub.status === "PAUSED" ? (
                            <Play className="w-4 h-4" />
                          ) : (
                            <Pause className="w-4 h-4" />
                          )}
                        </button>
                        <button
                          onClick={() => setCancelConfirm(sub.id)}
                          disabled={updating === sub.id}
                          className="p-2 rounded-lg border border-red-200 text-red-500 hover:bg-red-50 transition-colors disabled:opacity-50"
                          title="Cancel subscription"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Cancel Confirmation */}
                {cancelConfirm === sub.id && (
                  <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-xl">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <p className="text-sm font-medium text-red-800">
                          Cancel this subscription?
                        </p>
                        <p className="text-xs text-red-600 mt-1">
                          You won&apos;t receive any more deliveries for this product.
                        </p>
                        <div className="flex gap-2 mt-3">
                          <button
                            onClick={() => cancelSubscription(sub.id)}
                            disabled={updating === sub.id}
                            className="px-3 py-1.5 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700 disabled:opacity-50"
                          >
                            Yes, Cancel
                          </button>
                          <button
                            onClick={() => setCancelConfirm(null)}
                            className="px-3 py-1.5 bg-white border border-gray-300 rounded-lg text-sm hover:bg-gray-50"
                          >
                            Keep It
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </Section>
  );
}
