"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import {
  Plus, Edit, Trash2, Tag, Search, Copy, Check, Calendar,
  Percent, DollarSign, Users, Clock, AlertTriangle, X,
  Sparkles, Gift, ChevronDown, ArrowUpDown, Flame, Ban,
} from "lucide-react";

interface Coupon {
  id: string;
  code: string;
  description: string;
  type: string;
  value: number;
  minOrderAmount: number;
  maxDiscount: number;
  maxPerUser: number;
  usageLimit: number;
  usedCount: number;
  validFrom: string;
  validUntil: string;
  active: boolean;
}

type FilterType = "all" | "active" | "expired" | "scheduled" | "inactive";
type SortType = "newest" | "expiring" | "usage" | "value";

function getDaysRemaining(until: string): number {
  return Math.ceil((new Date(until).getTime() - Date.now()) / 86400000);
}

function CouponStatusBadge({ coupon }: { coupon: Coupon }) {
  const now = new Date();
  const from = new Date(coupon.validFrom);
  const until = new Date(coupon.validUntil);
  if (!coupon.active) return <span className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full font-medium bg-gray-100 text-gray-600"><Ban className="w-3 h-3" />Inactive</span>;
  if (now < from) return <span className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full font-medium bg-blue-100 text-blue-700"><Clock className="w-3 h-3" />Scheduled</span>;
  if (now > until) return <span className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full font-medium bg-red-100 text-red-700"><AlertTriangle className="w-3 h-3" />Expired</span>;
  if (coupon.usageLimit && coupon.usedCount >= coupon.usageLimit) return <span className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full font-medium bg-orange-100 text-orange-700"><AlertTriangle className="w-3 h-3" />Exhausted</span>;
  const days = getDaysRemaining(coupon.validUntil);
  if (days <= 7) return <span className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full font-medium bg-amber-100 text-amber-700"><Flame className="w-3 h-3" />Expiring Soon</span>;
  return <span className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full font-medium bg-green-100 text-green-700"><Check className="w-3 h-3" />Active</span>;
}

function getCouponStatusKey(coupon: Coupon): string {
  const now = new Date();
  if (!coupon.active) return "inactive";
  if (now < new Date(coupon.validFrom)) return "scheduled";
  if (now > new Date(coupon.validUntil)) return "expired";
  if (coupon.usageLimit && coupon.usedCount >= coupon.usageLimit) return "exhausted";
  return "active";
}

const emptyForm = {
  code: "", description: "", type: "PERCENTAGE", value: 0,
  minOrderAmount: 0, maxDiscount: 0, maxPerUser: 0,
  usageLimit: 0, validFrom: "", validUntil: "", active: true,
};

export default function AdminCouponsPage() {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<FilterType>("all");
  const [sortType, setSortType] = useState<SortType>("newest");
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({ ...emptyForm });

  const loadCoupons = () => {
    setLoading(true);
    api.admin.getCoupons()
      .then((data: any) => setCoupons(data.coupons || data))
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadCoupons(); }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editingId) {
        await api.admin.updateCoupon(editingId, formData as any);
      } else {
        await api.admin.createCoupon(formData as any);
      }
      setShowForm(false);
      setEditingId(null);
      setFormData({ ...emptyForm });
      loadCoupons();
    } catch (err) {
      console.error("Failed to save coupon:", err);
      alert("Failed to save coupon");
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (coupon: Coupon) => {
    setFormData({
      code: coupon.code,
      description: coupon.description || "",
      type: coupon.type,
      value: Number(coupon.value),
      minOrderAmount: Number(coupon.minOrderAmount) || 0,
      maxDiscount: Number(coupon.maxDiscount) || 0,
      maxPerUser: Number(coupon.maxPerUser) || 0,
      usageLimit: coupon.usageLimit || 0,
      validFrom: coupon.validFrom.split("T")[0],
      validUntil: coupon.validUntil.split("T")[0],
      active: coupon.active,
    });
    setEditingId(coupon.id);
    setShowForm(true);
  };

  const handleDuplicate = (coupon: Coupon) => {
    const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
    const nextYear = new Date(); nextYear.setFullYear(nextYear.getFullYear() + 1);
    setFormData({
      code: coupon.code + "_2",
      description: coupon.description || "",
      type: coupon.type,
      value: Number(coupon.value),
      minOrderAmount: Number(coupon.minOrderAmount) || 0,
      maxDiscount: Number(coupon.maxDiscount) || 0,
      maxPerUser: Number(coupon.maxPerUser) || 0,
      usageLimit: coupon.usageLimit || 0,
      validFrom: tomorrow.toISOString().split("T")[0],
      validUntil: nextYear.toISOString().split("T")[0],
      active: true,
    });
    setEditingId(null);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this coupon?")) return;
    await api.admin.deleteCoupon(id);
    loadCoupons();
  };

  const handleToggleActive = async (coupon: Coupon) => {
    await api.admin.updateCoupon(coupon.id, { active: !coupon.active } as any);
    loadCoupons();
  };

  const copyToClipboard = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const generateCode = () => {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    setFormData((f) => ({ ...f, code: Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join("") }));
  };

  const filtered = coupons
    .filter((c) => {
      const matchSearch = c.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (c.description || "").toLowerCase().includes(searchQuery.toLowerCase());
      if (!matchSearch) return false;
      const sk = getCouponStatusKey(c);
      if (filterType === "all") return true;
      if (filterType === "active") return sk === "active";
      if (filterType === "expired") return sk === "expired";
      if (filterType === "scheduled") return sk === "scheduled";
      if (filterType === "inactive") return sk === "inactive";
      return true;
    })
    .sort((a, b) => {
      if (sortType === "expiring") return new Date(a.validUntil).getTime() - new Date(b.validUntil).getTime();
      if (sortType === "usage") return b.usedCount - a.usedCount;
      if (sortType === "value") return Number(b.value) - Number(a.value);
      return new Date(b.validFrom).getTime() - new Date(a.validFrom).getTime();
    });

  const stats = {
    total: coupons.length,
    active: coupons.filter((c) => getCouponStatusKey(c) === "active").length,
    expired: coupons.filter((c) => getCouponStatusKey(c) === "expired").length,
    scheduled: coupons.filter((c) => getCouponStatusKey(c) === "scheduled").length,
    totalUsage: coupons.reduce((s, c) => s + c.usedCount, 0),
    avgDiscount: (() => {
      const pct = coupons.filter((c) => c.type === "PERCENTAGE");
      return pct.length ? Math.round(pct.reduce((s, c) => s + Number(c.value), 0) / pct.length) : 0;
    })(),
  };

  const filterCounts: Record<FilterType, number> = {
    all: coupons.length,
    active: stats.active,
    expired: stats.expired,
    scheduled: stats.scheduled,
    inactive: coupons.filter((c) => !c.active).length,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">Coupons</h1>
          <p className="text-gray-500 mt-1">Manage discount codes and promotions</p>
        </div>
        <button
          onClick={() => { setFormData({ ...emptyForm }); setEditingId(null); setShowForm(true); }}
          className="flex items-center gap-2 px-4 py-2.5 bg-primary text-white rounded-lg font-medium hover:bg-primary/90 transition-colors shadow-sm"
        >
          <Plus className="w-5 h-5" />
          Create Coupon
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
        {[
          { label: "Total", value: stats.total, icon: Tag, color: "bg-purple-100 text-purple-600" },
          { label: "Active", value: stats.active, icon: Check, color: "bg-green-100 text-green-600" },
          { label: "Scheduled", value: stats.scheduled, icon: Clock, color: "bg-blue-100 text-blue-600" },
          { label: "Expired", value: stats.expired, icon: AlertTriangle, color: "bg-red-100 text-red-600" },
          { label: "Times Used", value: stats.totalUsage, icon: Users, color: "bg-indigo-100 text-indigo-600" },
          { label: "Avg % Off", value: `${stats.avgDiscount}%`, icon: Percent, color: "bg-amber-100 text-amber-600" },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-white rounded-xl border p-4 flex items-center gap-3">
            <div className={`p-2 rounded-lg ${color}`}><Icon className="w-4 h-4" /></div>
            <div><p className="text-xl font-bold text-gray-900">{value}</p><p className="text-xs text-gray-500">{label}</p></div>
          </div>
        ))}
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b sticky top-0 bg-white z-10">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-purple-100">
                  <Gift className="w-5 h-5 text-purple-600" />
                </div>
                <h2 className="text-xl font-semibold">{editingId ? "Edit Coupon" : "Create New Coupon"}</h2>
              </div>
              <button onClick={() => setShowForm(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-5">
              {/* Code & Type */}
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Coupon Code *</label>
                  <div className="flex gap-2">
                    <input
                      className="flex-1 px-3 py-2.5 border rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary font-mono uppercase tracking-widest"
                      value={formData.code}
                      onChange={(e) => setFormData((f) => ({ ...f, code: e.target.value.toUpperCase() }))}
                      placeholder="SAVE20"
                      required
                    />
                    <button type="button" onClick={generateCode} className="px-3 py-2.5 border rounded-lg hover:bg-gray-50 transition-colors" title="Generate random code">
                      <Sparkles className="w-5 h-5 text-gray-500" />
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Discount Type *</label>
                  <div className="flex gap-2">
                    {[
                      { val: "PERCENTAGE", label: "Percentage", Icon: Percent },
                      { val: "FIXED", label: "Fixed (USh)", Icon: DollarSign },
                    ].map(({ val, label, Icon }) => (
                      <button
                        key={val} type="button"
                        onClick={() => setFormData((f) => ({ ...f, type: val }))}
                        className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 border rounded-lg text-sm font-medium transition-colors ${formData.type === val ? "bg-primary text-white border-primary" : "hover:bg-gray-50"}`}
                      >
                        <Icon className="w-4 h-4" />{label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Description</label>
                <input
                  className="w-full px-3 py-2.5 border rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  value={formData.description}
                  onChange={(e) => setFormData((f) => ({ ...f, description: e.target.value }))}
                  placeholder="e.g., 20% off your first order"
                />
              </div>

              {/* Value, Min, Max */}
              <div className="grid md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Discount {formData.type === "PERCENTAGE" ? "(%)" : "(USh)"} *
                  </label>
                  <input
                    type="number" min="0" max={formData.type === "PERCENTAGE" ? 100 : undefined}
                    className="w-full px-3 py-2.5 border rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary"
                    value={formData.value || ""}
                    onChange={(e) => setFormData((f) => ({ ...f, value: Number(e.target.value) }))}
                    placeholder={formData.type === "PERCENTAGE" ? "20" : "5000"}
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Min Order (USh)</label>
                  <input
                    type="number" min="0"
                    className="w-full px-3 py-2.5 border rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary"
                    value={formData.minOrderAmount || ""}
                    onChange={(e) => setFormData((f) => ({ ...f, minOrderAmount: Number(e.target.value) }))}
                    placeholder="No minimum"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Max Discount (USh)</label>
                  <input
                    type="number" min="0"
                    className="w-full px-3 py-2.5 border rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary"
                    value={formData.maxDiscount || ""}
                    onChange={(e) => setFormData((f) => ({ ...f, maxDiscount: Number(e.target.value) }))}
                    placeholder="Unlimited"
                  />
                </div>
              </div>

              {/* Dates, Limits */}
              <div className="grid md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Start Date *</label>
                  <input
                    type="date"
                    className="w-full px-3 py-2.5 border rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary"
                    value={formData.validFrom}
                    onChange={(e) => setFormData((f) => ({ ...f, validFrom: e.target.value }))}
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">End Date *</label>
                  <input
                    type="date"
                    className="w-full px-3 py-2.5 border rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary"
                    value={formData.validUntil}
                    onChange={(e) => setFormData((f) => ({ ...f, validUntil: e.target.value }))}
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Total Usage Limit</label>
                  <input
                    type="number" min="0"
                    className="w-full px-3 py-2.5 border rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary"
                    value={formData.usageLimit || ""}
                    onChange={(e) => setFormData((f) => ({ ...f, usageLimit: Number(e.target.value) }))}
                    placeholder="Unlimited"
                  />
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Per-Customer Limit</label>
                  <input
                    type="number" min="0"
                    className="w-full px-3 py-2.5 border rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary"
                    value={formData.maxPerUser || ""}
                    onChange={(e) => setFormData((f) => ({ ...f, maxPerUser: Number(e.target.value) }))}
                    placeholder="Unlimited per customer"
                  />
                  <p className="text-xs text-gray-500 mt-1">How many times one customer can use this</p>
                </div>
                <div className="flex items-end pb-1">
                  <label className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50 w-full">
                    <input
                      type="checkbox"
                      checked={formData.active}
                      onChange={(e) => setFormData((f) => ({ ...f, active: e.target.checked }))}
                      className="w-5 h-5 rounded"
                    />
                    <div>
                      <p className="font-medium text-sm text-gray-900">Active</p>
                      <p className="text-xs text-gray-500">Customers can use this coupon</p>
                    </div>
                  </label>
                </div>
              </div>

              <div className="flex gap-3 pt-2 border-t">
                <button type="button" onClick={() => setShowForm(false)} className="flex-1 px-4 py-2.5 border rounded-lg font-medium hover:bg-gray-50">
                  Cancel
                </button>
                <button type="submit" disabled={saving} className="flex-1 px-4 py-2.5 bg-primary text-white rounded-lg font-medium hover:bg-primary/90 disabled:opacity-50">
                  {saving ? "Saving..." : editingId ? "Update Coupon" : "Create Coupon"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Filters + Sort */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search by code or description..."
            className="w-full pl-10 pr-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          {(["all", "active", "expired", "scheduled", "inactive"] as FilterType[]).map((type) => (
            <button
              key={type}
              onClick={() => setFilterType(type)}
              className={`px-3 py-2.5 rounded-lg text-sm font-medium capitalize transition-colors ${
                filterType === type ? "bg-primary text-white" : "bg-white border hover:bg-gray-50"
              }`}
            >
              {type} {filterCounts[type] > 0 && <span className={`ml-1 text-xs px-1.5 py-0.5 rounded-full ${filterType === type ? "bg-white/20" : "bg-gray-100"}`}>{filterCounts[type]}</span>}
            </button>
          ))}
        </div>
        <div className="relative">
          <select
            value={sortType}
            onChange={(e) => setSortType(e.target.value as SortType)}
            className="pl-9 pr-4 py-2.5 border rounded-lg text-sm bg-white focus:ring-2 focus:ring-primary/20 focus:border-primary appearance-none cursor-pointer"
          >
            <option value="newest">Newest First</option>
            <option value="expiring">Expiring Soon</option>
            <option value="usage">Most Used</option>
            <option value="value">Highest Value</option>
          </select>
          <ArrowUpDown className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
        </div>
      </div>

      {/* Coupons Grid */}
      {loading ? (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1,2,3].map((i) => (
            <div key={i} className="bg-white rounded-xl border p-6 animate-pulse h-64">
              <div className="h-8 bg-gray-200 rounded w-1/2 mb-4" />
              <div className="h-16 bg-gray-100 rounded mb-4" />
              <div className="space-y-2">
                <div className="h-4 bg-gray-200 rounded w-3/4" />
                <div className="h-4 bg-gray-200 rounded w-1/2" />
              </div>
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-xl border p-12 text-center">
          <Tag className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-1">No coupons found</h3>
          <p className="text-gray-500 mb-4">{searchQuery ? "Try adjusting your search" : "Create your first coupon to get started"}</p>
          {!searchQuery && (
            <button onClick={() => { setFormData({ ...emptyForm }); setShowForm(true); }} className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg font-medium hover:bg-primary/90">
              <Plus className="w-5 h-5" />Create Coupon
            </button>
          )}
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((coupon) => {
            const sk = getCouponStatusKey(coupon);
            const isExpiredOrInactive = sk === "expired" || sk === "inactive";
            const usagePct = coupon.usageLimit ? Math.min(100, (coupon.usedCount / coupon.usageLimit) * 100) : 0;
            const daysLeft = getDaysRemaining(coupon.validUntil);
            const isExpiringSoon = sk === "active" && daysLeft <= 7 && daysLeft >= 0;

            return (
              <div
                key={coupon.id}
                className={`bg-white rounded-xl border hover:shadow-md transition-all relative overflow-hidden ${isExpiredOrInactive ? "opacity-60" : ""} ${isExpiringSoon ? "border-amber-300 ring-1 ring-amber-200" : ""}`}
              >
                {/* Decorative stripe for active coupons */}
                {sk === "active" && !isExpiringSoon && (
                  <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-green-400 to-emerald-500" />
                )}
                {isExpiringSoon && (
                  <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-400 to-orange-400" />
                )}

                <div className="p-5">
                  {/* Header Row */}
                  <div className="flex items-start justify-between gap-2 mb-4">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className={`p-2 rounded-lg shrink-0 ${coupon.type === "PERCENTAGE" ? "bg-purple-100" : "bg-blue-100"}`}>
                        {coupon.type === "PERCENTAGE"
                          ? <Percent className="w-4 h-4 text-purple-600" />
                          : <DollarSign className="w-4 h-4 text-blue-600" />}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono font-bold text-gray-900 truncate">{coupon.code}</span>
                          <button onClick={() => copyToClipboard(coupon.code)} className="p-1 hover:bg-gray-100 rounded shrink-0" title="Copy code">
                            {copiedCode === coupon.code ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5 text-gray-400" />}
                          </button>
                        </div>
                        {coupon.description && <p className="text-xs text-gray-500 truncate">{coupon.description}</p>}
                      </div>
                    </div>
                    <CouponStatusBadge coupon={coupon} />
                  </div>

                  {/* Discount Value Display */}
                  <div className={`rounded-xl p-3 mb-4 text-center ${coupon.type === "PERCENTAGE" ? "bg-purple-50 border border-purple-100" : "bg-blue-50 border border-blue-100"}`}>
                    <span className={`text-3xl font-black ${coupon.type === "PERCENTAGE" ? "text-purple-700" : "text-blue-700"}`}>
                      {coupon.type === "PERCENTAGE" ? `${Number(coupon.value)}%` : `USh ${Number(coupon.value).toLocaleString()}`}
                    </span>
                    <p className={`text-xs font-semibold mt-0.5 ${coupon.type === "PERCENTAGE" ? "text-purple-500" : "text-blue-500"}`}>OFF</p>
                  </div>

                  {/* Details */}
                  <div className="space-y-1.5 text-xs mb-3">
                    <div className="flex justify-between text-gray-600">
                      <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" />Valid</span>
                      <span className="font-medium">{new Date(coupon.validFrom).toLocaleDateString()} – {new Date(coupon.validUntil).toLocaleDateString()}</span>
                    </div>
                    {isExpiringSoon && (
                      <div className="flex justify-between">
                        <span className="text-amber-600 font-semibold flex items-center gap-1"><Flame className="w-3.5 h-3.5" />Expires in</span>
                        <span className="text-amber-700 font-bold">{daysLeft} day{daysLeft !== 1 ? "s" : ""}</span>
                      </div>
                    )}
                    {coupon.minOrderAmount > 0 && (
                      <div className="flex justify-between text-gray-600">
                        <span>Min Order</span>
                        <span className="font-medium">USh {Number(coupon.minOrderAmount).toLocaleString()}</span>
                      </div>
                    )}
                    {coupon.maxDiscount > 0 && coupon.type === "PERCENTAGE" && (
                      <div className="flex justify-between text-gray-600">
                        <span>Max Discount</span>
                        <span className="font-medium">USh {Number(coupon.maxDiscount).toLocaleString()}</span>
                      </div>
                    )}
                    {coupon.maxPerUser > 0 && (
                      <div className="flex justify-between text-gray-600">
                        <span>Per Customer</span>
                        <span className="font-medium">{coupon.maxPerUser}×</span>
                      </div>
                    )}
                  </div>

                  {/* Usage Bar */}
                  <div className="mb-4">
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-gray-500">Usage</span>
                      <span className="font-semibold text-gray-700">
                        {coupon.usedCount.toLocaleString()}{coupon.usageLimit ? ` / ${coupon.usageLimit.toLocaleString()}` : " uses"}
                      </span>
                    </div>
                    {coupon.usageLimit > 0 && (
                      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${usagePct >= 90 ? "bg-red-500" : usagePct >= 60 ? "bg-amber-500" : "bg-green-500"}`}
                          style={{ width: `${usagePct}%` }}
                        />
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex gap-1.5 pt-3 border-t">
                    <button
                      onClick={() => handleToggleActive(coupon)}
                      className={`flex-1 px-3 py-2 rounded-lg text-xs font-semibold transition-colors ${coupon.active ? "bg-gray-100 hover:bg-gray-200 text-gray-700" : "bg-green-100 hover:bg-green-200 text-green-700"}`}
                    >
                      {coupon.active ? "Deactivate" : "Activate"}
                    </button>
                    <button onClick={() => handleEdit(coupon)} className="p-2 hover:bg-gray-100 rounded-lg transition-colors" title="Edit">
                      <Edit className="w-4 h-4 text-gray-500" />
                    </button>
                    <button onClick={() => handleDuplicate(coupon)} className="p-2 hover:bg-blue-50 rounded-lg transition-colors" title="Duplicate">
                      <Copy className="w-4 h-4 text-blue-500" />
                    </button>
                    <button onClick={() => handleDelete(coupon.id)} className="p-2 hover:bg-red-50 rounded-lg transition-colors" title="Delete">
                      <Trash2 className="w-4 h-4 text-red-500" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
