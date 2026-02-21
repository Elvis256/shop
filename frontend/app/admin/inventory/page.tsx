"use client";

import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import Link from "next/link";
import {
  Package,
  AlertTriangle,
  Search,
  Filter,
  RefreshCw,
  ArrowUpDown,
  Edit2,
  Save,
  X,
  TrendingDown,
  CheckCircle,
  XCircle,
  History,
} from "lucide-react";

interface InventoryItem {
  id: string;
  name: string;
  slug: string;
  sku: string | null;
  stock: number;
  reservedStock: number;
  lowStockAlert: number;
  price: number;
  status: string;
  imageUrl: string | null;
  category: string | null;
  lastUpdated: string;
}

type SortField = "name" | "stock" | "price" | "status";
type SortDirection = "asc" | "desc";

export default function InventoryPage() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "low" | "out">("all");
  const [sortField, setSortField] = useState<SortField>("stock");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editStock, setEditStock] = useState<number>(0);
  const [saving, setSaving] = useState(false);
  const [bulkMode, setBulkMode] = useState(false);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [bulkStock, setBulkStock] = useState<number>(0);

  const loadInventory = async () => {
    setLoading(true);
    try {
      const result = await api.admin.getProducts({ limit: "200" });
      const products = result.products || [];
      const inventoryItems: InventoryItem[] = products.map((p: any) => ({
        id: p.id,
        name: p.name,
        slug: p.slug,
        sku: p.sku || null,
        stock: p.stock || 0,
        reservedStock: p.reservedStock || 0,
        lowStockAlert: p.lowStockAlert || 5,
        price: Number(p.price),
        status: p.status || "ACTIVE",
        imageUrl: p.imageUrl,
        category: p.category || null,
        lastUpdated: p.updatedAt || new Date().toISOString(),
      }));
      setItems(inventoryItems);
    } catch (error) {
      console.error("Failed to load inventory:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInventory();
  }, []);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const handleEdit = (item: InventoryItem) => {
    setEditingId(item.id);
    setEditStock(item.stock);
  };

  const handleSave = async (id: string) => {
    setSaving(true);
    try {
      await api.admin.updateInventory(id, { stock: editStock });
      setItems((prev) =>
        prev.map((item) =>
          item.id === id ? { ...item, stock: editStock } : item
        )
      );
      setEditingId(null);
    } catch (error) {
      console.error("Failed to update stock:", error);
      alert("Failed to update stock");
    } finally {
      setSaving(false);
    }
  };

  const handleBulkUpdate = async () => {
    if (selectedItems.size === 0) return;
    setSaving(true);
    try {
      await Promise.all(
        Array.from(selectedItems).map((id) =>
          api.admin.updateInventory(id, { stock: bulkStock })
        )
      );
      setItems((prev) =>
        prev.map((item) =>
          selectedItems.has(item.id) ? { ...item, stock: bulkStock } : item
        )
      );
      setSelectedItems(new Set());
      setBulkMode(false);
      setBulkStock(0);
    } catch (error) {
      console.error("Failed to bulk update:", error);
      alert("Failed to update stock");
    } finally {
      setSaving(false);
    }
  };

  const toggleSelectAll = () => {
    if (selectedItems.size === filteredItems.length) {
      setSelectedItems(new Set());
    } else {
      setSelectedItems(new Set(filteredItems.map((i) => i.id)));
    }
  };

  const toggleSelect = (id: string) => {
    const newSelected = new Set(selectedItems);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedItems(newSelected);
  };

  const filteredItems = items
    .filter((item) => {
      const matchesSearch =
        item.name.toLowerCase().includes(search.toLowerCase()) ||
        (item.sku && item.sku.toLowerCase().includes(search.toLowerCase()));
      
      if (filter === "low") {
        return matchesSearch && item.stock > 0 && item.stock <= item.lowStockAlert;
      }
      if (filter === "out") {
        return matchesSearch && item.stock === 0;
      }
      return matchesSearch;
    })
    .sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case "name":
          comparison = a.name.localeCompare(b.name);
          break;
        case "stock":
          comparison = a.stock - b.stock;
          break;
        case "price":
          comparison = a.price - b.price;
          break;
        case "status":
          comparison = a.status.localeCompare(b.status);
          break;
      }
      return sortDirection === "asc" ? comparison : -comparison;
    });

  const lowStockCount = items.filter((i) => i.stock > 0 && i.stock <= i.lowStockAlert).length;
  const outOfStockCount = items.filter((i) => i.stock === 0).length;
  const availableStock = items.reduce((sum, i) => sum + i.stock, 0);

  const getStockStatus = (item: InventoryItem) => {
    if (item.stock === 0) return { label: "Out of Stock", color: "bg-red-100 text-red-700" };
    if (item.stock <= item.lowStockAlert) return { label: "Low Stock", color: "bg-amber-100 text-amber-700" };
    return { label: "In Stock", color: "bg-green-100 text-green-700" };
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">Inventory</h1>
          <p className="text-gray-500 mt-1">Manage your product stock levels</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setBulkMode(!bulkMode)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
              bulkMode
                ? "bg-primary text-white"
                : "text-gray-600 bg-white border border-gray-200 hover:bg-gray-50"
            }`}
          >
            <Edit2 className="w-4 h-4" />
            Bulk Edit
          </button>
          <button
            onClick={loadInventory}
            className="flex items-center gap-2 px-4 py-2 text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border shadow-sm p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Package className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{items.length}</p>
              <p className="text-sm text-gray-500">Total Products</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border shadow-sm p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <CheckCircle className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{availableStock.toLocaleString()}</p>
              <p className="text-sm text-gray-500">Total Units</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border shadow-sm p-4 cursor-pointer hover:bg-amber-50 transition-colors" onClick={() => setFilter("low")}>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-100 rounded-lg">
              <TrendingDown className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{lowStockCount}</p>
              <p className="text-sm text-gray-500">Low Stock</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border shadow-sm p-4 cursor-pointer hover:bg-red-50 transition-colors" onClick={() => setFilter("out")}>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-100 rounded-lg">
              <XCircle className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{outOfStockCount}</p>
              <p className="text-sm text-gray-500">Out of Stock</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border shadow-sm p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search by name or SKU..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setFilter("all")}
              className={`px-4 py-2 rounded-lg transition-colors ${
                filter === "all" ? "bg-primary text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              All
            </button>
            <button
              onClick={() => setFilter("low")}
              className={`px-4 py-2 rounded-lg transition-colors ${
                filter === "low" ? "bg-amber-500 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              Low Stock
            </button>
            <button
              onClick={() => setFilter("out")}
              className={`px-4 py-2 rounded-lg transition-colors ${
                filter === "out" ? "bg-red-500 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              Out of Stock
            </button>
          </div>
        </div>
      </div>

      {/* Bulk Actions */}
      {bulkMode && selectedItems.size > 0 && (
        <div className="bg-primary/10 border border-primary/20 rounded-xl p-4 flex items-center gap-4">
          <span className="font-medium text-primary">
            {selectedItems.size} items selected
          </span>
          <div className="flex items-center gap-2 flex-1">
            <label className="text-sm text-gray-600">Set stock to:</label>
            <input
              type="number"
              min="0"
              value={bulkStock}
              onChange={(e) => setBulkStock(Number(e.target.value))}
              className="w-24 px-3 py-1 border border-gray-200 rounded-lg"
            />
            <button
              onClick={handleBulkUpdate}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              Update All
            </button>
          </div>
          <button
            onClick={() => {
              setSelectedItems(new Set());
              setBulkMode(false);
            }}
            className="text-gray-500 hover:text-gray-700"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-8 text-center">
            <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4" />
            <p className="text-gray-500">Loading inventory...</p>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="p-12 text-center">
            <Package className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <h3 className="font-medium text-gray-900 mb-2">No products found</h3>
            <p className="text-gray-500 text-sm">Try adjusting your search or filters</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  {bulkMode && (
                    <th className="px-4 py-3 text-left">
                      <input
                        type="checkbox"
                        checked={selectedItems.size === filteredItems.length}
                        onChange={toggleSelectAll}
                        className="rounded border-gray-300"
                      />
                    </th>
                  )}
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Product</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">SKU</th>
                  <th
                    className="px-4 py-3 text-left text-sm font-medium text-gray-500 cursor-pointer hover:text-gray-700"
                    onClick={() => handleSort("stock")}
                  >
                    <span className="flex items-center gap-1">
                      Stock <ArrowUpDown className="w-4 h-4" />
                    </span>
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Reserved</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Status</th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-gray-500">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredItems.map((item) => {
                  const stockStatus = getStockStatus(item);
                  return (
                    <tr key={item.id} className="hover:bg-gray-50">
                      {bulkMode && (
                        <td className="px-4 py-3">
                          <input
                            type="checkbox"
                            checked={selectedItems.has(item.id)}
                            onChange={() => toggleSelect(item.id)}
                            className="rounded border-gray-300"
                          />
                        </td>
                      )}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          {item.imageUrl ? (
                            <img
                              src={item.imageUrl}
                              alt={item.name}
                              className="w-10 h-10 rounded-lg object-cover"
                            />
                          ) : (
                            <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
                              <Package className="w-5 h-5 text-gray-400" />
                            </div>
                          )}
                          <div>
                            <Link
                              href={`/admin/products/${item.id}`}
                              className="font-medium text-gray-900 hover:text-primary"
                            >
                              {item.name}
                            </Link>
                            {item.category && (
                              <p className="text-sm text-gray-500">{item.category}</p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">{item.sku || "—"}</td>
                      <td className="px-4 py-3">
                        {editingId === item.id ? (
                          <input
                            type="number"
                            min="0"
                            value={editStock}
                            onChange={(e) => setEditStock(Number(e.target.value))}
                            className="w-20 px-2 py-1 border border-primary rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
                            autoFocus
                          />
                        ) : (
                          <span className={`font-medium ${item.stock === 0 ? "text-red-600" : item.stock <= item.lowStockAlert ? "text-amber-600" : "text-gray-900"}`}>
                            {item.stock}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">{item.reservedStock}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${stockStatus.color}`}>
                          {stockStatus.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        {editingId === item.id ? (
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => handleSave(item.id)}
                              disabled={saving}
                              className="p-2 text-green-600 hover:bg-green-50 rounded-lg"
                            >
                              <Save className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => setEditingId(null)}
                              className="p-2 text-gray-400 hover:bg-gray-100 rounded-lg"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => handleEdit(item)}
                            className="p-2 text-gray-400 hover:text-primary hover:bg-primary/10 rounded-lg"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Low Stock Alert */}
      {lowStockCount > 0 && filter === "all" && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center gap-4">
          <AlertTriangle className="w-6 h-6 text-amber-600 flex-shrink-0" />
          <div className="flex-1">
            <p className="font-medium text-amber-800">Low Stock Warning</p>
            <p className="text-sm text-amber-700">
              {lowStockCount} products are running low on stock. Consider restocking soon.
            </p>
          </div>
          <button
            onClick={() => setFilter("low")}
            className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors"
          >
            View Items
          </button>
        </div>
      )}
    </div>
  );
}
