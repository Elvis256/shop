"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { apiFetch } from "@/lib/api";
import {
  Search,
  Globe,
  Plus,
  Trash2,
  Edit2,
  Eye,
  EyeOff,
  Copy,
  CheckCircle,
  XCircle,
  AlertTriangle,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  X,
  Zap,
  Activity,
  Shield,
  ToggleLeft,
  ToggleRight,
  Code,
  Send,
  Check,
} from "lucide-react";

/* ─── Types ──────────────────────────────────────────── */

interface WebhookEndpoint {
  id: string;
  url: string;
  events: string[];
  secret: string;
  isActive: boolean;
  failCount: number;
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
}

interface WebhookRetry {
  id: string;
  provider: string;
  eventType: string;
  payload: unknown;
  attempts: number;
  maxAttempts: number;
  nextRetryAt: string;
  lastError: string | null;
  resolved: boolean;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
  endpointUrl?: string;
}

interface EndpointForm {
  url: string;
  events: string[];
}

type ActiveTab = "endpoints" | "deliveries";

const AVAILABLE_EVENTS = [
  "ORDER_CREATED", "ORDER_UPDATED", "ORDER_SHIPPED", "ORDER_DELIVERED", "ORDER_CANCELLED",
  "PAYMENT_RECEIVED", "PAYMENT_FAILED",
  "PRODUCT_CREATED", "PRODUCT_UPDATED", "STOCK_LOW",
  "CUSTOMER_CREATED",
  "RETURN_REQUESTED", "RETURN_APPROVED",
];

const eventCategoryColors: Record<string, string> = {
  ORDER: "bg-blue-50 text-blue-700 border-blue-200",
  PAYMENT: "bg-green-50 text-green-700 border-green-200",
  PRODUCT: "bg-purple-50 text-purple-700 border-purple-200",
  STOCK: "bg-orange-50 text-orange-700 border-orange-200",
  CUSTOMER: "bg-pink-50 text-pink-700 border-pink-200",
  RETURN: "bg-yellow-50 text-yellow-700 border-yellow-200",
};

function getEventColor(event: string): string {
  const category = event.split("_")[0];
  return eventCategoryColors[category] || "bg-gray-50 text-gray-700 border-gray-200";
}

/* ─── Component ──────────────────────────────────────── */

export default function AdminWebhooksPage() {
  const [activeTab, setActiveTab] = useState<ActiveTab>("endpoints");
  const [endpoints, setEndpoints] = useState<WebhookEndpoint[]>([]);
  const [retries, setRetries] = useState<WebhookRetry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [retriesSearch, setRetriesSearch] = useState("");
  const [pagination, setPagination] = useState({ total: 0, page: 1, limit: 20, totalPages: 1 });
  const [retriesPagination, setRetriesPagination] = useState({ total: 0, page: 1, limit: 20, totalPages: 1 });

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editEndpoint, setEditEndpoint] = useState<WebhookEndpoint | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [payloadView, setPayloadView] = useState<WebhookRetry | null>(null);
  const [visibleSecrets, setVisibleSecrets] = useState<Set<string>>(new Set());
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Form state
  const [form, setForm] = useState<EndpointForm>({ url: "", events: [] });
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  const searchTimeout = useRef<NodeJS.Timeout | null>(null);

  /* ─── Stats ────────────────────────────────────────── */

  const activeEndpoints = endpoints.filter((e) => e.isActive).length;
  const totalFailed = retries.filter((r) => !r.resolved).length;
  const totalResolved = retries.filter((r) => r.resolved).length;
  const successRate = totalFailed + totalResolved > 0
    ? Math.round((totalResolved / (totalFailed + totalResolved)) * 100)
    : 100;

  /* ─── Data Loading ─────────────────────────────────── */

  const loadEndpoints = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: "20" });
      if (search) params.set("search", search);
      const data = await apiFetch(`/api/webhooks/endpoints?${params}`);
      const list: WebhookEndpoint[] = data.endpoints || data.data || data || [];
      setEndpoints(Array.isArray(list) ? list : []);
      if (data.pagination) setPagination(data.pagination);
    } catch (e) {
      console.error("Failed to load endpoints:", e);
    } finally {
      setLoading(false);
    }
  }, [search]);

  const loadRetries = useCallback(async (page = 1) => {
    try {
      const params = new URLSearchParams({ page: String(page), limit: "20" });
      if (retriesSearch) params.set("search", retriesSearch);
      const data = await apiFetch(`/api/webhooks/retries?${params}`);
      const list: WebhookRetry[] = data.retries || data.data || data || [];
      setRetries(Array.isArray(list) ? list : []);
      if (data.pagination) setRetriesPagination(data.pagination);
    } catch (e) {
      console.error("Failed to load retries:", e);
    }
  }, [retriesSearch]);

  useEffect(() => {
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => {
      if (activeTab === "endpoints") loadEndpoints(1);
      else loadRetries(1);
    }, 300);
    return () => { if (searchTimeout.current) clearTimeout(searchTimeout.current); };
  }, [search, retriesSearch, activeTab, loadEndpoints, loadRetries]);

  useEffect(() => {
    loadEndpoints(1);
    loadRetries(1);
  }, []);

  /* ─── Endpoint CRUD ────────────────────────────────── */

  const saveEndpoint = async () => {
    if (!form.url.trim()) { setFormError("URL is required"); return; }
    if (form.events.length === 0) { setFormError("Select at least one event"); return; }
    try {
      new URL(form.url);
    } catch {
      setFormError("Enter a valid URL"); return;
    }
    setFormError("");
    setSaving(true);
    try {
      if (editEndpoint) {
        await apiFetch(`/api/webhooks/endpoints/${editEndpoint.id}`, {
          method: "PUT",
          body: JSON.stringify({ url: form.url, events: form.events }),
        });
      } else {
        await apiFetch("/api/webhooks/endpoints", {
          method: "POST",
          body: JSON.stringify({ url: form.url, events: form.events }),
        });
      }
      setShowCreateModal(false);
      setEditEndpoint(null);
      setForm({ url: "", events: [] });
      loadEndpoints(pagination.page);
    } catch (e) {
      setFormError("Failed to save endpoint");
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  const deleteEndpoint = async (id: string) => {
    try {
      await apiFetch(`/api/webhooks/endpoints/${id}`, { method: "DELETE" });
      setDeleteConfirm(null);
      loadEndpoints(pagination.page);
    } catch (e) {
      console.error("Delete failed:", e);
    }
  };

  const toggleEndpoint = async (ep: WebhookEndpoint) => {
    try {
      await apiFetch(`/api/webhooks/endpoints/${ep.id}`, {
        method: "PUT",
        body: JSON.stringify({ isActive: !ep.isActive }),
      });
      loadEndpoints(pagination.page);
    } catch (e) {
      console.error("Toggle failed:", e);
    }
  };

  const retryDelivery = async (id: string) => {
    try {
      await apiFetch(`/api/webhooks/retries/${id}/retry`, { method: "POST" });
      loadRetries(retriesPagination.page);
    } catch (e) {
      console.error("Retry failed:", e);
    }
  };

  const resolveDelivery = async (id: string) => {
    try {
      await apiFetch(`/api/webhooks/retries/${id}/resolve`, { method: "POST" });
      loadRetries(retriesPagination.page);
    } catch (e) {
      console.error("Resolve failed:", e);
    }
  };

  /* ─── Helpers ──────────────────────────────────────── */

  const toggleSecret = (id: string) => {
    setVisibleSecrets((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const copySecret = (id: string, secret: string) => {
    navigator.clipboard.writeText(secret);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const toggleEvent = (event: string) => {
    setForm((prev) => ({
      ...prev,
      events: prev.events.includes(event)
        ? prev.events.filter((e) => e !== event)
        : [...prev.events, event],
    }));
  };

  const openCreate = () => {
    setForm({ url: "", events: [] });
    setFormError("");
    setEditEndpoint(null);
    setShowCreateModal(true);
  };

  const openEdit = (ep: WebhookEndpoint) => {
    setForm({ url: ep.url, events: [...ep.events] });
    setFormError("");
    setEditEndpoint(ep);
    setShowCreateModal(true);
  };

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

  const formatDateTime = (d: string) =>
    new Date(d).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });

  const EventBadge = ({ event }: { event: string }) => (
    <span className={`inline-flex items-center text-xs px-1.5 py-0.5 rounded border font-medium whitespace-nowrap ${getEventColor(event)}`}>
      {event.replace(/_/g, " ")}
    </span>
  );

  /* ─── Endpoint / Delivery Modal ────────────────────── */

  const EndpointModal = () => (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => { setShowCreateModal(false); setEditEndpoint(null); }}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg m-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900">{editEndpoint ? "Edit Endpoint" : "Create Webhook Endpoint"}</h2>
          <button onClick={() => { setShowCreateModal(false); setEditEndpoint(null); }} className="p-1.5 rounded-lg hover:bg-gray-100">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>
        <div className="p-6 space-y-5">
          {/* URL */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Endpoint URL</label>
            <input
              type="url"
              value={form.url}
              onChange={(e) => setForm((prev) => ({ ...prev, url: e.target.value }))}
              placeholder="https://example.com/webhook"
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-gray-300"
            />
          </div>

          {/* Events */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Events</label>
            <p className="text-xs text-gray-500 mb-3">Select events this endpoint should receive</p>
            <div className="grid grid-cols-2 gap-2 max-h-60 overflow-y-auto">
              {AVAILABLE_EVENTS.map((event) => (
                <label key={event} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-gray-50 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.events.includes(event)}
                    onChange={() => toggleEvent(event)}
                    className="w-3.5 h-3.5 rounded border-gray-300 text-gray-900 focus:ring-gray-300"
                  />
                  <span className="text-xs text-gray-700">{event.replace(/_/g, " ")}</span>
                </label>
              ))}
            </div>
            <div className="flex gap-2 mt-2">
              <button onClick={() => setForm((p) => ({ ...p, events: [...AVAILABLE_EVENTS] }))} className="text-xs text-gray-500 hover:text-gray-700 underline">
                Select all
              </button>
              <button onClick={() => setForm((p) => ({ ...p, events: [] }))} className="text-xs text-gray-500 hover:text-gray-700 underline">
                Clear all
              </button>
            </div>
          </div>

          {formError && (
            <p className="text-sm text-red-600 flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4" /> {formError}
            </p>
          )}
        </div>
        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-gray-100">
          <button onClick={() => { setShowCreateModal(false); setEditEndpoint(null); }} className="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-700">
            Cancel
          </button>
          <button onClick={saveEndpoint} disabled={saving} className="px-4 py-2 text-sm bg-gray-900 text-white rounded-lg hover:bg-gray-800 disabled:opacity-50">
            {saving ? "Saving..." : editEndpoint ? "Update" : "Create"}
          </button>
        </div>
      </div>
    </div>
  );

  const PayloadModal = ({ retry, onClose }: { retry: WebhookRetry; onClose: () => void }) => (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-xl max-h-[80vh] m-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900">Webhook Payload</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>
        <div className="p-6 space-y-3">
          <div className="flex items-center gap-2">
            <EventBadge event={retry.eventType} />
            <span className="text-xs text-gray-500">Attempt {retry.attempts}/{retry.maxAttempts}</span>
          </div>
          <pre className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-xs text-gray-800 overflow-auto max-h-96 font-mono whitespace-pre-wrap">
            {JSON.stringify(retry.payload, null, 2)}
          </pre>
          {retry.lastError && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <p className="text-xs font-medium text-red-700">Last Error</p>
              <p className="text-xs text-red-600 mt-1">{retry.lastError}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  const DeleteConfirmModal = ({ id, onClose }: { id: string; onClose: () => void }) => (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm m-4" onClick={(e) => e.stopPropagation()}>
        <div className="p-6 text-center space-y-4">
          <div className="w-12 h-12 bg-red-50 rounded-full flex items-center justify-center mx-auto">
            <AlertTriangle className="w-6 h-6 text-red-500" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Delete Endpoint</h3>
            <p className="text-sm text-gray-500 mt-1">This action cannot be undone. The endpoint will stop receiving events immediately.</p>
          </div>
          <div className="flex items-center justify-center gap-3">
            <button onClick={onClose} className="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-700">
              Cancel
            </button>
            <button onClick={() => deleteEndpoint(id)} className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700">
              Delete
            </button>
          </div>
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
          <h1 className="text-2xl font-semibold text-gray-900">Webhooks</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {endpoints.length} endpoint{endpoints.length !== 1 ? "s" : ""} · {activeEndpoints} active
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => { loadEndpoints(pagination.page); loadRetries(retriesPagination.page); }}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-700"
          >
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
          <button onClick={openCreate} className="inline-flex items-center gap-1.5 px-3 py-2 text-sm bg-gray-900 text-white rounded-lg hover:bg-gray-800">
            <Plus className="w-4 h-4" /> Add Endpoint
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Active Endpoints", value: String(activeEndpoints), icon: Globe },
          { label: "Total Deliveries", value: String(totalFailed + totalResolved), icon: Send },
          { label: "Failed Deliveries", value: String(totalFailed), icon: AlertTriangle },
          { label: "Success Rate", value: `${successRate}%`, icon: Activity },
        ].map((s) => (
          <div key={s.label} className="bg-white border border-gray-200 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs text-gray-500 uppercase tracking-wide">{s.label}</p>
              <s.icon className="w-4 h-4 text-gray-400" />
            </div>
            <p className="text-2xl font-semibold text-gray-900 mt-1">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200">
        {(["endpoints", "deliveries"] as ActiveTab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors capitalize ${
              activeTab === tab
                ? "border-gray-900 text-gray-900"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            {tab === "deliveries" ? "Failed Deliveries" : "Endpoints"}
          </button>
        ))}
      </div>

      {/* ─── Endpoints Tab ───────────────────────────── */}
      {activeTab === "endpoints" && (
        <>
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-gray-300 bg-white"
              placeholder="Search by URL..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/50">
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">URL</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Events</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Secret</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Fails</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Created</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wide">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {loading ? (
                    Array.from({ length: 3 }).map((_, i) => (
                      <tr key={i}>
                        <td colSpan={7} className="px-4 py-4">
                          <div className="h-4 bg-gray-100 rounded animate-pulse" style={{ width: `${60 + Math.random() * 30}%` }} />
                        </td>
                      </tr>
                    ))
                  ) : endpoints.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-12 text-center">
                        <Globe className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                        <p className="text-sm text-gray-500">No webhook endpoints configured</p>
                        <p className="text-xs text-gray-400 mt-1">Add an endpoint to start receiving events</p>
                        <button onClick={openCreate} className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 text-sm bg-gray-900 text-white rounded-lg hover:bg-gray-800">
                          <Plus className="w-4 h-4" /> Add Endpoint
                        </button>
                      </td>
                    </tr>
                  ) : (
                    endpoints
                      .filter((ep) => !search || ep.url.toLowerCase().includes(search.toLowerCase()))
                      .map((ep) => (
                        <tr key={ep.id} className="hover:bg-gray-50/50 transition-colors">
                          <td className="px-4 py-3">
                            <p className="text-sm font-medium text-gray-900 truncate max-w-[200px]" title={ep.url}>{ep.url}</p>
                            {ep.lastError && (
                              <p className="text-xs text-red-500 truncate max-w-[200px] mt-0.5" title={ep.lastError}>{ep.lastError}</p>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex flex-wrap gap-1 max-w-[250px]">
                              {ep.events.slice(0, 3).map((ev) => (
                                <EventBadge key={ev} event={ev} />
                              ))}
                              {ep.events.length > 3 && (
                                <span className="inline-flex items-center text-xs px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 font-medium">
                                  +{ep.events.length - 3}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <button onClick={() => toggleEndpoint(ep)} title={ep.isActive ? "Deactivate" : "Activate"}>
                              {ep.isActive ? (
                                <span className="inline-flex items-center gap-1.5 text-xs font-medium text-green-700">
                                  <ToggleRight className="w-5 h-5" /> Active
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-400">
                                  <ToggleLeft className="w-5 h-5" /> Inactive
                                </span>
                              )}
                            </button>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1">
                              <code className="text-xs text-gray-500 font-mono">
                                {visibleSecrets.has(ep.id) ? ep.secret : "••••••••••••"}
                              </code>
                              <button onClick={() => toggleSecret(ep.id)} className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600">
                                {visibleSecrets.has(ep.id) ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                              </button>
                              <button onClick={() => copySecret(ep.id, ep.secret)} className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600">
                                {copiedId === ep.id ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                              </button>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`text-sm font-medium ${ep.failCount > 0 ? "text-red-600" : "text-gray-400"}`}>
                              {ep.failCount}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-500">{formatDate(ep.createdAt)}</td>
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-end gap-1">
                              <button onClick={() => openEdit(ep)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-gray-700" title="Edit">
                                <Edit2 className="w-4 h-4" />
                              </button>
                              <button onClick={() => setDeleteConfirm(ep.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-gray-500 hover:text-red-600" title="Delete">
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                  )}
                </tbody>
              </table>
            </div>

            {pagination.totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
                <p className="text-xs text-gray-500">
                  Showing {(pagination.page - 1) * pagination.limit + 1}–{Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total}
                </p>
                <div className="flex items-center gap-1">
                  <button onClick={() => loadEndpoints(pagination.page - 1)} disabled={pagination.page <= 1} className="p-1.5 rounded border border-gray-200 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed">
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  {Array.from({ length: Math.min(pagination.totalPages, 5) }, (_, i) => {
                    const p = pagination.totalPages <= 5 ? i + 1 : Math.max(1, Math.min(pagination.page - 2, pagination.totalPages - 4)) + i;
                    return (
                      <button key={p} onClick={() => loadEndpoints(p)} className={`w-8 h-8 text-xs rounded border transition-colors ${pagination.page === p ? "bg-gray-900 text-white border-gray-900" : "border-gray-200 hover:bg-gray-50 text-gray-600"}`}>{p}</button>
                    );
                  })}
                  <button onClick={() => loadEndpoints(pagination.page + 1)} disabled={pagination.page >= pagination.totalPages} className="p-1.5 rounded border border-gray-200 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed">
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* ─── Failed Deliveries Tab ───────────────────── */}
      {activeTab === "deliveries" && (
        <>
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-gray-300 bg-white"
              placeholder="Search by event type..."
              value={retriesSearch}
              onChange={(e) => setRetriesSearch(e.target.value)}
            />
          </div>

          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/50">
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Event</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Provider</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Error</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Attempts</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Next Retry</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Status</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wide">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {retries.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-12 text-center">
                        <CheckCircle className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                        <p className="text-sm text-gray-500">No failed deliveries</p>
                        <p className="text-xs text-gray-400 mt-1">All webhook deliveries are succeeding</p>
                      </td>
                    </tr>
                  ) : (
                    retries
                      .filter((r) => !retriesSearch || r.eventType.toLowerCase().includes(retriesSearch.toLowerCase()))
                      .map((r) => (
                        <tr key={r.id} className="hover:bg-gray-50/50 transition-colors">
                          <td className="px-4 py-3"><EventBadge event={r.eventType} /></td>
                          <td className="px-4 py-3 text-sm text-gray-600 truncate max-w-[150px]" title={r.provider}>{r.provider || "—"}</td>
                          <td className="px-4 py-3">
                            <p className="text-sm text-red-600 truncate max-w-[200px]" title={r.lastError || ""}>
                              {r.lastError || "—"}
                            </p>
                          </td>
                          <td className="px-4 py-3">
                            <span className="text-sm text-gray-700">{r.attempts}/{r.maxAttempts}</span>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-500">
                            {r.nextRetryAt ? formatDateTime(r.nextRetryAt) : "—"}
                          </td>
                          <td className="px-4 py-3">
                            {r.resolved ? (
                              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-green-700 bg-green-50 px-2 py-0.5 rounded-full border border-green-200">
                                <CheckCircle className="w-3 h-3" /> Resolved
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-red-700 bg-red-50 px-2 py-0.5 rounded-full border border-red-200">
                                <XCircle className="w-3 h-3" /> Failed
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-end gap-1">
                              <button onClick={() => setPayloadView(r)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-gray-700" title="View Payload">
                                <Code className="w-4 h-4" />
                              </button>
                              {!r.resolved && (
                                <>
                                  <button onClick={() => retryDelivery(r.id)} className="p-1.5 rounded-lg hover:bg-blue-50 text-gray-500 hover:text-blue-600" title="Retry">
                                    <RefreshCw className="w-4 h-4" />
                                  </button>
                                  <button onClick={() => resolveDelivery(r.id)} className="p-1.5 rounded-lg hover:bg-green-50 text-gray-500 hover:text-green-600" title="Mark Resolved">
                                    <CheckCircle className="w-4 h-4" />
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))
                  )}
                </tbody>
              </table>
            </div>

            {retriesPagination.totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
                <p className="text-xs text-gray-500">
                  Showing {(retriesPagination.page - 1) * retriesPagination.limit + 1}–{Math.min(retriesPagination.page * retriesPagination.limit, retriesPagination.total)} of {retriesPagination.total}
                </p>
                <div className="flex items-center gap-1">
                  <button onClick={() => loadRetries(retriesPagination.page - 1)} disabled={retriesPagination.page <= 1} className="p-1.5 rounded border border-gray-200 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed">
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  {Array.from({ length: Math.min(retriesPagination.totalPages, 5) }, (_, i) => {
                    const p = retriesPagination.totalPages <= 5 ? i + 1 : Math.max(1, Math.min(retriesPagination.page - 2, retriesPagination.totalPages - 4)) + i;
                    return (
                      <button key={p} onClick={() => loadRetries(p)} className={`w-8 h-8 text-xs rounded border transition-colors ${retriesPagination.page === p ? "bg-gray-900 text-white border-gray-900" : "border-gray-200 hover:bg-gray-50 text-gray-600"}`}>{p}</button>
                    );
                  })}
                  <button onClick={() => loadRetries(retriesPagination.page + 1)} disabled={retriesPagination.page >= retriesPagination.totalPages} className="p-1.5 rounded border border-gray-200 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed">
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* Modals */}
      {(showCreateModal || editEndpoint) && <EndpointModal />}
      {deleteConfirm && <DeleteConfirmModal id={deleteConfirm} onClose={() => setDeleteConfirm(null)} />}
      {payloadView && <PayloadModal retry={payloadView} onClose={() => setPayloadView(null)} />}
    </div>
  );
}
