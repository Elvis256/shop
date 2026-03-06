"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { api } from "@/lib/api";
import {
  Search,
  Package,
  Download,
  RefreshCw,
  Settings,
  Truck,
  DollarSign,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  CheckCircle,
} from "lucide-react";

type Tab = "search" | "products" | "orders" | "settings";

interface CJSearchResult {
  productId: string;
  title: string;
  imageUrl: string;
  price: number;
  originalPrice: number;
  categoryName: string;
  productUrl: string;
}

interface CJProduct {
  id: string;
  name: string;
  price: number;
  cjCost: number;
  cjProductId: string;
  cjUrl: string;
  markupType: string;
  markupValue: number;
  cjAutoSync: boolean;
  lastSyncedAt: string;
  stock: number;
  status: string;
  images: Array<{ url: string }>;
}

interface CJOrder {
  id: string;
  cjOrderId: string;
  cjProductId: string;
  quantity: number;
  supplierCost: number;
  trackingNumber: string;
  trackingUrl: string;
  shippingCarrier: string;
  status: string;
  errorMessage: string;
  createdAt: string;
  order: { orderNumber: string; customerName: string; totalAmount: number; currency: string };
  product: { name: string; images: Array<{ url: string }> };
}

export default function AdminCJPage() {
  const [tab, setTab] = useState<Tab>("search");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<CJSearchResult[]>([]);
  const [searchPage, setSearchPage] = useState(1);
  const [searchTotal, setSearchTotal] = useState(0);
  const [importModal, setImportModal] = useState<CJSearchResult | null>(null);
  const [importing, setImporting] = useState<string | null>(null);
  const [importForm, setImportForm] = useState({ markupType: "PERCENTAGE" as string, markupValue: 30, name: "" });

  const [products, setProducts] = useState<CJProduct[]>([]);
  const [productPage, setProductPage] = useState(1);
  const [productTotal, setProductTotal] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [editMarkup, setEditMarkup] = useState<string | null>(null);
  const [editMarkupForm, setEditMarkupForm] = useState({ markupType: "PERCENTAGE", markupValue: 30 });

  const [orders, setOrders] = useState<CJOrder[]>([]);
  const [orderPage, setOrderPage] = useState(1);
  const [orderTotal, setOrderTotal] = useState(0);
  const [orderFilter, setOrderFilter] = useState("");

  const [settings, setSettings] = useState({ accessToken: "" });
  const [savingSettings, setSavingSettings] = useState(false);

  useEffect(() => {
    if (tab === "products") loadProducts();
    if (tab === "orders") loadOrders();
    if (tab === "settings") loadSettings();
  }, [tab, productPage, orderPage, orderFilter]);

  const showMessage = (type: "success" | "error", text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 5000);
  };

  const handleSearch = async (page = 1) => {
    if (!searchQuery.trim()) return;
    setLoading(true);
    setSearchPage(page);
    try {
      const data = await api.admin.searchCJ(searchQuery, page);
      setSearchResults(data.products || []);
      setSearchTotal(data.totalCount || 0);
    } catch (err: any) {
      showMessage("error", err.message || "Search failed");
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async () => {
    if (!importModal) return;
    setImporting(importModal.productId);
    try {
      await api.admin.importCJProduct({
        cjProductId: importModal.productId,
        name: importForm.name || undefined,
        markupType: importForm.markupType,
        markupValue: importForm.markupValue,
      });
      showMessage("success", `"${importModal.title}" imported successfully!`);
      setImportModal(null);
    } catch (err: any) {
      showMessage("error", err.message || "Import failed");
    } finally {
      setImporting(null);
    }
  };

  const loadProducts = async () => {
    try {
      const data = await api.admin.getCJProducts({ page: String(productPage) });
      setProducts(data.products || []);
      setProductTotal(data.total || 0);
    } catch (err: any) {
      showMessage("error", err.message);
    }
  };

  const handleSync = async (productId?: string) => {
    setSyncing(true);
    try {
      const result = await api.admin.syncCJProducts(productId);
      showMessage("success", `Synced ${result.synced} products`);
      loadProducts();
    } catch (err: any) {
      showMessage("error", err.message || "Sync failed");
    } finally {
      setSyncing(false);
    }
  };

  const handleSaveMarkup = async (id: string) => {
    try {
      await api.admin.updateCJMarkup(id, { markupType: editMarkupForm.markupType, markupValue: editMarkupForm.markupValue });
      showMessage("success", "Markup updated");
      setEditMarkup(null);
      loadProducts();
    } catch (err: any) {
      showMessage("error", err.message);
    }
  };

  const loadOrders = async () => {
    try {
      const params: Record<string, string> = { page: String(orderPage) };
      if (orderFilter) params.status = orderFilter;
      const data = await api.admin.getCJOrders(params);
      setOrders(data.orders || []);
      setOrderTotal(data.total || 0);
    } catch (err: any) {
      showMessage("error", err.message);
    }
  };

  const loadSettings = async () => {
    try {
      const data = await api.admin.getCJSettings();
      setSettings({ accessToken: data.cj_access_token || "" });
    } catch {}
  };

  const handleSaveSettings = async () => {
    setSavingSettings(true);
    try {
      await api.admin.updateCJSettings(settings);
      showMessage("success", "Settings saved");
    } catch (err: any) {
      showMessage("error", err.message || "Failed to save");
    } finally {
      setSavingSettings(false);
    }
  };

  const statusBadge = (status: string) => {
    const colors: Record<string, string> = {
      PENDING: "bg-yellow-100 text-yellow-800",
      PLACED: "bg-blue-100 text-blue-800",
      SHIPPED: "bg-purple-100 text-purple-800",
      DELIVERED: "bg-green-100 text-green-800",
      CANCELLED: "bg-gray-100 text-gray-800",
      FAILED: "bg-red-100 text-red-800",
    };
    return <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${colors[status] || "bg-gray-100 text-gray-800"}`}>{status}</span>;
  };

  const tabs: { key: Tab; label: string; icon: any }[] = [
    { key: "search", label: "Search & Import", icon: Search },
    { key: "products", label: "Imported Products", icon: Package },
    { key: "orders", label: "Supplier Orders", icon: Truck },
    { key: "settings", label: "Settings", icon: Settings },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">CJ Dropshipping</h1>
          <p className="text-gray-500 text-sm mt-1">Import products from CJ Dropshipping, set your markup, and auto-fulfill orders</p>
        </div>
      </div>

      {message && (
        <div className={`p-3 rounded-lg flex items-center gap-2 ${message.type === "success" ? "bg-green-50 text-green-800" : "bg-red-50 text-red-800"}`}>
          {message.type === "success" ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
          {message.text}
        </div>
      )}

      <div className="border-b border-gray-200">
        <nav className="flex gap-4">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                tab === t.key ? "border-orange-600 text-orange-600" : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              <t.icon size={16} />
              {t.label}
            </button>
          ))}
        </nav>
      </div>

      {/* ── Search Tab ── */}
      {tab === "search" && (
        <div className="space-y-4">
          <div className="flex gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input
                type="text"
                placeholder="Search CJ Dropshipping products..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch(1)}
                className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              />
            </div>
            <button
              onClick={() => handleSearch(1)}
              disabled={loading}
              className="px-6 py-2.5 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 flex items-center gap-2"
            >
              {loading ? <RefreshCw size={16} className="animate-spin" /> : <Search size={16} />}
              Search
            </button>
          </div>

          {searchResults.length > 0 && (
            <>
              <p className="text-sm text-gray-500">Found {searchTotal} results</p>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {searchResults.map((p) => (
                  <div key={p.productId} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                    <div className="relative w-full h-48 mb-3">
                      <Image src={p.imageUrl} alt={p.title} fill className="object-contain rounded" unoptimized />
                    </div>
                    <h3 className="text-sm font-medium line-clamp-2 h-10">{p.title}</h3>
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-lg font-bold text-orange-600">${Number(p.price).toFixed(2)}</span>
                      {p.categoryName && <span className="text-xs text-gray-500">{p.categoryName}</span>}
                    </div>
                    <div className="flex gap-2 mt-3">
                      <button
                        onClick={() => { setImportModal(p); setImportForm({ ...importForm, name: p.title }); }}
                        className="flex-1 px-3 py-2 bg-orange-600 text-white text-sm rounded-lg hover:bg-orange-700 flex items-center justify-center gap-1"
                      >
                        <Download size={14} /> Import
                      </button>
                      <a href={p.productUrl} target="_blank" rel="noopener noreferrer" className="px-3 py-2 border border-gray-300 text-sm rounded-lg hover:bg-gray-50 flex items-center">
                        <ExternalLink size={14} />
                      </a>
                    </div>
                  </div>
                ))}
              </div>
              {searchTotal > 20 && (
                <div className="flex items-center justify-center gap-4 mt-4">
                  <button onClick={() => handleSearch(searchPage - 1)} disabled={searchPage <= 1} className="p-2 rounded hover:bg-gray-100 disabled:opacity-30"><ChevronLeft size={20} /></button>
                  <span className="text-sm text-gray-500">Page {searchPage}</span>
                  <button onClick={() => handleSearch(searchPage + 1)} className="p-2 rounded hover:bg-gray-100"><ChevronRight size={20} /></button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ── Import Modal ── */}
      {importModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-lg w-full p-6 space-y-4">
            <h2 className="text-lg font-bold">Import from CJ Dropshipping</h2>
            <div className="flex gap-4">
              <div className="relative w-24 h-24 flex-shrink-0">
                <Image src={importModal.imageUrl} alt="" fill className="object-contain rounded" unoptimized />
              </div>
              <div>
                <p className="text-sm font-medium line-clamp-2">{importModal.title}</p>
                <p className="text-lg font-bold text-orange-600 mt-1">${Number(importModal.price).toFixed(2)}</p>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Product Name (optional override)</label>
              <input type="text" value={importForm.name} onChange={(e) => setImportForm({ ...importForm, name: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Markup Type</label>
                <select value={importForm.markupType} onChange={(e) => setImportForm({ ...importForm, markupType: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg">
                  <option value="PERCENTAGE">Percentage (%)</option>
                  <option value="FIXED">Fixed Amount ($)</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Markup Value {importForm.markupType === "PERCENTAGE" ? "(%)" : "($)"}</label>
                <input type="number" value={importForm.markupValue} onChange={(e) => setImportForm({ ...importForm, markupValue: Number(e.target.value) })} min={0} className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
              </div>
            </div>
            <div className="p-3 bg-orange-50 rounded-lg">
              <p className="text-sm text-orange-800">
                <DollarSign size={14} className="inline" /> Your selling price:{" "}
                <strong>${importForm.markupType === "PERCENTAGE" ? (Number(importModal.price) * (1 + importForm.markupValue / 100)).toFixed(2) : (Number(importModal.price) + importForm.markupValue).toFixed(2)}</strong>
                {" "}(profit: ${importForm.markupType === "PERCENTAGE" ? (Number(importModal.price) * (importForm.markupValue / 100)).toFixed(2) : importForm.markupValue.toFixed(2)} per sale)
              </p>
            </div>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setImportModal(null)} className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
              <button onClick={handleImport} disabled={importing !== null} className="px-6 py-2 text-sm bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 flex items-center gap-2">
                {importing ? <RefreshCw size={14} className="animate-spin" /> : <Download size={14} />} Import Product
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Products Tab ── */}
      {tab === "products" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">{productTotal} imported products</p>
            <button onClick={() => handleSync()} disabled={syncing} className="px-4 py-2 bg-orange-600 text-white text-sm rounded-lg hover:bg-orange-700 disabled:opacity-50 flex items-center gap-2">
              <RefreshCw size={14} className={syncing ? "animate-spin" : ""} /> Sync All Prices
            </button>
          </div>
          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Product</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">CJ Cost</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Your Price</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Markup</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Profit</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Stock</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Status</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {products.map((p) => (
                  <tr key={p.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {p.images?.[0] && <div className="relative w-10 h-10"><Image src={p.images[0].url} alt="" fill className="object-cover rounded" unoptimized /></div>}
                        <div>
                          <p className="font-medium line-clamp-1">{p.name}</p>
                          <p className="text-xs text-gray-400">CJ#{p.cjProductId}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-600">${Number(p.cjCost).toFixed(2)}</td>
                    <td className="px-4 py-3 font-medium">${Number(p.price).toFixed(2)}</td>
                    <td className="px-4 py-3">
                      {editMarkup === p.id ? (
                        <div className="flex gap-1">
                          <select value={editMarkupForm.markupType} onChange={(e) => setEditMarkupForm({ ...editMarkupForm, markupType: e.target.value })} className="w-20 text-xs border rounded px-1 py-1">
                            <option value="PERCENTAGE">%</option>
                            <option value="FIXED">$</option>
                          </select>
                          <input type="number" value={editMarkupForm.markupValue} onChange={(e) => setEditMarkupForm({ ...editMarkupForm, markupValue: Number(e.target.value) })} className="w-16 text-xs border rounded px-1 py-1" />
                          <button onClick={() => handleSaveMarkup(p.id)} className="text-green-600 text-xs font-medium">Save</button>
                          <button onClick={() => setEditMarkup(null)} className="text-gray-400 text-xs">✕</button>
                        </div>
                      ) : (
                        <button onClick={() => { setEditMarkup(p.id); setEditMarkupForm({ markupType: p.markupType, markupValue: Number(p.markupValue) }); }} className="text-orange-600 hover:underline">
                          {p.markupType === "PERCENTAGE" ? `${p.markupValue}%` : `$${p.markupValue}`}
                        </button>
                      )}
                    </td>
                    <td className="px-4 py-3 text-green-600 font-medium">${(Number(p.price) - Number(p.cjCost)).toFixed(2)}</td>
                    <td className="px-4 py-3">{p.stock}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${p.status === "ACTIVE" ? "bg-green-100 text-green-800" : "bg-yellow-100 text-yellow-800"}`}>{p.status}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <button onClick={() => handleSync(p.id)} className="text-gray-500 hover:text-orange-600" title="Sync price"><RefreshCw size={14} /></button>
                        <a href={p.cjUrl} target="_blank" rel="noopener noreferrer" className="text-gray-500 hover:text-orange-600" title="View on CJ"><ExternalLink size={14} /></a>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {productTotal > 20 && (
            <div className="flex items-center justify-center gap-4">
              <button onClick={() => setProductPage((p) => Math.max(1, p - 1))} disabled={productPage <= 1} className="p-2 rounded hover:bg-gray-100 disabled:opacity-30"><ChevronLeft size={20} /></button>
              <span className="text-sm text-gray-500">Page {productPage}</span>
              <button onClick={() => setProductPage((p) => p + 1)} className="p-2 rounded hover:bg-gray-100"><ChevronRight size={20} /></button>
            </div>
          )}
        </div>
      )}

      {/* ── Orders Tab ── */}
      {tab === "orders" && (
        <div className="space-y-4">
          <div className="flex gap-2">
            {["", "PENDING", "PLACED", "SHIPPED", "DELIVERED", "FAILED"].map((s) => (
              <button key={s} onClick={() => { setOrderFilter(s); setOrderPage(1); }} className={`px-3 py-1.5 text-sm rounded-lg border ${orderFilter === s ? "bg-orange-600 text-white border-orange-600" : "bg-white text-gray-600 border-gray-300 hover:bg-gray-50"}`}>
                {s || "All"}
              </button>
            ))}
          </div>
          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Order</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Product</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Customer</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">CJ Order #</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Tracking</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Cost</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Status</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {orders.length === 0 && <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400">No CJ orders found</td></tr>}
                {orders.map((o) => (
                  <tr key={o.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium">{o.order?.orderNumber}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {o.product?.images?.[0] && <div className="relative w-8 h-8"><Image src={o.product.images[0].url} alt="" fill className="object-cover rounded" unoptimized /></div>}
                        <span className="line-clamp-1">{o.product?.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">{o.order?.customerName}</td>
                    <td className="px-4 py-3 font-mono text-xs">{o.cjOrderId || "—"}</td>
                    <td className="px-4 py-3">
                      {o.trackingNumber ? (
                        <a href={o.trackingUrl || `https://track.aftership.com/${o.trackingNumber}`} target="_blank" rel="noopener noreferrer" className="text-orange-600 hover:underline font-mono text-xs">{o.trackingNumber}</a>
                      ) : <span className="text-gray-400">—</span>}
                    </td>
                    <td className="px-4 py-3">${Number(o.supplierCost).toFixed(2)} × {o.quantity}</td>
                    <td className="px-4 py-3">{statusBadge(o.status)}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{new Date(o.createdAt).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {orderTotal > 20 && (
            <div className="flex items-center justify-center gap-4">
              <button onClick={() => setOrderPage((p) => Math.max(1, p - 1))} disabled={orderPage <= 1} className="p-2 rounded hover:bg-gray-100 disabled:opacity-30"><ChevronLeft size={20} /></button>
              <span className="text-sm text-gray-500">Page {orderPage}</span>
              <button onClick={() => setOrderPage((p) => p + 1)} className="p-2 rounded hover:bg-gray-100"><ChevronRight size={20} /></button>
            </div>
          )}
        </div>
      )}

      {/* ── Settings Tab ── */}
      {tab === "settings" && (
        <div className="max-w-xl space-y-6">
          <div className="bg-white border border-gray-200 rounded-lg p-6 space-y-4">
            <h2 className="text-lg font-bold">CJ Dropshipping API Key</h2>
            <p className="text-sm text-gray-500">
              Get your API access token from{" "}
              <a href="https://developers.cjdropshipping.com" target="_blank" rel="noopener noreferrer" className="text-orange-600 hover:underline">developers.cjdropshipping.com</a>
            </p>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Access Token</label>
              <input type="password" value={settings.accessToken} onChange={(e) => setSettings({ accessToken: e.target.value })} placeholder="Your CJ Dropshipping API access token" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500" />
            </div>
            <button onClick={handleSaveSettings} disabled={savingSettings} className="px-6 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 flex items-center gap-2">
              {savingSettings ? <RefreshCw size={14} className="animate-spin" /> : <Settings size={14} />} Save Settings
            </button>
          </div>

          <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
            <h3 className="text-sm font-medium text-orange-800 mb-2">ℹ️ How CJ Dropshipping works</h3>
            <ul className="text-sm text-orange-700 space-y-1">
              <li>• <strong>Search & Import:</strong> Find products on CJ and import with your markup</li>
              <li>• <strong>Auto-fulfillment:</strong> Orders auto-placed on CJ after customer pays</li>
              <li>• <strong>Tracking sync:</strong> Tracking numbers synced every 6 hours</li>
              <li>• <strong>Price sync:</strong> Prices and stock updated daily</li>
              <li>• <strong>CJ advantages:</strong> Faster shipping, US/EU warehouses, branded packaging, quality inspection</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
