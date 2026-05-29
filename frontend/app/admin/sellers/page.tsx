"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { useRouter } from "next/navigation";
import {
  Search,
  ChevronLeft,
  ChevronRight,
  X,
  Store,
  Users,
  Clock,
  DollarSign,
  Star,
  Eye,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Loader2,
  MessageSquare,
  ShieldAlert,
  Activity,
  TrendingUp,
} from "lucide-react";

interface Seller {
  id: string;
  storeName: string;
  storeSlug: string;
  email: string;
  phone?: string;
  storeLogo?: string;
  storeDescription?: string;
  status: "PENDING" | "APPROVED" | "SUSPENDED" | "REJECTED";
  commissionRate?: number;
  autoApproveProducts?: boolean;
  rating: number;
  reviewCount: number;
  productCount: number;
  orderCount: number;
  totalEarnings: number;
  warningCount: number;
  verificationDocs?: string[];
  bankName?: string;
  bankAccount?: string;
  mobileMoney?: string;
  rejectionNote?: string;
  createdAt: string;
}

interface Stats {
  totalSellers: number;
  pendingApproval: number;
  activeSellers: number;
  totalCommissions: number;
}

const STATUS_TABS = ["All", "PENDING", "APPROVED", "SUSPENDED", "REJECTED"] as const;

const statusColors: Record<string, string> = {
  PENDING: "bg-yellow-100 text-yellow-800",
  APPROVED: "bg-green-100 text-green-800",
  SUSPENDED: "bg-red-100 text-red-800",
  REJECTED: "bg-gray-100 text-gray-800",
};

export default function AdminSellersPage() {
  const router = useRouter();
  const [sellers, setSellers] = useState<Seller[]>([]);
  const [stats, setStats] = useState<Stats>({ totalSellers: 0, pendingApproval: 0, activeSellers: 0, totalCommissions: 0 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Detail modal
  const [selectedSeller, setSelectedSeller] = useState<Seller | null>(null);
  const [editCommission, setEditCommission] = useState("");
  const [editAutoApprove, setEditAutoApprove] = useState(false);
  const [saving, setSaving] = useState(false);

  // Warnings
  const [warnings, setWarnings] = useState<any[]>([]);
  const [warningReason, setWarningReason] = useState("");
  const [issuingWarning, setIssuingWarning] = useState(false);

  // Scorecard
  const [scorecard, setScorecard] = useState<any>(null);

  // Activity
  const [activityLog, setActivityLog] = useState<any[]>([]);

  // Action modal
  const [actionModal, setActionModal] = useState<{ seller: Seller; action: "APPROVED" | "SUSPENDED" | "REJECTED" } | null>(null);
  const [rejectionNote, setRejectionNote] = useState("");
  const [actioning, setActioning] = useState(false);

  useEffect(() => {
    loadSellers();
    loadStats();
  }, [page, statusFilter, search]);

  const loadStats = async () => {
    try {
      const data = await apiFetch("/api/admin/sellers/stats");
      setStats(data);
    } catch {}
  };

  const loadSellers = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page) });
      if (statusFilter) params.set("status", statusFilter);
      if (search) params.set("search", search);
      const data = await apiFetch(`/api/admin/sellers?${params}`);
      setSellers(data.sellers || []);
      setTotalPages(data.pagination?.totalPages || data.pagination?.pages || 1);
    } catch {
      setSellers([]);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async () => {
    if (!actionModal) return;
    setActioning(true);
    try {
      const body: any = { status: actionModal.action };
      if (actionModal.action === "REJECTED" && rejectionNote) body.rejectionNote = rejectionNote;
      await apiFetch(`/api/admin/sellers/${actionModal.seller.id}/status`, {
        method: "PUT",
        body: JSON.stringify(body),
      });
      setActionModal(null);
      setRejectionNote("");
      loadSellers();
      loadStats();
    } catch {
    } finally {
      setActioning(false);
    }
  };

  const handleSaveSellerSettings = async () => {
    if (!selectedSeller) return;
    setSaving(true);
    try {
      await apiFetch(`/api/admin/sellers/${selectedSeller.id}`, {
        method: "PUT",
        body: JSON.stringify({
          commissionRate: Number(editCommission) || undefined,
          autoApproveProducts: editAutoApprove,
        }),
      });
      loadSellers();
    } catch {
    } finally {
      setSaving(false);
    }
  };

  const openDetail = async (seller: Seller) => {
    setSelectedSeller(seller);
    setEditCommission(String(seller.commissionRate || ""));
    setEditAutoApprove(seller.autoApproveProducts || false);
    setWarnings([]);
    setScorecard(null);
    setActivityLog([]);
    setWarningReason("");

    // Fetch detail data in parallel
    try {
      const detail = await apiFetch(`/api/admin/sellers/${seller.id}`);
      if (detail.seller?.warnings) setWarnings(detail.seller.warnings);
      if (detail.activityLog) setActivityLog(detail.activityLog);
    } catch {}

    apiFetch(`/api/admin/sellers/${seller.id}/scorecard`)
      .then((data) => setScorecard(data.scorecard))
      .catch(() => {});
  };

  const issueWarning = async () => {
    if (!selectedSeller || !warningReason.trim()) return;
    setIssuingWarning(true);
    try {
      const data = await apiFetch(`/api/admin/sellers/${selectedSeller.id}/warnings`, {
        method: "POST",
        body: JSON.stringify({ reason: warningReason.trim() }),
      });
      setWarningReason("");
      // Refresh warnings
      const detail = await apiFetch(`/api/admin/sellers/${selectedSeller.id}`);
      if (detail.seller?.warnings) setWarnings(detail.seller.warnings);
      if (detail.activityLog) setActivityLog(detail.activityLog);
      if (data.autoSuspended) {
        loadSellers();
        loadStats();
      }
    } catch {
      alert("Failed to issue warning");
    } finally {
      setIssuingWarning(false);
    }
  };

  const expireWarning = async (warningId: string) => {
    if (!selectedSeller) return;
    try {
      await apiFetch(`/api/admin/sellers/${selectedSeller.id}/warnings/${warningId}`, { method: "DELETE" });
      const detail = await apiFetch(`/api/admin/sellers/${selectedSeller.id}`);
      if (detail.seller?.warnings) setWarnings(detail.seller.warnings);
    } catch {}
  };

  const statCards = [
    { label: "Total Sellers", value: stats.totalSellers, icon: Users, color: "text-blue-600 bg-blue-50" },
    { label: "Pending Approval", value: stats.pendingApproval, icon: Clock, color: "text-yellow-600 bg-yellow-50" },
    { label: "Active Sellers", value: stats.activeSellers, icon: Store, color: "text-green-600 bg-green-50" },
    { label: "Total Commissions", value: `UGX ${Number(stats.totalCommissions || 0).toLocaleString()}`, icon: DollarSign, color: "text-purple-600 bg-purple-50" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Seller Management</h1>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((s) => (
          <div key={s.label} className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">{s.label}</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{s.value}</p>
              </div>
              <div className={`p-3 rounded-xl ${s.color}`}>
                <s.icon className="w-5 h-5" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search sellers..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
          </div>
          <div className="flex gap-1 overflow-x-auto">
            {STATUS_TABS.map((tab) => (
              <button
                key={tab}
                onClick={() => { setStatusFilter(tab === "All" ? "" : tab); setPage(1); }}
                className={`px-3 py-2 text-xs font-medium rounded-lg whitespace-nowrap transition-colors ${
                  (tab === "All" && !statusFilter) || statusFilter === tab
                    ? "bg-primary text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {tab === "All" ? "All" : tab.charAt(0) + tab.slice(1).toLowerCase()}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : sellers.length === 0 ? (
          <div className="text-center py-20">
            <Store className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">No sellers found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Store Name</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Owner Email</th>
                  <th className="text-center px-4 py-3 font-medium text-gray-500">Products</th>
                  <th className="text-center px-4 py-3 font-medium text-gray-500">Orders</th>
                  <th className="text-center px-4 py-3 font-medium text-gray-500">Rating</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-500">Earnings</th>
                  <th className="text-center px-4 py-3 font-medium text-gray-500">Status</th>
                  <th className="text-center px-4 py-3 font-medium text-gray-500">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {sellers.map((seller) => (
                  <tr
                    key={seller.id}
                    className="hover:bg-gray-50 cursor-pointer transition-colors"
                    onClick={() => openDetail(seller)}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {seller.storeLogo ? (
                          <img src={seller.storeLogo} alt="" className="w-8 h-8 rounded-lg object-cover" />
                        ) : (
                          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                            <Store className="w-4 h-4 text-primary" />
                          </div>
                        )}
                        <span className="font-medium text-gray-900">{seller.storeName}</span>
                        {seller.warningCount > 0 && (
                          <span className="ml-2 inline-flex items-center gap-0.5 text-[10px] font-medium text-red-600 bg-red-50 px-1.5 py-0.5 rounded-full">
                            <ShieldAlert className="w-3 h-3" /> {seller.warningCount}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{seller.email}</td>
                    <td className="px-4 py-3 text-center text-gray-600">{seller.productCount}</td>
                    <td className="px-4 py-3 text-center text-gray-600">{seller.orderCount}</td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <Star className="w-3.5 h-3.5 fill-yellow-400 text-yellow-400" />
                        <span className="text-gray-700">{Number(seller.rating || 0).toFixed(1)}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right text-gray-700 font-medium">
                      UGX {Number(seller.totalEarnings || 0).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${statusColors[seller.status]}`}>
                        {seller.status.charAt(0) + seller.status.slice(1).toLowerCase()}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-center gap-1">
                        {seller.status === "PENDING" && (
                          <>
                            <button
                              onClick={() => setActionModal({ seller, action: "APPROVED" })}
                              className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                              title="Approve"
                            >
                              <CheckCircle className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => setActionModal({ seller, action: "REJECTED" })}
                              className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                              title="Reject"
                            >
                              <XCircle className="w-4 h-4" />
                            </button>
                          </>
                        )}
                        {seller.status === "APPROVED" && (
                          <button
                            onClick={() => setActionModal({ seller, action: "SUSPENDED" })}
                            className="p-1.5 text-orange-600 hover:bg-orange-50 rounded-lg transition-colors"
                            title="Suspend"
                          >
                            <AlertTriangle className="w-4 h-4" />
                          </button>
                        )}
                        {seller.status === "SUSPENDED" && (
                          <button
                            onClick={() => setActionModal({ seller, action: "APPROVED" })}
                            className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                            title="Reactivate"
                          >
                            <CheckCircle className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          onClick={() => openDetail(seller)}
                          className="p-1.5 text-gray-500 hover:bg-gray-100 rounded-lg transition-colors"
                          title="View Details"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t">
            <p className="text-sm text-gray-500">Page {page} of {totalPages}</p>
            <div className="flex gap-1">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Seller Detail Modal */}
      {selectedSeller && (
        <div className="fixed inset-0 bg-black/50 z-[500] flex items-center justify-center p-4" onClick={() => setSelectedSeller(null)}>
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-6 border-b sticky top-0 bg-white rounded-t-2xl">
              <h2 className="text-lg font-semibold text-gray-900">Seller Details</h2>
              <button onClick={() => setSelectedSeller(null)} className="p-2 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-6">
              {/* Store Info */}
              <div>
                <h3 className="text-sm font-semibold text-gray-900 mb-3">Store Information</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-gray-500">Store Name</p>
                    <p className="text-sm font-medium text-gray-900">{selectedSeller.storeName}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Status</p>
                    <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${statusColors[selectedSeller.status]}`}>
                      {selectedSeller.status}
                    </span>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Store Slug</p>
                    <p className="text-sm text-gray-700">{selectedSeller.storeSlug}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Joined</p>
                    <p className="text-sm text-gray-700">{new Date(selectedSeller.createdAt).toLocaleDateString()}</p>
                  </div>
                </div>
                {selectedSeller.storeDescription && (
                  <div className="mt-3">
                    <p className="text-xs text-gray-500">Description</p>
                    <p className="text-sm text-gray-700 mt-1">{selectedSeller.storeDescription}</p>
                  </div>
                )}
              </div>

              {/* Contact */}
              <div>
                <h3 className="text-sm font-semibold text-gray-900 mb-3">Contact</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-gray-500">Email</p>
                    <p className="text-sm text-gray-700">{selectedSeller.email}</p>
                  </div>
                  {selectedSeller.phone && (
                    <div>
                      <p className="text-xs text-gray-500">Phone</p>
                      <p className="text-sm text-gray-700">{selectedSeller.phone}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Verification Docs */}
              {selectedSeller.verificationDocs && selectedSeller.verificationDocs.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 mb-3">Verification Documents</h3>
                  <div className="flex flex-wrap gap-2">
                    {selectedSeller.verificationDocs.map((doc, i) => (
                      <a
                        key={i}
                        href={doc}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-primary hover:underline bg-primary/5 px-3 py-1.5 rounded-lg"
                      >
                        Document {i + 1}
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {/* Financial Summary */}
              <div>
                <h3 className="text-sm font-semibold text-gray-900 mb-3">Financial Summary</h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div className="bg-gray-50 rounded-lg p-3 text-center">
                    <p className="text-xs text-gray-500">Products</p>
                    <p className="text-lg font-bold text-gray-900">{selectedSeller.productCount}</p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3 text-center">
                    <p className="text-xs text-gray-500">Orders</p>
                    <p className="text-lg font-bold text-gray-900">{selectedSeller.orderCount}</p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3 text-center">
                    <p className="text-xs text-gray-500">Rating</p>
                    <p className="text-lg font-bold text-gray-900">{Number(selectedSeller.rating || 0).toFixed(1)}</p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3 text-center">
                    <p className="text-xs text-gray-500">Earnings</p>
                    <p className="text-lg font-bold text-gray-900">UGX {Number(selectedSeller.totalEarnings || 0).toLocaleString()}</p>
                  </div>
                </div>
              </div>

              {/* Payment Info */}
              {(selectedSeller.bankName || selectedSeller.mobileMoney) && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 mb-3">Payment Information</h3>
                  <div className="grid grid-cols-2 gap-4">
                    {selectedSeller.bankName && (
                      <div>
                        <p className="text-xs text-gray-500">Bank</p>
                        <p className="text-sm text-gray-700">{selectedSeller.bankName} - {selectedSeller.bankAccount}</p>
                      </div>
                    )}
                    {selectedSeller.mobileMoney && (
                      <div>
                        <p className="text-xs text-gray-500">Mobile Money</p>
                        <p className="text-sm text-gray-700">{selectedSeller.mobileMoney}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Commission & Settings */}
              <div>
                <h3 className="text-sm font-semibold text-gray-900 mb-3">Seller Settings</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">Commission Rate (%)</label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.1"
                      value={editCommission}
                      onChange={(e) => setEditCommission(e.target.value)}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                      placeholder="Default"
                    />
                  </div>
                  <div className="flex items-end">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={editAutoApprove}
                        onChange={(e) => setEditAutoApprove(e.target.checked)}
                        className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary"
                      />
                      <span className="text-sm text-gray-700">Auto-approve products</span>
                    </label>
                  </div>
                </div>
                <button
                  onClick={handleSaveSellerSettings}
                  disabled={saving}
                  className="mt-3 px-4 py-2 bg-primary text-white text-sm font-medium rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-colors"
                >
                  {saving ? "Saving..." : "Save Settings"}
                </button>
              </div>

              {/* Rejection Note */}
              {selectedSeller.rejectionNote && (
                <div className="bg-red-50 border border-red-100 rounded-lg p-4">
                  <p className="text-xs font-medium text-red-800 mb-1">Rejection Note</p>
                  <p className="text-sm text-red-700">{selectedSeller.rejectionNote}</p>
                </div>
              )}

              {/* Message Seller Button */}
              <button
                onClick={() => router.push(`/admin/messages?seller=${selectedSeller.id}`)}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium text-sm"
              >
                <MessageSquare className="w-4 h-4" /> Message Seller
              </button>

              {/* Performance Scorecard */}
              <div>
                <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4" /> Performance Scorecard
                </h3>
                {scorecard ? (
                  <>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div className={`rounded-lg p-3 text-center ${scorecard.fulfillmentRate < 80 ? "bg-red-50 border border-red-200" : "bg-green-50"}`}>
                        <p className="text-xs text-gray-500">Fulfillment</p>
                        <p className={`text-lg font-bold ${scorecard.fulfillmentRate < 80 ? "text-red-600" : "text-green-600"}`}>{scorecard.fulfillmentRate}%</p>
                      </div>
                      <div className={`rounded-lg p-3 text-center ${scorecard.returnRate > 10 ? "bg-red-50 border border-red-200" : "bg-green-50"}`}>
                        <p className="text-xs text-gray-500">Return Rate</p>
                        <p className={`text-lg font-bold ${scorecard.returnRate > 10 ? "text-red-600" : "text-green-600"}`}>{scorecard.returnRate}%</p>
                      </div>
                      <div className={`rounded-lg p-3 text-center ${scorecard.customerRating < 3.0 ? "bg-red-50 border border-red-200" : "bg-green-50"}`}>
                        <p className="text-xs text-gray-500">Rating</p>
                        <p className={`text-lg font-bold ${scorecard.customerRating < 3.0 ? "text-red-600" : "text-green-600"}`}>{scorecard.customerRating.toFixed(1)}</p>
                      </div>
                      <div className="bg-gray-50 rounded-lg p-3 text-center">
                        <p className="text-xs text-gray-500">Avg Response</p>
                        <p className="text-lg font-bold text-gray-900">
                          {scorecard.responseTimeMinutes < 60 ? `${scorecard.responseTimeMinutes}m` : `${Math.round(scorecard.responseTimeMinutes / 60)}h`}
                        </p>
                      </div>
                    </div>
                    {scorecard.flags?.length > 0 && (
                      <div className="mt-2 space-y-1">
                        {scorecard.flags.map((flag: string, i: number) => (
                          <p key={i} className="text-xs text-red-600 flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3" /> {flag}
                          </p>
                        ))}
                      </div>
                    )}
                  </>
                ) : (
                  <div className="text-center py-4 text-gray-400 text-sm">Loading scorecard...</div>
                )}
              </div>

              {/* Warnings & Strikes */}
              <div>
                <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4" /> Warnings & Strikes
                  {warnings.length > 0 && (
                    <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full">{warnings.filter((w: any) => !w.expiresAt || new Date(w.expiresAt) > new Date()).length} active</span>
                  )}
                </h3>

                {/* Issue Warning */}
                <div className="flex gap-2 mb-3">
                  <input
                    type="text"
                    value={warningReason}
                    onChange={(e) => setWarningReason(e.target.value)}
                    placeholder="Reason for warning..."
                    className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-200"
                  />
                  <button
                    onClick={issueWarning}
                    disabled={issuingWarning || !warningReason.trim()}
                    className="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 disabled:opacity-50 whitespace-nowrap"
                  >
                    {issuingWarning ? "..." : "Issue Warning"}
                  </button>
                </div>

                {/* Warning List */}
                {warnings.length > 0 ? (
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {warnings.map((w: any) => {
                      const isExpired = w.expiresAt && new Date(w.expiresAt) <= new Date();
                      return (
                        <div key={w.id} className={`flex items-start gap-3 p-3 rounded-lg border text-sm ${isExpired ? "bg-gray-50 border-gray-200 opacity-60" : "bg-red-50 border-red-200"}`}>
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className={`text-xs font-semibold px-1.5 py-0.5 rounded ${
                                w.type === "FINAL_WARNING" ? "bg-red-600 text-white" :
                                w.type === "STRIKE" ? "bg-orange-500 text-white" :
                                "bg-yellow-500 text-white"
                              }`}>{w.type.replace("_", " ")}</span>
                              {isExpired && <span className="text-xs text-gray-500">Expired</span>}
                              {w.acknowledgedAt && <span className="text-xs text-green-600">Acknowledged</span>}
                            </div>
                            <p className="text-gray-700 mt-1">{w.reason}</p>
                            <p className="text-xs text-gray-400 mt-1">{new Date(w.createdAt).toLocaleDateString()}</p>
                          </div>
                          {!isExpired && (
                            <button onClick={() => expireWarning(w.id)} className="text-xs text-gray-500 hover:text-red-600 whitespace-nowrap">
                              Expire
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-gray-400">No warnings issued</p>
                )}
              </div>

              {/* Activity Timeline */}
              <div>
                <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <Activity className="w-4 h-4" /> Activity Timeline
                </h3>
                {activityLog.length > 0 ? (
                  <div className="space-y-3 max-h-60 overflow-y-auto pl-4 border-l-2 border-gray-200">
                    {activityLog.map((entry: any) => (
                      <div key={entry.id} className="relative">
                        <div className="absolute -left-[21px] top-1 w-2.5 h-2.5 rounded-full bg-gray-400 border-2 border-white" />
                        <p className="text-sm text-gray-700">{entry.description}</p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {new Date(entry.createdAt).toLocaleDateString()} {new Date(entry.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-400">No activity recorded</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Action Confirmation Modal */}
      {actionModal && (
        <div className="fixed inset-0 bg-black/50 z-[600] flex items-center justify-center p-4" onClick={() => setActionModal(null)}>
          <div className="bg-white rounded-2xl max-w-md w-full" onClick={(e) => e.stopPropagation()}>
            <div className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                {actionModal.action === "APPROVED" && "Approve Seller"}
                {actionModal.action === "SUSPENDED" && "Suspend Seller"}
                {actionModal.action === "REJECTED" && "Reject Seller"}
              </h3>
              <p className="text-sm text-gray-600 mb-4">
                Are you sure you want to {actionModal.action.toLowerCase()} <strong>{actionModal.seller.storeName}</strong>?
              </p>

              {actionModal.action === "REJECTED" && (
                <div className="mb-4">
                  <label className="text-sm text-gray-700 block mb-1">Rejection Note</label>
                  <textarea
                    value={rejectionNote}
                    onChange={(e) => setRejectionNote(e.target.value)}
                    rows={3}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                    placeholder="Reason for rejection..."
                  />
                </div>
              )}

              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => { setActionModal(null); setRejectionNote(""); }}
                  className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleStatusChange}
                  disabled={actioning}
                  className={`px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors disabled:opacity-50 ${
                    actionModal.action === "APPROVED" ? "bg-green-600 hover:bg-green-700" :
                    actionModal.action === "SUSPENDED" ? "bg-orange-600 hover:bg-orange-700" :
                    "bg-red-600 hover:bg-red-700"
                  }`}
                >
                  {actioning ? "Processing..." : "Confirm"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
