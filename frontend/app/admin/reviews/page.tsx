"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { apiFetch } from "@/lib/api";
import {
  Search,
  Star,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  X,
  CheckCircle,
  XCircle,
  Loader2,
  Eye,
  Image as ImageIcon,
  ThumbsUp,
  Trash2,
  CheckSquare,
  Square,
  MessageSquare,
} from "lucide-react";

interface ReviewImage {
  id: string;
  url: string;
}

interface Review {
  id: string;
  productId: string;
  userId: string;
  rating: number;
  title: string;
  content: string;
  verified: boolean;
  approved: boolean;
  images: ReviewImage[];
  createdAt: string;
  updatedAt: string;
  product?: { name: string; slug?: string; images?: { url: string }[] };
  user?: { name: string | null; email: string };
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function Stars({ rating, size = "sm" }: { rating: number; size?: "sm" | "md" }) {
  const cls = size === "md" ? "text-base" : "text-sm";
  return (
    <span className={`${cls} tracking-tight`}>
      {Array.from({ length: 5 }, (_, i) => (
        <span key={i} className={i < rating ? "text-yellow-400" : "text-gray-200"}>★</span>
      ))}
    </span>
  );
}

function StatusBadge({ approved }: { approved: boolean }) {
  return approved ? (
    <span className="inline-flex items-center text-xs px-2.5 py-1 rounded-full font-medium bg-green-50 text-green-700 border border-green-200">
      Approved
    </span>
  ) : (
    <span className="inline-flex items-center text-xs px-2.5 py-1 rounded-full font-medium bg-yellow-50 text-yellow-700 border border-yellow-200">
      Pending
    </span>
  );
}

const RATING_OPTIONS = [
  { label: "All Ratings", value: 0 },
  { label: "5 Stars", value: 5 },
  { label: "4 Stars", value: 4 },
  { label: "3 Stars", value: 3 },
  { label: "2 Stars", value: 2 },
  { label: "1 Star", value: 1 },
];

type StatusFilter = "all" | "pending" | "approved";

export default function AdminReviewsPage() {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [ratingFilter, setRatingFilter] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const perPage = 20;
  const searchTimeout = useRef<NodeJS.Timeout | null>(null);

  // Selection for bulk actions
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Detail modal
  const [selected, setSelected] = useState<Review | null>(null);

  // Stats
  const [stats, setStats] = useState({ total: 0, pending: 0, avgRating: 0, withImages: 0 });

  // Action loading
  const [acting, setActing] = useState<string | null>(null);

  const loadReviews = useCallback(async (p = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter === "pending") params.set("status", "pending");
      if (statusFilter === "approved") params.set("status", "approved");
      if (ratingFilter > 0) params.set("rating", String(ratingFilter));
      if (search) params.set("search", search);
      params.set("page", String(p));
      params.set("limit", String(perPage));
      const data = await apiFetch(`/api/reviews?${params}`);
      const list: Review[] = data.reviews || data.data || (Array.isArray(data) ? data : []);
      setReviews(list);
      setTotal(data.pagination?.total || data.total || list.length);
      setTotalPages(data.pagination?.totalPages || Math.ceil((data.total || list.length) / perPage) || 1);
      setPage(p);

      // Compute stats
      let pending = 0, ratingSum = 0, withImg = 0;
      const allReviews = list;
      allReviews.forEach((r) => {
        if (!r.approved) pending++;
        ratingSum += r.rating;
        if (r.images && r.images.length > 0) withImg++;
      });
      setStats({
        total: data.pagination?.total || data.total || list.length,
        pending,
        avgRating: allReviews.length ? Math.round((ratingSum / allReviews.length) * 10) / 10 : 0,
        withImages: withImg,
      });
    } catch (e) {
      console.error("Failed to load reviews:", e);
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, ratingFilter]);

  useEffect(() => {
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => { loadReviews(1); setSelectedIds([]); }, 300);
    return () => { if (searchTimeout.current) clearTimeout(searchTimeout.current); };
  }, [search, statusFilter, ratingFilter, loadReviews]);

  const approveReview = async (id: string) => {
    setActing(id);
    try {
      await apiFetch(`/api/reviews/${id}`, { method: "PUT", body: JSON.stringify({ approved: true }) });
      loadReviews(page);
    } catch (e) {
      console.error("Approve failed:", e);
    } finally {
      setActing(null);
    }
  };

  const deleteReview = async (id: string) => {
    if (!confirm("Delete this review? This cannot be undone.")) return;
    setActing(id);
    try {
      await apiFetch(`/api/reviews/${id}`, { method: "DELETE" });
      setSelected(null);
      loadReviews(page);
    } catch (e) {
      console.error("Delete failed:", e);
    } finally {
      setActing(null);
    }
  };

  const bulkApprove = async () => {
    if (!selectedIds.length) return;
    setActing("bulk");
    try {
      await Promise.all(
        selectedIds.map((id) =>
          apiFetch(`/api/reviews/${id}`, { method: "PUT", body: JSON.stringify({ approved: true }) })
        )
      );
      setSelectedIds([]);
      loadReviews(page);
    } catch (e) {
      console.error("Bulk approve failed:", e);
    } finally {
      setActing(null);
    }
  };

  const toggleSelect = (id: string) =>
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const toggleAll = () =>
    setSelectedIds(selectedIds.length === reviews.length ? [] : reviews.map((r) => r.id));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Reviews</h1>
          <p className="text-sm text-gray-500 mt-0.5">{total} total reviews</p>
        </div>
        <div className="flex items-center gap-2">
          {selectedIds.length > 0 && (
            <button
              onClick={bulkApprove}
              disabled={acting === "bulk"}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium bg-gray-900 text-white rounded-lg hover:bg-gray-800 disabled:opacity-50"
            >
              {acting === "bulk" ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
              Approve {selectedIds.length} Selected
            </button>
          )}
          <button
            onClick={() => loadReviews(page)}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-700"
          >
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total Reviews", value: stats.total, icon: MessageSquare },
          { label: "Pending Approval", value: stats.pending, icon: CheckCircle },
          { label: "Average Rating", value: `${stats.avgRating} ★`, icon: Star },
          { label: "With Images", value: stats.withImages, icon: ImageIcon },
        ].map((s) => (
          <div key={s.label} className="bg-white border border-gray-200 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs text-gray-500 uppercase tracking-wide">{s.label}</p>
              <s.icon className="w-4 h-4 text-gray-400" />
            </div>
            <p className="text-2xl font-semibold text-gray-900 mt-1">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Search & Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-gray-300 bg-white"
            placeholder="Search by product name or customer..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex border border-gray-200 rounded-lg overflow-hidden text-sm">
          {(["all", "pending", "approved"] as StatusFilter[]).map((f) => (
            <button
              key={f}
              onClick={() => setStatusFilter(f)}
              className={`px-3 py-2 capitalize transition-colors ${
                statusFilter === f ? "bg-gray-900 text-white" : "bg-white text-gray-600 hover:bg-gray-50"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
        <select
          className="px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-gray-300"
          value={ratingFilter}
          onChange={(e) => setRatingFilter(Number(e.target.value))}
        >
          {RATING_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/50">
                <th className="px-4 py-3 text-left w-10">
                  <button onClick={toggleAll} className="text-gray-400 hover:text-gray-600">
                    {selectedIds.length === reviews.length && reviews.length > 0 ? (
                      <CheckSquare className="w-4 h-4" />
                    ) : (
                      <Square className="w-4 h-4" />
                    )}
                  </button>
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Product</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Customer</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Rating</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Title</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Date</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wide">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    <td colSpan={8} className="px-4 py-4">
                      <div className="h-4 bg-gray-100 rounded animate-pulse" style={{ width: `${60 + Math.random() * 30}%` }} />
                    </td>
                  </tr>
                ))
              ) : reviews.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center">
                    <MessageSquare className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                    <p className="text-sm text-gray-500">No reviews found</p>
                    <p className="text-xs text-gray-400 mt-1">Reviews will appear here once customers submit them</p>
                  </td>
                </tr>
              ) : (
                reviews.map((r) => (
                  <tr key={r.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <button onClick={() => toggleSelect(r.id)} className="text-gray-400 hover:text-gray-600">
                        {selectedIds.includes(r.id) ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3 min-w-0">
                        {r.product?.images?.[0]?.url ? (
                          <img
                            src={r.product.images[0].url}
                            alt=""
                            className="w-8 h-8 rounded object-cover bg-gray-100 shrink-0"
                          />
                        ) : (
                          <div className="w-8 h-8 bg-gray-100 rounded flex items-center justify-center shrink-0">
                            <ImageIcon className="w-4 h-4 text-gray-400" />
                          </div>
                        )}
                        <p className="text-sm font-medium text-gray-900 truncate max-w-[160px]">
                          {r.product?.name || "Unknown Product"}
                        </p>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-sm text-gray-900 truncate">{r.user?.name || "—"}</p>
                      <p className="text-xs text-gray-500 truncate">{r.user?.email || "—"}</p>
                    </td>
                    <td className="px-4 py-3">
                      <Stars rating={r.rating} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <p className="text-sm text-gray-700 truncate max-w-[180px]">{r.title || "—"}</p>
                        {r.images && r.images.length > 0 && (
                          <ImageIcon className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge approved={r.approved} />
                      {r.verified && (
                        <span className="ml-1.5 inline-flex items-center text-xs text-blue-600">✓ Verified</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">{fmtDate(r.createdAt)}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => setSelected(r)}
                          className="p-1.5 rounded hover:bg-gray-100 text-gray-500 hover:text-gray-700"
                          title="View"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        {!r.approved && (
                          <button
                            onClick={() => approveReview(r.id)}
                            disabled={acting === r.id}
                            className="p-1.5 rounded hover:bg-green-50 text-green-600 hover:text-green-700 disabled:opacity-50"
                            title="Approve"
                          >
                            {acting === r.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <ThumbsUp className="w-4 h-4" />}
                          </button>
                        )}
                        <button
                          onClick={() => deleteReview(r.id)}
                          disabled={acting === r.id}
                          className="p-1.5 rounded hover:bg-red-50 text-red-500 hover:text-red-700 disabled:opacity-50"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
            <p className="text-xs text-gray-500">
              Showing {(page - 1) * perPage + 1}–{Math.min(page * perPage, total)} of {total}
            </p>
            <div className="flex items-center gap-1">
              <button
                onClick={() => loadReviews(page - 1)}
                disabled={page <= 1}
                className="p-1.5 rounded border border-gray-200 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                const p = totalPages <= 5 ? i + 1 : Math.max(1, Math.min(page - 2, totalPages - 4)) + i;
                return (
                  <button
                    key={p}
                    onClick={() => loadReviews(p)}
                    className={`w-8 h-8 text-xs rounded border transition-colors ${
                      page === p ? "bg-gray-900 text-white border-gray-900" : "border-gray-200 hover:bg-gray-50 text-gray-600"
                    }`}
                  >
                    {p}
                  </button>
                );
              })}
              <button
                onClick={() => loadReviews(page + 1)}
                disabled={page >= totalPages}
                className="p-1.5 rounded border border-gray-200 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Detail Modal */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setSelected(null)}>
          <div
            className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto m-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-lg font-semibold text-gray-900">Review Details</h2>
              <button onClick={() => setSelected(null)} className="p-1.5 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="px-6 py-4 space-y-5">
              {/* Product */}
              <div className="flex items-center gap-3">
                {selected.product?.images?.[0]?.url ? (
                  <img
                    src={selected.product.images[0].url}
                    alt=""
                    className="w-12 h-12 rounded-lg object-cover bg-gray-100"
                  />
                ) : (
                  <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center">
                    <ImageIcon className="w-5 h-5 text-gray-400" />
                  </div>
                )}
                <div>
                  <p className="text-sm font-medium text-gray-900">{selected.product?.name || "Unknown Product"}</p>
                  <p className="text-xs text-gray-500">by {selected.user?.name || selected.user?.email || "Unknown"}</p>
                </div>
              </div>

              {/* Rating & Status */}
              <div className="flex items-center gap-4">
                <Stars rating={selected.rating} size="md" />
                <StatusBadge approved={selected.approved} />
                {selected.verified && (
                  <span className="text-xs text-blue-600 font-medium">✓ Verified Purchase</span>
                )}
              </div>

              {/* Title & Content */}
              <div>
                {selected.title && (
                  <p className="text-sm font-semibold text-gray-900 mb-1">{selected.title}</p>
                )}
                <p className="text-sm text-gray-600 leading-relaxed">{selected.content || "No content"}</p>
              </div>

              {/* Images */}
              {selected.images && selected.images.length > 0 && (
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">Images</p>
                  <div className="flex gap-2 flex-wrap">
                    {selected.images.map((img) => (
                      <a
                        key={img.id}
                        href={img.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block"
                      >
                        <img
                          src={img.url}
                          alt=""
                          className="w-20 h-20 rounded-lg object-cover bg-gray-100 hover:opacity-80 transition-opacity"
                        />
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {/* Meta */}
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-xs text-gray-500">Customer</p>
                  <p className="text-gray-900">{selected.user?.name || "—"}</p>
                  <p className="text-xs text-gray-500">{selected.user?.email || "—"}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Submitted</p>
                  <p className="text-gray-900">{fmtDate(selected.createdAt)}</p>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 pt-2 border-t border-gray-100">
                {!selected.approved && (
                  <button
                    onClick={() => { approveReview(selected.id); setSelected(null); }}
                    className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-gray-900 text-white rounded-lg hover:bg-gray-800"
                  >
                    <ThumbsUp className="w-4 h-4" /> Approve
                  </button>
                )}
                <button
                  onClick={() => deleteReview(selected.id)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg ml-auto"
                >
                  <Trash2 className="w-4 h-4" /> Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
