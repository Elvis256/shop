"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Section from "@/components/Section";
import FilterPanel from "@/components/FilterPanel";
import ProductCard from "@/components/ProductCard";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

interface Product {
  id: string;
  name: string;
  slug: string;
  price: number;
  rating: number;
  imageUrl: string | null;
  inStock: boolean;
}

interface Category {
  id: string;
  name: string;
  slug: string;
}

function CategoryContent() {
  const searchParams = useSearchParams();
  const categorySlug = searchParams.get("cat");

  const [products, setProducts] = useState<Product[]>([]);
  const [category, setCategory] = useState<Category | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [sort, setSort] = useState("featured");

  useEffect(() => {
    loadProducts();
  }, [categorySlug, page, sort]);

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
      }

      if (categorySlug) {
        const catRes = await fetch(`${API_URL}/api/categories/${categorySlug}`);
        if (catRes.ok) {
          const catData = await catRes.json();
          setCategory(catData);
        }
      }
    } catch (error) {
      console.error("Failed to load products:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Section title={category?.name || "All Products"}>
      <div className="flex gap-8">
        {/* Filters Sidebar */}
        <aside className="hidden lg:block w-64 flex-shrink-0">
          <FilterPanel />
        </aside>

        {/* Product Grid */}
        <div className="flex-1">
          <div className="flex items-center justify-between mb-6">
            <p className="text-text-muted">
              {loading ? (
                "Loading..."
              ) : (
                <>
                  Showing <span className="font-semibold text-text">{products.length}</span> products
                </>
              )}
            </p>
            <select
              className="input-select w-48"
              value={sort}
              onChange={(e) => {
                setSort(e.target.value);
                setPage(1);
              }}
            >
              <option value="featured">Sort by: Featured</option>
              <option value="price-asc">Price: Low to High</option>
              <option value="price-desc">Price: High to Low</option>
              <option value="rating">Rating</option>
              <option value="newest">Newest</option>
            </select>
          </div>

          {loading ? (
            <div className="grid-products">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="card animate-pulse">
                  <div className="aspect-square bg-gray-100 rounded-lg mb-4" />
                  <div className="h-4 bg-gray-100 rounded mb-2" />
                  <div className="h-4 bg-gray-100 rounded w-1/2" />
                </div>
              ))}
            </div>
          ) : products.length > 0 ? (
            <div className="grid-products">
              {products.map((product) => (
                <ProductCard
                  key={product.slug}
                  id={product.id}
                  name={product.name}
                  slug={product.slug}
                  price={Number(product.price)}
                  rating={Number(product.rating)}
                  imageUrl={product.imageUrl}
                  inStock={product.inStock}
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-gray-500">
              No products found
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex justify-center gap-2 mt-12">
              <button
                className="btn-secondary"
                disabled={page === 1}
                onClick={() => setPage((p) => p - 1)}
              >
                Previous
              </button>
              {Array.from({ length: Math.min(5, totalPages) }).map((_, i) => (
                <button
                  key={i}
                  className={page === i + 1 ? "btn-primary" : "btn-secondary"}
                  onClick={() => setPage(i + 1)}
                >
                  {i + 1}
                </button>
              ))}
              <button
                className="btn-secondary"
                disabled={page === totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </button>
            </div>
          )}
        </div>
      </div>
    </Section>
  );
}

export default function CategoryPage() {
  return (
    <Suspense fallback={<Section><div className="text-center py-12">Loading...</div></Section>}>
      <CategoryContent />
    </Suspense>
  );
}
