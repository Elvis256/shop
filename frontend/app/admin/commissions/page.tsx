"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import {
  Plus,
  Pencil,
  Trash2,
  X,
  Loader2,
  Percent,
  Save,
} from "lucide-react";

interface CommissionRule {
  id: string;
  categoryId?: string | null;
  categoryName?: string;
  rate: number;
  isActive: boolean;
}

interface Category {
  id: string;
  name: string;
  slug: string;
}

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

  useEffect(() => {
    loadRules();
    loadCategories();
  }, []);

  const loadRules = async () => {
    setLoading(true);
    try {
      const data = await apiFetch("/api/admin/sellers/commissions");
      setRules(Array.isArray(data) ? data : data.rules || []);
    } catch {
      setRules([]);
    } finally {
      setLoading(false);
    }
  };

  const loadCategories = async () => {
    try {
      const data = await apiFetch("/api/categories");
      setCategories(Array.isArray(data) ? data : data.categories || []);
    } catch {}
  };

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
        await apiFetch("/api/admin/sellers/commissions", {
          method: "POST",
          body: JSON.stringify({
            categoryId: formCategoryId || undefined,
            rate: Number(formRate),
          }),
        });
      }
      setShowModal(false);
      loadRules();
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
    } catch {}
  };

  const sortedRules = [...rules].sort((a, b) => {
    if (!a.categoryId) return -1;
    if (!b.categoryId) return 1;
    return (a.categoryName || "").localeCompare(b.categoryName || "");
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Commission Rules</h1>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-white text-sm font-medium rounded-lg hover:bg-primary/90 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Rule
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : sortedRules.length === 0 ? (
          <div className="text-center py-20">
            <Percent className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">No commission rules configured</p>
            <button onClick={openAdd} className="mt-3 text-sm text-primary hover:underline">
              Add your first rule
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Category</th>
                  <th className="text-center px-4 py-3 font-medium text-gray-500">Commission Rate %</th>
                  <th className="text-center px-4 py-3 font-medium text-gray-500">Status</th>
                  <th className="text-center px-4 py-3 font-medium text-gray-500">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {sortedRules.map((rule) => (
                  <tr
                    key={rule.id}
                    className={`hover:bg-gray-50 transition-colors ${!rule.categoryId ? "bg-blue-50/30" : ""}`}
                  >
                    <td className="px-4 py-3">
                      {rule.categoryId ? (
                        <span className="text-gray-900">{rule.categoryName || rule.categoryId}</span>
                      ) : (
                        <span className="font-semibold text-primary">Default (All Categories)</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="font-semibold text-gray-900">{rule.rate}%</span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => handleToggleActive(rule)}
                        className={`text-xs font-medium px-2.5 py-1 rounded-full transition-colors ${
                          rule.isActive
                            ? "bg-green-100 text-green-800 hover:bg-green-200"
                            : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                        }`}
                      >
                        {rule.isActive ? "Active" : "Inactive"}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => openEdit(rule)}
                          className="p-1.5 text-gray-500 hover:bg-gray-100 rounded-lg transition-colors"
                          title="Edit"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        {rule.categoryId && (
                          <button
                            onClick={() => setDeleteConfirm(rule.id)}
                            className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                            title="Delete"
                          >
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

      {/* Add/Edit Modal */}
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
              </div>
              <div className="flex gap-3 justify-end pt-2">
                <button
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  Cancel
                </button>
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
            <p className="text-sm text-gray-600 mb-4">Are you sure you want to delete this commission rule?</p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(deleteConfirm)}
                className="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
