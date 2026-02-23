/**
 * Real-time exchange rate service using open.er-api.com (free, no API key needed).
 * Fetches rates every 6 hours and updates the Currency table.
 */
import prisma from "../lib/prisma";

const RATE_API = "https://open.er-api.com/v6/latest/USD";
const REFRESH_INTERVAL_MS = 6 * 60 * 60 * 1000; // 6 hours

// East African + major currencies to maintain
const CURRENCIES = [
  { code: "UGX", name: "Ugandan Shilling",      symbol: "USh", decimalPlaces: 0, isBase: true  },
  { code: "USD", name: "US Dollar",              symbol: "$",   decimalPlaces: 2, isBase: false },
  { code: "KES", name: "Kenyan Shilling",        symbol: "KSh", decimalPlaces: 0, isBase: false },
  { code: "TZS", name: "Tanzanian Shilling",     symbol: "TSh", decimalPlaces: 0, isBase: false },
  { code: "RWF", name: "Rwandan Franc",          symbol: "RF",  decimalPlaces: 0, isBase: false },
  { code: "BIF", name: "Burundian Franc",        symbol: "Fr",  decimalPlaces: 0, isBase: false },
  { code: "ETB", name: "Ethiopian Birr",         symbol: "Br",  decimalPlaces: 2, isBase: false },
  { code: "SSP", name: "South Sudanese Pound",   symbol: "£",   decimalPlaces: 2, isBase: false },
  { code: "EUR", name: "Euro",                   symbol: "€",   decimalPlaces: 2, isBase: false },
  { code: "GBP", name: "British Pound",          symbol: "£",   decimalPlaces: 2, isBase: false },
];

let lastUpdated: Date | null = null;

export async function fetchAndUpdateRates(): Promise<boolean> {
  try {
    const res = await fetch(RATE_API, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) throw new Error(`Rate API returned ${res.status}`);

    const data = await res.json() as { rates: Record<string, number>; time_last_update_utc?: string };
    const rates = data.rates;

    if (!rates?.UGX) throw new Error("UGX rate missing from API response");

    const ugxPerUsd = rates.UGX;

    // Update all currencies in DB
    await Promise.all(
      CURRENCIES.map(async (c) => {
        // Rate stored as: how many of this currency = 1 UGX
        // i.e., exchangeRate = (currency / USD) / (UGX / USD)
        const rateVsUgx = c.isBase ? 1 : (rates[c.code] ?? null);
        if (rateVsUgx === null) return; // skip if not in API

        const exchangeRate = c.isBase ? 1 : rateVsUgx / ugxPerUsd;

        await prisma.currency.upsert({
          where: { code: c.code },
          update: { exchangeRate, isActive: true, updatedAt: new Date() },
          create: {
            code: c.code,
            name: c.name,
            symbol: c.symbol,
            exchangeRate,
            isBase: c.isBase,
            isActive: true,
            decimalPlaces: c.decimalPlaces,
          },
        });
      })
    );

    lastUpdated = new Date();
    console.log(`💱 Exchange rates updated at ${lastUpdated.toISOString()} (1 USD = ${ugxPerUsd} UGX)`);
    return true;
  } catch (err) {
    console.error("Failed to fetch exchange rates:", err);
    return false;
  }
}

export function getLastUpdated(): Date | null {
  return lastUpdated;
}

export function startRateRefreshJob(): void {
  // Fetch immediately on startup
  fetchAndUpdateRates();
  // Then refresh every 6 hours
  setInterval(fetchAndUpdateRates, REFRESH_INTERVAL_MS);
  console.log("💱 Exchange rate refresh job started (every 6 hours)");
}
