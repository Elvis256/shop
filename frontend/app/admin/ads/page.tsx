"use client";

import { useEffect, useState, useCallback } from "react";
import { apiFetch } from "@/lib/api";
import {
  Zap,
  TrendingUp,
  BarChart3,
  AlertTriangle,
  Loader2,
  Search,
  Filter,
  Download,
  ChevronLeft,
  ChevronRight,
  Eye,
  Pause,
  Play,
  XCircle,
  DollarSign,
  Calendar,
  Store,
  Package,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  X,
  Clock,
  Target,
  Activity,
  ExternalLink,
} from "lucide-react";

interface Stats {
  totalRevenue: number;
  totalCampaigns: number;
  activeCampaigns: number;
  monthlyRevenue: number;
  revenueByTier: Array<{ tier: string; spent: number; count: number }>;
}

interface Campaign {
  id: string;
  sellerName: string;
  sellerId: string;
  productName: string;
  productSlug: string;
  tier: string;
  status: string;
  startDate: string;
  endDate: string;
  dailyRate: number;
  totalBudget: number;
  spent: number;
  impressions?: number;
  clicks?: number;
  conversions?: number;
  createdAt: string;
}

const tierColors: Record<string, string> = {
  BASIC: "bg-blue-100 text-blue-700",
  PREMIUM: "bg-purple-100 text-purple-700",
  VIP: "bg-amber-100 text-amber-700",
};

const statusColors: Record<string, string> = {
  ACTIVE: "bg-green-100 text-green-700",
  PAUSED: "bg-yellow-100 text-yellow-700",
  EXPIRED: "bg-gray-100 text-gray-600",
  CANCELLED: "bg-red-100 text-red-600",
  PENDING: "bg-blue-100 text-blue-700",
};

const statusIcons: Record<string, any> = {
  ACTIVE: Play,
  PAUSED: Pause,
  EXPIRED: Clock,
  CANCELLED: XCircle,
  PENDING: Clock,
};

type SortField = "sellerName" | "spent" | "totalBudget" | "startDate" | "dailyRate";
type SortDir = "asc" | "desc";

export default function AdminAdsPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [tierFilter, setTierFilter] = useState("");
  const [search, setSearch] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  // Sorting
  const [sortField, setSortField] = useState<SortField>("startDate");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  // Detail modal
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);

  // Action
  const [actioning, setActioning] = useState(false);

  // Exporting
  const [exporting, setExporting] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const params = new URLSearchParams();
      if (statusFilter) params.set("status", statusFilter);
      params.set("limit", "100");

      const [statsRes, campaignsRes] = await Promise.all([
        apiFetch("/api/admin/ads/stats").catch(() => null),
        apiFetch(`/api/admin/ads/campaigns?${params}`).catch(() => ({ campaigns: [] })),
      ]);
      if (statsRes) setStats(statsRes);
      setCampaigns(campaignsRes.campaigns || []);
    } catch (err: any) {
      setError(err.message || "Failed to load data");
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Client-side filtering and sorting
  const filteredCampaigns = campaigns.filter((c) => {
    if (search) {
      const q = search.toLowerCase();
      if (!c.sellerName.toLowerCase().includes(q) && !c.productName.toLowerCase().includes(q)) return false;
    }
    if (tierFilter && c.tier !== tierFilter) return false;
    if (dateFrom && new Date(c.startDate) < new Date(dateFrom)) return false;
    if (dateTo && new Date(c.endDate) > new Date(dateTo + "T23:59:59")) return false;
    return true;
  });

  const sortedCampaigns = [...filteredCampaigns].sort((a, b) => {
    const dir = sortDir === "asc" ? 1 : -1;
    switch (sortField) {
      case "sellerName": return dir * a.sellerName.localeCompare(b.sellerName);
      case "spent": return dir * (a.spent - b.spent);
      case "totalBudget": return dir * (a.totalBudget - b.totalBudget);
      case "startDate": return dir * (new Date(a.startDate).getTime() - new Date(b.startDate).getTime());
      case "dailyRate": return dir * (a.dailyRate - b.dailyRate);
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

  const handleCampaignAction = async (campaignId: string, action: string) => {
    setActioning(true);
    try {
      await apiFetch(`/api/admin/ads/campaigns/${campaignId}/${action}`, { method: "PUT" });
      fetchData();
      setSelectedCampaign(null);
    } catch {
    } finally {
      setActioning(false);
    }
  };

  const exportCSV = () => {
    setExporting(true);
    try {
      const headers = ["Seller", "Product", "Tier", "Status", "Start Date", "End Date", "Daily Rate", "Budget", "Spent", "Impressions", "Clicks"];
      const rows = filteredCampaigns.map((c) => [
        c.sellerName, c.productName, c.tier, c.status,
        new Date(c.startDate).toLocaleDateString(), new Date(c.endDate).toLocaleDateString(),
        c.dailyRate, c.totalBudget, c.spent, c.impressions || 0, c.clicks || 0,
      ]);
      const csv = [headers.join(","), ...rows.map((r) => r.map((v) => `"${v}"`).join(","))].join("\n");
      const blob = new Blob([csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `ad-campaigns-${new Date().toISOString().split("T")[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  };

  const getDaysRemaining = (endDate: string) => {
    const diff = Math.ceil((new Date(endDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    return diff > 0 ? diff : 0;
  };

  const getBudgetPercent = (spent: number, budget: number) => {
    if (budget <= 0) return 0;
    return Math.min(Math.round((spent / budget) * 100), 100);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error && !stats) {
    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold text-gray-900">Ad Revenue</h2>
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
          <AlertTriangle className="w-8 h-8 text-red-400 mx-auto mb-3" />
          <p className="text-red-700 font-medium">{error}</p>
          <p className="text-sm text-red-500 mt-1">The ad revenue API may not be configured yet. Check your backend endpoints.</p>
          <button onClick={fetchData} className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700">
            Retry
          </button>
        </div>
      </div>
    );
  }

  const statusCounts = {
    ACTIVE: campaigns.filter((c) => c.status === "ACTIVE").length,
    PAUSED: campaigns.filter((c) => c.status === "PAUSED").length,
    EXPIRED: campaigns.filter((c) => c.status === "EXPIRED").length,
    CANCELLED: campaigns.filter((c) => c.status === "CANCELLED").length,
    PENDING: campaigns.filter((c) => c.status === "PENDING").length,
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Ad Revenue</h1>
          <p className="text-sm text-gray-500 mt-1">Manage sponsored ads and promoted listings</p>
        </div>
        <button
          onClick={exportCSV}
          disabled={exporting}
          className="inline-flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
        >
          <Download className="w-4 h-4" /> Export
        </button>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 bg-green-50 rounded-lg flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-green-600" />
              </div>
            </div>
            <p className="text-2xl font-bold text-gray-900">UGX {stats.totalRevenue.toLocaleString()}</p>
            <p className="text-sm text-gray-500 mt-1">Total Ad Revenue</p>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center">
                <Zap className="w-5 h-5 text-blue-600" />
              </div>
            </div>
            <p className="text-2xl font-bold text-gray-900">{stats.activeCampaigns}</p>
            <p className="text-sm text-gray-500 mt-1">Active Campaigns</p>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 bg-purple-50 rounded-lg flex items-center justify-center">
                <DollarSign className="w-5 h-5 text-purple-600" />
              </div>
            </div>
            <p className="text-2xl font-bold text-gray-900">UGX {stats.monthlyRevenue.toLocaleString()}</p>
            <p className="text-sm text-gray-500 mt-1">Revenue This Month</p>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 bg-amber-50 rounded-lg flex items-center justify-center">
                <BarChart3 className="w-5 h-5 text-amber-600" />
              </div>
            </div>
            <p className="text-2xl font-bold text-gray-900">{stats.totalCampaigns}</p>
            <p className="text-sm text-gray-500 mt-1">Total Campaigns</p>
          </div>
        </div>
      )}

      {/* Revenue by Tier */}
      {stats && stats.revenueByTier.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Revenue by Tier</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {stats.revenueByTier.map((t) => {
              const pct = stats.totalRevenue > 0 ? Math.round((t.spent / stats.totalRevenue) * 100) : 0;
              return (
                <div key={t.tier} className="p-4 bg-gray-50 rounded-xl">
                  <div className="flex items-center justify-between mb-3">
                    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${tierColors[t.tier]}`}>{t.tier}</span>
                    <span className="text-xs text-gray-500">{t.count} campaign{t.count !== 1 ? "s" : ""}</span>
                  </div>
                  <p className="text-xl font-bold text-gray-900">UGX {t.spent.toLocaleString()}</p>
                  <div className="mt-2">
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full ${t.tier === "VIP" ? "bg-amber-500" : t.tier === "PREMIUM" ? "bg-purple-500" : "bg-blue-500"}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <p className="text-xs text-gray-500 mt-1">{pct}% of total revenue</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 space-y-3">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by seller or product..."
              className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`inline-flex items-center gap-2 px-3 py-2 border rounded-lg text-sm font-medium transition-colors ${
              showFilters || tierFilter || dateFrom || dateTo ? "border-primary text-primary bg-primary/5" : "border-gray-200 text-gray-600 hover:bg-gray-50"
            }`}
          >
            <Filter className="w-4 h-4" /> Filters
          </button>
        </div>

        {/* Status Tabs */}
        <div className="flex gap-1 overflow-x-auto">
          {["", "ACTIVE", "PENDING", "PAUSED", "EXPIRED", "CANCELLED"].map((s) => {
            const count = s ? statusCounts[s as keyof typeof statusCounts] || 0 : campaigns.length;
            return (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-3 py-2 text-xs font-medium rounded-lg whitespace-nowrap transition-colors flex items-center gap-1.5 ${
                  statusFilter === s ? "bg-primary text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {s || "All"}
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${statusFilter === s ? "bg-white/20" : "bg-gray-200"}`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {showFilters && (
          <div className="grid grid-cols-3 gap-3 pt-2 border-t border-gray-100">
            <div>
              <label className="text-xs text-gray-500 block mb-1">Tier</label>
              <select
                value={tierFilter}
                onChange={(e) => setTierFilter(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/20"
              >
                <option value="">All Tiers</option>
                <option value="BASIC">Basic</option>
                <option value="PREMIUM">Premium</option>
                <option value="VIP">VIP</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Start After</label>
              <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">End Before</label>
              <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" />
            </div>
          </div>
        )}
      </div>

      {/* Campaigns Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {sortedCampaigns.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <Zap className="w-10 h-10 mx-auto mb-3 text-gray-300" />
            <p className="font-medium text-gray-500">No campaigns found</p>
            <p className="text-sm mt-1">Campaigns will appear here when sellers promote their products</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">
                    <button onClick={() => toggleSort("sellerName")} className="inline-flex items-center gap-1 hover:text-gray-900">
                      Seller / Product <SortIcon field="sellerName" />
                    </button>
                  </th>
                  <th className="text-center px-4 py-3 font-medium text-gray-500">Tier</th>
                  <th className="text-center px-4 py-3 font-medium text-gray-500">Status</th>
                  <th className="text-center px-4 py-3 font-medium text-gray-500">
                    <button onClick={() => toggleSort("startDate")} className="inline-flex items-center gap-1 hover:text-gray-900">
                      Period <SortIcon field="startDate" />
                    </button>
                  </th>
                  <th className="text-right px-4 py-3 font-medium text-gray-500">
                    <button onClick={() => toggleSort("dailyRate")} className="inline-flex items-center gap-1 hover:text-gray-900">
                      Daily <SortIcon field="dailyRate" />
                    </button>
                  </th>
                  <th className="text-center px-4 py-3 font-medium text-gray-500">Budget Used</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-500">
                    <button onClick={() => toggleSort("spent")} className="inline-flex items-center gap-1 hover:text-gray-900">
                      Spent <SortIcon field="spent" />
                    </button>
                  </th>
                  <th className="text-center px-4 py-3 font-medium text-gray-500">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {sortedCampaigns.map((c) => {
                  const budgetPct = getBudgetPercent(c.spent, c.totalBudget);
                  const daysLeft = getDaysRemaining(c.endDate);
                  const StatusIcon = statusIcons[c.status] || Clock;
                  return (
                    <tr key={c.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3">
                        <div>
                          <p className="font-medium text-gray-900">{c.sellerName}</p>
                          <p className="text-xs text-gray-500 flex items-center gap-1">
                            <Package className="w-3 h-3" /> {c.productName}
                          </p>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${tierColors[c.tier]}`}>{c.tier}</span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full ${statusColors[c.status]}`}>
                          <StatusIcon className="w-3 h-3" />
                          {c.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center text-xs text-gray-600">
                        <div>
                          {new Date(c.startDate).toLocaleDateString()} - {new Date(c.endDate).toLocaleDateString()}
                          {c.status === "ACTIVE" && daysLeft > 0 && (
                            <p className="text-[10px] text-primary font-medium mt-0.5">{daysLeft} day{daysLeft !== 1 ? "s" : ""} left</p>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right text-gray-700 whitespace-nowrap">
                        UGX {c.dailyRate.toLocaleString()}/day
                      </td>
                      <td className="px-4 py-3">
                        <div className="w-full max-w-[100px] mx-auto">
                          <div className="flex items-center justify-between text-xs mb-1">
                            <span className="text-gray-500">{budgetPct}%</span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-1.5">
                            <div
                              className={`h-1.5 rounded-full transition-all ${budgetPct > 90 ? "bg-red-500" : budgetPct > 70 ? "bg-yellow-500" : "bg-green-500"}`}
                              style={{ width: `${budgetPct}%` }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-gray-900 whitespace-nowrap">
                        UGX {c.spent.toLocaleString()}
                        <p className="text-[10px] text-gray-400 font-normal">of {c.totalBudget.toLocaleString()}</p>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => setSelectedCampaign(c)}
                            className="p-1.5 text-gray-500 hover:bg-gray-100 rounded-lg transition-colors"
                            title="View Details"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          {c.status === "ACTIVE" && (
                            <button
                              onClick={() => handleCampaignAction(c.id, "pause")}
                              className="p-1.5 text-yellow-600 hover:bg-yellow-50 rounded-lg transition-colors"
                              title="Pause"
                            >
                              <Pause className="w-4 h-4" />
                            </button>
                          )}
                          {c.status === "PAUSED" && (
                            <button
                              onClick={() => handleCampaignAction(c.id, "resume")}
                              className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                              title="Resume"
                            >
                              <Play className="w-4 h-4" />
                            </button>
                          )}
                          {(c.status === "ACTIVE" || c.status === "PAUSED") && (
                            <button
                              onClick={() => handleCampaignAction(c.id, "cancel")}
                              className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                              title="Cancel"
                            >
                              <XCircle className="w-4 h-4" />
                            </button>
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
      </div>

      {/* Campaign Detail Modal */}
      {selectedCampaign && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setSelectedCampaign(null)}>
          <div className="bg-white rounded-xl max-w-lg w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-6 border-b">
              <h3 className="text-lg font-semibold text-gray-900">Campaign Details</h3>
              <button onClick={() => setSelectedCampaign(null)} className="p-2 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-5">
              {/* Campaign Info */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Seller</p>
                  <p className="font-semibold text-gray-900">{selectedCampaign.sellerName}</p>
                </div>
                <span className={`text-xs font-semibold px-3 py-1 rounded-full ${tierColors[selectedCampaign.tier]}`}>
                  {selectedCampaign.tier}
                </span>
              </div>

              <div>
                <p className="text-sm text-gray-500">Product</p>
                <p className="font-medium text-gray-900 flex items-center gap-1">
                  <Package className="w-4 h-4 text-gray-400" />
                  {selectedCampaign.productName}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-500">Status</p>
                  <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full mt-1 ${statusColors[selectedCampaign.status]}`}>
                    {selectedCampaign.status}
                  </span>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-500">Daily Rate</p>
                  <p className="font-semibold text-gray-900">UGX {selectedCampaign.dailyRate.toLocaleString()}</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-500">Total Budget</p>
                  <p className="font-semibold text-gray-900">UGX {selectedCampaign.totalBudget.toLocaleString()}</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-500">Amount Spent</p>
                  <p className="font-semibold text-gray-900">UGX {selectedCampaign.spent.toLocaleString()}</p>
                </div>
              </div>

              {/* Budget Progress */}
              <div>
                <div className="flex items-center justify-between text-sm mb-1">
                  <span className="text-gray-500">Budget Usage</span>
                  <span className="font-medium text-gray-900">{getBudgetPercent(selectedCampaign.spent, selectedCampaign.totalBudget)}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2.5">
                  <div
                    className={`h-2.5 rounded-full ${getBudgetPercent(selectedCampaign.spent, selectedCampaign.totalBudget) > 90 ? "bg-red-500" : "bg-green-500"}`}
                    style={{ width: `${getBudgetPercent(selectedCampaign.spent, selectedCampaign.totalBudget)}%` }}
                  />
                </div>
              </div>

              {/* Duration */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-500 flex items-center gap-1"><Calendar className="w-3 h-3" /> Start Date</p>
                  <p className="text-sm text-gray-900 mt-1">{new Date(selectedCampaign.startDate).toLocaleDateString()}</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-500 flex items-center gap-1"><Calendar className="w-3 h-3" /> End Date</p>
                  <p className="text-sm text-gray-900 mt-1">{new Date(selectedCampaign.endDate).toLocaleDateString()}</p>
                  {selectedCampaign.status === "ACTIVE" && (
                    <p className="text-xs text-primary font-medium mt-0.5">{getDaysRemaining(selectedCampaign.endDate)} days remaining</p>
                  )}
                </div>
              </div>

              {/* Performance Metrics */}
              {(selectedCampaign.impressions || selectedCampaign.clicks || selectedCampaign.conversions) && (
                <div>
                  <p className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-1"><Activity className="w-4 h-4" /> Performance</p>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="bg-blue-50 rounded-lg p-3 text-center">
                      <p className="text-lg font-bold text-blue-700">{(selectedCampaign.impressions || 0).toLocaleString()}</p>
                      <p className="text-xs text-blue-500">Impressions</p>
                    </div>
                    <div className="bg-green-50 rounded-lg p-3 text-center">
                      <p className="text-lg font-bold text-green-700">{(selectedCampaign.clicks || 0).toLocaleString()}</p>
                      <p className="text-xs text-green-500">Clicks</p>
                    </div>
                    <div className="bg-purple-50 rounded-lg p-3 text-center">
                      <p className="text-lg font-bold text-purple-700">
                        {selectedCampaign.impressions && selectedCampaign.clicks
                          ? ((selectedCampaign.clicks / selectedCampaign.impressions) * 100).toFixed(1) + "%"
                          : "—"
                        }
                      </p>
                      <p className="text-xs text-purple-500">CTR</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2 pt-2 border-t">
                {selectedCampaign.status === "ACTIVE" && (
                  <button
                    onClick={() => handleCampaignAction(selectedCampaign.id, "pause")}
                    disabled={actioning}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-yellow-500 text-white rounded-lg text-sm font-medium hover:bg-yellow-600 disabled:opacity-50"
                  >
                    <Pause className="w-4 h-4" /> Pause
                  </button>
                )}
                {selectedCampaign.status === "PAUSED" && (
                  <button
                    onClick={() => handleCampaignAction(selectedCampaign.id, "resume")}
                    disabled={actioning}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50"
                  >
                    <Play className="w-4 h-4" /> Resume
                  </button>
                )}
                {(selectedCampaign.status === "ACTIVE" || selectedCampaign.status === "PAUSED") && (
                  <button
                    onClick={() => handleCampaignAction(selectedCampaign.id, "cancel")}
                    disabled={actioning}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50"
                  >
                    <XCircle className="w-4 h-4" /> Cancel
                  </button>
                )}
                <button
                  onClick={() => setSelectedCampaign(null)}
                  className="px-4 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
