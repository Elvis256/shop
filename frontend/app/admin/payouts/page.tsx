"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import {
  ChevronLeft,
  ChevronRight,
  X,
  Loader2,
  Banknote,
  Clock,
  CheckCircle,
  XCircle,
  RefreshCw,
  DollarSign,
} from "lucide-react";

interface Payout {
  id: string;
  sellerName: string;
  sellerEmail?: string;
  amount: number;
  method: string;
  status: "PENDING" | "PROCESSING" | "COMPLETED" | "REJECTED";
  reference?: string;
  notes?: string;
  requestedAt: string;
  processedAt?: string;
}

interface PayoutStats {
  pendingCount: number;
  pendingTotal: number;
  processingCount: number;
  completedThisMonth: number;
}

const STATUS_TABS = ["All", "PENDING", "PROCESSING", "COMPLETED", "REJECTED"] as const;

const statusColors: Record<string, string> = {
  PENDING: "bg-yellow-100 text-yellow-800",
  PROCESSING: "bg-blue-100 text-blue-800",
  COMPLETED: "bg-green-100 text-green-800",
  REJECTED: "bg-red-100 text-red-800",
};

export default function AdminPayoutsPage() {
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [stats, setStats] = useState<PayoutStats>({ pendingCount: 0, pendingTotal: 0, processingCount: 0, completedThisMonth: 0 });
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Process modal
  const [processPayout, setProcessPayout] = useState<Payout | null>(null);
  const [processAction, setProcessAction] = useState<"COMPLETED" | "REJECTED">("COMPLETED");
  const [processRef, setProcessRef] = useState("");
  const [processNotes, setProcessNotes] = useState("");
  const [processing, setProcessing] = useState(false);
  const [autoDisburse, setAutoDisburse] = useState(false);

  useEffect(() => {
    loadPayouts();
  }, [page, statusFilter]);

  const loadPayouts = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page) });
      if (statusFilter) params.set("status", statusFilter);
      const data = await apiFetch(`/api/admin/sellers/payouts?${params}`);
      setPayouts(data.payouts || []);
      setTotalPages(data.pagination?.totalPages || 1);
      if (data.stats) setStats(data.stats);
    } catch {
      setPayouts([]);
    } finally {
      setLoading(false);
    }
  };

  const handleProcess = async () => {
    if (!processPayout) return;
    setProcessing(true);
    try {
      const body: any = { status: processAction };
      if (processAction === "COMPLETED" && processRef) body.reference = processRef;
      if (processNotes) body.notes = processNotes;
      if (autoDisburse && processAction === "COMPLETED") body.autoDisburse = true;
      await apiFetch(`/api/admin/sellers/payouts/${processPayout.id}`, {
        method: "PUT",
        body: JSON.stringify(body),
      });
      setProcessPayout(null);
      setProcessRef("");
      setProcessNotes("");
      loadPayouts();
    } catch {
    } finally {
      setProcessing(false);
    }
  };

  const openProcess = (payout: Payout) => {
    setProcessPayout(payout);
    setProcessAction("COMPLETED");
    setProcessRef("");
    setProcessNotes("");
    setAutoDisburse(false);
  };

  const statCards = [
    { label: "Pending Payouts", value: `${stats.pendingCount} (UGX ${stats.pendingTotal.toLocaleString()})`, icon: Clock, color: "text-yellow-600 bg-yellow-50" },
    { label: "Processing", value: stats.processingCount, icon: RefreshCw, color: "text-blue-600 bg-blue-50" },
    { label: "Completed This Month", value: stats.completedThisMonth, icon: CheckCircle, color: "text-green-600 bg-green-50" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Payout Management</h1>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {statCards.map((s) => (
          <div key={s.label} className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">{s.label}</p>
                <p className="text-xl font-bold text-gray-900 mt-1">{s.value}</p>
              </div>
              <div className={`p-3 rounded-xl ${s.color}`}>
                <s.icon className="w-5 h-5" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
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

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : payouts.length === 0 ? (
          <div className="text-center py-20">
            <Banknote className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">No payout requests found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Seller</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-500">Amount</th>
                  <th className="text-center px-4 py-3 font-medium text-gray-500">Method</th>
                  <th className="text-center px-4 py-3 font-medium text-gray-500">Status</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Requested</th>
                  <th className="text-center px-4 py-3 font-medium text-gray-500">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {payouts.map((payout) => (
                  <tr key={payout.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <div>
                        <p className="font-medium text-gray-900">{payout.sellerName}</p>
                        {payout.sellerEmail && (
                          <p className="text-xs text-gray-500">{payout.sellerEmail}</p>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-gray-900">
                      UGX {payout.amount.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-center text-gray-600">{payout.method}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${statusColors[payout.status]}`}>
                        {payout.status.charAt(0) + payout.status.slice(1).toLowerCase()}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600 text-sm">
                      {new Date(payout.requestedAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {(payout.status === "PENDING" || payout.status === "PROCESSING") && (
                        <button
                          onClick={() => openProcess(payout)}
                          className="px-3 py-1.5 text-xs font-medium text-primary bg-primary/5 hover:bg-primary/10 rounded-lg transition-colors"
                        >
                          Process
                        </button>
                      )}
                      {payout.status === "COMPLETED" && payout.reference && (
                        <span className="text-xs text-gray-500">Ref: {payout.reference}</span>
                      )}
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

      {/* Process Payout Modal */}
      {processPayout && (
        <div className="fixed inset-0 bg-black/50 z-[500] flex items-center justify-center p-4" onClick={() => setProcessPayout(null)}>
          <div className="bg-white rounded-2xl max-w-md w-full" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-6 border-b">
              <h3 className="text-lg font-semibold text-gray-900">Process Payout</h3>
              <button onClick={() => setProcessPayout(null)} className="p-2 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-xs text-gray-500">Seller</p>
                    <p className="font-medium text-gray-900">{processPayout.sellerName}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Amount</p>
                    <p className="font-bold text-gray-900">UGX {processPayout.amount.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Method</p>
                    <p className="text-gray-700">{processPayout.method}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Requested</p>
                    <p className="text-gray-700">{new Date(processPayout.requestedAt).toLocaleDateString()}</p>
                  </div>
                </div>
              </div>

              <div>
                <label className="text-sm text-gray-700 block mb-2">Action</label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setProcessAction("COMPLETED")}
                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium rounded-lg border-2 transition-colors ${
                      processAction === "COMPLETED"
                        ? "border-green-500 bg-green-50 text-green-700"
                        : "border-gray-200 text-gray-600 hover:border-gray-300"
                    }`}
                  >
                    <CheckCircle className="w-4 h-4" />
                    Approve
                  </button>
                  <button
                    onClick={() => setProcessAction("REJECTED")}
                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium rounded-lg border-2 transition-colors ${
                      processAction === "REJECTED"
                        ? "border-red-500 bg-red-50 text-red-700"
                        : "border-gray-200 text-gray-600 hover:border-gray-300"
                    }`}
                  >
                    <XCircle className="w-4 h-4" />
                    Reject
                  </button>
                </div>
              </div>

              {processAction === "COMPLETED" && (
                <>
                  <div>
                    <label className="text-sm text-gray-700 block mb-1">Reference Number</label>
                    <input
                      type="text"
                      value={processRef}
                      onChange={(e) => setProcessRef(e.target.value)}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                      placeholder="Transaction reference..."
                      disabled={autoDisburse}
                    />
                  </div>

                  {processPayout && (processPayout.method === "MOBILE_MONEY" || processPayout.method === "BANK_TRANSFER" || processPayout.method === "FLUTTERWAVE") && processPayout.status === "PENDING" && (
                    <label className="flex items-center gap-3 p-3 bg-blue-50 border border-blue-200 rounded-lg cursor-pointer">
                      <input
                        type="checkbox"
                        checked={autoDisburse}
                        onChange={(e) => setAutoDisburse(e.target.checked)}
                        className="w-4 h-4 rounded text-primary"
                      />
                      <div>
                        <p className="text-sm font-medium text-blue-800">Disburse via Flutterwave</p>
                        <p className="text-xs text-blue-600">Automatically send funds to seller&apos;s account</p>
                      </div>
                    </label>
                  )}
                </>
              )}

              <div>
                <label className="text-sm text-gray-700 block mb-1">Notes</label>
                <textarea
                  value={processNotes}
                  onChange={(e) => setProcessNotes(e.target.value)}
                  rows={3}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                  placeholder={processAction === "REJECTED" ? "Reason for rejection..." : "Optional notes..."}
                />
              </div>

              <div className="flex gap-3 justify-end pt-2">
                <button
                  onClick={() => setProcessPayout(null)}
                  className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleProcess}
                  disabled={processing}
                  className={`px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors disabled:opacity-50 ${
                    processAction === "COMPLETED" ? "bg-green-600 hover:bg-green-700" : "bg-red-600 hover:bg-red-700"
                  }`}
                >
                  {processing ? "Processing..." : processAction === "COMPLETED" ? "Approve Payout" : "Reject Payout"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
