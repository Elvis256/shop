"use client";

import { useEffect, useState, useCallback } from "react";
import { apiFetch } from "@/lib/api";
import { Star, Search, ChevronDown, ChevronUp, Send, AlertTriangle, MessageSquare } from "lucide-react";
import { useToast } from "@/lib/hooks/useToast";

interface ReviewImage {
  id: string;
  url: string;
}

interface Review {
  id: string;
  rating: number;
  title: string | null;
  content: string | null;
  sellerReply: string | null;
  sellerRepliedAt: string | null;
  createdAt: string;
  product: {
    id: string;
    name: string;
    slug: string;
    images: Array<{ url: string }>;
  };
  user: { id: string; name: string | null };
  images: ReviewImage[];
}

const ratingOptions = [
  { label: "All Ratings", value: 0 },
  { label: "5 Stars", value: 5 },
  { label: "4 Stars", value: 4 },
  { label: "3 Stars", value: 3 },
  { label: "2 Stars", value: 2 },
  { label: "1 Star", value: 1 },
];

function Stars({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <Star
          key={s}
          className={`w-3.5 h-3.5 ${s <= rating ? "text-yellow-400 fill-yellow-400" : "text-gray-300"}`}
        />
      ))}
    </div>
  );
}

export default function SellerReviewsPage() {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [ratingFilter, setRatingFilter] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [replyInputs, setReplyInputs] = useState<Record<string, string>>({});
  const [replyingId, setReplyingId] = useState<string | null>(null);
  const { showToast } = useToast();

  const fetchReviews = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({ page: page.toString() });
      if (ratingFilter > 0) params.set("rating", ratingFilter.toString());
      if (search.trim()) params.set("search", search.trim());
      const data = await apiFetch(`/api/seller/product-reviews?${params}`);
      setReviews(data.reviews);
      setTotalPages(data.pagination.pages);
    } catch (err: any) {
      setError(err.message || "Failed to load reviews");
    } finally {
      setLoading(false);
    }
  }, [page, ratingFilter, search]);

  useEffect(() => {
    fetchReviews();
  }, [fetchReviews]);

  const handleReply = async (reviewId: string) => {
    const text = replyInputs[reviewId]?.trim();
    if (!text) return;
    try {
      setReplyingId(reviewId);
      await apiFetch(`/api/seller/product-reviews/${reviewId}/reply`, {
        method: "POST",
        body: JSON.stringify({ reply: text }),
      });
      showToast("Reply posted successfully!", "success");
      setReplyInputs((prev) => ({ ...prev, [reviewId]: "" }));
      fetchReviews();
    } catch (err: any) {
      showToast(err.message || "Failed to post reply", "error");
    } finally {
      setReplyingId(null);
    }
  };

  if (loading && reviews.length === 0) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <AlertTriangle className="w-10 h-10 text-red-400 mx-auto mb-3" />
          <p className="text-red-600">{error}</p>
          <button onClick={fetchReviews} className="mt-4 px-4 py-2 bg-primary text-white rounded-lg text-sm">Retry</button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Product Reviews</h1>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search by product name..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
          </div>
          <select
            value={ratingFilter}
            onChange={(e) => { setRatingFilter(parseInt(e.target.value)); setPage(1); }}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/20"
          >
            {ratingOptions.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Reviews Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left text-xs font-medium text-gray-500 uppercase px-6 py-3">Product</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase px-6 py-3">Customer</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase px-6 py-3">Rating</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase px-6 py-3">Review</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase px-6 py-3">Date</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase px-6 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {reviews.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-gray-400">
                    <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    No reviews found
                  </td>
                </tr>
              ) : (
                reviews.map((review) => (
                  <>
                    <tr key={review.id} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden">
                            {review.product.images?.[0] ? (
                              <img src={review.product.images[0].url} alt="" className="w-10 h-10 object-cover rounded-lg" />
                            ) : (
                              <Star className="w-4 h-4 text-gray-400" />
                            )}
                          </div>
                          <span className="text-sm font-medium text-gray-900 truncate max-w-[150px]">{review.product.name}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">{review.user.name || "Anonymous"}</td>
                      <td className="px-6 py-4"><Stars rating={review.rating} /></td>
                      <td className="px-6 py-4 text-sm text-gray-600 max-w-[200px] truncate">
                        {review.content || review.title || "No text"}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">{new Date(review.createdAt).toLocaleDateString()}</td>
                      <td className="px-6 py-4">
                        <button
                          onClick={() => setExpandedId(expandedId === review.id ? null : review.id)}
                          className="text-primary hover:text-primary/80 text-sm font-medium flex items-center gap-1"
                        >
                          {review.sellerReply ? "View" : "Reply"}
                          {expandedId === review.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </button>
                      </td>
                    </tr>
                    {expandedId === review.id && (
                      <tr key={`${review.id}-detail`} className="bg-gray-50">
                        <td colSpan={6} className="px-6 py-4">
                          <div className="space-y-4 max-w-2xl">
                            {/* Full review text */}
                            {review.title && <p className="text-sm font-medium text-gray-900">{review.title}</p>}
                            {review.content && <p className="text-sm text-gray-700">{review.content}</p>}

                            {/* Review images */}
                            {review.images.length > 0 && (
                              <div className="flex gap-2 flex-wrap">
                                {review.images.map((img) => (
                                  <img key={img.id} src={img.url} alt="" className="w-16 h-16 object-cover rounded-lg border" />
                                ))}
                              </div>
                            )}

                            {/* Existing reply */}
                            {review.sellerReply && (
                              <div className="bg-blue-50 border border-blue-100 rounded-lg p-3">
                                <p className="text-xs font-medium text-blue-600 mb-1">Your Reply</p>
                                <p className="text-sm text-gray-700">{review.sellerReply}</p>
                                {review.sellerRepliedAt && (
                                  <p className="text-xs text-gray-400 mt-1">
                                    {new Date(review.sellerRepliedAt).toLocaleDateString()}
                                  </p>
                                )}
                              </div>
                            )}

                            {/* Reply input */}
                            <div>
                              <p className="text-xs font-medium text-gray-500 mb-1">
                                {review.sellerReply ? "Update Reply" : "Write a Reply"}
                              </p>
                              <div className="flex gap-2">
                                <input
                                  type="text"
                                  value={replyInputs[review.id] ?? ""}
                                  onChange={(e) => setReplyInputs((prev) => ({ ...prev, [review.id]: e.target.value }))}
                                  placeholder="Write your reply to this review..."
                                  className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                                />
                                <button
                                  onClick={() => handleReply(review.id)}
                                  disabled={replyingId === review.id || !replyInputs[review.id]?.trim()}
                                  className="px-4 py-2 bg-primary text-white rounded-lg text-sm hover:bg-primary/90 disabled:opacity-50 flex items-center gap-1"
                                >
                                  <Send className="w-3 h-3" />
                                  {replyingId === review.id ? "Posting..." : "Post"}
                                </button>
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100">
            <button
              onClick={() => setPage(Math.max(1, page - 1))}
              disabled={page === 1}
              className="px-3 py-1.5 text-sm border rounded-lg disabled:opacity-50"
            >
              Previous
            </button>
            <span className="text-sm text-gray-600">Page {page} of {totalPages}</span>
            <button
              onClick={() => setPage(Math.min(totalPages, page + 1))}
              disabled={page === totalPages}
              className="px-3 py-1.5 text-sm border rounded-lg disabled:opacity-50"
            >
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
