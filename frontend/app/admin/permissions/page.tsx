"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { apiFetch } from "@/lib/api";
import {
  Shield, Save, Loader2, Check, X, RefreshCw, UserCog, Search,
  Lock, Unlock, Globe, Key, Activity, AlertTriangle, ChevronDown,
  ChevronRight, ToggleLeft, ToggleRight, Zap, Eye, Server,
  Database, Users, ShieldCheck, Clock, CheckCircle, Info,
} from "lucide-react";

interface Permission {
  id: string;
  name: string;
  description: string;
  category: string;
  roles: Record<string, boolean>;
}

interface Role {
  id: string;
  name: string;
  description: string;
  editable: boolean;
  userCount: number;
}

interface PermStats {
  totalPermissions: number;
  categories: number;
  managerGranted: number;
  sellerGranted: number;
}

interface RateLimitConfig {
  windowMs: number;
  max: number;
  label: string;
  path: string;
}

interface SecurityOverview {
  rateLimiting: Record<string, RateLimitConfig>;
  securityHeaders: Record<string, any>;
  authentication: Record<string, any>;
  accessControl: Record<string, any>;
  dataIsolation: Record<string, any>;
  environment: string;
}

type TabId = "permissions" | "security" | "roles";

export default function PermissionsPage() {
  const [permissions, setPermissions] = useState<Record<string, Permission[]>>({});
  const [stats, setStats] = useState<PermStats | null>(null);
  const [roles, setRoles] = useState<Role[]>([]);
  const [changes, setChanges] = useState<Record<string, Record<string, boolean>>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>("permissions");
  const [selectedRole, setSelectedRole] = useState("MANAGER");
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [security, setSecurity] = useState<SecurityOverview | null>(null);
  const [securityLoading, setSecurityLoading] = useState(false);

  // Role assignment
  const [roleSearchEmail, setRoleSearchEmail] = useState("");
  const [roleSearchLoading, setRoleSearchLoading] = useState(false);
  const [roleSearchResult, setRoleSearchResult] = useState<{ id: string; email: string; name: string | null; role: string } | null>(null);
  const [roleSearchError, setRoleSearchError] = useState("");
  const [roleAssigning, setRoleAssigning] = useState(false);
  const [roleMessage, setRoleMessage] = useState("");

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [permsData, rolesData] = await Promise.all([
        apiFetch("/api/admin/permissions"),
        apiFetch("/api/admin/permissions/roles"),
      ]);
      setPermissions(permsData.permissions || {});
      setStats(permsData.stats || null);
      setRoles(rolesData.roles || []);
      // Expand all categories by default
      setExpandedCategories(new Set(Object.keys(permsData.permissions || {})));
    } catch (err) {
      console.error("Failed to load permissions:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchSecurity = useCallback(async () => {
    setSecurityLoading(true);
    try {
      const data = await apiFetch("/api/admin/permissions/security");
      setSecurity(data);
    } catch (err) {
      console.error("Failed to load security overview:", err);
    } finally {
      setSecurityLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => {
    if (activeTab === "security" && !security) fetchSecurity();
  }, [activeTab, security, fetchSecurity]);

  const editableRoles = useMemo(() => roles.filter(r => r.editable), [roles]);

  const getRoleValue = (perm: Permission, role: string): boolean => {
    if (changes[role]?.[perm.id] !== undefined) return changes[role][perm.id];
    return perm.roles[role] ?? false;
  };

  const togglePermission = (permId: string, role: string, currentValue: boolean) => {
    setChanges(prev => ({
      ...prev,
      [role]: { ...prev[role], [permId]: !currentValue },
    }));
  };

  const hasChanges = Object.values(changes).some(roleChanges => Object.keys(roleChanges).length > 0);

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const savePromises = Object.entries(changes).map(([role, permChanges]) => {
        const permUpdates = Object.entries(permChanges).map(([permissionId, granted]) => ({
          permissionId,
          granted,
        }));
        if (permUpdates.length === 0) return Promise.resolve();
        return apiFetch("/api/admin/permissions/role", {
          method: "PUT",
          body: JSON.stringify({ role, permissions: permUpdates }),
        });
      });

      await Promise.all(savePromises);
      setMessage({ text: "Permissions saved successfully", type: "success" });
      setChanges({});
      fetchData();
    } catch {
      setMessage({ text: "Failed to save permissions", type: "error" });
    } finally {
      setSaving(false);
    }
  };

  const toggleCategoryAll = async (category: string, role: string, grant: boolean) => {
    const permsInCat = permissions[category] || [];
    const newChanges = { ...changes };
    if (!newChanges[role]) newChanges[role] = {};
    for (const perm of permsInCat) {
      newChanges[role][perm.id] = grant;
    }
    setChanges(newChanges);
  };

  const getCategoryGrantedCount = (category: string, role: string): { granted: number; total: number } => {
    const perms = permissions[category] || [];
    const granted = perms.filter(p => getRoleValue(p, role)).length;
    return { granted, total: perms.length };
  };

  const toggleCategory = (cat: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat); else next.add(cat);
      return next;
    });
  };

  // Filter permissions by search
  const filteredCategories = useMemo(() => {
    if (!searchQuery.trim()) return Object.keys(permissions);
    const q = searchQuery.toLowerCase();
    return Object.keys(permissions).filter(cat =>
      cat.toLowerCase().includes(q) ||
      permissions[cat].some(p =>
        p.name.toLowerCase().includes(q) || p.description.toLowerCase().includes(q)
      )
    );
  }, [permissions, searchQuery]);

  const getFilteredPerms = (category: string): Permission[] => {
    if (!searchQuery.trim()) return permissions[category] || [];
    const q = searchQuery.toLowerCase();
    return (permissions[category] || []).filter(p =>
      p.name.toLowerCase().includes(q) || p.description.toLowerCase().includes(q) ||
      category.toLowerCase().includes(q)
    );
  };

  const searchUserForRole = async () => {
    setRoleSearchLoading(true);
    setRoleSearchResult(null);
    setRoleSearchError("");
    setRoleMessage("");
    try {
      const data = await apiFetch(`/api/admin/customers?search=${encodeURIComponent(roleSearchEmail)}&limit=1&includeAllRoles=true`);
      const customers = data.customers || [];
      if (customers.length === 0) {
        setRoleSearchError("No user found with that email");
        return;
      }
      const c = customers[0];
      setRoleSearchResult({ id: c.id, email: c.email, name: c.name, role: c.role || "CUSTOMER" });
    } catch {
      setRoleSearchError("Search failed");
    } finally {
      setRoleSearchLoading(false);
    }
  };

  const assignRoleToUser = async (userId: string, newRole: string) => {
    setRoleAssigning(true);
    setRoleMessage("");
    try {
      await apiFetch(`/api/admin/customers/${userId}/role`, {
        method: "PUT",
        body: JSON.stringify({ role: newRole }),
      });
      setRoleSearchResult(prev => prev ? { ...prev, role: newRole } : prev);
      setRoleMessage(`Role changed to ${newRole} successfully`);
    } catch (err: any) {
      setRoleMessage(err.message || "Failed to change role");
    } finally {
      setRoleAssigning(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Shield className="w-7 h-7 text-primary" />
            Access Control & Permissions
          </h1>
          <p className="text-gray-500 mt-1">
            Manage roles, permissions, and security across the platform
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => { fetchData(); if (security) fetchSecurity(); }}
            className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
          {hasChanges && (
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 text-sm flex items-center gap-2 disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Save Changes
            </button>
          )}
        </div>
      </div>

      {message && (
        <div className={`p-4 rounded-lg text-sm flex items-center gap-2 ${
          message.type === "success" ? "bg-green-50 text-green-700 border border-green-200" : "bg-red-50 text-red-700 border border-red-200"
        }`}>
          {message.type === "success" ? <CheckCircle className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
          {message.text}
        </div>
      )}

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl border p-4">
            <div className="flex items-center gap-2 text-gray-500 text-xs mb-1">
              <Shield className="w-3.5 h-3.5" />
              Total Permissions
            </div>
            <p className="text-2xl font-bold">{stats.totalPermissions}</p>
            <p className="text-xs text-gray-400">{stats.categories} categories</p>
          </div>
          <div className="bg-white rounded-xl border p-4">
            <div className="flex items-center gap-2 text-gray-500 text-xs mb-1">
              <Users className="w-3.5 h-3.5" />
              Roles
            </div>
            <p className="text-2xl font-bold">{roles.length}</p>
            <p className="text-xs text-gray-400">{editableRoles.length} configurable</p>
          </div>
          <div className="bg-white rounded-xl border p-4">
            <div className="flex items-center gap-2 text-purple-500 text-xs mb-1">
              <Unlock className="w-3.5 h-3.5" />
              Manager Access
            </div>
            <p className="text-2xl font-bold">{stats.managerGranted}</p>
            <p className="text-xs text-gray-400">of {stats.totalPermissions} granted</p>
          </div>
          <div className="bg-white rounded-xl border p-4">
            <div className="flex items-center gap-2 text-blue-500 text-xs mb-1">
              <Key className="w-3.5 h-3.5" />
              Seller Access
            </div>
            <p className="text-2xl font-bold">{stats.sellerGranted}</p>
            <p className="text-xs text-gray-400">of {stats.totalPermissions} granted</p>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-6">
          {([
            { id: "permissions" as TabId, label: "Permissions Matrix", icon: Shield },
            { id: "security" as TabId, label: "Security Overview", icon: Lock },
            { id: "roles" as TabId, label: "Role Management", icon: UserCog },
          ]).map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 pb-3 text-sm font-medium border-b-2 transition ${
                activeTab === tab.id
                  ? "border-primary text-primary"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === "permissions" && (
        <PermissionsMatrix
          permissions={permissions}
          roles={roles}
          selectedRole={selectedRole}
          setSelectedRole={setSelectedRole}
          editableRoles={editableRoles}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          filteredCategories={filteredCategories}
          getFilteredPerms={getFilteredPerms}
          expandedCategories={expandedCategories}
          toggleCategory={toggleCategory}
          getRoleValue={getRoleValue}
          togglePermission={togglePermission}
          toggleCategoryAll={toggleCategoryAll}
          getCategoryGrantedCount={getCategoryGrantedCount}
          changes={changes}
        />
      )}

      {activeTab === "security" && (
        <SecurityTab security={security} loading={securityLoading} />
      )}

      {activeTab === "roles" && (
        <RolesTab
          roles={roles}
          roleSearchEmail={roleSearchEmail}
          setRoleSearchEmail={setRoleSearchEmail}
          roleSearchLoading={roleSearchLoading}
          roleSearchResult={roleSearchResult}
          roleSearchError={roleSearchError}
          roleAssigning={roleAssigning}
          roleMessage={roleMessage}
          searchUserForRole={searchUserForRole}
          assignRoleToUser={assignRoleToUser}
        />
      )}

      {/* Unsaved changes banner */}
      {hasChanges && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-gray-900 text-white px-6 py-3 rounded-xl shadow-xl flex items-center gap-4 z-50">
          <AlertTriangle className="w-4 h-4 text-yellow-400" />
          <span className="text-sm">You have unsaved permission changes</span>
          <button
            onClick={() => setChanges({})}
            className="text-sm text-gray-400 hover:text-white"
          >
            Discard
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-1.5 bg-primary text-white rounded-lg text-sm hover:bg-primary/90 disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      )}
    </div>
  );
}

/* ========================= PERMISSIONS MATRIX TAB ========================= */

function PermissionsMatrix({
  permissions, roles, selectedRole, setSelectedRole, editableRoles,
  searchQuery, setSearchQuery, filteredCategories, getFilteredPerms,
  expandedCategories, toggleCategory, getRoleValue, togglePermission,
  toggleCategoryAll, getCategoryGrantedCount, changes,
}: {
  permissions: Record<string, Permission[]>;
  roles: Role[];
  selectedRole: string;
  setSelectedRole: (r: string) => void;
  editableRoles: Role[];
  searchQuery: string;
  setSearchQuery: (s: string) => void;
  filteredCategories: string[];
  getFilteredPerms: (cat: string) => Permission[];
  expandedCategories: Set<string>;
  toggleCategory: (cat: string) => void;
  getRoleValue: (perm: Permission, role: string) => boolean;
  togglePermission: (permId: string, role: string, val: boolean) => void;
  toggleCategoryAll: (cat: string, role: string, grant: boolean) => void;
  getCategoryGrantedCount: (cat: string, role: string) => { granted: number; total: number };
  changes: Record<string, Record<string, boolean>>;
}) {
  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search permissions..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>

        {/* Role selector for editing */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500">Editing:</span>
          <div className="flex rounded-lg border border-gray-300 overflow-hidden">
            {editableRoles.map(role => (
              <button
                key={role.id}
                onClick={() => setSelectedRole(role.id)}
                className={`px-4 py-2 text-sm font-medium transition ${
                  selectedRole === role.id
                    ? "bg-primary text-white"
                    : "bg-white text-gray-600 hover:bg-gray-50"
                }`}
              >
                {role.name}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Hint */}
      <div className="flex items-center gap-2 text-xs text-gray-500 bg-gray-50 px-4 py-2 rounded-lg">
        <Info className="w-3.5 h-3.5" />
        <span>Admin always has full access. Toggle permissions for <strong>{selectedRole}</strong> role below. Click category headers to expand/collapse or toggle all.</span>
      </div>

      {/* Permission categories */}
      {filteredCategories.map(category => {
        const perms = getFilteredPerms(category);
        if (perms.length === 0) return null;
        const isExpanded = expandedCategories.has(category);
        const { granted, total } = getCategoryGrantedCount(category, selectedRole);
        const allGranted = granted === total;
        const noneGranted = granted === 0;

        return (
          <div key={category} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            {/* Category header */}
            <div
              className="flex items-center justify-between px-5 py-3 bg-gray-50 border-b border-gray-200 cursor-pointer hover:bg-gray-100 transition"
              onClick={() => toggleCategory(category)}
            >
              <div className="flex items-center gap-3">
                {isExpanded ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
                <h2 className="font-semibold text-gray-700">{category}</h2>
                <span className="text-xs text-gray-400">
                  {granted}/{total} granted
                </span>
              </div>
              <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                <button
                  onClick={() => toggleCategoryAll(category, selectedRole, true)}
                  disabled={allGranted}
                  className="text-xs px-2 py-1 text-green-600 hover:bg-green-50 rounded disabled:opacity-30 disabled:cursor-not-allowed"
                  title="Grant all"
                >
                  <ToggleRight className="w-4 h-4" />
                </button>
                <button
                  onClick={() => toggleCategoryAll(category, selectedRole, false)}
                  disabled={noneGranted}
                  className="text-xs px-2 py-1 text-red-600 hover:bg-red-50 rounded disabled:opacity-30 disabled:cursor-not-allowed"
                  title="Revoke all"
                >
                  <ToggleLeft className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Permissions list */}
            {isExpanded && (
              <div className="divide-y divide-gray-50">
                {perms.map(perm => {
                  const val = getRoleValue(perm, selectedRole);
                  const isChanged = changes[selectedRole]?.[perm.id] !== undefined;

                  return (
                    <div
                      key={perm.id}
                      className={`flex items-center justify-between px-5 py-3 ${isChanged ? "bg-yellow-50" : "hover:bg-gray-50"} transition`}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium text-gray-900">{perm.description}</p>
                          {isChanged && <span className="text-xs px-1.5 py-0.5 bg-yellow-100 text-yellow-700 rounded">modified</span>}
                        </div>
                        <p className="text-xs text-gray-400 font-mono">{perm.name}</p>
                      </div>
                      <div className="flex items-center gap-6">
                        {/* Admin - always on */}
                        <div className="flex flex-col items-center gap-0.5">
                          <Check className="w-4 h-4 text-green-500" />
                          <span className="text-[10px] text-gray-400">Admin</span>
                        </div>

                        {/* Selected role toggle */}
                        <div className="flex flex-col items-center gap-0.5">
                          <button
                            onClick={() => togglePermission(perm.id, selectedRole, val)}
                            className={`w-10 h-5 rounded-full relative inline-flex items-center transition-colors ${val ? "bg-green-500" : "bg-gray-300"}`}
                          >
                            <span className={`w-4 h-4 bg-white rounded-full absolute transition-transform shadow-sm ${val ? "translate-x-5" : "translate-x-0.5"}`} />
                          </button>
                          <span className="text-[10px] text-gray-400">{selectedRole === "MANAGER" ? "Manager" : "Seller"}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}

      {filteredCategories.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          <Search className="w-8 h-8 mx-auto mb-2 text-gray-300" />
          <p>No permissions match &ldquo;{searchQuery}&rdquo;</p>
        </div>
      )}
    </div>
  );
}

/* ========================= SECURITY OVERVIEW TAB ========================= */

function SecurityTab({ security, loading }: { security: SecurityOverview | null; loading: boolean }) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!security) {
    return (
      <div className="text-center py-12 text-gray-500">
        <AlertTriangle className="w-8 h-8 mx-auto mb-2 text-gray-300" />
        <p>Failed to load security overview</p>
      </div>
    );
  }

  const formatWindow = (ms: number) => {
    if (ms >= 60000) return `${ms / 60000} min`;
    return `${ms / 1000} sec`;
  };

  return (
    <div className="space-y-6">
      {/* Environment badge */}
      <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium ${
        security.environment === "production"
          ? "bg-green-100 text-green-800"
          : "bg-yellow-100 text-yellow-800"
      }`}>
        <Server className="w-4 h-4" />
        {security.environment === "production" ? "Production Mode" : "Development Mode"}
      </div>

      {/* Rate Limiting */}
      <div className="bg-white rounded-xl border p-6">
        <h3 className="font-semibold text-gray-900 flex items-center gap-2 mb-4">
          <Zap className="w-5 h-5 text-orange-500" />
          Rate Limiting
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Object.entries(security.rateLimiting).map(([key, config]) => (
            <div key={key} className="border rounded-lg p-4 hover:border-orange-200 transition">
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium text-sm">{config.label}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full ${
                  config.max <= 10 ? "bg-red-100 text-red-700" :
                  config.max <= 50 ? "bg-yellow-100 text-yellow-700" :
                  "bg-green-100 text-green-700"
                }`}>
                  {config.max <= 10 ? "Strict" : config.max <= 50 ? "Moderate" : "Standard"}
                </span>
              </div>
              <div className="text-xs text-gray-500 space-y-1">
                <p className="font-mono">{config.path}</p>
                <p className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {config.max} requests / {formatWindow(config.windowMs)}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Security Headers */}
      <div className="bg-white rounded-xl border p-6">
        <h3 className="font-semibold text-gray-900 flex items-center gap-2 mb-4">
          <Globe className="w-5 h-5 text-blue-500" />
          Security Headers (Helmet)
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {Object.entries(security.securityHeaders).map(([key, value]) => (
            <div key={key} className="flex items-center gap-2 p-3 border rounded-lg">
              {value ? (
                <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
              ) : (
                <X className="w-4 h-4 text-gray-300 flex-shrink-0" />
              )}
              <div>
                <p className="text-sm font-medium capitalize">{key.replace(/([A-Z])/g, " $1").trim()}</p>
                <p className="text-xs text-gray-400">
                  {typeof value === "string" ? value : value ? "Enabled" : "Disabled"}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Authentication */}
      <div className="bg-white rounded-xl border p-6">
        <h3 className="font-semibold text-gray-900 flex items-center gap-2 mb-4">
          <Key className="w-5 h-5 text-purple-500" />
          Authentication
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Object.entries(security.authentication).map(([key, value]) => (
            <div key={key} className="flex items-center justify-between p-3 border rounded-lg">
              <span className="text-sm text-gray-600 capitalize">{key.replace(/([A-Z])/g, " $1").trim()}</span>
              <span className="text-sm font-medium">
                {typeof value === "boolean" ? (
                  value ? <CheckCircle className="w-4 h-4 text-green-500" /> : <X className="w-4 h-4 text-red-400" />
                ) : (
                  String(value)
                )}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Access Control */}
      <div className="bg-white rounded-xl border p-6">
        <h3 className="font-semibold text-gray-900 flex items-center gap-2 mb-4">
          <ShieldCheck className="w-5 h-5 text-green-500" />
          Access Control Model
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Object.entries(security.accessControl).map(([key, value]) => (
            <div key={key} className="flex items-center justify-between p-3 border rounded-lg">
              <span className="text-sm text-gray-600 capitalize">{key.replace(/([A-Z])/g, " $1").trim()}</span>
              <span className="text-sm font-medium">{String(value)}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Data Isolation */}
      <div className="bg-white rounded-xl border p-6">
        <h3 className="font-semibold text-gray-900 flex items-center gap-2 mb-4">
          <Database className="w-5 h-5 text-indigo-500" />
          Data Isolation
        </h3>
        <div className="space-y-4">
          {Object.entries(security.dataIsolation).map(([key, config]: [string, any]) => (
            <div key={key} className="border rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium text-sm capitalize">{key.replace(/([A-Z])/g, " $1").trim()}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                  config.status === "active" ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"
                }`}>
                  {config.status}
                </span>
              </div>
              <p className="text-xs text-gray-500">{config.method}</p>
              {config.note && <p className="text-xs text-gray-400 mt-1">{config.note}</p>}
              {config.activeSellers !== undefined && (
                <p className="text-xs text-gray-500 mt-1">Active sellers: <strong>{config.activeSellers}</strong></p>
              )}
              {config.activeKeys !== undefined && (
                <p className="text-xs text-gray-500 mt-1">Active API keys: <strong>{config.activeKeys}</strong></p>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ========================= ROLES TAB ========================= */

function RolesTab({
  roles, roleSearchEmail, setRoleSearchEmail, roleSearchLoading,
  roleSearchResult, roleSearchError, roleAssigning, roleMessage,
  searchUserForRole, assignRoleToUser,
}: {
  roles: Role[];
  roleSearchEmail: string;
  setRoleSearchEmail: (s: string) => void;
  roleSearchLoading: boolean;
  roleSearchResult: { id: string; email: string; name: string | null; role: string } | null;
  roleSearchError: string;
  roleAssigning: boolean;
  roleMessage: string;
  searchUserForRole: () => void;
  assignRoleToUser: (userId: string, newRole: string) => void;
}) {
  const roleColors: Record<string, string> = {
    ADMIN: "from-red-500 to-orange-500",
    MANAGER: "from-purple-500 to-indigo-500",
    SELLER: "from-blue-500 to-cyan-500",
    CUSTOMER: "from-gray-400 to-gray-500",
  };

  const roleIcons: Record<string, typeof Shield> = {
    ADMIN: Shield,
    MANAGER: UserCog,
    SELLER: Key,
    CUSTOMER: Users,
  };

  return (
    <div className="space-y-6">
      {/* Role cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {roles.map(role => {
          const Icon = roleIcons[role.id] || Shield;
          return (
            <div key={role.id} className="bg-white rounded-xl border p-5">
              <div className="flex items-start gap-4">
                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${roleColors[role.id] || "from-gray-400 to-gray-500"} flex items-center justify-center flex-shrink-0`}>
                  <Icon className="w-6 h-6 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-gray-900">{role.name}</h3>
                    {role.editable ? (
                      <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">Configurable</span>
                    ) : (
                      <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">Fixed</span>
                    )}
                  </div>
                  <p className="text-sm text-gray-500 mt-1">{role.description}</p>
                  <div className="flex items-center gap-1 mt-2 text-xs text-gray-400">
                    <Users className="w-3 h-3" />
                    {role.userCount} user{role.userCount !== 1 ? "s" : ""}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Role Assignment */}
      <div className="bg-white rounded-xl border p-6">
        <h2 className="font-semibold text-gray-900 mb-1 flex items-center gap-2">
          <UserCog className="w-5 h-5 text-primary" />
          Assign Role to User
        </h2>
        <p className="text-xs text-gray-500 mb-4">Search for a user by email to change their role</p>

        <div className="flex gap-3 items-end">
          <div className="flex-1">
            <label className="block text-xs font-medium text-gray-500 mb-1">User Email</label>
            <input
              type="email"
              placeholder="user@example.com"
              value={roleSearchEmail}
              onChange={(e) => setRoleSearchEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && searchUserForRole()}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <button
            onClick={searchUserForRole}
            disabled={!roleSearchEmail || roleSearchLoading}
            className="px-4 py-2 bg-gray-100 border border-gray-300 rounded-lg text-sm hover:bg-gray-200 disabled:opacity-50 flex items-center gap-2"
          >
            {roleSearchLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            Search
          </button>
        </div>

        {roleSearchResult && (
          <div className="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-sm">{roleSearchResult.name || roleSearchResult.email}</p>
                <p className="text-xs text-gray-500">{roleSearchResult.email}</p>
                <span className={`inline-block mt-1 px-2 py-0.5 rounded text-xs font-medium ${
                  roleSearchResult.role === "ADMIN" ? "bg-red-100 text-red-700" :
                  roleSearchResult.role === "MANAGER" ? "bg-purple-100 text-purple-700" :
                  roleSearchResult.role === "SELLER" ? "bg-blue-100 text-blue-700" :
                  "bg-gray-100 text-gray-600"
                }`}>
                  {roleSearchResult.role}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <select
                  value={roleSearchResult.role}
                  onChange={(e) => assignRoleToUser(roleSearchResult.id, e.target.value)}
                  disabled={roleAssigning}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-50"
                >
                  <option value="CUSTOMER">Customer</option>
                  <option value="SELLER">Seller</option>
                  <option value="MANAGER">Manager</option>
                  <option value="ADMIN">Admin</option>
                </select>
                {roleAssigning && <Loader2 className="w-4 h-4 animate-spin text-primary" />}
              </div>
            </div>
            {roleMessage && (
              <p className={`text-xs mt-2 ${roleMessage.includes("success") || roleMessage.includes("changed") ? "text-green-600" : "text-red-600"}`}>
                {roleMessage}
              </p>
            )}
          </div>
        )}

        {roleSearchError && (
          <p className="text-xs text-red-500 mt-2">{roleSearchError}</p>
        )}
      </div>

      {/* Security info */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
        <h3 className="font-semibold text-blue-900 flex items-center gap-2 text-sm">
          <Info className="w-4 h-4" />
          How Access Control Works
        </h3>
        <ul className="mt-2 space-y-1.5 text-sm text-blue-800">
          <li className="flex items-start gap-2">
            <span className="font-bold text-blue-600 mt-0.5">1.</span>
            <strong>Admin</strong> has unrestricted access to all features and data
          </li>
          <li className="flex items-start gap-2">
            <span className="font-bold text-blue-600 mt-0.5">2.</span>
            <strong>Manager</strong> access is controlled via the Permissions Matrix — toggle specific features on/off
          </li>
          <li className="flex items-start gap-2">
            <span className="font-bold text-blue-600 mt-0.5">3.</span>
            <strong>Seller</strong> data is isolated — each seller only sees their own products, orders, and payouts
          </li>
          <li className="flex items-start gap-2">
            <span className="font-bold text-blue-600 mt-0.5">4.</span>
            <strong>Customer</strong> access is limited to storefront features with user-scoped data
          </li>
        </ul>
      </div>
    </div>
  );
}
