"use client";

import { useShippingConfig, ShippingZone } from "@/lib/hooks/useShippingConfig";
import { Truck } from "lucide-react";

interface DeliveryEstimateProps {
  shippingZoneId?: string;
  city?: string;
  className?: string;
  compact?: boolean;
}

function parseDaysRange(estimatedDays: string | null): { min: number; max: number } | null {
  if (!estimatedDays) return null;
  const match = estimatedDays.match(/(\d+)\s*[-–]\s*(\d+)/);
  if (match) return { min: parseInt(match[1], 10), max: parseInt(match[2], 10) };
  const single = estimatedDays.match(/(\d+)/);
  if (single) return { min: parseInt(single[1], 10), max: parseInt(single[1], 10) };
  return null;
}

function formatDateRange(min: number, max: number): string {
  const now = new Date();
  const from = new Date(now);
  from.setDate(from.getDate() + min);
  const to = new Date(now);
  to.setDate(to.getDate() + max);

  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
  if (from.toDateString() === to.toDateString()) {
    return from.toLocaleDateString("en-US", opts);
  }
  return `${from.toLocaleDateString("en-US", opts)} – ${to.toLocaleDateString("en-US", opts)}`;
}

function findZone(
  zones: ShippingZone[],
  zoneId?: string,
  city?: string,
): ShippingZone | null {
  if (zoneId) {
    const z = zones.find((z) => z.id === zoneId);
    if (z) return z;
  }
  if (city) {
    const cityLower = city.toLowerCase();
    const z = zones.find((z) => z.cities.some((c) => c.toLowerCase() === cityLower));
    if (z) return z;
  }
  return zones[0] || null;
}

export default function DeliveryEstimate({
  shippingZoneId,
  city,
  className = "",
  compact = false,
}: DeliveryEstimateProps) {
  const { zones, config, loaded } = useShippingConfig();

  if (!loaded) return null;

  const zone = findZone(zones, shippingZoneId, city);
  const daysText = zone?.estimatedDays || config.standardDays;
  const range = parseDaysRange(daysText);

  if (compact) {
    return (
      <span className={`inline-flex items-center gap-1.5 text-sm text-emerald-700 ${className}`}>
        <Truck className="w-4 h-4" />
        {range
          ? `Arrives ${formatDateRange(range.min, range.max)}`
          : `Est. delivery: ${daysText}`}
      </span>
    );
  }

  return (
    <div className={`flex items-center gap-2 p-3 bg-emerald-50 border border-emerald-100 rounded-lg ${className}`}>
      <Truck className="w-5 h-5 text-emerald-600 flex-shrink-0" />
      <div>
        <p className="text-sm font-medium text-emerald-800">
          🚚 Estimated delivery: {daysText}
        </p>
        {range && (
          <p className="text-xs text-emerald-600">
            Arrives {formatDateRange(range.min, range.max)}
          </p>
        )}
        {zone && <p className="text-xs text-emerald-500 mt-0.5">{zone.name}</p>}
      </div>
    </div>
  );
}

export { parseDaysRange, formatDateRange };
