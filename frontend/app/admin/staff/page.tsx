"use client";

import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import {
  Users,
  Plus,
  Search,
  Edit2,
  Trash2,
  Shield,
  ShieldCheck,
  X,
  Save,
  Mail,
  Phone,
  Calendar,
  Activity,
  Eye,
  EyeOff,
} from "lucide-react";

interface StaffMember {
  id: string;
  email: string;
  name: string | null;
  phone: string | null;
  role: "ADMIN" | "MANAGER";
  emailVerified: boolean;
  createdAt: string;
  activityCount?: number;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export default function StaffPage() {
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState<StaffMember | null>(null);
  const [saving, setSaving] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    name: "",
    phone: "",
    role: "MANAGER" as "ADMIN" | "MANAGER",
  });

  const loadStaff = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/admin/staff`, {
        credentials: "include",
      });
      if (res.ok) {
        const data = await res.json();
        setStaff(data.staff || []);
      }
    } catch (error) {
      console.error("Failed to load staff:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStaff();
  }, []);

  const openModal = (member?: StaffMember) => {
    if (member) {
      setEditingStaff(member);
      setFormData({
        email: member.email,
        password: "",
        name: member.name || "",
        phone: member.phone || "",
        role: member.role,
      });
    } else {
      setEditingStaff(null);
      setFormData({
        email: "",
        password: "",
        name: "",
        phone: "",
        role: "MANAGER",
      });
    }
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingStaff(null);
    setShowPassword(false);
  };

  const getCsrfToken = (): string | null => {
    if (typeof document === "undefined") return null;
    const match = document.cookie.match(/csrf_token=([^;]+)/);
    return match ? match[1] : null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    const csrfToken = getCsrfToken();
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (csrfToken) headers["x-csrf-token"] = csrfToken;

    try {
      if (editingStaff) {
        const updateData: Record<string, string> = {
          name: formData.name,
          phone: formData.phone,
          role: formData.role,
        };
        if (formData.password) {
          updateData.password = formData.password;
        }

        const res = await fetch(`${API_URL}/api/admin/staff/${editingStaff.id}`, {
          method: "PUT",
          headers,
          body: JSON.stringify(updateData),
          credentials: "include",
        });

        if (!res.ok) throw new Error("Failed to update");
      } else {
        const res = await fetch(`${API_URL}/api/admin/staff`, {
          method: "POST",
          headers,
          body: JSON.stringify(formData),
          credentials: "include",
        });

        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || "Failed to create");
        }
      }

      closeModal();
      loadStaff();
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Operation failed";
      alert(errorMessage);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to remove ${name || "this staff member"}? They will be demoted to a regular customer.`)) {
      return;
    }

    const csrfToken = getCsrfToken();
    const headers: Record<string, string> = {};
    if (csrfToken) headers["x-csrf-token"] = csrfToken;

    try {
      const res = await fetch(`${API_URL}/api/admin/staff/${id}`, {
        method: "DELETE",
        headers,
        credentials: "include",
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to remove");
      }

      loadStaff();
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Failed to remove staff member";
      alert(errorMessage);
    }
  };

  const filteredStaff = staff.filter(
    (s) =>
      s.name?.toLowerCase().includes(search.toLowerCase()) ||
      s.email.toLowerCase().includes(search.toLowerCase())
  );

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">Staff Management</h1>
          <p className="text-gray-500 mt-1">Manage admin and manager accounts</p>
        </div>
        <button
          onClick={() => openModal()}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
        >
          <Plus className="w-5 h-5" />
          Add Staff Member
        </button>
      </div>

      {/* Search */}
      <div className="bg-white rounded-xl border shadow-sm p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search by name or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
          />
        </div>
      </div>

      {/* Staff List */}
      {loading ? (
        <div className="grid gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white rounded-xl border shadow-sm p-6 animate-pulse">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-gray-200 rounded-full" />
                <div className="flex-1">
                  <div className="h-5 bg-gray-200 rounded w-1/4 mb-2" />
                  <div className="h-4 bg-gray-200 rounded w-1/3" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : filteredStaff.length === 0 ? (
        <div className="bg-white rounded-xl border shadow-sm p-12 text-center">
          <Users className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h3 className="font-medium text-gray-900 mb-2">No staff members found</h3>
          <p className="text-gray-500 text-sm mb-4">
            {search ? "Try a different search" : "Add your first staff member to get started"}
          </p>
        </div>
      ) : (
        <div className="grid gap-4">
          {filteredStaff.map((member) => (
            <div
              key={member.id}
              className="bg-white rounded-xl border shadow-sm p-6 hover:shadow-md transition-shadow"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center text-white font-bold ${
                    member.role === "ADMIN"
                      ? "bg-gradient-to-br from-purple-500 to-indigo-600"
                      : "bg-gradient-to-br from-blue-500 to-cyan-600"
                  }`}>
                    {member.name?.[0]?.toUpperCase() || member.email[0].toUpperCase()}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-gray-900">
                        {member.name || "Unnamed"}
                      </h3>
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                        member.role === "ADMIN"
                          ? "bg-purple-100 text-purple-700"
                          : "bg-blue-100 text-blue-700"
                      }`}>
                        {member.role === "ADMIN" ? (
                          <ShieldCheck className="w-3 h-3" />
                        ) : (
                          <Shield className="w-3 h-3" />
                        )}
                        {member.role}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 mt-1 text-sm text-gray-500">
                      <span className="flex items-center gap-1">
                        <Mail className="w-4 h-4" />
                        {member.email}
                      </span>
                      {member.phone && (
                        <span className="flex items-center gap-1">
                          <Phone className="w-4 h-4" />
                          {member.phone}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-6">
                  <div className="text-right hidden sm:block">
                    <div className="flex items-center gap-1 text-sm text-gray-500">
                      <Calendar className="w-4 h-4" />
                      Joined {formatDate(member.createdAt)}
                    </div>
                    {member.activityCount !== undefined && (
                      <div className="flex items-center gap-1 text-sm text-gray-500 mt-1">
                        <Activity className="w-4 h-4" />
                        {member.activityCount} actions
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => openModal(member)}
                      className="p-2 text-gray-400 hover:text-primary hover:bg-primary/10 rounded-lg transition-colors"
                    >
                      <Edit2 className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => handleDelete(member.id, member.name || member.email)}
                      className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h2 className="text-lg font-semibold text-gray-900">
                {editingStaff ? "Edit Staff Member" : "Add Staff Member"}
              </h2>
              <button onClick={closeModal} className="p-2 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Full Name *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email *
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData((p) => ({ ...p, email: e.target.value }))}
                  disabled={!!editingStaff}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary disabled:bg-gray-100"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {editingStaff ? "New Password (leave blank to keep current)" : "Password *"}
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={formData.password}
                    onChange={(e) => setFormData((p) => ({ ...p, password: e.target.value }))}
                    className="w-full px-3 py-2 pr-10 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                    required={!editingStaff}
                    minLength={8}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-1">Minimum 8 characters</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Phone
                </label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData((p) => ({ ...p, phone: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Role *
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setFormData((p) => ({ ...p, role: "MANAGER" }))}
                    className={`p-4 rounded-lg border-2 transition-colors ${
                      formData.role === "MANAGER"
                        ? "border-blue-500 bg-blue-50"
                        : "border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    <Shield className={`w-6 h-6 mx-auto mb-2 ${
                      formData.role === "MANAGER" ? "text-blue-600" : "text-gray-400"
                    }`} />
                    <p className="font-medium text-gray-900">Manager</p>
                    <p className="text-xs text-gray-500 mt-1">Can manage products & orders</p>
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData((p) => ({ ...p, role: "ADMIN" }))}
                    className={`p-4 rounded-lg border-2 transition-colors ${
                      formData.role === "ADMIN"
                        ? "border-purple-500 bg-purple-50"
                        : "border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    <ShieldCheck className={`w-6 h-6 mx-auto mb-2 ${
                      formData.role === "ADMIN" ? "text-purple-600" : "text-gray-400"
                    }`} />
                    <p className="font-medium text-gray-900">Admin</p>
                    <p className="text-xs text-gray-500 mt-1">Full access to everything</p>
                  </button>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  {saving ? "Saving..." : editingStaff ? "Update" : "Create"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
