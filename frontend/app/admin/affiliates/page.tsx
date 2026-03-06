"use client";

import { useEffect, useState, useCallback } from "react";
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
  Copy,
  Link,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Filter,
  Share2,
  CreditCard,
  BarChart3,
  Star,
  Package,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */
type AffiliateProduct = {
  id: string;
  name: string;
  slug: string;
  description: string;
  price: number;
  originalPrice?: number;
  commissionRate: number;
  source: string;
  affiliateUrl: string;
  imageUrl?: string;
  images: string[];
  isActive: boolean;
  isFeatured: boolean;
  rating?: number;
  reviewCount?: number;
  category?: { id: string; name: string };
  categoryName?: string;
  clicks?: number;
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
  totalOrders: number;
  pendingPayout: number;
  totalPaid: number;
  conversions: number;
  website?: string;
  socialMedia?: string;
  createdAt: string;
};

type Tab = "products" | "program" | "stats";

interface Toast {
  id: number;
  type: "success" | "error";
  message: string;
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */
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
  const [toasts, setToasts] = useState<Toast[]>([]);

  // Filters
  const [sourceFilter, setSourceFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [activeFilter, setActiveFilter] = useState("");
  const [affiliateSearch, setAffiliateSearch] = useState("");

  // Payout modal
  const [showPayout, setShowPayout] = useState(false);
  const [payoutAffiliate, setPayoutAffiliate] = useState<AffiliateUser | null>(null);
  const [payoutForm, setPayoutForm] = useState({ amount: "", method: "MOBILE_MONEY", reference: "", notes: "" });

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  // Share signup link
  const [showShareLink, setShowShareLink] = useState(false);

  const [form, setForm] = useState({
    name: "",
    description: "",
    price: "",
    originalPrice: "",
    commissionRate: "5",
    source: "AMAZON",
    affiliateUrl: "",
    imageUrl: "",
    images: "",
    categoryId: "",
    isFeatured: false,
    isActive: true,
  });

  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);

  // ── Toast helpers ──
  let toastIdRef = 0;
  const addToast = useCallback((type: "success" | "error", message: string) => {
    const id = ++toastIdRef;
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4000);
  }, []);

  const dismissToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  useEffect(() => {
    api.admin.getCategories().then(setCategories).catch(() => {});
  }, []);

  useEffect(() => {
    loadData();
  }, [tab, page, search, sourceFilter, activeFilter]);

  async function loadData() {
    setLoading(true);
    try {
      if (tab === "products") {
        const params: Record<string, string> = { page: String(page), limit: "20" };
        if (search) params.search = search;
        if (sourceFilter) params.source = sourceFilter;
        if (activeFilter) params.active = activeFilter;
        const res = await api.admin.getAffiliateProducts(params);
        setProducts(res.products || []);
        setTotal(res.pagination?.total || res.total || 0);
      } else if (tab === "program") {
        const res = await api.admin.getAffiliates();
        setAffiliates(res.affiliates || []);
      } else if (tab === "stats") {
        const res = await api.admin.getAffiliateStats();
        setStats(res);
      }
    } catch (e) {
      console.error(e);
      addToast("error", "Failed to load data");
    }
    setLoading(false);
  }

  function openEditForm(product: AffiliateProduct) {
    setEditingProduct(product);
    setForm({
      name: product.name,
      description: product.description || "",
      price: String(product.price),
      originalPrice: product.originalPrice ? String(product.originalPrice) : "",
      commissionRate: String(product.commissionRate || 5),
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
      name: "",
      description: "",
      price: "",
      originalPrice: "",
      commissionRate: "5",
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
        name: form.name,
        description: form.description,
        price: parseFloat(form.price),
        originalPrice: form.originalPrice ? parseFloat(form.originalPrice) : undefined,
        commissionRate: parseFloat(form.commissionRate),
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
        addToast("success", "Product updated successfully");
      } else {
        await api.admin.createAffiliateProduct(data);
        addToast("success", "Product created successfully");
      }
      resetForm();
      loadData();
    } catch (e: any) {
      addToast("error", e.message || "Failed to save product");
    }
  }

  async function handleDelete(id: string) {
    try {
      await api.admin.deleteAffiliateProduct(id);
      setDeleteTarget(null);
      addToast("success", "Product deleted");
      loadData();
    } catch (e: any) {
      addToast("error", e.message || "Failed to delete");
    }
  }

  async function handleImport() {
    try {
      const products = JSON.parse(importJson);
      const res = await api.admin.importAffiliateProducts(products);
      setShowImport(false);
      setImportJson("");
      addToast("success", `Imported ${res.imported || 0} products${res.failed ? `, ${res.failed} failed` : ""}`);
      loadData();
    } catch (e: any) {
      addToast("error", e.message || "Invalid JSON or import failed");
    }
  }

  async function handleAffiliateStatus(id: string, status: string) {
    try {
      await api.admin.updateAffiliateStatus(id, status);
      addToast("success", `Affiliate ${status.toLowerCase()}`);
      loadData();
    } catch (e: any) {
      addToast("error", e.message || "Failed to update status");
    }
  }

  async function handlePayout() {
    if (!payoutAffiliate) return;
    try {
      await api.admin.processAffiliatePayout(
        payoutAffiliate.id,
        parseFloat(payoutForm.amount),
        payoutForm.method,
        payoutForm.reference || undefined,
        payoutForm.notes || undefined
      );
      setShowPayout(false);
      setPayoutAffiliate(null);
      setPayoutForm({ amount: "", method: "MOBILE_MONEY", reference: "", notes: "" });
      addToast("success", "Payout processed successfully");
      loadData();
    } catch (e: any) {
      addToast("error", e.message || "Failed to process payout");
    }
  }

  function openPayoutModal(affiliate: AffiliateUser) {
    setPayoutAffiliate(affiliate);
    setPayoutForm({ amount: String(affiliate.pendingPayout || 0), method: "MOBILE_MONEY", reference: "", notes: "" });
    setShowPayout(true);
  }

  function copySignupLink() {
    const link = `${window.location.origin}/affiliate/signup`;
    navigator.clipboard.writeText(link);
    addToast("success", "Signup link copied to clipboard");
  }

  const sourceColors: Record<string, string> = {
    AMAZON: "bg-orange-100 text-orange-700",
    ALIEXPRESS: "bg-red-100 text-red-700",
    ALIBABA: "bg-yellow-100 text-yellow-700",
    MANUAL: "bg-blue-100 text-blue-700",
    OTHER: "bg-gray-100 text-gray-700",
  };

  const statusColors: Record<string, string> = {
    PENDING: "bg-yellow-100 text-yellow-700",
    APPROVED: "bg-green-100 text-green-700",
    REJECTED: "bg-red-100 text-red-700",
    SUSPENDED: "bg-gray-100 text-gray-700",
  };

  const totalPages = Math.ceil(total / 20);

  // Filter affiliates client-side
  const filteredAffiliates = affiliates.filter((a) => {
    if (statusFilter && a.status !== statusFilter) return false;
    if (affiliateSearch) {
      const q = affiliateSearch.toLowerCase();
      if (!a.name.toLowerCase().includes(q) && !a.email.toLowerCase().includes(q) && !a.code.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  // Summary counts
  const affiliateCounts = {
    total: affiliates.length,
    pending: affiliates.filter((a) => a.status === "PENDING").length,
    approved: affiliates.filter((a) => a.status === "APPROVED").length,
    suspended: affiliates.filter((a) => a.status === "SUSPENDED").length,
  };

  return (
    <div className="space-y-6">
      {/* Toast notifications */}
      <div className="fixed top-4 right-4 z-50 space-y-2 pointer-events-none">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className="pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg border animate-slide-in"
            style={{
              background: toast.type === "success" ? "#f0fdf4" : "#fef2f2",
              borderColor: toast.type === "success" ? "#bbf7d0" : "#fecaca",
            }}
          >
            {toast.type === "success" ? (
              <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0" />
            ) : (
              <XCircle className="w-5 h-5 text-red-600 shrink-0" />
            )}
            <span className={`text-sm font-medium ${toast.type === "success" ? "text-green-800" : "text-red-800"}`}>
              {toast.message}
            </span>
            <button onClick={() => dismissToast(toast.id)} className="ml-2 text-gray-400 hover:text-gray-600">
              <X className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>

      {/* Delete confirmation */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
          <div className="bg-white rounded-xl shadow-xl border p-6 max-w-sm mx-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-red-100 rounded-lg">
                <AlertTriangle className="w-5 h-5 text-red-600" />
              </div>
              <h3 className="font-semibold text-gray-900">Delete Product?</h3>
            </div>
            <p className="text-sm text-gray-600 mb-5">This will permanently remove this affiliate product and its click data.</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setDeleteTarget(null)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg text-sm font-medium">
                Cancel
              </button>
              <button onClick={() => handleDelete(deleteTarget)} className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 text-sm font-medium">
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Payout modal */}
      {showPayout && payoutAffiliate && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Process Payout</h2>
              <button onClick={() => setShowPayout(false)}><X className="w-5 h-5" /></button>
            </div>
            <div className="bg-gray-50 rounded-lg p-3 mb-4">
              <p className="font-medium">{payoutAffiliate.name}</p>
              <p className="text-sm text-gray-500">{payoutAffiliate.email}</p>
              <p className="text-sm text-green-600 font-medium mt-1">
                Pending: USh {payoutAffiliate.pendingPayout?.toFixed(0) || "0"}
              </p>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium mb-1">Amount *</label>
                <input
                  type="number"
                  step="0.01"
                  value={payoutForm.amount}
                  onChange={(e) => setPayoutForm({ ...payoutForm, amount: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                  placeholder="0.00"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Payment Method *</label>
                <select
                  value={payoutForm.method}
                  onChange={(e) => setPayoutForm({ ...payoutForm, method: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                >
                  <option value="MOBILE_MONEY">Mobile Money</option>
                  <option value="BANK_TRANSFER">Bank Transfer</option>
                  <option value="CASH">Cash</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Reference</label>
                <input
                  type="text"
                  value={payoutForm.reference}
                  onChange={(e) => setPayoutForm({ ...payoutForm, reference: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                  placeholder="Transaction ID or reference"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Notes</label>
                <textarea
                  value={payoutForm.notes}
                  onChange={(e) => setPayoutForm({ ...payoutForm, notes: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                  rows={2}
                  placeholder="Optional notes..."
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-4 mt-4 border-t">
              <button onClick={() => setShowPayout(false)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">
                Cancel
              </button>
              <button
                onClick={handlePayout}
                disabled={!payoutForm.amount || parseFloat(payoutForm.amount) <= 0}
                className="px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
              >
                Process Payout
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Share signup link modal */}
      {showShareLink && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Affiliate Signup Link</h2>
              <button onClick={() => setShowShareLink(false)}><X className="w-5 h-5" /></button>
            </div>
            <p className="text-sm text-gray-500 mb-3">Share this link with potential affiliates so they can sign up to promote your products.</p>
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={typeof window !== "undefined" ? `${window.location.origin}/affiliate/signup` : "/affiliate/signup"}
                className="flex-1 border rounded-lg px-3 py-2 text-sm bg-gray-50 font-mono"
              />
              <button
                onClick={copySignupLink}
                className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg text-sm hover:bg-primary/90"
              >
                <Copy className="w-4 h-4" />
                Copy
              </button>
            </div>
            <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-xs text-blue-700">
                <strong>Tip:</strong> Share this on social media, include it in emails, or add it to your website footer to attract affiliates.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">Affiliate Management</h1>
          <p className="text-sm text-gray-500 mt-1">Manage affiliate products and your affiliate program</p>
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
            {id === "program" && affiliateCounts.pending > 0 && (
              <span className="w-5 h-5 bg-amber-500 text-white rounded-full text-[10px] font-bold flex items-center justify-center">
                {affiliateCounts.pending}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ═══════════════════ Products Tab ═══════════════════ */}
      {tab === "products" && (
        <div className="space-y-4">
          {/* Actions bar */}
          <div className="flex flex-wrap gap-3 items-center">
            <div className="relative flex-1 min-w-[200px] max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search affiliate products..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                className="w-full pl-10 pr-4 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              />
            </div>
            <select
              value={sourceFilter}
              onChange={(e) => { setSourceFilter(e.target.value); setPage(1); }}
              className="border rounded-lg px-3 py-2 text-sm bg-white"
            >
              <option value="">All Sources</option>
              <option value="AMAZON">Amazon</option>
              <option value="ALIEXPRESS">AliExpress</option>
              <option value="ALIBABA">Alibaba</option>
              <option value="MANUAL">Manual</option>
            </select>
            <select
              value={activeFilter}
              onChange={(e) => { setActiveFilter(e.target.value); setPage(1); }}
              className="border rounded-lg px-3 py-2 text-sm bg-white"
            >
              <option value="">All Status</option>
              <option value="true">Active</option>
              <option value="false">Inactive</option>
            </select>
            <button
              onClick={() => { resetForm(); setShowForm(true); }}
              className="flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-lg text-sm hover:bg-primary/90"
            >
              <Plus className="w-4 h-4" /> Add Product
            </button>
            <button
              onClick={() => setShowImport(true)}
              className="flex items-center gap-2 bg-gray-100 text-gray-700 px-4 py-2 rounded-lg text-sm hover:bg-gray-200"
            >
              <Upload className="w-4 h-4" /> Bulk Import
            </button>
            <button onClick={loadData} className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100" title="Refresh">
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
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
                      <label className="block text-sm font-medium mb-1">Product Name *</label>
                      <input
                        type="text"
                        required
                        value={form.name}
                        onChange={(e) => setForm({ ...form, name: e.target.value })}
                        className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                        placeholder="e.g., Premium Wireless Earbuds"
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-sm font-medium mb-1">Description</label>
                      <textarea
                        value={form.description}
                        onChange={(e) => setForm({ ...form, description: e.target.value })}
                        className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
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
                        className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Original Price</label>
                      <input
                        type="number"
                        step="0.01"
                        value={form.originalPrice}
                        onChange={(e) => setForm({ ...form, originalPrice: e.target.value })}
                        className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                        placeholder="Show as strikethrough"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Commission %</label>
                      <input
                        type="number"
                        step="0.1"
                        value={form.commissionRate}
                        onChange={(e) => setForm({ ...form, commissionRate: e.target.value })}
                        className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Source *</label>
                      <select
                        value={form.source}
                        onChange={(e) => setForm({ ...form, source: e.target.value })}
                        className="w-full border rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                      >
                        <option value="AMAZON">Amazon</option>
                        <option value="ALIEXPRESS">AliExpress</option>
                        <option value="ALIBABA">Alibaba</option>
                        <option value="MANUAL">Manual</option>
                      </select>
                    </div>
                    <div className="col-span-2">
                      <label className="block text-sm font-medium mb-1">Affiliate URL *</label>
                      <input
                        type="url"
                        required
                        value={form.affiliateUrl}
                        onChange={(e) => setForm({ ...form, affiliateUrl: e.target.value })}
                        className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                        placeholder="https://amzn.to/..."
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-sm font-medium mb-1">Image URL</label>
                      <input
                        type="url"
                        value={form.imageUrl}
                        onChange={(e) => setForm({ ...form, imageUrl: e.target.value })}
                        className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                        placeholder="https://..."
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-sm font-medium mb-1">Additional Images (comma-separated URLs)</label>
                      <input
                        type="text"
                        value={form.images}
                        onChange={(e) => setForm({ ...form, images: e.target.value })}
                        className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                        placeholder="url1, url2, url3"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Category</label>
                      <select
                        value={form.categoryId}
                        onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
                        className="w-full border rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                      >
                        <option value="">No Category</option>
                        {categories.map((c) => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>
                    </div>
                    <div className="flex items-center gap-6 pt-4">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={form.isFeatured}
                          onChange={(e) => setForm({ ...form, isFeatured: e.target.checked })}
                          className="rounded"
                        />
                        <span className="text-sm">Featured</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={form.isActive}
                          onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                          className="rounded"
                        />
                        <span className="text-sm">Active</span>
                      </label>
                    </div>
                  </div>
                  <div className="flex justify-end gap-3 pt-4 border-t">
                    <button type="button" onClick={resetForm} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">
                      Cancel
                    </button>
                    <button type="submit" className="px-4 py-2 text-sm bg-primary text-white rounded-lg hover:bg-primary/90">
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
                  Paste a JSON array of products. Each object needs: <code className="bg-gray-100 px-1 rounded text-xs">name</code>, <code className="bg-gray-100 px-1 rounded text-xs">price</code>, <code className="bg-gray-100 px-1 rounded text-xs">source</code>, <code className="bg-gray-100 px-1 rounded text-xs">affiliateUrl</code>. Optional: description, originalPrice, commissionRate, imageUrl, images.
                </p>
                <textarea
                  value={importJson}
                  onChange={(e) => setImportJson(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  rows={10}
                  placeholder={`[\n  {\n    "name": "Product Name",\n    "price": 29.99,\n    "source": "AMAZON",\n    "affiliateUrl": "https://amzn.to/...",\n    "imageUrl": "https://...",\n    "commissionRate": 5\n  }\n]`}
                />
                <div className="flex justify-end gap-3 mt-4">
                  <button onClick={() => setShowImport(false)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">
                    Cancel
                  </button>
                  <button
                    onClick={handleImport}
                    disabled={!importJson.trim()}
                    className="px-4 py-2 text-sm bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50"
                  >
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
            <div className="bg-white rounded-xl border shadow-sm p-12 text-center">
              <div className="w-16 h-16 rounded-2xl bg-blue-50 flex items-center justify-center mx-auto mb-4">
                <Globe className="w-8 h-8 text-blue-400" />
              </div>
              <h3 className="font-semibold text-gray-900 mb-1">No affiliate products yet</h3>
              <p className="text-sm text-gray-500 mb-6 max-w-sm mx-auto">
                Add products from Amazon, AliExpress, or Alibaba to start earning commissions on every click.
              </p>
              <div className="flex items-center justify-center gap-3">
                <button
                  onClick={() => { resetForm(); setShowForm(true); }}
                  className="flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-lg text-sm hover:bg-primary/90"
                >
                  <Plus className="w-4 h-4" /> Add First Product
                </button>
                <button
                  onClick={() => setShowImport(true)}
                  className="flex items-center gap-2 bg-gray-100 text-gray-700 px-4 py-2 rounded-lg text-sm hover:bg-gray-200"
                >
                  <Upload className="w-4 h-4" /> Bulk Import
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="bg-white rounded-xl border overflow-hidden shadow-sm">
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
                                alt={p.name}
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
                              <p className="font-medium text-gray-900 line-clamp-1">{p.name}</p>
                              {(p.category?.name || p.categoryName) && (
                                <p className="text-xs text-gray-400">{p.category?.name || p.categoryName}</p>
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
                          {p.originalPrice && (
                            <span className="text-xs text-gray-400 line-through ml-1">${p.originalPrice.toFixed(2)}</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right text-green-600 font-medium">{p.commissionRate || 0}%</td>
                        <td className="px-4 py-3 text-right">{p.clicks ?? p._count?.clicks ?? 0}</td>
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
                              className="p-1.5 text-gray-400 hover:text-blue-600 rounded"
                              title="Open affiliate link"
                            >
                              <ExternalLink className="w-4 h-4" />
                            </a>
                            <button
                              onClick={() => openEditForm(p)}
                              className="p-1.5 text-gray-400 hover:text-blue-600 rounded"
                              title="Edit"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => setDeleteTarget(p.id)}
                              className="p-1.5 text-gray-400 hover:text-red-600 rounded"
                              title="Delete"
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
                      className="p-2 rounded-lg border disabled:opacity-50 hover:bg-gray-50"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <span className="text-sm">Page {page} of {totalPages}</span>
                    <button
                      onClick={() => setPage(Math.min(totalPages, page + 1))}
                      disabled={page === totalPages}
                      className="p-2 rounded-lg border disabled:opacity-50 hover:bg-gray-50"
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

      {/* ═══════════════════ Program Tab ═══════════════════ */}
      {tab === "program" && (
        <div className="space-y-4">
          {/* Summary cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-white rounded-xl border p-4">
              <p className="text-xs text-gray-500 mb-1">Total Affiliates</p>
              <p className="text-2xl font-bold">{affiliateCounts.total}</p>
            </div>
            <div className="bg-white rounded-xl border p-4">
              <p className="text-xs text-gray-500 mb-1">Pending Approval</p>
              <p className="text-2xl font-bold text-amber-600">{affiliateCounts.pending}</p>
            </div>
            <div className="bg-white rounded-xl border p-4">
              <p className="text-xs text-gray-500 mb-1">Active</p>
              <p className="text-2xl font-bold text-green-600">{affiliateCounts.approved}</p>
            </div>
            <div className="bg-white rounded-xl border p-4">
              <p className="text-xs text-gray-500 mb-1">Suspended</p>
              <p className="text-2xl font-bold text-gray-400">{affiliateCounts.suspended}</p>
            </div>
          </div>

          {/* Search & filters */}
          <div className="flex flex-wrap gap-3 items-center">
            <div className="relative flex-1 min-w-[200px] max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search by name, email, or code..."
                value={affiliateSearch}
                onChange={(e) => setAffiliateSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="border rounded-lg px-3 py-2 text-sm bg-white"
            >
              <option value="">All Status</option>
              <option value="PENDING">Pending</option>
              <option value="APPROVED">Approved</option>
              <option value="REJECTED">Rejected</option>
              <option value="SUSPENDED">Suspended</option>
            </select>
            <button
              onClick={() => setShowShareLink(true)}
              className="flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-lg text-sm hover:bg-primary/90 ml-auto"
            >
              <Share2 className="w-4 h-4" /> Share Signup Link
            </button>
            <button onClick={loadData} className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100" title="Refresh">
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>

          {loading ? (
            <div className="flex justify-center py-12">
              <RefreshCw className="w-6 h-6 animate-spin text-gray-400" />
            </div>
          ) : filteredAffiliates.length === 0 ? (
            <div className="bg-white rounded-xl border shadow-sm p-12 text-center">
              <div className="w-16 h-16 rounded-2xl bg-purple-50 flex items-center justify-center mx-auto mb-4">
                <Users className="w-8 h-8 text-purple-400" />
              </div>
              <h3 className="font-semibold text-gray-900 mb-1">
                {affiliates.length === 0 ? "No affiliates yet" : "No matching affiliates"}
              </h3>
              <p className="text-sm text-gray-500 mb-6 max-w-sm mx-auto">
                {affiliates.length === 0
                  ? "Share your affiliate signup link so people can start promoting your products and earn commissions."
                  : "Try adjusting your filters or search terms."}
              </p>
              {affiliates.length === 0 && (
                <button
                  onClick={() => setShowShareLink(true)}
                  className="flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-lg text-sm hover:bg-primary/90 mx-auto"
                >
                  <Share2 className="w-4 h-4" /> Share Signup Link
                </button>
              )}
            </div>
          ) : (
            <div className="bg-white rounded-xl border overflow-hidden shadow-sm">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
                  <tr>
                    <th className="text-left px-4 py-3">Affiliate</th>
                    <th className="text-left px-4 py-3">Code</th>
                    <th className="text-right px-4 py-3">Commission</th>
                    <th className="text-right px-4 py-3">Clicks</th>
                    <th className="text-right px-4 py-3">Conversions</th>
                    <th className="text-right px-4 py-3">Earnings</th>
                    <th className="text-right px-4 py-3">Pending</th>
                    <th className="text-center px-4 py-3">Status</th>
                    <th className="text-right px-4 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filteredAffiliates.map((a) => (
                    <tr key={a.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <p className="font-medium">{a.name}</p>
                        <p className="text-xs text-gray-400">{a.email}</p>
                        {a.website && (
                          <a href={a.website} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-500 hover:underline flex items-center gap-1">
                            <Link className="w-3 h-3" />{a.website.replace(/^https?:\/\//, "").slice(0, 30)}
                          </a>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <code className="text-xs bg-gray-100 px-2 py-0.5 rounded">{a.code}</code>
                          <button
                            onClick={() => { navigator.clipboard.writeText(a.code); addToast("success", "Code copied"); }}
                            className="p-1 text-gray-400 hover:text-gray-600"
                            title="Copy code"
                          >
                            <Copy className="w-3 h-3" />
                          </button>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">{a.commissionRate}%</td>
                      <td className="px-4 py-3 text-right">{a.totalClicks}</td>
                      <td className="px-4 py-3 text-right">{a.conversions}</td>
                      <td className="px-4 py-3 text-right font-medium text-green-600">
                        USh {a.totalEarnings.toFixed(0)}
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-amber-600">
                        USh {(a.pendingPayout || 0).toFixed(0)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`text-xs px-2 py-1 rounded-full font-medium ${statusColors[a.status] || "bg-gray-100 text-gray-700"}`}>
                          {a.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {a.status === "PENDING" && (
                            <>
                              <button
                                onClick={() => handleAffiliateStatus(a.id, "APPROVED")}
                                className="p-1.5 text-gray-400 hover:text-green-600 rounded"
                                title="Approve"
                              >
                                <Check className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleAffiliateStatus(a.id, "REJECTED")}
                                className="p-1.5 text-gray-400 hover:text-red-600 rounded"
                                title="Reject"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </>
                          )}
                          {a.status === "APPROVED" && (
                            <>
                              {(a.pendingPayout || 0) > 0 && (
                                <button
                                  onClick={() => openPayoutModal(a)}
                                  className="p-1.5 text-gray-400 hover:text-green-600 rounded"
                                  title="Process payout"
                                >
                                  <CreditCard className="w-4 h-4" />
                                </button>
                              )}
                              <button
                                onClick={() => handleAffiliateStatus(a.id, "SUSPENDED")}
                                className="p-1.5 text-gray-400 hover:text-red-600 rounded"
                                title="Suspend"
                              >
                                <Ban className="w-4 h-4" />
                              </button>
                            </>
                          )}
                          {a.status === "SUSPENDED" && (
                            <button
                              onClick={() => handleAffiliateStatus(a.id, "APPROVED")}
                              className="p-1.5 text-gray-400 hover:text-green-600 rounded"
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

      {/* ═══════════════════ Stats Tab ═══════════════════ */}
      {tab === "stats" && (
        <div className="space-y-4">
          {loading ? (
            <div className="flex justify-center py-12">
              <RefreshCw className="w-6 h-6 animate-spin text-gray-400" />
            </div>
          ) : stats ? (
            <>
              {/* Stat cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white rounded-xl border shadow-sm p-5">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
                      <Package className="w-5 h-5 text-blue-600" />
                    </div>
                    <p className="text-sm text-gray-500">Affiliate Products</p>
                  </div>
                  <p className="text-2xl font-bold">{stats.totalProducts || 0}</p>
                  <p className="text-xs text-gray-400 mt-1">{stats.activeProducts || 0} active</p>
                </div>
                <div className="bg-white rounded-xl border shadow-sm p-5">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-lg bg-green-50 flex items-center justify-center">
                      <MousePointerClick className="w-5 h-5 text-green-600" />
                    </div>
                    <p className="text-sm text-gray-500">Total Clicks</p>
                  </div>
                  <p className="text-2xl font-bold">{stats.totalClicks || 0}</p>
                  <p className="text-xs text-gray-400 mt-1">Last 30 days</p>
                </div>
                <div className="bg-white rounded-xl border shadow-sm p-5">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-lg bg-purple-50 flex items-center justify-center">
                      <Users className="w-5 h-5 text-purple-600" />
                    </div>
                    <p className="text-sm text-gray-500">Affiliates</p>
                  </div>
                  <p className="text-2xl font-bold">{affiliateCounts.total}</p>
                  <p className="text-xs text-gray-400 mt-1">{affiliateCounts.approved} active, {affiliateCounts.pending} pending</p>
                </div>
                <div className="bg-white rounded-xl border shadow-sm p-5">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-lg bg-orange-50 flex items-center justify-center">
                      <BarChart3 className="w-5 h-5 text-orange-600" />
                    </div>
                    <p className="text-sm text-gray-500">Click Rate</p>
                  </div>
                  <p className="text-2xl font-bold">
                    {stats.totalProducts > 0 ? ((stats.totalClicks || 0) / stats.totalProducts).toFixed(1) : "0"}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">Avg clicks per product</p>
                </div>
              </div>

              {/* Top Products */}
              {stats.topClicked && stats.topClicked.length > 0 && (
                <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
                  <div className="px-5 py-4 border-b bg-gray-50">
                    <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                      <Star className="w-4 h-4 text-amber-500" />
                      Top Products by Clicks
                    </h3>
                  </div>
                  <div className="divide-y">
                    {stats.topClicked.map((p: any, i: number) => (
                      <div key={p.id} className="flex items-center gap-4 px-5 py-3 hover:bg-gray-50">
                        <span className="text-sm font-bold text-gray-300 w-6 text-center">{i + 1}</span>
                        {p.imageUrl ? (
                          <Image src={p.imageUrl} alt={p.name} width={36} height={36} className="rounded-lg object-cover" />
                        ) : (
                          <div className="w-9 h-9 bg-gray-100 rounded-lg flex items-center justify-center">
                            <Globe className="w-4 h-4 text-gray-400" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{p.name}</p>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${sourceColors[p.source] || sourceColors.OTHER}`}>
                            {p.source}
                          </span>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-semibold">{p.clicks} clicks</p>
                        </div>
                        {p.affiliateUrl && (
                          <a href={p.affiliateUrl} target="_blank" rel="noopener noreferrer" className="p-1.5 text-gray-400 hover:text-blue-600">
                            <ExternalLink className="w-4 h-4" />
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Quick actions */}
              <div className="bg-white rounded-xl border shadow-sm p-5">
                <h3 className="font-semibold text-gray-900 mb-3">Quick Actions</h3>
                <div className="flex flex-wrap gap-3">
                  <button
                    onClick={() => setTab("products")}
                    className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm hover:bg-gray-200"
                  >
                    <Globe className="w-4 h-4" /> Manage Products
                  </button>
                  <button
                    onClick={() => setTab("program")}
                    className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm hover:bg-gray-200"
                  >
                    <Users className="w-4 h-4" /> View Affiliates
                  </button>
                  <button
                    onClick={() => setShowShareLink(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm hover:bg-gray-200"
                  >
                    <Share2 className="w-4 h-4" /> Share Signup Link
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="bg-white rounded-xl border shadow-sm p-12 text-center">
              <div className="w-16 h-16 rounded-2xl bg-green-50 flex items-center justify-center mx-auto mb-4">
                <TrendingUp className="w-8 h-8 text-green-400" />
              </div>
              <h3 className="font-semibold text-gray-900 mb-1">No statistics available</h3>
              <p className="text-sm text-gray-500 mb-6 max-w-sm mx-auto">
                Statistics will appear once you add affiliate products and start tracking clicks.
              </p>
              <button
                onClick={() => setTab("products")}
                className="flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-lg text-sm hover:bg-primary/90 mx-auto"
              >
                <Plus className="w-4 h-4" /> Add Products to Get Started
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
