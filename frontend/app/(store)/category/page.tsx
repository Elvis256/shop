"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import ProductCard from "@/components/ProductCard";
import { Grid3X3, LayoutGrid, ChevronLeft, ChevronRight, X, Filter, Star, SlidersHorizontal } from "lucide-react";

const API_URL = typeof window !== "undefined" ? "" : (process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000");

interface Product {
  id: string;
  name: string;
  slug: string;
  price: number;
  comparePrice?: number;
  rating: number;
  imageUrl: string | null;
  inStock: boolean;
  stock?: number;
  isNew?: boolean;
  isBestseller?: boolean;
  shippingBadge?: "From Abroad" | "Express";
  flashSalePrice?: number | null;
  flashSaleEndsAt?: string | null;
}

interface Category {
  id: string;
  name: string;
  slug: string;
  description?: string;
  _count?: { products: number };
}

interface Filters {
  minPrice: string;
  maxPrice: string;
  minRating: number | null;
  inStock: boolean;
}

function CategoryContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const categorySlug = searchParams.get("cat");

  const [products, setProducts] = useState<Product[]>([]);
  const [category, setCategory] = useState<Category | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalProducts, setTotalProducts] = useState(0);
  const [sort, setSort] = useState("featured");
  const [gridSize, setGridSize] = useState<"small" | "large">("large");
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [filtersCollapsed, setFiltersCollapsed] = useState(false);

  // Advanced filters
  const [filters, setFilters] = useState<Filters>({
    minPrice: searchParams.get("minPrice") || "",
    maxPrice: searchParams.get("maxPrice") || "",
    minRating: searchParams.get("minRating") ? Number(searchParams.get("minRating")) : null,
    inStock: searchParams.get("inStock") === "true",
  });
  const [pendingPrice, setPendingPrice] = useState({ min: filters.minPrice, max: filters.maxPrice });

  const activeFilterCount = [
    filters.minPrice || filters.maxPrice,
    filters.minRating,
    filters.inStock,
  ].filter(Boolean).length;

  useEffect(() => {
    loadProducts();
    loadCategories();
  }, [categorySlug, page, sort, filters]);

  const loadCategories = async () => {
    try {
      const res = await fetch(`${API_URL}/api/categories`);
      if (res.ok) {
        const data = await res.json();
        setCategories(data.categories || []);
      }
    } catch (error) {
      console.error("Failed to load categories:", error);
    }
  };

  const loadProducts = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: "12",
        status: "ACTIVE",
      });

      if (categorySlug) {
        params.append("category", categorySlug);
      }

      if (sort === "price-asc") {
        params.append("sortBy", "price");
        params.append("sortOrder", "asc");
      } else if (sort === "price-desc") {
        params.append("sortBy", "price");
        params.append("sortOrder", "desc");
      } else if (sort === "rating") {
        params.append("sortBy", "rating");
        params.append("sortOrder", "desc");
      } else if (sort === "newest") {
        params.append("sortBy", "createdAt");
        params.append("sortOrder", "desc");
      }

      // Advanced filters
      if (filters.minPrice) params.append("minPrice", filters.minPrice);
      if (filters.maxPrice) params.append("maxPrice", filters.maxPrice);
      if (filters.minRating) params.append("minRating", String(filters.minRating));
      if (filters.inStock) params.append("inStock", "true");

      const res = await fetch(`${API_URL}/api/products?${params}`);
      if (res.ok) {
        const data = await res.json();
        setProducts(data.products || []);
        setTotalPages(data.pagination?.totalPages || data.totalPages || 1);
        setTotalProducts(data.pagination?.total || data.total || 0);
      }

      if (categorySlug) {
        const catRes = await fetch(`${API_URL}/api/categories/${categorySlug}`);
        if (catRes.ok) {
          const catData = await catRes.json();
          setCategory(catData);
        }
      } else {
        setCategory(null);
      }
    } catch (error) {
      console.error("Failed to load products:", error);
      setError("Failed to load products. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const updateFilters = (newFilters: Partial<Filters>) => {
    const updated = { ...filters, ...newFilters };
    setFilters(updated);
    setPage(1);

    // Update URL query params
    const params = new URLSearchParams();
    if (categorySlug) params.set("cat", categorySlug);
    if (updated.minPrice) params.set("minPrice", updated.minPrice);
    if (updated.maxPrice) params.set("maxPrice", updated.maxPrice);
    if (updated.minRating) params.set("minRating", String(updated.minRating));
    if (updated.inStock) params.set("inStock", "true");
    router.replace(`/category?${params.toString()}`, { scroll: false });
  };

  const clearFilters = () => {
    const cleared: Filters = { minPrice: "", maxPrice: "", minRating: null, inStock: false };
    setFilters(cleared);
    setPendingPrice({ min: "", max: "" });
    setPage(1);
    const params = new URLSearchParams();
    if (categorySlug) params.set("cat", categorySlug);
    router.replace(`/category?${params.toString()}`, { scroll: false });
  };

  const handleApplyPrice = () => {
    updateFilters({ minPrice: pendingPrice.min, maxPrice: pendingPrice.max });
  };

  const FilterPanel = ({ onClose }: { onClose?: () => void }) => (
    <div className="space-y-6">
      {/* Header for mobile */}
      {onClose && (
        <div className="flex items-center justify-between pb-4 border-b mb-4 lg:hidden">
          <h3 className="text-lg font-semibold">Filters</h3>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* Categories */}
      <div>
        <h4 className="font-medium text-gray-900 mb-3 text-sm">Categories</h4>
        <nav className="space-y-1">
          <Link
            href="/category"
            onClick={onClose}
            className={`flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors ${
              !categorySlug 
                ? "bg-gray-900 text-white" 
                : "text-gray-600 hover:bg-gray-50"
            }`}
          >
            <span>All Products</span>
          </Link>
          {categories.map((cat) => (
            <Link
              key={cat.id}
              href={`/category/${cat.slug}`}
              onClick={onClose}
              className={`flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors ${
                categorySlug === cat.slug 
                  ? "bg-gray-900 text-white" 
                  : "text-gray-600 hover:bg-gray-50"
              }`}
            >
              <span>{cat.name}</span>
            </Link>
          ))}
        </nav>
      </div>

      {/* Price Range */}
      <div>
        <h4 className="font-medium text-gray-900 mb-3 text-sm">Price Range (UGX)</h4>
        <div className="flex items-center gap-2">
          <input
            type="number"
            placeholder="Min"
            value={pendingPrice.min}
            onChange={(e) => setPendingPrice((p) => ({ ...p, min: e.target.value }))}
            className="w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-200"
            min="0"
          />
          <span className="text-gray-400 text-sm">—</span>
          <input
            type="number"
            placeholder="Max"
            value={pendingPrice.max}
            onChange={(e) => setPendingPrice((p) => ({ ...p, max: e.target.value }))}
            className="w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-200"
            min="0"
          />
        </div>
        <button
          onClick={handleApplyPrice}
          className="mt-2 w-full px-3 py-1.5 text-sm bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors"
        >
          Apply
        </button>
      </div>

      {/* Rating Filter */}
      <div>
        <h4 className="font-medium text-gray-900 mb-3 text-sm">Minimum Rating</h4>
        <div className="space-y-1">
          {[4, 3, 2, 1].map((rating) => (
            <button
              key={rating}
              onClick={() => {
                updateFilters({ minRating: filters.minRating === rating ? null : rating });
                onClose?.();
              }}
              className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                filters.minRating === rating
                  ? "bg-yellow-50 border border-yellow-200 text-yellow-700"
                  : "text-gray-600 hover:bg-gray-50"
              }`}
            >
              <div className="flex items-center gap-0.5">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star
                    key={i}
                    className={`w-3.5 h-3.5 ${i < rating ? "text-yellow-400 fill-yellow-400" : "text-gray-200"}`}
                  />
                ))}
              </div>
              <span>{rating}+ stars</span>
            </button>
          ))}
        </div>
      </div>

      {/* In Stock Toggle */}
      <div>
        <label className="flex items-center justify-between px-3 py-3 border rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
          <span className="text-sm font-medium text-gray-900">In Stock Only</span>
          <div className="relative">
            <input
              type="checkbox"
              className="sr-only"
              checked={filters.inStock}
              onChange={(e) => updateFilters({ inStock: e.target.checked })}
            />
            <div
              onClick={() => updateFilters({ inStock: !filters.inStock })}
              className={`w-10 h-5 rounded-full transition-colors cursor-pointer ${filters.inStock ? "bg-green-500" : "bg-gray-300"}`}
            >
              <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${filters.inStock ? "translate-x-5" : "translate-x-0.5"}`} />
            </div>
          </div>
        </label>
      </div>

      {/* Clear Filters */}
      {activeFilterCount > 0 && (
        <button
          onClick={() => {
            clearFilters();
            onClose?.();
          }}
          className="w-full px-3 py-2 text-sm text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors"
        >
          Clear All Filters ({activeFilterCount})
        </button>
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="border-b">
        <div className="container py-6">
          <nav className="flex items-center gap-2 text-sm text-gray-400 mb-3">
            <Link href="/" className="hover:text-gray-900">Home</Link>
            <span>/</span>
            <Link href="/category" className="hover:text-gray-900">Shop</Link>
            {category && (
              <>
                <span>/</span>
                <span className="text-gray-900">{category.name}</span>
              </>
            )}
          </nav>
          <h1 className="text-2xl font-semibold text-gray-900">
            {category?.name || "All Products"}
          </h1>
        </div>
      </div>

      <div className="container py-8">
        <div className="flex gap-8">
          {/* Desktop Sidebar */}
          <aside className={`hidden md:block flex-shrink-0 transition-all ${filtersCollapsed ? "md:w-0 overflow-hidden" : "md:w-48 lg:w-56"}`}>
            <div className="sticky top-24">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                  <SlidersHorizontal className="w-4 h-4" />
                  Filters
                  {activeFilterCount > 0 && (
                    <span className="bg-gray-900 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center">
                      {activeFilterCount}
                    </span>
                  )}
                </h3>
                <button
                  onClick={() => setFiltersCollapsed(true)}
                  className="p-1 text-gray-400 hover:text-gray-600 rounded"
                  title="Collapse filters"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <FilterPanel />
            </div>
          </aside>

          {/* Collapsed sidebar re-open button (desktop) */}
          {filtersCollapsed && (
            <button
              onClick={() => setFiltersCollapsed(false)}
              className="hidden md:flex items-center gap-1 self-start sticky top-24 px-2 py-2 text-sm border rounded-lg hover:bg-gray-50"
              title="Show filters"
            >
              <SlidersHorizontal className="w-4 h-4" />
            </button>
          )}

          {/* Mobile Filters Drawer */}
          {mobileFiltersOpen && (
            <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Product filters">
              <div className="absolute inset-0 bg-black/40" onClick={() => setMobileFiltersOpen(false)} />
              <div className="absolute right-0 top-0 bottom-0 w-80 max-w-full bg-white p-5 overflow-y-auto shadow-xl">
                <FilterPanel onClose={() => setMobileFiltersOpen(false)} />
              </div>
            </div>
          )}

          {/* Product Grid */}
          <div className="flex-1 min-w-0">
            {/* Toolbar */}
            <div className="flex items-center justify-between gap-4 mb-6 pb-4 border-b">
              <div className="flex items-center gap-3">
                {/* Mobile Filter Button */}
                <button
                  onClick={() => setMobileFiltersOpen(true)}
                  className="lg:hidden flex items-center gap-2 px-3 py-2 text-sm font-medium border rounded-lg hover:bg-gray-50 relative"
                >
                  <Filter className="w-4 h-4" />
                  Filters
                  {activeFilterCount > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 bg-gray-900 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center" aria-label={`${activeFilterCount} active filters`}>
                      {activeFilterCount}
                    </span>
                  )}
                </button>
                <p className="text-sm text-gray-500" aria-live="polite">
                  {loading ? "Loading..." : `${totalProducts} products`}
                </p>
              </div>
              <div className="flex items-center gap-3">
                {/* Grid Size Toggle */}
                <div className="hidden sm:flex items-center border rounded-lg" role="group" aria-label="Grid size">
                  <button
                    onClick={() => setGridSize("large")}
                    className={`p-2 ${gridSize === "large" ? "bg-gray-100" : ""}`}
                    aria-label="Large grid"
                    aria-pressed={gridSize === "large"}
                  >
                    <LayoutGrid className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setGridSize("small")}
                    className={`p-2 ${gridSize === "small" ? "bg-gray-100" : ""}`}
                    aria-label="Small grid"
                    aria-pressed={gridSize === "small"}
                  >
                    <Grid3X3 className="w-4 h-4" />
                  </button>
                </div>
                {/* Sort */}
                <select
                  className="px-3 py-2 text-sm border rounded-lg bg-white"
                  value={sort}
                  onChange={(e) => {
                    setSort(e.target.value);
                    setPage(1);
                  }}
                >
                  <option value="featured">Featured</option>
                  <option value="price-asc">Price: Low to High</option>
                  <option value="price-desc">Price: High to Low</option>
                  <option value="rating">Top Rated</option>
                  <option value="newest">Newest</option>
                </select>
              </div>
            </div>

            {/* Active Filters Bar */}
            {activeFilterCount > 0 && (
              <div className="flex flex-wrap items-center gap-2 mb-4">
                <span className="text-xs text-gray-500">Active filters:</span>
                {(filters.minPrice || filters.maxPrice) && (
                  <span className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-gray-100 rounded-full">
                    Price: {filters.minPrice || "0"} — {filters.maxPrice || "∞"} UGX
                    <button onClick={() => { updateFilters({ minPrice: "", maxPrice: "" }); setPendingPrice({ min: "", max: "" }); }} className="hover:text-red-500">
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                )}
                {filters.minRating && (
                  <span className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-yellow-50 rounded-full">
                    {filters.minRating}+ stars
                    <button onClick={() => updateFilters({ minRating: null })} className="hover:text-red-500">
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                )}
                {filters.inStock && (
                  <span className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-green-50 rounded-full">
                    In Stock
                    <button onClick={() => updateFilters({ inStock: false })} className="hover:text-red-500">
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                )}
                <button onClick={clearFilters} className="text-xs text-red-500 hover:underline ml-1">
                  Clear all
                </button>
              </div>
            )}

            {/* Products */}
            {loading ? (
              <div className={`grid gap-4 ${gridSize === "small" ? "grid-cols-2 sm:grid-cols-3 xl:grid-cols-4" : "grid-cols-2 lg:grid-cols-3"}`}>
                {Array.from({ length: 9 }).map((_, i) => (
                  <div key={i} className="animate-pulse">
                    <div className="aspect-square bg-gray-100 rounded-lg mb-3" />
                    <div className="h-4 bg-gray-100 rounded mb-2" />
                    <div className="h-4 bg-gray-100 rounded w-1/2" />
                  </div>
                ))}
              </div>
            ) : error ? (
              <div className="text-center py-16">
                <p className="text-red-500 mb-4">{error}</p>
                <button onClick={() => { setPage(1); loadProducts(); }} className="text-sm underline">
                  Try again
                </button>
              </div>
            ) : products.length > 0 ? (
              <div className={`grid gap-4 ${gridSize === "small" ? "grid-cols-2 sm:grid-cols-3 xl:grid-cols-4" : "grid-cols-2 lg:grid-cols-3"}`}>
                {products.map((product) => (
                  <ProductCard
                    key={product.slug}
                    id={product.id}
                    name={product.name}
                    slug={product.slug}
                    price={Number(product.price)}
                    comparePrice={product.comparePrice ? Number(product.comparePrice) : undefined}
                    rating={Number(product.rating)}
                    imageUrl={product.imageUrl}
                    inStock={product.inStock}
                    stock={product.stock}
                    isNew={product.isNew}
                    isBestseller={product.isBestseller}
                    shippingBadge={product.shippingBadge}
                    flashSalePrice={product.flashSalePrice}
                    flashSaleEndsAt={product.flashSaleEndsAt}
                  />
                ))}
              </div>
            ) : (
              <div className="text-center py-16">
                <p className="text-gray-500 mb-4">No products found</p>
                {activeFilterCount > 0 ? (
                  <button onClick={clearFilters} className="text-sm underline">
                    Clear filters
                  </button>
                ) : (
                  <Link href="/category" className="text-sm underline">
                    View all products
                  </Link>
                )}
              </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <nav aria-label="Pagination" className="flex items-center justify-center gap-2 mt-10">
                <button
                  className="px-4 py-2 text-sm border rounded-lg hover:bg-gray-50 disabled:opacity-40"
                  disabled={page === 1}
                  onClick={() => setPage((p) => p - 1)}
                  aria-label="Previous page"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-sm text-gray-500 px-4">
                  Page {page} of {totalPages}
                </span>
                <button
                  className="px-4 py-2 text-sm border rounded-lg hover:bg-gray-50 disabled:opacity-40"
                  disabled={page === totalPages}
                  onClick={() => setPage((p) => p + 1)}
                  aria-label="Next page"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </nav>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function CategoryPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-2 border-gray-900 border-t-transparent rounded-full" />
      </div>
    }>
      <CategoryContent />
    </Suspense>
  );
}
