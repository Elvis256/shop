"use client";

import { useState, useEffect, useCallback } from "react";
import { apiFetch } from "@/lib/api";
import {
  ShoppingCart, Mail, Check, Loader2, Trash2,
  TrendingUp, AlertTriangle, DollarSign, RefreshCw,
} from "lucide-react";

function fmt(amount: number) {
  return `UGX ${Number(amount || 0).toLocaleString()}`;
}

function formatDate(dateStr: string) {
  const date = new Date(dateStr);
  const days = Math.floor((Date.now() - date.getTime()) / 86400000);
  const time = date.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  if (days === 0) return `Today ${time}`;
  if (days === 1) return `Yesterday ${time}`;
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function getStayDuration(cart: AbandonedCart) {
  const start = new Date(cart.createdAt).getTime();
  const end = cart.recoveredAt ? new Date(cart.recoveredAt).getTime() : Date.now();
  const diffMs = end - start;
  
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "Less than a minute";
  if (mins < 60) return `${mins}m`;
  
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) {
    const remainingMins = mins % 60;
    return `${hrs}h ${remainingMins}m`;
  }
  
  const days = Math.floor(hrs / 24);
  const remainingHrs = hrs % 24;
  return `${days}d ${remainingHrs}h`;
}

interface AbandonedCart {
  id: string;
  cartId: string;
  email: string | null;
  cartValue: number;
  currency: string;
  email1SentAt: string | null;
  email2SentAt: string | null;
  recoveredAt: string | null;
  createdAt: string;
  cartData: any[];
}

interface Stats {
  total: number;
  recovered: number;
  reminded: number;
  pending: number;
  lostValue: number;
  recoveredValue: number;
  recoveryRate: number;
}

export default function AbandonedCartsPage() {
  const [carts, setCarts] = useState<AbandonedCart[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "pending" | "reminded" | "recovered">("all");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [expandedCartId, setExpandedCartId] = useState<string | null>(null);

  const fetchCarts = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: "20" });
      if (filter !== "all") params.set("status", filter);
      const data = await apiFetch(`/api/admin/abandoned-carts?${params}`);
      setCarts(data.carts || []);
      setStats(data.stats || null);
      setTotalPages(data.pagination?.pages || 1);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [page, filter]);

  useEffect(() => { fetchCarts(); }, [fetchCarts]);

  const sendReminder = async (id: string) => {
    try {
      await apiFetch(`/api/admin/abandoned-carts/${id}/send-reminder`, { method: "POST" });
      fetchCarts();
    } catch { /* ignore */ }
  };

  const deleteCart = async (id: string) => {
    try {
      await apiFetch(`/api/admin/abandoned-carts/${id}`, { method: "DELETE" });
      fetchCarts();
    } catch { /* ignore */ }
  };

  const getStatus = (cart: AbandonedCart) => {
    if (cart.recoveredAt) return { label: "Recovered", color: "bg-green-100 text-green-800" };
    if (cart.email2SentAt) return { label: "2nd Reminder Sent", color: "bg-orange-100 text-orange-800" };
    if (cart.email1SentAt) return { label: "1st Reminder Sent", color: "bg-blue-100 text-blue-800" };
    return { label: "Pending", color: "bg-yellow-100 text-yellow-800" };
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Abandoned Carts</h1>
          <p className="text-sm text-gray-500 mt-1">Track and recover abandoned shopping carts</p>
        </div>
        <button onClick={fetchCarts} className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-lg text-sm hover:bg-gray-800">
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center gap-2 text-gray-500 text-sm mb-1">
              <ShoppingCart className="w-4 h-4" /> Total Abandoned
            </div>
            <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center gap-2 text-green-600 text-sm mb-1">
              <Check className="w-4 h-4" /> Recovered
            </div>
            <p className="text-2xl font-bold text-gray-900">{stats.recovered}</p>
            <p className="text-xs text-green-600 mt-1">{stats.recoveryRate}% recovery rate</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center gap-2 text-red-500 text-sm mb-1">
              <AlertTriangle className="w-4 h-4" /> Lost Revenue
            </div>
            <p className="text-2xl font-bold text-gray-900">{fmt(stats.lostValue)}</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center gap-2 text-blue-600 text-sm mb-1">
              <TrendingUp className="w-4 h-4" /> Recovered Revenue
            </div>
            <p className="text-2xl font-bold text-gray-900">{fmt(stats.recoveredValue)}</p>
          </div>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex gap-2">
        {(["all", "pending", "reminded", "recovered"] as const).map((f) => (
          <button
            key={f}
            onClick={() => { setFilter(f); setPage(1); }}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filter === f
                ? "bg-gray-900 text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {/* Cart List */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
        </div>
      ) : carts.length === 0 ? (
        <div className="text-center py-20 text-gray-500">
          <ShoppingCart className="w-10 h-10 mx-auto mb-3 text-gray-300" />
          <p>No abandoned carts found</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-4 py-3 font-medium text-gray-600">Email</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Cart Value</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Items</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Abandoned</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {carts.map((cart) => {
                const status = getStatus(cart);
                const items = Array.isArray(cart.cartData) ? cart.cartData : [];
                return (
                  <tr key={cart.id} className="hover:bg-gray-50/50 cursor-pointer select-none" onClick={(e) => {
                    if ((e.target as HTMLElement).closest("button") || (e.target as HTMLElement).closest("svg")) return;
                    setExpandedCartId(expandedCartId === cart.id ? null : cart.id);
                  }}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] text-gray-400 transition-transform ${expandedCartId === cart.id ? "rotate-90" : ""}`}>▶</span>
                        <span className="text-gray-900">{cart.email || "—"}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 font-medium">
                      {fmt(Number(cart.cartValue))}
                    </td>
                    <td className="px-4 py-3 text-gray-500">
                      {items.length} item{items.length !== 1 ? "s" : ""}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${status.color}`}>
                        {status.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500">{formatDate(cart.createdAt)}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {!cart.recoveredAt && !cart.email1SentAt && (
                          <button
                            onClick={() => sendReminder(cart.id)}
                            className="p-1.5 rounded-lg hover:bg-blue-50 text-blue-600"
                            title="Send reminder"
                          >
                            <Mail className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          onClick={() => deleteCart(cart.id)}
                          className="p-1.5 rounded-lg hover:bg-red-50 text-red-500"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {/* Expandable drawer for cart items rendering below mapping */}
              {carts.map((cart) => {
                const items = Array.isArray(cart.cartData) ? cart.cartData : [];
                if (expandedCartId !== cart.id) return null;
                return (
                  <tr key={`expanded-${cart.id}`} className="bg-gray-50/50">
                    <td colSpan={6} className="px-6 py-4 border-t border-b border-gray-100">
                      <div className="space-y-4">
                        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 pb-3">
                          <div className="flex items-center gap-1.5 text-xs text-gray-400 uppercase tracking-wider font-semibold">
                            <ShoppingCart className="w-3.5 h-3.5 text-gray-500" />
                            Cart Contents
                          </div>
                          <div className="text-xs text-gray-500 flex gap-4">
                            <span>
                              <strong>Placed in cart:</strong> {new Date(cart.createdAt).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}
                            </span>
                            <span>
                              <strong>Time in cart:</strong> {getStayDuration(cart)} {cart.recoveredAt ? "(Recovered)" : "(Active)"}
                            </span>
                          </div>
                        </div>
                        {items.length === 0 ? (
                          <p className="text-xs text-gray-400">No item details captured</p>
                        ) : (
                          <div className="grid gap-2 max-w-3xl">
                            {items.map((item: any, idx: number) => {
                              const prodName = item.productName || item.product?.name || item.name || "Product " + (item.productId || idx);
                              const prodPrice = item.price || item.product?.price || 0;
                              return (
                                <div key={item.id || idx} className="flex justify-between items-center bg-white border border-gray-100 rounded-xl p-3 shadow-xs text-xs">
                                  <div className="font-semibold text-gray-800 flex-1 pr-4 truncate">
                                    {prodName}
                                  </div>
                                  <div className="text-gray-500 font-mono flex items-center gap-2">
                                    <span className="bg-gray-100 text-gray-700 font-sans font-medium px-1.5 py-0.5 rounded text-[10px]">
                                      Qty: {item.quantity}
                                    </span>
                                    <span>
                                      {cart.currency} {Number(prodPrice).toLocaleString()}
                                    </span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            disabled={page <= 1}
            onClick={() => setPage(page - 1)}
            className="px-3 py-1.5 rounded-lg text-sm bg-gray-100 hover:bg-gray-200 disabled:opacity-50"
          >
            Previous
          </button>
          <span className="text-sm text-gray-500">Page {page} of {totalPages}</span>
          <button
            disabled={page >= totalPages}
            onClick={() => setPage(page + 1)}
            className="px-3 py-1.5 rounded-lg text-sm bg-gray-100 hover:bg-gray-200 disabled:opacity-50"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
