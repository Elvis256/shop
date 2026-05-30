"use client";

import { useEffect, useState, useCallback } from "react";
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
  Download,
  Search,
  Filter,
  Calendar,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Store,
  CreditCard,
  Smartphone,
  TrendingUp,
  AlertTriangle,
  Eye,
} from "lucide-react";

interface Payout {
  id: string;
  sellerId: string;
  amount: number;
  method: string;
  status: "PENDING" | "PROCESSING" | "COMPLETED" | "REJECTED" | "FAILED";
  reference?: string;
  notes?: string;
  createdAt: string;
  requestedAt: string;
  processedAt?: string;
  processedBy?: string;
  seller?: {
    id: string;
    storeName: string;
    email: string;
    payoutMethod?: string;
    payoutPhone?: string;
    bankName?: string;
    bankAccount?: string;
  };
  sellerName?: string;
  sellerEmail?: string;
}

interface PayoutStats {
  pendingCount: number;
  pendingTotal: number;
  processingCount: number;
  completedThisMonth: number;
  completedTotal: number;
  rejectedCount: number;
  totalDisbursed: number;
}

const STATUS_TABS = ["All", "PENDING", "PROCESSING", "COMPLETED", "REJECTED", "FAILED"] as const;

const statusColors: Record<string, string> = {
  PENDING: "bg-yellow-100 text-yellow-800",
  PROCESSING: "bg-blue-100 text-blue-800",
  COMPLETED: "bg-green-100 text-green-800",
  REJECTED: "bg-red-100 text-red-800",
  FAILED: "bg-gray-100 text-gray-800",
};

const statusIcons: Record<string, any> = {
  PENDING: Clock,
  PROCESSING: RefreshCw,
  COMPLETED: CheckCircle,
  REJECTED: XCircle,
  FAILED: AlertTriangle,
};

type SortField = "amount" | "createdAt" | "sellerName";
type SortDir = "asc" | "desc";

export default function AdminPayoutsPage() {
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [stats, setStats] = useState<PayoutStats>({
    pendingCount: 0, pendingTotal: 0, processingCount: 0,
    completedThisMonth: 0, completedTotal: 0, rejectedCount: 0, totalDisbursed: 0,
  });
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [search, setSearch] = useState("");

  // Sorting
  const [sortField, setSortField] = useState<SortField>("createdAt");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  // Filters
  const [showFilters, setShowFilters] = useState(false);
  const [methodFilter, setMethodFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  // Bulk selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkProcessing, setBulkProcessing] = useState(false);

  // Process modal
  const [processPayout, setProcessPayout] = useState<Payout | null>(null);
  const [processAction, setProcessAction] = useState<"COMPLETED" | "REJECTED">("COMPLETED");
  const [processRef, setProcessRef] = useState("");
  const [processNotes, setProcessNotes] = useState("");
  const [processing, setProcessing] = useState(false);
  const [autoDisburse, setAutoDisburse] = useState(false);

  // Detail view
  const [detailPayout, setDetailPayout] = useState<Payout | null>(null);

  // Exporting
  const [exporting, setExporting] = useState(false);

  const loadPayouts = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: "20" });
      if (statusFilter) params.set("status", statusFilter);
      const data = await apiFetch(`/api/admin/sellers/payouts?${params}`);
      setPayouts(data.payouts || []);
      setTotalPages(data.pagination?.pages || data.pagination?.totalPages || 1);
      setTotalCount(data.pagination?.total || 0);
      if (data.stats) {
        setStats({
          pendingCount: data.stats.pendingCount || 0,
          pendingTotal: data.stats.pendingTotal || 0,
          processingCount: data.stats.processingCount || 0,
          completedThisMonth: data.stats.completedThisMonth || 0,
          completedTotal: data.stats.completedTotal || 0,
          rejectedCount: data.stats.rejectedCount || 0,
          totalDisbursed: data.stats.totalDisbursed || 0,
        });
      }
    } catch {
      setPayouts([]);
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter]);

  useEffect(() => {
    loadPayouts();
  }, [loadPayouts]);

  // Client-side filtering and sorting
  const filteredPayouts = payouts.filter((p) => {
    const name = p.seller?.storeName || p.sellerName || "";
    if (search && !name.toLowerCase().includes(search.toLowerCase())) return false;
    if (methodFilter && p.method !== methodFilter) return false;
    if (dateFrom && new Date(p.createdAt) < new Date(dateFrom)) return false;
    if (dateTo && new Date(p.createdAt) > new Date(dateTo + "T23:59:59")) return false;
    return true;
  });

  const sortedPayouts = [...filteredPayouts].sort((a, b) => {
    const dir = sortDir === "asc" ? 1 : -1;
    switch (sortField) {
      case "amount": return dir * (Number(a.amount) - Number(b.amount));
      case "sellerName": return dir * ((a.seller?.storeName || a.sellerName || "").localeCompare(b.seller?.storeName || b.sellerName || ""));
      case "createdAt": return dir * (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      default: return 0;
    }
  });

  const toggleSort = (field: SortField) => {
    if (sortField === field) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortField(field); setSortDir("desc"); }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="w-3 h-3 text-gray-300" />;
    return sortDir === "asc" ? <ArrowUp className="w-3 h-3 text-primary" /> : <ArrowDown className="w-3 h-3 text-primary" />;
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  };

  const toggleSelectAll = () => {
    const pendingPayouts = sortedPayouts.filter((p) => p.status === "PENDING" || p.status === "PROCESSING");
    if (selectedIds.size === pendingPayouts.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(pendingPayouts.map((p) => p.id)));
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
      setAutoDisburse(false);
      loadPayouts();
    } catch {
    } finally {
      setProcessing(false);
    }
  };

  const handleBulkApprove = async () => {
    if (selectedIds.size === 0) return;
    setBulkProcessing(true);
    try {
      const promises = Array.from(selectedIds).map((id) =>
        apiFetch(`/api/admin/sellers/payouts/${id}`, {
          method: "PUT",
          body: JSON.stringify({ status: "COMPLETED" }),
        })
      );
      await Promise.allSettled(promises);
      setSelectedIds(new Set());
      loadPayouts();
    } catch {
    } finally {
      setBulkProcessing(false);
    }
  };

  const openProcess = (payout: Payout) => {
    setProcessPayout(payout);
    setProcessAction("COMPLETED");
    setProcessRef("");
    setProcessNotes("");
    setAutoDisburse(false);
  };

  const exportCSV = async () => {
    setExporting(true);
    try {
      const allPayouts: Payout[] = [];
      let p = 1;
      let hasMore = true;
      while (hasMore) {
        const params = new URLSearchParams({ page: String(p), limit: "100" });
        if (statusFilter) params.set("status", statusFilter);
        const data = await apiFetch(`/api/admin/sellers/payouts?${params}`);
        const batch = data.payouts || [];
        allPayouts.push(...batch);
        hasMore = batch.length === 100;
        p++;
      }
      const headers = ["Seller", "Email", "Amount (UGX)", "Method", "Status", "Reference", "Requested", "Processed"];
      const rows = allPayouts.map((p) => [
        p.seller?.storeName || p.sellerName || "",
        p.seller?.email || p.sellerEmail || "",
        Number(p.amount),
        p.method,
        p.status,
        p.reference || "",
        new Date(p.createdAt).toLocaleDateString(),
        p.processedAt ? new Date(p.processedAt).toLocaleDateString() : "",
      ]);
      const csv = [headers.join(","), ...rows.map((r) => r.map((v) => `"${v}"`).join(","))].join("\n");
      const blob = new Blob([csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `payouts-export-${new Date().toISOString().split("T")[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
    } finally {
      setExporting(false);
    }
  };

  const statCards = [
    { label: "Pending", value: stats.pendingCount, sub: `UGX ${Number(stats.pendingTotal).toLocaleString()}`, icon: Clock, color: "text-yellow-600 bg-yellow-50" },
    { label: "Processing", value: stats.processingCount, icon: RefreshCw, color: "text-blue-600 bg-blue-50" },
    { label: "Completed (Month)", value: stats.completedThisMonth, icon: CheckCircle, color: "text-green-600 bg-green-50" },
    { label: "Total Disbursed", value: `UGX ${Number(stats.totalDisbursed || 0).toLocaleString()}`, icon: TrendingUp, color: "text-emerald-600 bg-emerald-50" },
  ];

  const pendingActionable = sortedPayouts.filter((p) => p.status === "PENDING" || p.status === "PROCESSING");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Payout Management</h1>
          <p className="text-sm text-gray-500 mt-1">Process seller withdrawal requests</p>
        </div>
        <button
          onClick={exportCSV}
          disabled={exporting}
          className="inline-flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
        >
          <Download className="w-4 h-4" /> {exporting ? "Exporting..." : "Export CSV"}
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {statCards.map((s) => (
          <div key={s.label} className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${s.color}`}><s.icon className="w-4 h-4" /></div>
              <div className="min-w-0">
                <p className="text-xs text-gray-500">{s.label}</p>
                <p className="text-lg font-bold text-gray-900 truncate">{s.value}</p>
                {s.sub && <p className="text-xs text-gray-400">{s.sub}</p>}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 space-y-3">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search by seller name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`inline-flex items-center gap-2 px-3 py-2 border rounded-lg text-sm font-medium transition-colors ${
              showFilters || methodFilter || dateFrom || dateTo ? "border-primary text-primary bg-primary/5" : "border-gray-200 text-gray-600 hover:bg-gray-50"
            }`}
          >
            <Filter className="w-4 h-4" /> Filters
          </button>
        </div>

        {/* Status Tabs */}
        <div className="flex gap-1 overflow-x-auto">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => { setStatusFilter(tab === "All" ? "" : tab); setPage(1); }}
              className={`px-3 py-2 text-xs font-medium rounded-lg whitespace-nowrap transition-colors flex items-center gap-1.5 ${
                (tab === "All" && !statusFilter) || statusFilter === tab
                  ? "bg-primary text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {tab === "All" ? "All" : tab.charAt(0) + tab.slice(1).toLowerCase()}
            </button>
          ))}
        </div>

        {showFilters && (
          <div className="grid grid-cols-3 gap-3 pt-2 border-t border-gray-100">
            <div>
              <label className="text-xs text-gray-500 block mb-1">Payment Method</label>
              <select
                value={methodFilter}
                onChange={(e) => setMethodFilter(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/20"
              >
                <option value="">All Methods</option>
                <option value="MOBILE_MONEY">Mobile Money</option>
                <option value="BANK_TRANSFER">Bank Transfer</option>
                <option value="FLUTTERWAVE">Flutterwave</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">From Date</label>
              <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">To Date</label>
              <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" />
            </div>
          </div>
        )}
      </div>

      {/* Bulk Actions */}
      {selectedIds.size > 0 && (
        <div className="bg-primary/5 border border-primary/20 rounded-xl p-3 flex items-center justify-between">
          <p className="text-sm font-medium text-primary">{selectedIds.size} payout{selectedIds.size !== 1 ? "s" : ""} selected</p>
          <div className="flex items-center gap-2">
            <button
              onClick={handleBulkApprove}
              disabled={bulkProcessing}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white text-xs font-medium rounded-lg hover:bg-green-700 disabled:opacity-50"
            >
              <CheckCircle className="w-3.5 h-3.5" /> {bulkProcessing ? "Processing..." : "Approve All"}
            </button>
            <button onClick={() => setSelectedIds(new Set())} className="px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-100 rounded-lg">Clear</button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
        ) : sortedPayouts.length === 0 ? (
          <div className="text-center py-20">
            <Banknote className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">No payout requests found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-4 py-3 w-10">
                    <input
                      type="checkbox"
                      checked={selectedIds.size === pendingActionable.length && pendingActionable.length > 0}
                      onChange={toggleSelectAll}
                      className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary"
                    />
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">
                    <button onClick={() => toggleSort("sellerName")} className="inline-flex items-center gap-1 hover:text-gray-900">
                      Seller <SortIcon field="sellerName" />
                    </button>
                  </th>
                  <th className="text-right px-4 py-3 font-medium text-gray-500">
                    <button onClick={() => toggleSort("amount")} className="inline-flex items-center gap-1 hover:text-gray-900">
                      Amount <SortIcon field="amount" />
                    </button>
                  </th>
                  <th className="text-center px-4 py-3 font-medium text-gray-500">Method</th>
                  <th className="text-center px-4 py-3 font-medium text-gray-500">Status</th>
                  <th className="text-center px-4 py-3 font-medium text-gray-500">Reference</th>
                  <th className="text-center px-4 py-3 font-medium text-gray-500">
                    <button onClick={() => toggleSort("createdAt")} className="inline-flex items-center gap-1 hover:text-gray-900">
                      Date <SortIcon field="createdAt" />
                    </button>
                  </th>
                  <th className="text-center px-4 py-3 font-medium text-gray-500">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {sortedPayouts.map((payout) => {
                  const name = payout.seller?.storeName || payout.sellerName || "Unknown";
                  const email = payout.seller?.email || payout.sellerEmail || "";
                  const canProcess = payout.status === "PENDING" || payout.status === "PROCESSING";
                  const StatusIcon = statusIcons[payout.status] || Clock;
                  return (
                    <tr key={payout.id} className={`hover:bg-gray-50 transition-colors ${selectedIds.has(payout.id) ? "bg-primary/5" : ""}`}>
                      <td className="px-4 py-3">
                        {canProcess ? (
                          <input
                            type="checkbox"
                            checked={selectedIds.has(payout.id)}
                            onChange={() => toggleSelect(payout.id)}
                            className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary"
                          />
                        ) : <span />}
                      </td>
                      <td className="px-4 py-3">
                        <div>
                          <p className="font-medium text-gray-900">{name}</p>
                          {email && <p className="text-xs text-gray-500">{email}</p>}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-gray-900 whitespace-nowrap">
                        UGX {Number(payout.amount).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="inline-flex items-center gap-1 text-xs text-gray-600">
                          {payout.method === "MOBILE_MONEY" ? <Smartphone className="w-3 h-3" /> : <CreditCard className="w-3 h-3" />}
                          {payout.method === "MOBILE_MONEY" ? "M-Money" : payout.method === "BANK_TRANSFER" ? "Bank" : payout.method}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full ${statusColors[payout.status]}`}>
                          <StatusIcon className="w-3 h-3" />
                          {payout.status.charAt(0) + payout.status.slice(1).toLowerCase()}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {payout.reference ? (
                          <span className="text-xs text-gray-500 font-mono">{payout.reference}</span>
                        ) : (
                          <span className="text-xs text-gray-300">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center text-xs text-gray-500 whitespace-nowrap">
                        {new Date(payout.createdAt).toLocaleDateString()}
                        {payout.processedAt && (
                          <p className="text-[10px] text-green-600">Paid {new Date(payout.processedAt).toLocaleDateString()}</p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          {canProcess && (
                            <button
                              onClick={() => openProcess(payout)}
                              className="px-3 py-1.5 text-xs font-medium text-primary bg-primary/5 hover:bg-primary/10 rounded-lg transition-colors"
                            >
                              Process
                            </button>
                          )}
                          <button
                            onClick={() => setDetailPayout(payout)}
                            className="p-1.5 text-gray-400 hover:bg-gray-100 rounded-lg transition-colors"
                            title="View Details"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
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
          <div className="flex items-center justify-between px-4 py-3 border-t">
            <p className="text-sm text-gray-500">Page {page} of {totalPages}</p>
            <div className="flex items-center gap-1">
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-50">
                <ChevronLeft className="w-4 h-4" />
              </button>
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                const start = Math.max(1, Math.min(page - 2, totalPages - 4));
                const pageNum = start + i;
                if (pageNum > totalPages) return null;
                return (
                  <button key={pageNum} onClick={() => setPage(pageNum)} className={`w-8 h-8 text-xs rounded-lg ${pageNum === page ? "bg-primary text-white" : "hover:bg-gray-100 text-gray-600"}`}>
                    {pageNum}
                  </button>
                );
              })}
              <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-50">
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Detail Modal */}
      {detailPayout && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setDetailPayout(null)}>
          <div className="bg-white rounded-xl max-w-lg w-full" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-6 border-b">
              <h3 className="text-lg font-semibold text-gray-900">Payout Details</h3>
              <button onClick={() => setDetailPayout(null)} className="p-2 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-500">Seller</p>
                  <p className="font-medium text-gray-900">{detailPayout.seller?.storeName || detailPayout.sellerName}</p>
                  <p className="text-xs text-gray-500">{detailPayout.seller?.email || detailPayout.sellerEmail}</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-500">Amount</p>
                  <p className="text-xl font-bold text-gray-900">UGX {Number(detailPayout.amount).toLocaleString()}</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-500">Method</p>
                  <p className="font-medium text-gray-900">{detailPayout.method}</p>
                  {detailPayout.seller?.payoutPhone && <p className="text-xs text-gray-500">{detailPayout.seller.payoutPhone}</p>}
                  {detailPayout.seller?.bankName && <p className="text-xs text-gray-500">{detailPayout.seller.bankName} - {detailPayout.seller.bankAccount}</p>}
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-500">Status</p>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${statusColors[detailPayout.status]}`}>
                    {detailPayout.status}
                  </span>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-500">Requested</p>
                  <p className="text-sm text-gray-700">{new Date(detailPayout.createdAt).toLocaleString()}</p>
                </div>
                {detailPayout.processedAt && (
                  <div className="bg-gray-50 rounded-lg p-3">
                    <p className="text-xs text-gray-500">Processed</p>
                    <p className="text-sm text-gray-700">{new Date(detailPayout.processedAt).toLocaleString()}</p>
                  </div>
                )}
              </div>
              {detailPayout.reference && (
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-500">Reference</p>
                  <p className="text-sm font-mono text-gray-700">{detailPayout.reference}</p>
                </div>
              )}
              {detailPayout.notes && (
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-500">Notes</p>
                  <p className="text-sm text-gray-700">{detailPayout.notes}</p>
                </div>
              )}
              {(detailPayout.status === "PENDING" || detailPayout.status === "PROCESSING") && (
                <button
                  onClick={() => { setDetailPayout(null); openProcess(detailPayout); }}
                  className="w-full py-2.5 bg-primary text-white rounded-lg font-medium hover:bg-primary/90"
                >
                  Process Payout
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Process Payout Modal */}
      {processPayout && (
        <div className="fixed inset-0 bg-black/50 z-[500] flex items-center justify-center p-4" onClick={() => setProcessPayout(null)}>
          <div className="bg-white rounded-2xl max-w-md w-full" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-6 border-b">
              <h3 className="text-lg font-semibold text-gray-900">Process Payout</h3>
              <button onClick={() => setProcessPayout(null)} className="p-2 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-xs text-gray-500">Seller</p>
                    <p className="font-medium text-gray-900">{processPayout.seller?.storeName || processPayout.sellerName}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Amount</p>
                    <p className="font-bold text-gray-900">UGX {Number(processPayout.amount).toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Method</p>
                    <p className="text-gray-700">{processPayout.method}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Requested</p>
                    <p className="text-gray-700">{new Date(processPayout.createdAt).toLocaleDateString()}</p>
                  </div>
                </div>
              </div>

              <div>
                <label className="text-sm text-gray-700 block mb-2">Action</label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setProcessAction("COMPLETED")}
                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium rounded-lg border-2 transition-colors ${
                      processAction === "COMPLETED" ? "border-green-500 bg-green-50 text-green-700" : "border-gray-200 text-gray-600 hover:border-gray-300"
                    }`}
                  >
                    <CheckCircle className="w-4 h-4" /> Approve
                  </button>
                  <button
                    onClick={() => setProcessAction("REJECTED")}
                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium rounded-lg border-2 transition-colors ${
                      processAction === "REJECTED" ? "border-red-500 bg-red-50 text-red-700" : "border-gray-200 text-gray-600 hover:border-gray-300"
                    }`}
                  >
                    <XCircle className="w-4 h-4" /> Reject
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
                  {processPayout.status === "PENDING" && (
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
                <button onClick={() => setProcessPayout(null)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">Cancel</button>
                <button
                  onClick={handleProcess}
                  disabled={processing}
                  className={`px-4 py-2 text-sm font-medium text-white rounded-lg disabled:opacity-50 ${
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
