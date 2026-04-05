"use client";

import { useEffect, useState, useCallback } from "react";
import { apiFetch } from "@/lib/api";
import {
  Search,
  Bell,
  BellRing,
  Users,
  UserCheck,
  UserX,
  Send,
  Trash2,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  X,
  Smartphone,
  Monitor,
  Globe,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Eye,
  Link,
  Type,
  FileText,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface Subscriber {
  id: string;
  userId: string | null;
  endpoint: string;
  p256dh: string;
  auth: string;
  createdAt: string;
  user: { id: string; name: string | null; email: string } | null;
}

interface PushStats {
  totalSubscribers: number;
  registeredSubscribers: number;
  anonymousSubscribers: number;
}

type TargetType = "all" | "registered" | "selected";

function formatDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function detectPlatform(endpoint: string): { label: string; icon: typeof Smartphone } {
  if (endpoint.includes("fcm.googleapis.com") || endpoint.includes("android"))
    return { label: "Android", icon: Smartphone };
  if (endpoint.includes("apple.com") || endpoint.includes("safari"))
    return { label: "iOS/Safari", icon: Smartphone };
  if (endpoint.includes("mozilla.com") || endpoint.includes("push.services.mozilla.com"))
    return { label: "Firefox", icon: Globe };
  if (endpoint.includes("windows") || endpoint.includes("wns"))
    return { label: "Windows", icon: Monitor };
  return { label: "Web", icon: Monitor };
}

/* ------------------------------------------------------------------ */
/*  Page Component                                                     */
/* ------------------------------------------------------------------ */

export default function AdminPushNotificationsPage() {
  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [stats, setStats] = useState<PushStats>({
    totalSubscribers: 0,
    registeredSubscribers: 0,
    anonymousSubscribers: 0,
  });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const limit = 20;

  // Compose state
  const [showCompose, setShowCompose] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [url, setUrl] = useState("");
  const [target, setTarget] = useState<TargetType>("all");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState<{ ok: boolean; message: string } | null>(null);

  // Delete state
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Confirm send modal
  const [confirmSend, setConfirmSend] = useState(false);

  useEffect(() => {
    document.title = "Push Notifications | Admin";
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [subsRes, statsRes] = await Promise.all([
        apiFetch("/api/push/admin/subscribers"),
        apiFetch("/api/push/admin/stats"),
      ]);
      setSubscribers(Array.isArray(subsRes) ? subsRes : subsRes.subscribers || []);
      if (statsRes) setStats(statsRes);
    } catch (e) {
      console.error("Failed to load push data:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSend = async () => {
    setConfirmSend(false);
    setSending(true);
    setSendResult(null);
    try {
      const payload: Record<string, unknown> = { title, body };
      if (url) payload.url = url;
      if (target === "selected") payload.subscriberIds = selectedIds;
      if (target === "registered") payload.registeredOnly = true;

      await apiFetch("/api/push/admin/send", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      setSendResult({ ok: true, message: "Notification sent successfully!" });
      setTitle("");
      setBody("");
      setUrl("");
      setTarget("all");
      setSelectedIds([]);
    } catch (e) {
      setSendResult({ ok: false, message: "Failed to send notification" });
    } finally {
      setSending(false);
    }
  };

  const handleDelete = async (id: string) => {
    setDeleting(true);
    try {
      await apiFetch(`/api/push/admin/subscribers/${id}`, { method: "DELETE" });
      setSubscribers((prev) => prev.filter((s) => s.id !== id));
      setStats((prev) => ({
        ...prev,
        totalSubscribers: prev.totalSubscribers - 1,
      }));
      setDeleteId(null);
    } catch (e) {
      console.error("Failed to delete subscriber:", e);
    } finally {
      setDeleting(false);
    }
  };

  const toggleSelectSubscriber = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  /* Filtering & search */
  const filtered = subscribers.filter((s) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      s.user?.name?.toLowerCase().includes(q) ||
      s.user?.email?.toLowerCase().includes(q) ||
      (!s.user && "anonymous".includes(q))
    );
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / limit));
  const paginated = filtered.slice((page - 1) * limit, page * limit);

  useEffect(() => {
    setPage(1);
  }, [search]);

  const recipientCount =
    target === "all"
      ? stats.totalSubscribers
      : target === "registered"
        ? stats.registeredSubscribers
        : selectedIds.length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Push Notifications</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Manage subscribers and send push notifications
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setShowCompose(!showCompose);
              setSendResult(null);
            }}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm bg-gray-900 text-white rounded-lg hover:bg-gray-800"
          >
            <BellRing className="w-4 h-4" /> Compose
          </button>
          <button
            onClick={loadData}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-700"
          >
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {[
          { label: "Total Subscribers", value: stats.totalSubscribers, icon: Users },
          { label: "Registered Users", value: stats.registeredSubscribers, icon: UserCheck },
          { label: "Anonymous", value: stats.anonymousSubscribers, icon: UserX },
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

      {/* Compose Panel */}
      {showCompose && (
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Compose Notification</h2>
            <button
              onClick={() => setShowCompose(false)}
              className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-gray-600"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Form */}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <Type className="w-3.5 h-3.5 inline mr-1" />
                  Title *
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Notification title"
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-gray-300"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <FileText className="w-3.5 h-3.5 inline mr-1" />
                  Body *
                </label>
                <textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder="Notification message..."
                  rows={3}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-gray-300 resize-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <Link className="w-3.5 h-3.5 inline mr-1" />
                  URL (optional)
                </label>
                <input
                  type="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://example.com/page"
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-gray-300"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Target</label>
                <div className="flex border border-gray-200 rounded-lg overflow-hidden text-sm">
                  {([
                    { key: "all", label: "All Subscribers" },
                    { key: "registered", label: "Registered Only" },
                    { key: "selected", label: "Select Users" },
                  ] as { key: TargetType; label: string }[]).map((t) => (
                    <button
                      key={t.key}
                      onClick={() => setTarget(t.key)}
                      className={`flex-1 px-3 py-2 transition-colors ${
                        target === t.key
                          ? "bg-gray-900 text-white"
                          : "bg-white text-gray-600 hover:bg-gray-50"
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
                {target === "selected" && (
                  <p className="text-xs text-gray-500 mt-2">
                    {selectedIds.length} subscriber{selectedIds.length !== 1 ? "s" : ""} selected.
                    Use the table below to select recipients.
                  </p>
                )}
              </div>

              {sendResult && (
                <div
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm ${
                    sendResult.ok
                      ? "bg-green-50 text-green-700 border border-green-200"
                      : "bg-red-50 text-red-700 border border-red-200"
                  }`}
                >
                  {sendResult.ok ? (
                    <CheckCircle2 className="w-4 h-4" />
                  ) : (
                    <AlertCircle className="w-4 h-4" />
                  )}
                  {sendResult.message}
                </div>
              )}

              <button
                onClick={() => setConfirmSend(true)}
                disabled={!title.trim() || !body.trim() || (target === "selected" && selectedIds.length === 0) || sending}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-sm bg-gray-900 text-white rounded-lg hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {sending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
                Send to {recipientCount} subscriber{recipientCount !== 1 ? "s" : ""}
              </button>
            </div>

            {/* Preview */}
            <div>
              <p className="text-sm font-medium text-gray-700 mb-2">Preview</p>
              <div className="bg-gray-100 rounded-lg p-4">
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 max-w-sm">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 bg-gray-900 rounded-lg flex items-center justify-center shrink-0">
                      <Bell className="w-5 h-5 text-white" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-gray-900 truncate">
                        {title || "Notification Title"}
                      </p>
                      <p className="text-xs text-gray-600 mt-0.5 line-clamp-3">
                        {body || "Notification body text will appear here..."}
                      </p>
                      {url && (
                        <p className="text-xs text-blue-500 mt-1 truncate">{url}</p>
                      )}
                      <p className="text-[10px] text-gray-400 mt-2">now</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Search */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-gray-300 bg-white"
            placeholder="Search by name or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Subscribers Table */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/50">
                {target === "selected" && (
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide w-10">
                    Select
                  </th>
                )}
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
                  User
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
                  Email
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
                  Platform
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
                  Subscribed
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wide">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    <td colSpan={target === "selected" ? 6 : 5} className="px-4 py-4">
                      <div
                        className="h-4 bg-gray-100 rounded animate-pulse"
                        style={{ width: `${60 + Math.random() * 30}%` }}
                      />
                    </td>
                  </tr>
                ))
              ) : paginated.length === 0 ? (
                <tr>
                  <td colSpan={target === "selected" ? 6 : 5} className="px-4 py-12 text-center">
                    <Bell className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                    <p className="text-sm text-gray-500">No subscribers found</p>
                    <p className="text-xs text-gray-400 mt-1">
                      Subscribers appear here when users enable push notifications
                    </p>
                  </td>
                </tr>
              ) : (
                paginated.map((sub) => {
                  const platform = detectPlatform(sub.endpoint);
                  const PlatformIcon = platform.icon;
                  return (
                    <tr key={sub.id} className="hover:bg-gray-50/50 transition-colors">
                      {target === "selected" && (
                        <td className="px-4 py-3">
                          <input
                            type="checkbox"
                            checked={selectedIds.includes(sub.id)}
                            onChange={() => toggleSelectSubscriber(sub.id)}
                            className="w-4 h-4 rounded border-gray-300 text-gray-900 focus:ring-gray-900"
                          />
                        </td>
                      )}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium shrink-0 ${
                              sub.user
                                ? "bg-gray-900 text-white"
                                : "bg-gray-100 text-gray-400"
                            }`}
                          >
                            {sub.user
                              ? (sub.user.name?.[0] || sub.user.email[0]).toUpperCase()
                              : "?"}
                          </div>
                          <p className="text-sm font-medium text-gray-900">
                            {sub.user?.name || "Anonymous"}
                          </p>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">
                        {sub.user?.email || "—"}
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1 text-xs text-gray-600 bg-gray-50 px-2 py-0.5 rounded border border-gray-200">
                          <PlatformIcon className="w-3 h-3" />
                          {platform.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">
                        {formatDate(sub.createdAt)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => setDeleteId(sub.id)}
                          className="text-xs text-red-500 hover:text-red-700 underline-offset-2 hover:underline"
                        >
                          <Trash2 className="w-3.5 h-3.5 inline" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
            <p className="text-xs text-gray-500">
              Showing {(page - 1) * limit + 1}–{Math.min(page * limit, filtered.length)} of{" "}
              {filtered.length}
            </p>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="p-1.5 rounded border border-gray-200 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                const p =
                  totalPages <= 5
                    ? i + 1
                    : Math.max(1, Math.min(page - 2, totalPages - 4)) + i;
                return (
                  <button
                    key={p}
                    onClick={() => setPage(p)}
                    className={`w-8 h-8 text-xs rounded border transition-colors ${
                      page === p
                        ? "bg-gray-900 text-white border-gray-900"
                        : "border-gray-200 hover:bg-gray-50 text-gray-600"
                    }`}
                  >
                    {p}
                  </button>
                );
              })}
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="p-1.5 rounded border border-gray-200 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {deleteId && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-sm w-full p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-red-50 rounded-full flex items-center justify-center">
                <AlertCircle className="w-5 h-5 text-red-500" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-gray-900">Delete Subscriber</h3>
                <p className="text-sm text-gray-500">This action cannot be undone.</p>
              </div>
            </div>
            <p className="text-sm text-gray-600 mb-5">
              The subscriber will be removed and will no longer receive push notifications. They can
              re-subscribe by enabling notifications again.
            </p>
            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => setDeleteId(null)}
                className="px-3 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-700"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(deleteId)}
                disabled={deleting}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Send Confirmation Modal */}
      {confirmSend && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-sm w-full p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-blue-50 rounded-full flex items-center justify-center">
                <Send className="w-5 h-5 text-blue-500" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-gray-900">Send Notification</h3>
                <p className="text-sm text-gray-500">Confirm before sending</p>
              </div>
            </div>
            <div className="bg-gray-50 rounded-lg p-3 mb-4 text-sm">
              <p className="font-medium text-gray-900">{title}</p>
              <p className="text-gray-600 mt-1">{body}</p>
              {url && <p className="text-blue-500 text-xs mt-1">{url}</p>}
            </div>
            <p className="text-sm text-gray-600 mb-5">
              This will send a push notification to{" "}
              <strong>{recipientCount}</strong> subscriber{recipientCount !== 1 ? "s" : ""}.
            </p>
            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => setConfirmSend(false)}
                className="px-3 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-700"
              >
                Cancel
              </button>
              <button
                onClick={handleSend}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-sm bg-gray-900 text-white rounded-lg hover:bg-gray-800"
              >
                <Send className="w-4 h-4" /> Send Now
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
