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

    loadCurrencies();

    // Refresh rates every 6 hours
    const interval = setInterval(loadCurrencies, REFRESH_INTERVAL_MS);
    return () => clearInterval(interval);
  }, []);

  const loadCurrencies = async () => {
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
      const code = savedCode || "UGX";
      const updated = fetched.find((c) => c.code === code);
      if (updated) setCurrencyState(updated);
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
