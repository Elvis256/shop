"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { api } from "@/lib/api";
import {
  Plus,
  Search,
  Filter,
  MoreHorizontal,
  Edit,
  Trash2,
  Eye,
  Star,
  Archive,
  Package,
  TrendingUp,
  AlertTriangle,
  RefreshCw,
  Download,
  ChevronLeft,
  ChevronRight,
  Grid3X3,
  List,
  Copy,
  Check,
  X,
  MoreVertical,
  Sparkles,
  DollarSign,
  BarChart3,
} from "lucide-react";

interface Product {
  id: string;
  name: string;
  slug: string;
  sku?: string | null;
  price: number;
  compareAtPrice?: number;
  stock: number;
  status?: string;
  featured?: boolean;
  category?: string | null;
  imageUrl?: string | null;
  sales?: number;
  createdAt?: string;
}

type ViewMode = "table" | "grid";
type SortField = "name" | "price" | "stock" | "sales" | "createdAt";
type SortDirection = "asc" | "desc";

export default function AdminProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [pagination, setPagination] = useState({ total: 0, page: 1, totalPages: 1, limit: 20 });
  const [viewMode, setViewMode] = useState<ViewMode>("table");
  const [sortField, setSortField] = useState<SortField>("createdAt");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [actionMenuOpen, setActionMenuOpen] = useState<string | null>(null);
  const [stats, setStats] = useState({ total: 0, active: 0, lowStock: 0, outOfStock: 0 });

  const loadProducts = async (params: Record<string, string> = {}) => {
    setLoading(true);
    try {
      const data = await api.admin.getProducts({ 
        search, 
        status: statusFilter, 
        category: categoryFilter,
        sort: sortField,
        order: sortDirection,
        ...params 
      });
      setProducts(data.products || []);
      setPagination(data.pagination || { total: 0, page: 1, totalPages: 1, limit: 20 });
      
      // Calculate stats
      const allProducts = data.products || [];
      setStats({
        total: data.pagination?.total || allProducts.length,
        active: allProducts.filter((p: Product) => p.status === "ACTIVE").length,
        lowStock: allProducts.filter((p: Product) => p.stock > 0 && p.stock <= 10).length,
        outOfStock: allProducts.filter((p: Product) => p.stock === 0).length,
      });
    } catch (error) {
      console.error("Failed to load products:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProducts();
  }, [search, statusFilter, categoryFilter, sortField, sortDirection]);

  // Close action menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (actionMenuOpen && !(e.target as Element).closest('.action-menu-container')) {
        setActionMenuOpen(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [actionMenuOpen]);

  const handleBulkAction = async (action: string) => {
    if (selectedIds.length === 0) return;
    if (action === "delete" && !confirm(`Delete ${selectedIds.length} products? This cannot be undone.`)) return;

    try {
      await api.admin.bulkProductAction(action, selectedIds);
      setSelectedIds([]);
      loadProducts();
    } catch (error) {
      console.error("Bulk action failed:", error);
      alert("Failed to perform action");
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await api.admin.deleteProduct(id);
      setShowDeleteConfirm(null);
      loadProducts();
    } catch (error) {
      console.error("Delete failed:", error);
      alert("Failed to delete product");
    }
  };

  const handleQuickStatusChange = async (id: string, newStatus: string) => {
    try {
      await api.admin.updateProduct(id, { status: newStatus } as any);
      loadProducts();
      setActionMenuOpen(null);
    } catch (error) {
      console.error("Status update failed:", error);
    }
  };

  const handleToggleFeatured = async (id: string, currentFeatured: boolean) => {
    try {
      await api.admin.updateProduct(id, { featured: !currentFeatured } as any);
      loadProducts();
      setActionMenuOpen(null);
    } catch (error) {
      console.error("Featured update failed:", error);
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === products.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(products.map((p) => p.id));
    }
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const exportProducts = () => {
    const csvRows = [
      ["Name", "SKU", "Price", "Stock", "Status", "Category", "Featured", "Sales"].join(","),
      ...products.map(p => [
        `"${p.name}"`,
        p.sku || "",
        p.price,
        p.stock,
        p.status,
        p.category || "",
        p.featured ? "Yes" : "No",
        p.sales
      ].join(","))
    ];
    
    const blob = new Blob([csvRows.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `products-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "ACTIVE": return "bg-emerald-100 text-emerald-700 border-emerald-200";
      case "DRAFT": return "bg-amber-100 text-amber-700 border-amber-200";
      case "ARCHIVED": return "bg-gray-100 text-gray-600 border-gray-200";
      default: return "bg-gray-100 text-gray-600 border-gray-200";
    }
  };

  const getStockBadge = (stock: number) => {
    if (stock === 0) return "bg-red-100 text-red-700";
    if (stock <= 10) return "bg-amber-100 text-amber-700";
    return "text-gray-900";
  };

  const formatCurrency = (amount: number) => `UGX ${Number(amount).toLocaleString()}`;

  // Get unique categories from products
  const categories = [...new Set(products.map(p => p.category).filter((c): c is string => !!c))];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">Products</h1>
          <p className="text-gray-500 mt-1">Manage your product catalog</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => loadProducts()}
            className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            title="Refresh"
          >
            <RefreshCw className="w-5 h-5" />
          </button>
          <button
            onClick={exportProducts}
            className="flex items-center gap-2 px-4 py-2 text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <Download className="w-4 h-4" />
            Export
          </button>
          <Link 
            href="/admin/products/new" 
            className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
          >
            <Plus className="w-5 h-5" />
            Add Product
          </Link>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Package className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
              <p className="text-sm text-gray-500">Total Products</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-100 rounded-lg">
              <Check className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{stats.active}</p>
              <p className="text-sm text-gray-500">Active</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-100 rounded-lg">
              <AlertTriangle className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{stats.lowStock}</p>
              <p className="text-sm text-gray-500">Low Stock</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-100 rounded-lg">
              <X className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{stats.outOfStock}</p>
              <p className="text-sm text-gray-500">Out of Stock</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters & View Toggle */}
      <div className="bg-white rounded-xl border p-4">
        <div className="flex flex-col lg:flex-row gap-4">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              placeholder="Search products by name, SKU..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          
          {/* Filters */}
          <div className="flex flex-wrap items-center gap-3">
            <select
              className="px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 bg-white"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="">All Status</option>
              <option value="ACTIVE">Active</option>
              <option value="DRAFT">Draft</option>
              <option value="ARCHIVED">Archived</option>
            </select>

            <select
              className="px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 bg-white"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
            >
              <option value="">All Categories</option>
              {categories.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>

            {/* View Mode Toggle */}
            <div className="flex items-center bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => setViewMode("table")}
                className={`p-2 rounded-md transition-colors ${
                  viewMode === "table" ? "bg-white shadow text-gray-900" : "text-gray-500 hover:text-gray-700"
                }`}
              >
                <List className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode("grid")}
                className={`p-2 rounded-md transition-colors ${
                  viewMode === "grid" ? "bg-white shadow text-gray-900" : "text-gray-500 hover:text-gray-700"
                }`}
              >
                <Grid3X3 className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Bulk Actions */}
        {selectedIds.length > 0 && (
          <div className="mt-4 pt-4 border-t flex flex-wrap items-center gap-3">
            <span className="text-sm font-medium text-gray-700 bg-gray-100 px-3 py-1 rounded-full">
              {selectedIds.length} selected
            </span>
            <button
              onClick={() => handleBulkAction("activate")}
              className="px-3 py-1.5 text-sm font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-colors"
            >
              Activate
            </button>
            <button
              onClick={() => handleBulkAction("archive")}
              className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
            >
              Archive
            </button>
            <button
              onClick={() => handleBulkAction("feature")}
              className="px-3 py-1.5 text-sm font-medium text-amber-700 bg-amber-50 hover:bg-amber-100 rounded-lg transition-colors"
            >
              <Star className="w-4 h-4 inline mr-1" />
              Feature
            </button>
            <button
              onClick={() => handleBulkAction("delete")}
              className="px-3 py-1.5 text-sm font-medium text-red-700 bg-red-50 hover:bg-red-100 rounded-lg transition-colors"
            >
              <Trash2 className="w-4 h-4 inline mr-1" />
              Delete
            </button>
            <button
              onClick={() => setSelectedIds([])}
              className="px-3 py-1.5 text-sm text-gray-500 hover:text-gray-700"
            >
              Clear
            </button>
          </div>
        )}
      </div>

      {/* Products Display */}
      {viewMode === "table" ? (
        /* Table View */
        <div className="bg-white rounded-xl border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="p-4 text-left w-12">
                    <input
                      type="checkbox"
                      checked={selectedIds.length === products.length && products.length > 0}
                      onChange={toggleSelectAll}
                      className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary"
                    />
                  </th>
                  <th 
                    className="p-4 text-left text-sm font-semibold text-gray-600 cursor-pointer hover:text-gray-900"
                    onClick={() => handleSort("name")}
                  >
                    <div className="flex items-center gap-1">
                      Product
                      {sortField === "name" && (
                        <span className="text-primary">{sortDirection === "asc" ? "↑" : "↓"}</span>
                      )}
                    </div>
                  </th>
                  <th className="p-4 text-left text-sm font-semibold text-gray-600">SKU</th>
                  <th 
                    className="p-4 text-left text-sm font-semibold text-gray-600 cursor-pointer hover:text-gray-900"
                    onClick={() => handleSort("price")}
                  >
                    <div className="flex items-center gap-1">
                      Price
                      {sortField === "price" && (
                        <span className="text-primary">{sortDirection === "asc" ? "↑" : "↓"}</span>
                      )}
                    </div>
                  </th>
                  <th 
                    className="p-4 text-left text-sm font-semibold text-gray-600 cursor-pointer hover:text-gray-900"
                    onClick={() => handleSort("stock")}
                  >
                    <div className="flex items-center gap-1">
                      Stock
                      {sortField === "stock" && (
                        <span className="text-primary">{sortDirection === "asc" ? "↑" : "↓"}</span>
                      )}
                    </div>
                  </th>
                  <th className="p-4 text-left text-sm font-semibold text-gray-600">Status</th>
                  <th 
                    className="p-4 text-left text-sm font-semibold text-gray-600 cursor-pointer hover:text-gray-900"
                    onClick={() => handleSort("sales")}
                  >
                    <div className="flex items-center gap-1">
                      Sales
                      {sortField === "sales" && (
                        <span className="text-primary">{sortDirection === "asc" ? "↑" : "↓"}</span>
                      )}
                    </div>
                  </th>
                  <th className="p-4 text-right text-sm font-semibold text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i}>
                      <td colSpan={8} className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 bg-gray-200 rounded animate-pulse" />
                          <div className="flex-1">
                            <div className="h-4 w-48 bg-gray-200 rounded animate-pulse mb-2" />
                            <div className="h-3 w-24 bg-gray-200 rounded animate-pulse" />
                          </div>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : products.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-12 text-center">
                      <Package className="w-12 h-12 mx-auto text-gray-300 mb-3" />
                      <p className="text-gray-500 font-medium">No products found</p>
                      <p className="text-gray-400 text-sm mt-1">Try adjusting your filters or add a new product</p>
                      <Link
                        href="/admin/products/new"
                        className="inline-flex items-center gap-2 mt-4 px-4 py-2 text-sm bg-primary text-white rounded-lg hover:bg-primary/90"
                      >
                        <Plus className="w-4 h-4" />
                        Add Product
                      </Link>
                    </td>
                  </tr>
                ) : (
                  products.map((product) => (
                    <tr key={product.id} className="hover:bg-gray-50 group">
                      <td className="p-4">
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(product.id)}
                          onChange={() => toggleSelect(product.id)}
                          className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary"
                        />
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 bg-gray-100 rounded-lg flex-shrink-0 overflow-hidden">
                            {product.imageUrl ? (
                              <img
                                src={product.imageUrl}
                                alt=""
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <Package className="w-5 h-5 text-gray-400" />
                              </div>
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium text-gray-900 truncate flex items-center gap-2">
                              {product.name}
                              {product.featured && (
                                <Star className="w-4 h-4 text-amber-500 fill-amber-500 flex-shrink-0" />
                              )}
                            </p>
                            <p className="text-sm text-gray-500 truncate">{product.category || "Uncategorized"}</p>
                          </div>
                        </div>
                      </td>
                      <td className="p-4">
                        <span className="text-sm text-gray-500 font-mono">{product.sku || "—"}</span>
                      </td>
                      <td className="p-4">
                        <div>
                          <span className="font-semibold text-gray-900">{formatCurrency(product.price)}</span>
                          {product.compareAtPrice && product.compareAtPrice > product.price && (
                            <span className="text-xs text-gray-400 line-through ml-2">
                              {formatCurrency(product.compareAtPrice)}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="p-4">
                        <span className={`font-medium ${getStockBadge(product.stock)}`}>
                          {product.stock === 0 ? (
                            <span className="flex items-center gap-1">
                              <X className="w-3 h-3" /> Out
                            </span>
                          ) : (
                            product.stock
                          )}
                        </span>
                      </td>
                      <td className="p-4">
                        <span className={`text-xs font-medium px-2.5 py-1 rounded-full border ${getStatusBadge(product.status || "ACTIVE")}`}>
                          {product.status || "ACTIVE"}
                        </span>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <BarChart3 className="w-4 h-4 text-gray-400" />
                          <span className="text-sm font-medium text-gray-700">{product.sales || 0}</span>
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center justify-end gap-1">
                          <Link
                            href={`/product/${product.slug}`}
                            className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            target="_blank"
                            title="View product"
                          >
                            <Eye className="w-4 h-4" />
                          </Link>
                          <Link
                            href={`/admin/products/${product.id}`}
                            className="p-2 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                            title="Edit product"
                          >
                            <Edit className="w-4 h-4" />
                          </Link>
                          <div className="relative action-menu-container">
                            <button
                              onClick={() => setActionMenuOpen(actionMenuOpen === product.id ? null : product.id)}
                              className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                              title="More actions"
                            >
                              <MoreVertical className="w-4 h-4" />
                            </button>
                            {actionMenuOpen === product.id && (
                              <div className="absolute right-0 top-full mt-1 w-48 bg-white rounded-lg shadow-lg border py-1 z-10">
                                <button
                                  onClick={() => handleToggleFeatured(product.id, product.featured || false)}
                                  className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2"
                                >
                                  <Star className={`w-4 h-4 ${product.featured ? "text-amber-500 fill-amber-500" : ""}`} />
                                  {product.featured ? "Remove Featured" : "Mark as Featured"}
                                </button>
                                {(product.status || "ACTIVE") !== "ACTIVE" && (
                                  <button
                                    onClick={() => handleQuickStatusChange(product.id, "ACTIVE")}
                                    className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2"
                                  >
                                    <Check className="w-4 h-4 text-emerald-500" />
                                    Set as Active
                                  </button>
                                )}
                                {product.status !== "DRAFT" && (
                                  <button
                                    onClick={() => handleQuickStatusChange(product.id, "DRAFT")}
                                    className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2"
                                  >
                                    <Edit className="w-4 h-4 text-amber-500" />
                                    Set as Draft
                                  </button>
                                )}
                                {product.status !== "ARCHIVED" && (
                                  <button
                                    onClick={() => handleQuickStatusChange(product.id, "ARCHIVED")}
                                    className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2"
                                  >
                                    <Archive className="w-4 h-4 text-gray-500" />
                                    Archive
                                  </button>
                                )}
                                <hr className="my-1" />
                                <button
                                  onClick={() => {
                                    setShowDeleteConfirm(product.id);
                                    setActionMenuOpen(null);
                                  }}
                                  className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                                >
                                  <Trash2 className="w-4 h-4" />
                                  Delete Product
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div className="flex items-center justify-between p-4 border-t bg-gray-50">
              <p className="text-sm text-gray-600">
                Showing {((pagination.page - 1) * pagination.limit) + 1} to {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} products
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => loadProducts({ page: String(pagination.page - 1) })}
                  disabled={pagination.page === 1}
                  className="p-2 border rounded-lg hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="px-3 py-1 text-sm font-medium">
                  {pagination.page} / {pagination.totalPages}
                </span>
                <button
                  onClick={() => loadProducts({ page: String(pagination.page + 1) })}
                  disabled={pagination.page === pagination.totalPages}
                  className="p-2 border rounded-lg hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* Grid View */
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {loading ? (
            Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="bg-white rounded-xl border overflow-hidden animate-pulse">
                <div className="aspect-square bg-gray-200" />
                <div className="p-4">
                  <div className="h-4 bg-gray-200 rounded mb-2" />
                  <div className="h-3 bg-gray-200 rounded w-2/3" />
                </div>
              </div>
            ))
          ) : products.length === 0 ? (
            <div className="col-span-full bg-white rounded-xl border p-12 text-center">
              <Package className="w-12 h-12 mx-auto text-gray-300 mb-3" />
              <p className="text-gray-500 font-medium">No products found</p>
              <Link
                href="/admin/products/new"
                className="inline-flex items-center gap-2 mt-4 px-4 py-2 text-sm bg-primary text-white rounded-lg hover:bg-primary/90"
              >
                <Plus className="w-4 h-4" />
                Add Product
              </Link>
            </div>
          ) : (
            products.map((product) => (
              <div 
                key={product.id} 
                className={`bg-white rounded-xl border overflow-hidden group hover:shadow-lg transition-shadow ${
                  selectedIds.includes(product.id) ? "ring-2 ring-primary" : ""
                }`}
              >
                {/* Image */}
                <div className="aspect-square bg-gray-100 relative">
                  {product.imageUrl ? (
                    <img
                      src={product.imageUrl}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Package className="w-12 h-12 text-gray-300" />
                    </div>
                  )}
                  
                  {/* Selection checkbox */}
                  <div className="absolute top-2 left-2">
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(product.id)}
                      onChange={() => toggleSelect(product.id)}
                      className="w-5 h-5 rounded border-gray-300 text-primary focus:ring-primary bg-white"
                    />
                  </div>
                  
                  {/* Featured badge */}
                  {product.featured && (
                    <div className="absolute top-2 right-2 p-1.5 bg-amber-500 rounded-full">
                      <Star className="w-3 h-3 text-white fill-white" />
                    </div>
                  )}
                  
                  {/* Stock badge */}
                  {product.stock === 0 && (
                    <div className="absolute bottom-2 left-2 px-2 py-1 bg-red-500 text-white text-xs font-medium rounded">
                      Out of Stock
                    </div>
                  )}
                  {product.stock > 0 && product.stock <= 10 && (
                    <div className="absolute bottom-2 left-2 px-2 py-1 bg-amber-500 text-white text-xs font-medium rounded">
                      Low Stock: {product.stock}
                    </div>
                  )}
                  
                  {/* Quick actions overlay */}
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                    <Link
                      href={`/product/${product.slug}`}
                      target="_blank"
                      className="p-2 bg-white rounded-lg hover:bg-gray-100 transition-colors"
                      title="View"
                    >
                      <Eye className="w-4 h-4" />
                    </Link>
                    <Link
                      href={`/admin/products/${product.id}`}
                      className="p-2 bg-white rounded-lg hover:bg-gray-100 transition-colors"
                      title="Edit"
                    >
                      <Edit className="w-4 h-4" />
                    </Link>
                    <button
                      onClick={() => setShowDeleteConfirm(product.id)}
                      className="p-2 bg-white rounded-lg hover:bg-red-50 text-red-600 transition-colors"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                
                {/* Info */}
                <div className="p-4">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <h3 className="font-medium text-gray-900 truncate flex-1">{product.name}</h3>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${getStatusBadge(product.status || "ACTIVE")}`}>
                      {product.status || "ACTIVE"}
                    </span>
                  </div>
                  <p className="text-sm text-gray-500 mb-2">{product.category || "Uncategorized"}</p>
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-gray-900">{formatCurrency(product.price)}</span>
                    <span className="text-sm text-gray-500">{product.sales} sold</span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 bg-red-100 rounded-full">
                <Trash2 className="w-6 h-6 text-red-600" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Delete Product</h3>
                <p className="text-sm text-gray-500">This action cannot be undone</p>
              </div>
            </div>
            <p className="text-gray-600 mb-6">
              Are you sure you want to delete this product? All associated data will be permanently removed.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowDeleteConfirm(null)}
                className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(showDeleteConfirm)}
                className="px-4 py-2 bg-red-600 text-white hover:bg-red-700 rounded-lg transition-colors"
              >
                Delete Product
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Click outside to close action menu */}
      {actionMenuOpen && (
        <div 
          className="fixed inset-0 z-0" 
          onClick={() => setActionMenuOpen(null)}
        />
      )}
    </div>
  );
}
