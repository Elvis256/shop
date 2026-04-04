"use client";

import { useEffect, useState, useCallback } from "react";
import { apiFetch } from "@/lib/api";
import {
  Users,
  Gift,
  Scissors,
  Calendar,
  Plus,
  Trash2,
  Search,
  Filter,
  Share2,
  Sparkles,
  TrendingUp,
  Award,
  MousePointerClick,
  ExternalLink,
  X,
} from "lucide-react";

/* ─── Types ──────────────────────────────────────────── */

interface SocialStats {
  groupBuys: { active: number; total: number };
  shares: { total: number; totalClicks: number };
  priceSlashes: { active: number };
  checkIns: { total: number; today: number };
}

interface GroupBuy {
  id: string;
  productId: string;
  product: { id: string; name: string; slug: string; price: number; images?: { url: string }[] };
  targetCount: number;
  currentCount: number;
  discountPercent: number;
  groupPrice: number;
  expiresAt: string;
  status: string;
  createdAt: string;
  participants: { user: { name: string | null; email: string } }[];
}

interface ShareDiscount {
  id: string;
  user: { name: string | null; email: string };
  product: { name: string; slug: string };
  platform: string;
  clicks: number;
  couponCode: string | null;
  couponUsed: boolean;
  discount: number;
  createdAt: string;
}

interface PriceSlashItem {
  id: string;
  initiator: { name: string | null; email: string };
  product: { name: string; slug: string; price: number };
  originalPrice: number;
  currentPrice: number;
  minPrice: number;
  currentSlashes: number;
  maxSlashes: number;
  status: string;
  expiresAt: string;
  slashers: { slashedAt: string }[];
  createdAt: string;
}

interface CheckInData {
  dailyCounts: { date: string; count: number }[];
  topStreaks: { userName: string; streak: number; lastCheckIn: string }[];
}

interface ProductOption {
  id: string;
  name: string;
  price: number;
  slug: string;
}

type Tab = "overview" | "group-buys" | "shares" | "price-slashes" | "check-ins";

const TABS: { key: Tab; label: string; icon: any }[] = [
  { key: "overview", label: "Overview", icon: Sparkles },
  { key: "group-buys", label: "Group Buys", icon: Users },
  { key: "shares", label: "Shares", icon: Share2 },
  { key: "price-slashes", label: "Price Slashes", icon: Scissors },
  { key: "check-ins", label: "Check-ins", icon: Calendar },
];

/* ─── Helpers ────────────────────────────────────────── */

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
function fmtDateTime(d: string) {
  return new Date(d).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}
function fmtPrice(v: number) {
  return Number(v).toLocaleString("en-UG", { style: "currency", currency: "UGX", maximumFractionDigits: 0 });
}
function statusColor(s: string) {
  if (s === "active") return "bg-green-100 text-green-700";
  if (s === "completed" || s === "claimed") return "bg-blue-100 text-blue-700";
  return "bg-gray-100 text-gray-600";
}

/* ─── Component ──────────────────────────────────────── */

export default function AdminSocialPage() {
  const [tab, setTab] = useState<Tab>("overview");
  const [stats, setStats] = useState<SocialStats | null>(null);
  const [groupBuys, setGroupBuys] = useState<GroupBuy[]>([]);
  const [shares, setShares] = useState<ShareDiscount[]>([]);
  const [slashes, setSlashes] = useState<PriceSlashItem[]>([]);
  const [checkInData, setCheckInData] = useState<CheckInData | null>(null);
  const [loading, setLoading] = useState(true);
  const [gbFilter, setGbFilter] = useState("");

  // Create group buy form
  const [showCreate, setShowCreate] = useState(false);
  const [productSearch, setProductSearch] = useState("");
  const [productResults, setProductResults] = useState<ProductOption[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<ProductOption | null>(null);
  const [targetCount, setTargetCount] = useState(3);
  const [discountPercent, setDiscountPercent] = useState(20);
  const [expiresInHours, setExpiresInHours] = useState(48);
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState("");

  const fetchStats = useCallback(async () => {
    try {
      const data = await apiFetch("/api/admin/social/stats");
      setStats(data);
    } catch {}
  }, []);

  const fetchGroupBuys = useCallback(async () => {
    try {
      const q = gbFilter ? `?status=${gbFilter}` : "";
      const data = await apiFetch(`/api/admin/social/group-buys${q}`);
      setGroupBuys(data.groupBuys);
    } catch {}
  }, [gbFilter]);

  const fetchShares = useCallback(async () => {
    try {
      const data = await apiFetch("/api/admin/social/shares");
      setShares(data.shares);
    } catch {}
  }, []);

  const fetchSlashes = useCallback(async () => {
    try {
      const data = await apiFetch("/api/admin/social/price-slashes");
      setSlashes(data.slashes);
    } catch {}
  }, []);

  const fetchCheckIns = useCallback(async () => {
    try {
      const data = await apiFetch("/api/admin/social/check-ins");
      setCheckInData(data);
    } catch {}
  }, []);

  useEffect(() => {
    setLoading(true);
    const tasks: Promise<void>[] = [fetchStats()];
    if (tab === "group-buys") tasks.push(fetchGroupBuys());
    if (tab === "shares") tasks.push(fetchShares());
    if (tab === "price-slashes") tasks.push(fetchSlashes());
    if (tab === "check-ins") tasks.push(fetchCheckIns());
    Promise.all(tasks).finally(() => setLoading(false));
  }, [tab, fetchStats, fetchGroupBuys, fetchShares, fetchSlashes, fetchCheckIns]);

  // Product search for group buy creation
  useEffect(() => {
    if (productSearch.length < 2) { setProductResults([]); return; }
    const t = setTimeout(async () => {
      try {
        const data = await apiFetch(`/api/admin/products?search=${encodeURIComponent(productSearch)}&limit=8`);
        setProductResults((data.products || []).map((p: any) => ({ id: p.id, name: p.name, price: Number(p.price), slug: p.slug })));
      } catch (err) {
        console.error("Product search failed:", err);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [productSearch]);

  const handleCreateGroupBuy = async () => {
    if (!selectedProduct) {
      setFormError("Please search and select a product first");
      return;
    }
    setFormError("");
    setCreating(true);
    try {
      await apiFetch("/api/admin/social/group-buys", {
        method: "POST",
        body: JSON.stringify({ productId: selectedProduct.id, targetCount, discountPercent, expiresInHours }),
      });
      setShowCreate(false);
      setSelectedProduct(null);
      setProductSearch("");
      setTargetCount(3);
      setDiscountPercent(20);
      setExpiresInHours(48);
      fetchGroupBuys();
      fetchStats();
    } catch (err: any) {
      setFormError(err?.message || "Failed to create group buy. Please try again.");
    }
    setCreating(false);
  };

  const handleCancelGroupBuy = async (id: string) => {
    if (!confirm("Cancel this group buy?")) return;
    try {
      await apiFetch(`/api/admin/social/group-buys/${id}`, { method: "DELETE" });
      fetchGroupBuys();
      fetchStats();
    } catch (err: any) {
      alert(err?.message || "Failed to cancel group buy");
    }
  };

  /* ─── Skeleton ─────────────────────────────────────── */
  const Skeleton = ({ className = "" }: { className?: string }) => (
    <div className={`animate-pulse bg-gray-200 rounded ${className}`} />
  );

  /* ─── Stats Card ───────────────────────────────────── */
  const StatCard = ({ icon: Icon, label, value, sub, color = "text-primary" }: { icon: any; label: string; value: string | number; sub?: string; color?: string }) => (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-center gap-3 mb-3">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center bg-gray-50 ${color}`}>
          <Icon className="w-5 h-5" />
        </div>
        <span className="text-[13px] text-gray-500 font-medium">{label}</span>
      </div>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      {sub && <p className="text-[12px] text-gray-400 mt-1">{sub}</p>}
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Social Shopping</h1>
          <p className="text-[13px] text-gray-500 mt-1">Manage group buys, shares, price slashes & check-ins</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-lg w-fit">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              tab === t.key ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
            }`}
          >
            <t.icon className="w-4 h-4" />
            {t.label}
          </button>
        ))}
      </div>

      {/* ─── Overview Tab ──────────────────────────────── */}
      {tab === "overview" && (
        <div className="space-y-6">
          {loading || !stats ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-32" />)}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard icon={Users} label="Active Group Buys" value={stats.groupBuys.active} sub={`${stats.groupBuys.total} total`} color="text-blue-600" />
                <StatCard icon={Share2} label="Total Shares" value={stats.shares.total} sub={`${stats.shares.totalClicks} clicks`} color="text-green-600" />
                <StatCard icon={Scissors} label="Active Price Slashes" value={stats.priceSlashes.active} color="text-orange-600" />
                <StatCard icon={Calendar} label="Today's Check-ins" value={stats.checkIns.today} sub={`${stats.checkIns.total} all time`} color="text-purple-600" />
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => { setTab("group-buys"); setShowCreate(true); }}
                  className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
                >
                  <Plus className="w-4 h-4" /> Create Group Buy
                </button>
                <button
                  onClick={() => setTab("shares")}
                  className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  <Share2 className="w-4 h-4" /> View All Shares
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* ─── Group Buys Tab ────────────────────────────── */}
      {tab === "group-buys" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-gray-400" />
              {["", "active", "completed", "expired"].map(f => (
                <button
                  key={f}
                  onClick={() => setGbFilter(f)}
                  className={`px-3 py-1.5 rounded-md text-[13px] font-medium transition-colors ${
                    gbFilter === f ? "bg-primary/10 text-primary" : "text-gray-500 hover:bg-gray-100"
                  }`}
                >
                  {f ? f.charAt(0).toUpperCase() + f.slice(1) : "All"}
                </button>
              ))}
            </div>
            <button
              onClick={() => setShowCreate(true)}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
            >
              <Plus className="w-4 h-4" /> Create Group Buy
            </button>
          </div>

          {/* Create Form Modal */}
          {showCreate && (
            <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-900">New Group Buy</h3>
                <button onClick={() => setShowCreate(false)} className="p-1 hover:bg-gray-100 rounded-md">
                  <X className="w-4 h-4 text-gray-400" />
                </button>
              </div>

              {/* Product search */}
              <div>
                <label className="block text-[13px] font-medium text-gray-700 mb-1">Product</label>
                {selectedProduct ? (
                  <div className="flex items-center justify-between bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{selectedProduct.name}</p>
                      <p className="text-[12px] text-gray-500">{fmtPrice(selectedProduct.price)}</p>
                    </div>
                    <button onClick={() => { setSelectedProduct(null); setProductSearch(""); }} className="p-1 hover:bg-gray-200 rounded-md">
                      <X className="w-3.5 h-3.5 text-gray-400" />
                    </button>
                  </div>
                ) : (
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Search products..."
                      value={productSearch}
                      onChange={e => setProductSearch(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                    />
                    {productResults.length > 0 && (
                      <div className="absolute z-10 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                        {productResults.map(p => (
                          <button
                            key={p.id}
                            onClick={() => { setSelectedProduct(p); setProductResults([]); setProductSearch(""); }}
                            className="w-full text-left px-3 py-2 hover:bg-gray-50 text-sm border-b border-gray-100 last:border-0"
                          >
                            <span className="font-medium text-gray-900">{p.name}</span>
                            <span className="text-gray-400 ml-2">{fmtPrice(p.price)}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-[13px] font-medium text-gray-700 mb-1">Target Count</label>
                  <input type="number" min={2} value={targetCount} onChange={e => setTargetCount(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" />
                </div>
                <div>
                  <label className="block text-[13px] font-medium text-gray-700 mb-1">Discount %</label>
                  <input type="number" min={1} max={90} value={discountPercent} onChange={e => setDiscountPercent(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" />
                </div>
                <div>
                  <label className="block text-[13px] font-medium text-gray-700 mb-1">Duration (hours)</label>
                  <input type="number" min={1} value={expiresInHours} onChange={e => setExpiresInHours(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" />
                </div>
              </div>

              {selectedProduct && (
                <p className="text-[12px] text-gray-500">
                  Group price: <span className="font-semibold text-gray-700">{fmtPrice(selectedProduct.price * (1 - discountPercent / 100))}</span>
                  {" "}(was {fmtPrice(selectedProduct.price)})
                </p>
              )}

              {formError && (
                <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{formError}</p>
              )}

              <div className="flex justify-end gap-2">
                <button onClick={() => { setShowCreate(false); setFormError(""); }} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">Cancel</button>
                <button onClick={handleCreateGroupBuy} disabled={creating}
                  className="px-4 py-2 bg-primary text-white text-sm font-medium rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-colors">
                  {creating ? "Creating..." : "Create Group Buy"}
                </button>
              </div>
            </div>
          )}

          {/* Group Buy List */}
          {loading ? (
            <div className="space-y-3">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-20" />)}</div>
          ) : groupBuys.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
              <Users className="w-10 h-10 text-gray-300 mx-auto mb-3" />
              <p className="text-sm text-gray-500">No group buys found</p>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/50">
                    <th className="text-left px-4 py-3 text-[13px] font-medium text-gray-500">Product</th>
                    <th className="text-left px-4 py-3 text-[13px] font-medium text-gray-500">Progress</th>
                    <th className="text-left px-4 py-3 text-[13px] font-medium text-gray-500">Discount</th>
                    <th className="text-left px-4 py-3 text-[13px] font-medium text-gray-500">Status</th>
                    <th className="text-left px-4 py-3 text-[13px] font-medium text-gray-500">Expires</th>
                    <th className="text-right px-4 py-3 text-[13px] font-medium text-gray-500"></th>
                  </tr>
                </thead>
                <tbody>
                  {groupBuys.map(gb => {
                    const progress = Math.min((gb.currentCount / gb.targetCount) * 100, 100);
                    return (
                      <tr key={gb.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                        <td className="px-4 py-3">
                          <p className="font-medium text-gray-900 text-sm">{gb.product.name}</p>
                          <p className="text-[12px] text-gray-400">{fmtPrice(Number(gb.groupPrice))}</p>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="w-24 h-2 bg-gray-100 rounded-full overflow-hidden">
                              <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${progress}%` }} />
                            </div>
                            <span className="text-[12px] text-gray-500">{gb.currentCount}/{gb.targetCount}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700">{gb.discountPercent}% off</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-medium ${statusColor(gb.status)}`}>
                            {gb.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-[12px] text-gray-500">{fmtDateTime(gb.expiresAt)}</td>
                        <td className="px-4 py-3 text-right">
                          {gb.status === "active" && (
                            <button onClick={() => handleCancelGroupBuy(gb.id)} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-md transition-colors" title="Cancel">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ─── Shares Tab ────────────────────────────────── */}
      {tab === "shares" && (
        <div className="space-y-4">
          {/* Stats */}
          {stats && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <StatCard icon={Share2} label="Total Shares" value={stats.shares.total} color="text-green-600" />
              <StatCard icon={MousePointerClick} label="Total Clicks" value={stats.shares.totalClicks} color="text-blue-600" />
              <StatCard icon={Gift} label="Coupons Generated" value={shares.filter(s => s.couponCode).length} color="text-purple-600" />
            </div>
          )}

          {loading ? (
            <Skeleton className="h-64" />
          ) : shares.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
              <Share2 className="w-10 h-10 text-gray-300 mx-auto mb-3" />
              <p className="text-sm text-gray-500">No shares yet</p>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/50">
                    <th className="text-left px-4 py-3 text-[13px] font-medium text-gray-500">User</th>
                    <th className="text-left px-4 py-3 text-[13px] font-medium text-gray-500">Product</th>
                    <th className="text-left px-4 py-3 text-[13px] font-medium text-gray-500">Platform</th>
                    <th className="text-left px-4 py-3 text-[13px] font-medium text-gray-500">Clicks</th>
                    <th className="text-left px-4 py-3 text-[13px] font-medium text-gray-500">Coupon</th>
                    <th className="text-left px-4 py-3 text-[13px] font-medium text-gray-500">Status</th>
                    <th className="text-left px-4 py-3 text-[13px] font-medium text-gray-500">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {shares.map(s => (
                    <tr key={s.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                      <td className="px-4 py-3 text-sm text-gray-900">{s.user.name || s.user.email}</td>
                      <td className="px-4 py-3 text-sm text-gray-700">{s.product.name}</td>
                      <td className="px-4 py-3">
                        <span className="inline-flex px-2 py-0.5 rounded-full text-[11px] font-medium bg-gray-100 text-gray-600 capitalize">
                          {s.platform}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">{s.clicks}</td>
                      <td className="px-4 py-3 text-[12px] text-gray-500 font-mono">{s.couponCode || "—"}</td>
                      <td className="px-4 py-3">
                        {s.couponUsed ? (
                          <span className="inline-flex px-2 py-0.5 rounded-full text-[11px] font-medium bg-green-100 text-green-700">Used</span>
                        ) : s.couponCode ? (
                          <span className="inline-flex px-2 py-0.5 rounded-full text-[11px] font-medium bg-yellow-100 text-yellow-700">Pending</span>
                        ) : (
                          <span className="inline-flex px-2 py-0.5 rounded-full text-[11px] font-medium bg-gray-100 text-gray-500">No coupon</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-[12px] text-gray-500">{fmtDate(s.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ─── Price Slashes Tab ─────────────────────────── */}
      {tab === "price-slashes" && (
        <div className="space-y-4">
          {stats && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <StatCard icon={Scissors} label="Active Slashes" value={stats.priceSlashes.active} color="text-orange-600" />
              <StatCard icon={TrendingUp} label="Total Savings Generated" value={
                fmtPrice(slashes.reduce((sum, s) => sum + (Number(s.originalPrice) - Number(s.currentPrice)), 0))
              } color="text-green-600" />
            </div>
          )}

          {loading ? (
            <Skeleton className="h-64" />
          ) : slashes.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
              <Scissors className="w-10 h-10 text-gray-300 mx-auto mb-3" />
              <p className="text-sm text-gray-500">No price slashes yet</p>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/50">
                    <th className="text-left px-4 py-3 text-[13px] font-medium text-gray-500">User</th>
                    <th className="text-left px-4 py-3 text-[13px] font-medium text-gray-500">Product</th>
                    <th className="text-left px-4 py-3 text-[13px] font-medium text-gray-500">Price</th>
                    <th className="text-left px-4 py-3 text-[13px] font-medium text-gray-500">Slashes</th>
                    <th className="text-left px-4 py-3 text-[13px] font-medium text-gray-500">Status</th>
                    <th className="text-left px-4 py-3 text-[13px] font-medium text-gray-500">Expires</th>
                  </tr>
                </thead>
                <tbody>
                  {slashes.map(s => (
                    <tr key={s.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                      <td className="px-4 py-3 text-sm text-gray-900">{s.initiator.name || s.initiator.email}</td>
                      <td className="px-4 py-3 text-sm text-gray-700">{s.product.name}</td>
                      <td className="px-4 py-3 text-sm">
                        <span className="text-gray-400 line-through mr-1">{fmtPrice(Number(s.originalPrice))}</span>
                        <span className="text-green-600 font-medium">{fmtPrice(Number(s.currentPrice))}</span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">{s.currentSlashes}/{s.maxSlashes}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-medium ${statusColor(s.status)}`}>
                          {s.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-[12px] text-gray-500">{fmtDateTime(s.expiresAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ─── Check-ins Tab ─────────────────────────────── */}
      {tab === "check-ins" && (
        <div className="space-y-4">
          {stats && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <StatCard icon={Calendar} label="Total Check-ins" value={stats.checkIns.total} color="text-purple-600" />
              <StatCard icon={TrendingUp} label="Today's Check-ins" value={stats.checkIns.today} color="text-blue-600" />
            </div>
          )}

          {loading || !checkInData ? (
            <Skeleton className="h-64" />
          ) : (
            <>
              {/* Bar Chart (CSS-only) */}
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <h3 className="text-sm font-semibold text-gray-900 mb-4">Check-ins — Last 7 Days</h3>
                {checkInData.dailyCounts.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-8">No check-in data</p>
                ) : (
                  <div className="flex items-end gap-3 h-40">
                    {(() => {
                      const max = Math.max(...checkInData.dailyCounts.map(d => d.count), 1);
                      return checkInData.dailyCounts.map((d, i) => (
                        <div key={i} className="flex-1 flex flex-col items-center gap-1">
                          <span className="text-[11px] text-gray-500 font-medium">{d.count}</span>
                          <div className="w-full bg-primary/80 rounded-t-md transition-all" style={{ height: `${(d.count / max) * 100}%`, minHeight: d.count > 0 ? 4 : 0 }} />
                          <span className="text-[10px] text-gray-400">
                            {new Date(d.date).toLocaleDateString("en-US", { weekday: "short" })}
                          </span>
                        </div>
                      ));
                    })()}
                  </div>
                )}
              </div>

              {/* Streak Leaderboard */}
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <Award className="w-4 h-4 text-yellow-500" /> Top Streaks
                </h3>
                {checkInData.topStreaks.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-4">No streak data</p>
                ) : (
                  <div className="space-y-2">
                    {checkInData.topStreaks.map((s, i) => (
                      <div key={i} className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-gray-50">
                        <div className="flex items-center gap-3">
                          <span className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-[11px] font-bold text-gray-500">
                            {i + 1}
                          </span>
                          <span className="text-sm text-gray-900">{s.userName}</span>
                        </div>
                        <div className="flex items-center gap-4">
                          <span className="text-sm font-semibold text-primary">{s.streak} days</span>
                          <span className="text-[12px] text-gray-400">{fmtDate(s.lastCheckIn)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
