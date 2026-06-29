"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { api } from "@/lib/api";
import {
  Search, Eye, Truck, Package, RefreshCw, Download, CheckSquare, Square,
  Calendar, ShoppingCart, DollarSign, Clock, AlertTriangle,
  CheckCircle, XCircle, ChevronRight, Gift,
} from "lucide-react";

import type { OrderListItem } from "@/lib/types/api";

interface Order extends OrderListItem {
  isSplitPayment?: boolean;
  splitPartnerPaid?: boolean;
  splitPaidAmount?: number | string;
  expiresAt?: string | null;
}

function ReservationCountdown({ expiresAt }: { expiresAt: string }) {
  const [timeLeft, setTimeLeft] = useState<string>("");

  useEffect(() => {
    const update = () => {
      const diff = new Date(expiresAt).getTime() - Date.now();
      if (diff <= 0) {
        setTimeLeft("Expired");
        return;
      }
      const mins = Math.floor(diff / 60000);
      const secs = Math.floor((diff % 60000) / 1000);
      setTimeLeft(`${mins}m ${secs}s`);
    };
    update();
    const timer = setInterval(update, 1000);
    return () => clearInterval(timer);
  }, [expiresAt]);

  if (timeLeft === "Expired") {
    return <span className="text-red-500 font-medium text-xs mt-0.5">Timeout</span>;
  }

  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-orange-600 bg-orange-50 px-1.5 py-0.5 rounded border border-orange-100 mt-1">
      <Clock className="w-3 h-3 shrink-0" />
      {timeLeft}
    </span>
  );
}

const statusConfig: Record<string, { bg: string; dot: string }> = {
  DELIVERED: { bg: "bg-green-50 text-green-700 border-green-200", dot: "bg-green-500" },
  SHIPPED: { bg: "bg-blue-50 text-blue-700 border-blue-200", dot: "bg-blue-500" },
  PROCESSING: { bg: "bg-yellow-50 text-yellow-700 border-yellow-200", dot: "bg-yellow-500" },
  CONFIRMED: { bg: "bg-purple-50 text-purple-700 border-purple-200", dot: "bg-purple-500" },
  PENDING: { bg: "bg-gray-50 text-gray-600 border-gray-200", dot: "bg-gray-400" },
  CANCELLED: { bg: "bg-red-50 text-red-700 border-red-200", dot: "bg-red-500" },
  REFUNDED: { bg: "bg-orange-50 text-orange-700 border-orange-200", dot: "bg-orange-500" },
};

const paymentStatusColors: Record<string, string> = {
  SUCCESSFUL: "text-green-600",
  PENDING: "text-yellow-600",
  FAILED: "text-red-600",
  REFUNDED: "text-orange-600",
};

const paymentMethodLabels: Record<string, string> = {
  MOBILE_MONEY: "Mobile Money",
  CARD: "Card",
  PAYPAL: "PayPal",
  COD: "Cash on Delivery",
};

export default function AdminOrdersPage() {
  const searchParams = useSearchParams();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState(searchParams.get("status") || "");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkAction, setBulkAction] = useState("");
  // FIX H9: Track bulk confirmation state
  const [bulkConfirming, setBulkConfirming] = useState(false);
  const [bulkResult, setBulkResult] = useState<{ success: number; failed: number } | null>(null);
  const [pagination, setPagination] = useState({ total: 0, page: 1, totalPages: 1 });
  const [giftFilter, setGiftFilter] = useState(false);
  const [quickActing, setQuickActing] = useState<string | null>(null);
  const [trackingInput, setTrackingInput] = useState<{ orderId: string; value: string } | null>(null);
  const loadOrders = (params: Record<string, string> = {}) => {
    setLoading(true);
    const extra: Record<string, string> = {};
    if (dateFrom) extra.dateFrom = dateFrom;
    if (dateTo) extra.dateTo = dateTo;
    if (giftFilter) extra.isGift = "true";
    api.admin.getOrders({ search, status: statusFilter, ...extra, ...params })
      .then((data) => {
        setOrders(data.orders);
        setPagination(data.pagination);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadOrders(); }, [search, statusFilter, dateFrom, dateTo, giftFilter]);

  const toggleSelect = (id: string) =>
    setSelectedIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);

  const toggleAll = () =>
    setSelectedIds(selectedIds.length === orders.length ? [] : orders.map((o) => o.id));

  const applyBulkAction = async () => {
    if (!bulkAction || !selectedIds.length) return;
    const statusMap: Record<string, string> = {
      confirmed: "CONFIRMED",
      processing: "PROCESSING",
      shipped: "SHIPPED",
      delivered: "DELIVERED",
    };
    const newStatus = statusMap[bulkAction];
    if (!newStatus) return;

    // FIX H9: Show confirmation before executing bulk action
    if (!bulkConfirming) {
      setBulkConfirming(true);
      return;
    }

    // FIX H9: Per-order error handling instead of fire-and-forget Promise.all
    setBulkConfirming(false);
    setBulkResult(null);
    let success = 0;
    let failed = 0;
    for (const id of selectedIds) {
      try {
        await api.admin.updateOrderStatus(id, newStatus);
        success++;
      } catch {
        failed++;
      }
    }
    setBulkResult({ success, failed });
    setSelectedIds([]);
    setBulkAction("");
    loadOrders();
  };

  const exportCSV = async () => {
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set("status", statusFilter);
      const API_URL = typeof window !== "undefined" ? "" : (process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000");
      const resp = await fetch(`${API_URL}/api/admin/orders/export/csv?${params.toString()}`, { credentials: "include" });
      if (!resp.ok) throw new Error("Export failed");
      const blob = await resp.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `orders-${new Date().toISOString().split("T")[0]}.csv`;
      a.click();
    } catch {
      // Fallback to client-side export of current page
      const rows = [
        ["Order #", "Customer", "Email", "Items", "Total", "Currency", "Status", "Payment Status", "Payment Method", "Date"],
        ...orders.map((o) => [
          o.orderNumber, o.customerName, o.customerEmail, String(o.itemCount),
          String(o.totalAmount), o.currency || "UGX", o.status, o.paymentStatus,
          o.paymentMethod || "", new Date(o.createdAt).toLocaleDateString(),
        ]),
      ];
      const csv = rows.map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
      const blob = new Blob([csv], { type: "text/csv" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `orders-${new Date().toISOString().split("T")[0]}.csv`;
      a.click();
    }
  };

  const getStatusBadge = (status: string) => {
    const cfg = statusConfig[status] || statusConfig.PENDING;
    return (
      <span className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border font-medium ${cfg.bg}`}>
        <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
        {status}
      </span>
    );
  };

  const quickAction = async (orderId: string, newStatus: string, trackingNumber?: string) => {
    setQuickActing(orderId);
    try {
      await api.admin.updateOrderStatus(orderId, newStatus, undefined, trackingNumber);
      loadOrders();
    } catch (e) {
      console.error("Quick action failed:", e);
    } finally {
      setQuickActing(null);
      setTrackingInput(null);
    }
  };

  const getNextAction = (order: Order): { label: string; status: string; icon: typeof CheckCircle; color: string; needsTracking?: boolean } | null => {
    const map: Record<string, { label: string; status: string; icon: typeof CheckCircle; color: string; needsTracking?: boolean }> = {
      PENDING: { label: "Confirm", status: "CONFIRMED", icon: CheckCircle, color: "text-purple-600 bg-purple-50 border-purple-200 hover:bg-purple-100" },
      CONFIRMED: { label: "Process", status: "PROCESSING", icon: Package, color: "text-yellow-700 bg-yellow-50 border-yellow-200 hover:bg-yellow-100" },
      PROCESSING: { label: "Ship", status: "SHIPPED", icon: Truck, color: "text-blue-600 bg-blue-50 border-blue-200 hover:bg-blue-100", needsTracking: true },
      SHIPPED: { label: "Deliver", status: "DELIVERED", icon: CheckCircle, color: "text-green-600 bg-green-50 border-green-200 hover:bg-green-100" },
    };
    return map[order.status] || null;
  };

  // Summary stats
  const pendingCount = orders.filter((o) => o.status === "PENDING").length;
  const processingCount = orders.filter((o) => o.status === "PROCESSING" || o.status === "CONFIRMED").length;
  const shippedCount = orders.filter((o) => o.status === "SHIPPED").length;
  const totalRevenue = orders
    .filter((o) => o.paymentStatus === "SUCCESSFUL")
    .reduce((sum, o) => sum + Number(o.totalAmount), 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Orders</h1>
          <p className="text-gray-500 text-sm">{pagination.total} total orders</p>
        </div>
        <button onClick={exportCSV} className="btn-secondary gap-2 flex items-center text-sm">
          <Download className="w-4 h-4" />
          Export CSV
        </button>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-yellow-50 flex items-center justify-center">
              <Clock className="w-5 h-5 text-yellow-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{pendingCount}</p>
              <p className="text-xs text-gray-500">Pending</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-purple-50 flex items-center justify-center">
              <Package className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{processingCount}</p>
              <p className="text-xs text-gray-500">Processing</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
              <Truck className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{shippedCount}</p>
              <p className="text-xs text-gray-500">Shipped</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-green-50 flex items-center justify-center">
              <DollarSign className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">
                {totalRevenue > 0 ? `${Math.round(totalRevenue / 1000)}k` : "0"}
              </p>
              <p className="text-xs text-gray-500">Revenue (UGX)</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border p-4">
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              className="input pl-10 text-sm"
              placeholder="Search by order #, name, or email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <select
            className="input w-40 text-sm"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="">All Status</option>
            <option value="PENDING">Pending</option>
            <option value="CONFIRMED">Confirmed</option>
            <option value="PROCESSING">Processing</option>
            <option value="SHIPPED">Shipped</option>
            <option value="DELIVERED">Delivered</option>
            <option value="CANCELLED">Cancelled</option>
            <option value="REFUNDED">Refunded</option>
          </select>
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-gray-400" />
            <input type="date" className="input w-36 text-sm" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
            <span className="text-gray-400 text-sm">–</span>
            <input type="date" className="input w-36 text-sm" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          </div>
          <button
            onClick={() => setGiftFilter(!giftFilter)}
            className={`flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg border transition-colors ${giftFilter ? "bg-pink-50 text-pink-700 border-pink-300" : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"}`}
          >
            <Gift className="w-4 h-4" />
            Gift Orders
          </button>
          <button onClick={() => loadOrders()} className="btn-secondary gap-2 flex items-center text-sm">
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
        </div>
      </div>

      {/* Bulk Actions */}
      {selectedIds.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 flex flex-col gap-2">
          <div className="flex items-center gap-4">
            <span className="text-sm text-blue-700 font-medium">{selectedIds.length} selected</span>
            <select
              className="input w-48 text-sm"
              value={bulkAction}
              onChange={(e) => { setBulkAction(e.target.value); setBulkConfirming(false); }}
            >
              <option value="">Bulk Action</option>
              <option value="confirmed">Mark as Confirmed</option>
              <option value="processing">Mark as Processing</option>
              <option value="shipped">Mark as Shipped</option>
              <option value="delivered">Mark as Delivered</option>
            </select>
            {/* FIX H9: Two-step confirmation */}
            {bulkConfirming ? (
              <span className="flex items-center gap-2">
                <span className="text-sm text-orange-700 font-semibold">
                  Update {selectedIds.length} orders to {bulkAction.toUpperCase()}?
                </span>
                <button onClick={applyBulkAction} className="btn-primary text-sm py-1.5 bg-orange-600">
                  Confirm
                </button>
                <button onClick={() => { setBulkConfirming(false); setBulkAction(""); }} className="text-sm text-gray-600 hover:underline">
                  Cancel
                </button>
              </span>
            ) : (
              <button onClick={applyBulkAction} disabled={!bulkAction} className="btn-primary text-sm py-1.5">
                Apply
              </button>
            )}
            <button onClick={() => { setSelectedIds([]); setBulkConfirming(false); }} className="text-sm text-blue-600 hover:underline ml-auto">
              Clear
            </button>
          </div>
          {/* FIX H9: Show per-order result summary */}
          {bulkResult && (
            <div className={`text-xs px-3 py-2 rounded-lg border flex items-center gap-2 ${bulkResult.failed > 0 ? "bg-red-50 border-red-200 text-red-700" : "bg-green-50 border-green-200 text-green-700"}`}>
              ✓ {bulkResult.success} updated successfully
              {bulkResult.failed > 0 && ` · ✗ ${bulkResult.failed} failed (check order status constraints)`}
              <button onClick={() => setBulkResult(null)} className="ml-auto text-current opacity-60 hover:opacity-100">✕</button>
            </div>
          )}
        </div>
      )}

      {/* Orders Table */}
      <div className="bg-white rounded-xl border overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50/80 border-b">
            <tr>
              <th className="p-4 w-10">
                <button onClick={toggleAll} className="text-gray-400 hover:text-gray-600">
                  {selectedIds.length === orders.length && orders.length > 0 ? (
                    <CheckSquare className="w-4 h-4 text-primary" />
                  ) : (
                    <Square className="w-4 h-4" />
                  )}
                </button>
              </th>
              <th className="p-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Order</th>
              <th className="p-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Customer</th>
              <th className="p-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Total</th>
              <th className="p-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Payment</th>
              <th className="p-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
              <th className="p-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Date</th>
              <th className="p-4 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr>
                <td colSpan={8} className="p-12 text-center">
                  <div className="flex flex-col items-center gap-3">
                    <RefreshCw className="w-6 h-6 text-gray-300 animate-spin" />
                    <span className="text-sm text-gray-400">Loading orders...</span>
                  </div>
                </td>
              </tr>
            ) : orders.length === 0 ? (
              <tr>
                <td colSpan={8} className="p-12 text-center">
                  <div className="flex flex-col items-center gap-3">
                    <ShoppingCart className="w-10 h-10 text-gray-200" />
                    <span className="text-sm text-gray-400">No orders found</span>
                  </div>
                </td>
              </tr>
            ) : (
              orders.map((order) => (
                <tr
                  key={order.id}
                  className={`group hover:bg-gray-50/50 transition-colors ${selectedIds.includes(order.id) ? "bg-blue-50/50" : ""}`}
                >
                  <td className="p-4">
                    <button onClick={() => toggleSelect(order.id)} className="text-gray-400 hover:text-gray-600">
                      {selectedIds.includes(order.id) ? (
                        <CheckSquare className="w-4 h-4 text-primary" />
                      ) : (
                        <Square className="w-4 h-4" />
                      )}
                    </button>
                  </td>
                  <td className="p-4">
                    <Link href={`/admin/orders/${order.id}`} className="hover:text-primary transition-colors">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <p className="font-medium text-sm">#{order.orderNumber.split("-").slice(-1)[0]}</p>
                        {order.isGift && <span title="Gift order"><Gift className="w-3.5 h-3.5 text-pink-500" /></span>}
                        {order.isSplitPayment && (
                          <span className="text-[10px] px-1 py-0.5 rounded bg-blue-50 text-blue-600 border border-blue-100 font-semibold" title="Split Payment">
                            SPLIT
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-400">{order.itemCount} item{order.itemCount !== 1 ? "s" : ""}</p>
                    </Link>
                  </td>
                  <td className="p-4">
                    <p className="font-medium text-sm text-gray-900">{order.customerName}</p>
                    <p className="text-xs text-gray-400 truncate max-w-[180px]">{order.customerEmail}</p>
                  </td>
                  <td className="p-4">
                    <p className="font-semibold text-sm">
                      USh {Number(order.totalAmount).toLocaleString()}
                    </p>
                  </td>
                  <td className="p-4">
                    <p className={`text-xs font-medium ${paymentStatusColors[order.paymentStatus] || "text-gray-500"}`}>
                      {order.paymentStatus}
                    </p>
                    {order.paymentMethod && (
                      <p className="text-xs text-gray-400 mt-0.5">
                        {paymentMethodLabels[order.paymentMethod] || order.paymentMethod}
                      </p>
                    )}
                  </td>
                  <td className="p-4">
                    <div className="flex flex-col items-start gap-1">
                      {getStatusBadge(order.status)}
                      {order.status === "PENDING" && order.expiresAt && (
                        <ReservationCountdown expiresAt={order.expiresAt} />
                      )}
                    </div>
                  </td>
                  <td className="p-4 text-xs text-gray-400">
                    {new Date(order.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                  </td>
                  <td className="p-4 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      {(() => {
                        const action = getNextAction(order);
                        if (!action) return null;
                        const Icon = action.icon;
                        if (action.needsTracking && trackingInput?.orderId === order.id) {
                          return (
                            <div className="flex items-center gap-1">
                              <input
                                type="text"
                                placeholder="Tracking #"
                                value={trackingInput.value}
                                onChange={(e) => setTrackingInput({ orderId: order.id, value: e.target.value })}
                                className="w-24 text-xs px-2 py-1 border rounded"
                                autoFocus
                              />
                              <button
                                onClick={() => quickAction(order.id, action.status, trackingInput.value || undefined)}
                                disabled={quickActing === order.id}
                                className="p-1 text-blue-600 hover:bg-blue-50 rounded"
                                title="Confirm ship"
                              >
                                <CheckCircle className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => setTrackingInput(null)}
                                className="p-1 text-gray-400 hover:bg-gray-50 rounded"
                              >
                                <XCircle className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          );
                        }
                        return (
                          <button
                            onClick={() => {
                              if (action.needsTracking) {
                                setTrackingInput({ orderId: order.id, value: "" });
                              } else {
                                quickAction(order.id, action.status);
                              }
                            }}
                            disabled={quickActing === order.id}
                            className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-medium border rounded-lg transition-colors disabled:opacity-50 ${action.color}`}
                            title={`${action.label} order`}
                          >
                            <Icon className="w-3 h-3" />
                            {quickActing === order.id ? "..." : action.label}
                          </button>
                        );
                      })()}
                      <Link
                        href={`/admin/orders/${order.id}`}
                        className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                      >
                        <Eye className="w-3 h-3" />
                        View
                      </Link>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {pagination.totalPages > 1 && (
          <div className="flex items-center justify-between p-4 border-t bg-gray-50/50">
            <p className="text-xs text-gray-500">
              Page {pagination.page} of {pagination.totalPages} · {pagination.total} orders
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => loadOrders({ page: String(pagination.page - 1) })}
                disabled={pagination.page === 1}
                className="btn-secondary text-xs py-1.5 px-3 disabled:opacity-40"
              >
                Previous
              </button>
              <button
                onClick={() => loadOrders({ page: String(pagination.page + 1) })}
                disabled={pagination.page === pagination.totalPages}
                className="btn-secondary text-xs py-1.5 px-3 disabled:opacity-40"
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

