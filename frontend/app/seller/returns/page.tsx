"use client";

import { useEffect, useState, useCallback } from "react";
import { apiFetch } from "@/lib/api";
import { RotateCcw, AlertTriangle, ChevronDown, ChevronUp, Send, CheckCircle2, XCircle, X } from "lucide-react";
import { useToast } from "@/lib/hooks/useToast";

interface ReturnItem {
  id: string;
  orderItemId: string;
  quantity: number;
  reason: string | null;
  condition: string | null;
}

interface ReturnRequest {
  id: string;
  orderId: string;
  reason: string;
  description: string | null;
  status: string;
  sellerNotes: string | null;
  adminNotes: string | null;
  refundAmount: number | null;
  createdAt: string;
  order: { id: string; orderNumber: string; customerName: string };
  items: ReturnItem[];
}

const statusColors: Record<string, string> = {
  PENDING: "bg-yellow-100 text-yellow-700",
  APPROVED: "bg-green-100 text-green-700",
  REJECTED: "bg-red-100 text-red-700",
  COMPLETED: "bg-blue-100 text-blue-700",
};

const statusTabs = ["ALL", "PENDING", "APPROVED", "REJECTED", "COMPLETED"];

export default function SellerReturnsPage() {
  const [returns, setReturns] = useState<ReturnRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState("ALL");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [notesInput, setNotesInput] = useState<Record<string, string>>({});
  const [savingNotes, setSavingNotes] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [rejectModal, setRejectModal] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const { showToast } = useToast();

  const fetchReturns = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({ page: page.toString(), limit: "20" });
      if (activeTab !== "ALL") params.set("status", activeTab);
      const data = await apiFetch(`/api/seller/returns?${params}`);
      setReturns(data.returns);
      setTotalPages(data.pagination.pages);
    } catch (err: any) {
      setError(err.message || "Failed to load returns");
    } finally {
      setLoading(false);
    }
  }, [page, activeTab]);

  useEffect(() => {
    fetchReturns();
  }, [fetchReturns]);

  const handleSaveNotes = async (returnId: string) => {
    try {
      setSavingNotes(returnId);
      await apiFetch(`/api/seller/returns/${returnId}`, {
        method: "PUT",
        body: JSON.stringify({ sellerNotes: notesInput[returnId] || "" }),
      });
      showToast("Notes saved", "success");
      await fetchReturns();
    } catch (err: any) {
      showToast(err.message || "Failed to save notes", "error");
    } finally {
      setSavingNotes(null);
    }
  };

  const handleApprove = async (returnId: string) => {
    try {
      setActionLoading(returnId);
      await apiFetch(`/api/seller/returns/${returnId}`, {
        method: "PUT",
        body: JSON.stringify({ status: "APPROVED" }),
      });
      showToast("Return approved", "success");
      await fetchReturns();
    } catch (err: any) {
      showToast(err.message || "Failed to approve return", "error");
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (returnId: string) => {
    try {
      setActionLoading(returnId);
      await apiFetch(`/api/seller/returns/${returnId}`, {
        method: "PUT",
        body: JSON.stringify({ status: "REJECTED", rejectionReason: rejectionReason.trim() }),
      });
      showToast("Return rejected", "success");
      setRejectModal(null);
      setRejectionReason("");
      await fetchReturns();
    } catch (err: any) {
      showToast(err.message || "Failed to reject return", "error");
    } finally {
      setActionLoading(null);
    }
  };

  if (loading && returns.length === 0) {
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
          <button onClick={fetchReturns} className="mt-4 px-4 py-2 bg-primary text-white rounded-lg text-sm">Retry</button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Returns</h1>
      </div>

      {/* Status Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {statusTabs.map((tab) => (
          <button
            key={tab}
            onClick={() => { setActiveTab(tab); setPage(1); }}
            className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
              activeTab === tab
                ? "bg-primary text-white"
                : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Returns Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left text-xs font-medium text-gray-500 uppercase px-6 py-3">Order</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase px-6 py-3">Customer</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase px-6 py-3">Reason</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase px-6 py-3">Status</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase px-6 py-3">Date</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase px-6 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {returns.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-gray-400">
                    <RotateCcw className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    No return requests found
                  </td>
                </tr>
              ) : (
                returns.map((ret) => (
                  <>
                    <tr key={ret.id} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="px-6 py-4 text-sm font-medium text-gray-900">{ret.order.orderNumber}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">{ret.order.customerName || "Customer"}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">{ret.reason.replace(/_/g, " ")}</td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${statusColors[ret.status] || "bg-gray-100 text-gray-700"}`}>
                          {ret.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">{new Date(ret.createdAt).toLocaleDateString()}</td>
                      <td className="px-6 py-4">
                        <button
                          onClick={() => setExpandedId(expandedId === ret.id ? null : ret.id)}
                          className="text-primary hover:text-primary/80 text-sm font-medium flex items-center gap-1"
                        >
                          Details
                          {expandedId === ret.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </button>
                      </td>
                    </tr>
                    {expandedId === ret.id && (
                      <tr key={`${ret.id}-details`} className="bg-gray-50">
                        <td colSpan={6} className="px-6 py-4">
                          <div className="space-y-4">
                            {ret.description && (
                              <div>
                                <p className="text-xs font-medium text-gray-500 mb-1">Customer Description</p>
                                <p className="text-sm text-gray-700">{ret.description}</p>
                              </div>
                            )}
                            {ret.items.length > 0 && (
                              <div>
                                <p className="text-xs font-medium text-gray-500 mb-1">Items ({ret.items.length})</p>
                                <div className="space-y-1">
                                  {ret.items.map((item) => (
                                    <div key={item.id} className="text-sm text-gray-700">
                                      Qty: {item.quantity} {item.condition && `- ${item.condition}`} {item.reason && `- ${item.reason}`}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                            {/* Status Timeline */}
                            <div className="flex items-center gap-2">
                              <div className={`w-2 h-2 rounded-full ${ret.status === "PENDING" ? "bg-yellow-400" : ret.status === "APPROVED" ? "bg-green-400" : ret.status === "REJECTED" ? "bg-red-400" : "bg-blue-400"}`} />
                              <span className="text-xs text-gray-500">
                                {ret.status === "PENDING" ? "Awaiting your review" : ret.status === "APPROVED" ? "You approved this return" : ret.status === "REJECTED" ? "You rejected this return" : "Completed"}
                              </span>
                            </div>

                            {/* Approve/Reject Buttons for PENDING */}
                            {ret.status === "PENDING" && (
                              <div className="flex gap-2">
                                <button
                                  onClick={() => handleApprove(ret.id)}
                                  disabled={actionLoading === ret.id}
                                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-green-50 text-green-700 rounded-lg text-sm font-medium hover:bg-green-100 disabled:opacity-50"
                                >
                                  <CheckCircle2 className="w-4 h-4" /> Approve
                                </button>
                                <button
                                  onClick={() => { setRejectModal(ret.id); setRejectionReason(""); }}
                                  disabled={actionLoading === ret.id}
                                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-red-50 text-red-700 rounded-lg text-sm font-medium hover:bg-red-100 disabled:opacity-50"
                                >
                                  <XCircle className="w-4 h-4" /> Reject
                                </button>
                              </div>
                            )}

                            {ret.adminNotes && (
                              <div>
                                <p className="text-xs font-medium text-gray-500 mb-1">Admin Notes</p>
                                <p className="text-sm text-gray-700">{ret.adminNotes}</p>
                              </div>
                            )}
                            <div>
                              <p className="text-xs font-medium text-gray-500 mb-1">Your Notes</p>
                              <div className="flex gap-2">
                                <input
                                  type="text"
                                  value={notesInput[ret.id] ?? ret.sellerNotes ?? ""}
                                  onChange={(e) => setNotesInput({ ...notesInput, [ret.id]: e.target.value })}
                                  placeholder="Add your notes about this return..."
                                  className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                                />
                                <button
                                  onClick={() => handleSaveNotes(ret.id)}
                                  disabled={savingNotes === ret.id}
                                  className="px-4 py-2 bg-primary text-white rounded-lg text-sm hover:bg-primary/90 disabled:opacity-50 flex items-center gap-1"
                                >
                                  <Send className="w-3 h-3" />
                                  {savingNotes === ret.id ? "Saving..." : "Save"}
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

      {/* Reject Confirmation Modal */}
      {rejectModal && (
        <div className="fixed inset-0 bg-black/50 z-[400] flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm">
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <h3 className="text-lg font-semibold text-gray-900">Reject Return</h3>
              <button onClick={() => setRejectModal(null)} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Reason for rejection</label>
                <textarea
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none"
                  placeholder="Explain why you're rejecting this return..."
                />
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-100">
              <button onClick={() => setRejectModal(null)} className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg">Cancel</button>
              <button
                onClick={() => handleReject(rejectModal)}
                disabled={actionLoading === rejectModal}
                className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50"
              >
                {actionLoading === rejectModal ? "Rejecting..." : "Reject Return"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
