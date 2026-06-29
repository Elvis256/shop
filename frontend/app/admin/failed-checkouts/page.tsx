"use client";

import { useEffect, useState, useCallback } from "react";
import { apiFetch } from "@/lib/api";
import { AlertTriangle, Check, Clock, RefreshCw, Loader2, User as UserIcon, ShoppingCart } from "lucide-react";

interface FailedCheckout {
  id: string;
  idempotencyKey: string;
  failureReason: string | null;
  failureCode: string | null;
  status: string;
  createdAt: string;
  acknowledgedAt: string | null;
  user: { id: string; email: string; name: string | null } | null;
  cartData?: any[] | null;
  cartValue?: number | null;
  currency?: string | null;
}

interface Stats {
  total: number;
  unacknowledged: number;
  last24h: number;
  byCode: { code: string; count: number }[];
}

const codeColor: Record<string, string> = {
  CART_EMPTY: "bg-yellow-100 text-yellow-700",
  DELIVERY: "bg-orange-100 text-orange-700",
  COD: "bg-amber-100 text-amber-700",
  PAYMENT: "bg-red-100 text-red-700",
  VALIDATION: "bg-blue-100 text-blue-700",
  STOCK: "bg-pink-100 text-pink-700",
  INTERNAL: "bg-gray-200 text-gray-800",
};

function formatDate(s: string) {
  const d = new Date(s);
  const mins = Math.floor((Date.now() - d.getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

export default function FailedCheckoutsPage() {
  const [items, setItems] = useState<FailedCheckout[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [filter, setFilter] = useState<"unack" | "all" | "ack">("unack");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState<string | null>(null);
  const [expandedAttemptId, setExpandedAttemptId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetch(`/api/admin/failed-checkouts?filter=${filter}&page=${page}`);
      setItems(data.items || []);
      setStats(data.stats || null);
      setPagination(data.pagination || null);
    } catch (e) {
      console.error("Failed to load failed checkouts", e);
    } finally {
      setLoading(false);
    }
  }, [filter, page]);

  useEffect(() => {
    setPage(1);
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  const acknowledge = async (id: string) => {
    setActionId(id);
    try {
      await apiFetch(`/api/admin/failed-checkouts/${id}/acknowledge`, { method: "POST" });
      await load();
    } finally {
      setActionId(null);
    }
  };

  const acknowledgeAll = async () => {
    if (!confirm("Acknowledge ALL unreviewed failed checkouts?")) return;
    setActionId("all");
    try {
      await apiFetch(`/api/admin/failed-checkouts/acknowledge-all`, { method: "POST" });
      await load();
    } finally {
      setActionId(null);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <AlertTriangle className="w-6 h-6 text-red-500" />
            Failed Checkouts
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Customers who attempted to check out but the order did not complete. Investigate to improve conversion.
          </p>
        </div>
        <button
          onClick={load}
          className="flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 hover:bg-gray-50 text-sm"
        >
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <div className="text-xs text-gray-500 uppercase">Total failed</div>
            <div className="text-2xl font-bold">{stats.total}</div>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <div className="text-xs text-gray-500 uppercase">Unacknowledged</div>
            <div className="text-2xl font-bold text-red-600">{stats.unacknowledged}</div>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <div className="text-xs text-gray-500 uppercase">Last 24h</div>
            <div className="text-2xl font-bold">{stats.last24h}</div>
          </div>
        </div>
      )}

      {/* By code breakdown */}
      {stats && stats.byCode.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl p-4 mb-6">
          <div className="text-xs text-gray-500 uppercase mb-3">Failures by type (last 7 days)</div>
          <div className="flex flex-wrap gap-2">
            {stats.byCode.map((c) => (
              <span key={c.code} className={`px-3 py-1 rounded-full text-xs font-medium ${codeColor[c.code] || "bg-gray-100 text-gray-700"}`}>
                {c.code}: {c.count}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Filters + bulk action */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex gap-2">
          {(["unack", "all", "ack"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium ${filter === f ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"}`}
            >
              {f === "unack" ? "Unreviewed" : f === "ack" ? "Acknowledged" : "All"}
            </button>
          ))}
        </div>
        {filter === "unack" && items.length > 0 && (
          <button
            onClick={acknowledgeAll}
            disabled={actionId === "all"}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-blue-50 text-blue-700 text-sm font-medium hover:bg-blue-100 disabled:opacity-50"
          >
            {actionId === "all" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            Acknowledge all
          </button>
        )}
      </div>

      {/* List */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-gray-500"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></div>
        ) : items.length === 0 ? (
          <div className="p-12 text-center text-gray-500">
            <ShoppingCart className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p>No failed checkouts {filter === "unack" ? "to review" : "found"}.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {items.map((it) => {
              const hasCart = it.cartData && Array.isArray(it.cartData) && it.cartData.length > 0;
              const isExpanded = expandedAttemptId === it.id;
              const cartItems = hasCart ? (it.cartData as any[]) : [];
              return (
                <div key={it.id} className="border-b border-gray-100 last:border-b-0">
                  <div
                    onClick={(e) => {
                      if ((e.target as HTMLElement).closest("button") || (e.target as HTMLElement).closest("svg")) return;
                      if (hasCart) {
                        setExpandedAttemptId(isExpanded ? null : it.id);
                      }
                    }}
                    className={`p-4 flex items-start gap-4 transition-colors ${hasCart ? "cursor-pointer hover:bg-gray-50/70" : ""} ${isExpanded ? "bg-gray-50/50" : ""}`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        {hasCart && (
                          <span className={`text-[10px] text-gray-400 transition-transform ${isExpanded ? "rotate-90" : ""}`}>▶</span>
                        )}
                        <span className={`px-2 py-0.5 rounded text-xs font-semibold ${codeColor[it.failureCode || "INTERNAL"] || "bg-gray-100 text-gray-700"}`}>
                          {it.failureCode || "UNKNOWN"}
                        </span>
                        {!it.acknowledgedAt && (
                          <span className="px-2 py-0.5 rounded text-xs bg-red-50 text-red-600 font-medium">NEW</span>
                        )}
                        <span className="text-xs text-gray-500 flex items-center gap-1">
                          <Clock className="w-3 h-3" /> {formatDate(it.createdAt)}
                        </span>
                      </div>
                      <p className="text-sm text-gray-900 mb-1 break-words font-medium">{it.failureReason || "(no reason recorded)"}</p>
                      
                      {/* Show Cart Total Summary if available */}
                      {it.cartValue && (
                        <p className="text-xs text-gray-700 mb-1.5">
                          Cart Value: <strong className="font-semibold text-gray-950">{it.currency || "UGX"} {Number(it.cartValue).toLocaleString()}</strong>
                        </p>
                      )}

                      <div className="text-xs text-gray-500 flex items-center gap-3 flex-wrap mt-1">
                        <span className="flex items-center gap-1">
                          <UserIcon className="w-3 h-3" />
                          {it.user ? `${it.user.name || it.user.email}` : "Guest"}
                        </span>
                        <span className="font-mono text-[10px] truncate max-w-[200px]" title={it.idempotencyKey}>{it.idempotencyKey}</span>
                      </div>
                    </div>
                    {!it.acknowledgedAt && (
                      <button
                        onClick={() => acknowledge(it.id)}
                        disabled={actionId === it.id}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-sm font-medium disabled:opacity-50 shrink-0"
                      >
                        {actionId === it.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                        Ack
                      </button>
                    )}
                  </div>
                  
                  {/* Expanded Items snapshot */}
                  {hasCart && isExpanded && (
                    <div className="px-10 pb-4 pt-1 bg-gray-50/20 border-t border-gray-100/50">
                      <div className="space-y-3">
                        <div className="flex items-center gap-1.5 text-xs text-gray-400 uppercase tracking-wider font-semibold">
                          <ShoppingCart className="w-3.5 h-3.5 text-gray-500" />
                          Cart Contents at Attempt
                        </div>
                        <div className="grid gap-2 max-w-2xl">
                          {cartItems.map((item: any, idx: number) => {
                            const prodName = item.productName || item.product?.name || item.name || "Product " + (item.productId || idx);
                            const prodPrice = item.price || item.product?.price || 0;
                            return (
                              <div key={item.productId || idx} className="flex justify-between items-center bg-white border border-gray-100 rounded-xl p-2.5 shadow-xs text-xs">
                                <div className="font-semibold text-gray-800 flex-1 pr-4 truncate">
                                  {prodName}
                                </div>
                                <div className="text-gray-500 font-mono flex items-center gap-2">
                                  <span className="bg-gray-100 text-gray-700 font-sans font-medium px-1.5 py-0.5 rounded text-[10px]">
                                    Qty: {item.quantity}
                                  </span>
                                  <span>
                                    {it.currency || "UGX"} {Number(prodPrice).toLocaleString()}
                                  </span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
        {pagination && pagination.pages > 1 && (
          <div className="flex items-center justify-between p-4 border-t bg-gray-50/50">
            <p className="text-xs text-gray-500">
              Page {pagination.page} of {pagination.pages} · {pagination.total} failures
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={pagination.page === 1}
                className="px-3 py-1.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 text-xs font-medium disabled:opacity-45"
              >
                Previous
              </button>
              <button
                onClick={() => setPage((p) => Math.min(pagination.pages, p + 1))}
                disabled={pagination.page === pagination.pages}
                className="px-3 py-1.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 text-xs font-medium disabled:opacity-45"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
