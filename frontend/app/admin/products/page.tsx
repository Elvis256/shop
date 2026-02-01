"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
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
} from "lucide-react";

interface Product {
  id: string;
  name: string;
  slug: string;
  sku: string;
  price: number;
  stock: number;
  status: string;
  featured: boolean;
  category: string;
  imageUrl: string;
  sales: number;
}

export default function AdminProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [pagination, setPagination] = useState({ total: 0, page: 1, totalPages: 1 });

  const loadProducts = (params: Record<string, string> = {}) => {
    setLoading(true);
    api.admin.getProducts({ search, status: statusFilter, ...params })
      .then((data) => {
        setProducts(data.products);
        setPagination(data.pagination);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadProducts();
  }, [search, statusFilter]);

  const handleBulkAction = async (action: string) => {
    if (selectedIds.length === 0) return;
    if (action === "delete" && !confirm(`Delete ${selectedIds.length} products?`)) return;

    await api.admin.bulkProductAction(action, selectedIds);
    setSelectedIds([]);
    loadProducts();
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

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "ACTIVE": return "bg-green-100 text-green-700";
      case "DRAFT": return "bg-yellow-100 text-yellow-700";
      case "ARCHIVED": return "bg-gray-100 text-gray-700";
      default: return "bg-gray-100 text-gray-700";
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Products</h1>
          <p className="text-text-muted">{pagination.total} total products</p>
        </div>
        <Link href="/admin/products/new" className="btn-primary gap-2">
          <Plus className="w-5 h-5" />
          Add Product
        </Link>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg border border-border p-4">
        <div className="flex flex-wrap gap-4">
          <div className="relative flex-1 min-w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-text-muted" />
            <input
              type="text"
              className="input pl-10"
              placeholder="Search products..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <select
            className="input w-40"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="">All Status</option>
            <option value="ACTIVE">Active</option>
            <option value="DRAFT">Draft</option>
            <option value="ARCHIVED">Archived</option>
          </select>
        </div>

        {/* Bulk Actions */}
        {selectedIds.length > 0 && (
          <div className="mt-4 pt-4 border-t border-border flex items-center gap-4">
            <span className="text-sm text-text-muted">
              {selectedIds.length} selected
            </span>
            <button
              onClick={() => handleBulkAction("activate")}
              className="btn-secondary text-sm"
            >
              Activate
            </button>
            <button
              onClick={() => handleBulkAction("archive")}
              className="btn-secondary text-sm"
            >
              Archive
            </button>
            <button
              onClick={() => handleBulkAction("feature")}
              className="btn-secondary text-sm"
            >
              Feature
            </button>
            <button
              onClick={() => handleBulkAction("delete")}
              className="btn-secondary text-sm text-red-600 hover:bg-red-50"
            >
              Delete
            </button>
          </div>
        )}
      </div>

      {/* Products Table */}
      <div className="bg-white rounded-lg border border-border overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-border">
            <tr>
              <th className="p-4 text-left">
                <input
                  type="checkbox"
                  checked={selectedIds.length === products.length && products.length > 0}
                  onChange={toggleSelectAll}
                />
              </th>
              <th className="p-4 text-left text-sm font-medium">Product</th>
              <th className="p-4 text-left text-sm font-medium">SKU</th>
              <th className="p-4 text-left text-sm font-medium">Price</th>
              <th className="p-4 text-left text-sm font-medium">Stock</th>
              <th className="p-4 text-left text-sm font-medium">Status</th>
              <th className="p-4 text-left text-sm font-medium">Sales</th>
              <th className="p-4 text-right text-sm font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {loading ? (
              <tr>
                <td colSpan={8} className="p-8 text-center text-text-muted">
                  Loading...
                </td>
              </tr>
            ) : products.length === 0 ? (
              <tr>
                <td colSpan={8} className="p-8 text-center text-text-muted">
                  No products found
                </td>
              </tr>
            ) : (
              products.map((product) => (
                <tr key={product.id} className="hover:bg-gray-50">
                  <td className="p-4">
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(product.id)}
                      onChange={() => toggleSelect(product.id)}
                    />
                  </td>
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-gray-100 rounded flex-shrink-0">
                        {product.imageUrl && (
                          <img
                            src={product.imageUrl}
                            alt=""
                            className="w-full h-full object-cover rounded"
                          />
                        )}
                      </div>
                      <div>
                        <p className="font-medium flex items-center gap-2">
                          {product.name}
                          {product.featured && (
                            <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                          )}
                        </p>
                        <p className="text-sm text-text-muted">{product.category}</p>
                      </div>
                    </div>
                  </td>
                  <td className="p-4 text-sm text-text-muted">{product.sku || "-"}</td>
                  <td className="p-4 font-medium">KES {Number(product.price).toLocaleString()}</td>
                  <td className="p-4">
                    <span className={product.stock <= 5 ? "text-red-600 font-medium" : ""}>
                      {product.stock}
                    </span>
                  </td>
                  <td className="p-4">
                    <span className={`text-xs px-2 py-1 rounded-full ${getStatusBadge(product.status)}`}>
                      {product.status}
                    </span>
                  </td>
                  <td className="p-4 text-sm">{product.sales}</td>
                  <td className="p-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Link
                        href={`/product/${product.slug}`}
                        className="p-2 hover:bg-gray-100 rounded"
                        target="_blank"
                      >
                        <Eye className="w-4 h-4 text-text-muted" />
                      </Link>
                      <Link
                        href={`/admin/products/${product.id}`}
                        className="p-2 hover:bg-gray-100 rounded"
                      >
                        <Edit className="w-4 h-4 text-text-muted" />
                      </Link>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="flex items-center justify-between p-4 border-t border-border">
            <p className="text-sm text-text-muted">
              Page {pagination.page} of {pagination.totalPages}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => loadProducts({ page: String(pagination.page - 1) })}
                disabled={pagination.page === 1}
                className="btn-secondary text-sm"
              >
                Previous
              </button>
              <button
                onClick={() => loadProducts({ page: String(pagination.page + 1) })}
                disabled={pagination.page === pagination.totalPages}
                className="btn-secondary text-sm"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
