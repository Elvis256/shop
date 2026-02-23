"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Search, X, Loader2 } from "lucide-react";
import { useCurrency } from "@/contexts/CurrencyContext";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

interface SearchResult {
  id: string;
  name: string;
  slug: string;
  price: number;
  imageUrl?: string | null;
}

export default function SearchBar() {
  const router = useRouter();
  const { formatPrice } = useCurrency();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    if (query.length < 2) {
      setResults([]);
      setShowDropdown(false);
      return;
    }

    debounceRef.current = setTimeout(() => {
      searchProducts(query);
    }, 300);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [query]);

  const searchProducts = async (term: string) => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/search?q=${encodeURIComponent(term)}&limit=5`);
      if (res.ok) {
        const data = await res.json();
        setResults(data.products || []);
        setShowDropdown(true);
      }
    } catch (error) {
      console.error("Search failed:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      router.push(`/search?q=${encodeURIComponent(query)}`);
      setShowDropdown(false);
    }
  };

  return (
    <div ref={wrapperRef} className="relative w-full">
      <form onSubmit={handleSubmit}>
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => results.length > 0 && setShowDropdown(true)}
            placeholder="Search..."
            className="w-full h-10 pl-10 pr-10 text-sm bg-surface-secondary border-0 rounded-full placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
            suppressHydrationWarning
          />
          {query && (
            <button
              type="button"
              onClick={() => {
                setQuery("");
                setResults([]);
                setShowDropdown(false);
              }}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-text-muted hover:text-text"
              suppressHydrationWarning
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <X className="w-4 h-4" />}
            </button>
          )}
        </div>
      </form>

      {/* Dropdown Results */}
      {showDropdown && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-surface rounded-18 shadow-lg border border-border z-50 max-h-96 overflow-auto">
          {results.length > 0 ? (
            <>
              {results.map((product) => (
                <Link
                  key={product.id}
                  href={`/product/${product.slug}`}
                  onClick={() => {
                    setShowDropdown(false);
                    setQuery("");
                  }}
                  className="flex items-center gap-3 p-3 hover:bg-surface-secondary transition-colors first:rounded-t-18"
                >
                  <div className="w-12 h-12 bg-surface-secondary rounded-12 overflow-hidden flex-shrink-0">
                    {product.imageUrl ? (
                      <img
                        src={product.imageUrl}
                        alt={product.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-text-muted">
                        <Search className="w-4 h-4" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate text-text">{product.name}</p>
                    <p className="text-sm text-text-muted">{formatPrice(Number(product.price))}</p>
                  </div>
                </Link>
              ))}
              <Link
                href={`/search?q=${encodeURIComponent(query)}`}
                onClick={() => setShowDropdown(false)}
                className="block p-3 text-center text-sm text-primary hover:bg-surface-secondary border-t border-border rounded-b-18"
              >
                View all results →
              </Link>
            </>
          ) : loading ? (
            <div className="p-6 text-center text-text-muted">
              <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" />
              Searching...
            </div>
          ) : (
            <div className="p-6 text-center text-text-muted">
              No products found
            </div>
          )}
        </div>
      )}
    </div>
  );
}
