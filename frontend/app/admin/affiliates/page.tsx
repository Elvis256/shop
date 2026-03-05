"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { api } from "@/lib/api";
import {
  Plus,
  Search,
  Edit,
  Trash2,
  Globe,
  ExternalLink,
  Users,
  MousePointerClick,
  DollarSign,
  TrendingUp,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  X,
  Upload,
  Check,
  Ban,
  Eye,
} from "lucide-react";

type AffiliateProduct = {
  id: string;
  title: string;
  slug: string;
  description: string;
  price: number;
  comparePrice?: number;
  commission: number;
  source: string;
  affiliateUrl: string;
  imageUrl?: string;
  images: string[];
  isActive: boolean;
  isFeatured: boolean;
  category?: { id: string; name: string };
  _count?: { clicks: number };
  createdAt: string;
};

type AffiliateUser = {
  id: string;
  name: string;
  email: string;
  code: string;
  commissionRate: number;
  status: string;
  totalEarnings: number;
  totalClicks: number;
  totalConversions: number;
  website?: string;
  socialMedia?: string;
  user?: { name: string; email: string };
  createdAt: string;
};

type Tab = "products" | "program" | "stats";

export default function AdminAffiliatesPage() {
  const [tab, setTab] = useState<Tab>("products");
  const [products, setProducts] = useState<AffiliateProduct[]>([]);
  const [affiliates, setAffiliates] = useState<AffiliateUser[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState<AffiliateProduct | null>(null);
  const [showImport, setShowImport] = useState(false);
  const [importJson, setImportJson] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  const [form, setForm] = useState({
    title: "",
    description: "",
    price: "",
    comparePrice: "",
    commission: "5",
    source: "AMAZON",
    affiliateUrl: "",
    imageUrl: "",
    images: "",
    categoryId: "",
    isFeatured: false,
    isActive: true,
  });

  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    api.admin.getCategories().then(setCategories).catch(() => {});
  }, []);

  useEffect(() => {
    loadData();
  }, [tab, page, search]);

  async function loadData() {
    setLoading(true);
    try {
      if (tab === "products") {
        const params: Record<string, string> = { page: String(page), limit: "20" };
        if (search) params.search = search;
        const res = await api.admin.getAffiliateProducts(params);
        setProducts(res.products || []);
        setTotal(res.total || 0);
      } else if (tab === "program") {
        const res = await api.admin.getAffiliates();
        setAffiliates(res.affiliates || []);
      } else if (tab === "stats") {
        const res = await api.admin.getAffiliateStats();
        setStats(res);
      }
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  }

  function openEditForm(product: AffiliateProduct) {
    setEditingProduct(product);
    setForm({
      title: product.title,
      description: product.description || "",
      price: String(product.price),
      comparePrice: product.comparePrice ? String(product.comparePrice) : "",
      commission: String(product.commission),
      source: product.source,
      affiliateUrl: product.affiliateUrl,
      imageUrl: product.imageUrl || "",
      images: product.images?.join(", ") || "",
      categoryId: product.category?.id || "",
      isFeatured: product.isFeatured,
      isActive: product.isActive,
    });
    setShowForm(true);
  }

  function resetForm() {
    setEditingProduct(null);
    setForm({
      title: "",
      description: "",
      price: "",
      comparePrice: "",
      commission: "5",
      source: "AMAZON",
      affiliateUrl: "",
      imageUrl: "",
      images: "",
      categoryId: "",
      isFeatured: false,
      isActive: true,
    });
    setShowForm(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      const data = {
        title: form.title,
        description: form.description,
        price: parseFloat(form.price),
        comparePrice: form.comparePrice ? parseFloat(form.comparePrice) : undefined,
        commission: parseFloat(form.commission),
        source: form.source,
        affiliateUrl: form.affiliateUrl,
        imageUrl: form.imageUrl || undefined,
        images: form.images ? form.images.split(",").map((s) => s.trim()).filter(Boolean) : [],
        categoryId: form.categoryId || undefined,
        isFeatured: form.isFeatured,
        isActive: form.isActive,
      };
      if (editingProduct) {
        await api.admin.updateAffiliateProduct(editingProduct.id, data);
      } else {
        await api.admin.createAffiliateProduct(data);
      }
      resetForm();
      loadData();
    } catch (e: any) {
      alert(e.message || "Failed to save");
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this affiliate product?")) return;
    try {
      await api.admin.deleteAffiliateProduct(id);
      loadData();
    } catch (e: any) {
      alert(e.message || "Failed to delete");
    }
  }

  async function handleImport() {
    try {
      const products = JSON.parse(importJson);
      await api.admin.importAffiliateProducts(products);
      setShowImport(false);
      setImportJson("");
      loadData();
    } catch (e: any) {
      alert(e.message || "Invalid JSON or import failed");
    }
  }

  async function handleAffiliateStatus(id: string, status: string) {
    try {
      await api.admin.updateAffiliateStatus(id, status);
      loadData();
    } catch (e: any) {
      alert(e.message || "Failed to update status");
    }
  }

  const sourceColors: Record<string, string> = {
    AMAZON: "bg-orange-100 text-orange-700",
    ALIEXPRESS: "bg-red-100 text-red-700",
    ALIBABA: "bg-yellow-100 text-yellow-700",
    OTHER: "bg-gray-100 text-gray-700",
  };

  const statusColors: Record<string, string> = {
    PENDING: "bg-yellow-100 text-yellow-700",
    APPROVED: "bg-green-100 text-green-700",
    REJECTED: "bg-red-100 text-red-700",
    SUSPENDED: "bg-gray-100 text-gray-700",
  };

  const totalPages = Math.ceil(total / 20);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Affiliate Management</h1>
          <p className="text-sm text-gray-500 mt-1">
            Manage affiliate products and your affiliate program
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
        {[
          { id: "products" as Tab, label: "Affiliate Products", icon: Globe },
          { id: "program" as Tab, label: "Affiliate Program", icon: Users },
          { id: "stats" as Tab, label: "Statistics", icon: TrendingUp },
        ].map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => { setTab(id); setPage(1); }}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition ${
              tab === id ? "bg-white shadow text-gray-900" : "text-gray-500 hover:text-gray-700"
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {/* Products Tab */}
      {tab === "products" && (
        <div className="space-y-4">
          {/* Actions */}
          <div className="flex flex-wrap gap-3 items-center">
            <div className="relative flex-1 min-w-[200px] max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search affiliate products..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                className="w-full pl-10 pr-4 py-2 border rounded-lg text-sm"
              />
            </div>
            <button
              onClick={() => { resetForm(); setShowForm(true); }}
              className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700"
            >
              <Plus className="w-4 h-4" /> Add Product
            </button>
            <button
              onClick={() => setShowImport(true)}
              className="flex items-center gap-2 bg-gray-100 text-gray-700 px-4 py-2 rounded-lg text-sm hover:bg-gray-200"
            >
              <Upload className="w-4 h-4" /> Bulk Import
            </button>
            <button onClick={loadData} className="p-2 text-gray-400 hover:text-gray-600">
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>

          {/* Product Form Modal */}
          {showForm && (
            <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
              <div className="bg-white rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold">
                    {editingProduct ? "Edit" : "Add"} Affiliate Product
                  </h2>
                  <button onClick={resetForm}><X className="w-5 h-5" /></button>
                </div>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="col-span-2">
                      <label className="block text-sm font-medium mb-1">Product Title *</label>
                      <input
                        type="text"
                        required
                        value={form.title}
                        onChange={(e) => setForm({ ...form, title: e.target.value })}
                        className="w-full border rounded-lg px-3 py-2 text-sm"
                        placeholder="e.g., Premium Wireless Earbuds"
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-sm font-medium mb-1">Description</label>
                      <textarea
                        value={form.description}
                        onChange={(e) => setForm({ ...form, description: e.target.value })}
                        className="w-full border rounded-lg px-3 py-2 text-sm"
                        rows={3}
                        placeholder="Product description..."
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Price *</label>
                      <input
                        type="number"
                        step="0.01"
                        required
                        value={form.price}
                        onChange={(e) => setForm({ ...form, price: e.target.value })}
                        className="w-full border rounded-lg px-3 py-2 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Compare Price</label>
                      <input
                        type="number"
                        step="0.01"
                        value={form.comparePrice}
                        onChange={(e) => setForm({ ...form, comparePrice: e.target.value })}
                        className="w-full border rounded-lg px-3 py-2 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Commission %</label>
                      <input
                        type="number"
                        step="0.1"
                        value={form.commission}
                        onChange={(e) => setForm({ ...form, commission: e.target.value })}
                        className="w-full border rounded-lg px-3 py-2 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Source *</label>
                      <select
                        value={form.source}
                        onChange={(e) => setForm({ ...form, source: e.target.value })}
                        className="w-full border rounded-lg px-3 py-2 text-sm"
                      >
                        <option value="AMAZON">Amazon</option>
                        <option value="ALIEXPRESS">AliExpress</option>
                        <option value="ALIBABA">Alibaba</option>
                        <option value="OTHER">Other</option>
                      </select>
                    </div>
                    <div className="col-span-2">
                      <label className="block text-sm font-medium mb-1">Affiliate URL *</label>
                      <input
                        type="url"
                        required
                        value={form.affiliateUrl}
                        onChange={(e) => setForm({ ...form, affiliateUrl: e.target.value })}
                        className="w-full border rounded-lg px-3 py-2 text-sm"
                        placeholder="https://amzn.to/..."
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-sm font-medium mb-1">Image URL</label>
                      <input
                        type="url"
                        value={form.imageUrl}
                        onChange={(e) => setForm({ ...form, imageUrl: e.target.value })}
                        className="w-full border rounded-lg px-3 py-2 text-sm"
                        placeholder="https://..."
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-sm font-medium mb-1">Additional Images (comma-separated URLs)</label>
                      <input
                        type="text"
                        value={form.images}
                        onChange={(e) => setForm({ ...form, images: e.target.value })}
                        className="w-full border rounded-lg px-3 py-2 text-sm"
                        placeholder="url1, url2, url3"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Category</label>
                      <select
                        value={form.categoryId}
                        onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
                        className="w-full border rounded-lg px-3 py-2 text-sm"
                      >
                        <option value="">No Category</option>
                        {categories.map((c) => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>
                    </div>
                    <div className="flex items-center gap-6 pt-4">
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={form.isFeatured}
                          onChange={(e) => setForm({ ...form, isFeatured: e.target.checked })}
                        />
                        <span className="text-sm">Featured</span>
                      </label>
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={form.isActive}
                          onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                        />
                        <span className="text-sm">Active</span>
                      </label>
                    </div>
                  </div>
                  <div className="flex justify-end gap-3 pt-4 border-t">
                    <button type="button" onClick={resetForm} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">
                      Cancel
                    </button>
                    <button type="submit" className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                      {editingProduct ? "Update" : "Create"} Product
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Import Modal */}
          {showImport && (
            <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
              <div className="bg-white rounded-xl w-full max-w-2xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold">Bulk Import Affiliate Products</h2>
                  <button onClick={() => setShowImport(false)}><X className="w-5 h-5" /></button>
                </div>
                <p className="text-sm text-gray-500 mb-3">
                  Paste a JSON array of products. Each object should have: title, price, source (AMAZON/ALIEXPRESS/ALIBABA), affiliateUrl. Optional: description, comparePrice, commission, imageUrl, images.
                </p>
                <textarea
                  value={importJson}
                  onChange={(e) => setImportJson(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 text-sm font-mono"
                  rows={10}
                  placeholder={`[\n  {\n    "title": "Product Name",\n    "price": 29.99,\n    "source": "AMAZON",\n    "affiliateUrl": "https://amzn.to/...",\n    "imageUrl": "https://...",\n    "commission": 5\n  }\n]`}
                />
                <div className="flex justify-end gap-3 mt-4">
                  <button onClick={() => setShowImport(false)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">
                    Cancel
                  </button>
                  <button onClick={handleImport} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                    Import Products
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Products Table */}
          {loading ? (
            <div className="flex justify-center py-12">
              <RefreshCw className="w-6 h-6 animate-spin text-gray-400" />
            </div>
          ) : products.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <Globe className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="font-medium">No affiliate products yet</p>
              <p className="text-sm mt-1">Add products from Amazon, AliExpress, or Alibaba to start earning commissions</p>
            </div>
          ) : (
            <>
              <div className="bg-white rounded-xl border overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
                    <tr>
                      <th className="text-left px-4 py-3">Product</th>
                      <th className="text-left px-4 py-3">Source</th>
                      <th className="text-right px-4 py-3">Price</th>
                      <th className="text-right px-4 py-3">Commission</th>
                      <th className="text-right px-4 py-3">Clicks</th>
                      <th className="text-center px-4 py-3">Status</th>
                      <th className="text-right px-4 py-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {products.map((p) => (
                      <tr key={p.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            {p.imageUrl ? (
                              <Image
                                src={p.imageUrl}
                                alt={p.title}
                                width={40}
                                height={40}
                                className="rounded-lg object-cover"
                              />
                            ) : (
                              <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
                                <Globe className="w-4 h-4 text-gray-400" />
                              </div>
                            )}
                            <div>
                              <p className="font-medium text-gray-900 line-clamp-1">{p.title}</p>
                              {p.category && (
                                <p className="text-xs text-gray-400">{p.category.name}</p>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`text-xs px-2 py-1 rounded-full font-medium ${sourceColors[p.source] || sourceColors.OTHER}`}>
                            {p.source}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className="font-medium">${p.price.toFixed(2)}</span>
                          {p.comparePrice && (
                            <span className="text-xs text-gray-400 line-through ml-1">${p.comparePrice.toFixed(2)}</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right text-green-600 font-medium">{p.commission}%</td>
                        <td className="px-4 py-3 text-right">{p._count?.clicks || 0}</td>
                        <td className="px-4 py-3 text-center">
                          <span className={`text-xs px-2 py-1 rounded-full ${p.isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                            {p.isActive ? "Active" : "Inactive"}
                          </span>
                          {p.isFeatured && (
                            <span className="text-xs px-2 py-1 rounded-full bg-purple-100 text-purple-700 ml-1">Featured</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <a
                              href={p.affiliateUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-1.5 text-gray-400 hover:text-blue-600"
                              title="Open affiliate link"
                            >
                              <ExternalLink className="w-4 h-4" />
                            </a>
                            <button
                              onClick={() => openEditForm(p)}
                              className="p-1.5 text-gray-400 hover:text-blue-600"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDelete(p.id)}
                              className="p-1.5 text-gray-400 hover:text-red-600"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between">
                  <p className="text-sm text-gray-500">{total} products total</p>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setPage(Math.max(1, page - 1))}
                      disabled={page === 1}
                      className="p-2 rounded-lg border disabled:opacity-50"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <span className="text-sm">Page {page} of {totalPages}</span>
                    <button
                      onClick={() => setPage(Math.min(totalPages, page + 1))}
                      disabled={page === totalPages}
                      className="p-2 rounded-lg border disabled:opacity-50"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Program Tab */}
      {tab === "program" && (
        <div className="space-y-4">
          {loading ? (
            <div className="flex justify-center py-12">
              <RefreshCw className="w-6 h-6 animate-spin text-gray-400" />
            </div>
          ) : affiliates.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <Users className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="font-medium">No affiliates yet</p>
              <p className="text-sm mt-1">When people sign up to promote your products, they&apos;ll appear here</p>
            </div>
          ) : (
            <div className="bg-white rounded-xl border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
                  <tr>
                    <th className="text-left px-4 py-3">Affiliate</th>
                    <th className="text-left px-4 py-3">Code</th>
                    <th className="text-right px-4 py-3">Commission</th>
                    <th className="text-right px-4 py-3">Clicks</th>
                    <th className="text-right px-4 py-3">Conversions</th>
                    <th className="text-right px-4 py-3">Earnings</th>
                    <th className="text-center px-4 py-3">Status</th>
                    <th className="text-right px-4 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {affiliates.map((a) => (
                    <tr key={a.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <p className="font-medium">{a.name}</p>
                        <p className="text-xs text-gray-400">{a.email}</p>
                        {a.website && <p className="text-xs text-blue-500">{a.website}</p>}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs">{a.code}</td>
                      <td className="px-4 py-3 text-right">{a.commissionRate}%</td>
                      <td className="px-4 py-3 text-right">{a.totalClicks}</td>
                      <td className="px-4 py-3 text-right">{a.totalConversions}</td>
                      <td className="px-4 py-3 text-right font-medium text-green-600">
                        ${a.totalEarnings.toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`text-xs px-2 py-1 rounded-full font-medium ${statusColors[a.status] || "bg-gray-100 text-gray-700"}`}>
                          {a.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {a.status === "PENDING" && (
                            <button
                              onClick={() => handleAffiliateStatus(a.id, "APPROVED")}
                              className="p-1.5 text-gray-400 hover:text-green-600"
                              title="Approve"
                            >
                              <Check className="w-4 h-4" />
                            </button>
                          )}
                          {a.status !== "SUSPENDED" && (
                            <button
                              onClick={() => handleAffiliateStatus(a.id, "SUSPENDED")}
                              className="p-1.5 text-gray-400 hover:text-red-600"
                              title="Suspend"
                            >
                              <Ban className="w-4 h-4" />
                            </button>
                          )}
                          {a.status === "SUSPENDED" && (
                            <button
                              onClick={() => handleAffiliateStatus(a.id, "APPROVED")}
                              className="p-1.5 text-gray-400 hover:text-green-600"
                              title="Reactivate"
                            >
                              <Check className="w-4 h-4" />
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

      {/* Stats Tab */}
      {tab === "stats" && (
        <div className="space-y-4">
          {loading ? (
            <div className="flex justify-center py-12">
              <RefreshCw className="w-6 h-6 animate-spin text-gray-400" />
            </div>
          ) : stats ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white rounded-xl border p-5">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
                    <Globe className="w-5 h-5 text-blue-600" />
                  </div>
                  <p className="text-sm text-gray-500">Affiliate Products</p>
                </div>
                <p className="text-2xl font-bold">{stats.totalProducts || 0}</p>
                <p className="text-xs text-gray-400 mt-1">{stats.activeProducts || 0} active</p>
              </div>
              <div className="bg-white rounded-xl border p-5">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-lg bg-green-50 flex items-center justify-center">
                    <MousePointerClick className="w-5 h-5 text-green-600" />
                  </div>
                  <p className="text-sm text-gray-500">Total Clicks</p>
                </div>
                <p className="text-2xl font-bold">{stats.totalClicks || 0}</p>
                <p className="text-xs text-gray-400 mt-1">Last 30 days: {stats.monthlyClicks || 0}</p>
              </div>
              <div className="bg-white rounded-xl border p-5">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-lg bg-purple-50 flex items-center justify-center">
                    <Users className="w-5 h-5 text-purple-600" />
                  </div>
                  <p className="text-sm text-gray-500">Affiliates</p>
                </div>
                <p className="text-2xl font-bold">{stats.totalAffiliates || 0}</p>
                <p className="text-xs text-gray-400 mt-1">{stats.activeAffiliates || 0} active</p>
              </div>
              <div className="bg-white rounded-xl border p-5">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-lg bg-orange-50 flex items-center justify-center">
                    <DollarSign className="w-5 h-5 text-orange-600" />
                  </div>
                  <p className="text-sm text-gray-500">Commissions Paid</p>
                </div>
                <p className="text-2xl font-bold">${(stats.totalCommissions || 0).toFixed(2)}</p>
                <p className="text-xs text-gray-400 mt-1">{stats.totalConversions || 0} conversions</p>
              </div>

              {/* Top Products by Clicks */}
              {stats.topProducts && stats.topProducts.length > 0 && (
                <div className="bg-white rounded-xl border p-5 col-span-full lg:col-span-2">
                  <h3 className="font-semibold mb-3">Top Affiliate Products (by clicks)</h3>
                  <div className="space-y-3">
                    {stats.topProducts.map((p: any, i: number) => (
                      <div key={p.id} className="flex items-center gap-3">
                        <span className="text-sm text-gray-400 w-5">{i + 1}.</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{p.title}</p>
                          <p className="text-xs text-gray-400">{p.source}</p>
                        </div>
                        <span className="text-sm font-medium">{p._count?.clicks || 0} clicks</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Top Affiliates */}
              {stats.topAffiliates && stats.topAffiliates.length > 0 && (
                <div className="bg-white rounded-xl border p-5 col-span-full lg:col-span-2">
                  <h3 className="font-semibold mb-3">Top Affiliates (by earnings)</h3>
                  <div className="space-y-3">
                    {stats.topAffiliates.map((a: any, i: number) => (
                      <div key={a.id} className="flex items-center gap-3">
                        <span className="text-sm text-gray-400 w-5">{i + 1}.</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{a.name}</p>
                          <p className="text-xs text-gray-400">{a.email}</p>
                        </div>
                        <span className="text-sm font-medium text-green-600">${a.totalEarnings.toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <p className="text-center text-gray-500 py-12">No statistics available</p>
          )}
        </div>
      )}
    </div>
  );
}
