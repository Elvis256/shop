"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import ProductImage from "@/components/ProductImage";
import { Clock, Tag, ArrowRight, SlidersHorizontal } from "lucide-react";

const API_URL = typeof window !== "undefined" ? "" : (process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000");

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Product {
  id: string;
  name: string;
  slug: string;
  price: number;
  comparePrice?: number | null;
  currency?: string;
  rating?: number;
  imageUrl?: string | null;
  category?: string;
  inStock?: boolean;
  stock?: number;
  isNew?: boolean;
  isBestseller?: boolean;
  badgeText?: string;
  shippingBadge?: string;
  flashSalePrice?: number | null;
  flashSaleEndsAt?: string | null;
  createdAt?: string;
}

interface Category {
  id: string;
  name: string;
  slug: string;
}

type SortOption = "discount" | "price-asc" | "price-desc" | "newest";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function discountPercent(original: number, sale: number): number {
  if (!original || original <= sale) return 0;
  return Math.round(((original - sale) / original) * 100);
}

async function fetchJSON<T>(endpoint: string): Promise<T> {
  const res = await fetch(`${API_URL}${endpoint}`, {
    credentials: "include",
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

// ---------------------------------------------------------------------------
// Countdown Timer
// ---------------------------------------------------------------------------

function CountdownTimer({ endsAt }: { endsAt: string }) {
  const [remaining, setRemaining] = useState(() =>
    Math.max(0, Math.floor((new Date(endsAt).getTime() - Date.now()) / 1000))
  );

  useEffect(() => {
    if (remaining <= 0) return;
    const id = setInterval(() => {
      setRemaining((prev) => {
        const next = Math.max(
          0,
          Math.floor((new Date(endsAt).getTime() - Date.now()) / 1000)
        );
        if (next <= 0) clearInterval(id);
        return next;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [endsAt, remaining]);

  if (remaining <= 0) {
    return (
      <span className="text-xs text-gray-400 font-medium">Expired</span>
    );
  }

  const days = Math.floor(remaining / 86400);
  const hours = Math.floor((remaining % 86400) / 3600);
  const minutes = Math.floor((remaining % 3600) / 60);
  const seconds = remaining % 60;

  const label =
    days > 0
      ? `${days}d ${hours}h ${minutes}m`
      : `${hours}h ${minutes}m ${seconds}s`;

  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-red-600">
      <Clock size={12} />
      Ends in {label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Section Countdown (nearest flash sale)
// ---------------------------------------------------------------------------

function SectionCountdown({ endsAt }: { endsAt: string }) {
  const [remaining, setRemaining] = useState(() =>
    Math.max(0, Math.floor((new Date(endsAt).getTime() - Date.now()) / 1000))
  );

  useEffect(() => {
    if (remaining <= 0) return;
    const id = setInterval(() => {
      setRemaining(
        Math.max(
          0,
          Math.floor((new Date(endsAt).getTime() - Date.now()) / 1000)
        )
      );
    }, 1000);
    return () => clearInterval(id);
  }, [endsAt, remaining]);

  if (remaining <= 0) return null;

  const days = Math.floor(remaining / 86400);
  const hours = Math.floor((remaining % 86400) / 3600);
  const minutes = Math.floor((remaining % 3600) / 60);
  const seconds = remaining % 60;

  const pad = (n: number) => String(n).padStart(2, "0");

  return (
    <div className="flex items-center gap-2 text-sm">
      <Clock size={16} className="text-red-600" />
      <span className="text-gray-600">Ends in</span>
      {days > 0 && (
        <span className="bg-gray-900 text-white text-sm font-mono font-bold px-2 py-1 rounded">
          {days}d
        </span>
      )}
      <span className="bg-gray-900 text-white text-sm font-mono font-bold px-2 py-1 rounded">
        {pad(hours)}h
      </span>
      <span className="bg-gray-900 text-white text-sm font-mono font-bold px-2 py-1 rounded">
        {pad(minutes)}m
      </span>
      <span className="bg-gray-900 text-white text-sm font-mono font-bold px-2 py-1 rounded">
        {pad(seconds)}s
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Skeleton Card
// ---------------------------------------------------------------------------

function SkeletonCard() {
  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden bg-white animate-pulse">
      <div className="aspect-square bg-gray-200" />
      <div className="p-3 space-y-2">
        <div className="h-3 bg-gray-200 rounded w-1/3" />
        <div className="h-4 bg-gray-200 rounded w-2/3" />
        <div className="h-5 bg-gray-200 rounded w-1/2" />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Product Deal Card
// ---------------------------------------------------------------------------

function DealCard({ product }: { product: Product }) {
  const salePrice = product.flashSalePrice ?? product.price;
  const originalPrice = product.flashSalePrice
    ? product.price
    : product.comparePrice ?? product.price;
  const pctOff = discountPercent(originalPrice, salePrice);

  return (
    <Link href={`/product/${product.slug}`}>
      <div className="border border-gray-200 rounded-lg overflow-hidden hover:shadow-md transition-shadow bg-white">
        {/* Image */}
        <div className="aspect-square relative bg-gray-50">
          <ProductImage
            src={product.imageUrl}
            alt={product.name}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
            className="object-cover"
          />
          {pctOff > 0 && (
            <span className="absolute top-2 left-2 bg-red-600 text-white text-xs font-bold px-2 py-1 rounded">
              -{pctOff}%
            </span>
          )}
        </div>

        {/* Info */}
        <div className="p-3">
          {product.category && (
            <p className="text-sm text-gray-500">{product.category}</p>
          )}
          <h3 className="text-sm font-medium text-gray-900 line-clamp-2">
            {product.name}
          </h3>
          <div className="mt-1 flex items-center gap-2">
            <span className="text-lg font-bold text-red-600">
              UGX {salePrice.toLocaleString()}
            </span>
            {pctOff > 0 && (
              <span className="text-sm text-gray-400 line-through">
                UGX {originalPrice.toLocaleString()}
              </span>
            )}
          </div>
          {product.flashSaleEndsAt && (
            <div className="mt-1">
              <CountdownTimer endsAt={product.flashSaleEndsAt} />
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}

// ---------------------------------------------------------------------------
// Main Client Component
// ---------------------------------------------------------------------------

export default function SalesPageClient() {
  const [flashProducts, setFlashProducts] = useState<Product[]>([]);
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);

  const [loadingFlash, setLoadingFlash] = useState(true);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [sortOption, setSortOption] = useState<SortOption>("discount");

  // ---- Data fetching ----

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const [flashRes, productsRes, catsRes] = await Promise.all([
          fetchJSON<{ products?: Product[] } | Product[]>(
            "/api/products?flashSale=true&limit=20&status=ACTIVE"
          ),
          fetchJSON<{ products?: Product[] } | Product[]>(
            "/api/products?limit=40&status=ACTIVE"
          ),
          fetchJSON<{ categories?: Category[] } | Category[]>(
            "/api/categories"
          ),
        ]);

        if (cancelled) return;

        // Normalise responses — API may wrap in an object or return bare array
        const flashArr = Array.isArray(flashRes)
          ? flashRes
          : flashRes.products ?? [];
        const allArr = Array.isArray(productsRes)
          ? productsRes
          : productsRes.products ?? [];
        const catsArr = Array.isArray(catsRes)
          ? catsRes
          : catsRes.categories ?? [];

        setFlashProducts(flashArr);
        setAllProducts(allArr);
        setCategories(catsArr);
      } catch (err) {
        if (!cancelled) {
          console.error("Failed to load sales data:", err);
          setError("Unable to load deals right now. Please try again later.");
        }
      } finally {
        if (!cancelled) {
          setLoadingFlash(false);
          setLoadingProducts(false);
        }
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  // ---- Derived data ----

  const discountedProducts = useMemo(() => {
    return allProducts.filter(
      (p) =>
        (p.comparePrice && p.comparePrice > p.price) ||
        (p.flashSalePrice && p.flashSalePrice < p.price)
    );
  }, [allProducts]);

  // Combine flash + discounted for filtering / sorting
  const allDeals = useMemo(() => {
    const seen = new Set<string>();
    const combined: Product[] = [];

    for (const p of flashProducts) {
      if (!seen.has(p.id)) {
        seen.add(p.id);
        combined.push(p);
      }
    }
    for (const p of discountedProducts) {
      if (!seen.has(p.id)) {
        seen.add(p.id);
        combined.push(p);
      }
    }
    return combined;
  }, [flashProducts, discountedProducts]);

  const nearestFlashEnd = useMemo(() => {
    const ends = flashProducts
      .filter((p) => p.flashSaleEndsAt)
      .map((p) => new Date(p.flashSaleEndsAt!).getTime())
      .filter((t) => t > Date.now())
      .sort((a, b) => a - b);
    return ends.length > 0 ? new Date(ends[0]).toISOString() : null;
  }, [flashProducts]);

  const availableCategories = useMemo(() => {
    const slugsInDeals = new Set(
      allDeals.map((p) => p.category?.toLowerCase()).filter(Boolean)
    );
    return categories.filter(
      (c) =>
        slugsInDeals.has(c.slug?.toLowerCase()) ||
        slugsInDeals.has(c.name?.toLowerCase())
    );
  }, [categories, allDeals]);

  const getEffectiveDiscount = useCallback((p: Product) => {
    const sale = p.flashSalePrice ?? p.price;
    const orig = p.flashSalePrice ? p.price : p.comparePrice ?? p.price;
    return discountPercent(orig, sale);
  }, []);

  const filteredAndSorted = useMemo(() => {
    const items =
      selectedCategory === "all"
        ? [...allDeals]
        : allDeals.filter(
            (p) =>
              p.category?.toLowerCase() === selectedCategory.toLowerCase()
          );

    switch (sortOption) {
      case "discount":
        items.sort((a, b) => getEffectiveDiscount(b) - getEffectiveDiscount(a));
        break;
      case "price-asc":
        items.sort(
          (a, b) =>
            (a.flashSalePrice ?? a.price) - (b.flashSalePrice ?? b.price)
        );
        break;
      case "price-desc":
        items.sort(
          (a, b) =>
            (b.flashSalePrice ?? b.price) - (a.flashSalePrice ?? a.price)
        );
        break;
      case "newest":
        items.sort(
          (a, b) =>
            new Date(b.createdAt ?? 0).getTime() -
            new Date(a.createdAt ?? 0).getTime()
        );
        break;
    }

    return items;
  }, [allDeals, selectedCategory, sortOption, getEffectiveDiscount]);

  // ---- Render helpers ----

  const skeletonGrid = (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
      {Array.from({ length: 8 }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );

  // ---- Render ----

  return (
    <div className="bg-gray-50 min-h-screen">
      {/* Hero Banner */}
      <section className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 py-12 sm:py-16 text-center">
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900">
            Sales &amp; Deals
          </h1>
          <p className="mt-2 text-gray-500 text-base sm:text-lg max-w-md mx-auto">
            Don&apos;t miss out on these limited-time offers
          </p>
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-4 py-8 space-y-12">
        {/* Error state */}
        {error && (
          <div className="bg-white border border-red-200 text-red-700 rounded-lg p-6 text-center">
            {error}
          </div>
        )}

        {/* ---- Flash Sale Section ---- */}
        <section>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
            <div>
              <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                <span className="text-red-600">⚡</span> Flash Sales
              </h2>
              <p className="text-sm text-gray-500 mt-0.5">
                Limited-time prices — grab them before they&apos;re gone
              </p>
            </div>
            {nearestFlashEnd && <SectionCountdown endsAt={nearestFlashEnd} />}
          </div>

          {loadingFlash ? (
            skeletonGrid
          ) : flashProducts.length === 0 ? (
            <div className="bg-white border border-gray-200 rounded-lg p-8 text-center">
              <p className="text-gray-500">
                No active flash sales right now. Check back soon!
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {flashProducts.map((product) => (
                <DealCard key={product.id} product={product} />
              ))}
            </div>
          )}
        </section>

        {/* ---- Price Drops / Discounted Products ---- */}
        <section>
          <div className="mb-6">
            <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <Tag size={20} className="text-red-600" /> Price Drops
            </h2>
            <p className="text-sm text-gray-500 mt-0.5">
              Products with a reduced price — save on every order
            </p>
          </div>

          {loadingProducts ? (
            skeletonGrid
          ) : discountedProducts.length === 0 ? (
            <div className="bg-white border border-gray-200 rounded-lg p-8 text-center">
              <p className="text-gray-500">
                All products at regular price.{" "}
                <Link
                  href="/category"
                  className="text-gray-900 underline inline-flex items-center gap-1"
                >
                  Browse our catalog <ArrowRight size={14} />
                </Link>
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {discountedProducts.map((product) => (
                <DealCard key={product.id} product={product} />
              ))}
            </div>
          )}
        </section>

        {/* ---- All Deals (filtered + sorted) ---- */}
        {!loadingFlash && !loadingProducts && allDeals.length > 0 && (
          <section>
            <div className="mb-6">
              <h2 className="text-xl font-bold text-gray-900">All Deals</h2>
              <p className="text-sm text-gray-500 mt-0.5">
                Browse everything on sale, filtered your way
              </p>
            </div>

            {/* Category Filter Tabs + Sort */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
              {/* Category Tabs */}
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setSelectedCategory("all")}
                  className={`px-3 py-1.5 text-sm rounded-full border transition-colors ${
                    selectedCategory === "all"
                      ? "bg-gray-900 text-white border-gray-900"
                      : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"
                  }`}
                >
                  All
                </button>
                {availableCategories.map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() =>
                      setSelectedCategory(cat.slug || cat.name)
                    }
                    className={`px-3 py-1.5 text-sm rounded-full border transition-colors ${
                      selectedCategory === (cat.slug || cat.name)
                        ? "bg-gray-900 text-white border-gray-900"
                        : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"
                    }`}
                  >
                    {cat.name}
                  </button>
                ))}
              </div>

              {/* Sort Dropdown */}
              <div className="flex items-center gap-2">
                <SlidersHorizontal size={16} className="text-gray-400" />
                <select
                  value={sortOption}
                  onChange={(e) => setSortOption(e.target.value as SortOption)}
                  className="text-sm bg-white border border-gray-200 rounded-lg px-3 py-1.5 text-gray-700 focus:outline-none focus:ring-1 focus:ring-gray-300"
                >
                  <option value="discount">Biggest Discount</option>
                  <option value="price-asc">Price: Low to High</option>
                  <option value="price-desc">Price: High to Low</option>
                  <option value="newest">Newest</option>
                </select>
              </div>
            </div>

            {/* Grid */}
            {filteredAndSorted.length === 0 ? (
              <div className="bg-white border border-gray-200 rounded-lg p-8 text-center">
                <p className="text-gray-500">
                  No deals in this category.{" "}
                  <button
                    onClick={() => setSelectedCategory("all")}
                    className="text-gray-900 underline"
                  >
                    View all deals
                  </button>
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {filteredAndSorted.map((product) => (
                  <DealCard key={product.id} product={product} />
                ))}
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  );
}
