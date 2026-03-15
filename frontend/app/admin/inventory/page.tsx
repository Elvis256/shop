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
  variantCount: number;
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
        variantCount: p.variantCount || 0,
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
      const updates = Array.from(selectedItems).map((id) => ({ id, stock: bulkStock }));
      await api.admin.bulkStockUpdate(updates);
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
          <h1 className="text-2xl font-semibold text-gray-900">Inventory</h1>
          <p className="text-sm text-gray-500 mt-0.5">Manage your product stock levels</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setBulkMode(!bulkMode)}
            className={`flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg transition-colors ${
              bulkMode
                ? "bg-gray-900 text-white"
                : "text-gray-700 bg-white border border-gray-200 hover:bg-gray-50"
            }`}
          >
            <Edit2 className="w-4 h-4" />
            Bulk Edit
          </button>
          <button
            onClick={loadInventory}
            className="flex items-center gap-1.5 px-3 py-2 text-sm text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-gray-500 uppercase tracking-wide">Total Products</p>
            <Package className="w-4 h-4 text-gray-400" />
          </div>
          <p className="text-2xl font-semibold text-gray-900 mt-1">{items.length}</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-gray-500 uppercase tracking-wide">Total Units</p>
            <CheckCircle className="w-4 h-4 text-gray-400" />
          </div>
          <p className="text-2xl font-semibold text-gray-900 mt-1">{availableStock.toLocaleString()}</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4 cursor-pointer hover:bg-gray-50 transition-colors" onClick={() => setFilter("low")}>
          <div className="flex items-center justify-between">
            <p className="text-xs text-gray-500 uppercase tracking-wide">Low Stock</p>
            <TrendingDown className="w-4 h-4 text-gray-400" />
          </div>
          <p className="text-2xl font-semibold text-gray-900 mt-1">{lowStockCount}</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4 cursor-pointer hover:bg-gray-50 transition-colors" onClick={() => setFilter("out")}>
          <div className="flex items-center justify-between">
            <p className="text-xs text-gray-500 uppercase tracking-wide">Out of Stock</p>
            <XCircle className="w-4 h-4 text-gray-400" />
          </div>
          <p className="text-2xl font-semibold text-gray-900 mt-1">{outOfStockCount}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search by name or SKU..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-gray-300 bg-white"
          />
        </div>
        <div className="flex border border-gray-200 rounded-lg overflow-hidden text-sm">
          {([
            { key: "all", label: "All" },
            { key: "low", label: "Low Stock" },
            { key: "out", label: "Out of Stock" },
          ] as const).map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`px-3 py-2 transition-colors ${
                filter === f.key ? "bg-gray-900 text-white" : "bg-white text-gray-600 hover:bg-gray-50"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Bulk Actions */}
      {bulkMode && selectedItems.size > 0 && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 flex items-center gap-4">
          <span className="text-sm font-medium text-gray-700">
            {selectedItems.size} selected
          </span>
          <div className="flex items-center gap-2 flex-1">
            <label className="text-sm text-gray-500">Set stock to:</label>
            <input
              type="number"
              min="0"
              value={bulkStock}
              onChange={(e) => setBulkStock(Number(e.target.value))}
              className="w-24 px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-gray-300"
            />
            <button
              onClick={handleBulkUpdate}
              disabled={saving}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-gray-900 text-white rounded-lg hover:bg-gray-800 disabled:opacity-50"
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
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="p-8">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 py-3">
                <div className="w-10 h-10 bg-gray-100 rounded-lg animate-pulse" />
                <div className="flex-1">
                  <div className="h-4 bg-gray-100 rounded animate-pulse mb-2" style={{ width: `${40 + Math.random() * 40}%` }} />
                  <div className="h-3 bg-gray-50 rounded animate-pulse w-20" />
                </div>
              </div>
            ))}
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
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/50">
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
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Product</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">SKU</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Variants</th>
                  <th
                    className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide cursor-pointer select-none hover:text-gray-700"
                    onClick={() => handleSort("stock")}
                  >
                    <span className="flex items-center gap-1">
                      Stock <ArrowUpDown className={`w-3 h-3 ${sortField === "stock" ? "text-gray-900" : "text-gray-400"}`} />
                    </span>
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Reserved</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Status</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wide">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredItems.map((item) => {
                  const stockStatus = getStockStatus(item);
                  return (
                    <tr key={item.id} className="hover:bg-gray-50/50 transition-colors">
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
                              <Package className="w-4 h-4 text-gray-400" />
                            </div>
                          )}
                          <div className="min-w-0">
                            <Link
                              href={`/admin/products/${item.id}`}
                              className="text-sm font-medium text-gray-900 hover:underline truncate block"
                            >
                              {item.name}
                            </Link>
                            {item.category && (
                              <p className="text-xs text-gray-500">{item.category}</p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500 font-mono">{item.sku || "—"}</td>
                      <td className="px-4 py-3 text-sm text-gray-500">
                        {item.variantCount > 0 ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-gray-100 text-gray-600">{item.variantCount} variants</span>
                        ) : "—"}
                      </td>
                      <td className="px-4 py-3">
                        {editingId === item.id ? (
                          <input
                            type="number"
                            min="0"
                            value={editStock}
                            onChange={(e) => setEditStock(Number(e.target.value))}
                            className="w-20 px-2 py-1 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-gray-400"
                            autoFocus
                          />
                        ) : (
                          <span className={`text-sm font-medium ${item.stock === 0 ? "text-red-600" : item.stock <= item.lowStockAlert ? "text-amber-600" : "text-gray-900"}`}>
                            {item.stock.toLocaleString()}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">{item.reservedStock}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded ${stockStatus.color}`}>
                          {stockStatus.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        {editingId === item.id ? (
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => handleSave(item.id)}
                              disabled={saving}
                              className="p-1.5 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-lg"
                            >
                              <Save className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => setEditingId(null)}
                              className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => handleEdit(item)}
                            className="p-1.5 text-gray-400 hover:text-gray-900 hover:bg-gray-100 rounded-lg"
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
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 flex items-center gap-4">
          <AlertTriangle className="w-5 h-5 text-gray-500 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-medium text-gray-700">Low Stock Warning</p>
            <p className="text-xs text-gray-500">
              {lowStockCount} product{lowStockCount > 1 ? "s" : ""} running low. Consider restocking.
            </p>
          </div>
          <button
            onClick={() => setFilter("low")}
            className="px-3 py-1.5 text-sm bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors"
          >
            View
          </button>
        </div>
      )}
    </div>
  );
}
