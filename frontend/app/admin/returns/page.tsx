"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { apiFetch } from "@/lib/api";
import {
  Search,
  RotateCcw,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  X,
  Package,
  Clock,
  CheckCircle,
  XCircle,
  DollarSign,
  AlertTriangle,
  Loader2,
  Eye,
  ThumbsUp,
  ThumbsDown,
  Banknote,
} from "lucide-react";

interface ReturnItem {
  id: string;
  orderItemId: string;
  quantity: number;
  reason: string;
  condition: string;
}

interface ReturnRequest {
  id: string;
  orderId: string;
  userId: string;
  reason: string;
  description: string;
  status: string;
  adminNotes: string | null;
  refundAmount: number | null;
  refundMethod: string | null;
  returnLabel: string | null;
  trackingNumber: string | null;
  items: ReturnItem[];
  processedAt: string | null;
  createdAt: string;
  updatedAt: string;
  order?: { orderNumber: string; totalAmount?: number };
  user?: { name: string | null; email: string };
}

const STATUS_STYLES: Record<string, string> = {
  PENDING: "bg-yellow-50 text-yellow-700 border-yellow-200",
  APPROVED: "bg-blue-50 text-blue-700 border-blue-200",
  REJECTED: "bg-red-50 text-red-700 border-red-200",
  SHIPPED: "bg-purple-50 text-purple-700 border-purple-200",
  RECEIVED: "bg-indigo-50 text-indigo-700 border-indigo-200",
  REFUNDED: "bg-green-50 text-green-700 border-green-200",
  CLOSED: "bg-gray-50 text-gray-600 border-gray-200",
};

const REASON_LABELS: Record<string, string> = {
  DEFECTIVE: "Defective",
  WRONG_ITEM: "Wrong Item",
  NOT_AS_DESCRIBED: "Not as Described",
  CHANGED_MIND: "Changed Mind",
  ARRIVED_LATE: "Arrived Late",
  OTHER: "Other",
};

const CONDITION_LABELS: Record<string, string> = {
  unopened: "Unopened",
  opened: "Opened",
  damaged: "Damaged",
};

const STATUSES = ["All", "PENDING", "APPROVED", "REJECTED", "SHIPPED", "RECEIVED", "REFUNDED", "CLOSED"];

function fmt(amount: number | null | undefined) {
  return `UGX ${Number(amount || 0).toLocaleString()}`;
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`inline-flex items-center text-xs px-2.5 py-1 rounded-full font-medium border ${STATUS_STYLES[status] || STATUS_STYLES.CLOSED}`}>
      {status}
    </span>
  );
}

const INPUT_CLS =
  "w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10 focus:border-gray-400";

export default function AdminReturnsPage() {
  const [returns, setReturns] = useState<ReturnRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const perPage = 20;
  const searchTimeout = useRef<NodeJS.Timeout | null>(null);

  // Detail modal
  const [selected, setSelected] = useState<ReturnRequest | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Action modal
  const [actionType, setActionType] = useState<"approve" | "reject" | "refund" | null>(null);
  const [actionTarget, setActionTarget] = useState<ReturnRequest | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [refundAmount, setRefundAmount] = useState("");
  const [refundMethod, setRefundMethod] = useState("original_payment");
  const [adminNotes, setAdminNotes] = useState("");

  // Stats
  const [stats, setStats] = useState({ total: 0, pending: 0, approved: 0, refundedAmount: 0 });

  const loadReturns = useCallback(async (p = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (statusFilter !== "All") params.set("status", statusFilter);
      params.set("page", String(p));
      params.set("limit", String(perPage));
      const data = await apiFetch(`/api/returns/admin/all?${params}`);
      const list: ReturnRequest[] = data.returns || data.data || (Array.isArray(data) ? data : []);
      setReturns(list);
      setTotal(data.pagination?.total || data.total || list.length);
      setTotalPages(data.pagination?.totalPages || Math.ceil((data.total || list.length) / perPage) || 1);
      setPage(p);

      // Compute stats from all returns
      let pending = 0, approved = 0, refAmt = 0;
      list.forEach((r) => {
        if (r.status === "PENDING") pending++;
        if (r.status === "APPROVED") approved++;
        if (r.status === "REFUNDED" && r.refundAmount) refAmt += Number(r.refundAmount);
      });
      setStats({ total: data.pagination?.total || list.length, pending, approved, refundedAmount: refAmt });
    } catch (e) {
      console.error("Failed to load returns:", e);
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter]);

  useEffect(() => {
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => loadReturns(1), 300);
    return () => { if (searchTimeout.current) clearTimeout(searchTimeout.current); };
  }, [search, statusFilter, loadReturns]);

  const openDetail = async (ret: ReturnRequest) => {
    setDetailLoading(true);
    setSelected(ret);
    try {
      const data = await apiFetch(`/api/returns/${ret.id}`);
      setSelected(data.return || data);
    } catch {
      // Use existing data
    } finally {
      setDetailLoading(false);
    }
  };

  const openAction = (type: "approve" | "reject" | "refund", ret: ReturnRequest) => {
    setActionType(type);
    setActionTarget(ret);
    setRefundAmount(ret.refundAmount ? String(ret.refundAmount) : "");
    setRefundMethod(ret.refundMethod || "original_payment");
    setAdminNotes(ret.adminNotes || "");
  };

  const closeAction = () => {
    setActionType(null);
    setActionTarget(null);
    setRefundAmount("");
    setRefundMethod("original_payment");
    setAdminNotes("");
  };

  const submitAction = async () => {
    if (!actionTarget || !actionType) return;
    setActionLoading(true);
    try {
      const payload: Record<string, unknown> = {};
      if (actionType === "approve") {
        payload.status = "APPROVED";
        if (refundAmount) payload.refundAmount = parseFloat(refundAmount);
        if (refundMethod) payload.refundMethod = refundMethod;
        if (adminNotes) payload.adminNotes = adminNotes;
      } else if (actionType === "reject") {
        payload.status = "REJECTED";
        if (adminNotes) payload.adminNotes = adminNotes;
      } else if (actionType === "refund") {
        payload.status = "REFUNDED";
        if (refundAmount) payload.refundAmount = parseFloat(refundAmount);
        if (refundMethod) payload.refundMethod = refundMethod;
        if (adminNotes) payload.adminNotes = adminNotes;
      }
      await apiFetch(`/api/returns/${actionTarget.id}/status`, {
        method: "PUT",
        body: JSON.stringify(payload),
      });
      closeAction();
      setSelected(null);
      loadReturns(page);
    } catch (e) {
      console.error("Action failed:", e);
    } finally {
      setActionLoading(false);
    }
  };

  const deleteReturn = async (id: string) => {
    if (!confirm("Delete this return request?")) return;
    try {
      await apiFetch(`/api/returns/${id}`, { method: "DELETE" });
      setSelected(null);
      loadReturns(page);
    } catch (e) {
      console.error("Delete failed:", e);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Returns</h1>
          <p className="text-sm text-gray-500 mt-0.5">{total} total return requests</p>
        </div>
        <button
          onClick={() => loadReturns(page)}
          className="inline-flex items-center gap-1.5 px-3 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-700"
        >
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total Returns", value: stats.total, icon: RotateCcw },
          { label: "Pending", value: stats.pending, icon: Clock },
          { label: "Approved", value: stats.approved, icon: CheckCircle },
          { label: "Refunded", value: fmt(stats.refundedAmount), icon: DollarSign },
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
            placeholder="Search by order number or customer email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex border border-gray-200 rounded-lg overflow-hidden text-sm">
          {STATUSES.map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-2 capitalize transition-colors whitespace-nowrap ${
                statusFilter === s ? "bg-gray-900 text-white" : "bg-white text-gray-600 hover:bg-gray-50"
              }`}
            >
              {s === "All" ? "All" : s.charAt(0) + s.slice(1).toLowerCase()}
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
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">ID</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Order #</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Customer</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Reason</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Amount</th>
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
              ) : returns.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center">
                    <RotateCcw className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                    <p className="text-sm text-gray-500">No return requests found</p>
                    <p className="text-xs text-gray-400 mt-1">Return requests will appear here</p>
                  </td>
                </tr>
              ) : (
                returns.map((r) => (
                  <tr
                    key={r.id}
                    className="hover:bg-gray-50/50 transition-colors cursor-pointer"
                    onClick={() => openDetail(r)}
                  >
                    <td className="px-4 py-3 text-sm text-gray-500 font-mono">{r.id.slice(0, 8)}…</td>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{r.order?.orderNumber || "—"}</td>
                    <td className="px-4 py-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{r.user?.name || "—"}</p>
                        <p className="text-xs text-gray-500 truncate">{r.user?.email || "—"}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">{REASON_LABELS[r.reason] || r.reason}</td>
                    <td className="px-4 py-3"><StatusBadge status={r.status} /></td>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{r.refundAmount ? fmt(r.refundAmount) : "—"}</td>
                    <td className="px-4 py-3 text-sm text-gray-500">{fmtDate(r.createdAt)}</td>
                    <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => openDetail(r)}
                          className="p-1.5 rounded hover:bg-gray-100 text-gray-500 hover:text-gray-700"
                          title="View details"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        {r.status === "PENDING" && (
                          <>
                            <button
                              onClick={() => openAction("approve", r)}
                              className="p-1.5 rounded hover:bg-green-50 text-green-600 hover:text-green-700"
                              title="Approve"
                            >
                              <ThumbsUp className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => openAction("reject", r)}
                              className="p-1.5 rounded hover:bg-red-50 text-red-600 hover:text-red-700"
                              title="Reject"
                            >
                              <ThumbsDown className="w-4 h-4" />
                            </button>
                          </>
                        )}
                        {r.status === "APPROVED" && (
                          <button
                            onClick={() => openAction("refund", r)}
                            className="p-1.5 rounded hover:bg-green-50 text-green-600 hover:text-green-700"
                            title="Mark Refunded"
                          >
                            <Banknote className="w-4 h-4" />
                          </button>
                        )}
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
                onClick={() => loadReturns(page - 1)}
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
                    onClick={() => loadReturns(p)}
                    className={`w-8 h-8 text-xs rounded border transition-colors ${
                      page === p ? "bg-gray-900 text-white border-gray-900" : "border-gray-200 hover:bg-gray-50 text-gray-600"
                    }`}
                  >
                    {p}
                  </button>
                );
              })}
              <button
                onClick={() => loadReturns(page + 1)}
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
            className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto m-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Return Request</h2>
                <p className="text-xs text-gray-500 font-mono mt-0.5">{selected.id}</p>
              </div>
              <button onClick={() => setSelected(null)} className="p-1.5 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="px-6 py-4 space-y-5">
              {detailLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                </div>
              ) : (
                <>
                  {/* Status & Info */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Status</p>
                      <StatusBadge status={selected.status} />
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Order</p>
                      <p className="text-sm font-medium text-gray-900">{selected.order?.orderNumber || "—"}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Customer</p>
                      <p className="text-sm font-medium text-gray-900">{selected.user?.name || "—"}</p>
                      <p className="text-xs text-gray-500">{selected.user?.email || "—"}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Submitted</p>
                      <p className="text-sm text-gray-900">{fmtDate(selected.createdAt)}</p>
                    </div>
                  </div>

                  {/* Reason */}
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Reason</p>
                    <p className="text-sm font-medium text-gray-900">{REASON_LABELS[selected.reason] || selected.reason}</p>
                    {selected.description && (
                      <p className="text-sm text-gray-600 mt-1">{selected.description}</p>
                    )}
                  </div>

                  {/* Refund Info */}
                  {(selected.refundAmount || selected.refundMethod) && (
                    <div className="bg-gray-50 rounded-lg p-4">
                      <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">Refund Details</p>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <p className="text-xs text-gray-500">Amount</p>
                          <p className="text-sm font-semibold text-gray-900">{fmt(selected.refundAmount)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Method</p>
                          <p className="text-sm text-gray-900 capitalize">{selected.refundMethod?.replace(/_/g, " ") || "—"}</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Tracking */}
                  {selected.trackingNumber && (
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Tracking Number</p>
                      <p className="text-sm font-mono text-gray-900">{selected.trackingNumber}</p>
                    </div>
                  )}

                  {/* Return Items */}
                  {selected.items && selected.items.length > 0 && (
                    <div>
                      <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">Return Items</p>
                      <div className="space-y-2">
                        {selected.items.map((item) => (
                          <div key={item.id} className="flex items-center justify-between bg-gray-50 rounded-lg px-4 py-3">
                            <div>
                              <p className="text-sm text-gray-900">Item #{item.orderItemId.slice(0, 8)}</p>
                              <p className="text-xs text-gray-500">
                                Qty: {item.quantity} · Condition: {CONDITION_LABELS[item.condition] || item.condition}
                              </p>
                            </div>
                            <span className="text-xs text-gray-500">{REASON_LABELS[item.reason] || item.reason}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Admin Notes */}
                  {selected.adminNotes && (
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Admin Notes</p>
                      <p className="text-sm text-gray-600 bg-gray-50 rounded-lg p-3">{selected.adminNotes}</p>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex items-center gap-2 pt-2 border-t border-gray-100">
                    {selected.status === "PENDING" && (
                      <>
                        <button
                          onClick={() => { setSelected(null); openAction("approve", selected); }}
                          className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-gray-900 text-white rounded-lg hover:bg-gray-800"
                        >
                          <ThumbsUp className="w-4 h-4" /> Approve
                        </button>
                        <button
                          onClick={() => { setSelected(null); openAction("reject", selected); }}
                          className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium border border-red-200 text-red-700 rounded-lg hover:bg-red-50"
                        >
                          <ThumbsDown className="w-4 h-4" /> Reject
                        </button>
                      </>
                    )}
                    {selected.status === "APPROVED" && (
                      <button
                        onClick={() => { setSelected(null); openAction("refund", selected); }}
                        className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-green-600 text-white rounded-lg hover:bg-green-700"
                      >
                        <Banknote className="w-4 h-4" /> Mark Refunded
                      </button>
                    )}
                    <button
                      onClick={() => deleteReturn(selected.id)}
                      className="inline-flex items-center gap-1.5 px-4 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg ml-auto"
                    >
                      <XCircle className="w-4 h-4" /> Delete
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Action Modal */}
      {actionType && actionTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={closeAction}>
          <div
            className="bg-white rounded-xl shadow-xl w-full max-w-md m-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-lg font-semibold text-gray-900 capitalize">
                {actionType === "approve" ? "Approve Return" : actionType === "reject" ? "Reject Return" : "Mark as Refunded"}
              </h2>
              <button onClick={closeAction} className="p-1.5 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="px-6 py-4 space-y-4">
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-sm text-gray-900 font-medium">Order: {actionTarget.order?.orderNumber || actionTarget.orderId.slice(0, 8)}</p>
                <p className="text-xs text-gray-500">{actionTarget.user?.email || "—"}</p>
              </div>

              {(actionType === "approve" || actionType === "refund") && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Refund Amount (UGX)</label>
                    <input
                      type="number"
                      className={INPUT_CLS}
                      value={refundAmount}
                      onChange={(e) => setRefundAmount(e.target.value)}
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Refund Method</label>
                    <select
                      className={INPUT_CLS}
                      value={refundMethod}
                      onChange={(e) => setRefundMethod(e.target.value)}
                    >
                      <option value="original_payment">Original Payment</option>
                      <option value="store_credit">Store Credit</option>
                      <option value="bank_transfer">Bank Transfer</option>
                    </select>
                  </div>
                </>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Admin Notes</label>
                <textarea
                  className={INPUT_CLS}
                  rows={3}
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  placeholder={actionType === "reject" ? "Reason for rejection..." : "Optional notes..."}
                />
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-gray-100">
              <button
                onClick={closeAction}
                className="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-700"
              >
                Cancel
              </button>
              <button
                onClick={submitAction}
                disabled={actionLoading}
                className={`inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg text-white disabled:opacity-50 ${
                  actionType === "reject" ? "bg-red-600 hover:bg-red-700" : "bg-gray-900 hover:bg-gray-800"
                }`}
              >
                {actionLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                {actionType === "approve" ? "Approve" : actionType === "reject" ? "Reject" : "Confirm Refund"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
