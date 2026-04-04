"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
const REFRESH_INTERVAL_MS = 6 * 60 * 60 * 1000; // refresh every 6 hours

interface Currency {
  code: string;
  name: string;
  symbol: string;
  exchangeRate: number;
  decimalPlaces: number;
  isBase: boolean;
}

interface CurrencyContextType {
  currency: Currency;
  currencies: Currency[];
  setCurrency: (code: string) => void;
  formatPrice: (amount: number, fromCurrency?: string) => string;
  convertPrice: (amount: number, fromCurrency?: string) => number;
  loading: boolean;
  lastUpdated: Date | null;
}

const defaultCurrency: Currency = {
  code: "UGX",
  name: "Ugandan Shilling",
  symbol: "USh",
  exchangeRate: 1,
  decimalPlaces: 0,
  isBase: true,
};

const CurrencyContext = createContext<CurrencyContextType>({
  currency: defaultCurrency,
  currencies: [defaultCurrency],
  setCurrency: () => {},
  formatPrice: (amount) => `USh ${amount.toLocaleString()}`,
  convertPrice: (amount) => amount,
  loading: true,
  lastUpdated: null,
});

function detectCurrencyByTimezone(): string {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (!tz) return "USD";

    if (tz === "Africa/Kampala") return "UGX";

    if (tz.startsWith("Africa/")) return "USD";

    if (tz.startsWith("Europe/London") || tz === "Europe/Belfast") return "GBP";
    if (tz.startsWith("Europe/")) return "EUR";

    return "USD";
  } catch {
    return "USD";
  }
}

export function CurrencyProvider({ children }: { children: ReactNode }) {
  const [currencies, setCurrencies] = useState<Currency[]>([defaultCurrency]);
  const [currency, setCurrencyState] = useState<Currency>(defaultCurrency);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  useEffect(() => {
    // Load saved preference immediately
    const saved = localStorage.getItem("preferredCurrency");
    if (saved) {
      try { setCurrencyState(JSON.parse(saved)); } catch { /* ignore */ }
    }

    loadCurrencies(!!saved);

    // Refresh rates every 6 hours
    const interval = setInterval(() => loadCurrencies(true), REFRESH_INTERVAL_MS);
    return () => clearInterval(interval);
  }, []);

  const loadCurrencies = async (hasPreference: boolean) => {
    try {
      const res = await fetch(`${API_URL}/api/currencies`);
      if (!res.ok) return;
      const data = await res.json();
      const fetched: Currency[] = data.currencies;
      setCurrencies(fetched);
      if (data.lastUpdated) setLastUpdated(new Date(data.lastUpdated));

      // Keep selected currency in sync with latest rates
      const savedCode = (() => {
        try { return JSON.parse(localStorage.getItem("preferredCurrency") || "{}").code; } catch { return null; }
      })();

      // Auto-detect currency on first visit (no saved preference)
      const detectedCode = !hasPreference && !savedCode ? detectCurrencyByTimezone() : null;
      const code = savedCode || detectedCode || "UGX";
      const updated = fetched.find((c) => c.code === code);
      if (updated) {
        setCurrencyState(updated);
        if (detectedCode && !savedCode) {
          localStorage.setItem("preferredCurrency", JSON.stringify(updated));
        }
      }
    } catch (error) {
      console.error("Failed to load currencies:", error);
    } finally {
      setLoading(false);
    }
  };

  const setCurrency = (code: string) => {
    const selected = currencies.find((c) => c.code === code);
    if (selected) {
      setCurrencyState(selected);
      localStorage.setItem("preferredCurrency", JSON.stringify(selected));
    }
  };

  const convertPrice = (amount: number, fromCurrency: string = "UGX"): number => {
    const fromRate = currencies.find((c) => c.code === fromCurrency)?.exchangeRate ?? 1;
    const toRate = currency.exchangeRate;
    return (amount / fromRate) * toRate;
  };

  const formatPrice = (amount: number, fromCurrency: string = "UGX"): string => {
    const converted = convertPrice(amount, fromCurrency);
    const formatted = new Intl.NumberFormat("en-UG", {
      minimumFractionDigits: currency.decimalPlaces,
      maximumFractionDigits: currency.decimalPlaces,
    }).format(converted);
    return `${currency.symbol} ${formatted}`;
  };

  return (
    <CurrencyContext.Provider value={{ currency, currencies, setCurrency, formatPrice, convertPrice, loading, lastUpdated }}>
      {children}
    </CurrencyContext.Provider>
  );
}

export function useCurrency() {
  return useContext(CurrencyContext);
}
