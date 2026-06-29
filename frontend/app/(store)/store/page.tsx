"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import { apiFetch } from "@/lib/api";
import {
  Store, Search, Star, Package, ChevronLeft, ChevronRight, Loader2,
} from "lucide-react";

interface StoreItem {
  id: string;
  storeName: string;
  storeSlug: string;
  logo: string | null;
  description: string | null;
  rating: number;
  reviewCount: number;
  tier: string | null;
  productCount: number;
}

export default function BrowseStoresPage() {
  const [stores, setStores] = useState<StoreItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const loadStores = useCallback(async (p = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(p), limit: "20" });
      if (search) params.set("search", search);
      const data = await apiFetch(`/api/seller/stores?${params}`);
      setStores(data.stores || []);
      setTotalPages(data.pagination?.totalPages || 1);
      setPage(p);
    } catch {
      setStores([]);
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    const t = setTimeout(() => loadStores(1), 300);
    return () => clearTimeout(t);
  }, [search, loadStores]);

  return (
    <div className="container py-10">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-text">Browse Stores</h1>
        <p className="text-text-muted mt-1">Discover sellers and their products</p>
      </div>

      {/* Search */}
      <div className="relative max-w-md mb-8">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
        <input
          type="text"
          placeholder="Search stores..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 border border-border rounded-lg text-sm bg-surface focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition"
        />
      </div>

      {/* Grid */}
      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-text-muted" />
        </div>
      ) : stores.length === 0 ? (
        <div className="text-center py-20">
          <Store className="w-12 h-12 text-text-muted mx-auto mb-3" />
          <p className="text-text-muted">No stores found</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {stores.map((store) => (
            <Link
              key={store.id}
              href={`/store/${store.storeSlug}`}
              className="group border border-border rounded-xl p-5 bg-surface hover:shadow-md transition-shadow"
            >
              <div className="flex items-center gap-3 mb-3">
                {store.logo ? (
                  <Image
                    src={store.logo}
                    alt={store.storeName}
                    width={48}
                    height={48}
                    className="rounded-full object-cover"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-surface-secondary flex items-center justify-center">
                    <Store className="w-5 h-5 text-text-muted" />
                  </div>
                )}
                <div className="min-w-0">
                  <h3 className="font-semibold text-text truncate group-hover:text-primary transition-colors">
                    {store.storeName}
                  </h3>
                  {store.tier && (
                    <span className="text-xs text-text-muted capitalize">{store.tier} Seller</span>
                  )}
                </div>
              </div>

              {store.description && (
                <p className="text-sm text-text-muted line-clamp-2 mb-3">{store.description}</p>
              )}

              <div className="flex items-center gap-4 text-xs text-text-muted">
                {store.rating > 0 && (
                  <span className="flex items-center gap-1">
                    <Star className="w-3.5 h-3.5 text-yellow-500 fill-yellow-500" />
                    {store.rating.toFixed(1)} ({store.reviewCount})
                  </span>
                )}
                <span className="flex items-center gap-1">
                  <Package className="w-3.5 h-3.5" />
                  {store.productCount} products
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-8">
          <button
            onClick={() => loadStores(page - 1)}
            disabled={page <= 1}
            className="p-2 rounded-lg border border-border text-text-muted hover:bg-surface-secondary disabled:opacity-40"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-sm text-text-muted px-3">
            Page {page} of {totalPages}
          </span>
          <button
            onClick={() => loadStores(page + 1)}
            disabled={page >= totalPages}
            className="p-2 rounded-lg border border-border text-text-muted hover:bg-surface-secondary disabled:opacity-40"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}
