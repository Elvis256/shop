"use client";

import { useState, useRef, useCallback, useEffect, InputHTMLAttributes } from "react";
import { MapPin, Navigation, Loader2 } from "lucide-react";

type AddressFieldType =
  | "name"
  | "street"
  | "address-line1"
  | "address-line2"
  | "city"
  | "state"
  | "county"
  | "postal-code"
  | "country"
  | "phone"
  | "email";

const autocompleteMap: Record<AddressFieldType, string> = {
  name: "name",
  street: "street-address",
  "address-line1": "address-line1",
  "address-line2": "address-line2",
  city: "address-level2",
  state: "address-level1",
  county: "address-level1",
  "postal-code": "postal-code",
  country: "country-name",
  phone: "tel",
  email: "email",
};

interface NominatimResult {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
  address: {
    road?: string;
    house_number?: string;
    suburb?: string;
    city?: string;
    town?: string;
    village?: string;
    county?: string;
    state?: string;
    postcode?: string;
    country?: string;
    country_code?: string;
  };
}

interface AddressSelection {
  street: string;
  city: string;
  county: string;
  postalCode: string;
  lat: number;
  lng: number;
  displayName: string;
}

interface AddressAutocompleteProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "autoComplete" | "onChange"> {
  fieldType?: AddressFieldType;
  onAddressSelect?: (address: AddressSelection) => void;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  enableGeocoding?: boolean;
}

export default function AddressAutocomplete({
  fieldType = "address-line1",
  className = "input",
  onAddressSelect,
  onChange,
  enableGeocoding = true,
  ...props
}: AddressAutocompleteProps) {
  const [query, setQuery] = useState((props.value as string) || "");
  const [suggestions, setSuggestions] = useState<NominatimResult[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // Sync external value prop
  useEffect(() => {
    if (props.value !== undefined && props.value !== query) {
      setQuery(props.value as string);
    }
  }, [props.value]);

  const searchNominatim = useCallback(async (searchQuery: string) => {
    if (searchQuery.length < 3) {
      setSuggestions([]);
      setIsOpen(false);
      return;
    }

    setIsSearching(true);
    try {
      const params = new URLSearchParams({
        q: searchQuery,
        format: "json",
        addressdetails: "1",
        countrycodes: "ug",
        limit: "5",
      });
      const res = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
        headers: { "Accept-Language": "en" },
      });
      if (res.ok) {
        const data: NominatimResult[] = await res.json();
        setSuggestions(data);
        setIsOpen(data.length > 0);
        setHighlightedIndex(-1);
      }
    } catch {
      setSuggestions([]);
    }
    setIsSearching(false);
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setQuery(value);
    onChange?.(e);

    if (!enableGeocoding) return;

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      searchNominatim(value);
    }, 400);
  };

  const selectSuggestion = (result: NominatimResult) => {
    const addr = result.address;
    const street = [addr.house_number, addr.road].filter(Boolean).join(" ");
    const city = addr.city || addr.town || addr.village || "";
    const county = addr.county || addr.state || "";
    const postalCode = addr.postcode || "";

    const selection: AddressSelection = {
      street: street || result.display_name.split(",")[0],
      city,
      county,
      postalCode,
      lat: parseFloat(result.lat),
      lng: parseFloat(result.lon),
      displayName: result.display_name,
    };

    setQuery(selection.street);
    setIsOpen(false);
    setSuggestions([]);
    onAddressSelect?.(selection);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightedIndex((prev) => Math.min(prev + 1, suggestions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightedIndex((prev) => Math.max(prev - 1, 0));
    } else if (e.key === "Enter" && highlightedIndex >= 0) {
      e.preventDefault();
      selectSuggestion(suggestions[highlightedIndex]);
    } else if (e.key === "Escape") {
      setIsOpen(false);
    }
  };

  const handleUseLocation = async () => {
    if (!navigator.geolocation) return;

    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const { latitude, longitude } = position.coords;
          const params = new URLSearchParams({
            lat: String(latitude),
            lon: String(longitude),
            format: "json",
            addressdetails: "1",
          });
          const res = await fetch(`https://nominatim.openstreetmap.org/reverse?${params}`, {
            headers: { "Accept-Language": "en" },
          });
          if (res.ok) {
            const data: NominatimResult = await res.json();
            selectSuggestion(data);
          }
        } catch {}
        setIsLocating(false);
      },
      () => {
        setIsLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  // If geocoding is disabled, render a plain input
  if (!enableGeocoding) {
    return (
      <input
        className={className}
        autoComplete={autocompleteMap[fieldType] || "on"}
        value={query}
        onChange={handleInputChange}
        {...props}
      />
    );
  }

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
        <input
          ref={inputRef}
          className={`${className} pl-9 pr-10`}
          autoComplete="off"
          value={query}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => { if (suggestions.length > 0) setIsOpen(true); }}
          {...props}
        />
        {isSearching && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 animate-spin" />
        )}
      </div>

      {/* Use My Location button */}
      <button
        type="button"
        onClick={handleUseLocation}
        disabled={isLocating}
        className="mt-1.5 inline-flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 font-medium disabled:opacity-50"
      >
        {isLocating ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : (
          <Navigation className="w-3.5 h-3.5" />
        )}
        {isLocating ? "Finding your location..." : "Use my current location"}
      </button>

      {/* Dropdown */}
      {isOpen && suggestions.length > 0 && (
        <div className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
          {suggestions.map((result, idx) => (
            <button
              key={result.place_id}
              type="button"
              onClick={() => selectSuggestion(result)}
              className={`w-full px-4 py-3 text-left text-sm hover:bg-gray-50 flex items-start gap-2 transition-colors ${
                idx === highlightedIndex ? "bg-gray-50" : ""
              }`}
            >
              <MapPin className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" />
              <span className="text-gray-700 line-clamp-2">{result.display_name}</span>
            </button>
          ))}
          <div className="px-4 py-2 text-[10px] text-gray-400 border-t">
            Powered by OpenStreetMap
          </div>
        </div>
      )}
    </div>
  );
}

export { autocompleteMap };
export type { AddressFieldType, AddressSelection };
