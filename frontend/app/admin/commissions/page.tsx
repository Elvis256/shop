"use client";

import { useEffect, useState, useCallback } from "react";
import { apiFetch } from "@/lib/api";
import {
  Plus,
  Pencil,
  Trash2,
  X,
  Loader2,
  Percent,
  Save,
  TrendingUp,
  DollarSign,
  Users,
  Store,
  Search,
  Info,
  ToggleLeft,
  ToggleRight,
  Download,
  ChevronDown,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
} from "lucide-react";

interface CommissionRule {
  id: string;
  categoryId?: string | null;
  categoryName?: string;
  rate: number;
  isActive: boolean;
  createdAt?: string;
}

interface Category {
  id: string;
  name: string;
  slug: string;
}

interface SellerOverride {
  id: string;
  storeName: string;
  commissionRate: number | null;
  tier: string | null;
  totalEarnings: number;
  status: string;
}

interface CommissionStats {
  totalCommissions: number;
  totalSellerRevenue: number;
  activeSellers: number;
  averageRate: number;
  rulesCount: number;
}

type SortField = "categoryName" | "rate";
type SortDir = "asc" | "desc";

export default function AdminCommissionsPage() {
  const [rules, setRules] = useState<CommissionRule[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingRule, setEditingRule] = useState<CommissionRule | null>(null);
  const [formCategoryId, setFormCategoryId] = useState("");
  const [formRate, setFormRate] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  // Stats
  const [stats, setStats] = useState<CommissionStats>({ totalCommissions: 0, totalSellerRevenue: 0, activeSellers: 0, averageRate: 0, rulesCount: 0 });

  // Seller overrides
  const [sellerOverrides, setSellerOverrides] = useState<SellerOverride[]>([]);
  const [showOverrides, setShowOverrides] = useState(false);
  const [overrideSearch, setOverrideSearch] = useState("");
  const [editOverride, setEditOverride] = useState<SellerOverride | null>(null);
  const [overrideRate, setOverrideRate] = useState("");
  const [savingOverride, setSavingOverride] = useState(false);

  // Sorting
  const [sortField, setSortField] = useState<SortField>("categoryName");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  // Search
  const [ruleSearch, setRuleSearch] = useState("");

  // Active tab
  const [activeTab, setActiveTab] = useState<"rules" | "overrides" | "tiers">("rules");

  const loadRules = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetch("/api/admin/sellers/commissions");
      const ruleList = Array.isArray(data) ? data : data.rules || [];
      setRules(ruleList);
    } catch {
      setRules([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadCategories = useCallback(async () => {
    try {
      const data = await apiFetch("/api/categories");
      setCategories(Array.isArray(data) ? data : data.categories || []);
    } catch {}
  }, []);

  const loadStats = useCallback(async () => {
    try {
      const data = await apiFetch("/api/admin/sellers/stats");
      const commRules = await apiFetch("/api/admin/sellers/commissions");
      const ruleList = Array.isArray(commRules) ? commRules : commRules.rules || [];
      const activeRules = ruleList.filter((r: CommissionRule) => r.isActive);
      const avgRate = activeRules.length > 0 ? activeRules.reduce((sum: number, r: CommissionRule) => sum + r.rate, 0) / activeRules.length : 0;

      setStats({
        totalCommissions: Number(data.totalCommissions || 0),
        totalSellerRevenue: Number(data.totalSellerRevenue || 0),
        activeSellers: data.activeSellers || 0,
        averageRate: Math.round(avgRate * 10) / 10,
        rulesCount: ruleList.length,
      });
    } catch {}
  }, []);

  const loadSellerOverrides = useCallback(async () => {
    try {
      const data = await apiFetch("/api/admin/sellers?limit=100");
      const sellers = (data.sellers || []).map((s: any) => ({
        id: s.id,
        storeName: s.storeName,
        commissionRate: s.commissionRate,
        tier: s.tier,
        totalEarnings: Number(s.totalEarnings || 0),
        status: s.status,
      }));
      setSellerOverrides(sellers);
    } catch {}
  }, []);

  useEffect(() => {
    loadRules();
    loadCategories();
    loadStats();
    loadSellerOverrides();
  }, [loadRules, loadCategories, loadStats, loadSellerOverrides]);

  const openAdd = () => {
    setEditingRule(null);
    setFormCategoryId("");
    setFormRate("");
    setShowModal(true);
  };

  const openEdit = (rule: CommissionRule) => {
    setEditingRule(rule);
    setFormCategoryId(rule.categoryId || "");
    setFormRate(String(rule.rate));
    setShowModal(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (editingRule) {
        await apiFetch(`/api/admin/sellers/commissions/${editingRule.id}`, {
          method: "PUT",
          body: JSON.stringify({ rate: Number(formRate), isActive: editingRule.isActive }),
        });
      } else {
        const cat = categories.find((c) => c.id === formCategoryId);
        await apiFetch("/api/admin/sellers/commissions", {
          method: "POST",
          body: JSON.stringify({
            categoryId: formCategoryId || undefined,
            categoryName: cat?.name || undefined,
            rate: Number(formRate),
          }),
        });
      }
      setShowModal(false);
      loadRules();
      loadStats();
    } catch {
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (rule: CommissionRule) => {
    try {
      await apiFetch(`/api/admin/sellers/commissions/${rule.id}`, {
        method: "PUT",
        body: JSON.stringify({ rate: rule.rate, isActive: !rule.isActive }),
      });
      loadRules();
    } catch {}
  };

  const handleDelete = async (id: string) => {
    try {
      await apiFetch(`/api/admin/sellers/commissions/${id}`, { method: "DELETE" });
      setDeleteConfirm(null);
      loadRules();
      loadStats();
    } catch {}
  };

  const handleSaveOverride = async () => {
    if (!editOverride) return;
    setSavingOverride(true);
    try {
      await apiFetch(`/api/admin/sellers/${editOverride.id}/settings`, {
        method: "PUT",
        body: JSON.stringify({ commissionRate: overrideRate ? Number(overrideRate) : null }),
      });
      setEditOverride(null);
      setOverrideRate("");
      loadSellerOverrides();
    } catch {
    } finally {
      setSavingOverride(false);
    }
  };

  const toggleSort = (field: SortField) => {
    if (sortField === field) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortField(field); setSortDir("desc"); }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="w-3 h-3 text-gray-300" />;
    return sortDir === "asc" ? <ArrowUp className="w-3 h-3 text-primary" /> : <ArrowDown className="w-3 h-3 text-primary" />;
  };

  // Filter and sort rules
  const filteredRules = rules.filter((r) => {
    if (!ruleSearch) return true;
    const search = ruleSearch.toLowerCase();
    return (r.categoryName || "Default").toLowerCase().includes(search);
  });

  const sortedRules = [...filteredRules].sort((a, b) => {
    const dir = sortDir === "asc" ? 1 : -1;
    if (!a.categoryId) return -1;
    if (!b.categoryId) return 1;
    if (sortField === "rate") return dir * (a.rate - b.rate);
    return dir * ((a.categoryName || "").localeCompare(b.categoryName || ""));
  });

  const filteredOverrides = sellerOverrides.filter((s) => {
    if (!overrideSearch) return true;
    return s.storeName.toLowerCase().includes(overrideSearch.toLowerCase());
  });

  const exportCSV = () => {
    const headers = ["Category", "Rate (%)", "Status"];
    const rows = sortedRules.map((r) => [
      r.categoryId ? (r.categoryName || r.categoryId) : "Default (All)",
      r.rate,
      r.isActive ? "Active" : "Inactive",
    ]);
    const csv = [headers.join(","), ...rows.map((r) => r.map((v) => `"${v}"`).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `commission-rules-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const tierInfo = [
    { tier: "BRONZE", rate: "15% (default)", color: "bg-orange-100 text-orange-700 border-orange-200", desc: "New sellers, standard rate" },
    { tier: "SILVER", rate: "12%", color: "bg-gray-100 text-gray-600 border-gray-200", desc: "Established sellers with good track record" },
    { tier: "GOLD", rate: "10%", color: "bg-amber-100 text-amber-700 border-amber-200", desc: "Top-performing sellers, lowest rate" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Commission Management</h1>
          <p className="text-sm text-gray-500 mt-1">Configure marketplace commission rates and seller overrides</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={exportCSV} className="inline-flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50">
            <Download className="w-4 h-4" /> Export
          </button>
          <button onClick={openAdd} className="flex items-center gap-2 px-4 py-2 bg-primary text-white text-sm font-medium rounded-lg hover:bg-primary/90 transition-colors">
            <Plus className="w-4 h-4" /> Add Rule
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg text-purple-600 bg-purple-50"><DollarSign className="w-4 h-4" /></div>
            <div className="min-w-0">
              <p className="text-xs text-gray-500">Total Commissions</p>
              <p className="text-lg font-bold text-gray-900 truncate">UGX {stats.totalCommissions.toLocaleString()}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg text-green-600 bg-green-50"><TrendingUp className="w-4 h-4" /></div>
            <div className="min-w-0">
              <p className="text-xs text-gray-500">Seller Revenue</p>
              <p className="text-lg font-bold text-gray-900 truncate">UGX {stats.totalSellerRevenue.toLocaleString()}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg text-blue-600 bg-blue-50"><Users className="w-4 h-4" /></div>
            <div>
              <p className="text-xs text-gray-500">Active Sellers</p>
              <p className="text-lg font-bold text-gray-900">{stats.activeSellers}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg text-amber-600 bg-amber-50"><Percent className="w-4 h-4" /></div>
            <div>
              <p className="text-xs text-gray-500">Avg. Rate</p>
              <p className="text-lg font-bold text-gray-900">{stats.averageRate}%</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg text-indigo-600 bg-indigo-50"><Percent className="w-4 h-4" /></div>
            <div>
              <p className="text-xs text-gray-500">Active Rules</p>
              <p className="text-lg font-bold text-gray-900">{rules.filter((r) => r.isActive).length} / {rules.length}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
        {(["rules", "overrides", "tiers"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
              activeTab === tab ? "bg-white text-gray-900 shadow-sm" : "text-gray-600 hover:text-gray-900"
            }`}
          >
            {tab === "rules" ? "Category Rules" : tab === "overrides" ? "Seller Overrides" : "Tier Rates"}
          </button>
        ))}
      </div>

      {/* Category Rules Tab */}
      {activeTab === "rules" && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-4 border-b border-gray-100 flex items-center justify-between">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={ruleSearch}
                onChange={(e) => setRuleSearch(e.target.value)}
                placeholder="Search rules..."
                className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : sortedRules.length === 0 ? (
            <div className="text-center py-20">
              <Percent className="w-10 h-10 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">No commission rules configured</p>
              <button onClick={openAdd} className="mt-3 text-sm text-primary hover:underline">Add your first rule</button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium text-gray-500">
                      <button onClick={() => toggleSort("categoryName")} className="inline-flex items-center gap-1 hover:text-gray-900">
                        Category <SortIcon field="categoryName" />
                      </button>
                    </th>
                    <th className="text-center px-4 py-3 font-medium text-gray-500">
                      <button onClick={() => toggleSort("rate")} className="inline-flex items-center gap-1 hover:text-gray-900">
                        Rate <SortIcon field="rate" />
                      </button>
                    </th>
                    <th className="text-center px-4 py-3 font-medium text-gray-500">Visual</th>
                    <th className="text-center px-4 py-3 font-medium text-gray-500">Status</th>
                    <th className="text-center px-4 py-3 font-medium text-gray-500">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {sortedRules.map((rule) => (
                    <tr key={rule.id} className={`hover:bg-gray-50 transition-colors ${!rule.categoryId ? "bg-blue-50/30" : ""}`}>
                      <td className="px-4 py-3">
                        {rule.categoryId ? (
                          <span className="text-gray-900">{rule.categoryName || rule.categoryId}</span>
                        ) : (
                          <span className="font-semibold text-primary flex items-center gap-1">
                            Default (All Categories)
                            <Info className="w-3.5 h-3.5 text-primary/50" />
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="font-bold text-gray-900 text-lg">{rule.rate}%</span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="w-full bg-gray-200 rounded-full h-2 max-w-[120px] mx-auto">
                          <div
                            className={`h-2 rounded-full transition-all ${rule.rate > 20 ? "bg-red-500" : rule.rate > 15 ? "bg-yellow-500" : "bg-green-500"}`}
                            style={{ width: `${Math.min(rule.rate, 100)}%` }}
                          />
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => handleToggleActive(rule)}
                          className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full transition-colors ${
                            rule.isActive ? "bg-green-100 text-green-800 hover:bg-green-200" : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                          }`}
                        >
                          {rule.isActive ? <ToggleRight className="w-3.5 h-3.5" /> : <ToggleLeft className="w-3.5 h-3.5" />}
                          {rule.isActive ? "Active" : "Inactive"}
                        </button>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button onClick={() => openEdit(rule)} className="p-1.5 text-gray-500 hover:bg-gray-100 rounded-lg transition-colors" title="Edit">
                            <Pencil className="w-4 h-4" />
                          </button>
                          {rule.categoryId && (
                            <button onClick={() => setDeleteConfirm(rule.id)} className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors" title="Delete">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Seller Overrides Tab */}
      {activeTab === "overrides" && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-4 border-b border-gray-100">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-gray-500">Set custom commission rates for individual sellers, overriding category and tier rules.</p>
            </div>
            <div className="relative max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={overrideSearch}
                onChange={(e) => setOverrideSearch(e.target.value)}
                placeholder="Search sellers..."
                className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Seller</th>
                  <th className="text-center px-4 py-3 font-medium text-gray-500">Tier</th>
                  <th className="text-center px-4 py-3 font-medium text-gray-500">Tier Rate</th>
                  <th className="text-center px-4 py-3 font-medium text-gray-500">Custom Override</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-500">Total Earnings</th>
                  <th className="text-center px-4 py-3 font-medium text-gray-500">Status</th>
                  <th className="text-center px-4 py-3 font-medium text-gray-500">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredOverrides.map((seller) => {
                  const tierRate = seller.tier === "GOLD" ? 10 : seller.tier === "SILVER" ? 12 : 15;
                  return (
                    <tr key={seller.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Store className="w-4 h-4 text-gray-400" />
                          <span className="font-medium text-gray-900">{seller.storeName}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded border ${
                          seller.tier === "GOLD" ? "bg-amber-100 text-amber-700 border-amber-200" :
                          seller.tier === "SILVER" ? "bg-gray-100 text-gray-600 border-gray-200" :
                          "bg-orange-100 text-orange-700 border-orange-200"
                        }`}>
                          {seller.tier || "BRONZE"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center text-gray-600">{tierRate}%</td>
                      <td className="px-4 py-3 text-center">
                        {seller.commissionRate != null ? (
                          <span className="font-bold text-primary">{seller.commissionRate}%</span>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-700 whitespace-nowrap">
                        UGX {seller.totalEarnings.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                          seller.status === "APPROVED" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"
                        }`}>
                          {seller.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => { setEditOverride(seller); setOverrideRate(seller.commissionRate != null ? String(seller.commissionRate) : ""); }}
                          className="px-3 py-1.5 text-xs font-medium text-primary bg-primary/5 hover:bg-primary/10 rounded-lg transition-colors"
                        >
                          {seller.commissionRate != null ? "Edit" : "Set Override"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {filteredOverrides.length === 0 && (
            <div className="text-center py-12 text-gray-500">No sellers found</div>
          )}
        </div>
      )}

      {/* Tier Rates Tab */}
      {activeTab === "tiers" && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Tier-Based Commission Rates</h3>
            <p className="text-sm text-gray-500 mb-6">
              Sellers are assigned tiers based on performance. Each tier has a default commission rate that applies unless overridden by a category rule or individual seller override.
            </p>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-6 text-sm text-blue-700">
              <p className="font-medium">Rate Priority (highest to lowest):</p>
              <p className="mt-1">1. Seller-specific override &rarr; 2. Category rule &rarr; 3. Tier rate &rarr; 4. Default rule (15%)</p>
            </div>
            <div className="grid gap-4">
              {tierInfo.map((t) => (
                <div key={t.tier} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-200">
                  <div className="flex items-center gap-4">
                    <span className={`text-sm font-bold px-3 py-1 rounded-lg border ${t.color}`}>{t.tier}</span>
                    <div>
                      <p className="text-sm font-medium text-gray-900">{t.desc}</p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {sellerOverrides.filter((s) => (s.tier || "BRONZE") === t.tier).length} seller{sellerOverrides.filter((s) => (s.tier || "BRONZE") === t.tier).length !== 1 ? "s" : ""}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-gray-900">{t.rate}</p>
                    <p className="text-xs text-gray-500">commission</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Add/Edit Rule Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-[500] flex items-center justify-center p-4" onClick={() => setShowModal(false)}>
          <div className="bg-white rounded-2xl max-w-md w-full" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-6 border-b">
              <h3 className="text-lg font-semibold text-gray-900">
                {editingRule ? "Edit Commission Rule" : "Add Commission Rule"}
              </h3>
              <button onClick={() => setShowModal(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="text-sm text-gray-700 block mb-1">Category</label>
                <select
                  value={formCategoryId}
                  onChange={(e) => setFormCategoryId(e.target.value)}
                  disabled={!!editingRule}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:bg-gray-50"
                >
                  <option value="">Default (All Categories)</option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-sm text-gray-700 block mb-1">Commission Rate (%)</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  value={formRate}
                  onChange={(e) => setFormRate(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                  placeholder="e.g. 10"
                />
                {formRate && (
                  <p className="text-xs text-gray-500 mt-1">
                    For a UGX 100,000 sale, platform earns UGX {(100000 * Number(formRate) / 100).toLocaleString()}, seller receives UGX {(100000 - 100000 * Number(formRate) / 100).toLocaleString()}
                  </p>
                )}
              </div>
              <div className="flex gap-3 justify-end pt-2">
                <button onClick={() => setShowModal(false)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">Cancel</button>
                <button
                  onClick={handleSave}
                  disabled={saving || !formRate}
                  className="flex items-center gap-2 px-4 py-2 bg-primary text-white text-sm font-medium rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-colors"
                >
                  <Save className="w-4 h-4" />
                  {saving ? "Saving..." : "Save"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/50 z-[600] flex items-center justify-center p-4" onClick={() => setDeleteConfirm(null)}>
          <div className="bg-white rounded-2xl max-w-sm w-full p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Delete Rule</h3>
            <p className="text-sm text-gray-600 mb-4">Are you sure you want to delete this commission rule? Sellers in this category will fall back to the default rate.</p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setDeleteConfirm(null)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">Cancel</button>
              <button onClick={() => handleDelete(deleteConfirm)} className="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700">Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* Seller Override Modal */}
      {editOverride && (
        <div className="fixed inset-0 bg-black/50 z-[500] flex items-center justify-center p-4" onClick={() => setEditOverride(null)}>
          <div className="bg-white rounded-2xl max-w-md w-full" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-6 border-b">
              <h3 className="text-lg font-semibold text-gray-900">Commission Override</h3>
              <button onClick={() => setEditOverride(null)} className="p-2 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="font-medium text-gray-900">{editOverride.storeName}</p>
                <p className="text-xs text-gray-500 mt-1">
                  Tier: {editOverride.tier || "BRONZE"} (default rate: {editOverride.tier === "GOLD" ? "10%" : editOverride.tier === "SILVER" ? "12%" : "15%"})
                </p>
              </div>
              <div>
                <label className="text-sm text-gray-700 block mb-1">Custom Commission Rate (%)</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  value={overrideRate}
                  onChange={(e) => setOverrideRate(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                  placeholder="Leave empty to use tier/category rate"
                />
                <p className="text-xs text-gray-500 mt-1">Leave empty to remove override and use default tier/category rate.</p>
              </div>
              <div className="flex gap-3 justify-end pt-2">
                <button onClick={() => setEditOverride(null)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">Cancel</button>
                <button
                  onClick={handleSaveOverride}
                  disabled={savingOverride}
                  className="flex items-center gap-2 px-4 py-2 bg-primary text-white text-sm font-medium rounded-lg hover:bg-primary/90 disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  {savingOverride ? "Saving..." : "Save"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
