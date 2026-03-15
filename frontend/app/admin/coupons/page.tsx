"use client";

import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api";
import type { Coupon } from "@/lib/types/api";
import {
  Tag, Plus, Search, Copy, Check, Edit, Trash2, X, Download,
  ChevronDown, ToggleLeft, ToggleRight, Sparkles, ArrowUpDown,
} from "lucide-react";

// Extended coupon with fields the backend actually returns beyond the base type
interface CouponRow extends Coupon {
  usageLimit: number | null;
  usedCount: number;
  usageCount?: number;
  createdAt?: string;
}

type FilterType = "all" | "active" | "scheduled" | "expired" | "inactive";
type SortType = "newest" | "expiring" | "usage" | "value";

const INPUT_CLS =
  "w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10 focus:border-gray-400";

function getCouponStatus(c: CouponRow): "active" | "scheduled" | "expired" | "inactive" {
  if (!c.active) return "inactive";
  const now = Date.now();
  if (now < new Date(c.validFrom).getTime()) return "scheduled";
  if (now > new Date(c.validUntil).getTime()) return "expired";
  return "active";
}

function daysUntil(d: string): number {
  return Math.ceil((new Date(d).getTime() - Date.now()) / 86400000);
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function genCode(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  return Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

function StatusBadge({ status }: { status: string }) {
  const cls: Record<string, string> = {
    active: "bg-gray-900 text-white",
    scheduled: "bg-gray-200 text-gray-700",
    expired: "bg-gray-200 text-gray-700",
    inactive: "bg-gray-100 text-gray-600",
  };
  return (
    <span className={`inline-flex items-center text-xs px-2.5 py-1 rounded-full font-medium capitalize ${cls[status] || cls.inactive}`}>
      {status}
    </span>
  );
}

const EMPTY_FORM = {
  code: "",
  description: "",
  type: "PERCENTAGE" as "PERCENTAGE" | "FIXED",
  value: "",
  minOrderAmount: "",
  maxDiscount: "",
  usageLimit: "",
  validFrom: "",
  validUntil: "",
  active: true,
};

const SORT_LABELS: Record<SortType, string> = {
  newest: "Newest",
  expiring: "Expiring Soon",
  usage: "Most Used",
  value: "Highest Value",
};

export default function CouponsPage() {
  const [coupons, setCoupons] = useState<CouponRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterType>("all");
  const [sort, setSort] = useState<SortType>("newest");
  const [sortOpen, setSortOpen] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const [panelOpen, setPanelOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const loadCoupons = useCallback(async () => {
    try {
      setLoading(true);
      const data = await api.admin.getCoupons();
      setCoupons((data.coupons || []) as CouponRow[]);
    } catch (err) {
      console.error("Failed to load coupons:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadCoupons(); }, [loadCoupons]);
  useEffect(() => { setSelectedIds([]); }, [search, filter, sort]);

  // --- Filtering & sorting (client-side) ---
  const filtered = coupons
    .filter((c) => {
      if (filter !== "all" && getCouponStatus(c) !== filter) return false;
      if (search) {
        const q = search.toLowerCase();
        return c.code.toLowerCase().includes(q) || (c.description || "").toLowerCase().includes(q);
      }
      return true;
    })
    .sort((a, b) => {
      switch (sort) {
        case "newest": return new Date(b.createdAt || b.validFrom).getTime() - new Date(a.createdAt || a.validFrom).getTime();
        case "expiring": return new Date(a.validUntil).getTime() - new Date(b.validUntil).getTime();
        case "usage": return (b.usageCount ?? b.usedCount ?? 0) - (a.usageCount ?? a.usedCount ?? 0);
        case "value": return Number(b.value) - Number(a.value);
        default: return 0;
      }
    });

  // --- Stats ---
  const stats = (() => {
    const active = coupons.filter((c) => getCouponStatus(c) === "active").length;
    const scheduled = coupons.filter((c) => getCouponStatus(c) === "scheduled").length;
    const expired = coupons.filter((c) => getCouponStatus(c) === "expired").length;
    const redemptions = coupons.reduce((s, c) => s + (c.usageCount ?? c.usedCount ?? 0), 0);
    const savings = coupons.reduce((s, c) => {
      const used = c.usageCount ?? c.usedCount ?? 0;
      if (c.type === "FIXED") return s + Number(c.value) * used;
      const base = c.minOrderAmount ? Number(c.minOrderAmount) : 50000;
      return s + (base * Number(c.value) / 100) * used;
    }, 0);
    return { total: coupons.length, active, scheduled, expired, redemptions, savings };
  })();

  const filterCounts: Record<FilterType, number> = {
    all: coupons.length,
    active: stats.active,
    scheduled: stats.scheduled,
    expired: stats.expired,
    inactive: coupons.filter((c) => getCouponStatus(c) === "inactive").length,
  };

  // --- Actions ---
  const copyCode = (id: string, code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const openCreate = () => { setEditingId(null); setForm(EMPTY_FORM); setPanelOpen(true); };

  const openEdit = (c: CouponRow) => {
    setEditingId(c.id);
    setForm({
      code: c.code,
      description: c.description || "",
      type: c.type,
      value: String(c.value),
      minOrderAmount: c.minOrderAmount != null ? String(c.minOrderAmount) : "",
      maxDiscount: c.maxDiscount != null ? String(c.maxDiscount) : "",
      usageLimit: c.usageLimit != null ? String(c.usageLimit) : "",
      validFrom: c.validFrom ? new Date(c.validFrom).toISOString().slice(0, 16) : "",
      validUntil: c.validUntil ? new Date(c.validUntil).toISOString().slice(0, 16) : "",
      active: c.active,
    });
    setPanelOpen(true);
  };

  const handleDuplicate = (c: CouponRow) => {
    setEditingId(null);
    setForm({
      code: c.code + "-COPY",
      description: c.description || "",
      type: c.type,
      value: String(c.value),
      minOrderAmount: c.minOrderAmount != null ? String(c.minOrderAmount) : "",
      maxDiscount: c.maxDiscount != null ? String(c.maxDiscount) : "",
      usageLimit: c.usageLimit != null ? String(c.usageLimit) : "",
      validFrom: c.validFrom ? new Date(c.validFrom).toISOString().slice(0, 16) : "",
      validUntil: c.validUntil ? new Date(c.validUntil).toISOString().slice(0, 16) : "",
      active: false,
    });
    setPanelOpen(true);
  };

  const buildPayload = () => ({
    code: form.code.toUpperCase(),
    description: form.description || null,
    type: form.type,
    value: parseFloat(form.value),
    minOrderAmount: form.minOrderAmount ? parseFloat(form.minOrderAmount) : null,
    maxDiscount: form.maxDiscount ? parseFloat(form.maxDiscount) : null,
    usageLimit: form.usageLimit ? parseInt(form.usageLimit) : null,
    validFrom: form.validFrom ? new Date(form.validFrom).toISOString() : new Date().toISOString(),
    validUntil: form.validUntil ? new Date(form.validUntil).toISOString() : new Date(Date.now() + 30 * 86400000).toISOString(),
    active: form.active,
  });

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = buildPayload() as Partial<Coupon>;
      if (editingId) await api.admin.updateCoupon(editingId, payload);
      else await api.admin.createCoupon(payload);
      setPanelOpen(false);
      loadCoupons();
    } catch (err) {
      console.error("Failed to save coupon:", err);
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (c: CouponRow) => {
    try {
      await api.admin.updateCoupon(c.id, { active: !c.active } as Partial<Coupon>);
      loadCoupons();
    } catch (err) {
      console.error("Failed to toggle coupon:", err);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this coupon? This cannot be undone.")) return;
    try {
      await api.admin.deleteCoupon(id);
      loadCoupons();
    } catch (err) {
      console.error("Failed to delete coupon:", err);
    }
  };

  // --- Bulk ---
  const toggleSelect = (id: string) =>
    setSelectedIds((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  const toggleAll = () =>
    setSelectedIds((p) => (p.length === filtered.length ? [] : filtered.map((c) => c.id)));

  const bulkSetActive = async (active: boolean) => {
    try {
      await Promise.all(selectedIds.map((id) => api.admin.updateCoupon(id, { active } as Partial<Coupon>)));
      setSelectedIds([]);
      loadCoupons();
    } catch (err) { console.error("Bulk action failed:", err); }
  };

  const bulkDelete = async () => {
    if (!confirm(`Delete ${selectedIds.length} coupons?`)) return;
    try {
      await Promise.all(selectedIds.map((id) => api.admin.deleteCoupon(id)));
      setSelectedIds([]);
      loadCoupons();
    } catch (err) { console.error("Bulk delete failed:", err); }
  };

  // --- CSV Export ---
  const exportCSV = () => {
    const headers = ["Code", "Description", "Type", "Value", "MinOrder", "MaxDiscount", "UsageLimit", "UsedCount", "ValidFrom", "ValidUntil", "Status"];
    const rows = filtered.map((c) => [
      c.code, c.description || "", c.type, String(c.value),
      c.minOrderAmount != null ? String(c.minOrderAmount) : "",
      c.maxDiscount != null ? String(c.maxDiscount) : "",
      c.usageLimit != null ? String(c.usageLimit) : "",
      String(c.usageCount ?? c.usedCount ?? 0),
      fmtDate(c.validFrom), fmtDate(c.validUntil), getCouponStatus(c),
    ]);
    const csv = [headers, ...rows].map((r) => r.map((v) => `"${v}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `coupons-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
  };

  // --- Render helpers ---
  const usedOf = (c: CouponRow) => c.usageCount ?? c.usedCount ?? 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Coupons</h1>
          <p className="text-sm text-gray-500 mt-0.5">Manage discount codes and promotions</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={exportCSV} className="px-3 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors flex items-center gap-1.5">
            <Download className="w-4 h-4" /> Export CSV
          </button>
          <button onClick={openCreate} className="px-3 py-2 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors flex items-center gap-1.5">
            <Plus className="w-4 h-4" /> Create Coupon
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
        {[
          { label: "Total Coupons", val: stats.total },
          { label: "Active", val: stats.active },
          { label: "Scheduled", val: stats.scheduled },
          { label: "Expired", val: stats.expired },
          { label: "Total Redemptions", val: stats.redemptions },
          { label: "Est. Total Savings", val: `UGX ${Number(stats.savings.toFixed(0)).toLocaleString()}` },
        ].map((s) => (
          <div key={s.label} className="bg-white rounded-lg border border-gray-200 p-4">
            <p className="text-xs text-gray-500">{s.label}</p>
            <p className="text-xl font-semibold text-gray-900 font-mono mt-1">
              {typeof s.val === "number" ? s.val.toLocaleString() : s.val}
            </p>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search by code or description..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10 focus:border-gray-400"
          />
        </div>
        <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-0.5">
          {(["all", "active", "scheduled", "expired", "inactive"] as FilterType[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                filter === f ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
              <span className="ml-1 text-gray-400 font-mono">{filterCounts[f]}</span>
            </button>
          ))}
        </div>
        <div className="relative">
          <button
            onClick={() => setSortOpen(!sortOpen)}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-1.5"
          >
            <ArrowUpDown className="w-3.5 h-3.5" />
            {SORT_LABELS[sort]}
            <ChevronDown className="w-3.5 h-3.5" />
          </button>
          {sortOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setSortOpen(false)} />
              <div className="absolute right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-20 py-1 min-w-[160px]">
                {(Object.entries(SORT_LABELS) as [SortType, string][]).map(([k, label]) => (
                  <button
                    key={k}
                    onClick={() => { setSort(k); setSortOpen(false); }}
                    className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-50 ${sort === k ? "font-medium text-gray-900" : "text-gray-600"}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Bulk Actions */}
      {selectedIds.length > 0 && (
        <div className="flex items-center gap-3 bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5">
          <span className="text-sm font-medium text-gray-700">{selectedIds.length} selected</span>
          <div className="h-4 w-px bg-gray-300" />
          <button onClick={() => bulkSetActive(true)} className="text-xs font-medium text-gray-700 hover:text-gray-900 px-2 py-1 rounded hover:bg-gray-200">Activate All</button>
          <button onClick={() => bulkSetActive(false)} className="text-xs font-medium text-gray-700 hover:text-gray-900 px-2 py-1 rounded hover:bg-gray-200">Deactivate All</button>
          <button onClick={bulkDelete} className="text-xs font-medium text-gray-700 hover:text-gray-900 px-2 py-1 rounded hover:bg-gray-200">Delete Selected</button>
        </div>
      )}

      {/* Table */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/80">
                <th className="px-4 py-3 w-10">
                  <input type="checkbox" checked={selectedIds.length === filtered.length && filtered.length > 0} onChange={toggleAll} className="rounded border-gray-300" />
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Code</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Description</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Type / Value</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Min Order</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Usage</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Valid Period</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    <td colSpan={9} className="px-4 py-4">
                      <div className="h-4 bg-gray-100 rounded animate-pulse" style={{ width: `${60 + Math.random() * 30}%` }} />
                    </td>
                  </tr>
                ))
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center">
                    <Tag className="w-10 h-10 text-gray-200 mx-auto mb-3" />
                    <p className="text-sm text-gray-500">No coupons found</p>
                    <p className="text-xs text-gray-400 mt-1">
                      {search || filter !== "all" ? "Try adjusting your filters" : "Create your first coupon to get started"}
                    </p>
                    {!search && filter === "all" && (
                      <button onClick={openCreate} className="mt-3 px-3 py-1.5 bg-gray-900 text-white rounded-lg text-xs font-medium hover:bg-gray-800">
                        <Plus className="w-3.5 h-3.5 inline mr-1" />Create Coupon
                      </button>
                    )}
                  </td>
                </tr>
              ) : filtered.map((c) => {
                const used = usedOf(c);
                const limit = c.usageLimit;
                const status = getCouponStatus(c);
                const days = daysUntil(c.validUntil);
                return (
                  <tr key={c.id} className={`hover:bg-gray-50/50 transition-colors ${selectedIds.includes(c.id) ? "bg-gray-50" : ""}`}>
                    <td className="px-4 py-3">
                      <input type="checkbox" checked={selectedIds.includes(c.id)} onChange={() => toggleSelect(c.id)} className="rounded border-gray-300" />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono font-bold text-sm text-gray-900">{c.code}</span>
                        <button onClick={() => copyCode(c.id, c.code)} className="p-0.5 hover:bg-gray-100 rounded text-gray-400 hover:text-gray-600" title="Copy code">
                          {copiedId === c.id ? <Check className="w-3.5 h-3.5 text-gray-900" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 max-w-[200px] truncate">{c.description || "—"}</td>
                    <td className="px-4 py-3">
                      <span className="font-mono text-sm font-medium text-gray-900">
                        {c.type === "PERCENTAGE" ? `${Number(c.value)}% OFF` : `UGX ${Number(c.value).toLocaleString()} OFF`}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-sm text-gray-600">
                      {c.minOrderAmount != null ? `UGX ${Number(c.minOrderAmount).toLocaleString()}` : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-mono text-sm text-gray-900">{used}{limit ? ` / ${limit}` : ""}</span>
                      {limit != null && limit > 0 && (
                        <div className="w-16 h-1 bg-gray-100 rounded-full mt-1">
                          <div className="h-1 bg-gray-400 rounded-full" style={{ width: `${Math.min(100, (used / limit) * 100)}%` }} />
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-xs text-gray-600">{fmtDate(c.validFrom)} — {fmtDate(c.validUntil)}</p>
                      {status === "active" && days <= 7 && days > 0 && (
                        <p className="text-xs text-gray-500 mt-0.5">{days}d remaining</p>
                      )}
                      {status === "scheduled" && (
                        <p className="text-xs text-gray-500 mt-0.5">Starts in {Math.abs(daysUntil(c.validFrom))}d</p>
                      )}
                    </td>
                    <td className="px-4 py-3"><StatusBadge status={status} /></td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => openEdit(c)} className="p-1.5 hover:bg-gray-100 rounded-lg" title="Edit">
                          <Edit className="w-4 h-4 text-gray-500" />
                        </button>
                        <button onClick={() => handleDuplicate(c)} className="p-1.5 hover:bg-gray-100 rounded-lg" title="Duplicate">
                          <Copy className="w-4 h-4 text-gray-500" />
                        </button>
                        <button onClick={() => handleToggleActive(c)} className="p-1.5 hover:bg-gray-100 rounded-lg" title={c.active ? "Deactivate" : "Activate"}>
                          {c.active ? <ToggleRight className="w-4 h-4 text-gray-900" /> : <ToggleLeft className="w-4 h-4 text-gray-400" />}
                        </button>
                        <button onClick={() => handleDelete(c.id)} className="p-1.5 hover:bg-gray-100 rounded-lg" title="Delete">
                          <Trash2 className="w-4 h-4 text-gray-500" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Slide-over Panel */}
      {panelOpen && (
        <>
          <div className="fixed inset-0 bg-black/30 z-40" onClick={() => setPanelOpen(false)} />
          <div className="fixed inset-y-0 right-0 w-full max-w-md bg-white shadow-xl z-50 flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">{editingId ? "Edit Coupon" : "Create Coupon"}</h2>
              <button onClick={() => setPanelOpen(false)} className="p-1.5 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <form onSubmit={handleSave} className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
              {/* Code */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Coupon Code *</label>
                <div className="flex gap-2">
                  <input
                    className={INPUT_CLS + " flex-1 uppercase font-mono"}
                    required
                    placeholder="e.g. SUMMER20"
                    value={form.code}
                    onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                  />
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, code: genCode() })}
                    className="px-3 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors flex items-center gap-1 whitespace-nowrap"
                  >
                    <Sparkles className="w-3.5 h-3.5" /> Random
                  </button>
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <input className={INPUT_CLS} placeholder="e.g. Summer sale 20% off" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              </div>

              {/* Discount Type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Discount Type</label>
                <div className="flex gap-2">
                  {(["PERCENTAGE", "FIXED"] as const).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setForm({ ...form, type: t })}
                      className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                        form.type === t ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                      }`}
                    >
                      {t === "PERCENTAGE" ? "Percentage (%)" : "Fixed (UGX)"}
                    </button>
                  ))}
                </div>
              </div>

              {/* Value */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Discount Value *</label>
                <input
                  className={INPUT_CLS}
                  type="number"
                  required
                  min="0"
                  step={form.type === "PERCENTAGE" ? "1" : "100"}
                  max={form.type === "PERCENTAGE" ? "100" : undefined}
                  placeholder={form.type === "PERCENTAGE" ? "e.g. 20" : "e.g. 5000"}
                  value={form.value}
                  onChange={(e) => setForm({ ...form, value: e.target.value })}
                />
              </div>

              {/* Min Order */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Min Order Amount</label>
                <input className={INPUT_CLS} type="number" min="0" step="100" placeholder="Optional" value={form.minOrderAmount} onChange={(e) => setForm({ ...form, minOrderAmount: e.target.value })} />
              </div>

              {/* Max Discount — percentage only */}
              {form.type === "PERCENTAGE" && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Max Discount (UGX)</label>
                  <input className={INPUT_CLS} type="number" min="0" step="100" placeholder="Optional cap" value={form.maxDiscount} onChange={(e) => setForm({ ...form, maxDiscount: e.target.value })} />
                </div>
              )}

              {/* Usage Limit */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Usage Limit</label>
                <input className={INPUT_CLS} type="number" min="0" placeholder="0 = unlimited" value={form.usageLimit} onChange={(e) => setForm({ ...form, usageLimit: e.target.value })} />
                <p className="text-xs text-gray-400 mt-1">Leave empty or 0 for unlimited uses</p>
              </div>

              {/* Dates */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Valid From</label>
                  <input className={INPUT_CLS} type="datetime-local" value={form.validFrom} onChange={(e) => setForm({ ...form, validFrom: e.target.value })} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Valid Until</label>
                  <input className={INPUT_CLS} type="datetime-local" value={form.validUntil} onChange={(e) => setForm({ ...form, validUntil: e.target.value })} />
                </div>
              </div>

              {/* Active Toggle */}
              <div className="flex items-center justify-between py-2">
                <div>
                  <p className="text-sm font-medium text-gray-700">Active</p>
                  <p className="text-xs text-gray-400">Enable this coupon immediately</p>
                </div>
                <button
                  type="button"
                  onClick={() => setForm({ ...form, active: !form.active })}
                  className={`relative w-11 h-6 rounded-full transition-colors ${form.active ? "bg-gray-900" : "bg-gray-200"}`}
                >
                  <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${form.active ? "translate-x-5" : ""}`} />
                </button>
              </div>
            </form>

            {/* Panel footer */}
            <div className="border-t border-gray-200 px-6 py-4 flex items-center gap-3">
              <button type="button" onClick={() => setPanelOpen(false)} className="flex-1 px-4 py-2.5 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors">
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !form.code || !form.value}
                className="flex-1 px-4 py-2.5 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? "Saving..." : editingId ? "Update Coupon" : "Create Coupon"}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
