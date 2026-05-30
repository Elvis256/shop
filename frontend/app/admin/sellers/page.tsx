"use client";

import { useEffect, useState, useCallback } from "react";
import { apiFetch } from "@/lib/api";
import { useRouter } from "next/navigation";
import {
  Search,
  ChevronLeft,
  ChevronRight,
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
  ShieldAlert,
  Download,
  FileText,
  Shield,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  MessageSquare,
  Filter,
  Calendar,
  TrendingUp,
  Banknote,
  ChevronDown,
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
  rating: number;
  reviewCount: number;
  productCount: number;
  orderCount: number;
  totalEarnings: number;
  balance: number;
  warningCount: number;
  tier?: string;
  idDocument?: string;
  businessLicense?: string;
  commissionRate?: number;
  createdAt: string;
}

interface Stats {
  totalSellers: number;
  pendingApproval: number;
  activeSellers: number;
  totalCommissions: number;
  totalSellerRevenue: number;
  pendingPayouts: number;
}

const STATUS_TABS = ["All", "PENDING", "APPROVED", "SUSPENDED", "REJECTED"] as const;

const statusColors: Record<string, string> = {
  PENDING: "bg-yellow-100 text-yellow-800",
  APPROVED: "bg-green-100 text-green-800",
  SUSPENDED: "bg-red-100 text-red-800",
  REJECTED: "bg-gray-100 text-gray-800",
};

const tierColors: Record<string, string> = {
  GOLD: "bg-amber-100 text-amber-700 border-amber-200",
  SILVER: "bg-gray-100 text-gray-600 border-gray-200",
  BRONZE: "bg-orange-100 text-orange-700 border-orange-200",
};

type SortField = "storeName" | "productCount" | "orderCount" | "rating" | "totalEarnings" | "createdAt";
type SortDir = "asc" | "desc";

export default function AdminSellersPage() {
  const router = useRouter();
  const [sellers, setSellers] = useState<Seller[]>([]);
  const [stats, setStats] = useState<Stats>({ totalSellers: 0, pendingApproval: 0, activeSellers: 0, totalCommissions: 0, totalSellerRevenue: 0, pendingPayouts: 0 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Sorting
  const [sortField, setSortField] = useState<SortField>("createdAt");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  // Bulk selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkActioning, setBulkActioning] = useState(false);

  // Action modal
  const [actionModal, setActionModal] = useState<{ seller: Seller; action: "APPROVED" | "SUSPENDED" | "REJECTED" } | null>(null);
  const [bulkActionModal, setBulkActionModal] = useState<{ action: "APPROVED" | "SUSPENDED" | "REJECTED" } | null>(null);
  const [rejectionNote, setRejectionNote] = useState("");
  const [actioning, setActioning] = useState(false);

  // Advanced filters
  const [showFilters, setShowFilters] = useState(false);
  const [kycFilter, setKycFilter] = useState<"" | "verified" | "pending" | "none">("");
  const [tierFilter, setTierFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  // Export
  const [exporting, setExporting] = useState(false);

  const loadStats = useCallback(async () => {
    try {
      const data = await apiFetch("/api/admin/sellers/stats");
      setStats(data);
    } catch {}
  }, []);

  const loadSellers = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: "20" });
      if (statusFilter) params.set("status", statusFilter);
      if (search) params.set("search", search);
      const data = await apiFetch(`/api/admin/sellers?${params}`);
      setSellers(data.sellers || []);
      setTotalPages(data.pagination?.totalPages || data.pagination?.pages || 1);
      setTotalCount(data.pagination?.total || 0);
    } catch {
      setSellers([]);
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, search]);

  useEffect(() => {
    loadSellers();
    loadStats();
  }, [loadSellers, loadStats]);

  // Client-side sorting and filtering
  const filteredSellers = sellers.filter((s) => {
    if (kycFilter === "verified" && !s.idDocument) return false;
    if (kycFilter === "pending" && s.idDocument && s.status !== "APPROVED") return true;
    if (kycFilter === "pending" && !s.idDocument) return false;
    if (kycFilter === "none" && s.idDocument) return false;
    if (tierFilter && s.tier !== tierFilter) return false;
    if (dateFrom && new Date(s.createdAt) < new Date(dateFrom)) return false;
    if (dateTo && new Date(s.createdAt) > new Date(dateTo + "T23:59:59")) return false;
    return true;
  });

  const sortedSellers = [...filteredSellers].sort((a, b) => {
    const dir = sortDir === "asc" ? 1 : -1;
    switch (sortField) {
      case "storeName": return dir * a.storeName.localeCompare(b.storeName);
      case "productCount": return dir * ((a.productCount || 0) - (b.productCount || 0));
      case "orderCount": return dir * ((a.orderCount || 0) - (b.orderCount || 0));
      case "rating": return dir * ((a.rating || 0) - (b.rating || 0));
      case "totalEarnings": return dir * ((a.totalEarnings || 0) - (b.totalEarnings || 0));
      case "createdAt": return dir * (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      default: return 0;
    }
  });

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("desc");
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="w-3 h-3 text-gray-300" />;
    return sortDir === "asc" ? <ArrowUp className="w-3 h-3 text-primary" /> : <ArrowDown className="w-3 h-3 text-primary" />;
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === sortedSellers.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(sortedSellers.map((s) => s.id)));
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

  const handleBulkAction = async () => {
    if (!bulkActionModal || selectedIds.size === 0) return;
    setBulkActioning(true);
    try {
      const promises = Array.from(selectedIds).map((id) => {
        const body: any = { status: bulkActionModal.action };
        if (bulkActionModal.action === "REJECTED" && rejectionNote) body.rejectionNote = rejectionNote;
        return apiFetch(`/api/admin/sellers/${id}/status`, {
          method: "PUT",
          body: JSON.stringify(body),
        });
      });
      await Promise.allSettled(promises);
      setSelectedIds(new Set());
      setBulkActionModal(null);
      setRejectionNote("");
      loadSellers();
      loadStats();
    } catch {
    } finally {
      setBulkActioning(false);
    }
  };

  const exportCSV = async () => {
    setExporting(true);
    try {
      const allSellers: Seller[] = [];
      let p = 1;
      let hasMore = true;
      while (hasMore) {
        const params = new URLSearchParams({ page: String(p), limit: "100" });
        if (statusFilter) params.set("status", statusFilter);
        if (search) params.set("search", search);
        const data = await apiFetch(`/api/admin/sellers?${params}`);
        const batch = data.sellers || [];
        allSellers.push(...batch);
        hasMore = batch.length === 100;
        p++;
      }

      const headers = ["Store Name", "Email", "Phone", "Status", "Tier", "Products", "Orders", "Rating", "Earnings (UGX)", "KYC Status", "Joined"];
      const rows = allSellers.map((s) => [
        s.storeName,
        s.email,
        s.phone || "",
        s.status,
        s.tier || "BRONZE",
        s.productCount,
        s.orderCount,
        Number(s.rating || 0).toFixed(1),
        Number(s.totalEarnings || 0),
        s.idDocument ? "Uploaded" : "Missing",
        new Date(s.createdAt).toLocaleDateString(),
      ]);

      const csv = [headers.join(","), ...rows.map((r) => r.map((v) => `"${v}"`).join(","))].join("\n");
      const blob = new Blob([csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `sellers-export-${new Date().toISOString().split("T")[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
    } finally {
      setExporting(false);
    }
  };

  const statCards = [
    { label: "Total Sellers", value: stats.totalSellers, icon: Users, color: "text-blue-600 bg-blue-50" },
    { label: "Pending Approval", value: stats.pendingApproval, icon: Clock, color: "text-yellow-600 bg-yellow-50", onClick: () => { setStatusFilter("PENDING"); setPage(1); } },
    { label: "Active Sellers", value: stats.activeSellers, icon: Store, color: "text-green-600 bg-green-50", onClick: () => { setStatusFilter("APPROVED"); setPage(1); } },
    { label: "Seller Revenue", value: `UGX ${Number(stats.totalSellerRevenue || 0).toLocaleString()}`, icon: TrendingUp, color: "text-emerald-600 bg-emerald-50" },
    { label: "Total Commissions", value: `UGX ${Number(stats.totalCommissions || 0).toLocaleString()}`, icon: DollarSign, color: "text-purple-600 bg-purple-50" },
    { label: "Pending Payouts", value: `UGX ${Number(stats.pendingPayouts || 0).toLocaleString()}`, icon: Banknote, color: "text-orange-600 bg-orange-50" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Seller Management</h1>
          <p className="text-sm text-gray-500 mt-1">{totalCount} seller{totalCount !== 1 ? "s" : ""} registered</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={exportCSV}
            disabled={exporting}
            className="inline-flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            {exporting ? "Exporting..." : "Export CSV"}
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {statCards.map((s) => (
          <div
            key={s.label}
            className={`bg-white rounded-xl shadow-sm border border-gray-100 p-4 ${s.onClick ? "cursor-pointer hover:shadow-md transition-shadow" : ""}`}
            onClick={s.onClick}
          >
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${s.color}`}>
                <s.icon className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-gray-500 truncate">{s.label}</p>
                <p className="text-lg font-bold text-gray-900 truncate">{s.value}</p>
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
              placeholder="Search by store name, email, or phone..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`inline-flex items-center gap-2 px-3 py-2 border rounded-lg text-sm font-medium transition-colors ${
              showFilters || kycFilter || tierFilter || dateFrom || dateTo
                ? "border-primary text-primary bg-primary/5"
                : "border-gray-200 text-gray-600 hover:bg-gray-50"
            }`}
          >
            <Filter className="w-4 h-4" />
            Filters
            {(kycFilter || tierFilter || dateFrom || dateTo) && (
              <span className="w-5 h-5 rounded-full bg-primary text-white text-xs flex items-center justify-center">
                {[kycFilter, tierFilter, dateFrom, dateTo].filter(Boolean).length}
              </span>
            )}
          </button>
        </div>

        {/* Status Tabs */}
        <div className="flex gap-1 overflow-x-auto">
          {STATUS_TABS.map((tab) => {
            const count = tab === "All" ? totalCount : tab === "PENDING" ? stats.pendingApproval : tab === "APPROVED" ? stats.activeSellers : undefined;
            return (
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
                {count !== undefined && (
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                    (tab === "All" && !statusFilter) || statusFilter === tab
                      ? "bg-white/20"
                      : "bg-gray-200"
                  }`}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Advanced Filters */}
        {showFilters && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-gray-100">
            <div>
              <label className="text-xs text-gray-500 block mb-1">KYC Status</label>
              <select
                value={kycFilter}
                onChange={(e) => setKycFilter(e.target.value as any)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/20"
              >
                <option value="">All</option>
                <option value="verified">Documents Uploaded</option>
                <option value="none">No Documents</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Seller Tier</label>
              <select
                value={tierFilter}
                onChange={(e) => setTierFilter(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/20"
              >
                <option value="">All Tiers</option>
                <option value="GOLD">Gold</option>
                <option value="SILVER">Silver</option>
                <option value="BRONZE">Bronze</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Joined From</label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Joined To</label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
            {(kycFilter || tierFilter || dateFrom || dateTo) && (
              <div className="col-span-full">
                <button
                  onClick={() => { setKycFilter(""); setTierFilter(""); setDateFrom(""); setDateTo(""); }}
                  className="text-xs text-primary hover:underline"
                >
                  Clear all filters
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Bulk Actions Bar */}
      {selectedIds.size > 0 && (
        <div className="bg-primary/5 border border-primary/20 rounded-xl p-3 flex items-center justify-between">
          <p className="text-sm font-medium text-primary">
            {selectedIds.size} seller{selectedIds.size !== 1 ? "s" : ""} selected
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setBulkActionModal({ action: "APPROVED" })}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white text-xs font-medium rounded-lg hover:bg-green-700 transition-colors"
            >
              <CheckCircle className="w-3.5 h-3.5" /> Approve
            </button>
            <button
              onClick={() => setBulkActionModal({ action: "SUSPENDED" })}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-orange-600 text-white text-xs font-medium rounded-lg hover:bg-orange-700 transition-colors"
            >
              <AlertTriangle className="w-3.5 h-3.5" /> Suspend
            </button>
            <button
              onClick={() => setBulkActionModal({ action: "REJECTED" })}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-600 text-white text-xs font-medium rounded-lg hover:bg-red-700 transition-colors"
            >
              <XCircle className="w-3.5 h-3.5" /> Reject
            </button>
            <button
              onClick={() => setSelectedIds(new Set())}
              className="px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            >
              Clear
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : sortedSellers.length === 0 ? (
          <div className="text-center py-20">
            <Store className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">No sellers found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-4 py-3 w-10">
                    <input
                      type="checkbox"
                      checked={selectedIds.size === sortedSellers.length && sortedSellers.length > 0}
                      onChange={toggleSelectAll}
                      className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary"
                    />
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">
                    <button onClick={() => toggleSort("storeName")} className="inline-flex items-center gap-1 hover:text-gray-900">
                      Store <SortIcon field="storeName" />
                    </button>
                  </th>
                  <th className="text-center px-4 py-3 font-medium text-gray-500">KYC</th>
                  <th className="text-center px-4 py-3 font-medium text-gray-500">
                    <button onClick={() => toggleSort("productCount")} className="inline-flex items-center gap-1 hover:text-gray-900">
                      Products <SortIcon field="productCount" />
                    </button>
                  </th>
                  <th className="text-center px-4 py-3 font-medium text-gray-500">
                    <button onClick={() => toggleSort("orderCount")} className="inline-flex items-center gap-1 hover:text-gray-900">
                      Orders <SortIcon field="orderCount" />
                    </button>
                  </th>
                  <th className="text-center px-4 py-3 font-medium text-gray-500">
                    <button onClick={() => toggleSort("rating")} className="inline-flex items-center gap-1 hover:text-gray-900">
                      Rating <SortIcon field="rating" />
                    </button>
                  </th>
                  <th className="text-right px-4 py-3 font-medium text-gray-500">
                    <button onClick={() => toggleSort("totalEarnings")} className="inline-flex items-center gap-1 hover:text-gray-900">
                      Earnings <SortIcon field="totalEarnings" />
                    </button>
                  </th>
                  <th className="text-center px-4 py-3 font-medium text-gray-500">Status</th>
                  <th className="text-center px-4 py-3 font-medium text-gray-500">
                    <button onClick={() => toggleSort("createdAt")} className="inline-flex items-center gap-1 hover:text-gray-900">
                      Joined <SortIcon field="createdAt" />
                    </button>
                  </th>
                  <th className="text-center px-4 py-3 font-medium text-gray-500">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {sortedSellers.map((seller) => (
                  <tr
                    key={seller.id}
                    className={`hover:bg-gray-50 cursor-pointer transition-colors ${selectedIds.has(seller.id) ? "bg-primary/5" : ""}`}
                    onClick={() => router.push(`/admin/sellers/${seller.id}`)}
                  >
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selectedIds.has(seller.id)}
                        onChange={() => toggleSelect(seller.id)}
                        className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {seller.storeLogo ? (
                          <img src={seller.storeLogo.startsWith("/") ? `${process.env.NEXT_PUBLIC_API_URL || ""}${seller.storeLogo}` : seller.storeLogo} alt="" className="w-9 h-9 rounded-lg object-cover border border-gray-200" />
                        ) : (
                          <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                            <Store className="w-4 h-4 text-primary" />
                          </div>
                        )}
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-gray-900 truncate">{seller.storeName}</span>
                            {seller.tier && seller.tier !== "BRONZE" && (
                              <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${tierColors[seller.tier] || ""}`}>
                                {seller.tier}
                              </span>
                            )}
                            {seller.warningCount > 0 && (
                              <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-red-600 bg-red-50 px-1.5 py-0.5 rounded-full">
                                <ShieldAlert className="w-3 h-3" /> {seller.warningCount}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-gray-500 truncate">{seller.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {seller.idDocument ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-medium text-green-700 bg-green-50 px-2 py-0.5 rounded-full" title="Documents uploaded">
                          <Shield className="w-3 h-3" /> KYC
                        </span>
                      ) : (
                        <span className="text-[10px] text-gray-400">None</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center text-gray-600">{seller.productCount}</td>
                    <td className="px-4 py-3 text-center text-gray-600">{seller.orderCount}</td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <Star className="w-3.5 h-3.5 fill-yellow-400 text-yellow-400" />
                        <span className="text-gray-700">{Number(seller.rating || 0).toFixed(1)}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right text-gray-700 font-medium whitespace-nowrap">
                      UGX {Number(seller.totalEarnings || 0).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${statusColors[seller.status]}`}>
                        {seller.status.charAt(0) + seller.status.slice(1).toLowerCase()}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center text-xs text-gray-500 whitespace-nowrap">
                      {new Date(seller.createdAt).toLocaleDateString()}
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
                          onClick={() => router.push(`/admin/sellers/${seller.id}`)}
                          className="p-1.5 text-gray-500 hover:bg-gray-100 rounded-lg transition-colors"
                          title="View Details"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => router.push(`/admin/messages?seller=${seller.id}`)}
                          className="p-1.5 text-blue-500 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Message Seller"
                        >
                          <MessageSquare className="w-4 h-4" />
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
            <p className="text-sm text-gray-500">
              Showing {(page - 1) * 20 + 1}-{Math.min(page * 20, totalCount)} of {totalCount}
            </p>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage(1)}
                disabled={page === 1}
                className="px-2 py-1 text-xs rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                First
              </button>
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                const start = Math.max(1, Math.min(page - 2, totalPages - 4));
                const pageNum = start + i;
                if (pageNum > totalPages) return null;
                return (
                  <button
                    key={pageNum}
                    onClick={() => setPage(pageNum)}
                    className={`w-8 h-8 text-xs rounded-lg transition-colors ${
                      pageNum === page ? "bg-primary text-white" : "hover:bg-gray-100 text-gray-600"
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              })}
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
              <button
                onClick={() => setPage(totalPages)}
                disabled={page === totalPages}
                className="px-2 py-1 text-xs rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Last
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Single Action Modal */}
      {actionModal && (
        <div className="fixed inset-0 bg-black/50 z-[600] flex items-center justify-center p-4" onClick={() => setActionModal(null)}>
          <div className="bg-white rounded-2xl max-w-md w-full" onClick={(e) => e.stopPropagation()}>
            <div className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                {actionModal.action === "APPROVED" && "Approve Seller"}
                {actionModal.action === "SUSPENDED" && "Suspend Seller"}
                {actionModal.action === "REJECTED" && "Reject Seller"}
              </h3>

              <div className="bg-gray-50 rounded-lg p-4 mb-4">
                <div className="flex items-center gap-3">
                  {actionModal.seller.storeLogo ? (
                    <img src={actionModal.seller.storeLogo.startsWith("/") ? `${process.env.NEXT_PUBLIC_API_URL || ""}${actionModal.seller.storeLogo}` : actionModal.seller.storeLogo} alt="" className="w-10 h-10 rounded-lg object-cover" />
                  ) : (
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Store className="w-5 h-5 text-primary" />
                    </div>
                  )}
                  <div>
                    <p className="font-medium text-gray-900">{actionModal.seller.storeName}</p>
                    <p className="text-xs text-gray-500">{actionModal.seller.email}</p>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3 mt-3 text-xs">
                  <div><span className="text-gray-400">Products:</span> <span className="font-medium">{actionModal.seller.productCount}</span></div>
                  <div><span className="text-gray-400">Orders:</span> <span className="font-medium">{actionModal.seller.orderCount}</span></div>
                  <div><span className="text-gray-400">KYC:</span> <span className="font-medium">{actionModal.seller.idDocument ? "Uploaded" : "None"}</span></div>
                </div>
              </div>

              {(actionModal.action === "REJECTED" || actionModal.action === "SUSPENDED") && (
                <div className="mb-4">
                  <label className="text-sm text-gray-700 block mb-1">
                    {actionModal.action === "REJECTED" ? "Rejection Note" : "Suspension Reason"}
                  </label>
                  <textarea
                    value={rejectionNote}
                    onChange={(e) => setRejectionNote(e.target.value)}
                    rows={3}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                    placeholder={actionModal.action === "REJECTED" ? "Reason for rejection..." : "Reason for suspension..."}
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

      {/* Bulk Action Modal */}
      {bulkActionModal && (
        <div className="fixed inset-0 bg-black/50 z-[600] flex items-center justify-center p-4" onClick={() => setBulkActionModal(null)}>
          <div className="bg-white rounded-2xl max-w-md w-full" onClick={(e) => e.stopPropagation()}>
            <div className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Bulk {bulkActionModal.action === "APPROVED" ? "Approve" : bulkActionModal.action === "SUSPENDED" ? "Suspend" : "Reject"}
              </h3>
              <p className="text-sm text-gray-600 mb-4">
                This will {bulkActionModal.action.toLowerCase()} <strong>{selectedIds.size} seller{selectedIds.size !== 1 ? "s" : ""}</strong>.
              </p>

              {(bulkActionModal.action === "REJECTED" || bulkActionModal.action === "SUSPENDED") && (
                <div className="mb-4">
                  <label className="text-sm text-gray-700 block mb-1">Reason</label>
                  <textarea
                    value={rejectionNote}
                    onChange={(e) => setRejectionNote(e.target.value)}
                    rows={3}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                    placeholder="Reason for this action..."
                  />
                </div>
              )}

              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => { setBulkActionModal(null); setRejectionNote(""); }}
                  className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleBulkAction}
                  disabled={bulkActioning}
                  className={`px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors disabled:opacity-50 ${
                    bulkActionModal.action === "APPROVED" ? "bg-green-600 hover:bg-green-700" :
                    bulkActionModal.action === "SUSPENDED" ? "bg-orange-600 hover:bg-orange-700" :
                    "bg-red-600 hover:bg-red-700"
                  }`}
                >
                  {bulkActioning ? "Processing..." : `Confirm (${selectedIds.size})`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
