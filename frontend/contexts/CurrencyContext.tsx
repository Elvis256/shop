"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

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
});

export function CurrencyProvider({ children }: { children: ReactNode }) {
  const [currencies, setCurrencies] = useState<Currency[]>([defaultCurrency]);
  const [currency, setCurrencyState] = useState<Currency>(defaultCurrency);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadCurrencies();
    // Load saved preference
    const saved = localStorage.getItem("preferredCurrency");
    if (saved) {
      const parsed = JSON.parse(saved);
      setCurrencyState(parsed);
    }
  }, []);

  const loadCurrencies = async () => {
    try {
      const res = await fetch(`${API_URL}/api/currencies`);
      if (res.ok) {
        const data = await res.json();
        setCurrencies(data.currencies);
        
        // Update current currency with latest rate
        const saved = localStorage.getItem("preferredCurrency");
        if (saved) {
          const savedCode = JSON.parse(saved).code;
          const updated = data.currencies.find((c: Currency) => c.code === savedCode);
          if (updated) {
            setCurrencyState(updated);
          }
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
    // Convert from source currency to base (UGX), then to target
    const fromRate = currencies.find((c) => c.code === fromCurrency)?.exchangeRate || 1;
    const toRate = currency.exchangeRate;
    
    // amount in base = amount / fromRate
    // amount in target = amount in base * toRate
    const baseAmount = amount / fromRate;
    return baseAmount * toRate;
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
    <CurrencyContext.Provider
      value={{
        currency,
        currencies,
        setCurrency,
        formatPrice,
        convertPrice,
        loading,
      }}
    >
      {children}
    </CurrencyContext.Provider>
  );
}

export function useCurrency() {
  return useContext(CurrencyContext);
}
