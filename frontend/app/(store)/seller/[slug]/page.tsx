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
  MessageSquare,
  Send,
} from "lucide-react";
import { useAuth } from "@/lib/hooks/useAuth";

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

interface SellerReview {
  id: string;
  userName: string;
  rating: number;
  comment: string | null;
  createdAt: string;
}

export default function SellerStorePage() {
  const params = useParams();
  const slug = params.slug as string;
  const { user } = useAuth();
  const [seller, setSeller] = useState<SellerInfo | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [productsLoading, setProductsLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [error, setError] = useState<string | null>(null);

  // Reviews
  const [reviews, setReviews] = useState<SellerReview[]>([]);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState("");
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [reviewError, setReviewError] = useState("");

  useEffect(() => {
    if (slug) { loadSeller(); loadReviews(); }
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

  const loadReviews = async () => {
    setReviewsLoading(true);
    try {
      const data = await apiFetch(`/api/seller/store/${slug}/reviews`);
      setReviews(data.reviews || []);
    } catch {
      setReviews([]);
    } finally {
      setReviewsLoading(false);
    }
  };

  const submitReview = async () => {
    setReviewSubmitting(true);
    setReviewError("");
    try {
      await apiFetch(`/api/seller/store/${slug}/reviews`, {
        method: "POST",
        body: JSON.stringify({ rating: reviewRating, comment: reviewComment }),
      });
      setReviewComment("");
      setReviewRating(5);
      loadReviews();
      loadSeller(); // refresh rating
    } catch (err: any) {
      setReviewError(err?.message || "Failed to submit review");
    } finally {
      setReviewSubmitting(false);
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
                  <span className="text-sm text-white/90">{(seller.rating || 0).toFixed(1)} ({seller.reviewCount} reviews)</span>
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

      {/* Reviews Section */}
      <div className="mt-12">
        <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <MessageSquare className="w-5 h-5" />
          Customer Reviews
          {seller.reviewCount > 0 && <span className="text-gray-400 font-normal">({seller.reviewCount})</span>}
        </h2>

        {/* Submit Review Form */}
        {user && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 mb-6">
            <h3 className="text-sm font-medium text-gray-900 mb-3">Write a Review</h3>
            <div className="flex items-center gap-1 mb-3">
              {[1, 2, 3, 4, 5].map((s) => (
                <button key={s} type="button" onClick={() => setReviewRating(s)}>
                  <Star className={`w-6 h-6 ${s <= reviewRating ? "fill-yellow-400 text-yellow-400" : "text-gray-300"}`} />
                </button>
              ))}
            </div>
            <textarea
              value={reviewComment}
              onChange={(e) => setReviewComment(e.target.value)}
              placeholder="Share your experience with this seller..."
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm resize-none h-20 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              maxLength={2000}
            />
            {reviewError && <p className="text-sm text-red-600 mt-1">{reviewError}</p>}
            <button
              onClick={submitReview}
              disabled={reviewSubmitting}
              className="mt-2 px-4 py-2 bg-gray-900 text-white text-sm rounded-lg hover:bg-gray-800 disabled:opacity-50 flex items-center gap-2"
            >
              {reviewSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              Submit Review
            </button>
          </div>
        )}

        {/* Reviews List */}
        {reviewsLoading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : reviews.length === 0 ? (
          <div className="text-center py-10 text-gray-500 text-sm">
            No reviews yet. Be the first to review this seller!
          </div>
        ) : (
          <div className="space-y-4">
            {reviews.map((review) => (
              <div key={review.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm text-gray-900">{review.userName}</span>
                    <div className="flex items-center gap-0.5">
                      {[1, 2, 3, 4, 5].map((s) => (
                        <Star key={s} className={`w-3.5 h-3.5 ${s <= review.rating ? "fill-yellow-400 text-yellow-400" : "text-gray-200"}`} />
                      ))}
                    </div>
                  </div>
                  <span className="text-xs text-gray-400">
                    {new Date(review.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                  </span>
                </div>
                {review.comment && <p className="text-sm text-gray-700">{review.comment}</p>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
