"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { apiFetch } from "@/lib/api";
import {
  Zap, Plus, Search, X, Trash2, Edit, Calendar,
  ChevronLeft, ChevronRight, Loader2, RefreshCw,
  TrendingDown, Package, Clock, Image as ImageIcon,
  Check, Star,
} from "lucide-react";

interface DailyDeal {
  id: string;
  name: string;
  slug: string;
  price: number;
  comparePrice: number | null;
  dailyDealPrice: number;
  dailyDealDate: string;
  isDailyDeal: boolean;
  stock: number;
  images: { id: string; url: string }[];
  category: { id: string; name: string } | null;
}

interface ProductSearchResult {
  id: string;
  name: string;
  slug: string;
  price: number;
  comparePrice: number | null;
  stock: number;
  images: { id: string; url: string }[];
  category: { id: string; name: string } | null;
}

type ViewFilter = "all" | "today" | "upcoming" | "past";

const INPUT_CLS =
  "w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10 focus:border-gray-400 transition-colors";

const PER_PAGE = 15;

function fmt(amount: number) {
  return `UGX ${Number(amount || 0).toLocaleString()}`;
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function fmtDateShort(d: string) {
  return new Date(d).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

function calcDiscount(original: number, deal: number): number {
  if (!original || original <= 0) return 0;
  return Math.round(((original - deal) / original) * 100);
}

function getDealStatus(dateStr: string): "today" | "upcoming" | "past" {
  const dealDate = new Date(dateStr).toDateString();
  const today = new Date().toDateString();
  if (dealDate === today) return "today";
  return new Date(dateStr).getTime() > Date.now() ? "upcoming" : "past";
}

function DealStatusBadge({ status }: { status: string }) {
  const cls: Record<string, string> = {
    today: "bg-green-100 text-green-800",
    upcoming: "bg-blue-50 text-blue-700",
    past: "bg-gray-100 text-gray-500",
  };
  const labels: Record<string, string> = {
    today: "Live Today",
    upcoming: "Upcoming",
    past: "Past",
  };
  return (
    <span className={`inline-flex items-center text-xs px-2.5 py-1 rounded-full font-medium ${cls[status] || cls.past}`}>
      {status === "today" && <Zap className="w-3 h-3 mr-1" />}
      {labels[status] || status}
    </span>
  );
}

export default function DailyDealsPage() {
  const [deals, setDeals] = useState<DailyDeal[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [viewFilter, setViewFilter] = useState<ViewFilter>("all");
  const [page, setPage] = useState(1);

  const [createOpen, setCreateOpen] = useState(false);
  const [editDeal, setEditDeal] = useState<DailyDeal | null>(null);
  const [dealPrice, setDealPrice] = useState("");
  const [dealDate, setDealDate] = useState("");
  const [saving, setSaving] = useState(false);

  // Product search within modal
  const [productSearch, setProductSearch] = useState("");
  const [productResults, setProductResults] = useState<ProductSearchResult[]>([]);
  const [searchingProducts, setSearchingProducts] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<ProductSearchResult | null>(null);
  const productSearchTimeout = useRef<NodeJS.Timeout | null>(null);

  const loadDeals = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetch("/api/daily-deal/admin/all");
      const items = Array.isArray(data) ? data : data.deals || data.data || [];
      setDeals(items);
    } catch (err) {
      console.error("Failed to load daily deals:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadDeals(); }, [loadDeals]);
  useEffect(() => { document.title = "Daily Deals | Admin"; }, []);
  useEffect(() => { setPage(1); }, [search, viewFilter]);

  // Product search in create modal
  useEffect(() => {
    if (productSearchTimeout.current) clearTimeout(productSearchTimeout.current);
    if (productSearch.length < 2) { setProductResults([]); return; }
    productSearchTimeout.current = setTimeout(async () => {
      setSearchingProducts(true);
      try {
        const data = await apiFetch("/api/products?search=" + encodeURIComponent(productSearch) + "&limit=8");
        setProductResults(Array.isArray(data) ? data : data.products || data.data || []);
      } catch {
        setProductResults([]);
      } finally {
        setSearchingProducts(false);
      }
    }, 300);
    return () => { if (productSearchTimeout.current) clearTimeout(productSearchTimeout.current); };
  }, [productSearch]);

  const todayDeal = deals.find((d) => getDealStatus(d.dailyDealDate) === "today");

  const filtered = deals
    .filter((d) => {
      const status = getDealStatus(d.dailyDealDate);
      if (viewFilter === "today" && status !== "today") return false;
      if (viewFilter === "upcoming" && status !== "upcoming") return false;
      if (viewFilter === "past" && status !== "past") return false;
      if (search) {
        const q = search.toLowerCase();
        return d.name.toLowerCase().includes(q) || (d.category?.name || "").toLowerCase().includes(q);
      }
      return true;
    })
    .sort((a, b) => new Date(a.dailyDealDate).getTime() - new Date(b.dailyDealDate).getTime());

  const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const paginated = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  // Stats
  const activeDeals = deals.filter((d) => getDealStatus(d.dailyDealDate) !== "past").length;
  const avgDiscount = deals.length
    ? Math.round(deals.reduce((s, d) => s + calcDiscount(Number(d.price), Number(d.dailyDealPrice)), 0) / deals.length)
    : 0;
  const totalDealRevenuePotential = deals
    .filter((d) => getDealStatus(d.dailyDealDate) !== "past")
    .reduce((s, d) => s + Number(d.dailyDealPrice) * d.stock, 0);

  const filterCounts: Record<ViewFilter, number> = {
    all: deals.length,
    today: deals.filter((d) => getDealStatus(d.dailyDealDate) === "today").length,
    upcoming: deals.filter((d) => getDealStatus(d.dailyDealDate) === "upcoming").length,
    past: deals.filter((d) => getDealStatus(d.dailyDealDate) === "past").length,
  };

  const openCreate = () => {
    setSelectedProduct(null);
    setProductSearch("");
    setProductResults([]);
    setDealPrice("");
    setDealDate(new Date().toISOString().split("T")[0]);
    setEditDeal(null);
    setCreateOpen(true);
  };

  const openEdit = (deal: DailyDeal) => {
    setEditDeal(deal);
    setDealPrice(String(deal.dailyDealPrice));
    setDealDate(new Date(deal.dailyDealDate).toISOString().split("T")[0]);
    setSelectedProduct(null);
    setProductSearch("");
    setProductResults([]);
    setCreateOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const productId = editDeal?.id || selectedProduct?.id;
    if (!productId || !dealPrice || !dealDate) return;
    setSaving(true);
    try {
      await apiFetch("/api/daily-deal/admin/set", {
        method: "POST",
        body: JSON.stringify({
          productId,
          dealPrice: parseFloat(dealPrice),
          date: new Date(dealDate).toISOString(),
        }),
      });
      setCreateOpen(false);
      loadDeals();
    } catch (err) {
      console.error("Failed to save deal:", err);
    } finally {
      setSaving(false);
    }
  };

  const removeDeal = async (productId: string) => {
    if (!confirm("Remove this daily deal?")) return;
    try {
      await apiFetch("/api/daily-deal/admin/" + productId, { method: "DELETE" });
      loadDeals();
    } catch (err) {
      console.error("Failed to remove deal:", err);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Daily Deals</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {activeDeals} active deals · {avgDiscount}% avg discount
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={loadDeals} className="inline-flex items-center gap-1.5 px-3 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-700">
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
          <button onClick={openCreate} className="inline-flex items-center gap-1.5 px-4 py-2 text-sm bg-gray-900 text-white rounded-lg hover:bg-gray-800">
            <Plus className="w-4 h-4" /> Create Deal
          </button>
        </div>
      </div>

      {/* Today's Deal Highlight */}
      {todayDeal && (
        <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <Zap className="w-5 h-5 text-green-600" />
            <h2 className="text-sm font-semibold text-green-800 uppercase tracking-wide">Today&apos;s Deal</h2>
          </div>
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-lg bg-white border border-green-100 overflow-hidden flex-shrink-0">
              {todayDeal.images?.[0] ? (
                <img src={todayDeal.images[0].url} alt={todayDeal.name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center"><ImageIcon className="w-6 h-6 text-gray-300" /></div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-base font-semibold text-gray-900 truncate">{todayDeal.name}</p>
              <div className="flex items-center gap-3 mt-1">
                <span className="text-lg font-bold text-green-700">{fmt(todayDeal.dailyDealPrice)}</span>
                <span className="text-sm text-gray-400 line-through">{fmt(todayDeal.price)}</span>
                <span className="inline-flex items-center text-xs px-2 py-0.5 rounded-full bg-green-200 text-green-800 font-bold">
                  -{calcDiscount(Number(todayDeal.price), Number(todayDeal.dailyDealPrice))}%
                </span>
              </div>
            </div>
            <div className="text-right flex-shrink-0">
              <p className="text-xs text-gray-500">{todayDeal.stock} in stock</p>
              {todayDeal.category && <p className="text-xs text-gray-400 mt-0.5">{todayDeal.category.name}</p>}
            </div>
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {[
          { label: "Active Deals", value: activeDeals, icon: Zap },
          { label: "Avg Discount", value: `${avgDiscount}%`, icon: TrendingDown },
          { label: "Deal Revenue Potential", value: fmt(totalDealRevenuePotential), icon: Package },
        ].map((s) => (
          <div key={s.label} className="bg-white border border-gray-200 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs text-gray-500 uppercase tracking-wide">{s.label}</p>
              <s.icon className="w-4 h-4 text-gray-400" />
            </div>
            <p className="text-2xl font-semibold text-gray-900 mt-1">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Search & Filter */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-gray-300 bg-white"
            placeholder="Search by product name or category..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex border border-gray-200 rounded-lg overflow-hidden text-sm">
          {(["all", "today", "upcoming", "past"] as ViewFilter[]).map((f) => (
            <button
              key={f}
              onClick={() => setViewFilter(f)}
              className={`px-3 py-2 capitalize transition-colors ${viewFilter === f ? "bg-gray-900 text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}
            >
              {f} ({filterCounts[f]})
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/50">
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Date</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Product</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Original Price</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Deal Price</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Discount</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Stock</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Status</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wide">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    <td colSpan={8} className="px-4 py-4">
                      <div className="h-4 bg-gray-100 rounded animate-pulse" style={{ width: `${60 + Math.random() * 30}%` }} />
                    </td>
                  </tr>
                ))
              ) : paginated.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center">
                    <Zap className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                    <p className="text-sm text-gray-500">No daily deals found</p>
                    <p className="text-xs text-gray-400 mt-1">Create your first deal to get started</p>
                  </td>
                </tr>
              ) : (
                paginated.map((deal) => {
                  const status = getDealStatus(deal.dailyDealDate);
                  const discount = calcDiscount(Number(deal.price), Number(deal.dailyDealPrice));
                  return (
                    <tr
                      key={deal.id}
                      className={`transition-colors ${status === "today" ? "bg-green-50/40 hover:bg-green-50/60" : "hover:bg-gray-50/50"}`}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-gray-400" />
                          <span className="text-sm text-gray-700">{fmtDateShort(deal.dailyDealDate)}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-gray-100 overflow-hidden flex-shrink-0">
                            {deal.images?.[0] ? (
                              <img src={deal.images[0].url} alt={deal.name} className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center"><ImageIcon className="w-4 h-4 text-gray-300" /></div>
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">{deal.name}</p>
                            {deal.category && <p className="text-xs text-gray-400">{deal.category.name}</p>}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">{fmt(deal.price)}</td>
                      <td className="px-4 py-3 text-sm font-semibold text-gray-900">{fmt(deal.dailyDealPrice)}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center text-xs px-2 py-0.5 rounded-full font-bold ${discount >= 50 ? "bg-red-100 text-red-700" : discount >= 25 ? "bg-orange-100 text-orange-700" : "bg-yellow-50 text-yellow-700"}`}>
                          -{discount}%
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        <span className={deal.stock <= 5 ? "text-red-600 font-medium" : ""}>{deal.stock}</span>
                      </td>
                      <td className="px-4 py-3"><DealStatusBadge status={status} /></td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => openEdit(deal)} className="p-1.5 text-gray-400 hover:text-gray-700 rounded-md hover:bg-gray-100" title="Edit deal">
                            <Edit className="w-4 h-4" />
                          </button>
                          <button onClick={() => removeDeal(deal.id)} className="p-1.5 text-gray-400 hover:text-red-600 rounded-md hover:bg-red-50" title="Remove deal">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
            <p className="text-sm text-gray-500">
              Showing {(page - 1) * PER_PAGE + 1}–{Math.min(page * PER_PAGE, filtered.length)} of {filtered.length}
            </p>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-1.5 rounded-md border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter((p) => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
                .map((p, idx, arr) => (
                  <span key={p} className="flex items-center">
                    {idx > 0 && arr[idx - 1] !== p - 1 && <span className="px-1 text-gray-400">…</span>}
                    <button
                      onClick={() => setPage(p)}
                      className={`w-8 h-8 rounded-md text-sm ${p === page ? "bg-gray-900 text-white" : "text-gray-600 hover:bg-gray-50"}`}
                    >
                      {p}
                    </button>
                  </span>
                ))}
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="p-1.5 rounded-md border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Create / Edit Deal Modal */}
      {createOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setCreateOpen(false)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-lg font-semibold text-gray-900">{editDeal ? "Edit Deal" : "Create Daily Deal"}</h2>
              <button onClick={() => setCreateOpen(false)} className="p-1 text-gray-400 hover:text-gray-600 rounded-md">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSave} className="p-6 space-y-4">
              {/* Product selection (only for new deals) */}
              {!editDeal && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Select Product *</label>
                  {selectedProduct ? (
                    <div className="flex items-center gap-3 border border-gray-200 rounded-lg p-3">
                      <div className="w-12 h-12 rounded-lg bg-gray-100 overflow-hidden flex-shrink-0">
                        {selectedProduct.images?.[0] ? (
                          <img src={selectedProduct.images[0].url} alt={selectedProduct.name} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center"><ImageIcon className="w-5 h-5 text-gray-300" /></div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{selectedProduct.name}</p>
                        <p className="text-xs text-gray-500">Current price: {fmt(selectedProduct.price)}</p>
                      </div>
                      <button type="button" onClick={() => setSelectedProduct(null)} className="p-1 text-gray-400 hover:text-gray-600">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <div>
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                          type="text"
                          className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-gray-300"
                          placeholder="Type to search products..."
                          value={productSearch}
                          onChange={(e) => setProductSearch(e.target.value)}
                          autoFocus
                        />
                      </div>
                      {searchingProducts && (
                        <div className="flex items-center gap-2 py-3 text-sm text-gray-500">
                          <Loader2 className="w-4 h-4 animate-spin" /> Searching…
                        </div>
                      )}
                      {productResults.length > 0 && (
                        <div className="border border-gray-200 rounded-lg mt-2 max-h-48 overflow-y-auto divide-y divide-gray-100">
                          {productResults.map((p) => (
                            <button
                              key={p.id}
                              type="button"
                              onClick={() => {
                                setSelectedProduct(p);
                                setProductSearch("");
                                setProductResults([]);
                              }}
                              className="w-full flex items-center gap-3 p-2.5 hover:bg-gray-50 text-left"
                            >
                              <div className="w-10 h-10 rounded-lg bg-gray-100 overflow-hidden flex-shrink-0">
                                {p.images?.[0] ? (
                                  <img src={p.images[0].url} alt={p.name} className="w-full h-full object-cover" />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center"><ImageIcon className="w-4 h-4 text-gray-300" /></div>
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-gray-900 truncate">{p.name}</p>
                                <p className="text-xs text-gray-500">{fmt(p.price)} · {p.stock} in stock</p>
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                      {productSearch.length >= 2 && !searchingProducts && productResults.length === 0 && (
                        <p className="text-sm text-gray-400 py-2 text-center">No products found</p>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Edit: show current product info */}
              {editDeal && (
                <div className="flex items-center gap-3 bg-gray-50 rounded-lg p-3">
                  <div className="w-12 h-12 rounded-lg bg-white border border-gray-200 overflow-hidden flex-shrink-0">
                    {editDeal.images?.[0] ? (
                      <img src={editDeal.images[0].url} alt={editDeal.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center"><ImageIcon className="w-5 h-5 text-gray-300" /></div>
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">{editDeal.name}</p>
                    <p className="text-xs text-gray-500">Original: {fmt(editDeal.price)}</p>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Deal Price (UGX) *</label>
                <input
                  type="number"
                  className={INPUT_CLS}
                  placeholder="e.g. 25000"
                  value={dealPrice}
                  onChange={(e) => setDealPrice(e.target.value)}
                  required
                  min="1"
                />
                {dealPrice && (selectedProduct || editDeal) && (
                  <p className="text-xs text-gray-500 mt-1">
                    Discount: <span className="font-semibold text-green-700">
                      {calcDiscount(Number((editDeal || selectedProduct)!.price), parseFloat(dealPrice))}% off
                    </span>
                    {" "}(saves {fmt(Number((editDeal || selectedProduct)!.price) - parseFloat(dealPrice))})
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Deal Date *</label>
                <input
                  type="date"
                  className={INPUT_CLS}
                  value={dealDate}
                  onChange={(e) => setDealDate(e.target.value)}
                  required
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setCreateOpen(false)} className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving || (!editDeal && !selectedProduct)}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm bg-gray-900 text-white rounded-lg hover:bg-gray-800 disabled:opacity-50"
                >
                  {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                  {editDeal ? "Update Deal" : "Create Deal"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
