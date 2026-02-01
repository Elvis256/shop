"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import Section from "@/components/Section";
import ProductCard from "@/components/ProductCard";
import FilterPanel from "@/components/FilterPanel";
import { api } from "@/lib/api";
import { Search as SearchIcon, SlidersHorizontal, X } from "lucide-react";

interface Product {
  id: string;
  name: string;
  slug: string;
  price: number;
  rating: number;
  imageUrl?: string;
}

export default function SearchPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const query = searchParams.get("q") || "";

  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    if (query) {
      setLoading(true);
      api.search(query)
        .then((data) => {
          setProducts(data.products);
          setTotal(data.pagination.total);
        })
        .catch(console.error)
        .finally(() => setLoading(false));
    } else {
      setProducts([]);
      setLoading(false);
    }
  }, [query]);

  return (
    <Section>
      {/* Search Header */}
      <div className="mb-8">
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

        {query && (
          <p className="text-text-muted">
            {loading ? (
              "Searching..."
            ) : (
              <>
                Found <span className="font-semibold text-text">{total}</span> results for "
                <span className="font-semibold text-text">{query}</span>"
              </>
            )}
          </p>
        )}
      </div>

      {/* Results */}
      <div className="flex gap-8">
        {/* Sidebar Filters */}
        <aside className={`w-64 flex-shrink-0 ${showFilters ? "block" : "hidden lg:block"}`}>
          <FilterPanel />
        </aside>

        {/* Products Grid */}
        <div className="flex-1">
          {loading ? (
            <div className="grid-products">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="card animate-pulse">
                  <div className="aspect-square bg-gray-200 rounded-4 mb-4" />
                  <div className="h-4 bg-gray-200 rounded mb-2" />
                  <div className="h-4 bg-gray-200 rounded w-1/2" />
                </div>
              ))}
            </div>
          ) : products.length === 0 ? (
            <div className="text-center py-16">
              <SearchIcon className="w-16 h-16 mx-auto mb-4 text-text-muted" />
              <h3 className="mb-2">No products found</h3>
              <p className="text-text-muted mb-6">
                {query
                  ? "Try different keywords or browse our categories."
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
                  rating={product.rating}
                  imageUrl={product.imageUrl}
                  inStock={true}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </Section>
  );
}
