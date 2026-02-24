"use client";

import { useState, useEffect } from "react";
import { Star, ThumbsUp, ShieldCheck, Truck, RotateCcw } from "lucide-react";
import { api } from "@/lib/api";
import type { Review, ReviewsResponse } from "@/lib/types/api";

const tabs = [
  { id: "details", label: "Details" },
  { id: "shipping", label: "Shipping" },
  { id: "reviews", label: "Reviews" },
];

interface ProductTabsProps {
  description?: string | null;
  productId?: string;
  reviewCount?: number;
  rating?: number;
}

export default function ProductTabs({ description, productId, reviewCount = 0, rating = 0 }: ProductTabsProps) {
  const [activeTab, setActiveTab] = useState("details");
  const [reviews, setReviews] = useState<Review[]>([]);
  const [reviewStats, setReviewStats] = useState<ReviewsResponse["stats"] | null>(null);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewContent, setReviewContent] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  useEffect(() => {
    if (activeTab === "reviews" && productId && reviews.length === 0) {
      loadReviews();
    }
  }, [activeTab, productId]);

  const loadReviews = async () => {
    if (!productId) return;
    setReviewsLoading(true);
    try {
      const data = await api.getProductReviews(productId);
      setReviews(data.reviews || []);
      setReviewStats(data.stats);
    } catch (err) {
      console.error("Failed to load reviews:", err);
    } finally {
      setReviewsLoading(false);
    }
  };

  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!productId) return;
    setSubmitting(true);
    try {
      await api.createReview(productId, reviewRating, undefined, reviewContent);
      setSubmitSuccess(true);
      setShowReviewForm(false);
      setReviewContent("");
      loadReviews();
    } catch (err) {
      console.error("Failed to submit review:", err);
    } finally {
      setSubmitting(false);
    }
  };

  const timeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const days = Math.floor(diff / 86400000);
    if (days === 0) return "Today";
    if (days === 1) return "Yesterday";
    if (days < 7) return `${days} days ago`;
    if (days < 30) return `${Math.floor(days / 7)} week${Math.floor(days / 7) > 1 ? "s" : ""} ago`;
    if (days < 365) return `${Math.floor(days / 30)} month${Math.floor(days / 30) > 1 ? "s" : ""} ago`;
    return `${Math.floor(days / 365)} year${Math.floor(days / 365) > 1 ? "s" : ""} ago`;
  };

  return (
    <div>
      {/* Tab Headers */}
      <div className="flex border-b border-gray-200 -mx-6 px-6">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-5 py-3.5 text-sm font-medium transition-colors relative ${
              activeTab === tab.id
                ? "text-primary after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-primary"
                : "text-gray-500 hover:text-gray-900"
            }`}
          >
            {tab.label}
            {tab.id === "reviews" && reviewCount > 0 && (
              <span className="ml-1.5 text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full">
                {reviewCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="py-6">
        {activeTab === "details" && (
          <div className="prose prose-sm max-w-none text-gray-700">
            {description ? (
              <p className="leading-relaxed whitespace-pre-line">{description}</p>
            ) : (
              <p className="text-gray-400 italic">No description provided for this product.</p>
            )}
          </div>
        )}

        {activeTab === "shipping" && (
          <div className="space-y-5">
            <div className="flex gap-4">
              <div className="p-2.5 bg-primary/10 rounded-lg flex-shrink-0">
                <Truck className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h4 className="font-semibold text-gray-900 mb-1">Discreet Delivery</h4>
                <p className="text-sm text-gray-600">All orders ship in plain, unmarked packaging. The sender name will be a neutral company name — your privacy is our priority.</p>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="p-2.5 bg-primary/10 rounded-lg flex-shrink-0">
                <ShieldCheck className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h4 className="font-semibold text-gray-900 mb-1">Delivery Options</h4>
                <ul className="text-sm text-gray-600 space-y-1.5 mt-1">
                  <li className="flex justify-between gap-4">
                    <span><strong>Standard:</strong> 3–5 business days</span>
                    <span className="text-green-600 font-medium">Free over USh 100,000</span>
                  </li>
                  <li className="flex justify-between gap-4">
                    <span><strong>Express:</strong> 1–2 business days</span>
                    <span>USh 5,000</span>
                  </li>
                  <li className="flex justify-between gap-4">
                    <span><strong>Same Day</strong> (Kampala only)</span>
                    <span>USh 10,000</span>
                  </li>
                </ul>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="p-2.5 bg-primary/10 rounded-lg flex-shrink-0">
                <RotateCcw className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h4 className="font-semibold text-gray-900 mb-1">Returns</h4>
                <p className="text-sm text-gray-600">Unopened items may be returned within 30 days for a full refund. For hygiene reasons, opened items cannot be returned.</p>
              </div>
            </div>
          </div>
        )}

        {activeTab === "reviews" && (
          <div>
            {/* Stats + Write Review */}
            <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
              <div className="flex items-center gap-4">
                {reviewStats ? (
                  <>
                    <div className="text-center">
                      <div className="text-4xl font-bold text-gray-900">{reviewStats.average.toFixed(1)}</div>
                      <div className="flex gap-0.5 mt-1 justify-center">
                        {[1,2,3,4,5].map((s) => (
                          <Star key={s} className={`w-3.5 h-3.5 ${s <= Math.round(reviewStats.average) ? "fill-yellow-400 text-yellow-400" : "text-gray-200"}`} />
                        ))}
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">{reviewStats.total} reviews</p>
                    </div>
                    <div className="space-y-1 min-w-[140px]">
                      {[5,4,3,2,1].map((star) => {
                        const count = reviewStats.distribution[star] || 0;
                        const pct = reviewStats.total > 0 ? (count / reviewStats.total) * 100 : 0;
                        return (
                          <div key={star} className="flex items-center gap-2 text-xs text-gray-500">
                            <span className="w-3">{star}</span>
                            <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                            <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                              <div className="h-full bg-yellow-400 rounded-full" style={{ width: `${pct}%` }} />
                            </div>
                            <span className="w-4 text-right">{count}</span>
                          </div>
                        );
                      })}
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-gray-500">No reviews yet</p>
                )}
              </div>
              <button
                onClick={() => setShowReviewForm(!showReviewForm)}
                className="px-4 py-2 text-sm bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors font-medium"
              >
                Write a Review
              </button>
            </div>

            {/* Review Form */}
            {showReviewForm && (
              <form onSubmit={handleSubmitReview} className="mb-6 p-4 bg-gray-50 rounded-xl border">
                <h4 className="font-semibold text-gray-900 mb-3">Your Review</h4>
                <div className="mb-3">
                  <label className="block text-sm text-gray-600 mb-1">Rating</label>
                  <div className="flex gap-1">
                    {[1,2,3,4,5].map((s) => (
                      <button key={s} type="button" onClick={() => setReviewRating(s)}>
                        <Star className={`w-7 h-7 ${s <= reviewRating ? "fill-yellow-400 text-yellow-400" : "text-gray-300 hover:text-yellow-300"} transition-colors`} />
                      </button>
                    ))}
                  </div>
                </div>
                <textarea
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary min-h-[80px] resize-none"
                  placeholder="Share your experience..."
                  value={reviewContent}
                  onChange={(e) => setReviewContent(e.target.value)}
                  required
                />
                <div className="flex gap-2 mt-3 justify-end">
                  <button type="button" onClick={() => setShowReviewForm(false)} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">Cancel</button>
                  <button type="submit" disabled={submitting} className="px-4 py-2 text-sm bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50 font-medium">
                    {submitting ? "Submitting..." : "Submit"}
                  </button>
                </div>
              </form>
            )}

            {submitSuccess && (
              <div className="mb-4 p-3 bg-green-50 text-green-700 text-sm rounded-lg border border-green-200">
                Thank you for your review! It will appear once approved.
              </div>
            )}

            {/* Reviews List */}
            {reviewsLoading ? (
              <div className="space-y-4">
                {[1,2,3].map((i) => (
                  <div key={i} className="animate-pulse">
                    <div className="h-3 bg-gray-100 rounded w-1/4 mb-2" />
                    <div className="h-3 bg-gray-100 rounded w-full mb-1" />
                    <div className="h-3 bg-gray-100 rounded w-3/4" />
                  </div>
                ))}
              </div>
            ) : reviews.length > 0 ? (
              <div className="space-y-5">
                {reviews.map((review) => (
                  <div key={review.id} className="pb-5 border-b border-gray-100 last:border-0">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold text-sm">
                          {(review.user?.name || "A")[0].toUpperCase()}
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm font-medium text-gray-900">{review.user?.name || "Anonymous"}</span>
                            {review.verified && (
                              <span className="flex items-center gap-0.5 text-[10px] text-green-600 bg-green-50 px-1.5 py-0.5 rounded">
                                <ThumbsUp className="w-2.5 h-2.5" /> Verified
                              </span>
                            )}
                          </div>
                          <div className="flex gap-0.5 mt-0.5">
                            {[1,2,3,4,5].map((s) => (
                              <Star key={s} className={`w-3 h-3 ${s <= review.rating ? "fill-yellow-400 text-yellow-400" : "text-gray-200"}`} />
                            ))}
                          </div>
                        </div>
                      </div>
                      <span className="text-xs text-gray-400 flex-shrink-0">{timeAgo(review.createdAt)}</span>
                    </div>
                    {review.title && <p className="text-sm font-medium text-gray-900 mb-1">{review.title}</p>}
                    {review.content && <p className="text-sm text-gray-600 leading-relaxed">{review.content}</p>}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-10 text-gray-400">
                <Star className="w-10 h-10 mx-auto mb-2 opacity-30" />
                <p className="text-sm">No reviews yet. Be the first to review!</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
