"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import {
  ArrowLeft,
  Save,
  Loader2,
  AlertTriangle,
  Check,
  Search,
  Package,
  X,
  Trash2,
} from "lucide-react";

const inputClass =
  "w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10 focus:border-gray-400 transition-colors";

function fmt(amount: number) {
  return `UGX ${Number(amount || 0).toLocaleString()}`;
}

export default function EditBundlePage() {
  const router = useRouter();
  const params = useParams();
  const bundleId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    discount: "",
    isActive: true,
  });
  const [formItems, setFormItems] = useState<Array<{ productId: string; productName: string; quantity: string }>>([]);

  const [productSearch, setProductSearch] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);

  useEffect(() => {
    loadBundle();
  }, [bundleId]);

  const loadBundle = async () => {
    setLoading(true);
    try {
      const bundle = await api.admin.getBundle(bundleId);
      setFormData({
        name: bundle.name || "",
        description: bundle.description || "",
        discount: String(bundle.discount || 0),
        isActive: bundle.isActive ?? true,
      });
      setFormItems(
        (bundle.items || []).map((i: any) => ({
          productId: i.productId || i.product?.id,
          productName: i.product?.name || i.productName || "",
          quantity: String(i.quantity || 1),
        }))
      );
    } catch (err) {
      setError("Failed to load bundle");
    } finally {
      setLoading(false);
    }
  };

  const searchProducts = async (q: string) => {
    if (q.length < 2) { setSearchResults([]); return; }
    try {
      const data: any = await api.admin.getProducts({ search: q, limit: "5" });
      setSearchResults(data.products || []);
    } catch (err) {
      console.error("Search failed:", err);
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formItems.length === 0) {
      setError("Please add at least one product");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await api.admin.updateBundle(bundleId, {
        name: formData.name,
        description: formData.description || null,
        discount: parseFloat(formData.discount) || 0,
        isActive: formData.isActive,
        items: formItems.map((i) => ({
          productId: i.productId,
          quantity: parseInt(i.quantity) || 1,
        })),
      });
      setSuccess(true);
      setTimeout(() => router.push("/admin/bundles"), 1000);
    } catch (err: any) {
      setError(err?.message || "Failed to update bundle");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto">
        <div className="h-8 w-48 bg-gray-200 rounded animate-pulse mb-6" />
        <div className="h-64 bg-gray-100 rounded-lg animate-pulse" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto pb-20">
      <div className="flex items-center gap-4 mb-6">
        <Link
          href="/admin/bundles"
          className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Edit Bundle</h1>
          <p className="text-sm text-gray-500">{formData.name || "Untitled bundle"}</p>
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 border border-red-200 rounded-lg flex items-center gap-3 bg-white">
          <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0" />
          <p className="text-red-700 text-sm">{error}</p>
        </div>
      )}
      {success && (
        <div className="mb-6 p-4 border border-emerald-200 rounded-lg flex items-center gap-3 bg-white">
          <Check className="w-5 h-5 text-emerald-600 flex-shrink-0" />
          <p className="text-emerald-700 text-sm">Bundle updated! Redirecting…</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
          <h2 className="text-lg font-semibold text-gray-900">Bundle Details</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-500 mb-1">Bundle Name *</label>
              <input
                type="text"
                className={inputClass}
                value={formData.name}
                onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                required
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
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Products</h2>
          <div className="relative mb-4">
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

          {formItems.length > 0 ? (
            <div className="space-y-2">
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
                    onClick={() => setFormItems((prev) => prev.filter((i) => i.productId !== item.productId))}
                    className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-400">No products added yet. Search above to add products.</p>
          )}
        </div>

        <div className="flex gap-3 sticky bottom-4 bg-white p-4 rounded-lg border border-gray-200 shadow-lg">
          <Link
            href="/admin/bundles"
            className="flex-1 px-4 py-2.5 text-center text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm font-medium transition-colors"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={saving}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-gray-900 text-white hover:bg-gray-800 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {saving ? "Saving…" : "Save Changes"}
          </button>
        </div>
      </form>
    </div>
  );
}
