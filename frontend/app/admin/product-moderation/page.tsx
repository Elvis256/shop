"use client";

import { useEffect, useState, useCallback } from "react";
import { apiFetch } from "@/lib/api";
import {
  Search,
  ChevronLeft,
  ChevronRight,
  X,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Loader2,
  Package,
  Eye,
  MessageSquare,
  Filter,
  Download,
  Clock,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ExternalLink,
  Shield,
  Image as ImageIcon,
  Tag,
  Store,
  ChevronDown,
  ListChecks,
} from "lucide-react";

interface Product {
  id: string;
  name: string;
  slug: string;
  description?: string;
  price: number;
  comparePrice?: number;
  status: string;
  stock: number;
  moderationNote?: string;
  createdAt: string;
  updatedAt?: string;
  images: { url: string; alt?: string }[];
  category?: { id: string; name: string };
  seller?: { id: string; storeName: string; email: string; logo?: string };
}

interface Category {
  id: string;
  name: string;
}

const STATUS_TABS = ["PENDING_REVIEW", "APPROVED", "REJECTED", "CHANGES_REQUESTED"] as const;

const statusLabels: Record<string, string> = {
  PENDING_REVIEW: "Pending Review",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  CHANGES_REQUESTED: "Changes Requested",
};

const statusColors: Record<string, string> = {
  PENDING_REVIEW: "bg-yellow-100 text-yellow-800",
  APPROVED: "bg-green-100 text-green-800",
  REJECTED: "bg-red-100 text-red-800",
  CHANGES_REQUESTED: "bg-blue-100 text-blue-800",
};

const POLICY_CHECKS = [
  { key: "images", label: "Product images are clear and appropriate" },
  { key: "title", label: "Title is accurate and not misleading" },
  { key: "description", label: "Description matches the product" },
  { key: "pricing", label: "Pricing is reasonable (not predatory)" },
  { key: "category", label: "Correct category selected" },
  { key: "prohibited", label: "Not a prohibited/restricted item" },
];

type SortField = "name" | "price" | "stock" | "createdAt";
type SortDir = "asc" | "desc";

export default function ProductModerationPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [statusFilter, setStatusFilter] = useState("PENDING_REVIEW");
  const [selected, setSelected] = useState<Product | null>(null);
  const [actionReason, setActionReason] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  // Advanced filters
  const [showFilters, setShowFilters] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState("");
  const [sellerFilter, setSellerFilter] = useState("");
  const [categories, setCategories] = useState<Category[]>([]);

  // Sorting
  const [sortField, setSortField] = useState<SortField>("createdAt");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  // Bulk selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkActioning, setBulkActioning] = useState(false);
  const [bulkModal, setBulkModal] = useState<{ action: "approve" | "reject" } | null>(null);
  const [bulkReason, setBulkReason] = useState("");

  // Policy checklist
  const [policyChecks, setPolicyChecks] = useState<Record<string, boolean>>({});

  // Stats
  const [stats, setStats] = useState({ pending: 0, approved: 0, rejected: 0, changes: 0 });

  const fetchProducts = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({ page: String(page), limit: "20" });
      if (search) params.set("search", search);
      if (statusFilter) params.set("status", statusFilter);
      const data = await apiFetch(`/api/admin/product-moderation?${params}`);
      setProducts(data.products || []);
      setPendingCount(data.pendingCount || 0);
      setTotalPages(data.pagination?.pages || 1);
      setTotalCount(data.pagination?.total || data.products?.length || 0);

      setStats({
        pending: data.pendingCount || 0,
        approved: data.approvedCount || 0,
        rejected: data.rejectedCount || 0,
        changes: data.changesCount || 0,
      });
    } catch {
    } finally {
      setLoading(false);
    }
  }, [page, search, statusFilter]);

  const fetchCategories = useCallback(async () => {
    try {
      const data = await apiFetch("/api/categories");
      setCategories(Array.isArray(data) ? data : data.categories || []);
    } catch {}
  }, []);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  // Client-side sorting and extra filtering
  const filteredProducts = products.filter((p) => {
    if (categoryFilter && p.category?.id !== categoryFilter) return false;
    if (sellerFilter && !p.seller?.storeName?.toLowerCase().includes(sellerFilter.toLowerCase())) return false;
    return true;
  });

  const sortedProducts = [...filteredProducts].sort((a, b) => {
    const dir = sortDir === "asc" ? 1 : -1;
    switch (sortField) {
      case "name": return dir * a.name.localeCompare(b.name);
      case "price": return dir * (a.price - b.price);
      case "stock": return dir * (a.stock - b.stock);
      case "createdAt": return dir * (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      default: return 0;
    }
  });

  const toggleSort = (field: SortField) => {
    if (sortField === field) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortField(field); setSortDir("desc"); }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="w-3 h-3 text-gray-300" />;
    return sortDir === "asc" ? <ArrowUp className="w-3 h-3 text-primary" /> : <ArrowDown className="w-3 h-3 text-primary" />;
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === sortedProducts.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(sortedProducts.map((p) => p.id)));
  };

  const handleAction = async (action: "approve" | "reject" | "request-changes") => {
    if (!selected) return;
    if ((action === "reject" || action === "request-changes") && !actionReason.trim()) {
      return;
    }
    setActionLoading(true);
    try {
      await apiFetch(`/api/admin/product-moderation/${selected.id}/${action}`, {
        method: "PUT",
        body: JSON.stringify({ reason: actionReason.trim() }),
      });
      setSelected(null);
      setActionReason("");
      setPolicyChecks({});
      fetchProducts();
    } catch {
    } finally {
      setActionLoading(false);
    }
  };

  const handleBulkAction = async () => {
    if (!bulkModal || selectedIds.size === 0) return;
    setBulkActioning(true);
    try {
      const promises = Array.from(selectedIds).map((id) =>
        apiFetch(`/api/admin/product-moderation/${id}/${bulkModal.action}`, {
          method: "PUT",
          body: JSON.stringify({ reason: bulkReason.trim() }),
        })
      );
      await Promise.allSettled(promises);
      setSelectedIds(new Set());
      setBulkModal(null);
      setBulkReason("");
      fetchProducts();
    } catch {
    } finally {
      setBulkActioning(false);
    }
  };

  const exportCSV = async () => {
    const headers = ["Product Name", "Seller", "Category", "Price", "Stock", "Status", "Submitted"];
    const rows = products.map((p) => [
      p.name, p.seller?.storeName || "", p.category?.name || "", p.price, p.stock, p.status,
      new Date(p.createdAt).toLocaleDateString(),
    ]);
    const csv = [headers.join(","), ...rows.map((r) => r.map((v) => `"${v}"`).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `product-moderation-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const allChecked = POLICY_CHECKS.every((c) => policyChecks[c.key]);

  const statCards = [
    { label: "Pending Review", value: stats.pending, color: "text-yellow-600 bg-yellow-50", icon: Clock, filter: "PENDING_REVIEW" },
    { label: "Approved", value: stats.approved, color: "text-green-600 bg-green-50", icon: CheckCircle, filter: "APPROVED" },
    { label: "Rejected", value: stats.rejected, color: "text-red-600 bg-red-50", icon: XCircle, filter: "REJECTED" },
    { label: "Changes Requested", value: stats.changes, color: "text-blue-600 bg-blue-50", icon: AlertTriangle, filter: "CHANGES_REQUESTED" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Product Review</h1>
          <p className="text-sm text-gray-500 mt-1">Review and moderate seller product listings</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={exportCSV}
            className="inline-flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <Download className="w-4 h-4" /> Export
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {statCards.map((s) => (
          <div
            key={s.label}
            className={`bg-white rounded-xl shadow-sm border border-gray-100 p-4 cursor-pointer hover:shadow-md transition-shadow ${statusFilter === s.filter ? "ring-2 ring-primary/30" : ""}`}
            onClick={() => { setStatusFilter(s.filter); setPage(1); }}
          >
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${s.color}`}>
                <s.icon className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs text-gray-500">{s.label}</p>
                <p className="text-xl font-bold text-gray-900">{s.value}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 space-y-3">
        <div className="flex flex-col sm:flex-row gap-3">
          <form
            onSubmit={(e) => { e.preventDefault(); setSearch(searchInput); setPage(1); }}
            className="flex gap-2 flex-1"
          >
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search by product name or seller..."
                className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              />
            </div>
            <button type="submit" className="px-4 py-2 bg-gray-900 text-white rounded-lg text-sm font-medium">
              Search
            </button>
            {search && (
              <button type="button" onClick={() => { setSearch(""); setSearchInput(""); setPage(1); }} className="px-3 py-2 border border-gray-200 rounded-lg text-sm">
                Clear
              </button>
            )}
          </form>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`inline-flex items-center gap-2 px-3 py-2 border rounded-lg text-sm font-medium transition-colors ${
              showFilters || categoryFilter || sellerFilter ? "border-primary text-primary bg-primary/5" : "border-gray-200 text-gray-600 hover:bg-gray-50"
            }`}
          >
            <Filter className="w-4 h-4" /> Filters
          </button>
        </div>

        {/* Status Tabs */}
        <div className="flex gap-1 overflow-x-auto">
          <button
            onClick={() => { setStatusFilter(""); setPage(1); }}
            className={`px-3 py-2 text-xs font-medium rounded-lg whitespace-nowrap transition-colors ${
              !statusFilter ? "bg-primary text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            All
          </button>
          {STATUS_TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => { setStatusFilter(tab); setPage(1); }}
              className={`px-3 py-2 text-xs font-medium rounded-lg whitespace-nowrap transition-colors ${
                statusFilter === tab ? "bg-primary text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {statusLabels[tab]}
            </button>
          ))}
        </div>

        {showFilters && (
          <div className="grid grid-cols-2 gap-3 pt-2 border-t border-gray-100">
            <div>
              <label className="text-xs text-gray-500 block mb-1">Category</label>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/20"
              >
                <option value="">All Categories</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Seller</label>
              <input
                type="text"
                value={sellerFilter}
                onChange={(e) => setSellerFilter(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                placeholder="Filter by seller name..."
              />
            </div>
          </div>
        )}
      </div>

      {/* Bulk Actions */}
      {selectedIds.size > 0 && (
        <div className="bg-primary/5 border border-primary/20 rounded-xl p-3 flex items-center justify-between">
          <p className="text-sm font-medium text-primary">
            {selectedIds.size} product{selectedIds.size !== 1 ? "s" : ""} selected
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setBulkModal({ action: "approve" })}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white text-xs font-medium rounded-lg hover:bg-green-700"
            >
              <CheckCircle className="w-3.5 h-3.5" /> Approve All
            </button>
            <button
              onClick={() => setBulkModal({ action: "reject" })}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-600 text-white text-xs font-medium rounded-lg hover:bg-red-700"
            >
              <XCircle className="w-3.5 h-3.5" /> Reject All
            </button>
            <button onClick={() => setSelectedIds(new Set())} className="px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-100 rounded-lg">
              Clear
            </button>
          </div>
        </div>
      )}

      {/* Products Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : sortedProducts.length === 0 ? (
          <div className="text-center py-20 text-gray-500">
            <CheckCircle className="w-12 h-12 mx-auto mb-3 text-green-400" />
            <p className="text-lg font-medium">All caught up!</p>
            <p className="text-sm">No products matching your filters.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-4 py-3 w-10">
                    <input
                      type="checkbox"
                      checked={selectedIds.size === sortedProducts.length && sortedProducts.length > 0}
                      onChange={toggleSelectAll}
                      className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary"
                    />
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">
                    <button onClick={() => toggleSort("name")} className="inline-flex items-center gap-1 hover:text-gray-900">
                      Product <SortIcon field="name" />
                    </button>
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Seller</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Category</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-500">
                    <button onClick={() => toggleSort("price")} className="inline-flex items-center gap-1 hover:text-gray-900">
                      Price <SortIcon field="price" />
                    </button>
                  </th>
                  <th className="text-center px-4 py-3 font-medium text-gray-500">
                    <button onClick={() => toggleSort("stock")} className="inline-flex items-center gap-1 hover:text-gray-900">
                      Stock <SortIcon field="stock" />
                    </button>
                  </th>
                  <th className="text-center px-4 py-3 font-medium text-gray-500">Status</th>
                  <th className="text-center px-4 py-3 font-medium text-gray-500">
                    <button onClick={() => toggleSort("createdAt")} className="inline-flex items-center gap-1 hover:text-gray-900">
                      Submitted <SortIcon field="createdAt" />
                    </button>
                  </th>
                  <th className="text-center px-4 py-3 font-medium text-gray-500">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {sortedProducts.map((p) => (
                  <tr key={p.id} className={`hover:bg-gray-50 transition-colors ${selectedIds.has(p.id) ? "bg-primary/5" : ""}`}>
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(p.id)}
                        onChange={() => toggleSelect(p.id)}
                        className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {p.images[0] ? (
                          <img src={p.images[0].url.startsWith("/") ? `${process.env.NEXT_PUBLIC_API_URL || ""}${p.images[0].url}` : p.images[0].url} alt={p.name} className="w-10 h-10 rounded object-cover border border-gray-200" />
                        ) : (
                          <div className="w-10 h-10 rounded bg-gray-100 flex items-center justify-center">
                            <Package className="w-5 h-5 text-gray-400" />
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="font-medium text-gray-900 truncate max-w-[200px]">{p.name}</p>
                          {p.moderationNote && (
                            <p className="text-xs text-yellow-600 flex items-center gap-1 mt-0.5">
                              <MessageSquare className="w-3 h-3" /> Has notes
                            </p>
                          )}
                          <p className="text-xs text-gray-400">{p.images.length} image{p.images.length !== 1 ? "s" : ""}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {p.seller?.logo ? (
                          <img src={p.seller.logo.startsWith("/") ? `${process.env.NEXT_PUBLIC_API_URL || ""}${p.seller.logo}` : p.seller.logo} alt="" className="w-6 h-6 rounded-full object-cover" />
                        ) : (
                          <Store className="w-4 h-4 text-gray-400" />
                        )}
                        <span className="text-gray-700 text-sm truncate max-w-[120px]">{p.seller?.storeName || "—"}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {p.category ? (
                        <span className="inline-flex items-center gap-1 text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                          <Tag className="w-3 h-3" /> {p.category.name}
                        </span>
                      ) : (
                        <span className="text-gray-400 text-xs">None</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-gray-900 whitespace-nowrap">
                      UGX {Number(p.price).toLocaleString()}
                      {p.comparePrice && p.comparePrice > p.price && (
                        <span className="block text-xs text-gray-400 line-through">UGX {Number(p.comparePrice).toLocaleString()}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`text-sm ${p.stock <= 0 ? "text-red-600 font-medium" : p.stock < 5 ? "text-yellow-600" : "text-gray-600"}`}>
                        {p.stock}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`text-xs font-medium px-2 py-1 rounded-full ${statusColors[p.status] || "bg-gray-100 text-gray-600"}`}>
                        {statusLabels[p.status] || p.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center text-xs text-gray-500 whitespace-nowrap">
                      {new Date(p.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => { setSelected(p); setActionReason(""); setPolicyChecks({}); }}
                        className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-primary bg-primary/5 hover:bg-primary/10 rounded-lg transition-colors"
                      >
                        <Eye className="w-3.5 h-3.5" /> Review
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t">
            <p className="text-sm text-gray-500">Page {page} of {totalPages}</p>
            <div className="flex items-center gap-1">
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-50">
                <ChevronLeft className="w-4 h-4" />
              </button>
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                const start = Math.max(1, Math.min(page - 2, totalPages - 4));
                const pageNum = start + i;
                if (pageNum > totalPages) return null;
                return (
                  <button key={pageNum} onClick={() => setPage(pageNum)} className={`w-8 h-8 text-xs rounded-lg ${pageNum === page ? "bg-primary text-white" : "hover:bg-gray-100 text-gray-600"}`}>
                    {pageNum}
                  </button>
                );
              })}
              <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-50">
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Detail/Review Modal */}
      {selected && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setSelected(null)}>
          <div className="bg-white rounded-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-6 border-b sticky top-0 bg-white z-10">
              <h2 className="text-lg font-bold text-gray-900">Review Product</h2>
              <button onClick={() => setSelected(null)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-5">
              {/* Images */}
              {selected.images.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-gray-500 mb-2 uppercase">Product Images ({selected.images.length})</p>
                  <div className="flex gap-2 overflow-x-auto pb-2">
                    {selected.images.map((img, i) => (
                      <a key={i} href={img.url.startsWith("/") ? `${process.env.NEXT_PUBLIC_API_URL || ""}${img.url}` : img.url} target="_blank" rel="noopener noreferrer" className="flex-shrink-0">
                        <img src={img.url.startsWith("/") ? `${process.env.NEXT_PUBLIC_API_URL || ""}${img.url}` : img.url} alt={img.alt || selected.name} className="w-28 h-28 rounded-lg object-cover border border-gray-200 hover:border-primary transition-colors" />
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {/* Product Info */}
              <div>
                <h3 className="text-xl font-semibold text-gray-900">{selected.name}</h3>
                <p className="text-sm text-gray-500 mt-1">
                  by <span className="font-medium text-gray-700">{selected.seller?.storeName || "Unknown"}</span> ({selected.seller?.email})
                </p>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-gray-500 text-xs">Price</p>
                  <p className="font-semibold text-gray-900">UGX {Number(selected.price).toLocaleString()}</p>
                  {selected.comparePrice && selected.comparePrice > selected.price && (
                    <p className="text-xs text-gray-400 line-through">UGX {Number(selected.comparePrice).toLocaleString()}</p>
                  )}
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-gray-500 text-xs">Stock</p>
                  <p className="font-semibold text-gray-900">{selected.stock}</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-gray-500 text-xs">Category</p>
                  <p className="font-semibold text-gray-900">{selected.category?.name || "None"}</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-gray-500 text-xs">Current Status</p>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${statusColors[selected.status] || "bg-gray-100 text-gray-600"}`}>
                    {statusLabels[selected.status] || selected.status}
                  </span>
                </div>
              </div>

              {selected.description && (
                <div>
                  <p className="text-xs font-medium text-gray-500 mb-1 uppercase">Description</p>
                  <div className="text-sm text-gray-600 whitespace-pre-wrap bg-gray-50 rounded-lg p-3 max-h-40 overflow-y-auto">{selected.description}</div>
                </div>
              )}

              {selected.moderationNote && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                  <p className="text-sm font-medium text-yellow-800">Previous Moderation Note</p>
                  <p className="text-sm text-yellow-700 mt-1">{selected.moderationNote}</p>
                </div>
              )}

              {/* Policy Checklist */}
              <div>
                <p className="text-xs font-medium text-gray-500 mb-2 uppercase flex items-center gap-1">
                  <ListChecks className="w-4 h-4" /> Policy Checklist
                </p>
                <div className="space-y-2 bg-gray-50 rounded-lg p-3">
                  {POLICY_CHECKS.map((check) => (
                    <label key={check.key} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={!!policyChecks[check.key]}
                        onChange={(e) => setPolicyChecks((prev) => ({ ...prev, [check.key]: e.target.checked }))}
                        className="w-4 h-4 rounded border-gray-300 text-green-600 focus:ring-green-500"
                      />
                      <span className={`text-sm ${policyChecks[check.key] ? "text-green-700" : "text-gray-600"}`}>
                        {check.label}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Action Reason */}
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1 uppercase">
                  Notes / Reason (required for reject & request changes)
                </label>
                <textarea
                  value={actionReason}
                  onChange={(e) => setActionReason(e.target.value)}
                  rows={3}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                  placeholder="Enter reason for rejection or changes needed..."
                />
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => handleAction("approve")}
                  disabled={actionLoading}
                  className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-white rounded-lg font-medium transition-colors disabled:opacity-50 ${
                    allChecked ? "bg-green-600 hover:bg-green-700" : "bg-green-600/60"
                  }`}
                >
                  {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                  Approve
                </button>
                <button
                  onClick={() => handleAction("request-changes")}
                  disabled={actionLoading || !actionReason.trim()}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 disabled:opacity-50 font-medium"
                >
                  {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <AlertTriangle className="w-4 h-4" />}
                  Request Changes
                </button>
                <button
                  onClick={() => handleAction("reject")}
                  disabled={actionLoading || !actionReason.trim()}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 font-medium"
                >
                  {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
                  Reject
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Action Modal */}
      {bulkModal && (
        <div className="fixed inset-0 bg-black/50 z-[600] flex items-center justify-center p-4" onClick={() => setBulkModal(null)}>
          <div className="bg-white rounded-2xl max-w-md w-full" onClick={(e) => e.stopPropagation()}>
            <div className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Bulk {bulkModal.action === "approve" ? "Approve" : "Reject"} Products
              </h3>
              <p className="text-sm text-gray-600 mb-4">
                This will {bulkModal.action} <strong>{selectedIds.size} product{selectedIds.size !== 1 ? "s" : ""}</strong>.
              </p>
              {bulkModal.action === "reject" && (
                <div className="mb-4">
                  <label className="text-sm text-gray-700 block mb-1">Reason</label>
                  <textarea
                    value={bulkReason}
                    onChange={(e) => setBulkReason(e.target.value)}
                    rows={3}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                    placeholder="Reason for rejection..."
                  />
                </div>
              )}
              <div className="flex gap-3 justify-end">
                <button onClick={() => setBulkModal(null)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">Cancel</button>
                <button
                  onClick={handleBulkAction}
                  disabled={bulkActioning || (bulkModal.action === "reject" && !bulkReason.trim())}
                  className={`px-4 py-2 text-sm font-medium text-white rounded-lg disabled:opacity-50 ${
                    bulkModal.action === "approve" ? "bg-green-600 hover:bg-green-700" : "bg-red-600 hover:bg-red-700"
                  }`}
                >
                  {bulkActioning ? "Processing..." : `Confirm (${selectedIds.size})`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
