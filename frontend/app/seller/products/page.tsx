"use client";

import { useEffect, useState, useCallback } from "react";
import { apiFetch } from "@/lib/api";
import {
  Package,
  Plus,
  Search,
  Edit2,
  Trash2,
  Zap,
  X,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  Image as ImageIcon,
  Upload,
  Loader2,
  CheckSquare,
  Square,
  Power,
  PowerOff,
  ChevronDown,
  ChevronUp,
  Download,
  FileUp,
  Layers,
  Wallet,
  PlusCircle,
  Truck,
} from "lucide-react";
import { useToast } from "@/lib/hooks/useToast";
import { useRouter } from "next/navigation";

interface ProductVariant {
  name: string;
  sku: string;
  price: string;
  stock: string;
  size?: string;
  color?: string;
  material?: string;
}

interface Product {
  id: string;
  name: string;
  price: number;
  comparePrice?: number;
  stock: number;
  status: string;
  moderationNote?: string;
  images: string[];
  category?: { id: string; name: string };
  hasVariants?: boolean;
  variants?: ProductVariant[];
  createdAt: string;
}

interface Category {
  id: string;
  name: string;
}

interface SpecEntry {
  key: string;
  value: string;
}

interface ProductForm {
  name: string;
  description: string;
  price: string;
  comparePrice: string;
  categoryId: string;
  stock: string;
  imageUrls: string[];
  tags: string;
  sku: string;
  weight: string;
  specifications: SpecEntry[];
  metaTitle: string;
  metaDescription: string;
  trackInventory: boolean;
  allowBackorder: boolean;
  lowStockAlert: string;
  hasVariants: boolean;
  variantOptionTypes: string[];
  variantOptionValues: Record<string, string[]>;
  variants: ProductVariant[];
  allowedDeliveryMethods: string[];
  codAllowed: boolean;
  shippingFee: string;
}

const emptyForm: ProductForm = {
  name: "",
  description: "",
  price: "",
  comparePrice: "",
  categoryId: "",
  stock: "",
  imageUrls: [],
  tags: "",
  sku: "",
  weight: "",
  specifications: [],
  metaTitle: "",
  metaDescription: "",
  trackInventory: true,
  allowBackorder: false,
  lowStockAlert: "5",
  hasVariants: false,
  variantOptionTypes: [],
  variantOptionValues: {},
  variants: [],
  allowedDeliveryMethods: [],
  codAllowed: true,
  shippingFee: "",
};

const statusTabs = ["ALL", "ACTIVE", "DRAFT", "PENDING_REVIEW"];

export default function SellerProducts() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [showModal, setShowModal] = useState(false);
  const [activeTab, setActiveTab] = useState("general");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ProductForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [formError, setFormError] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);
  const [showInventory, setShowInventory] = useState(false);
  const [showSpecs, setShowSpecs] = useState(false);
  const [showSeo, setShowSeo] = useState(false);
  const [showVariants, setShowVariants] = useState(false);
  const [showDelivery, setShowDelivery] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importPreview, setImportPreview] = useState<string[][]>([]);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<string>("");
  const [exporting, setExporting] = useState(false);
  const { showToast } = useToast();
  const router = useRouter();

  const fetchProducts = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({ page: page.toString() });
      if (search) params.set("search", search);
      if (statusFilter !== "ALL") params.set("status", statusFilter);
      const data = await apiFetch(`/api/seller/products?${params}`);
      setProducts(data.products || []);
      setTotalPages(data.pagination?.totalPages || 1);
    } catch (err: any) {
      setError(err.message || "Failed to load products");
    } finally {
      setLoading(false);
    }
  }, [page, search, statusFilter]);

  const fetchCategories = useCallback(async () => {
    try {
      const data = await apiFetch("/api/categories");
      setCategories(data.categories || data || []);
    } catch {
      // Categories are optional for display
    }
  }, []);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setFormError("");
    setActiveTab("general");
    setShowModal(true);
  };

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (params.get("action") === "new") {
        openCreate();
        // Remove query param to prevent modal reopening on refresh
        const newUrl = window.location.pathname;
        window.history.replaceState({ path: newUrl }, "", newUrl);
      }
    }
  }, []);

  const openEdit = async (product: Product) => {
    setEditingId(product.id);
    setFormError("");
    setActiveTab("general");
    setShowModal(true);
    // Fetch full product details (including description and tags)
    try {
      const data = await apiFetch(`/api/seller/products/${product.id}`);
      const p = data.product || data;
      setForm({
        name: p.name || product.name,
        description: p.description || "",
        price: (p.price ?? product.price).toString(),
        comparePrice: p.comparePrice?.toString() || product.comparePrice?.toString() || "",
        categoryId: p.category?.id || product.category?.id || "",
        stock: (p.stock ?? product.stock).toString(),
        imageUrls: p.images?.map((img: any) => typeof img === "string" ? img : img.url) || product.images || [],
        tags: Array.isArray(p.tags) ? p.tags.join(", ") : "",
        sku: p.sku || "",
        weight: p.weight?.toString() || "",
        specifications: Array.isArray(p.specifications) ? p.specifications : [],
        metaTitle: p.metaTitle || "",
        metaDescription: p.metaDescription || "",
        trackInventory: p.trackInventory !== false,
        allowBackorder: p.allowBackorder === true,
        lowStockAlert: (p.lowStockAlert ?? 5).toString(),
        hasVariants: p.hasVariants || false,
        variantOptionTypes: [],
        variantOptionValues: {},
        variants: (p.variants || []).map((v: any) => ({
          name: v.name || "",
          sku: v.sku || "",
          price: v.price?.toString() || "",
          stock: v.stock?.toString() || "0",
          size: v.size || "",
          color: v.color || "",
          material: v.material || "",
        })),
        allowedDeliveryMethods: Array.isArray(p.allowedDeliveryMethods) ? p.allowedDeliveryMethods : [],
        codAllowed: p.codAllowed !== false,
        shippingFee: p.shippingFee != null ? String(Number(p.shippingFee)) : "",
      });
    } catch {
      setForm({
        ...emptyForm,
        name: product.name,
        price: product.price.toString(),
        comparePrice: product.comparePrice?.toString() || "",
        categoryId: product.category?.id || "",
        stock: product.stock.toString(),
        imageUrls: product.images || [],
      });
    }
  };

  const handleImageUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    setFormError("");
    try {
      const formData = new FormData();
      Array.from(files).forEach((f) => formData.append("images", f));
      const data = await apiFetch("/api/seller/upload-images", {
        method: "POST",
        body: formData,
      });
      setForm((prev) => ({
        ...prev,
        imageUrls: [...prev.imageUrls, ...data.urls],
      }));
    } catch (err: any) {
      setFormError(err.message || "Failed to upload images");
    } finally {
      setUploading(false);
    }
  };

  const removeImage = (index: number) => {
    setForm((prev) => ({
      ...prev,
      imageUrls: prev.imageUrls.filter((_, i) => i !== index),
    }));
  };

  const handleSave = async () => {
    if (!form.name || !form.price) {
      setFormError("Name and price are required");
      return;
    }
    try {
      setSaving(true);
      setFormError("");
      const body: any = {
        name: form.name,
        description: form.description,
        price: parseFloat(form.price),
        comparePrice: form.comparePrice ? parseFloat(form.comparePrice) : undefined,
        categoryId: form.categoryId || undefined,
        stock: form.stock ? parseInt(form.stock) : 0,
        images: form.imageUrls.map((url) => ({ url })),
        tags: form.tags
          ? form.tags.split(",").map((s) => s.trim()).filter(Boolean)
          : [],
        sku: form.sku || undefined,
        weight: form.weight ? parseFloat(form.weight) : undefined,
        specifications: form.specifications.filter((s) => s.key && s.value),
        metaTitle: form.metaTitle || undefined,
        metaDescription: form.metaDescription || undefined,
        trackInventory: form.trackInventory,
        allowBackorder: form.allowBackorder,
        lowStockAlert: form.lowStockAlert ? parseInt(form.lowStockAlert) : 5,
        hasVariants: form.hasVariants,
        variants: form.hasVariants ? form.variants.map((v) => ({
          name: v.name,
          sku: v.sku || undefined,
          price: v.price ? parseFloat(v.price) : undefined,
          stock: parseInt(v.stock) || 0,
          size: v.size || undefined,
          color: v.color || undefined,
          material: v.material || undefined,
        })) : undefined,
        allowedDeliveryMethods: form.allowedDeliveryMethods,
        codAllowed: form.codAllowed,
        shippingFee: form.shippingFee ? parseFloat(form.shippingFee) : undefined,
      };
      if (editingId) {
        await apiFetch(`/api/seller/products/${editingId}`, {
          method: "PUT",
          body: JSON.stringify(body),
        });
      } else {
        await apiFetch("/api/seller/products", {
          method: "POST",
          body: JSON.stringify(body),
        });
      }
      setShowModal(false);
      fetchProducts();
    } catch (err: any) {
      setFormError(err.message || "Failed to save product");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this product?")) return;
    try {
      await apiFetch(`/api/seller/products/${id}`, { method: "DELETE" });
      showToast("Product deleted", "success");
      fetchProducts();
    } catch (err: any) {
      showToast(err.message || "Failed to delete product", "error");
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === products.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(products.map((p) => p.id)));
    }
  };

  // CSV Export
  const handleExport = async () => {
    setExporting(true);
    try {
      const res = await apiFetch("/api/seller/products/export");
      const blob = new Blob([res.csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `products-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      showToast("Products exported", "success");
    } catch (err: any) {
      showToast(err.message || "Export failed", "error");
    } finally {
      setExporting(false);
    }
  };

  // CSV Import - parse preview
  const handleImportFile = (file: File) => {
    setImportFile(file);
    setImportResult("");
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const lines = text.split("\n").filter((l) => l.trim());
      const parsed = lines.slice(0, 6).map((l) => l.split(",").map((c) => c.trim().replace(/^"|"$/g, "")));
      setImportPreview(parsed);
    };
    reader.readAsText(file);
  };

  const handleImport = async () => {
    if (!importFile) return;
    setImporting(true);
    setImportResult("");
    try {
      const formData = new FormData();
      formData.append("file", importFile);
      const res = await apiFetch("/api/seller/products/import", {
        method: "POST",
        body: formData,
      });
      setImportResult(`Successfully imported ${res.imported} products${res.errors?.length ? `. ${res.errors.length} errors.` : "."}`);
      fetchProducts();
    } catch (err: any) {
      setImportResult(err.message || "Import failed");
    } finally {
      setImporting(false);
    }
  };

  // Generate variant matrix from option types/values
  const generateVariants = () => {
    const types = form.variantOptionTypes.filter((t) => form.variantOptionValues[t]?.length > 0);
    if (types.length === 0) return;
    const valueSets = types.map((t) => form.variantOptionValues[t]);
    const combos: string[][] = valueSets.reduce<string[][]>(
      (acc, vals) => acc.flatMap((combo) => vals.map((v) => [...combo, v])),
      [[]]
    );
    const variants: ProductVariant[] = combos.map((combo) => {
      const nameStr = combo.join(" / ");
      const variant: ProductVariant = { name: nameStr, sku: "", price: "", stock: "0" };
      types.forEach((t, i) => {
        if (t === "Size") variant.size = combo[i];
        else if (t === "Color") variant.color = combo[i];
        else if (t === "Material") variant.material = combo[i];
      });
      return variant;
    });
    setForm((prev) => ({ ...prev, variants }));
  };

  const handleBulk = async (action: "activate" | "deactivate" | "delete") => {
    if (selectedIds.size === 0) return;
    if (action === "delete" && !confirm(`Delete ${selectedIds.size} products?`)) return;
    try {
      setBulkLoading(true);
      await apiFetch("/api/seller/products/bulk", {
        method: "PUT",
        body: JSON.stringify({ action, productIds: Array.from(selectedIds) }),
      });
      showToast(`${selectedIds.size} products ${action}d successfully`, "success");
      setSelectedIds(new Set());
      fetchProducts();
    } catch (err: any) {
      showToast(err.message || "Bulk operation failed", "error");
    } finally {
      setBulkLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h2 className="text-xl font-bold text-gray-900">My Products</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={handleExport}
            disabled={exporting}
            className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors"
          >
            <Download className="w-4 h-4" />
            {exporting ? "Exporting..." : "Export CSV"}
          </button>
          <button
            onClick={() => { setShowImportModal(true); setImportFile(null); setImportPreview([]); setImportResult(""); }}
            className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <FileUp className="w-4 h-4" />
            Import CSV
          </button>
          <button
            onClick={openCreate}
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors text-sm font-medium"
          >
            <Plus className="w-4 h-4" />
            Add Product
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search products..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
          </div>
          <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
            {statusTabs.map((tab) => (
              <button
                key={tab}
                onClick={() => {
                  setStatusFilter(tab);
                  setPage(1);
                }}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  statusFilter === tab
                    ? "bg-white text-gray-900 shadow-sm"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                {tab === "PENDING_REVIEW" ? "Pending Review" : tab}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 p-4 bg-red-50 border border-red-100 rounded-xl text-red-600 text-sm">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
          </div>
        ) : products.length === 0 ? (
          <div className="text-center py-16">
            <Package className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">No products found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left text-xs font-medium text-gray-500 uppercase px-3 py-3 w-10">
                    <button onClick={toggleSelectAll} className="p-1 hover:bg-gray-100 rounded">
                      {selectedIds.size === products.length && products.length > 0 ? (
                        <CheckSquare className="w-4 h-4 text-primary" />
                      ) : (
                        <Square className="w-4 h-4 text-gray-400" />
                      )}
                    </button>
                  </th>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase px-6 py-3">
                    Product
                  </th>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase px-6 py-3">
                    Price
                  </th>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase px-6 py-3">
                    Stock
                  </th>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase px-6 py-3">
                    Status
                  </th>
                  <th className="text-right text-xs font-medium text-gray-500 uppercase px-6 py-3">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {products.map((product) => (
                  <tr key={product.id} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="px-3 py-4">
                      <button onClick={() => toggleSelect(product.id)} className="p-1 hover:bg-gray-100 rounded">
                        {selectedIds.has(product.id) ? (
                          <CheckSquare className="w-4 h-4 text-primary" />
                        ) : (
                          <Square className="w-4 h-4 text-gray-400" />
                        )}
                      </button>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden">
                          {product.images?.[0] ? (
                            <img
                              src={product.images[0]}
                              alt={product.name}
                              className="w-10 h-10 object-cover rounded-lg"
                            />
                          ) : (
                            <ImageIcon className="w-5 h-5 text-gray-400" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">
                            {product.name}
                          </p>
                          {product.category && (
                            <p className="text-xs text-gray-500">{product.category.name}</p>
                          )}
                          {product.hasVariants && (
                            <span className="inline-flex items-center gap-1 text-xs text-indigo-600">
                              <Layers className="w-3 h-3" />
                              {product.variants?.length || 0} variants
                            </span>
                          )}
                          {product.moderationNote && product.status === "PENDING_REVIEW" && (
                            <p className="text-xs text-yellow-600 mt-0.5" title={product.moderationNote}>
                              Note: {product.moderationNote.slice(0, 60)}{product.moderationNote.length > 60 ? "..." : ""}
                            </p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">
                      UGX {product.price.toLocaleString()}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`text-sm font-medium ${
                          product.stock <= 0
                            ? "text-red-600"
                            : product.stock <= 5
                            ? "text-yellow-600"
                            : "text-gray-900"
                        }`}
                      >
                        {product.stock}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${
                          product.status === "ACTIVE"
                            ? "bg-green-100 text-green-700"
                            : product.status === "PENDING_REVIEW"
                            ? "bg-yellow-100 text-yellow-700"
                            : "bg-gray-100 text-gray-600"
                        }`}
                      >
                        {product.status === "PENDING_REVIEW" ? "Pending Review" : product.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {product.status === "ACTIVE" && (
                          <button
                            onClick={() => router.push("/seller/ads")}
                            className="p-1.5 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                            title="Promote"
                          >
                            <Zap className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          onClick={() => openEdit(product)}
                          className="p-1.5 text-gray-400 hover:text-primary hover:bg-primary/5 rounded-lg transition-colors"
                          title="Edit"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(product.id)}
                          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
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
        )}

        {/* Bulk Actions Bar */}
        {selectedIds.size > 0 && (
          <div className="flex items-center gap-3 px-6 py-3 bg-primary/5 border-t border-primary/10">
            <span className="text-sm font-medium text-gray-700">{selectedIds.size} selected</span>
            <div className="flex gap-2 ml-auto">
              <button
                onClick={() => handleBulk("activate")}
                disabled={bulkLoading}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-green-50 text-green-700 rounded-lg hover:bg-green-100 disabled:opacity-50"
              >
                <Power className="w-3.5 h-3.5" /> Activate
              </button>
              <button
                onClick={() => handleBulk("deactivate")}
                disabled={bulkLoading}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-yellow-50 text-yellow-700 rounded-lg hover:bg-yellow-100 disabled:opacity-50"
              >
                <PowerOff className="w-3.5 h-3.5" /> Deactivate
              </button>
              <button
                onClick={() => handleBulk("delete")}
                disabled={bulkLoading}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-red-50 text-red-700 rounded-lg hover:bg-red-100 disabled:opacity-50"
              >
                <Trash2 className="w-3.5 h-3.5" /> Delete
              </button>
              <button
                onClick={() => setSelectedIds(new Set())}
                className="px-3 py-1.5 text-xs font-medium text-gray-500 hover:text-gray-700"
              >
                Clear
              </button>
            </div>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100">
            <p className="text-sm text-gray-500">
              Page {page} of {totalPages}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-2 text-gray-400 hover:text-gray-600 disabled:opacity-50 rounded-lg hover:bg-gray-100"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="p-2 text-gray-400 hover:text-gray-600 disabled:opacity-50 rounded-lg hover:bg-gray-100"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/55 z-[400] flex items-center justify-center p-4 backdrop-blur-[2px]">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl h-[80vh] flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 flex-shrink-0">
              <div>
                <h3 className="text-lg font-bold text-gray-900">
                  {editingId ? "Edit Product" : "Add New Product"}
                </h3>
                <p className="text-xs text-gray-505 mt-0.5">
                  Provide detailed information to list your wellness product on PleasureZone.
                </p>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content - Two Columns */}
            <div className="flex flex-1 overflow-hidden">
              {/* Left Sidebar navigation */}
              <div className="w-1/4 border-r border-gray-150 p-4 bg-gray-50/30 flex flex-col gap-1 select-none overflow-y-auto">
                {[
                  { id: "general", label: "General Info", icon: Package },
                  { id: "media", label: "Media Gallery", icon: ImageIcon },
                  { id: "pricing", label: "Pricing & Stock", icon: Wallet },
                  { id: "specifications", label: "Specifications", icon: Layers },
                  { id: "variants", label: "Product Variants", icon: PlusCircle },
                  { id: "delivery", label: "Shipping & Pickup", icon: Truck },
                  { id: "seo", label: "SEO Metadata", icon: Search },
                ].map((tab) => {
                  const Icon = tab.icon;
                  const isActive = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setActiveTab(tab.id)}
                      className={`flex items-center gap-2.5 px-3 py-2.5 text-xs font-bold rounded-xl transition-all text-left ${
                        isActive
                          ? "bg-primary text-white shadow-sm shadow-primary/20"
                          : "text-gray-600 hover:text-gray-900 hover:bg-gray-100/70"
                      }`}
                    >
                      <Icon className={`w-4 h-4 ${isActive ? "text-white" : "text-gray-450"}`} />
                      {tab.label}
                    </button>
                  );
                })}
              </div>

              {/* Right Panel form body */}
              <div className="w-3/4 p-6 overflow-y-auto space-y-5">
                {formError && (
                  <div className="p-3 bg-red-50 border border-red-100 rounded-lg text-red-600 text-sm">
                    {formError}
                  </div>
                )}

                {activeTab === "general" && (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1">Product Name *</label>
                      <input
                        type="text"
                        value={form.name}
                        onChange={(e) => setForm({ ...form, name: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                        placeholder="e.g. Premium Silk Blindfold"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1">Description</label>
                      <textarea
                        value={form.description}
                        onChange={(e) => setForm({ ...form, description: e.target.value })}
                        rows={6}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none"
                        placeholder="Describe the product details, benefits, materials, and discrete packaging options..."
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1">Category</label>
                      <select
                        value={form.categoryId}
                        onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white"
                      >
                        <option value="">Select category</option>
                        {categories.map((cat) => (
                          <option key={cat.id} value={cat.id}>
                            {cat.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1">
                        Tags (comma-separated)
                      </label>
                      <input
                        type="text"
                        value={form.tags}
                        onChange={(e) => setForm({ ...form, tags: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                        placeholder="tag1, tag2, tag3"
                      />
                    </div>
                  </div>
                )}

                {activeTab === "media" && (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Product Gallery
                      </label>
                      
                      {/* Image previews */}
                      {form.imageUrls.length > 0 && (
                        <div className="grid grid-cols-4 gap-3 mb-4">
                          {form.imageUrls.map((url, i) => (
                            <div key={i} className="relative group w-full aspect-square bg-gray-50 border border-gray-200 rounded-lg overflow-hidden">
                              <img
                                src={url.startsWith("/") ? `${process.env.NEXT_PUBLIC_API_URL || ""}${url}` : url}
                                alt={`Image ${i + 1}`}
                                className="w-full h-full object-cover"
                              />
                              <button
                                type="button"
                                onClick={() => removeImage(i)}
                                className="absolute top-1.5 right-1.5 w-6 h-6 bg-red-600 text-white rounded-full flex items-center justify-center shadow hover:bg-red-750 transition-colors"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Upload area */}
                      <label
                        className={`flex flex-col items-center justify-center w-full h-40 border-2 border-dashed rounded-xl cursor-pointer transition-colors ${
                          uploading
                            ? "border-primary/40 bg-primary/5"
                            : "border-gray-300 hover:border-primary/60 hover:bg-gray-50"
                        }`}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => {
                          e.preventDefault();
                          handleImageUpload(e.dataTransfer.files);
                        }}
                      >
                        <input
                          type="file"
                          multiple
                          accept="image/jpeg,image/png,image/gif,image/webp"
                          className="hidden"
                          onChange={(e) => handleImageUpload(e.target.files)}
                          disabled={uploading}
                        />
                        {uploading ? (
                          <div className="flex items-center gap-2 text-primary">
                            <Loader2 className="w-6 h-6 animate-spin" />
                            <span className="text-sm font-medium">Uploading images...</span>
                          </div>
                        ) : (
                          <div className="flex flex-col items-center gap-1 text-gray-500">
                            <Upload className="w-8 h-8 mb-1" />
                            <span className="text-sm font-medium">Click or drag images here</span>
                            <span className="text-xs text-gray-400">Supports JPG, PNG, GIF, WebP (max 10MB each)</span>
                          </div>
                        )}
                      </label>
                    </div>
                  </div>
                )}

                {activeTab === "pricing" && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1">Price (UGX) *</label>
                        <input
                          type="number"
                          value={form.price}
                          onChange={(e) => setForm({ ...form, price: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                          placeholder="0"
                          min="0"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1">
                          Compare Price (UGX)
                        </label>
                        <input
                          type="number"
                          value={form.comparePrice}
                          onChange={(e) => setForm({ ...form, comparePrice: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                          placeholder="0"
                          min="0"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1">Stock Level</label>
                        <input
                          type="number"
                          value={form.stock}
                          onChange={(e) => setForm({ ...form, stock: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                          placeholder="0"
                          min="0"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1">Low Stock Alert Threshold</label>
                        <input
                          type="number"
                          value={form.lowStockAlert}
                          onChange={(e) => setForm({ ...form, lowStockAlert: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                          placeholder="5"
                          min="0"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1">SKU</label>
                        <input
                          type="text"
                          value={form.sku}
                          onChange={(e) => setForm({ ...form, sku: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                          placeholder="SKU-001"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1">Weight (grams)</label>
                        <input
                          type="number"
                          value={form.weight}
                          onChange={(e) => setForm({ ...form, weight: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                          placeholder="0"
                          min="0"
                        />
                      </div>
                    </div>

                    <div className="flex items-center gap-6 pt-2">
                      <label className="flex items-center gap-2.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={form.trackInventory}
                          onChange={(e) => setForm({ ...form, trackInventory: e.target.checked })}
                          className="rounded border-gray-300 text-primary focus:ring-primary"
                        />
                        <span className="text-sm font-medium text-gray-700">Track Inventory</span>
                      </label>
                      <label className="flex items-center gap-2.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={form.allowBackorder}
                          onChange={(e) => setForm({ ...form, allowBackorder: e.target.checked })}
                          className="rounded border-gray-300 text-primary focus:ring-primary"
                        />
                        <span className="text-sm font-medium text-gray-700">Allow Backorder Sales</span>
                      </label>
                    </div>
                  </div>
                )}

                {activeTab === "specifications" && (
                  <div className="space-y-4">
                    <div className="flex justify-between items-center mb-1">
                      <label className="block text-sm font-semibold text-gray-700">Specifications & Attributes</label>
                      <button
                        type="button"
                        onClick={() => setForm({ ...form, specifications: [...form.specifications, { key: "", value: "" }] })}
                        className="text-xs bg-primary/10 text-primary hover:bg-primary/15 font-bold px-2.5 py-1.5 rounded-lg transition-colors"
                      >
                        + Add Attribute
                      </button>
                    </div>
                    
                    <p className="text-xs text-gray-500">Add custom details such as materials, size chart information, dimensions, or origin details.</p>

                    <div className="space-y-2">
                      {form.specifications.map((spec, i) => (
                        <div key={i} className="flex gap-2 items-center">
                          <input
                            type="text"
                            value={spec.key}
                            onChange={(e) => {
                              const specs = [...form.specifications];
                              specs[i] = { ...specs[i], key: e.target.value };
                              setForm({ ...form, specifications: specs });
                            }}
                            className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                            placeholder="Key (e.g. Material)"
                          />
                          <input
                            type="text"
                            value={spec.value}
                            onChange={(e) => {
                              const specs = [...form.specifications];
                              specs[i] = { ...specs[i], value: e.target.value };
                              setForm({ ...form, specifications: specs });
                            }}
                            className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                            placeholder="Value"
                          />
                          <button
                            type="button"
                            onClick={() => setForm({ ...form, specifications: form.specifications.filter((_, j) => j !== i) })}
                            className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                      {form.specifications.length === 0 && (
                        <div className="text-center py-6 border border-dashed border-gray-200 rounded-xl text-gray-400 text-xs">
                          No specifications added yet. Click "+ Add Attribute" to list options.
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {activeTab === "variants" && (
                  <div className="space-y-4">
                    <label className="flex items-center gap-2.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={form.hasVariants}
                        onChange={(e) => setForm({ ...form, hasVariants: e.target.checked })}
                        className="rounded border-gray-300 text-primary focus:ring-primary"
                      />
                      <span className="text-sm font-semibold text-gray-700">This product has variants (e.g. Size, Color)</span>
                    </label>

                    {form.hasVariants && (
                      <div className="space-y-4 pt-2 border-t border-gray-50">
                        <div className="space-y-2">
                          <p className="text-xs font-bold text-gray-500 uppercase">Option Types</p>
                          <div className="flex gap-2 flex-wrap">
                            {["Size", "Color", "Material"].map((opt) => (
                              <button
                                key={opt}
                                type="button"
                                onClick={() => {
                                  const types = form.variantOptionTypes.includes(opt)
                                    ? form.variantOptionTypes.filter((t) => t !== opt)
                                    : [...form.variantOptionTypes, opt];
                                  setForm({ ...form, variantOptionTypes: types });
                                }}
                                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                                  form.variantOptionTypes.includes(opt)
                                    ? "bg-primary text-white border-primary"
                                    : "bg-white text-gray-600 border-gray-200 hover:border-primary"
                                }`}
                              >
                                {opt}
                              </button>
                            ))}
                          </div>
                        </div>

                        {form.variantOptionTypes.map((opt) => (
                          <div key={opt}>
                            <label className="block text-xs font-bold text-gray-600 mb-1">{opt} Values (comma-separated)</label>
                            <input
                              type="text"
                              value={(form.variantOptionValues[opt] || []).join(", ")}
                              onChange={(e) => setForm({
                                ...form,
                                variantOptionValues: {
                                  ...form.variantOptionValues,
                                  [opt]: e.target.value.split(",").map((v) => v.trim()).filter(Boolean),
                                },
                              })}
                              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                              placeholder={opt === "Size" ? "S, M, L, XL" : opt === "Color" ? "Red, Blue, Black" : "Cotton, Silk"}
                            />
                          </div>
                        ))}

                        {form.variantOptionTypes.length > 0 && (
                          <button
                            type="button"
                            onClick={generateVariants}
                            className="w-full py-2 bg-gray-50 border border-gray-200 hover:bg-gray-100 rounded-xl text-xs font-bold text-gray-700 transition-colors"
                          >
                            Generate Variant Matrix
                          </button>
                        )}

                        {form.variants.length > 0 && (
                          <div className="overflow-x-auto border border-gray-100 rounded-xl">
                            <table className="w-full text-sm">
                              <thead className="bg-gray-50 border-b border-gray-100">
                                <tr>
                                  <th className="text-left py-2 px-3 text-xs font-bold text-gray-500">Variant</th>
                                  <th className="text-left py-2 px-3 text-xs font-bold text-gray-500">SKU</th>
                                  <th className="text-left py-2 px-3 text-xs font-bold text-gray-500">Price (UGX)</th>
                                  <th className="text-left py-2 px-3 text-xs font-bold text-gray-500">Stock</th>
                                  <th className="py-2 px-3 w-8"></th>
                                </tr>
                              </thead>
                              <tbody>
                                {form.variants.map((v, i) => (
                                  <tr key={i} className="border-b border-gray-50 hover:bg-gray-50/50">
                                    <td className="py-2 px-3 text-gray-900 text-xs font-semibold">{v.name}</td>
                                    <td className="py-2 px-3">
                                      <input
                                        type="text"
                                        value={v.sku}
                                        onChange={(e) => {
                                          const variants = [...form.variants];
                                          variants[i] = { ...v, sku: e.target.value };
                                          setForm({ ...form, variants });
                                        }}
                                        className="w-full max-w-[100px] px-2.5 py-1 border border-gray-200 rounded-lg text-xs"
                                        placeholder="SKU"
                                      />
                                    </td>
                                    <td className="py-2 px-3">
                                      <input
                                        type="number"
                                        value={v.price}
                                        onChange={(e) => {
                                          const variants = [...form.variants];
                                          variants[i] = { ...v, price: e.target.value };
                                          setForm({ ...form, variants });
                                        }}
                                        className="w-full max-w-[100px] px-2.5 py-1 border border-gray-200 rounded-lg text-xs"
                                        placeholder="Override"
                                      />
                                    </td>
                                    <td className="py-2 px-3">
                                      <input
                                        type="number"
                                        value={v.stock}
                                        onChange={(e) => {
                                          const variants = [...form.variants];
                                          variants[i] = { ...v, stock: e.target.value };
                                          setForm({ ...form, variants });
                                        }}
                                        className="w-full max-w-[80px] px-2.5 py-1 border border-gray-200 rounded-lg text-xs"
                                        placeholder="0"
                                      />
                                    </td>
                                    <td className="py-2 px-3 text-center">
                                      <button
                                        type="button"
                                        onClick={() => setForm({ ...form, variants: form.variants.filter((_, j) => j !== i) })}
                                        className="text-gray-400 hover:text-red-500 transition-colors"
                                      >
                                        <X className="w-3.5 h-3.5" />
                                      </button>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {activeTab === "delivery" && (
                  <div className="space-y-4">
                    <label className="block text-sm font-semibold text-gray-700">Fulfillment Methods</label>
                    <p className="text-xs text-gray-500">Select which delivery methods are allowed for this product. If none are selected, all defaults will apply.</p>
                    
                    <div className="space-y-2 bg-gray-55/50 border border-gray-100 p-3 rounded-xl">
                      {[
                        { value: "HOME_DELIVERY", label: "Home Delivery (Kampala Couriers)" },
                        { value: "PICKUP", label: "Platform Pickup Point (Discreet lockers)" },
                        { value: "SELLER_PICKUP", label: "Seller Pickup (Collect directly from your location)" },
                      ].map((method) => (
                        <label key={method.value} className="flex items-center gap-2.5 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={form.allowedDeliveryMethods.includes(method.value)}
                            onChange={(e) => {
                              const methods = e.target.checked
                                ? [...form.allowedDeliveryMethods, method.value]
                                : form.allowedDeliveryMethods.filter((m) => m !== method.value);
                              setForm({ ...form, allowedDeliveryMethods: methods });
                            }}
                            className="rounded border-gray-300 text-primary focus:ring-primary"
                          />
                          <span className="text-sm font-medium text-gray-700">{method.label}</span>
                        </label>
                      ))}
                      {form.allowedDeliveryMethods.length === 0 ? (
                        <p className="text-xs text-green-600 mt-2 bg-green-50 p-2.5 rounded border border-green-200">
                          💡 Currently, <strong>all delivery methods are allowed</strong> for this product because none are explicitly checked.
                        </p>
                      ) : (
                        <p className="text-xs text-amber-600 mt-2 bg-amber-50 p-2.5 rounded border border-amber-200">
                          ⚠️ Only the checked delivery method(s) will be available for this product at checkout. All other methods are restricted.
                        </p>
                      )}
                    </div>

                    <div className="pt-2">
                      <label className="flex items-center gap-2.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={form.codAllowed}
                          onChange={(e) => setForm({ ...form, codAllowed: e.target.checked })}
                          className="rounded border-gray-300 text-primary focus:ring-primary"
                        />
                        <span className="text-sm font-semibold text-gray-700">Allow Cash on Delivery (COD)</span>
                      </label>
                    </div>

                    <div className="pt-2">
                      <label className="block text-sm font-semibold text-gray-700 mb-1">Platform Shipping Fee override (UGX)</label>
                      <input
                        type="number"
                        value={form.shippingFee}
                        onChange={(e) => setForm({ ...form, shippingFee: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                        placeholder="0"
                        min="0"
                      />
                      <p className="text-xs text-gray-500 mt-1">This fee will be deducted from your payout per order of this item (optional).</p>
                    </div>
                  </div>
                )}

                {activeTab === "seo" && (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1">Meta Title</label>
                      <input
                        type="text"
                        value={form.metaTitle}
                        onChange={(e) => setForm({ ...form, metaTitle: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                        placeholder="SEO page title"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1">Meta Description</label>
                      <textarea
                        value={form.metaDescription}
                        onChange={(e) => setForm({ ...form, metaDescription: e.target.value })}
                        rows={4}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none"
                        placeholder="SEO description showing up in Google Search results..."
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100 bg-gray-50 flex-shrink-0">
              <span className="text-xs text-gray-400">
                Fields marked with * are required.
              </span>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-sm font-bold text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-xl transition-all"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving}
                  className="px-5 py-2 bg-primary text-white rounded-xl text-sm font-bold hover:bg-primary/95 disabled:opacity-50 transition-all shadow-sm shadow-primary/15"
                >
                  {saving ? "Saving..." : editingId ? "Update Product" : "Create Product"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Import CSV Modal */}
      {showImportModal && (
        <div className="fixed inset-0 bg-black/50 z-[400] flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <h3 className="text-lg font-semibold text-gray-900">Import Products from CSV</h3>
              <button onClick={() => setShowImportModal(false)} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <a
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  const tmpl = "name,description,price,comparePrice,stock,sku,categoryId,tags\nExample Product,A great product,25000,,100,SKU-001,,tag1|tag2";
                  const blob = new Blob([tmpl], { type: "text/csv" });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = "product-import-template.csv";
                  a.click();
                  URL.revokeObjectURL(url);
                }}
                className="text-sm text-primary hover:underline"
              >
                Download CSV Template
              </a>
              <label
                className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer hover:border-primary/60 hover:bg-gray-50 transition-colors"
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => { e.preventDefault(); if (e.dataTransfer.files[0]) handleImportFile(e.dataTransfer.files[0]); }}
              >
                <input type="file" accept=".csv" className="hidden" onChange={(e) => { if (e.target.files?.[0]) handleImportFile(e.target.files[0]); }} />
                <FileUp className="w-8 h-8 text-gray-400 mb-2" />
                <span className="text-sm text-gray-500">{importFile ? importFile.name : "Click or drag CSV file here"}</span>
              </label>
              {importPreview.length > 0 && (
                <div className="overflow-x-auto">
                  <p className="text-xs font-medium text-gray-500 mb-2">Preview (first 5 rows):</p>
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b">
                        {importPreview[0]?.map((h, i) => (
                          <th key={i} className="text-left py-1 px-2 font-medium text-gray-500">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {importPreview.slice(1, 6).map((row, i) => (
                        <tr key={i} className="border-b border-gray-50">
                          {row.map((cell, j) => (
                            <td key={j} className="py-1 px-2 text-gray-700 truncate max-w-[120px]">{cell}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {importResult && (
                <div className={`p-3 rounded-lg text-sm ${importResult.includes("failed") || importResult.includes("error") ? "bg-red-50 text-red-600" : "bg-green-50 text-green-600"}`}>
                  {importResult}
                </div>
              )}
            </div>
            <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-100">
              <button onClick={() => setShowImportModal(false)} className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors">
                Close
              </button>
              <button
                onClick={handleImport}
                disabled={!importFile || importing}
                className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
              >
                {importing ? "Importing..." : "Import Products"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
