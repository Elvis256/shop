"use client";

import { useEffect, useState, useCallback } from "react";
import { apiFetch } from "@/lib/api";
import {
  Search,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  X,
  Loader2,
  Package,
  Repeat,
  Pause,
  Play,
  Trash2,
  Calendar,
  TrendingUp,
  AlertCircle,
  Clock,
  Eye,
  Download,
  CheckCircle2,
  XCircle,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface SubUser {
  id: string;
  name: string | null;
  email: string;
}

interface SubProduct {
  id: string;
  name: string;
  price: number;
  images: string[];
}

interface Subscription {
  id: string;
  userId: string;
  productId: string;
  quantity: number;
  intervalDays: number;
  discount: number;
  nextDelivery: string;
  status: "ACTIVE" | "PAUSED" | "CANCELLED";
  createdAt: string;
  updatedAt: string;
  user: SubUser;
  product: SubProduct;
}

interface SubStats {
  activeCount: number;
  pausedCount: number;
  monthlyRevenue: number;
  upcomingDeliveries: number;
}

type FilterStatus = "all" | "ACTIVE" | "PAUSED" | "CANCELLED";

function fmt(amount: number) {
  return `UGX ${Number(amount || 0).toLocaleString()}`;
}

function formatDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function intervalLabel(days: number) {
  if (days === 7) return "Weekly";
  if (days === 14) return "Every 2 weeks";
  if (days === 30) return "Monthly";
  if (days === 60) return "Every 2 months";
  if (days === 90) return "Quarterly";
  return `Every ${days} days`;
}

const statusStyles: Record<string, string> = {
  ACTIVE: "bg-green-50 text-green-700 border-green-200",
  PAUSED: "bg-yellow-50 text-yellow-700 border-yellow-200",
  CANCELLED: "bg-red-50 text-red-700 border-red-200",
};

/* ------------------------------------------------------------------ */
/*  Page Component                                                     */
/* ------------------------------------------------------------------ */

export default function AdminSubscriptionsPage() {
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [stats, setStats] = useState<SubStats>({
    activeCount: 0,
    pausedCount: 0,
    monthlyRevenue: 0,
    upcomingDeliveries: 0,
  });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterStatus>("all");
  const [page, setPage] = useState(1);
  const limit = 20;

  // Detail modal
  const [selected, setSelected] = useState<Subscription | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Edit interval
  const [editInterval, setEditInterval] = useState(false);
  const [newInterval, setNewInterval] = useState(30);

  // Cancel confirmation
  const [confirmCancel, setConfirmCancel] = useState(false);

  useEffect(() => {
    document.title = "Subscriptions | Admin";
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [subsRes, statsRes] = await Promise.all([
        apiFetch("/api/subscriptions/admin"),
        apiFetch("/api/subscriptions/admin/stats"),
      ]);
      setSubscriptions(Array.isArray(subsRes) ? subsRes : subsRes.subscriptions || []);
      if (statsRes) setStats(statsRes);
    } catch (e) {
      console.error("Failed to load subscriptions:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const updateSubscription = async (id: string, payload: Record<string, unknown>) => {
    setActionLoading(true);
    try {
      await apiFetch(`/api/subscriptions/admin/${id}`, {
        method: "PUT",
        body: JSON.stringify(payload),
      });
      await loadData();
      if (selected && selected.id === id) {
        setSelected((prev) => (prev ? { ...prev, ...payload } as Subscription : null));
      }
    } catch (e) {
      console.error("Failed to update subscription:", e);
    } finally {
      setActionLoading(false);
    }
  };

  const cancelSubscription = async (id: string) => {
    setActionLoading(true);
    try {
      await apiFetch(`/api/subscriptions/admin/${id}`, { method: "DELETE" });
      await loadData();
      setSelected(null);
      setConfirmCancel(false);
    } catch (e) {
      console.error("Failed to cancel subscription:", e);
    } finally {
      setActionLoading(false);
    }
  };

  const handleTogglePause = async (sub: Subscription) => {
    const newStatus = sub.status === "ACTIVE" ? "PAUSED" : "ACTIVE";
    await updateSubscription(sub.id, { status: newStatus });
  };

  const handleChangeInterval = async () => {
    if (!selected) return;
    await updateSubscription(selected.id, { intervalDays: newInterval });
    setEditInterval(false);
  };

  /* Filtering & search */
  const filtered = subscriptions.filter((s) => {
    if (filter !== "all" && s.status !== filter) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      s.user.name?.toLowerCase().includes(q) ||
      s.user.email.toLowerCase().includes(q) ||
      s.product.name.toLowerCase().includes(q)
    );
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / limit));
  const paginated = filtered.slice((page - 1) * limit, page * limit);

  useEffect(() => {
    setPage(1);
  }, [search, filter]);

  // Upcoming deliveries (next 7 days)
  const now = new Date();
  const sevenDaysOut = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const upcoming = subscriptions.filter(
    (s) =>
      s.status === "ACTIVE" &&
      new Date(s.nextDelivery) >= now &&
      new Date(s.nextDelivery) <= sevenDaysOut
  );

  const exportCSV = () => {
    const headers = [
      "Customer",
      "Email",
      "Product",
      "Interval",
      "Discount%",
      "Quantity",
      "Next Delivery",
      "Status",
      "Created",
    ];
    const rows = filtered.map((s) => [
      s.user.name || "",
      s.user.email,
      s.product.name,
      intervalLabel(s.intervalDays),
      s.discount,
      s.quantity,
      s.nextDelivery,
      s.status,
      s.createdAt,
    ]);
    const csv = [headers, ...rows].map((r) => r.map((v) => `"${v}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "subscriptions.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Subscriptions</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Manage recurring product subscriptions
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={exportCSV}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-700"
          >
            <Download className="w-4 h-4" /> Export
          </button>
          <button
            onClick={loadData}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-700"
          >
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Active", value: stats.activeCount, icon: CheckCircle2 },
          { label: "Paused", value: stats.pausedCount, icon: Pause },
          { label: "Monthly Revenue", value: fmt(stats.monthlyRevenue), icon: TrendingUp },
          { label: "Upcoming (7d)", value: stats.upcomingDeliveries, icon: Calendar },
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

      {/* Upcoming Deliveries */}
      {upcoming.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="text-sm font-medium text-blue-900 mb-2 flex items-center gap-1.5">
            <Calendar className="w-4 h-4" />
            Upcoming Deliveries (Next 7 Days)
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {upcoming.slice(0, 6).map((s) => (
              <div
                key={s.id}
                className="bg-white rounded-lg p-3 border border-blue-100 cursor-pointer hover:border-blue-300 transition-colors"
                onClick={() => {
                  setSelected(s);
                  setNewInterval(s.intervalDays);
                }}
              >
                <p className="text-sm font-medium text-gray-900 truncate">{s.product.name}</p>
                <p className="text-xs text-gray-500">
                  {s.user.name || s.user.email} · {formatDate(s.nextDelivery)}
                </p>
              </div>
            ))}
            {upcoming.length > 6 && (
              <div className="bg-white rounded-lg p-3 border border-blue-100 flex items-center justify-center">
                <p className="text-xs text-blue-600">+{upcoming.length - 6} more</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Search & Filter */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-gray-300 bg-white"
            placeholder="Search by customer or product name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex border border-gray-200 rounded-lg overflow-hidden text-sm">
          {([
            { key: "all", label: "All" },
            { key: "ACTIVE", label: "Active" },
            { key: "PAUSED", label: "Paused" },
            { key: "CANCELLED", label: "Cancelled" },
          ] as { key: FilterStatus; label: string }[]).map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`px-3 py-2 transition-colors ${
                filter === f.key
                  ? "bg-gray-900 text-white"
                  : "bg-white text-gray-600 hover:bg-gray-50"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/50">
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
                  Customer
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
                  Product
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
                  Interval
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
                  Discount
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
                  Next Delivery
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
                  Status
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
                  Created
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wide">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    <td colSpan={8} className="px-4 py-4">
                      <div
                        className="h-4 bg-gray-100 rounded animate-pulse"
                        style={{ width: `${60 + Math.random() * 30}%` }}
                      />
                    </td>
                  </tr>
                ))
              ) : paginated.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center">
                    <Repeat className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                    <p className="text-sm text-gray-500">No subscriptions found</p>
                    <p className="text-xs text-gray-400 mt-1">
                      Subscriptions will appear here when customers subscribe to products
                    </p>
                  </td>
                </tr>
              ) : (
                paginated.map((sub) => {
                  const isOverdue =
                    sub.status === "ACTIVE" && new Date(sub.nextDelivery) < now;
                  return (
                    <tr key={sub.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-gray-900 text-white rounded-full flex items-center justify-center text-xs font-medium shrink-0">
                            {(sub.user.name?.[0] || sub.user.email[0]).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">
                              {sub.user.name || "—"}
                            </p>
                            <p className="text-xs text-gray-500 truncate">{sub.user.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {sub.product.images?.[0] && (
                            <img
                              src={sub.product.images[0]}
                              alt=""
                              className="w-8 h-8 rounded object-cover border border-gray-200"
                            />
                          )}
                          <div className="min-w-0">
                            <p className="text-sm text-gray-900 truncate">{sub.product.name}</p>
                            <p className="text-xs text-gray-500">
                              {fmt(sub.product.price)} × {sub.quantity}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {intervalLabel(sub.intervalDays)}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {Number(sub.discount) > 0 ? `${sub.discount}%` : "—"}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <span
                            className={`text-sm ${
                              isOverdue ? "text-red-600 font-medium" : "text-gray-600"
                            }`}
                          >
                            {formatDate(sub.nextDelivery)}
                          </span>
                          {isOverdue && <AlertCircle className="w-3.5 h-3.5 text-red-500" />}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center text-xs px-2 py-0.5 rounded border font-medium ${
                            statusStyles[sub.status] || ""
                          }`}
                        >
                          {sub.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">
                        {formatDate(sub.createdAt)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => {
                            setSelected(sub);
                            setNewInterval(sub.intervalDays);
                            setEditInterval(false);
                            setConfirmCancel(false);
                          }}
                          className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-gray-900 underline-offset-2 hover:underline"
                        >
                          <Eye className="w-3.5 h-3.5" /> View
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
            <p className="text-xs text-gray-500">
              Showing {(page - 1) * limit + 1}–{Math.min(page * limit, filtered.length)} of{" "}
              {filtered.length}
            </p>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="p-1.5 rounded border border-gray-200 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                const p =
                  totalPages <= 5
                    ? i + 1
                    : Math.max(1, Math.min(page - 2, totalPages - 4)) + i;
                return (
                  <button
                    key={p}
                    onClick={() => setPage(p)}
                    className={`w-8 h-8 text-xs rounded border transition-colors ${
                      page === p
                        ? "bg-gray-900 text-white border-gray-900"
                        : "border-gray-200 hover:bg-gray-50 text-gray-600"
                    }`}
                  >
                    {p}
                  </button>
                );
              })}
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
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
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[85vh] flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-lg font-semibold text-gray-900">Subscription Details</h2>
              <button
                onClick={() => {
                  setSelected(null);
                  setEditInterval(false);
                  setConfirmCancel(false);
                }}
                className="p-2 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="overflow-y-auto flex-1 px-6 py-4 space-y-5">
              {/* Customer */}
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wide mb-1.5">Customer</p>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gray-900 text-white rounded-full flex items-center justify-center text-sm font-medium">
                    {(selected.user.name?.[0] || selected.user.email[0]).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {selected.user.name || "—"}
                    </p>
                    <p className="text-xs text-gray-500">{selected.user.email}</p>
                  </div>
                </div>
              </div>

              {/* Product */}
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wide mb-1.5">Product</p>
                <div className="flex items-center gap-3 bg-gray-50 rounded-lg p-3 border border-gray-100">
                  {selected.product.images?.[0] ? (
                    <img
                      src={selected.product.images[0]}
                      alt=""
                      className="w-14 h-14 rounded-lg object-cover border border-gray-200"
                    />
                  ) : (
                    <div className="w-14 h-14 rounded-lg bg-gray-200 flex items-center justify-center">
                      <Package className="w-6 h-6 text-gray-400" />
                    </div>
                  )}
                  <div>
                    <p className="text-sm font-medium text-gray-900">{selected.product.name}</p>
                    <p className="text-xs text-gray-500">
                      {fmt(selected.product.price)} × {selected.quantity}
                      {Number(selected.discount) > 0 && (
                        <span className="ml-1 text-green-600">({selected.discount}% off)</span>
                      )}
                    </p>
                  </div>
                </div>
              </div>

              {/* Details Grid */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-gray-400 uppercase tracking-wide">Interval</p>
                  <p className="text-sm text-gray-900 mt-0.5">
                    {intervalLabel(selected.intervalDays)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 uppercase tracking-wide">Status</p>
                  <span
                    className={`inline-flex items-center text-xs px-2 py-0.5 rounded border font-medium mt-0.5 ${
                      statusStyles[selected.status] || ""
                    }`}
                  >
                    {selected.status}
                  </span>
                </div>
                <div>
                  <p className="text-xs text-gray-400 uppercase tracking-wide">Next Delivery</p>
                  <p className="text-sm text-gray-900 mt-0.5">
                    {formatDate(selected.nextDelivery)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 uppercase tracking-wide">Created</p>
                  <p className="text-sm text-gray-900 mt-0.5">{formatDate(selected.createdAt)}</p>
                </div>
              </div>

              {/* Change Interval */}
              {editInterval && selected.status !== "CANCELLED" && (
                <div className="border border-gray-200 rounded-lg p-4">
                  <p className="text-sm font-medium text-gray-900 mb-2">Change Delivery Interval</p>
                  <div className="flex items-center gap-2">
                    <select
                      value={newInterval}
                      onChange={(e) => setNewInterval(Number(e.target.value))}
                      className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-gray-300"
                    >
                      <option value={7}>Weekly (7 days)</option>
                      <option value={14}>Every 2 weeks</option>
                      <option value={30}>Monthly (30 days)</option>
                      <option value={60}>Every 2 months</option>
                      <option value={90}>Quarterly (90 days)</option>
                    </select>
                    <button
                      onClick={handleChangeInterval}
                      disabled={actionLoading || newInterval === selected.intervalDays}
                      className="inline-flex items-center gap-1 px-3 py-2 text-sm bg-gray-900 text-white rounded-lg hover:bg-gray-800 disabled:opacity-40"
                    >
                      {actionLoading ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <CheckCircle2 className="w-4 h-4" />
                      )}
                      Save
                    </button>
                    <button
                      onClick={() => setEditInterval(false)}
                      className="px-3 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-700"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {/* Cancel Confirmation */}
              {confirmCancel && (
                <div className="border border-red-200 bg-red-50 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertCircle className="w-4 h-4 text-red-500" />
                    <p className="text-sm font-medium text-red-900">Cancel Subscription?</p>
                  </div>
                  <p className="text-sm text-red-700 mb-3">
                    This will permanently cancel the subscription. The customer will not receive
                    any more deliveries.
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => cancelSubscription(selected.id)}
                      disabled={actionLoading}
                      className="inline-flex items-center gap-1 px-3 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
                    >
                      {actionLoading ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <XCircle className="w-4 h-4" />
                      )}
                      Confirm Cancel
                    </button>
                    <button
                      onClick={() => setConfirmCancel(false)}
                      className="px-3 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-700"
                    >
                      Keep Active
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer Actions */}
            {selected.status !== "CANCELLED" && (
              <div className="px-6 py-4 border-t border-gray-100 flex items-center gap-2">
                <button
                  onClick={() => handleTogglePause(selected)}
                  disabled={actionLoading}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-700 disabled:opacity-50"
                >
                  {actionLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : selected.status === "ACTIVE" ? (
                    <Pause className="w-4 h-4" />
                  ) : (
                    <Play className="w-4 h-4" />
                  )}
                  {selected.status === "ACTIVE" ? "Pause" : "Resume"}
                </button>
                <button
                  onClick={() => {
                    setEditInterval(!editInterval);
                    setConfirmCancel(false);
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-700"
                >
                  <Clock className="w-4 h-4" /> Change Interval
                </button>
                <button
                  onClick={() => {
                    setConfirmCancel(!confirmCancel);
                    setEditInterval(false);
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-sm border border-red-200 rounded-lg hover:bg-red-50 text-red-600 ml-auto"
                >
                  <Trash2 className="w-4 h-4" /> Cancel Subscription
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
