"use client";

import { useState, useEffect } from "react";

const API_URL = typeof window !== "undefined" ? "" : (process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000");

interface FreeShippingBarProps {
  cartTotal: number;
  currency?: string;
  freeAbove?: number;
  formatPrice?: (amount: number) => string;
}

export default function FreeShippingBar({
  cartTotal,
  currency = "UGX",
  freeAbove,
  formatPrice,
}: FreeShippingBarProps) {
  const [threshold, setThreshold] = useState(freeAbove ?? 100000);

  useEffect(() => {
    if (freeAbove !== undefined) return;
    fetch(`${API_URL}/api/settings/shipping-zones`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        const zones: { freeAbove?: number | null }[] =
          data?.zones ?? data ?? [];
        const first = zones.find((z) => z.freeAbove && z.freeAbove > 0);
        if (first?.freeAbove) setThreshold(first.freeAbove);
      })
      .catch(() => {});
  }, [freeAbove]);

  const fmt = formatPrice ?? ((a: number) => `${currency} ${a.toLocaleString()}`);
  const remaining = threshold - cartTotal;
  const progress = Math.min(100, (cartTotal / threshold) * 100);

  if (cartTotal <= 0) return null;

  return (
    <div className="p-3 sm:p-4 bg-white rounded-xl border">
      {remaining > 0 ? (
        <>
          <p className="text-sm text-gray-700 mb-2">
            Add <strong>{fmt(remaining)}</strong> more for{" "}
            <strong className="text-green-600">FREE shipping!</strong> 🚚
          </p>
          <div className="w-full h-2.5 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-green-500 rounded-full transition-all duration-700 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
        </>
      ) : (
        <p className="text-sm font-medium text-green-700 flex items-center gap-2">
          🎉 You&apos;ve unlocked FREE shipping!
        </p>
      )}
    </div>
  );
}
