"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { apiFetch } from "@/lib/api";
import {
  Search,
  FileText,
  DollarSign,
  CheckCircle,
  AlertCircle,
  Clock,
  Download,
  Printer,
  Eye,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  X,
  Package,
  CheckSquare,
  Square,
} from "lucide-react";

/* ─── Types ──────────────────────────────────────────── */

interface InvoiceItem {
  name: string;
  quantity: number;
  price: number;
  total: number;
  image?: string;
}

interface Invoice {
  id: string;
  invoiceNumber: string;
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  customerPhone?: string;
  shippingAddress?: {
    street?: string;
    city?: string;
    state?: string;
    zip?: string;
    country?: string;
  };
  items: InvoiceItem[];
  subtotal: number;
  shipping: number;
  discount: number;
  tax: number;
  totalAmount: number;
  currency: string;
  paymentStatus: string;
  paymentMethod?: string;
  createdAt: string;
  paidAt?: string;
  dueDate?: string;
}

interface InvoiceStats {
  total: number;
  paid: number;
  unpaid: number;
  overdue: number;
  totalRevenue: number;
}

type StatusFilter = "all" | "PAID" | "UNPAID" | "OVERDUE";

const statusConfig: Record<string, { bg: string; dot: string; label: string }> = {
  PAID: { bg: "bg-green-50 text-green-700 border-green-200", dot: "bg-green-500", label: "Paid" },
  SUCCESSFUL: { bg: "bg-green-50 text-green-700 border-green-200", dot: "bg-green-500", label: "Paid" },
  UNPAID: { bg: "bg-yellow-50 text-yellow-700 border-yellow-200", dot: "bg-yellow-500", label: "Unpaid" },
  PENDING: { bg: "bg-yellow-50 text-yellow-700 border-yellow-200", dot: "bg-yellow-500", label: "Unpaid" },
  OVERDUE: { bg: "bg-red-50 text-red-700 border-red-200", dot: "bg-red-500", label: "Overdue" },
  FAILED: { bg: "bg-red-50 text-red-700 border-red-200", dot: "bg-red-500", label: "Failed" },
};

const paymentMethodLabels: Record<string, string> = {
  MOBILE_MONEY: "Mobile Money",
  CARD: "Card",
  PAYPAL: "PayPal",
  COD: "Cash on Delivery",
  BANK_TRANSFER: "Bank Transfer",
};

const API_URL = typeof window !== "undefined" ? "" : (process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000");

/* ─── Component ──────────────────────────────────────── */

export default function AdminInvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [stats, setStats] = useState<InvoiceStats>({ total: 0, paid: 0, unpaid: 0, overdue: 0, totalRevenue: 0 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [pagination, setPagination] = useState({ total: 0, page: 1, limit: 20, totalPages: 1 });
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [previewInvoice, setPreviewInvoice] = useState<Invoice | null>(null);
  const searchTimeout = useRef<NodeJS.Timeout | null>(null);

  const normalizeStatus = (s: string): string => {
    if (s === "SUCCESSFUL") return "PAID";
    if (s === "PENDING") return "UNPAID";
    return s;
  };

  const loadInvoices = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: "20" });
      if (search) params.set("search", search);
      if (statusFilter !== "all") params.set("status", statusFilter);
      const data = await apiFetch(`/api/invoices/admin/all?${params}`);
      const list: Invoice[] = data.invoices || data.data || [];
      setInvoices(list);
      if (data.pagination) setPagination(data.pagination);
      else setPagination({ total: list.length, page: 1, limit: 20, totalPages: 1 });
      if (data.stats) {
        setStats(data.stats);
      } else {
        const paid = list.filter((i) => normalizeStatus(i.paymentStatus) === "PAID").length;
        const overdue = list.filter((i) => normalizeStatus(i.paymentStatus) === "OVERDUE").length;
        setStats({
          total: data.pagination?.total || list.length,
          paid,
          unpaid: list.length - paid - overdue,
          overdue,
          totalRevenue: list.filter((i) => normalizeStatus(i.paymentStatus) === "PAID").reduce((s, i) => s + i.totalAmount, 0),
        });
      }
    } catch (e) {
      console.error("Failed to load invoices:", e);
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter]);

  useEffect(() => {
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => loadInvoices(1), 300);
    return () => { if (searchTimeout.current) clearTimeout(searchTimeout.current); };
  }, [search, statusFilter, loadInvoices]);

  const downloadPdf = async (id: string) => {
    try {
      const res = await fetch(`${API_URL}/api/invoices/${id}/download`, { credentials: "include" });
      if (!res.ok) throw new Error("Download failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `invoice-${id}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error("PDF download error:", e);
    }
  };

  const bulkDownload = () => {
    selectedIds.forEach((id) => downloadPdf(id));
    setSelectedIds([]);
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  };

  const toggleAll = () => {
    setSelectedIds((prev) => prev.length === invoices.length ? [] : invoices.map((i) => i.id));
  };

  const handlePrint = () => {
    window.print();
  };

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

  const formatCurrency = (amount: number) => `UGX ${amount.toLocaleString()}`;

  const StatusBadge = ({ status }: { status: string }) => {
    const normalized = normalizeStatus(status);
    const cfg = statusConfig[normalized] || statusConfig.UNPAID;
    return (
      <span className={`inline-flex items-center gap-1.5 text-xs px-2 py-0.5 rounded-full border font-medium ${cfg.bg}`}>
        <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
        {cfg.label}
      </span>
    );
  };

  /* ─── Invoice Preview Modal ─────────────────────────── */

  const InvoiceModal = ({ invoice, onClose }: { invoice: Invoice; onClose: () => void }) => (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto m-4 print:m-0 print:shadow-none print:rounded-none print:max-w-none print:max-h-none"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal header (hidden on print) */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 print:hidden">
          <h2 className="text-lg font-semibold text-gray-900">Invoice Preview</h2>
          <div className="flex items-center gap-2">
            <button onClick={handlePrint} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-700">
              <Printer className="w-4 h-4" /> Print
            </button>
            <button onClick={() => downloadPdf(invoice.id)} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm bg-gray-900 text-white rounded-lg hover:bg-gray-800">
              <Download className="w-4 h-4" /> PDF
            </button>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100">
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>
        </div>

        {/* Invoice content */}
        <div className="p-6 space-y-6">
          {/* Company header */}
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">UGSEX</h1>
              <p className="text-sm text-gray-500 mt-1">Online Store</p>
            </div>
            <div className="text-right">
              <h2 className="text-xl font-semibold text-gray-900">INVOICE</h2>
              <p className="text-sm text-gray-600 mt-1">#{invoice.invoiceNumber || invoice.id.slice(0, 8).toUpperCase()}</p>
              <p className="text-sm text-gray-500">Date: {formatDate(invoice.createdAt)}</p>
              {invoice.dueDate && <p className="text-sm text-gray-500">Due: {formatDate(invoice.dueDate)}</p>}
            </div>
          </div>

          <div className="h-px bg-gray-200" />

          {/* Bill to / Order info */}
          <div className="grid grid-cols-2 gap-6">
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Bill To</p>
              <p className="text-sm font-medium text-gray-900">{invoice.customerName}</p>
              <p className="text-sm text-gray-600">{invoice.customerEmail}</p>
              {invoice.customerPhone && <p className="text-sm text-gray-600">{invoice.customerPhone}</p>}
              {invoice.shippingAddress && (
                <p className="text-sm text-gray-600 mt-1">
                  {[invoice.shippingAddress.street, invoice.shippingAddress.city, invoice.shippingAddress.state, invoice.shippingAddress.zip, invoice.shippingAddress.country]
                    .filter(Boolean).join(", ")}
                </p>
              )}
            </div>
            <div className="text-right">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Invoice Details</p>
              <p className="text-sm text-gray-600">Order: #{invoice.orderNumber}</p>
              <div className="mt-1"><StatusBadge status={invoice.paymentStatus} /></div>
              {invoice.paymentMethod && (
                <p className="text-sm text-gray-500 mt-1">{paymentMethodLabels[invoice.paymentMethod] || invoice.paymentMethod}</p>
              )}
            </div>
          </div>

          {/* Line items */}
          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50">
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase">Item</th>
                  <th className="px-4 py-2.5 text-center text-xs font-medium text-gray-500 uppercase">Qty</th>
                  <th className="px-4 py-2.5 text-right text-xs font-medium text-gray-500 uppercase">Price</th>
                  <th className="px-4 py-2.5 text-right text-xs font-medium text-gray-500 uppercase">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {(invoice.items || []).map((item, idx) => (
                  <tr key={idx}>
                    <td className="px-4 py-3 text-sm text-gray-900">{item.name}</td>
                    <td className="px-4 py-3 text-sm text-gray-600 text-center">{item.quantity}</td>
                    <td className="px-4 py-3 text-sm text-gray-600 text-right">{formatCurrency(item.price)}</td>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900 text-right">{formatCurrency(item.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Totals */}
          <div className="flex justify-end">
            <div className="w-64 space-y-1.5">
              <div className="flex justify-between text-sm text-gray-600">
                <span>Subtotal</span>
                <span>{formatCurrency(invoice.subtotal)}</span>
              </div>
              {invoice.shipping > 0 && (
                <div className="flex justify-between text-sm text-gray-600">
                  <span>Shipping</span>
                  <span>{formatCurrency(invoice.shipping)}</span>
                </div>
              )}
              {invoice.discount > 0 && (
                <div className="flex justify-between text-sm text-green-600">
                  <span>Discount</span>
                  <span>-{formatCurrency(invoice.discount)}</span>
                </div>
              )}
              {invoice.tax > 0 && (
                <div className="flex justify-between text-sm text-gray-600">
                  <span>Tax</span>
                  <span>{formatCurrency(invoice.tax)}</span>
                </div>
              )}
              <div className="h-px bg-gray-200 my-1" />
              <div className="flex justify-between text-base font-semibold text-gray-900">
                <span>Total</span>
                <span>{formatCurrency(invoice.totalAmount)}</span>
              </div>
            </div>
          </div>

          {invoice.paidAt && (
            <p className="text-xs text-gray-400 text-center pt-2">
              Paid on {formatDate(invoice.paidAt)}
            </p>
          )}
        </div>
      </div>
    </div>
  );

  /* ─── Render ───────────────────────────────────────── */

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Invoices</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {stats.total} total · {stats.paid} paid · {stats.unpaid} unpaid
          </p>
        </div>
        <div className="flex items-center gap-2">
          {selectedIds.length > 0 && (
            <button onClick={bulkDownload} className="inline-flex items-center gap-1.5 px-3 py-2 text-sm bg-gray-900 text-white rounded-lg hover:bg-gray-800">
              <Download className="w-4 h-4" /> Download {selectedIds.length}
            </button>
          )}
          <button onClick={() => loadInvoices(pagination.page)} className="inline-flex items-center gap-1.5 px-3 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-700">
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total Invoices", value: stats.total, icon: FileText, format: false },
          { label: "Paid", value: stats.paid, icon: CheckCircle, format: false },
          { label: "Unpaid", value: stats.unpaid, icon: Clock, format: false },
          { label: "Revenue (Paid)", value: stats.totalRevenue, icon: DollarSign, format: true },
        ].map((s) => (
          <div key={s.label} className="bg-white border border-gray-200 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs text-gray-500 uppercase tracking-wide">{s.label}</p>
              <s.icon className="w-4 h-4 text-gray-400" />
            </div>
            <p className="text-2xl font-semibold text-gray-900 mt-1">
              {s.format ? formatCurrency(s.value) : s.value}
            </p>
          </div>
        ))}
      </div>

      {/* Search & Filter */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-gray-300 bg-white"
            placeholder="Search by invoice #, order #, or customer..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex border border-gray-200 rounded-lg overflow-hidden text-sm">
          {(["all", "PAID", "UNPAID", "OVERDUE"] as StatusFilter[]).map((f) => (
            <button
              key={f}
              onClick={() => setStatusFilter(f)}
              className={`px-3 py-2 capitalize transition-colors ${statusFilter === f ? "bg-gray-900 text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}
            >
              {f === "all" ? "All" : f.charAt(0) + f.slice(1).toLowerCase()}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/50">
                <th className="px-4 py-3 text-left w-10">
                  <button onClick={toggleAll} className="text-gray-400 hover:text-gray-600">
                    {selectedIds.length === invoices.length && invoices.length > 0
                      ? <CheckSquare className="w-4 h-4" />
                      : <Square className="w-4 h-4" />}
                  </button>
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Invoice #</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Order #</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Customer</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Amount</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Date</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wide">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    <td colSpan={8} className="px-4 py-4">
                      <div className="h-4 bg-gray-100 rounded animate-pulse" style={{ width: `${60 + Math.random() * 30}%` }} />
                    </td>
                  </tr>
                ))
              ) : invoices.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center">
                    <FileText className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                    <p className="text-sm text-gray-500">No invoices found</p>
                    <p className="text-xs text-gray-400 mt-1">Invoices are automatically generated from orders</p>
                  </td>
                </tr>
              ) : (
                invoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-4 py-3">
                      <button onClick={() => toggleSelect(inv.id)} className="text-gray-400 hover:text-gray-600">
                        {selectedIds.includes(inv.id) ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm font-medium text-gray-900">
                        {inv.invoiceNumber || `INV-${inv.id.slice(0, 6).toUpperCase()}`}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">#{inv.orderNumber}</td>
                    <td className="px-4 py-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{inv.customerName}</p>
                        <p className="text-xs text-gray-500 truncate">{inv.customerEmail}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{formatCurrency(inv.totalAmount)}</td>
                    <td className="px-4 py-3"><StatusBadge status={inv.paymentStatus} /></td>
                    <td className="px-4 py-3 text-sm text-gray-500">{formatDate(inv.createdAt)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => setPreviewInvoice(inv)}
                          className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-gray-700"
                          title="Preview"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => downloadPdf(inv.id)}
                          className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-gray-700"
                          title="Download PDF"
                        >
                          <Download className="w-4 h-4" />
                        </button>
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
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
            <p className="text-xs text-gray-500">
              Showing {(pagination.page - 1) * pagination.limit + 1}–{Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total}
            </p>
            <div className="flex items-center gap-1">
              <button
                onClick={() => loadInvoices(pagination.page - 1)}
                disabled={pagination.page <= 1}
                className="p-1.5 rounded border border-gray-200 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              {Array.from({ length: Math.min(pagination.totalPages, 5) }, (_, i) => {
                const p = pagination.totalPages <= 5
                  ? i + 1
                  : Math.max(1, Math.min(pagination.page - 2, pagination.totalPages - 4)) + i;
                return (
                  <button
                    key={p}
                    onClick={() => loadInvoices(p)}
                    className={`w-8 h-8 text-xs rounded border transition-colors ${
                      pagination.page === p ? "bg-gray-900 text-white border-gray-900" : "border-gray-200 hover:bg-gray-50 text-gray-600"
                    }`}
                  >
                    {p}
                  </button>
                );
              })}
              <button
                onClick={() => loadInvoices(pagination.page + 1)}
                disabled={pagination.page >= pagination.totalPages}
                className="p-1.5 rounded border border-gray-200 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Invoice Preview Modal */}
      {previewInvoice && <InvoiceModal invoice={previewInvoice} onClose={() => setPreviewInvoice(null)} />}
    </div>
  );
}
