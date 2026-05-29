"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import {
  Search,
  ChevronLeft,
  ChevronRight,
  X,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Loader2,
  Package,
  Eye,
  MessageSquare,
} from "lucide-react";

interface Product {
  id: string;
  name: string;
  slug: string;
  description?: string;
  price: number;
  comparePrice?: number;
  status: string;
  stock: number;
  moderationNote?: string;
  createdAt: string;
  images: { url: string; alt?: string }[];
  category?: { id: string; name: string };
  seller?: { id: string; storeName: string; email: string; logo?: string };
}

export default function ProductModerationPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [selected, setSelected] = useState<Product | null>(null);
  const [actionReason, setActionReason] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({ page: String(page), limit: "20" });
      if (search) params.set("search", search);
      const data = await apiFetch(`/api/admin/product-moderation?${params}`);
      setProducts(data.products || []);
      setPendingCount(data.pendingCount || 0);
      setTotalPages(data.pagination?.pages || 1);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, [page, search]);

  const handleAction = async (action: "approve" | "reject" | "request-changes") => {
    if (!selected) return;
    if ((action === "reject" || action === "request-changes") && !actionReason.trim()) {
      alert("Please provide a reason");
      return;
    }
    setActionLoading(true);
    try {
      await apiFetch(`/api/admin/product-moderation/${selected.id}/${action}`, {
        method: "PUT",
        body: JSON.stringify({ reason: actionReason.trim() }),
      });
      setSelected(null);
      setActionReason("");
      fetchProducts();
    } catch {
      alert("Action failed");
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Product Review</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
            {pendingCount} product{pendingCount !== 1 ? "s" : ""} pending review
          </p>
        </div>
        <div className="flex items-center gap-2 bg-yellow-50 dark:bg-yellow-900/20 px-4 py-2 rounded-lg">
          <Package className="w-5 h-5 text-yellow-600" />
          <span className="text-yellow-700 dark:text-yellow-400 font-semibold text-lg">{pendingCount}</span>
          <span className="text-yellow-600 dark:text-yellow-500 text-sm">Pending</span>
        </div>
      </div>

      {/* Search */}
      <div className="mb-4">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setSearch(searchInput);
            setPage(1);
          }}
          className="flex gap-2"
        >
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search by product name or seller..."
              className="w-full pl-10 pr-4 py-2 border rounded-lg bg-white dark:bg-gray-800 dark:border-gray-700 dark:text-white"
            />
          </div>
          <button type="submit" className="px-4 py-2 bg-gray-900 text-white rounded-lg dark:bg-gray-700">
            Search
          </button>
          {search && (
            <button
              type="button"
              onClick={() => {
                setSearch("");
                setSearchInput("");
                setPage(1);
              }}
              className="px-3 py-2 border rounded-lg dark:border-gray-700 dark:text-gray-300"
            >
              Clear
            </button>
          )}
        </form>
      </div>

      {/* Products Table */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
        </div>
      ) : products.length === 0 ? (
        <div className="text-center py-20 text-gray-500 dark:text-gray-400">
          <CheckCircle className="w-12 h-12 mx-auto mb-3 text-green-400" />
          <p className="text-lg font-medium">All caught up!</p>
          <p className="text-sm">No products pending review.</p>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-lg border dark:border-gray-700 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-700/50">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-300">Product</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-300">Seller</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-300">Category</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600 dark:text-gray-300">Price</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600 dark:text-gray-300">Stock</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-300">Submitted</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600 dark:text-gray-300">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y dark:divide-gray-700">
              {products.map((p) => (
                <tr key={p.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      {p.images[0] ? (
                        <img src={p.images[0].url} alt={p.name} className="w-10 h-10 rounded object-cover" />
                      ) : (
                        <div className="w-10 h-10 rounded bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
                          <Package className="w-5 h-5 text-gray-400" />
                        </div>
                      )}
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white truncate max-w-[200px]">{p.name}</p>
                        {p.moderationNote && (
                          <p className="text-xs text-yellow-600 flex items-center gap-1 mt-0.5">
                            <MessageSquare className="w-3 h-3" /> Has notes
                          </p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{p.seller?.storeName || "—"}</td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{p.category?.name || "—"}</td>
                  <td className="px-4 py-3 text-right text-gray-900 dark:text-white">
                    UGX {Number(p.price).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-600 dark:text-gray-300">{p.stock}</td>
                  <td className="px-4 py-3 text-gray-500 dark:text-gray-400 text-xs">
                    {new Date(p.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => {
                        setSelected(p);
                        setActionReason("");
                      }}
                      className="text-blue-600 hover:text-blue-800 dark:text-blue-400"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t dark:border-gray-700">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="flex items-center gap-1 text-sm text-gray-600 dark:text-gray-400 disabled:opacity-40"
              >
                <ChevronLeft className="w-4 h-4" /> Prev
              </button>
              <span className="text-sm text-gray-500 dark:text-gray-400">
                Page {page} of {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="flex items-center gap-1 text-sm text-gray-600 dark:text-gray-400 disabled:opacity-40"
              >
                Next <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      )}

      {/* Detail Modal */}
      {selected && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setSelected(null)}>
          <div
            className="bg-white dark:bg-gray-800 rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-6 border-b dark:border-gray-700">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">Review Product</h2>
              <button onClick={() => setSelected(null)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {/* Images */}
              {selected.images.length > 0 && (
                <div className="flex gap-2 overflow-x-auto">
                  {selected.images.map((img, i) => (
                    <img
                      key={i}
                      src={img.url}
                      alt={img.alt || selected.name}
                      className="w-32 h-32 rounded-lg object-cover flex-shrink-0"
                    />
                  ))}
                </div>
              )}

              <div>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white">{selected.name}</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  by {selected.seller?.storeName || "Unknown"} ({selected.seller?.email})
                </p>
              </div>

              <div className="grid grid-cols-3 gap-4 text-sm">
                <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
                  <p className="text-gray-500 dark:text-gray-400">Price</p>
                  <p className="font-semibold text-gray-900 dark:text-white">UGX {Number(selected.price).toLocaleString()}</p>
                </div>
                <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
                  <p className="text-gray-500 dark:text-gray-400">Stock</p>
                  <p className="font-semibold text-gray-900 dark:text-white">{selected.stock}</p>
                </div>
                <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
                  <p className="text-gray-500 dark:text-gray-400">Category</p>
                  <p className="font-semibold text-gray-900 dark:text-white">{selected.category?.name || "None"}</p>
                </div>
              </div>

              {selected.description && (
                <div>
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400 whitespace-pre-wrap">{selected.description}</p>
                </div>
              )}

              {selected.moderationNote && (
                <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3">
                  <p className="text-sm font-medium text-yellow-800 dark:text-yellow-300">Previous Moderation Note</p>
                  <p className="text-sm text-yellow-700 dark:text-yellow-400 mt-1">{selected.moderationNote}</p>
                </div>
              )}

              {/* Action Reason */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Reason (required for reject/request changes)
                </label>
                <textarea
                  value={actionReason}
                  onChange={(e) => setActionReason(e.target.value)}
                  rows={3}
                  className="w-full border rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  placeholder="Enter reason for rejection or changes needed..."
                />
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => handleAction("approve")}
                  disabled={actionLoading}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 font-medium"
                >
                  {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                  Approve
                </button>
                <button
                  onClick={() => handleAction("request-changes")}
                  disabled={actionLoading}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 disabled:opacity-50 font-medium"
                >
                  {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <AlertTriangle className="w-4 h-4" />}
                  Request Changes
                </button>
                <button
                  onClick={() => handleAction("reject")}
                  disabled={actionLoading}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 font-medium"
                >
                  {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
                  Reject
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
