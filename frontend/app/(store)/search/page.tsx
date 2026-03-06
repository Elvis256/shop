"use client";

import { useEffect, useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import Section from "@/components/Section";
import ProductCard from "@/components/ProductCard";
import { api } from "@/lib/api";
import { Search as SearchIcon, SlidersHorizontal, Loader2, X } from "lucide-react";

interface Product {
  id: string;
  name: string;
  slug: string;
  price: number;
  comparePrice?: number;
  rating: number;
  imageUrl?: string | null;
  inStock?: boolean;
  category?: string | null;
  shippingBadge?: "From Abroad" | "Express";
}

interface Category {
  id: string;
  name: string;
  slug: string;
}

const SORT_OPTIONS = [
  { value: "relevance", label: "Relevance" },
  { value: "price-asc", label: "Price: Low to High" },
  { value: "price-desc", label: "Price: High to Low" },
  { value: "newest", label: "Newest" },
  { value: "rating", label: "Top Rated" },
];

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

function SearchContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const query = searchParams.get("q") || "";
  const minPrice = searchParams.get("minPrice") || "";
  const maxPrice = searchParams.get("maxPrice") || "";
  const inStockOnly = searchParams.get("inStock") === "true";
  const categorySlug = searchParams.get("category") || "";
  const sort = searchParams.get("sort") || "relevance";

  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [categories, setCategories] = useState<Category[]>([]);
  const [showFilters, setShowFilters] = useState(false);

  // Local filter state (applied on submit / toggle)
  const [minPriceInput, setMinPriceInput] = useState(minPrice);
  const [maxPriceInput, setMaxPriceInput] = useState(maxPrice);

  useEffect(() => {
    fetch(`${API_URL}/api/categories`)
      .then((r) => r.json())
      .then((d) => setCategories(d.categories || []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!query) {
      setProducts([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const params: Record<string, string> = {};
    if (minPrice) params.minPrice = minPrice;
    if (maxPrice) params.maxPrice = maxPrice;
    if (inStockOnly) params.inStock = "true";
    if (categorySlug) params.category = categorySlug;
    if (sort && sort !== "relevance") params.sort = sort;

    api
      .search(query, params)
      .then((data) => {
        setProducts(data.products as Product[]);
        setTotal(data.pagination?.total ?? data.products.length);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [query, minPrice, maxPrice, inStockOnly, categorySlug, sort]);

  function updateParam(key: string, value: string | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    router.push(`/search?${params.toString()}`);
  }

  function applyPriceFilter() {
    const params = new URLSearchParams(searchParams.toString());
    if (minPriceInput) params.set("minPrice", minPriceInput); else params.delete("minPrice");
    if (maxPriceInput) params.set("maxPrice", maxPriceInput); else params.delete("maxPrice");
    router.push(`/search?${params.toString()}`);
  }

  function clearFilters() {
    router.push(`/search?q=${encodeURIComponent(query)}`);
    setMinPriceInput("");
    setMaxPriceInput("");
  }

  const hasFilters = minPrice || maxPrice || inStockOnly || categorySlug || (sort && sort !== "relevance");

  return (
    <Section>
      {/* Search Header */}
      <div className="mb-6">
        <div className="flex items-center gap-4 mb-4">
          <div className="relative flex-1 max-w-xl">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-text-muted" />
            <input
              type="text"
              className="input pl-10"
              placeholder="Search products..."
              defaultValue={query}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  const value = (e.target as HTMLInputElement).value;
                  router.push(`/search?q=${encodeURIComponent(value)}`);
                }
              }}
            />
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="btn-secondary gap-2 lg:hidden"
          >
            <SlidersHorizontal className="w-5 h-5" />
            Filters
          </button>
        </div>

        {/* Sort bar */}
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={sort}
            onChange={(e) => updateParam("sort", e.target.value)}
            className="input py-1.5 text-sm max-w-[180px]"
          >
            {SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          {hasFilters && (
            <button onClick={clearFilters} className="flex items-center gap-1 text-sm text-text-muted hover:text-text">
              <X className="w-4 h-4" /> Clear filters
            </button>
          )}
          {query && !loading && (
            <p className="text-text-muted text-sm ml-auto">
              <span className="font-semibold text-text">{total}</span> results for &ldquo;
              <span className="font-semibold text-text">{query}</span>&rdquo;
            </p>
          )}
        </div>
      </div>

      {/* Results */}
      <div className="flex gap-8">
        {/* Sidebar Filters */}
        <aside className={`w-64 flex-shrink-0 space-y-5 ${showFilters ? "block" : "hidden lg:block"}`}>
          {/* Price Range */}
          <div className="bg-surface rounded-xl p-4">
            <h3 className="font-semibold text-sm mb-3">Price Range</h3>
            <div className="flex gap-2 mb-3">
              <input
                type="number"
                placeholder="Min"
                value={minPriceInput}
                onChange={(e) => setMinPriceInput(e.target.value)}
                className="input text-sm py-1.5 w-full"
              />
              <input
                type="number"
                placeholder="Max"
                value={maxPriceInput}
                onChange={(e) => setMaxPriceInput(e.target.value)}
                className="input text-sm py-1.5 w-full"
              />
            </div>
            <button onClick={applyPriceFilter} className="btn-primary text-sm py-1.5 w-full">
              Apply
            </button>
          </div>

          {/* In Stock Toggle */}
          <div className="bg-surface rounded-xl p-4">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={inStockOnly}
                onChange={(e) => updateParam("inStock", e.target.checked ? "true" : null)}
                className="w-4 h-4 accent-primary"
              />
              <span className="text-sm font-medium">In Stock Only</span>
            </label>
          </div>

          {/* Category Filter */}
          {categories.length > 0 && (
            <div className="bg-surface rounded-xl p-4">
              <h3 className="font-semibold text-sm mb-3">Category</h3>
              <div className="space-y-1">
                <button
                  onClick={() => updateParam("category", null)}
                  className={`w-full text-left text-sm px-2 py-1.5 rounded-lg ${!categorySlug ? "bg-primary/10 text-primary font-medium" : "hover:bg-surface-secondary"}`}
                >
                  All Categories
                </button>
                {categories.map((cat) => (
                  <button
                    key={cat.slug}
                    onClick={() => updateParam("category", cat.slug)}
                    className={`w-full text-left text-sm px-2 py-1.5 rounded-lg ${categorySlug === cat.slug ? "bg-primary/10 text-primary font-medium" : "hover:bg-surface-secondary"}`}
                  >
                    {cat.name}
                  </button>
                ))}
              </div>
            </div>
          )}
        </aside>

        {/* Products Grid */}
        <div className="flex-1">
          {loading ? (
            <div className="grid-products">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="animate-pulse">
                  <div className="aspect-[4/5] bg-surface rounded-24 mb-4" />
                  <div className="h-3 bg-surface rounded-full mb-2 w-1/3" />
                  <div className="h-4 bg-surface rounded-full mb-2" />
                  <div className="h-3 bg-surface rounded-full w-1/2" />
                </div>
              ))}
            </div>
          ) : products.length === 0 ? (
            <div className="text-center py-16">
              <SearchIcon className="w-16 h-16 mx-auto mb-4 text-text-muted" />
              <h3 className="mb-2">No products found</h3>
              <p className="text-text-muted mb-6">
                {query
                  ? "Try different keywords or adjust your filters."
                  : "Enter a search term to find products."}
              </p>
              <Link href="/category" className="btn-primary">
                Browse All Products
              </Link>
            </div>
          ) : (
            <div className="grid-products">
              {products.map((product) => (
                <ProductCard
                  key={product.id}
                  id={product.id}
                  name={product.name}
                  slug={product.slug}
                  price={product.price}
                  comparePrice={product.comparePrice}
                  rating={product.rating}
                  imageUrl={product.imageUrl}
                  category={product.category || undefined}
                  inStock={product.inStock !== false}
                  shippingBadge={product.shippingBadge}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </Section>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={
      <Section>
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </Section>
    }>
      <SearchContent />
    </Suspense>
  );
}
