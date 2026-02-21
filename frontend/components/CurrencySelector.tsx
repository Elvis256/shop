"use client";

import { useState, useRef, useEffect } from "react";
import { useCurrency } from "@/contexts/CurrencyContext";

interface CurrencySelectorProps {
  variant?: "default" | "compact" | "minimal";
}

export default function CurrencySelector({ variant = "default" }: CurrencySelectorProps) {
  const { currency, currencies, setCurrency, loading } = useCurrency();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  if (loading) {
    return (
      <div className="h-8 w-16 bg-gray-100 rounded animate-pulse" />
    );
  }

  const baseClasses = "relative inline-block";
  
  const buttonClasses = {
    default: "flex items-center gap-2 px-3 py-2 text-sm border rounded-lg hover:bg-gray-50 transition-colors",
    compact: "flex items-center gap-1 px-2 py-1 text-xs border rounded hover:bg-gray-50 transition-colors",
    minimal: "flex items-center gap-1 text-sm hover:text-primary transition-colors",
  };

  return (
    <div className={baseClasses} ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={buttonClasses[variant]}
        aria-label="Select currency"
      >
        <span className="font-medium">{currency.code}</span>
        {variant !== "minimal" && (
          <svg
            className={`w-4 h-4 transition-transform ${isOpen ? "rotate-180" : ""}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-48 bg-white border rounded-lg shadow-lg z-50">
          <div className="py-1">
            {currencies.map((c) => (
              <button
                key={c.code}
                onClick={() => {
                  setCurrency(c.code);
                  setIsOpen(false);
                }}
                className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-50 flex items-center justify-between ${
                  c.code === currency.code ? "bg-primary/5 text-primary" : ""
                }`}
              >
                <span>
                  <span className="font-medium">{c.code}</span>
                  <span className="text-gray-500 ml-2">{c.symbol}</span>
                </span>
                {c.code === currency.code && (
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                )}
              </button>
            ))}
          </div>
          <div className="border-t px-4 py-2 text-xs text-gray-500">
            Prices shown in selected currency
          </div>
        </div>
      )}
    </div>
  );
}
