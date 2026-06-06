"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import {
  ArrowLeft,
  Store,
  Star,
  Eye,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Loader2,
  MessageSquare,
  ShieldAlert,
  Activity,
  TrendingUp,
  Search,
  ChevronLeft,
  ChevronRight,
  Package,
  ShoppingCart,
  Settings,
  DollarSign,
  Clock,
  Mail,
  Phone,
  Globe,
  Calendar,
  Users,
  FileText,
  Download,
} from "lucide-react";

interface Seller {
  id: string;
  storeName: string;
  storeSlug: string;
  email: string;
  phone?: string;
  storeLogo?: string;
  storeDescription?: string;
  status: "PENDING" | "APPROVED" | "SUSPENDED" | "REJECTED";
  commissionRate?: number;
  autoApproveProducts?: boolean;
  rating: number;
  reviewCount: number;
  productCount: number;
  orderCount: number;
  totalEarnings: number;
  balance: number;
  warningCount: number;
  verificationDocs?: string[];
  idDocument?: string;
  businessLicense?: string;
  bankName?: string;
  bankAccount?: string;
  mobileMoney?: string;
  rejectionNote?: string;
  tier?: string;
  createdAt: string;
  warnings?: any[];
}

interface Scorecard {
  fulfillmentRate: number;
  returnRate: number;
  customerRating: number;
  responseTimeMinutes: number;
  flags?: string[];
}

interface Product {
  id: string;
  name: string;
  slug: string;
  price: number;
  stock: number;
  status: string;
  imageUrl?: string;
  createdAt: string;
}

interface Order {
  id: string;
  orderNumber: string;
  customerName: string;
  totalAmount: number;
  currency: string;
  status: string;
  paymentStatus: string;
  itemCount: number;
  createdAt: string;
}

const statusColors: Record<string, string> = {
  PENDING: "bg-yellow-100 text-yellow-800",
  APPROVED: "bg-green-100 text-green-800",
  SUSPENDED: "bg-red-100 text-red-800",
  REJECTED: "bg-gray-100 text-gray-800",
};

const orderStatusColors: Record<string, string> = {
  PENDING: "bg-gray-100 text-gray-700",
  CONFIRMED: "bg-blue-100 text-blue-700",
  PROCESSING: "bg-yellow-100 text-yellow-700",
  SHIPPED: "bg-indigo-100 text-indigo-700",
  DELIVERED: "bg-green-100 text-green-700",
  CANCELLED: "bg-red-100 text-red-700",
  REFUNDED: "bg-orange-100 text-orange-700",
};

const productStatusColors: Record<string, string> = {
  ACTIVE: "bg-green-100 text-green-700",
  DRAFT: "bg-gray-100 text-gray-700",
  ARCHIVED: "bg-yellow-100 text-yellow-700",
  REJECTED: "bg-red-100 text-red-700",
  PENDING: "bg-yellow-100 text-yellow-700",
};

const TABS = ["Products", "Orders", "Activity", "Settings"] as const;
type Tab = (typeof TABS)[number];

export default function SellerDetailPage() {
  const params = useParams();
  const router = useRouter();
  const sellerId = params.id as string;

  const [seller, setSeller] = useState<Seller | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>("Products");

  // Scorecard
  const [scorecard, setScorecard] = useState<Scorecard | null>(null);

  // Activity
  const [activityLog, setActivityLog] = useState<any[]>([]);

  // Products tab
  const [products, setProducts] = useState<Product[]>([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [productSearch, setProductSearch] = useState("");
  const [productStatusFilter, setProductStatusFilter] = useState("");
  const [productPage, setProductPage] = useState(1);
  const [productTotalPages, setProductTotalPages] = useState(1);

  // Orders tab
  const [orders, setOrders] = useState<Order[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [orderPage, setOrderPage] = useState(1);
  const [orderTotalPages, setOrderTotalPages] = useState(1);

  // Settings tab
  const [editCommission, setEditCommission] = useState("");
  const [editAutoApprove, setEditAutoApprove] = useState(false);
  const [saving, setSaving] = useState(false);

  // Warnings
  const [warningReason, setWarningReason] = useState("");
  const [issuingWarning, setIssuingWarning] = useState(false);

  // Action modal
  const [actionModal, setActionModal] = useState<{ action: "APPROVED" | "SUSPENDED" | "REJECTED" } | null>(null);
  const [rejectionNote, setRejectionNote] = useState("");
  const [actioning, setActioning] = useState(false);

  // Load seller detail + scorecard
  useEffect(() => {
    if (!sellerId) return;
    loadSeller();
    loadScorecard();
  }, [sellerId]);

  // Load tab data when tab changes
  useEffect(() => {
    if (!sellerId) return;
    if (activeTab === "Products") loadProducts();
    if (activeTab === "Orders") loadOrders();
  }, [activeTab, sellerId, productPage, productSearch, productStatusFilter, orderPage]);

  const loadSeller = async () => {
    setLoading(true);
    try {
      const data = await apiFetch(`/api/admin/sellers/${sellerId}`);
      const s = data.seller || data;
      setSeller(s);
      setEditCommission(String(s.commissionRate || ""));
      setEditAutoApprove(s.autoApproveProducts || false);
      if (data.activityLog) setActivityLog(data.activityLog);
    } catch {
      setSeller(null);
    } finally {
      setLoading(false);
    }
  };

  const loadScorecard = async () => {
    try {
      const data = await apiFetch(`/api/admin/sellers/${sellerId}/scorecard`);
      setScorecard(data.scorecard);
    } catch {}
  };

  const loadProducts = async () => {
    setProductsLoading(true);
    try {
      const params = new URLSearchParams({
        sellerId,
        page: String(productPage),
        limit: "10",
      });
      if (productSearch) params.set("search", productSearch);
      if (productStatusFilter) params.set("status", productStatusFilter);
      const data = await apiFetch(`/api/admin/products?${params}`);
      setProducts(
        (data.products || []).map((p: any) => ({
          id: p.id,
          name: p.name,
          slug: p.slug,
          price: Number(p.price),
          stock: p.stock,
          status: p.status,
          imageUrl: p.imageUrl,
          createdAt: p.createdAt,
        }))
      );
      setProductTotalPages(data.pagination?.totalPages || 1);
    } catch {
      setProducts([]);
    } finally {
      setProductsLoading(false);
    }
  };

  const loadOrders = async () => {
    setOrdersLoading(true);
    try {
      const params = new URLSearchParams({
        sellerId,
        page: String(orderPage),
        limit: "10",
      });
      const data = await apiFetch(`/api/admin/orders?${params}`);
      setOrders(data.orders || []);
      setOrderTotalPages(data.pagination?.totalPages || 1);
    } catch {
      setOrders([]);
    } finally {
      setOrdersLoading(false);
    }
  };

  const handleStatusChange = async () => {
    if (!actionModal || !seller) return;
    setActioning(true);
    try {
      const body: any = { status: actionModal.action };
      if (actionModal.action === "REJECTED" && rejectionNote) body.rejectionNote = rejectionNote;
      await apiFetch(`/api/admin/sellers/${seller.id}/status`, {
        method: "PUT",
        body: JSON.stringify(body),
      });
      setActionModal(null);
      setRejectionNote("");
      loadSeller();
    } catch {
    } finally {
      setActioning(false);
    }
  };

  const handleSaveSettings = async () => {
    if (!seller) return;
    setSaving(true);
    try {
      await apiFetch(`/api/admin/sellers/${seller.id}`, {
        method: "PUT",
        body: JSON.stringify({
          commissionRate: Number(editCommission) || undefined,
          autoApproveProducts: editAutoApprove,
        }),
      });
      loadSeller();
    } catch {
    } finally {
      setSaving(false);
    }
  };

  const issueWarning = async () => {
    if (!seller || !warningReason.trim()) return;
    setIssuingWarning(true);
    try {
      const data = await apiFetch(`/api/admin/sellers/${seller.id}/warnings`, {
        method: "POST",
        body: JSON.stringify({ reason: warningReason.trim() }),
      });
      setWarningReason("");
      loadSeller();
      if (data.autoSuspended) loadSeller();
    } catch {
      alert("Failed to issue warning");
    } finally {
      setIssuingWarning(false);
    }
  };

  const expireWarning = async (warningId: string) => {
    if (!seller) return;
    try {
      await apiFetch(`/api/admin/sellers/${seller.id}/warnings/${warningId}`, { method: "DELETE" });
      loadSeller();
    } catch {}
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 bg-gray-200 rounded animate-pulse" />
        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 h-96 bg-gray-200 rounded-xl animate-pulse" />
          <div className="h-96 bg-gray-200 rounded-xl animate-pulse" />
        </div>
      </div>
    );
  }

  if (!seller) {
    return (
      <div className="text-center py-12">
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Seller not found</h2>
        <Link href="/admin/sellers" className="text-primary hover:underline">
          Back to Sellers
        </Link>
      </div>
    );
  }

  const warnings = seller.warnings || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link
            href="/admin/sellers"
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="flex items-center gap-3">
            {seller.storeLogo ? (
              <img src={seller.storeLogo} alt="" className="w-10 h-10 rounded-xl object-cover" />
            ) : (
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <Store className="w-5 h-5 text-primary" />
              </div>
            )}
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold text-gray-900">{seller.storeName}</h1>
                <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${statusColors[seller.status]}`}>
                  {seller.status.charAt(0) + seller.status.slice(1).toLowerCase()}
                </span>
                {seller.warningCount > 0 && (
                  <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-red-600 bg-red-50 px-1.5 py-0.5 rounded-full">
                    <ShieldAlert className="w-3 h-3" /> {seller.warningCount}
                  </span>
                )}
              </div>
              <p className="text-sm text-gray-500">
                {seller.email} &middot; Joined {new Date(seller.createdAt).toLocaleDateString()}
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => router.push(`/admin/messages?seller=${seller.id}`)}
            className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50"
          >
            <MessageSquare className="w-4 h-4" />
            Message
          </button>
          {seller.status === "PENDING" && (
            <>
              <button
                onClick={() => setActionModal({ action: "APPROVED" })}
                className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700"
              >
                <CheckCircle className="w-4 h-4" />
                Approve
              </button>
              <button
                onClick={() => setActionModal({ action: "REJECTED" })}
                className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700"
              >
                <XCircle className="w-4 h-4" />
                Reject
              </button>
            </>
          )}
          {seller.status === "APPROVED" && (
            <button
              onClick={() => setActionModal({ action: "SUSPENDED" })}
              className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-white bg-orange-600 rounded-lg hover:bg-orange-700"
            >
              <AlertTriangle className="w-4 h-4" />
              Suspend
            </button>
          )}
          {seller.status === "SUSPENDED" && (
            <button
              onClick={() => setActionModal({ action: "APPROVED" })}
              className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700"
            >
              <CheckCircle className="w-4 h-4" />
              Reactivate
            </button>
          )}
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Tab Navigation */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100">
            <div className="flex border-b overflow-x-auto">
              {TABS.map((tab) => {
                const icons: Record<Tab, typeof Package> = {
                  Products: Package,
                  Orders: ShoppingCart,
                  Activity: Activity,
                  Settings: Settings,
                };
                const Icon = icons[tab];
                return (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`flex items-center gap-2 px-5 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                      activeTab === tab
                        ? "border-primary text-primary"
                        : "border-transparent text-gray-500 hover:text-gray-700"
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {tab}
                  </button>
                );
              })}
            </div>

            {/* Products Tab */}
            {activeTab === "Products" && (
              <div>
                <div className="p-4 border-b flex flex-col sm:flex-row gap-3">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Search products..."
                      value={productSearch}
                      onChange={(e) => { setProductSearch(e.target.value); setProductPage(1); }}
                      className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                    />
                  </div>
                  <select
                    value={productStatusFilter}
                    onChange={(e) => { setProductStatusFilter(e.target.value); setProductPage(1); }}
                    className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                  >
                    <option value="">All Statuses</option>
                    <option value="ACTIVE">Active</option>
                    <option value="DRAFT">Draft</option>
                    <option value="PENDING">Pending</option>
                    <option value="ARCHIVED">Archived</option>
                    <option value="REJECTED">Rejected</option>
                  </select>
                </div>

                {productsLoading ? (
                  <div className="flex items-center justify-center py-16">
                    <Loader2 className="w-6 h-6 animate-spin text-primary" />
                  </div>
                ) : products.length === 0 ? (
                  <div className="text-center py-16">
                    <Package className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                    <p className="text-sm text-gray-500">No products found</p>
                  </div>
                ) : (
                  <>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50 border-b">
                          <tr>
                            <th className="text-left px-4 py-3 font-medium text-gray-500">Product</th>
                            <th className="text-right px-4 py-3 font-medium text-gray-500">Price</th>
                            <th className="text-center px-4 py-3 font-medium text-gray-500">Stock</th>
                            <th className="text-center px-4 py-3 font-medium text-gray-500">Status</th>
                            <th className="text-center px-4 py-3 font-medium text-gray-500"></th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {products.map((product) => (
                            <tr key={product.id} className="hover:bg-gray-50">
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-3">
                                  {product.imageUrl ? (
                                    <img src={product.imageUrl} alt="" className="w-8 h-8 rounded-lg object-cover" />
                                  ) : (
                                    <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center">
                                      <Package className="w-4 h-4 text-gray-400" />
                                    </div>
                                  )}
                                  <span className="font-medium text-gray-900 truncate max-w-[200px]">{product.name}</span>
                                </div>
                              </td>
                              <td className="px-4 py-3 text-right text-gray-700">
                                UGX {Number(product.price).toLocaleString()}
                              </td>
                              <td className="px-4 py-3 text-center">
                                <span className={`text-sm ${product.stock <= 0 ? "text-red-600 font-medium" : "text-gray-600"}`}>
                                  {product.stock}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-center">
                                <span className={`text-xs font-medium px-2 py-1 rounded-full ${productStatusColors[product.status] || "bg-gray-100 text-gray-700"}`}>
                                  {product.status}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-center">
                                <Link
                                  href={`/admin/products/${product.id}`}
                                  className="p-1.5 text-gray-500 hover:bg-gray-100 rounded-lg inline-flex"
                                >
                                  <Eye className="w-4 h-4" />
                                </Link>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {productTotalPages > 1 && (
                      <div className="flex items-center justify-between px-4 py-3 border-t">
                        <p className="text-sm text-gray-500">Page {productPage} of {productTotalPages}</p>
                        <div className="flex gap-1">
                          <button
                            onClick={() => setProductPage((p) => Math.max(1, p - 1))}
                            disabled={productPage === 1}
                            className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <ChevronLeft className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setProductPage((p) => Math.min(productTotalPages, p + 1))}
                            disabled={productPage === productTotalPages}
                            className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
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

            {/* Orders Tab */}
            {activeTab === "Orders" && (
              <div>
                {ordersLoading ? (
                  <div className="flex items-center justify-center py-16">
                    <Loader2 className="w-6 h-6 animate-spin text-primary" />
                  </div>
                ) : orders.length === 0 ? (
                  <div className="text-center py-16">
                    <ShoppingCart className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                    <p className="text-sm text-gray-500">No orders found</p>
                  </div>
                ) : (
                  <>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50 border-b">
                          <tr>
                            <th className="text-left px-4 py-3 font-medium text-gray-500">Order</th>
                            <th className="text-left px-4 py-3 font-medium text-gray-500">Customer</th>
                            <th className="text-right px-4 py-3 font-medium text-gray-500">Amount</th>
                            <th className="text-center px-4 py-3 font-medium text-gray-500">Status</th>
                            <th className="text-center px-4 py-3 font-medium text-gray-500">Date</th>
                            <th className="text-center px-4 py-3 font-medium text-gray-500"></th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {orders.map((order) => (
                            <tr key={order.id} className="hover:bg-gray-50">
                              <td className="px-4 py-3">
                                <span className="font-medium text-gray-900">#{order.orderNumber}</span>
                              </td>
                              <td className="px-4 py-3 text-gray-600">{order.customerName}</td>
                              <td className="px-4 py-3 text-right text-gray-700 font-medium">
                                {order.currency} {Number(order.totalAmount).toLocaleString()}
                              </td>
                              <td className="px-4 py-3 text-center">
                                <span className={`text-xs font-medium px-2 py-1 rounded-full ${orderStatusColors[order.status] || "bg-gray-100 text-gray-700"}`}>
                                  {order.status}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-center text-gray-500 text-xs">
                                {new Date(order.createdAt).toLocaleDateString()}
                              </td>
                              <td className="px-4 py-3 text-center">
                                <Link
                                  href={`/admin/orders/${order.id}`}
                                  className="p-1.5 text-gray-500 hover:bg-gray-100 rounded-lg inline-flex"
                                >
                                  <Eye className="w-4 h-4" />
                                </Link>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {orderTotalPages > 1 && (
                      <div className="flex items-center justify-between px-4 py-3 border-t">
                        <p className="text-sm text-gray-500">Page {orderPage} of {orderTotalPages}</p>
                        <div className="flex gap-1">
                          <button
                            onClick={() => setOrderPage((p) => Math.max(1, p - 1))}
                            disabled={orderPage === 1}
                            className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <ChevronLeft className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setOrderPage((p) => Math.min(orderTotalPages, p + 1))}
                            disabled={orderPage === orderTotalPages}
                            className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
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

            {/* Activity Tab */}
            {activeTab === "Activity" && (
              <div className="p-6 space-y-6">
                {/* Warnings & Strikes */}
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    <ShieldAlert className="w-4 h-4" /> Warnings & Strikes
                    {warnings.length > 0 && (
                      <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full">
                        {warnings.filter((w: any) => !w.expiresAt || new Date(w.expiresAt) > new Date()).length} active
                      </span>
                    )}
                  </h3>

                  <div className="flex gap-2 mb-3">
                    <input
                      type="text"
                      value={warningReason}
                      onChange={(e) => setWarningReason(e.target.value)}
                      placeholder="Reason for warning..."
                      className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-200"
                    />
                    <button
                      onClick={issueWarning}
                      disabled={issuingWarning || !warningReason.trim()}
                      className="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 disabled:opacity-50 whitespace-nowrap"
                    >
                      {issuingWarning ? "..." : "Issue Warning"}
                    </button>
                  </div>

                  {warnings.length > 0 ? (
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {warnings.map((w: any) => {
                        const isExpired = w.expiresAt && new Date(w.expiresAt) <= new Date();
                        return (
                          <div key={w.id} className={`flex items-start gap-3 p-3 rounded-lg border text-sm ${isExpired ? "bg-gray-50 border-gray-200 opacity-60" : "bg-red-50 border-red-200"}`}>
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <span className={`text-xs font-semibold px-1.5 py-0.5 rounded ${
                                  w.type === "FINAL_WARNING" ? "bg-red-600 text-white" :
                                  w.type === "STRIKE" ? "bg-orange-500 text-white" :
                                  "bg-yellow-500 text-white"
                                }`}>{(w.type || "WARNING").replace("_", " ")}</span>
                                {isExpired && <span className="text-xs text-gray-500">Expired</span>}
                                {w.acknowledgedAt && <span className="text-xs text-green-600">Acknowledged</span>}
                              </div>
                              <p className="text-gray-700 mt-1">{w.reason}</p>
                              <p className="text-xs text-gray-400 mt-1">{new Date(w.createdAt).toLocaleDateString()}</p>
                            </div>
                            {!isExpired && (
                              <button onClick={() => expireWarning(w.id)} className="text-xs text-gray-500 hover:text-red-600 whitespace-nowrap">
                                Expire
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-400">No warnings issued</p>
                  )}
                </div>

                {/* Activity Timeline */}
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    <Activity className="w-4 h-4" /> Activity Timeline
                  </h3>
                  {activityLog.length > 0 ? (
                    <div className="space-y-3 max-h-80 overflow-y-auto pl-4 border-l-2 border-gray-200">
                      {activityLog.map((entry: any) => (
                        <div key={entry.id} className="relative">
                          <div className="absolute -left-[21px] top-1 w-2.5 h-2.5 rounded-full bg-gray-400 border-2 border-white" />
                          <p className="text-sm text-gray-700">{entry.description}</p>
                          <p className="text-xs text-gray-400 mt-0.5">
                            {new Date(entry.createdAt).toLocaleDateString()} {new Date(entry.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-400">No activity recorded</p>
                  )}
                </div>
              </div>
            )}

            {/* Settings Tab */}
            {activeTab === "Settings" && (
              <div className="p-6 space-y-6">
                {/* Commission & Auto-approve */}
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 mb-3">Seller Settings</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs text-gray-500 block mb-1">Commission Rate (%)</label>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        step="0.1"
                        value={editCommission}
                        onChange={(e) => setEditCommission(e.target.value)}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                        placeholder="Default"
                      />
                    </div>
                    <div className="flex items-end">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={editAutoApprove}
                          onChange={(e) => setEditAutoApprove(e.target.checked)}
                          className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary"
                        />
                        <span className="text-sm text-gray-700">Auto-approve products</span>
                      </label>
                    </div>
                  </div>
                  <button
                    onClick={handleSaveSettings}
                    disabled={saving}
                    className="mt-3 px-4 py-2 bg-primary text-white text-sm font-medium rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-colors"
                  >
                    {saving ? "Saving..." : "Save Settings"}
                  </button>
                </div>

                {/* Payment Info */}
                {(seller.bankName || seller.mobileMoney) && (
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900 mb-3">Payment Information</h3>
                    <div className="grid grid-cols-2 gap-4">
                      {seller.bankName && (
                        <div>
                          <p className="text-xs text-gray-500">Bank</p>
                          <p className="text-sm text-gray-700">{seller.bankName} - {seller.bankAccount}</p>
                        </div>
                      )}
                      {seller.mobileMoney && (
                        <div>
                          <p className="text-xs text-gray-500">Mobile Money</p>
                          <p className="text-sm text-gray-700">{seller.mobileMoney}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* KYC Documents */}
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 mb-3">KYC Documents</h3>
                  {seller.idDocument || seller.businessLicense ? (
                    <div className="space-y-3">
                      {seller.idDocument && (
                        <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
                          {seller.idDocument.toLowerCase().endsWith(".pdf") ? (
                            <FileText className="w-10 h-10 text-red-500 flex-shrink-0" />
                          ) : (
                            <img
                              src={seller.idDocument.startsWith("/") ? `${process.env.NEXT_PUBLIC_API_URL || ""}${seller.idDocument}` : seller.idDocument}
                              alt="National ID"
                              className="w-14 h-14 object-cover rounded-lg border border-gray-200"
                            />
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-700">National ID</p>
                            <p className="text-xs text-gray-400 truncate">{seller.idDocument.split("/").pop()}</p>
                          </div>
                          <a
                            href={seller.idDocument.startsWith("/") ? `${process.env.NEXT_PUBLIC_API_URL || ""}${seller.idDocument}` : seller.idDocument}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs text-primary hover:underline bg-primary/5 px-3 py-1.5 rounded-lg flex-shrink-0"
                          >
                            <Download className="w-3 h-3" /> View
                          </a>
                        </div>
                      )}
                      {seller.businessLicense && (
                        <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
                          {seller.businessLicense.toLowerCase().endsWith(".pdf") ? (
                            <FileText className="w-10 h-10 text-red-500 flex-shrink-0" />
                          ) : (
                            <img
                              src={seller.businessLicense.startsWith("/") ? `${process.env.NEXT_PUBLIC_API_URL || ""}${seller.businessLicense}` : seller.businessLicense}
                              alt="Business License"
                              className="w-14 h-14 object-cover rounded-lg border border-gray-200"
                            />
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-700">Business License</p>
                            <p className="text-xs text-gray-400 truncate">{seller.businessLicense.split("/").pop()}</p>
                          </div>
                          <a
                            href={seller.businessLicense.startsWith("/") ? `${process.env.NEXT_PUBLIC_API_URL || ""}${seller.businessLicense}` : seller.businessLicense}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs text-primary hover:underline bg-primary/5 px-3 py-1.5 rounded-lg flex-shrink-0"
                          >
                            <Download className="w-3 h-3" /> View
                          </a>
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-400 italic">No documents submitted</p>
                  )}
                </div>

                {/* Legacy Verification Docs */}
                {seller.verificationDocs && seller.verificationDocs.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900 mb-3">Other Verification Documents</h3>
                    <div className="flex flex-wrap gap-2">
                      {seller.verificationDocs.map((doc, i) => (
                        <a
                          key={i}
                          href={doc}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-primary hover:underline bg-primary/5 px-3 py-1.5 rounded-lg"
                        >
                          Document {i + 1}
                        </a>
                      ))}
                    </div>
                  </div>
                )}

                {/* Store Info */}
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 mb-3">Store Information</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-gray-500">Store Name</p>
                      <p className="text-sm font-medium text-gray-900">{seller.storeName}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Store Slug</p>
                      <p className="text-sm text-gray-700">{seller.storeSlug}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Email</p>
                      <p className="text-sm text-gray-700">{seller.email}</p>
                    </div>
                    {seller.phone && (
                      <div>
                        <p className="text-xs text-gray-500">Phone</p>
                        <p className="text-sm text-gray-700">{seller.phone}</p>
                      </div>
                    )}
                  </div>
                  {seller.storeDescription && (
                    <div className="mt-3">
                      <p className="text-xs text-gray-500">Description</p>
                      <p className="text-sm text-gray-700 mt-1">{seller.storeDescription}</p>
                    </div>
                  )}
                </div>

                {/* Rejection Note */}
                {seller.rejectionNote && (
                  <div className="bg-red-50 border border-red-100 rounded-lg p-4">
                    <p className="text-xs font-medium text-red-800 mb-1">Rejection Note</p>
                    <p className="text-sm text-red-700">{seller.rejectionNote}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Performance Scorecard */}
          <div className="bg-white rounded-xl border shadow-sm">
            <div className="px-6 py-4 border-b">
              <h2 className="font-semibold text-gray-900 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-gray-400" />
                Performance
              </h2>
            </div>
            <div className="p-4">
              {scorecard ? (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div className={`rounded-lg p-3 text-center ${scorecard.fulfillmentRate < 80 ? "bg-red-50 border border-red-200" : "bg-green-50"}`}>
                      <p className="text-xs text-gray-500">Fulfillment</p>
                      <p className={`text-lg font-bold ${scorecard.fulfillmentRate < 80 ? "text-red-600" : "text-green-600"}`}>{scorecard.fulfillmentRate}%</p>
                    </div>
                    <div className={`rounded-lg p-3 text-center ${scorecard.returnRate > 10 ? "bg-red-50 border border-red-200" : "bg-green-50"}`}>
                      <p className="text-xs text-gray-500">Return Rate</p>
                      <p className={`text-lg font-bold ${scorecard.returnRate > 10 ? "text-red-600" : "text-green-600"}`}>{scorecard.returnRate}%</p>
                    </div>
                    <div className={`rounded-lg p-3 text-center ${(scorecard.customerRating || 0) < 3.0 ? "bg-red-50 border border-red-200" : "bg-green-50"}`}>
                      <p className="text-xs text-gray-500">Rating</p>
                      <p className={`text-lg font-bold ${(scorecard.customerRating || 0) < 3.0 ? "text-red-600" : "text-green-600"}`}>{((scorecard.customerRating || 0)).toFixed(1)}</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-3 text-center">
                      <p className="text-xs text-gray-500">Avg Response</p>
                      <p className="text-lg font-bold text-gray-900">
                        {scorecard.responseTimeMinutes < 60 ? `${scorecard.responseTimeMinutes}m` : `${Math.round(scorecard.responseTimeMinutes / 60)}h`}
                      </p>
                    </div>
                  </div>
                  {scorecard.flags && scorecard.flags.length > 0 && (
                    <div className="mt-3 space-y-1">
                      {scorecard.flags.map((flag, i) => (
                        <p key={i} className="text-xs text-red-600 flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" /> {flag}
                        </p>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center py-4 text-gray-400 text-sm">Loading scorecard...</div>
              )}
            </div>
          </div>

          {/* Quick Stats */}
          <div className="bg-white rounded-xl border shadow-sm">
            <div className="px-6 py-4 border-b">
              <h2 className="font-semibold text-gray-900 flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-gray-400" />
                Quick Stats
              </h2>
            </div>
            <div className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500 flex items-center gap-2">
                  <Package className="w-4 h-4" /> Products
                </span>
                <span className="text-sm font-semibold text-gray-900">{seller.productCount}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500 flex items-center gap-2">
                  <ShoppingCart className="w-4 h-4" /> Orders
                </span>
                <span className="text-sm font-semibold text-gray-900">{seller.orderCount}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500 flex items-center gap-2">
                  <Star className="w-4 h-4" /> Rating
                </span>
                <span className="text-sm font-semibold text-gray-900">
                  {Number(seller.rating || 0).toFixed(1)} ({seller.reviewCount} reviews)
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500 flex items-center gap-2">
                  <DollarSign className="w-4 h-4" /> Earnings
                </span>
                <span className="text-sm font-semibold text-gray-900">
                  UGX {Number(seller.totalEarnings || 0).toLocaleString()}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500 flex items-center gap-2">
                  <DollarSign className="w-4 h-4" /> Balance
                </span>
                <span className="text-sm font-semibold text-gray-900">
                  UGX {Number(seller.balance || 0).toLocaleString()}
                </span>
              </div>
            </div>
          </div>

          {/* Store Info */}
          <div className="bg-white rounded-xl border shadow-sm">
            <div className="px-6 py-4 border-b">
              <h2 className="font-semibold text-gray-900 flex items-center gap-2">
                <Store className="w-5 h-5 text-gray-400" />
                Store Info
              </h2>
            </div>
            <div className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500 flex items-center gap-2">
                  <Globe className="w-4 h-4" /> Slug
                </span>
                <span className="text-sm text-gray-700">{seller.storeSlug}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500 flex items-center gap-2">
                  <Mail className="w-4 h-4" /> Email
                </span>
                <span className="text-sm text-gray-700 truncate max-w-[160px]">{seller.email}</span>
              </div>
              {seller.phone && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-500 flex items-center gap-2">
                    <Phone className="w-4 h-4" /> Phone
                  </span>
                  <span className="text-sm text-gray-700">{seller.phone}</span>
                </div>
              )}
              {seller.tier && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-500 flex items-center gap-2">
                    <Users className="w-4 h-4" /> Tier
                  </span>
                  <span className="text-sm text-gray-700 capitalize">{seller.tier.toLowerCase()}</span>
                </div>
              )}
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500 flex items-center gap-2">
                  <Calendar className="w-4 h-4" /> Joined
                </span>
                <span className="text-sm text-gray-700">{new Date(seller.createdAt).toLocaleDateString()}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Action Confirmation Modal */}
      {actionModal && (
        <div className="fixed inset-0 bg-black/50 z-[600] flex items-center justify-center p-4" onClick={() => setActionModal(null)}>
          <div className="bg-white rounded-2xl max-w-md w-full" onClick={(e) => e.stopPropagation()}>
            <div className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                {actionModal.action === "APPROVED" && "Approve Seller"}
                {actionModal.action === "SUSPENDED" && "Suspend Seller"}
                {actionModal.action === "REJECTED" && "Reject Seller"}
              </h3>
              <p className="text-sm text-gray-600 mb-4">
                Are you sure you want to {actionModal.action.toLowerCase()} <strong>{seller.storeName}</strong>?
              </p>

              {actionModal.action === "REJECTED" && (
                <div className="mb-4">
                  <label className="text-sm text-gray-700 block mb-1">Rejection Note</label>
                  <textarea
                    value={rejectionNote}
                    onChange={(e) => setRejectionNote(e.target.value)}
                    rows={3}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                    placeholder="Reason for rejection..."
                  />
                </div>
              )}

              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => { setActionModal(null); setRejectionNote(""); }}
                  className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleStatusChange}
                  disabled={actioning}
                  className={`px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors disabled:opacity-50 ${
                    actionModal.action === "APPROVED" ? "bg-green-600 hover:bg-green-700" :
                    actionModal.action === "SUSPENDED" ? "bg-orange-600 hover:bg-orange-700" :
                    "bg-red-600 hover:bg-red-700"
                  }`}
                >
                  {actioning ? "Processing..." : "Confirm"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
