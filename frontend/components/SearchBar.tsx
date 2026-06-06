"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Search, X, Loader2, TrendingUp, Tag } from "lucide-react";
import { useCurrency } from "@/contexts/CurrencyContext";
import ProductImage from "@/components/ProductImage";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

interface SearchProduct {
  name: string;
  slug: string;
  price: number;
  imageUrl?: string | null;
  type: "product";
}

interface SearchCategory {
  name: string;
  slug: string;
  imageUrl?: string | null;
  productCount: number;
  type: "category";
}

interface Suggestions {
  products: SearchProduct[];
  categories: SearchCategory[];
  popular: string[];
}

interface SearchBarProps {
  autoFocus?: boolean;
  onNavigate?: () => void;
  initialQuery?: string;
  variant?: "default" | "page";
}

export default function SearchBar({ autoFocus = false, onNavigate, initialQuery = "", variant = "default" }: SearchBarProps) {
  const router = useRouter();
  const { formatPrice } = useCurrency();
  const [query, setQuery] = useState(initialQuery);
  const [suggestions, setSuggestions] = useState<Suggestions | null>(null);
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
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (query.length < 1) {
      setSuggestions(null);
      return;
    }

    debounceRef.current = setTimeout(() => {
      fetchSuggestions(query);
    }, 250);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  const fetchSuggestions = async (term: string) => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/search/suggestions?q=${encodeURIComponent(term)}`);
      if (res.ok) {
        const data = await res.json();
        setSuggestions(data.suggestions || null);
        setShowDropdown(true);
      }
    } catch (error) {
      console.error("Search suggestions failed:", error);
    } finally {
      setLoading(false);
    }
  };

  const getSearchHistory = (): string[] => {
    try {
      return JSON.parse(localStorage.getItem("searchHistory") || "[]");
    } catch { return []; }
  };

  const saveToHistory = (term: string) => {
    try {
      const history = getSearchHistory().filter((h) => h !== term);
      history.unshift(term);
      localStorage.setItem("searchHistory", JSON.stringify(history.slice(0, 5)));
    } catch {}
  };

  const loadPopularSearches = async () => {
    if (query.length > 0) return;
    try {
      const res = await fetch(`${API_URL}/api/search/suggestions?q=`);
      if (res.ok) {
        const data = await res.json();
        const history = getSearchHistory();
        const merged = data.suggestions || { products: [], categories: [], popular: [] };
        if (history.length > 0) {
          merged.popular = [...history, ...merged.popular.filter((p: string) => !history.includes(p))].slice(0, 8);
        }
        setSuggestions(merged);
        setShowDropdown(true);
      }
    } catch {
      // silent
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      saveToHistory(query.trim());
      router.push(`/search?q=${encodeURIComponent(query)}`);
      setShowDropdown(false);
      onNavigate?.();
    }
  };

  const handlePopularClick = (term: string) => {
    setQuery(term);
    setShowDropdown(false);
    router.push(`/search?q=${encodeURIComponent(term)}`);
    onNavigate?.();
  };

  const hasResults = suggestions && (
    suggestions.products.length > 0 ||
    suggestions.categories.length > 0 ||
    suggestions.popular.length > 0
  );

  return (
    <div ref={wrapperRef} className="relative w-full">
      <form onSubmit={handleSubmit}>
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => {
              if (suggestions) setShowDropdown(true);
              else loadPopularSearches();
            }}
            placeholder="Search products..."
            className={`w-full pl-10 pr-10 text-sm border-0 rounded-full placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all ${
              variant === "page" ? "h-12 bg-white border border-gray-200 shadow-sm" : "h-10 bg-surface-secondary"
            }`}
            autoFocus={autoFocus}
            suppressHydrationWarning
          />
          {query && (
            <button
              type="button"
              onClick={() => {
                setQuery("");
                setSuggestions(null);
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

      {/* Dropdown */}
      {showDropdown && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-surface rounded-18 shadow-lg border border-border z-50 max-h-[70vh] overflow-auto">
          {loading && !suggestions ? (
            <div className="p-6 text-center text-text-muted">
              <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" />
              Searching...
            </div>
          ) : hasResults ? (
            <>
              {/* Popular Searches */}
              {suggestions!.popular.length > 0 && query.length === 0 && (
                <div className="p-3 border-b border-border">
                  <p className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <TrendingUp className="w-3.5 h-3.5" /> Popular Searches
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {suggestions!.popular.map((term) => (
                      <button
                        key={term}
                        onClick={() => handlePopularClick(term)}
                        className="px-3 py-1.5 text-xs bg-surface-secondary hover:bg-primary/10 hover:text-primary rounded-full transition-colors"
                      >
                        {term}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Categories */}
              {suggestions!.categories.length > 0 && (
                <div className="p-3 border-b border-border">
                  <p className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <Tag className="w-3.5 h-3.5" /> Categories
                  </p>
                  {suggestions!.categories.map((cat) => (
                    <Link
                      key={cat.slug}
                      href={`/category?cat=${cat.slug}`}
                      onClick={() => { setShowDropdown(false); setQuery(""); onNavigate?.(); }}
                      className="flex items-center gap-2 py-1.5 px-1 text-sm hover:bg-surface-secondary rounded-lg transition-colors"
                    >
                      <span className="text-text">{cat.name}</span>
                      <span className="text-xs text-text-muted">({cat.productCount})</span>
                    </Link>
                  ))}
                </div>
              )}

              {/* Products */}
              {suggestions!.products.length > 0 && (
                <div>
                  {suggestions!.products.map((product) => (
                    <Link
                      key={product.slug}
                      href={`/product/${product.slug}`}
                      onClick={() => { setShowDropdown(false); setQuery(""); onNavigate?.(); }}
                      className="flex items-center gap-3 p-3 hover:bg-surface-secondary transition-colors"
                    >
                      <div className="w-10 h-10 bg-surface-secondary rounded-12 overflow-hidden flex-shrink-0">
                        <ProductImage
                          src={product.imageUrl}
                          alt={product.name}
                          width={40}
                          height={40}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate text-text">{product.name}</p>
                        <p className="text-sm text-text-muted">{formatPrice(product.price)}</p>
                      </div>
                    </Link>
                  ))}
                  {query.length >= 2 && (
                    <Link
                      href={`/search?q=${encodeURIComponent(query)}`}
                      onClick={() => { setShowDropdown(false); onNavigate?.(); }}
                      className="block p-3 text-center text-sm text-primary hover:bg-surface-secondary border-t border-border rounded-b-18"
                    >
                      View all results →
                    </Link>
                  )}
                </div>
              )}
            </>
          ) : query.length >= 2 ? (
            <div className="p-6 text-center text-text-muted">
              No products found for &ldquo;{query}&rdquo;
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
