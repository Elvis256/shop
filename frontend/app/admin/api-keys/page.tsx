"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import Link from "next/link";
import {
  Key,
  Plus,
  Search,
  Copy,
  Check,
  Trash2,
  Edit3,
  RefreshCw,
  Shield,
  Activity,
  ToggleLeft,
  ToggleRight,
  X,
  AlertTriangle,
  BookOpen,
  Eye,
  EyeOff,
} from "lucide-react";

interface ApiKeyData {
  id: string;
  name: string;
  prefix: string;
  permissions: string[];
  rateLimit: number;
  isActive: boolean;
  lastUsedAt: string | null;
  requestCount: number;
  ipWhitelist: string[];
  createdAt: string;
  expiresAt: string | null;
  key?: string;
}

const PERMISSION_GROUPS = [
  {
    label: "Products",
    permissions: [
      { value: "products:read", label: "Read" },
      { value: "products:write", label: "Write" },
    ],
  },
  {
    label: "Orders",
    permissions: [
      { value: "orders:read", label: "Read" },
      { value: "orders:write", label: "Write" },
    ],
  },
  {
    label: "Customers",
    permissions: [{ value: "customers:read", label: "Read" }],
  },
  {
    label: "Inventory",
    permissions: [
      { value: "inventory:read", label: "Read" },
      { value: "inventory:write", label: "Write" },
    ],
  },
  {
    label: "Webhooks",
    permissions: [{ value: "webhooks:read", label: "Read" }],
  },
];

const ALL_PERMISSIONS = PERMISSION_GROUPS.flatMap((g) =>
  g.permissions.map((p) => p.value)
);

function timeAgo(date: string | null) {
  if (!date) return "Never";
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export default function ApiKeysPage() {
  const [keys, setKeys] = useState<ApiKeyData[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [showEdit, setShowEdit] = useState<ApiKeyData | null>(null);
  const [newKey, setNewKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [regenConfirm, setRegenConfirm] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Form state
  const [formName, setFormName] = useState("");
  const [formPerms, setFormPerms] = useState<string[]>(["products:read"]);
  const [formRate, setFormRate] = useState(100);
  const [formIps, setFormIps] = useState("");
  const [formExpiry, setFormExpiry] = useState("");

  const loadKeys = async () => {
    try {
      const data = await apiFetch("/api/admin/api-keys");
      setKeys(data);
    } catch (e) {
      console.error("Failed to load API keys:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadKeys();
  }, []);

  const handleCreate = async () => {
    setSaving(true);
    try {
      const data = await apiFetch("/api/admin/api-keys", {
        method: "POST",
        body: JSON.stringify({
          name: formName,
          permissions: formPerms,
          rateLimit: formRate,
          ipWhitelist: formIps
            .split("\n")
            .map((s) => s.trim())
            .filter(Boolean),
          expiresAt: formExpiry || null,
        }),
      });
      setNewKey(data.key);
      setShowCreate(false);
      resetForm();
      loadKeys();
    } catch (e) {
      console.error("Failed to create key:", e);
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async () => {
    if (!showEdit) return;
    setSaving(true);
    try {
      await apiFetch(`/api/admin/api-keys/${showEdit.id}`, {
        method: "PUT",
        body: JSON.stringify({
          name: formName,
          permissions: formPerms,
          rateLimit: formRate,
          ipWhitelist: formIps
            .split("\n")
            .map((s) => s.trim())
            .filter(Boolean),
          expiresAt: formExpiry || null,
        }),
      });
      setShowEdit(null);
      resetForm();
      loadKeys();
    } catch (e) {
      console.error("Failed to update key:", e);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await apiFetch(`/api/admin/api-keys/${id}`, { method: "DELETE" });
      setDeleteConfirm(null);
      loadKeys();
    } catch (e) {
      console.error("Failed to delete key:", e);
    }
  };

  const handleToggle = async (key: ApiKeyData) => {
    try {
      await apiFetch(`/api/admin/api-keys/${key.id}`, {
        method: "PUT",
        body: JSON.stringify({ isActive: !key.isActive }),
      });
      loadKeys();
    } catch (e) {
      console.error("Failed to toggle key:", e);
    }
  };

  const handleRegenerate = async (id: string) => {
    try {
      const data = await apiFetch(`/api/admin/api-keys/${id}/regenerate`, {
        method: "POST",
      });
      setNewKey(data.key);
      setRegenConfirm(null);
      loadKeys();
    } catch (e) {
      console.error("Failed to regenerate key:", e);
    }
  };

  const resetForm = () => {
    setFormName("");
    setFormPerms(["products:read"]);
    setFormRate(100);
    setFormIps("");
    setFormExpiry("");
  };

  const openEdit = (key: ApiKeyData) => {
    setFormName(key.name);
    setFormPerms([...key.permissions]);
    setFormRate(key.rateLimit);
    setFormIps(key.ipWhitelist.join("\n"));
    setFormExpiry(
      key.expiresAt ? new Date(key.expiresAt).toISOString().slice(0, 10) : ""
    );
    setShowEdit(key);
  };

  const copyKey = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const togglePerm = (perm: string) => {
    setFormPerms((prev) =>
      prev.includes(perm) ? prev.filter((p) => p !== perm) : [...prev, perm]
    );
  };

  const filtered = keys.filter((k) =>
    k.name.toLowerCase().includes(search.toLowerCase())
  );

  const stats = {
    total: keys.length,
    active: keys.filter((k) => k.isActive).length,
    totalReqs: keys.reduce((s, k) => s + k.requestCount, 0),
    avgReqs: keys.length
      ? Math.round(
          keys.reduce((s, k) => s + k.requestCount, 0) / keys.length
        )
      : 0,
  };

  return (
    <div className="p-4 lg:p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Key className="w-6 h-6" /> API Keys
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            Manage developer API keys for external integrations
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/admin/api-keys/docs"
            className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 flex items-center gap-2"
          >
            <BookOpen className="w-4 h-4" /> API Docs
          </Link>
          <button
            onClick={() => {
              resetForm();
              setShowCreate(true);
            }}
            className="px-4 py-2 bg-black text-white rounded-lg text-sm font-medium hover:bg-gray-800 flex items-center gap-2"
          >
            <Plus className="w-4 h-4" /> Create Key
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[
          { label: "Total Keys", value: stats.total, icon: Key, color: "text-blue-600 bg-blue-50" },
          { label: "Active", value: stats.active, icon: Shield, color: "text-green-600 bg-green-50" },
          { label: "Total Requests", value: stats.totalReqs.toLocaleString(), icon: Activity, color: "text-purple-600 bg-purple-50" },
          { label: "Avg Req/Key", value: stats.avgReqs.toLocaleString(), icon: Activity, color: "text-orange-600 bg-orange-50" },
        ].map((s) => (
          <div key={s.label} className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${s.color}`}>
                <s.icon className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs text-gray-500">{s.label}</p>
                <p className="text-xl font-bold text-gray-900">{s.value}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="bg-white rounded-xl border border-gray-200 mb-6">
        <div className="p-4 border-b border-gray-100">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search keys by name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-black focus:border-transparent"
            />
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-left text-xs text-gray-500 uppercase">
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Key</th>
                <th className="px-4 py-3">Permissions</th>
                <th className="px-4 py-3">Rate Limit</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Last Used</th>
                <th className="px-4 py-3">Requests</th>
                <th className="px-4 py-3">Created</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <tr key={i} className="border-b border-gray-50">
                    {Array.from({ length: 9 }).map((_, j) => (
                      <td key={j} className="px-4 py-3">
                        <div className="h-4 bg-gray-100 rounded animate-pulse w-20" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center text-gray-400">
                    <Key className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p>No API keys found</p>
                  </td>
                </tr>
              ) : (
                filtered.map((k) => (
                  <tr key={k.id} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">{k.name}</td>
                    <td className="px-4 py-3">
                      <code className="text-xs bg-gray-100 px-2 py-1 rounded font-mono">
                        {k.prefix}
                      </code>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {k.permissions.slice(0, 3).map((p) => (
                          <span
                            key={p}
                            className="text-xs px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full"
                          >
                            {p}
                          </span>
                        ))}
                        {k.permissions.length > 3 && (
                          <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full">
                            +{k.permissions.length - 3}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{k.rateLimit}/min</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded-full font-medium ${
                          k.isActive
                            ? "bg-green-50 text-green-700"
                            : "bg-red-50 text-red-700"
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            k.isActive ? "bg-green-500" : "bg-red-500"
                          }`}
                        />
                        {k.isActive ? "Active" : "Disabled"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">
                      {timeAgo(k.lastUsedAt)}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {k.requestCount.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">
                      {new Date(k.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => openEdit(k)}
                          className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded"
                          title="Edit"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleToggle(k)}
                          className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded"
                          title={k.isActive ? "Disable" : "Enable"}
                        >
                          {k.isActive ? (
                            <ToggleRight className="w-4 h-4 text-green-600" />
                          ) : (
                            <ToggleLeft className="w-4 h-4" />
                          )}
                        </button>
                        <button
                          onClick={() => setRegenConfirm(k.id)}
                          className="p-1.5 text-gray-400 hover:text-orange-600 hover:bg-orange-50 rounded"
                          title="Regenerate"
                        >
                          <RefreshCw className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setDeleteConfirm(k.id)}
                          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
                          title="Delete"
                        >
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
      </div>

      {/* New key display */}
      {newKey && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-lg w-full p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-green-100 rounded-lg">
                <Key className="w-5 h-5 text-green-600" />
              </div>
              <h3 className="text-lg font-semibold">API Key Created</h3>
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                <p className="text-sm text-amber-800">
                  Save this key now — it won&apos;t be shown again.
                </p>
              </div>
            </div>
            <div className="bg-gray-900 rounded-lg p-4 flex items-center gap-3 mb-4">
              <code className="text-green-400 text-sm font-mono flex-1 break-all">
                {newKey}
              </code>
              <button
                onClick={() => copyKey(newKey)}
                className="p-2 text-gray-400 hover:text-white shrink-0"
              >
                {copied ? (
                  <Check className="w-4 h-4 text-green-400" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
              </button>
            </div>
            <button
              onClick={() => setNewKey(null)}
              className="w-full py-2 bg-black text-white rounded-lg text-sm font-medium hover:bg-gray-800"
            >
              Done
            </button>
          </div>
        </div>
      )}

      {/* Create/Edit Modal */}
      {(showCreate || showEdit) && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold">
                {showCreate ? "Create API Key" : "Edit API Key"}
              </h3>
              <button
                onClick={() => {
                  setShowCreate(false);
                  setShowEdit(null);
                  resetForm();
                }}
                className="p-1 hover:bg-gray-100 rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Name
                </label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g. My Mobile App"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-black focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Permissions
                </label>
                <div className="space-y-3">
                  {PERMISSION_GROUPS.map((group) => (
                    <div key={group.label}>
                      <p className="text-xs font-medium text-gray-500 mb-1">
                        {group.label}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {group.permissions.map((p) => (
                          <label
                            key={p.value}
                            className={`flex items-center gap-2 text-sm px-3 py-1.5 rounded-lg border cursor-pointer transition-colors ${
                              formPerms.includes(p.value)
                                ? "bg-blue-50 border-blue-300 text-blue-700"
                                : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50"
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={formPerms.includes(p.value)}
                              onChange={() => togglePerm(p.value)}
                              className="sr-only"
                            />
                            {p.label}
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Rate Limit (req/min)
                </label>
                <input
                  type="number"
                  value={formRate}
                  onChange={(e) => setFormRate(parseInt(e.target.value) || 100)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-black focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  IP Whitelist{" "}
                  <span className="text-gray-400 font-normal">(optional, one per line)</span>
                </label>
                <textarea
                  value={formIps}
                  onChange={(e) => setFormIps(e.target.value)}
                  rows={3}
                  placeholder="192.168.1.1&#10;10.0.0.1"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-black focus:border-transparent font-mono"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Expiry Date{" "}
                  <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                <input
                  type="date"
                  value={formExpiry}
                  onChange={(e) => setFormExpiry(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-black focus:border-transparent"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setShowCreate(false);
                  setShowEdit(null);
                  resetForm();
                }}
                className="flex-1 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={showCreate ? handleCreate : handleUpdate}
                disabled={!formName || saving}
                className="flex-1 py-2 bg-black text-white rounded-lg text-sm font-medium hover:bg-gray-800 disabled:opacity-50"
              >
                {saving ? "Saving..." : showCreate ? "Create Key" : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-sm w-full p-6 text-center">
            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Trash2 className="w-6 h-6 text-red-600" />
            </div>
            <h3 className="text-lg font-semibold mb-2">Revoke API Key?</h3>
            <p className="text-sm text-gray-500 mb-6">
              This will permanently revoke this API key. Any integrations using
              it will stop working immediately.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="flex-1 py-2 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(deleteConfirm)}
                className="flex-1 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700"
              >
                Revoke Key
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Regenerate confirmation */}
      {regenConfirm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-sm w-full p-6 text-center">
            <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <RefreshCw className="w-6 h-6 text-orange-600" />
            </div>
            <h3 className="text-lg font-semibold mb-2">Regenerate Key?</h3>
            <p className="text-sm text-gray-500 mb-6">
              The current key will be invalidated immediately. You&apos;ll
              receive a new key to use.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setRegenConfirm(null)}
                className="flex-1 py-2 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => handleRegenerate(regenConfirm)}
                className="flex-1 py-2 bg-orange-600 text-white rounded-lg text-sm font-medium hover:bg-orange-700"
              >
                Regenerate
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
