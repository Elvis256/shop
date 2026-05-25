"use client";

import { useState, useRef, useEffect } from "react";
import { useCountry } from "@/contexts/CountryContext";
import { useCurrency } from "@/contexts/CurrencyContext";
import { ChevronDown } from "lucide-react";

export function CountrySelector() {
  const { country, setCountry, allCountries } = useCountry();
  const { setCurrency } = useCurrency();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function handleSelect(c: typeof allCountries[0]) {
    setCountry(c);
    // Also switch the display currency
    setCurrency(c.currency);
    setOpen(false);
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 text-sm text-text-muted hover:text-text transition-colors px-2 py-1 rounded hover:bg-surface-secondary"
        aria-label="Select country"
      >
        <span className="text-base">{country.flag}</span>
        <span className="hidden sm:inline text-xs font-medium">{country.currency}</span>
        <ChevronDown className={`w-3 h-3 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 bg-surface border border-border rounded-xl shadow-lg z-50 w-52 py-1">
          {allCountries.map((c) => (
            <button
              key={c.code}
              onClick={() => handleSelect(c)}
              className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm text-left hover:bg-surface-secondary transition-colors ${country.code === c.code ? "text-accent font-medium" : "text-text"}`}
            >
              <span className="text-lg">{c.flag}</span>
              <div>
                <p className="font-medium leading-tight">{c.name}</p>
                <p className="text-xs text-text-muted">{c.currencySymbol} · {c.dialCode}</p>
              </div>
              {country.code === c.code && <span className="ml-auto text-accent text-xs">✓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
