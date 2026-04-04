"use client";

import { useState, useEffect } from "react";
import { Tag } from "lucide-react";
import { apiFetch } from "@/lib/api";

interface PriceTier {
  minQty: number;
  discount: number;
  price?: number;
}

interface PriceTiersProps {
  productId: string;
}

export default function PriceTiers({ productId }: PriceTiersProps) {
  const [tiers, setTiers] = useState<PriceTier[]>([]);

  useEffect(() => {
    apiFetch(`/api/price-tiers/${productId}`)
      .then((data: any) => setTiers(data.tiers || []))
      .catch(() => {});
  }, [productId]);

  if (tiers.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2 mt-2">
      {tiers.map((tier, i) => (
        <span
          key={i}
          className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-md"
        >
          <Tag className="w-3 h-3" />
          Buy {tier.minQty}+ save {tier.discount}%
        </span>
      ))}
    </div>
  );
}
