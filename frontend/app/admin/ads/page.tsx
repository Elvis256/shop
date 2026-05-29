"use client";

import { useEffect, useState, useCallback } from "react";
import { apiFetch } from "@/lib/api";
import { Zap, TrendingUp, BarChart3, AlertTriangle } from "lucide-react";

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
};

export default function AdminAdsPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (statusFilter) params.set("status", statusFilter);
      params.set("limit", "50");

      const [statsRes, campaignsRes] = await Promise.all([
        apiFetch("/api/admin/ads/stats"),
        apiFetch(`/api/admin/ads/campaigns?${params}`),
      ]);
      setStats(statsRes);
      setCampaigns(campaignsRes.campaigns || []);
    } catch (err: any) {
      setError(err.message || "Failed to load data");
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-20 text-red-600">
        <AlertTriangle className="w-5 h-5 mr-2" /> {error}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-gray-900">Ad Revenue</h2>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 bg-green-50 rounded-lg flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-green-600" />
              </div>
            </div>
            <p className="text-2xl font-bold text-gray-900">UGX {stats.totalRevenue.toLocaleString()}</p>
            <p className="text-sm text-gray-500 mt-1">Total Ad Revenue</p>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center">
                <Zap className="w-5 h-5 text-blue-600" />
              </div>
            </div>
            <p className="text-2xl font-bold text-gray-900">{stats.activeCampaigns}</p>
            <p className="text-sm text-gray-500 mt-1">Active Campaigns</p>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 bg-purple-50 rounded-lg flex items-center justify-center">
                <BarChart3 className="w-5 h-5 text-purple-600" />
              </div>
            </div>
            <p className="text-2xl font-bold text-gray-900">UGX {stats.monthlyRevenue.toLocaleString()}</p>
            <p className="text-sm text-gray-500 mt-1">Revenue This Month</p>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <div className="flex items-center gap-3 mb-3">
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
            {stats.revenueByTier.map((t) => (
              <div key={t.tier} className="p-4 bg-gray-50 rounded-xl">
                <div className="flex items-center justify-between mb-2">
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${tierColors[t.tier]}`}>
                    {t.tier}
                  </span>
                  <span className="text-xs text-gray-500">{t.count} campaigns</span>
                </div>
                <p className="text-xl font-bold text-gray-900">UGX {t.spent.toLocaleString()}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Campaigns Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-6 border-b border-gray-100 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">All Campaigns</h3>
          <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
            {["", "ACTIVE", "PAUSED", "EXPIRED", "CANCELLED"].map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  statusFilter === s ? "bg-white text-gray-900 shadow-sm" : "text-gray-600 hover:text-gray-900"
                }`}
              >
                {s || "ALL"}
              </button>
            ))}
          </div>
        </div>
        {campaigns.length === 0 ? (
          <div className="text-center py-12 text-gray-400">No campaigns found</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left text-xs font-medium text-gray-500 uppercase px-6 py-3">Seller</th>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase px-6 py-3">Product</th>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase px-6 py-3">Tier</th>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase px-6 py-3">Status</th>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase px-6 py-3">Period</th>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase px-6 py-3">Budget</th>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase px-6 py-3">Spent</th>
                </tr>
              </thead>
              <tbody>
                {campaigns.map((c) => (
                  <tr key={c.id} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">{c.sellerName}</td>
                    <td className="px-6 py-4 text-sm text-gray-700">{c.productName}</td>
                    <td className="px-6 py-4">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${tierColors[c.tier]}`}>{c.tier}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`text-xs font-medium px-2 py-1 rounded-full ${statusColors[c.status]}`}>{c.status}</span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {new Date(c.startDate).toLocaleDateString()} - {new Date(c.endDate).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">UGX {c.totalBudget.toLocaleString()}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">UGX {c.spent.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
