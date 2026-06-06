"use client";

import { useState, useEffect } from "react";
import { apiFetch } from "@/lib/api";
import {
  Shield, AlertTriangle, Clock, CheckCircle, MessageSquare,
  Search, Filter, ChevronLeft, ChevronRight, Eye, X,
  User, Store, Package, Calendar, FileText, Send,
  Loader2, XCircle, AlertCircle, Scale, Download,
  RefreshCw, Image as ImageIcon,
} from "lucide-react";

interface Dispute {
  id: string;
  disputeNumber: string;
  category: string;
  reason: string;
  status: string;
  priority: string;
  resolution?: string;
  resolutionNote?: string;
  refundAmount?: number;
  sellerResponse?: string;
  sellerRespondedAt?: string;
  sellerDeadline?: string;
  assignedTo?: string;
  resolvedAt?: string;
  createdAt: string;
  order: { orderNumber: string; totalAmount: number; currency: string };
  buyer: { name: string; email: string };
  seller: { storeName: string; logo?: string };
  _count: { evidence: number; messages: number };
}

interface DisputeDetail extends Dispute {
  order: {
    id: string;
    orderNumber: string;
    totalAmount: number;
    currency: string;
    status: string;
    items: Array<{
      name: string;
      quantity: number;
      price: number;
      product: { name: string; slug: string; images: Array<{ url: string }> };
    }>;
    payments: Array<{ id: string; method: string; status: string; amount: number; flwRef?: string }>;
    escrow?: { id: string; status: string; amount: number; releaseDate: string };
  };
  buyer: { id: string; name: string; email: string; phone?: string; createdAt: string };
  seller: { id: string; storeName: string; logo?: string; rating: number; reviewCount: number; trustScore: number; tier: string };
  evidence: Array<{ id: string; uploadedBy: string; type: string; fileUrl: string; fileName: string; createdAt: string }>;
  messages: Array<{ id: string; senderId: string; senderType: string; senderName: string; message: string; isInternal: boolean; createdAt: string }>;
}

interface Stats {
  open: number;
  underReview: number;
  sellerResponse: number;
  resolved: number;
  total: number;
}

const statusConfig: Record<string, { color: string; bg: string; label: string }> = {
  OPEN: { color: "text-yellow-700", bg: "bg-yellow-100", label: "Open" },
  SELLER_RESPONSE: { color: "text-blue-700", bg: "bg-blue-100", label: "Seller Responded" },
  UNDER_REVIEW: { color: "text-purple-700", bg: "bg-purple-100", label: "Under Review" },
  EVIDENCE_REQUESTED: { color: "text-orange-700", bg: "bg-orange-100", label: "Evidence Needed" },
  RESOLVED: { color: "text-green-700", bg: "bg-green-100", label: "Resolved" },
  CLOSED: { color: "text-gray-700", bg: "bg-gray-100", label: "Closed" },
  ESCALATED: { color: "text-red-700", bg: "bg-red-100", label: "Escalated" },
};

const priorityConfig: Record<string, { color: string; label: string }> = {
  LOW: { color: "text-gray-600", label: "Low" },
  MEDIUM: { color: "text-yellow-600", label: "Medium" },
  HIGH: { color: "text-orange-600", label: "High" },
  URGENT: { color: "text-red-600", label: "Urgent" },
};

const categoryLabels: Record<string, string> = {
  NOT_RECEIVED: "Item Not Received",
  DAMAGED: "Damaged",
  NOT_AS_DESCRIBED: "Not As Described",
  WRONG_ITEM: "Wrong Item",
  MISSING_ITEMS: "Missing Items",
  DEFECTIVE: "Defective",
  COUNTERFEIT: "Counterfeit",
  QUALITY_ISSUE: "Quality Issue",
  OTHER: "Other",
};

const resolutionOptions = [
  { value: "BUYER_FULL_REFUND", label: "Full Refund to Buyer" },
  { value: "BUYER_PARTIAL_REFUND", label: "Partial Refund to Buyer" },
  { value: "BUYER_REPLACEMENT", label: "Seller Sends Replacement" },
  { value: "SELLER_WINS", label: "Seller Wins (No Refund)" },
  { value: "MUTUAL_AGREEMENT", label: "Mutual Agreement" },
  { value: "CANCELLED", label: "Dispute Withdrawn" },
];

function formatCurrency(amount: number) {
  return `UGX ${Number(amount).toLocaleString()}`;
}

export default function AdminDisputesPage() {
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [stats, setStats] = useState<Stats>({ open: 0, underReview: 0, sellerResponse: 0, resolved: 0, total: 0 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [selectedDispute, setSelectedDispute] = useState<DisputeDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Resolution form
  const [resolution, setResolution] = useState("");
  const [resolutionNote, setResolutionNote] = useState("");
  const [refundAmount, setRefundAmount] = useState("");
  const [newMessage, setNewMessage] = useState("");
  const [resolving, setResolving] = useState(false);
  const [sending, setSending] = useState(false);

  useEffect(() => { loadDisputes(); }, [search, statusFilter, page]);

  const loadDisputes = async () => {
    try {
      const params = new URLSearchParams({ page: page.toString(), limit: "20" });
      if (search) params.set("search", search);
      if (statusFilter !== "all") params.set("status", statusFilter);

      const data = await apiFetch(`/api/admin/disputes?${params}`);
      setDisputes(data.disputes);
      setStats(data.stats);
      setTotalPages(data.totalPages);
    } catch {
      setDisputes([]);
    } finally {
      setLoading(false);
    }
  };

  const openDetail = async (id: string) => {
    setLoadingDetail(true);
    try {
      const data = await apiFetch(`/api/admin/disputes/${id}`);
      setSelectedDispute(data);
      setResolution("");
      setResolutionNote("");
      setRefundAmount(data.order?.totalAmount?.toString() || "");
      setNewMessage("");
    } catch {
      // handle error
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleResolve = async () => {
    if (!selectedDispute || !resolution) return;
    setResolving(true);
    try {
      await apiFetch(`/api/admin/disputes/${selectedDispute.id}`, {
        method: "PUT",
        body: JSON.stringify({
          resolution,
          resolutionNote,
          refundAmount: ["BUYER_FULL_REFUND", "BUYER_PARTIAL_REFUND"].includes(resolution) ? refundAmount : undefined,
          status: "RESOLVED",
        }),
      });
      setSelectedDispute(null);
      loadDisputes();
    } catch {
      // handle error
    } finally {
      setResolving(false);
    }
  };

  const handleSendMessage = async () => {
    if (!selectedDispute || !newMessage.trim()) return;
    setSending(true);
    try {
      await apiFetch(`/api/admin/disputes/${selectedDispute.id}/messages`, {
        method: "POST",
        body: JSON.stringify({ message: newMessage }),
      });
      setNewMessage("");
      openDetail(selectedDispute.id); // Refresh
    } catch {
      // handle error
    } finally {
      setSending(false);
    }
  };

  const handleStatusChange = async (id: string, status: string) => {
    try {
      await apiFetch(`/api/admin/disputes/${id}`, {
        method: "PUT",
        body: JSON.stringify({ status }),
      });
      loadDisputes();
      if (selectedDispute?.id === id) openDetail(id);
    } catch { /* */ }
  };

  const statCards = [
    { label: "Open", value: stats.open, icon: Clock, color: "text-yellow-600", bg: "bg-yellow-50" },
    { label: "Awaiting Review", value: stats.sellerResponse, icon: MessageSquare, color: "text-blue-600", bg: "bg-blue-50" },
    { label: "Under Review", value: stats.underReview, icon: Eye, color: "text-purple-600", bg: "bg-purple-50" },
    { label: "Resolved", value: stats.resolved, icon: CheckCircle, color: "text-green-600", bg: "bg-green-50" },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Scale className="w-6 h-6 text-blue-600" />
            Dispute Resolution Center
          </h1>
          <p className="text-gray-500 mt-1">{stats.total} total disputes</p>
        </div>
        <button onClick={loadDisputes} className="p-2 rounded-lg hover:bg-gray-100">
          <RefreshCw className="w-5 h-5" />
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {statCards.map((s) => (
          <div key={s.label} className={`${s.bg} rounded-xl p-4 border`}>
            <div className="flex items-center gap-2 mb-2">
              <s.icon className={`w-5 h-5 ${s.color}`} />
              <span className="text-sm text-gray-600">{s.label}</span>
            </div>
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Search & Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search by dispute #, order #, buyer or seller..."
            className="w-full pl-10 pr-4 py-2.5 border rounded-lg"
          />
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {["all", "OPEN", "SELLER_RESPONSE", "UNDER_REVIEW", "RESOLVED", "ESCALATED"].map((s) => (
            <button
              key={s}
              onClick={() => { setStatusFilter(s); setPage(1); }}
              className={`px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap ${
                statusFilter === s ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {s === "all" ? "All" : (statusConfig[s]?.label || s)}
            </button>
          ))}
        </div>
      </div>

      {/* Disputes Table */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
        </div>
      ) : disputes.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border">
          <Shield className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium">No disputes found</h3>
          <p className="text-gray-500 mt-1">
            {search || statusFilter !== "all" ? "Try adjusting your filters" : "No disputes have been filed yet"}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b">
                  <th className="text-left px-4 py-3 font-medium">Dispute</th>
                  <th className="text-left px-4 py-3 font-medium">Category</th>
                  <th className="text-left px-4 py-3 font-medium">Buyer</th>
                  <th className="text-left px-4 py-3 font-medium">Seller</th>
                  <th className="text-left px-4 py-3 font-medium">Amount</th>
                  <th className="text-left px-4 py-3 font-medium">Status</th>
                  <th className="text-left px-4 py-3 font-medium">Priority</th>
                  <th className="text-left px-4 py-3 font-medium">Date</th>
                  <th className="text-left px-4 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {disputes.map((d) => {
                  const sc = statusConfig[d.status] || statusConfig.OPEN;
                  const pc = priorityConfig[d.priority] || priorityConfig.MEDIUM;
                  return (
                    <tr key={d.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <span className="font-mono text-xs text-gray-500">{d.disputeNumber}</span>
                        <br />
                        <span className="text-xs text-gray-400">Order #{d.order.orderNumber}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs">{categoryLabels[d.category] || d.category}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs">{d.buyer.name || d.buyer.email}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs">{d.seller.storeName}</span>
                      </td>
                      <td className="px-4 py-3 font-medium">
                        {formatCurrency(d.order.totalAmount)}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-1 rounded-full font-medium ${sc.bg} ${sc.color}`}>
                          {sc.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-medium ${pc.color}`}>{pc.label}</span>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500">
                        {new Date(d.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => openDetail(d.id)}
                          className="text-blue-600 hover:text-blue-800 text-xs font-medium"
                        >
                          Review
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="flex items-center gap-1 text-sm text-gray-600 disabled:opacity-50"
              >
                <ChevronLeft className="w-4 h-4" /> Previous
              </button>
              <span className="text-sm text-gray-500">Page {page} of {totalPages}</span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="flex items-center gap-1 text-sm text-gray-600 disabled:opacity-50"
              >
                Next <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      )}

      {/* Detail Modal */}
      {(selectedDispute || loadingDetail) && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-8 px-4">
          <div className="fixed inset-0 bg-black/40" onClick={() => !loadingDetail && setSelectedDispute(null)} />
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-4xl max-h-[85vh] overflow-y-auto">
            {loadingDetail ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
              </div>
            ) : selectedDispute && (
              <>
                {/* Modal Header */}
                <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between z-10">
                  <div>
                    <h2 className="text-lg font-bold flex items-center gap-2">
                      Dispute {selectedDispute.disputeNumber}
                      <span className={`text-xs px-2 py-0.5 rounded-full ${statusConfig[selectedDispute.status]?.bg} ${statusConfig[selectedDispute.status]?.color}`}>
                        {statusConfig[selectedDispute.status]?.label}
                      </span>
                    </h2>
                    <p className="text-sm text-gray-500">
                      Order #{selectedDispute.order.orderNumber} &middot; {categoryLabels[selectedDispute.category]}
                    </p>
                  </div>
                  <button onClick={() => setSelectedDispute(null)} className="p-2 hover:bg-gray-100 rounded-lg">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="px-6 py-4 space-y-6">
                  {/* Parties */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-4 bg-gray-50 rounded-xl">
                      <h4 className="text-xs text-gray-500 uppercase font-medium mb-2 flex items-center gap-1">
                        <User className="w-3 h-3" /> Buyer
                      </h4>
                      <p className="font-medium">{selectedDispute.buyer.name || "N/A"}</p>
                      <p className="text-sm text-gray-500">{selectedDispute.buyer.email}</p>
                      {selectedDispute.buyer.phone && (
                        <p className="text-sm text-gray-500">{selectedDispute.buyer.phone}</p>
                      )}
                    </div>
                    <div className="p-4 bg-gray-50 rounded-xl">
                      <h4 className="text-xs text-gray-500 uppercase font-medium mb-2 flex items-center gap-1">
                        <Store className="w-3 h-3" /> Seller
                      </h4>
                      <p className="font-medium">{selectedDispute.seller.storeName}</p>
                      <div className="flex items-center gap-2 text-sm text-gray-500 mt-1">
                        <span>Rating: {Number(selectedDispute.seller.rating || 0).toFixed(1)}</span>
                        <span>&middot;</span>
                        <span>Trust: {selectedDispute.seller.trustScore}/100</span>
                        <span>&middot;</span>
                        <span>{selectedDispute.seller.tier}</span>
                      </div>
                    </div>
                  </div>

                  {/* Dispute Details */}
                  <div className="p-4 bg-orange-50 border border-orange-200 rounded-xl">
                    <h4 className="font-medium mb-2">Buyer&apos;s Complaint</h4>
                    <p className="text-sm text-gray-700">{selectedDispute.reason}</p>
                  </div>

                  {/* Order Items */}
                  <div>
                    <h4 className="font-medium mb-2 flex items-center gap-1">
                      <Package className="w-4 h-4" /> Order Items ({formatCurrency(selectedDispute.order.totalAmount)})
                    </h4>
                    <div className="space-y-2">
                      {selectedDispute.order.items?.map((item, i) => (
                        <div key={i} className="flex items-center gap-3 p-2 bg-gray-50 rounded-lg">
                          <div className="w-10 h-10 bg-gray-200 rounded overflow-hidden flex-shrink-0">
                            {item.product.images?.[0]?.url && (
                              <img src={item.product.images[0].url} alt="" className="w-full h-full object-cover" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{item.product.name}</p>
                            <p className="text-xs text-gray-500">Qty: {item.quantity} &middot; {formatCurrency(item.price)}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Escrow Status */}
                  {selectedDispute.order.escrow && (
                    <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl">
                      <h4 className="font-medium text-blue-900 flex items-center gap-2">
                        <Shield className="w-4 h-4" /> Escrow Status
                      </h4>
                      <div className="flex items-center gap-4 mt-2 text-sm">
                        <span className="font-semibold">{formatCurrency(selectedDispute.order.escrow.amount)}</span>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                          selectedDispute.order.escrow.status === "HELD" ? "bg-blue-100 text-blue-700" :
                          selectedDispute.order.escrow.status === "DISPUTED" ? "bg-orange-100 text-orange-700" :
                          "bg-gray-100 text-gray-700"
                        }`}>
                          {selectedDispute.order.escrow.status}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Seller Response */}
                  {selectedDispute.sellerResponse && (
                    <div className="p-4 bg-gray-50 border rounded-xl">
                      <h4 className="font-medium mb-2">Seller&apos;s Response</h4>
                      <p className="text-sm text-gray-700">{selectedDispute.sellerResponse}</p>
                      {selectedDispute.sellerRespondedAt && (
                        <p className="text-xs text-gray-400 mt-2">
                          Responded {new Date(selectedDispute.sellerRespondedAt).toLocaleString()}
                        </p>
                      )}
                    </div>
                  )}

                  {/* Evidence */}
                  {selectedDispute.evidence.length > 0 && (
                    <div>
                      <h4 className="font-medium mb-2 flex items-center gap-1">
                        <ImageIcon className="w-4 h-4" /> Evidence ({selectedDispute.evidence.length})
                      </h4>
                      <div className="flex flex-wrap gap-3">
                        {selectedDispute.evidence.map((e) => (
                          <a
                            key={e.id}
                            href={e.fileUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block w-24 h-24 rounded-lg border overflow-hidden hover:ring-2 hover:ring-blue-500"
                          >
                            {e.type === "photo" ? (
                              <img src={e.fileUrl} alt={e.fileName} className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full bg-gray-100 flex flex-col items-center justify-center">
                                <FileText className="w-6 h-6 text-gray-400" />
                                <span className="text-xs text-gray-500 mt-1 truncate px-1">{e.fileName}</span>
                              </div>
                            )}
                          </a>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Messages */}
                  {selectedDispute.messages.length > 0 && (
                    <div>
                      <h4 className="font-medium mb-2 flex items-center gap-1">
                        <MessageSquare className="w-4 h-4" /> Messages ({selectedDispute.messages.length})
                      </h4>
                      <div className="space-y-2 max-h-60 overflow-y-auto">
                        {selectedDispute.messages.map((m) => (
                          <div
                            key={m.id}
                            className={`p-3 rounded-lg text-sm ${
                              m.senderType === "ADMIN" ? "bg-purple-50 border-l-4 border-purple-400" :
                              m.senderType === "BUYER" ? "bg-blue-50 border-l-4 border-blue-400" :
                              "bg-gray-50 border-l-4 border-gray-400"
                            }`}
                          >
                            <div className="flex items-center justify-between mb-1">
                              <span className="font-medium text-xs">
                                {m.senderName} ({m.senderType})
                              </span>
                              <span className="text-xs text-gray-400">
                                {new Date(m.createdAt).toLocaleString()}
                              </span>
                            </div>
                            <p className="text-gray-700">{m.message}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Admin Message */}
                  {selectedDispute.status !== "RESOLVED" && selectedDispute.status !== "CLOSED" && (
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        placeholder="Send a message to buyer/seller..."
                        className="flex-1 px-4 py-2 border rounded-lg text-sm"
                        onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
                      />
                      <button
                        onClick={handleSendMessage}
                        disabled={!newMessage.trim() || sending}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                      >
                        {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                      </button>
                    </div>
                  )}

                  {/* Quick Actions */}
                  {!["RESOLVED", "CLOSED"].includes(selectedDispute.status) && (
                    <div className="flex flex-wrap gap-2">
                      {selectedDispute.status !== "UNDER_REVIEW" && (
                        <button
                          onClick={() => handleStatusChange(selectedDispute.id, "UNDER_REVIEW")}
                          className="px-3 py-1.5 text-xs bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200"
                        >
                          Take Over Review
                        </button>
                      )}
                      {selectedDispute.status !== "EVIDENCE_REQUESTED" && (
                        <button
                          onClick={() => handleStatusChange(selectedDispute.id, "EVIDENCE_REQUESTED")}
                          className="px-3 py-1.5 text-xs bg-orange-100 text-orange-700 rounded-lg hover:bg-orange-200"
                        >
                          Request More Evidence
                        </button>
                      )}
                      <button
                        onClick={() => handleStatusChange(selectedDispute.id, "ESCALATED")}
                        className="px-3 py-1.5 text-xs bg-red-100 text-red-700 rounded-lg hover:bg-red-200"
                      >
                        Escalate
                      </button>
                    </div>
                  )}

                  {/* Resolution Form */}
                  {!["RESOLVED", "CLOSED"].includes(selectedDispute.status) && (
                    <div className="p-4 bg-green-50 border border-green-200 rounded-xl space-y-4">
                      <h4 className="font-semibold text-green-900 flex items-center gap-2">
                        <Scale className="w-4 h-4" /> Resolve Dispute
                      </h4>
                      <select
                        value={resolution}
                        onChange={(e) => setResolution(e.target.value)}
                        className="w-full px-3 py-2 border rounded-lg text-sm"
                      >
                        <option value="">Select resolution...</option>
                        {resolutionOptions.map((r) => (
                          <option key={r.value} value={r.value}>{r.label}</option>
                        ))}
                      </select>
                      {["BUYER_FULL_REFUND", "BUYER_PARTIAL_REFUND"].includes(resolution) && (
                        <div>
                          <label className="text-xs font-medium text-gray-600">Refund Amount (UGX)</label>
                          <input
                            type="number"
                            value={refundAmount}
                            onChange={(e) => setRefundAmount(e.target.value)}
                            className="w-full mt-1 px-3 py-2 border rounded-lg text-sm"
                          />
                        </div>
                      )}
                      <textarea
                        value={resolutionNote}
                        onChange={(e) => setResolutionNote(e.target.value)}
                        placeholder="Resolution notes (visible to buyer and seller)..."
                        rows={3}
                        className="w-full px-3 py-2 border rounded-lg text-sm resize-none"
                      />
                      <button
                        onClick={handleResolve}
                        disabled={!resolution || resolving}
                        className="w-full py-2.5 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 disabled:opacity-50 flex items-center justify-center gap-2"
                      >
                        {resolving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                        Apply Resolution
                      </button>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
