"use client";

import { useState, useEffect } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export interface ShippingConfig {
  freeThreshold: number;
  standardRate: number;
  expressRate: number;
  upcountryRate: number;
  intlIncluded: boolean;
  intlDays: string;
  standardDays: string;
  expressDays: string;
  processingDays: string;
  discreetDefault: boolean;
  discreetNote: string;
}

export interface ShippingZone {
  id: string;
  name: string;
  cities: string[];
  rate: number;
  freeAbove: number | null;
  estimatedDays: string | null;
}

const DEFAULT_CONFIG: ShippingConfig = {
  freeThreshold: 100000,
  standardRate: 5000,
  expressRate: 15000,
  upcountryRate: 10000,
  intlIncluded: true,
  intlDays: "7-21 business days",
  standardDays: "2-4 business days",
  expressDays: "Same day - 1 day",
  processingDays: "1",
  discreetDefault: true,
  discreetNote: "Plain packaging with neutral sender name",
};

let cachedConfig: ShippingConfig | null = null;
let cachedZones: ShippingZone[] | null = null;
let fetchPromise: Promise<void> | null = null;

async function loadShippingConfig() {
  if (cachedConfig) return;
  if (fetchPromise) {
    await fetchPromise;
    return;
  }

  fetchPromise = (async () => {
    try {
      const res = await fetch(`${API_URL}/api/settings/shipping`, {
        next: { revalidate: 300 },
      } as any);
      if (!res.ok) throw new Error("Failed");
      const data = await res.json();

      if (data.config) {
        cachedConfig = data.config;
      }
      if (data.zones) {
        cachedZones = data.zones;
      }
    } catch {
      cachedConfig = DEFAULT_CONFIG;
      cachedZones = [];
    }
  })();

  await fetchPromise;
}

export function useShippingConfig() {
  const [config, setConfig] = useState<ShippingConfig>(cachedConfig || DEFAULT_CONFIG);
  const [zones, setZones] = useState<ShippingZone[]>(cachedZones || []);
  const [loaded, setLoaded] = useState(!!cachedConfig);

  useEffect(() => {
    loadShippingConfig().then(() => {
      if (cachedConfig) setConfig(cachedConfig);
      if (cachedZones) setZones(cachedZones);
      setLoaded(true);
    });
  }, []);

  const calculateShipping = (
    items: Array<{ price: number; quantity: number; shippingBadge?: string }>,
    city?: string,
  ) => {
    const localItems = items.filter((i) => i.shippingBadge !== "From Abroad");
    const intlItems = items.filter((i) => i.shippingBadge === "From Abroad");

    const localTotal = localItems.reduce((s, i) => s + i.price * i.quantity, 0);

    // Zone-based lookup
    const cityLower = (city || "kampala").toLowerCase();
    const matchedZone = zones.find((z) =>
      z.cities.some((c) => c.toLowerCase() === cityLower)
    );

    let localShipping = config.standardRate;
    if (matchedZone) {
      localShipping = matchedZone.rate;
      if (matchedZone.freeAbove && localTotal >= matchedZone.freeAbove) {
        localShipping = 0;
      }
    } else if (localTotal >= config.freeThreshold) {
      localShipping = 0;
    } else if (cityLower !== "kampala") {
      localShipping = config.upcountryRate;
      if (localTotal >= config.freeThreshold) localShipping = 0;
    }

    if (localItems.length === 0) localShipping = 0;

    const intlShipping = intlItems.length > 0 && !config.intlIncluded
      ? (parseInt(String(config.upcountryRate), 10) || 0) * intlItems.length
      : 0;

    return {
      local: localShipping,
      international: intlShipping,
      total: localShipping + intlShipping,
      freeThreshold: config.freeThreshold,
      qualifiesForFree: localTotal >= config.freeThreshold,
    };
  };

  return { config, zones, loaded, calculateShipping };
}
