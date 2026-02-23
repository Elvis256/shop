"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import ProductCard from "@/components/ProductCard";
import { Grid3X3, LayoutGrid, ChevronLeft, ChevronRight, X, Filter } from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

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
}

interface Category {
  id: string;
  name: string;
  slug: string;
  description?: string;
  _count?: { products: number };
}

function CategoryContent() {
  const searchParams = useSearchParams();
  const categorySlug = searchParams.get("cat");

  const [products, setProducts] = useState<Product[]>([]);
  const [category, setCategory] = useState<Category | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalProducts, setTotalProducts] = useState(0);
  const [sort, setSort] = useState("featured");
  const [gridSize, setGridSize] = useState<"small" | "large">("large");
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  useEffect(() => {
    loadProducts();
    loadCategories();
  }, [categorySlug, page, sort]);

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

      const res = await fetch(`${API_URL}/api/products?${params}`);
      if (res.ok) {
        const data = await res.json();
        setProducts(data.products || []);
        setTotalPages(data.totalPages || 1);
        setTotalProducts(data.total || 0);
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
    } finally {
      setLoading(false);
    }
  };

  const CategorySidebar = ({ onClose }: { onClose?: () => void }) => (
    <div>
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
              href={`/category?cat=${cat.slug}`}
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
          <aside className="hidden md:block md:w-48 lg:w-56 flex-shrink-0">
            <div className="sticky top-24">
              <CategorySidebar />
            </div>
          </aside>

          {/* Mobile Filters Drawer */}
          {mobileFiltersOpen && (
            <div className="fixed inset-0 z-50 lg:hidden">
              <div className="absolute inset-0 bg-black/40" onClick={() => setMobileFiltersOpen(false)} />
              <div className="absolute right-0 top-0 bottom-0 w-72 max-w-full bg-white p-5 overflow-y-auto shadow-xl">
                <CategorySidebar onClose={() => setMobileFiltersOpen(false)} />
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
                  className="lg:hidden flex items-center gap-2 px-3 py-2 text-sm font-medium border rounded-lg hover:bg-gray-50"
                >
                  <Filter className="w-4 h-4" />
                  Filters
                </button>
                <p className="text-sm text-gray-500">
                  {loading ? "Loading..." : `${totalProducts} products`}
                </p>
              </div>
              <div className="flex items-center gap-3">
                {/* Grid Size Toggle */}
                <div className="hidden sm:flex items-center border rounded-lg">
                  <button
                    onClick={() => setGridSize("large")}
                    className={`p-2 ${gridSize === "large" ? "bg-gray-100" : ""}`}
                  >
                    <LayoutGrid className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setGridSize("small")}
                    className={`p-2 ${gridSize === "small" ? "bg-gray-100" : ""}`}
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
                  />
                ))}
              </div>
            ) : (
              <div className="text-center py-16">
                <p className="text-gray-500 mb-4">No products found</p>
                <Link href="/category" className="text-sm underline">
                  View all products
                </Link>
              </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-10">
                <button
                  className="px-4 py-2 text-sm border rounded-lg hover:bg-gray-50 disabled:opacity-40"
                  disabled={page === 1}
                  onClick={() => setPage((p) => p - 1)}
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
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
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
