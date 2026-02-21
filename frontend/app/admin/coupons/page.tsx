"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { 
  Plus, 
  Edit, 
  Trash2, 
  Tag, 
  Search, 
  Copy, 
  Check, 
  Calendar,
  Percent,
  DollarSign,
  Users,
  TrendingUp,
  Clock,
  AlertTriangle,
  Filter,
  MoreVertical,
  Sparkles,
  Gift,
  X,
} from "lucide-react";

interface Coupon {
  id: string;
  code: string;
  description: string;
  type: string;
  value: number;
  minOrderAmount: number;
  maxDiscount: number;
  usageLimit: number;
  usedCount: number;
  validFrom: string;
  validUntil: string;
  active: boolean;
}

type FilterType = "all" | "active" | "expired" | "scheduled";

export default function AdminCouponsPage() {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<FilterType>("all");
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    code: "",
    description: "",
    type: "PERCENTAGE",
    value: 0,
    minOrderAmount: 0,
    maxDiscount: 0,
    usageLimit: 0,
    validFrom: "",
    validUntil: "",
    active: true,
  });

  const loadCoupons = () => {
    setLoading(true);
    api.admin.getCoupons()
      .then((data: any) => setCoupons(data.coupons || data))
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadCoupons();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingId) {
        await api.admin.updateCoupon(editingId, formData as any);
      } else {
        await api.admin.createCoupon(formData as any);
      }
      setShowForm(false);
      setEditingId(null);
      resetForm();
      loadCoupons();
    } catch (error) {
      console.error("Failed to save coupon:", error);
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
      usageLimit: coupon.usageLimit || 0,
      validFrom: coupon.validFrom.split("T")[0],
      validUntil: coupon.validUntil.split("T")[0],
      active: coupon.active,
    });
    setEditingId(coupon.id);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (confirm("Delete this coupon?")) {
      await api.admin.deleteCoupon(id);
      loadCoupons();
    }
  };

  const handleToggleActive = async (coupon: Coupon) => {
    try {
      await api.admin.updateCoupon(coupon.id, { active: !coupon.active });
      loadCoupons();
    } catch (error) {
      console.error("Failed to toggle coupon:", error);
    }
  };

  const copyToClipboard = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const generateRandomCode = () => {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let code = "";
    for (let i = 0; i < 8; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setFormData({ ...formData, code });
  };

  const resetForm = () => {
    setFormData({
      code: "",
      description: "",
      type: "PERCENTAGE",
      value: 0,
      minOrderAmount: 0,
      maxDiscount: 0,
      usageLimit: 0,
      validFrom: "",
      validUntil: "",
      active: true,
    });
  };

  const getCouponStatus = (coupon: Coupon) => {
    const now = new Date();
    const validFrom = new Date(coupon.validFrom);
    const validUntil = new Date(coupon.validUntil);
    
    if (!coupon.active) return { label: "Inactive", color: "bg-gray-100 text-gray-700", icon: X };
    if (now < validFrom) return { label: "Scheduled", color: "bg-blue-100 text-blue-700", icon: Clock };
    if (now > validUntil) return { label: "Expired", color: "bg-red-100 text-red-700", icon: AlertTriangle };
    if (coupon.usageLimit && coupon.usedCount >= coupon.usageLimit) return { label: "Exhausted", color: "bg-orange-100 text-orange-700", icon: AlertTriangle };
    return { label: "Active", color: "bg-green-100 text-green-700", icon: Check };
  };

  const filteredCoupons = coupons.filter((coupon) => {
    const matchesSearch = coupon.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      coupon.description?.toLowerCase().includes(searchQuery.toLowerCase());
    
    if (!matchesSearch) return false;
    
    const status = getCouponStatus(coupon);
    switch (filterType) {
      case "active": return status.label === "Active";
      case "expired": return status.label === "Expired";
      case "scheduled": return status.label === "Scheduled";
      default: return true;
    }
  });

  // Stats
  const stats = {
    total: coupons.length,
    active: coupons.filter(c => getCouponStatus(c).label === "Active").length,
    totalUsage: coupons.reduce((sum, c) => sum + c.usedCount, 0),
    avgDiscount: coupons.length > 0 
      ? Math.round(coupons.filter(c => c.type === "PERCENTAGE").reduce((sum, c) => sum + Number(c.value), 0) / Math.max(1, coupons.filter(c => c.type === "PERCENTAGE").length))
      : 0,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">Coupons</h1>
          <p className="text-gray-500 mt-1">Manage discount codes and promotions</p>
        </div>
        {!showForm && (
          <button
            onClick={() => { resetForm(); setShowForm(true); }}
            className="flex items-center gap-2 px-4 py-2.5 bg-primary text-white rounded-lg font-medium hover:bg-primary/90 transition-colors shadow-sm"
          >
            <Plus className="w-5 h-5" />
            Create Coupon
          </button>
        )}
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border p-4 flex items-center gap-4">
          <div className="p-3 rounded-xl bg-purple-100">
            <Tag className="w-5 h-5 text-purple-600" />
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
            <p className="text-sm text-gray-500">Total Coupons</p>
          </div>
        </div>
        <div className="bg-white rounded-xl border p-4 flex items-center gap-4">
          <div className="p-3 rounded-xl bg-green-100">
            <Check className="w-5 h-5 text-green-600" />
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900">{stats.active}</p>
            <p className="text-sm text-gray-500">Active</p>
          </div>
        </div>
        <div className="bg-white rounded-xl border p-4 flex items-center gap-4">
          <div className="p-3 rounded-xl bg-blue-100">
            <Users className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900">{stats.totalUsage}</p>
            <p className="text-sm text-gray-500">Times Used</p>
          </div>
        </div>
        <div className="bg-white rounded-xl border p-4 flex items-center gap-4">
          <div className="p-3 rounded-xl bg-amber-100">
            <Percent className="w-5 h-5 text-amber-600" />
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900">{stats.avgDiscount}%</p>
            <p className="text-sm text-gray-500">Avg Discount</p>
          </div>
        </div>
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-purple-100">
                  <Gift className="w-5 h-5 text-purple-600" />
                </div>
                <h2 className="text-xl font-semibold text-gray-900">
                  {editingId ? "Edit Coupon" : "Create New Coupon"}
                </h2>
              </div>
              <button
                onClick={() => { setShowForm(false); setEditingId(null); }}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              {/* Code & Type */}
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Coupon Code</label>
                  <div className="flex gap-2">
                    <input
                      className="flex-1 px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary uppercase font-mono"
                      value={formData.code}
                      onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                      placeholder="e.g., SAVE20"
                      required
                    />
                    <button
                      type="button"
                      onClick={generateRandomCode}
                      className="px-3 py-2.5 border rounded-lg hover:bg-gray-50 transition-colors"
                      title="Generate random code"
                    >
                      <Sparkles className="w-5 h-5 text-gray-500" />
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Discount Type</label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, type: "PERCENTAGE" })}
                      className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 border rounded-lg transition-colors ${
                        formData.type === "PERCENTAGE" 
                          ? "bg-primary text-white border-primary" 
                          : "hover:bg-gray-50"
                      }`}
                    >
                      <Percent className="w-4 h-4" />
                      Percentage
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, type: "FIXED" })}
                      className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 border rounded-lg transition-colors ${
                        formData.type === "FIXED" 
                          ? "bg-primary text-white border-primary" 
                          : "hover:bg-gray-50"
                      }`}
                    >
                      <DollarSign className="w-4 h-4" />
                      Fixed Amount
                    </button>
                  </div>
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Description (Optional)</label>
                <input
                  className="w-full px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="e.g., Summer sale discount"
                />
              </div>

              {/* Value Settings */}
              <div className="grid md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Discount Value {formData.type === "PERCENTAGE" ? "(%)" : "(USh)"}
                  </label>
                  <input
                    type="number"
                    className="w-full px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary"
                    value={formData.value || ""}
                    onChange={(e) => setFormData({ ...formData, value: Number(e.target.value) })}
                    placeholder={formData.type === "PERCENTAGE" ? "e.g., 20" : "e.g., 5000"}
                    min="0"
                    max={formData.type === "PERCENTAGE" ? "100" : undefined}
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Min Order (USh)</label>
                  <input
                    type="number"
                    className="w-full px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary"
                    value={formData.minOrderAmount || ""}
                    onChange={(e) => setFormData({ ...formData, minOrderAmount: Number(e.target.value) })}
                    placeholder="0 = no minimum"
                    min="0"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Max Discount (USh)</label>
                  <input
                    type="number"
                    className="w-full px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary"
                    value={formData.maxDiscount || ""}
                    onChange={(e) => setFormData({ ...formData, maxDiscount: Number(e.target.value) })}
                    placeholder="0 = unlimited"
                    min="0"
                  />
                </div>
              </div>

              {/* Validity Period */}
              <div className="grid md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <Calendar className="w-4 h-4 inline mr-1" />
                    Start Date
                  </label>
                  <input
                    type="date"
                    className="w-full px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary"
                    value={formData.validFrom}
                    onChange={(e) => setFormData({ ...formData, validFrom: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <Calendar className="w-4 h-4 inline mr-1" />
                    End Date
                  </label>
                  <input
                    type="date"
                    className="w-full px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary"
                    value={formData.validUntil}
                    onChange={(e) => setFormData({ ...formData, validUntil: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <Users className="w-4 h-4 inline mr-1" />
                    Usage Limit
                  </label>
                  <input
                    type="number"
                    className="w-full px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary"
                    value={formData.usageLimit || ""}
                    onChange={(e) => setFormData({ ...formData, usageLimit: Number(e.target.value) })}
                    placeholder="0 = unlimited"
                    min="0"
                  />
                </div>
              </div>

              {/* Active Toggle */}
              <label className="flex items-center gap-3 p-4 border rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                <input
                  type="checkbox"
                  checked={formData.active}
                  onChange={(e) => setFormData({ ...formData, active: e.target.checked })}
                  className="w-5 h-5 rounded border-gray-300 text-primary focus:ring-primary"
                />
                <div>
                  <span className="font-medium text-gray-900">Active</span>
                  <p className="text-sm text-gray-500">Enable this coupon for customers to use</p>
                </div>
              </label>

              {/* Actions */}
              <div className="flex gap-3 pt-4 border-t">
                <button
                  type="button"
                  onClick={() => { setShowForm(false); setEditingId(null); }}
                  className="flex-1 px-4 py-2.5 border rounded-lg font-medium hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="flex-1 px-4 py-2.5 bg-primary text-white rounded-lg font-medium hover:bg-primary/90 transition-colors"
                >
                  {editingId ? "Update Coupon" : "Create Coupon"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Search & Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search coupons..."
            className="w-full pl-10 pr-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="flex gap-2">
          {(["all", "active", "expired", "scheduled"] as FilterType[]).map((type) => (
            <button
              key={type}
              onClick={() => setFilterType(type)}
              className={`px-4 py-2.5 rounded-lg font-medium text-sm capitalize transition-colors ${
                filterType === type
                  ? "bg-primary text-white"
                  : "bg-white border hover:bg-gray-50"
              }`}
            >
              {type}
            </button>
          ))}
        </div>
      </div>

      {/* Coupons Grid */}
      {loading ? (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white rounded-xl border p-6 animate-pulse">
              <div className="h-8 bg-gray-200 rounded w-1/2 mb-4" />
              <div className="h-4 bg-gray-200 rounded w-3/4 mb-2" />
              <div className="h-4 bg-gray-200 rounded w-1/2" />
            </div>
          ))}
        </div>
      ) : filteredCoupons.length === 0 ? (
        <div className="bg-white rounded-xl border p-12 text-center">
          <Tag className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-1">No coupons found</h3>
          <p className="text-gray-500 mb-4">
            {searchQuery ? "Try adjusting your search" : "Create your first coupon to get started"}
          </p>
          {!searchQuery && (
            <button
              onClick={() => { resetForm(); setShowForm(true); }}
              className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg font-medium hover:bg-primary/90 transition-colors"
            >
              <Plus className="w-5 h-5" />
              Create Coupon
            </button>
          )}
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredCoupons.map((coupon) => {
            const status = getCouponStatus(coupon);
            const StatusIcon = status.icon;
            const usagePercent = coupon.usageLimit 
              ? Math.min(100, (coupon.usedCount / coupon.usageLimit) * 100)
              : 0;
            
            return (
              <div 
                key={coupon.id} 
                className="bg-white rounded-xl border hover:shadow-lg transition-all group relative overflow-hidden"
              >
                {/* Decorative corner */}
                <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-br from-primary/5 to-transparent" />
                
                <div className="p-6">
                  {/* Header */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className={`p-2.5 rounded-xl ${coupon.type === "PERCENTAGE" ? "bg-purple-100" : "bg-blue-100"}`}>
                        {coupon.type === "PERCENTAGE" ? (
                          <Percent className={`w-5 h-5 ${coupon.type === "PERCENTAGE" ? "text-purple-600" : "text-blue-600"}`} />
                        ) : (
                          <DollarSign className="w-5 h-5 text-blue-600" />
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-lg text-gray-900">{coupon.code}</span>
                          <button
                            onClick={() => copyToClipboard(coupon.code)}
                            className="p-1 hover:bg-gray-100 rounded transition-colors"
                            title="Copy code"
                          >
                            {copiedCode === coupon.code ? (
                              <Check className="w-4 h-4 text-green-500" />
                            ) : (
                              <Copy className="w-4 h-4 text-gray-400" />
                            )}
                          </button>
                        </div>
                        {coupon.description && (
                          <p className="text-sm text-gray-500 truncate max-w-[180px]">{coupon.description}</p>
                        )}
                      </div>
                    </div>
                    <span className={`inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full font-medium ${status.color}`}>
                      <StatusIcon className="w-3 h-3" />
                      {status.label}
                    </span>
                  </div>

                  {/* Discount Value */}
                  <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl p-4 mb-4 text-center">
                    <span className="text-3xl font-bold text-gray-900">
                      {coupon.type === "PERCENTAGE" ? `${Number(coupon.value)}%` : `USh ${Number(coupon.value).toLocaleString()}`}
                    </span>
                    <p className="text-sm text-gray-500 mt-1">
                      {coupon.type === "PERCENTAGE" ? "OFF" : "DISCOUNT"}
                    </p>
                  </div>

                  {/* Details */}
                  <div className="space-y-2 text-sm mb-4">
                    <div className="flex items-center justify-between text-gray-600">
                      <span className="flex items-center gap-1.5">
                        <Calendar className="w-4 h-4" />
                        Valid
                      </span>
                      <span className="font-medium">
                        {new Date(coupon.validFrom).toLocaleDateString()} - {new Date(coupon.validUntil).toLocaleDateString()}
                      </span>
                    </div>
                    {coupon.minOrderAmount > 0 && (
                      <div className="flex items-center justify-between text-gray-600">
                        <span>Min Order</span>
                        <span className="font-medium">USh {Number(coupon.minOrderAmount).toLocaleString()}</span>
                      </div>
                    )}
                    {coupon.maxDiscount > 0 && coupon.type === "PERCENTAGE" && (
                      <div className="flex items-center justify-between text-gray-600">
                        <span>Max Discount</span>
                        <span className="font-medium">USh {Number(coupon.maxDiscount).toLocaleString()}</span>
                      </div>
                    )}
                  </div>

                  {/* Usage Progress */}
                  <div className="mb-4">
                    <div className="flex items-center justify-between text-sm mb-1.5">
                      <span className="text-gray-600">Usage</span>
                      <span className="font-medium text-gray-900">
                        {coupon.usedCount}{coupon.usageLimit ? ` / ${coupon.usageLimit}` : " times"}
                      </span>
                    </div>
                    {coupon.usageLimit > 0 && (
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div 
                          className={`h-full rounded-full transition-all ${
                            usagePercent >= 90 ? "bg-red-500" : usagePercent >= 70 ? "bg-amber-500" : "bg-green-500"
                          }`}
                          style={{ width: `${usagePercent}%` }}
                        />
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 pt-4 border-t">
                    <button
                      onClick={() => handleToggleActive(coupon)}
                      className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                        coupon.active 
                          ? "bg-gray-100 hover:bg-gray-200 text-gray-700" 
                          : "bg-green-100 hover:bg-green-200 text-green-700"
                      }`}
                    >
                      {coupon.active ? "Deactivate" : "Activate"}
                    </button>
                    <button
                      onClick={() => handleEdit(coupon)}
                      className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                      title="Edit"
                    >
                      <Edit className="w-4 h-4 text-gray-500" />
                    </button>
                    <button
                      onClick={() => handleDelete(coupon.id)}
                      className="p-2 hover:bg-red-50 rounded-lg transition-colors"
                      title="Delete"
                    >
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
