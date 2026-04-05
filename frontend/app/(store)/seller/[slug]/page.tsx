"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import ProductCard from "@/components/ProductCard";
import { apiFetch } from "@/lib/api";
import {
  Star,
  MapPin,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Store,
} from "lucide-react";

interface SellerInfo {
  id: string;
  storeName: string;
  storeSlug: string;
  storeLogo?: string;
  storeBanner?: string;
  storeDescription?: string;
  rating: number;
  reviewCount: number;
  productCount: number;
  location?: string;
  createdAt: string;
}

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

export default function SellerStorePage() {
  const params = useParams();
  const slug = params.slug as string;
  const [seller, setSeller] = useState<SellerInfo | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [productsLoading, setProductsLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (slug) loadSeller();
  }, [slug]);

  useEffect(() => {
    if (slug) loadProducts();
  }, [slug, page]);

  const loadSeller = async () => {
    try {
      const data = await apiFetch(`/api/seller/store/${slug}`);
      setSeller(data);
    } catch {
      setError("Store not found");
    } finally {
      setLoading(false);
    }
  };

  const loadProducts = async () => {
    setProductsLoading(true);
    try {
      const data = await apiFetch(`/api/seller/store/${slug}/products?page=${page}`);
      setProducts(data.products || []);
      setTotalPages(data.pagination?.totalPages || 1);
    } catch {
      setProducts([]);
    } finally {
      setProductsLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !seller) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-20 text-center">
        <Store className="w-12 h-12 text-gray-300 mx-auto mb-4" />
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Store Not Found</h1>
        <p className="text-gray-500 mb-6">The store you&apos;re looking for doesn&apos;t exist or has been removed.</p>
        <Link href="/" className="text-primary hover:underline">
          Back to Home
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      {/* Banner */}
      <div className="relative rounded-2xl overflow-hidden bg-gradient-to-r from-primary/10 to-purple-100 mb-8">
        {seller.storeBanner ? (
          <img src={seller.storeBanner} alt="" className="w-full h-48 sm:h-56 object-cover" />
        ) : (
          <div className="w-full h-48 sm:h-56" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 p-6 flex items-end gap-4">
          {seller.storeLogo ? (
            <img src={seller.storeLogo} alt={seller.storeName} className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl border-4 border-white object-cover shadow-lg" />
          ) : (
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl border-4 border-white bg-white shadow-lg flex items-center justify-center">
              <Store className="w-8 h-8 text-primary" />
            </div>
          )}
          <div className="flex-1 min-w-0 pb-1">
            <h1 className="text-xl sm:text-2xl font-bold text-white truncate">{seller.storeName}</h1>
            <div className="flex flex-wrap items-center gap-3 mt-1">
              {seller.rating > 0 && (
                <div className="flex items-center gap-1">
                  <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                  <span className="text-sm text-white/90">{seller.rating.toFixed(1)} ({seller.reviewCount} reviews)</span>
                </div>
              )}
              {seller.location && (
                <div className="flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-white/70" />
                  <span className="text-sm text-white/90">{seller.location}</span>
                </div>
              )}
              <div className="flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-white/70" />
                <span className="text-sm text-white/90">
                  Member since {new Date(seller.createdAt).toLocaleDateString("en-US", { month: "short", year: "numeric" })}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Description */}
      {seller.storeDescription && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 mb-8">
          <p className="text-sm text-gray-700 leading-relaxed">{seller.storeDescription}</p>
        </div>
      )}

      {/* Products */}
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-gray-900">
          Products <span className="text-gray-400 font-normal">({seller.productCount})</span>
        </h2>
      </div>

      {productsLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      ) : products.length === 0 ? (
        <div className="text-center py-20">
          <Store className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">No products available yet</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
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

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-8">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <span className="text-sm text-gray-600 px-3">
                Page {page} of {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
