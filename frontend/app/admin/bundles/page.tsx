"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import {
  Plus,
  Package,
  Trash2,
  Edit2,
  ToggleLeft,
  ToggleRight,
  AlertTriangle,
  Check,
  Loader2,
  ArrowLeft,
  Search,
  X,
} from "lucide-react";

interface BundleItem {
  id: string;
  productId: string;
  productName: string;
  productPrice: number;
  quantity: number;
}

interface Bundle {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  discount: number;
  isActive: boolean;
  productCount: number;
  items: BundleItem[];
  createdAt: string;
}

const inputClass =
  "w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10 focus:border-gray-400 transition-colors";

function fmt(amount: number) {
  return `UGX ${Number(amount || 0).toLocaleString()}`;
}

export default function BundlesPage() {
  useEffect(() => { document.title = "Product Bundles | Admin"; }, []);

  const [bundles, setBundles] = useState<Bundle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    discount: "",
    isActive: true,
  });
  const [formItems, setFormItems] = useState<Array<{ productId: string; productName: string; quantity: string }>>([]);

  // Product search
  const [productSearch, setProductSearch] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);

  const loadBundles = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.admin.getBundles();
      setBundles(data.bundles || []);
    } catch (err) {
      setError("Failed to load bundles");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadBundles();
  }, [loadBundles]);

  const searchProducts = async (q: string) => {
    if (q.length < 2) { setSearchResults([]); return; }
    setSearching(true);
    try {
      const data: any = await api.admin.getProducts({ search: q, limit: "5" });
      setSearchResults(data.products || []);
    } catch (err) {
      console.error("Search failed:", err);
    } finally {
      setSearching(false);
    }
  };

  const addProduct = (product: any) => {
    if (formItems.some((i) => i.productId === product.id)) return;
    setFormItems((prev) => [
      ...prev,
      { productId: product.id, productName: product.name, quantity: "1" },
    ]);
    setProductSearch("");
    setSearchResults([]);
  };

  const removeProduct = (productId: string) => {
    setFormItems((prev) => prev.filter((i) => i.productId !== productId));
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formItems.length === 0) {
      setError("Please add at least one product to the bundle");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const slug = formData.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "") + "-" + Date.now();

      await api.admin.createBundle({
        name: formData.name,
        slug,
        description: formData.description || null,
        discount: parseFloat(formData.discount) || 0,
        isActive: formData.isActive,
        items: formItems.map((i) => ({
          productId: i.productId,
          quantity: parseInt(i.quantity) || 1,
        })),
      });
      setSuccess("Bundle created successfully!");
      setShowForm(false);
      setFormData({ name: "", description: "", discount: "", isActive: true });
      setFormItems([]);
      loadBundles();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err?.message || "Failed to create bundle");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this bundle?")) return;
    setDeleting(id);
    try {
      await api.admin.deleteBundle(id);
      setBundles((prev) => prev.filter((b) => b.id !== id));
      setSuccess("Bundle deleted");
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError("Failed to delete bundle");
    } finally {
      setDeleting(null);
    }
  };

  const toggleActive = async (bundle: Bundle) => {
    try {
      await api.admin.updateBundle(bundle.id, { isActive: !bundle.isActive });
      setBundles((prev) =>
        prev.map((b) => (b.id === bundle.id ? { ...b, isActive: !b.isActive } : b))
      );
    } catch (err) {
      setError("Failed to update bundle");
    }
  };

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-8 w-48 bg-gray-200 rounded" />
        <div className="h-64 bg-gray-100 rounded-lg" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Product Bundles</h1>
          <p className="text-sm text-gray-500 mt-1">Create and manage product bundles with group discounts</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 px-4 py-2.5 bg-gray-900 text-white rounded-lg hover:bg-gray-800 text-sm font-medium transition-colors"
        >
          <Plus className="w-4 h-4" />
          Create Bundle
        </button>
      </div>

      {/* Messages */}
      {error && (
        <div className="p-4 border border-red-200 rounded-lg flex items-center gap-3 bg-white">
          <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0" />
          <p className="text-red-700 text-sm flex-1">{error}</p>
          <button onClick={() => setError(null)} aria-label="Dismiss error"><X className="w-4 h-4 text-gray-400" /></button>
        </div>
      )}
      {success && (
        <div className="p-4 border border-emerald-200 rounded-lg flex items-center gap-3 bg-white">
          <Check className="w-5 h-5 text-emerald-600 flex-shrink-0" />
          <p className="text-emerald-700 text-sm">{success}</p>
        </div>
      )}

      {/* Create Form */}
      {showForm && (
        <form onSubmit={handleCreate} className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
          <h2 className="text-lg font-semibold text-gray-900">New Bundle</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-500 mb-1">Bundle Name *</label>
              <input
                type="text"
                className={inputClass}
                value={formData.name}
                onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                required
                placeholder="e.g., Starter Bundle"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-500 mb-1">Discount %</label>
              <input
                type="number"
                className={inputClass}
                value={formData.discount}
                onChange={(e) => setFormData((prev) => ({ ...prev, discount: e.target.value }))}
                min="0"
                max="100"
                step="0.01"
                placeholder="e.g., 15"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm text-gray-500 mb-1">Description</label>
            <textarea
              className={`${inputClass} resize-none`}
              rows={2}
              value={formData.description}
              onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
              placeholder="Bundle description..."
            />
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={formData.isActive}
              onChange={(e) => setFormData((prev) => ({ ...prev, isActive: e.target.checked }))}
              className="w-4 h-4 rounded border-gray-300 text-gray-900 focus:ring-gray-900"
            />
            <span className="text-sm text-gray-700">Active</span>
          </label>

          {/* Product Search */}
          <div>
            <label className="block text-sm text-gray-500 mb-1">Products in Bundle</label>
            <div className="relative">
              <input
                type="text"
                className={inputClass}
                value={productSearch}
                onChange={(e) => {
                  setProductSearch(e.target.value);
                  searchProducts(e.target.value);
                }}
                placeholder="Search products to add..."
              />
              <Search className="absolute right-3 top-2.5 w-4 h-4 text-gray-400" />
              {searchResults.length > 0 && (
                <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-auto">
                  {searchResults.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => addProduct(p)}
                      className="w-full text-left px-4 py-2 hover:bg-gray-50 text-sm flex items-center justify-between"
                    >
                      <span className="truncate">{p.name}</span>
                      <span className="text-gray-400 text-xs ml-2">{fmt(Number(p.price))}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            {formItems.length > 0 && (
              <div className="mt-3 space-y-2">
                {formItems.map((item) => (
                  <div key={item.productId} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                    <Package className="w-4 h-4 text-gray-400 shrink-0" />
                    <span className="text-sm text-gray-700 flex-1 truncate">{item.productName}</span>
                    <input
                      type="number"
                      className="w-16 px-2 py-1 border border-gray-200 rounded text-sm text-center"
                      value={item.quantity}
                      onChange={(e) =>
                        setFormItems((prev) =>
                          prev.map((i) =>
                            i.productId === item.productId ? { ...i, quantity: e.target.value } : i
                          )
                        )
                      }
                      min="1"
                    />
                    <button
                      type="button"
                      onClick={() => removeProduct(item.productId)}
                      className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                      aria-label={`Remove ${item.productName}`}
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={() => { setShowForm(false); setFormItems([]); }}
              className="px-4 py-2 text-sm text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 text-sm bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50 font-medium"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              {saving ? "Creating…" : "Create Bundle"}
            </button>
          </div>
        </form>
      )}

      {/* Bundles List */}
      {bundles.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
          <Package className="w-12 h-12 text-gray-200 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No bundles yet</h3>
          <p className="text-sm text-gray-500 mb-4">Create product bundles to offer group discounts.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {bundles.map((bundle) => (
            <div key={bundle.id} className="bg-white rounded-lg border border-gray-200 p-5">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-gray-900">{bundle.name}</h3>
                    <span className={`text-xs px-2 py-0.5 rounded font-medium ${bundle.isActive ? "bg-emerald-50 text-emerald-700" : "bg-gray-100 text-gray-500"}`}>
                      {bundle.isActive ? "Active" : "Inactive"}
                    </span>
                  </div>
                  {bundle.description && (
                    <p className="text-sm text-gray-500 mt-1">{bundle.description}</p>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => toggleActive(bundle)}
                    className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                    aria-label={bundle.isActive ? "Deactivate bundle" : "Activate bundle"}
                  >
                    {bundle.isActive ? <ToggleRight className="w-5 h-5 text-emerald-600" /> : <ToggleLeft className="w-5 h-5" />}
                  </button>
                  <Link
                    href={`/admin/bundles/${bundle.id}`}
                    className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                    aria-label={`Edit ${bundle.name}`}
                  >
                    <Edit2 className="w-4 h-4" />
                  </Link>
                  <button
                    onClick={() => handleDelete(bundle.id)}
                    disabled={deleting === bundle.id}
                    className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                    aria-label={`Delete ${bundle.name}`}
                  >
                    {deleting === bundle.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <div className="flex items-center gap-4 text-sm text-gray-500">
                <span>{bundle.productCount} product{bundle.productCount !== 1 ? "s" : ""}</span>
                <span>{Number(bundle.discount)}% discount</span>
              </div>
              {bundle.items.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {bundle.items.map((item) => (
                    <span key={item.id} className="text-xs bg-gray-50 border border-gray-200 px-2 py-1 rounded">
                      {item.productName} ×{item.quantity}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
