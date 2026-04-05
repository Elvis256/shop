"use client";

import { useState, useEffect, useCallback } from "react";
import { apiFetch } from "@/lib/api";
import { Shield, Save, Loader2, Check, X, RefreshCw } from "lucide-react";

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
}

export default function PermissionsPage() {
  const [permissions, setPermissions] = useState<Record<string, Permission[]>>({});
  const [roles, setRoles] = useState<Role[]>([]);
  const [changes, setChanges] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [permsRes, rolesRes] = await Promise.all([
        apiFetch("/api/admin/permissions"),
        apiFetch("/api/admin/permissions/roles"),
      ]);
      const permsData = await permsRes.json();
      const rolesData = await rolesRes.json();
      setPermissions(permsData.permissions || {});
      setRoles(rolesData.roles || []);
    } catch (err) {
      console.error("Failed to load permissions:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const togglePermission = (permId: string, currentValue: boolean) => {
    setChanges(prev => ({ ...prev, [permId]: !currentValue }));
  };

  const getManagerValue = (perm: Permission): boolean => {
    if (changes[perm.id] !== undefined) return changes[perm.id];
    return perm.roles["MANAGER"] ?? false;
  };

  const hasChanges = Object.keys(changes).length > 0;

  const handleSave = async () => {
    setSaving(true);
    setMessage("");
    try {
      const permUpdates = Object.entries(changes).map(([permissionId, granted]) => ({
        permissionId,
        granted,
      }));
      
      const res = await apiFetch("/api/admin/permissions/role", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: "MANAGER", permissions: permUpdates }),
      });
      
      if (!res.ok) throw new Error("Save failed");
      
      setMessage("Permissions saved successfully");
      setChanges({});
      fetchData();
    } catch (err) {
      setMessage("Failed to save permissions");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const categories = Object.keys(permissions);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Shield className="w-7 h-7 text-primary" />
            Roles &amp; Permissions
          </h1>
          <p className="text-gray-500 mt-1">
            Manage what each role can access. Admin always has full access.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={fetchData}
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
        <div className={`p-4 rounded-lg text-sm ${message.includes("success") ? "bg-green-50 text-green-700 border border-green-200" : "bg-red-50 text-red-700 border border-red-200"}`}>
          {message}
        </div>
      )}

      {/* Role descriptions */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {roles.map(role => (
          <div key={role.id} className={`p-4 rounded-xl border ${role.id === "ADMIN" ? "bg-primary/5 border-primary/20" : role.editable ? "bg-blue-50 border-blue-200" : "bg-gray-50 border-gray-200"}`}>
            <h3 className="font-semibold text-sm">{role.name}</h3>
            <p className="text-xs text-gray-500 mt-1">{role.description}</p>
            {role.editable && (
              <span className="inline-block mt-2 text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">Configurable</span>
            )}
          </div>
        ))}
      </div>

      {/* Permissions matrix */}
      {categories.map(category => (
        <div key={category} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="bg-gray-50 px-6 py-3 border-b border-gray-200">
            <h2 className="font-semibold text-gray-700">{category}</h2>
          </div>
          <table className="w-full">
            <thead>
              <tr className="text-xs text-gray-500 border-b border-gray-100">
                <th className="text-left px-6 py-3 font-medium">Permission</th>
                <th className="text-center px-4 py-3 font-medium">Admin</th>
                <th className="text-center px-4 py-3 font-medium">Manager</th>
                <th className="text-center px-4 py-3 font-medium">Seller</th>
                <th className="text-center px-4 py-3 font-medium">Customer</th>
              </tr>
            </thead>
            <tbody>
              {permissions[category]?.map(perm => {
                const managerVal = getManagerValue(perm);
                const isChanged = changes[perm.id] !== undefined;
                
                return (
                  <tr key={perm.id} className={`border-b border-gray-50 ${isChanged ? "bg-yellow-50" : "hover:bg-gray-50"}`}>
                    <td className="px-6 py-3">
                      <div className="text-sm font-medium text-gray-900">{perm.description}</div>
                      <div className="text-xs text-gray-400 font-mono">{perm.name}</div>
                    </td>
                    <td className="text-center px-4 py-3">
                      <Check className="w-5 h-5 text-green-500 mx-auto" />
                    </td>
                    <td className="text-center px-4 py-3">
                      <button
                        onClick={() => togglePermission(perm.id, managerVal)}
                        className={`w-8 h-5 rounded-full relative inline-flex items-center transition-colors ${managerVal ? "bg-green-500" : "bg-gray-300"}`}
                      >
                        <span className={`w-3.5 h-3.5 bg-white rounded-full absolute transition-transform ${managerVal ? "translate-x-4" : "translate-x-0.5"}`} />
                      </button>
                    </td>
                    <td className="text-center px-4 py-3">
                      <X className="w-5 h-5 text-gray-300 mx-auto" />
                    </td>
                    <td className="text-center px-4 py-3">
                      <X className="w-5 h-5 text-gray-300 mx-auto" />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ))}

      {/* Unsaved changes banner */}
      {hasChanges && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-gray-900 text-white px-6 py-3 rounded-xl shadow-xl flex items-center gap-4 z-50">
          <span className="text-sm">You have unsaved changes</span>
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
