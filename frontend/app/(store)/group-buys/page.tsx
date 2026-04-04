"use client";

import { useState, useEffect } from "react";
import { Users, Clock, ChevronRight, Gift } from "lucide-react";
import { useCurrency } from "@/contexts/CurrencyContext";
import { useCountdown } from "@/lib/hooks/useCountdown";
import Link from "next/link";
import ProductImage from "@/components/ProductImage";

interface GroupBuyItem {
  id: string;
  productId: string;
  targetCount: number;
  currentCount: number;
  discountPercent: number;
  groupPrice: number;
  expiresAt: string;
  status: string;
  spotsLeft: number;
  progress: number;
  product?: {
    name: string;
    slug: string;
    imageUrl: string | null;
    price: number;
  };
}

export default function GroupBuysPage() {
  const [groupBuys, setGroupBuys] = useState<GroupBuyItem[]>([]);
  const [loading, setLoading] = useState(true);
  const { formatPrice } = useCurrency();

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/social/group-buy", { credentials: "include" });
        if (res.ok) {
          const data = await res.json();
          setGroupBuys(Array.isArray(data) ? data : data.groupBuys ?? []);
        }
      } catch {
        // failed to load
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          👥 Group Buy Deals — Buy Together, Save Together
        </h1>
        <p className="text-gray-500 text-lg">Join others to unlock exclusive group prices</p>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-100 p-4 animate-pulse">
              <div className="w-full aspect-square bg-gray-200 rounded-lg mb-3" />
              <div className="h-4 bg-gray-200 rounded w-3/4 mb-2" />
              <div className="h-4 bg-gray-200 rounded w-1/2" />
            </div>
          ))}
        </div>
      ) : groupBuys.length === 0 ? (
        <div className="text-center py-16">
          <div className="text-6xl mb-4">👥</div>
          <h2 className="text-xl font-semibold text-gray-700 mb-2">No active group buys right now</h2>
          <p className="text-gray-500">Check back soon for new group buy deals!</p>
          <Link
            href="/"
            className="inline-flex items-center gap-1 mt-4 text-purple-600 font-medium hover:underline"
          >
            Browse products <ChevronRight className="w-4 h-4" />
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {groupBuys.map((gb) => (
            <GroupBuyCard key={gb.id} groupBuy={gb} formatPrice={formatPrice} />
          ))}
        </div>
      )}
    </div>
  );
}

function GroupBuyCard({
  groupBuy,
  formatPrice,
}: {
  groupBuy: GroupBuyItem;
  formatPrice: (n: number) => string;
}) {
  const { hours, minutes, seconds, expired } = useCountdown(groupBuy.expiresAt);
  const pad = (n: number) => String(n).padStart(2, "0");
  const slug = groupBuy.product?.slug || groupBuy.productId;

  return (
    <Link
      href={`/product/${slug}`}
      className="group bg-white rounded-xl border border-gray-100 hover:border-purple-200 hover:shadow-lg transition-all overflow-hidden"
    >
      {/* Image */}
      <div className="relative aspect-square bg-gray-50">
        {groupBuy.product?.imageUrl ? (
          <ProductImage
            src={groupBuy.product.imageUrl}
            alt={groupBuy.product?.name || "Product"}
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-4xl text-gray-300">
            📦
          </div>
        )}
        {/* Discount badge */}
        <span className="absolute top-2 left-2 inline-flex items-center gap-1 text-xs font-bold text-white bg-gradient-to-r from-purple-600 to-pink-600 px-2 py-1 rounded-full">
          <Gift className="w-3 h-3" />
          -{groupBuy.discountPercent}%
        </span>
      </div>

      {/* Details */}
      <div className="p-3">
        <h3 className="text-sm font-semibold text-gray-900 line-clamp-2 mb-2">
          {groupBuy.product?.name || "Product"}
        </h3>

        {/* Prices */}
        <div className="flex items-baseline gap-2 mb-2">
          {groupBuy.product?.price && (
            <span className="text-xs text-gray-400 line-through">
              {formatPrice(groupBuy.product.price)}
            </span>
          )}
          <span className="text-base font-bold text-purple-700">{formatPrice(groupBuy.groupPrice)}</span>
        </div>

        {/* Progress bar */}
        <div className="mb-2">
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-purple-500 to-pink-500 rounded-full transition-all"
              style={{ width: `${Math.min(groupBuy.progress, 100)}%` }}
            />
          </div>
          <div className="flex justify-between text-[10px] mt-0.5 text-gray-500">
            <span>{groupBuy.currentCount}/{groupBuy.targetCount} joined</span>
            <span>{groupBuy.spotsLeft} left</span>
          </div>
        </div>

        {/* Timer */}
        {!expired ? (
          <div className="flex items-center gap-1 text-[10px] text-purple-600 font-medium">
            <Clock className="w-3 h-3" />
            {pad(hours)}:{pad(minutes)}:{pad(seconds)}
          </div>
        ) : (
          <div className="text-[10px] text-red-500 font-medium">Expired</div>
        )}
      </div>
    </Link>
  );
}
