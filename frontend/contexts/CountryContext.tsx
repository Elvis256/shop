"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";

interface MobileNetwork {
  id: "MTN" | "AIRTEL" | "MPESA";
  name: string;
}

interface Country {
  code: string;
  name: string;
  flag: string;
  currency: string;
  currencySymbol: string;
  dialCode: string;
  phonePlaceholder: string;
  paymentMethods: string[];
  mobileNetworks: MobileNetwork[];
  cities: string[];
}

const DEFAULT_COUNTRY: Country = {
  code: "UG",
  name: "Uganda",
  flag: "🇺🇬",
  currency: "UGX",
  currencySymbol: "UGX",
  dialCode: "+256",
  phonePlaceholder: "07XX XXX XXX",
  paymentMethods: ["mobile_money", "card", "cod"],
  mobileNetworks: [
    { id: "MTN", name: "MTN MoMo" },
    { id: "AIRTEL", name: "Airtel Money" },
  ],
  cities: ["Kampala", "Entebbe", "Jinja", "Gulu", "Mbarara", "Mbale"],
};

interface CountryContextType {
  country: Country;
  setCountry: (c: Country) => void;
  allCountries: Country[];
}

const CountryContext = createContext<CountryContextType>({
  country: DEFAULT_COUNTRY,
  setCountry: () => {},
  allCountries: [DEFAULT_COUNTRY],
});

const API_URL = typeof window !== "undefined" ? "" : (process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000");

export function CountryProvider({ children }: { children: ReactNode }) {
  const [country, setCountryState] = useState<Country>(DEFAULT_COUNTRY);
  const [allCountries, setAllCountries] = useState<Country[]>([DEFAULT_COUNTRY]);

  useEffect(() => {
    // Restore saved country
    const saved = localStorage.getItem("preferred_country");
    if (saved) {
      try { setCountryState(JSON.parse(saved)); } catch {}
    }

    // Fetch all supported countries
    fetch(`${API_URL}/api/country-config`)
      .then((r) => r.json())
      .then((d) => {
        if (d.countries?.length) {
          setAllCountries(d.countries);
          // If saved country is in the list, restore it
          if (saved) {
            const savedCode = JSON.parse(saved).code;
            const match = d.countries.find((c: Country) => c.code === savedCode);
            if (match) setCountryState(match);
          }
        }
      })
      .catch(() => {});
  }, []);

  function setCountry(c: Country) {
    setCountryState(c);
    localStorage.setItem("preferred_country", JSON.stringify(c));
  }

  return (
    <CountryContext.Provider value={{ country, setCountry, allCountries }}>
      {children}
    </CountryContext.Provider>
  );
}

export function useCountry() {
  return useContext(CountryContext);
}
