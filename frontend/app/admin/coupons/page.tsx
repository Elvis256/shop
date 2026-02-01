"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Plus, Edit, Trash2, Tag } from "lucide-react";

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

export default function AdminCouponsPage() {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
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
      .then((data) => setCoupons(data.coupons))
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
        await api.admin.updateCoupon(editingId, formData);
      } else {
        await api.admin.createCoupon(formData);
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Coupons</h1>
          <p className="text-text-muted">{coupons.length} coupons</p>
        </div>
        {!showForm && (
          <button
            onClick={() => { resetForm(); setShowForm(true); }}
            className="btn-primary gap-2"
          >
            <Plus className="w-5 h-5" />
            Add Coupon
          </button>
        )}
      </div>

      {/* Form */}
      {showForm && (
        <div className="bg-white rounded-lg border border-border p-6">
          <h2 className="text-lg font-semibold mb-6">
            {editingId ? "Edit Coupon" : "Create Coupon"}
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">Code</label>
                <input
                  className="input uppercase"
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Type</label>
                <select
                  className="input"
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                >
                  <option value="PERCENTAGE">Percentage</option>
                  <option value="FIXED">Fixed Amount</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Description</label>
              <input
                className="input"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </div>

            <div className="grid md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">
                  Value ({formData.type === "PERCENTAGE" ? "%" : "KES"})
                </label>
                <input
                  type="number"
                  className="input"
                  value={formData.value}
                  onChange={(e) => setFormData({ ...formData, value: Number(e.target.value) })}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Min Order (KES)</label>
                <input
                  type="number"
                  className="input"
                  value={formData.minOrderAmount}
                  onChange={(e) => setFormData({ ...formData, minOrderAmount: Number(e.target.value) })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Max Discount (KES)</label>
                <input
                  type="number"
                  className="input"
                  value={formData.maxDiscount}
                  onChange={(e) => setFormData({ ...formData, maxDiscount: Number(e.target.value) })}
                />
              </div>
            </div>

            <div className="grid md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">Valid From</label>
                <input
                  type="date"
                  className="input"
                  value={formData.validFrom}
                  onChange={(e) => setFormData({ ...formData, validFrom: e.target.value })}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Valid Until</label>
                <input
                  type="date"
                  className="input"
                  value={formData.validUntil}
                  onChange={(e) => setFormData({ ...formData, validUntil: e.target.value })}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Usage Limit</label>
                <input
                  type="number"
                  className="input"
                  value={formData.usageLimit}
                  onChange={(e) => setFormData({ ...formData, usageLimit: Number(e.target.value) })}
                  placeholder="0 = unlimited"
                />
              </div>
            </div>

            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={formData.active}
                onChange={(e) => setFormData({ ...formData, active: e.target.checked })}
              />
              <span className="text-sm">Active</span>
            </label>

            <div className="flex gap-4">
              <button type="submit" className="btn-primary">
                {editingId ? "Update" : "Create"} Coupon
              </button>
              <button
                type="button"
                onClick={() => { setShowForm(false); setEditingId(null); }}
                className="btn-secondary"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Coupons Table */}
      <div className="bg-white rounded-lg border border-border overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-border">
            <tr>
              <th className="p-4 text-left text-sm font-medium">Code</th>
              <th className="p-4 text-left text-sm font-medium">Discount</th>
              <th className="p-4 text-left text-sm font-medium">Usage</th>
              <th className="p-4 text-left text-sm font-medium">Valid Period</th>
              <th className="p-4 text-left text-sm font-medium">Status</th>
              <th className="p-4 text-right text-sm font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {loading ? (
              <tr>
                <td colSpan={6} className="p-8 text-center text-text-muted">Loading...</td>
              </tr>
            ) : coupons.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-8 text-center text-text-muted">No coupons</td>
              </tr>
            ) : (
              coupons.map((coupon) => (
                <tr key={coupon.id} className="hover:bg-gray-50">
                  <td className="p-4">
                    <div className="flex items-center gap-2">
                      <Tag className="w-4 h-4 text-text-muted" />
                      <span className="font-mono font-medium">{coupon.code}</span>
                    </div>
                    {coupon.description && (
                      <p className="text-sm text-text-muted">{coupon.description}</p>
                    )}
                  </td>
                  <td className="p-4">
                    {coupon.type === "PERCENTAGE"
                      ? `${Number(coupon.value)}%`
                      : `KES ${Number(coupon.value)}`}
                  </td>
                  <td className="p-4 text-sm">
                    {coupon.usedCount}
                    {coupon.usageLimit ? ` / ${coupon.usageLimit}` : ""}
                  </td>
                  <td className="p-4 text-sm text-text-muted">
                    {new Date(coupon.validFrom).toLocaleDateString()} - {new Date(coupon.validUntil).toLocaleDateString()}
                  </td>
                  <td className="p-4">
                    <span className={`text-xs px-2 py-1 rounded-full ${
                      coupon.active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-700"
                    }`}>
                      {coupon.active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="p-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => handleEdit(coupon)}
                        className="p-2 hover:bg-gray-100 rounded"
                      >
                        <Edit className="w-4 h-4 text-text-muted" />
                      </button>
                      <button
                        onClick={() => handleDelete(coupon.id)}
                        className="p-2 hover:bg-gray-100 rounded"
                      >
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
