"use client";

import { useState } from "react";
import { useAuth } from "@/lib/hooks/useAuth";
import { useCurrency } from "@/contexts/CurrencyContext";
import Link from "next/link";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

const INTERVALS = [
  { label: "Every 2 weeks", value: "2_weeks" },
  { label: "Monthly", value: "monthly" },
  { label: "Every 2 months", value: "2_months" },
  { label: "Every 3 months", value: "3_months" },
];

function getCsrfToken(): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(/csrf_token=([^;]+)/);
  return match ? match[1] : null;
}

interface SubscribeAndSaveProps {
  productId: string;
  productName: string;
  price: number;
  subscriptionDiscount: number;
  stock: number;
  onSubscribed?: () => void;
}

export default function SubscribeAndSave({
  productId,
  productName,
  price,
  subscriptionDiscount,
  stock,
  onSubscribed,
}: SubscribeAndSaveProps) {
  const { user, isAuthenticated } = useAuth();
  const { formatPrice } = useCurrency();
  const [mode, setMode] = useState<"one-time" | "subscribe">("one-time");
  const [interval, setInterval] = useState("monthly");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const discountedPrice = price * (1 - subscriptionDiscount / 100);

  const handleSubscribe = async () => {
    if (!isAuthenticated) return;
    setLoading(true);
    try {
      const csrf = getCsrfToken();
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (csrf) headers["x-csrf-token"] = csrf;

      const res = await fetch(`${API_URL}/api/subscriptions`, {
        method: "POST",
        headers,
        credentials: "include",
        body: JSON.stringify({
          productId,
          interval,
          quantity: 1,
        }),
      });

      if (res.ok) {
        setSuccess(true);
        onSubscribed?.();
      }
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="p-4 bg-green-50 border border-green-200 rounded-xl text-center">
        <p className="text-green-700 font-medium">✅ Subscribed to {productName}!</p>
        <p className="text-sm text-green-600 mt-1">
          You&apos;ll receive it {INTERVALS.find((i) => i.value === interval)?.label?.toLowerCase()}.
        </p>
      </div>
    );
  }

  return (
    <div className="border border-gray-200 rounded-xl p-4 space-y-3">
      <h3 className="text-sm font-semibold text-gray-900">Purchase Options</h3>

      {/* One-time */}
      <label
        className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
          mode === "one-time" ? "border-primary bg-primary/5" : "border-gray-200"
        }`}
      >
        <input
          type="radio"
          name="purchase-mode"
          checked={mode === "one-time"}
          onChange={() => setMode("one-time")}
          className="accent-primary"
        />
        <div className="flex-1">
          <span className="text-sm font-medium">One-time purchase</span>
          <p className="text-xs text-gray-500">{formatPrice(price)}</p>
        </div>
      </label>

      {/* Subscribe */}
      <label
        className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
          mode === "subscribe" ? "border-green-500 bg-green-50" : "border-gray-200"
        }`}
      >
        <input
          type="radio"
          name="purchase-mode"
          checked={mode === "subscribe"}
          onChange={() => setMode("subscribe")}
          className="accent-green-600"
        />
        <div className="flex-1">
          <span className="text-sm font-medium">
            Subscribe &amp; Save {subscriptionDiscount}%
          </span>
          <p className="text-xs text-gray-500">
            {formatPrice(discountedPrice)}{" "}
            <span className="line-through text-gray-400">{formatPrice(price)}</span>
          </p>
        </div>
        <span className="text-xs font-semibold text-green-700 bg-green-100 px-2 py-0.5 rounded-full">
          -{subscriptionDiscount}%
        </span>
      </label>

      {/* Interval selector */}
      {mode === "subscribe" && (
        <div className="pl-7 space-y-2">
          <label className="block text-xs font-medium text-gray-600">Delivery frequency</label>
          <select
            value={interval}
            onChange={(e) => setInterval(e.target.value)}
            className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500/30 focus:border-green-500"
          >
            {INTERVALS.map((i) => (
              <option key={i.value} value={i.value}>
                {i.label}
              </option>
            ))}
          </select>

          {!isAuthenticated ? (
            <Link
              href="/auth/login"
              className="block w-full text-center bg-gray-100 text-gray-700 py-2.5 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors"
            >
              Login to subscribe
            </Link>
          ) : (
            <button
              onClick={handleSubscribe}
              disabled={loading || stock <= 0}
              className="w-full bg-green-600 text-white py-2.5 rounded-lg text-sm font-semibold hover:bg-green-700 transition-colors disabled:opacity-50"
            >
              {loading ? "Subscribing..." : `Subscribe — ${formatPrice(discountedPrice)}`}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
