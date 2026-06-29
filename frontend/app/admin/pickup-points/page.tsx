"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import {
  MapPin,
  Plus,
  Edit,
  Trash2,
  X,
  Loader2,
  ToggleLeft,
  ToggleRight,
  Package,
} from "lucide-react";

interface PickupPoint {
  id: string;
  name: string;
  address: string;
  city: string;
  county: string;
  hours: string;
  phone: string;
  type: string;
  isActive: boolean;
  lat: number | null;
  lng: number | null;
  createdAt: string;
}

const EMPTY_FORM = {
  name: "",
  address: "",
  city: "",
  county: "",
  hours: "",
  phone: "",
  type: "Agent",
  isActive: true,
  lat: "",
  lng: "",
};

const TYPES = ["Agent", "Mall Locker", "Post Office", "Pickup Center"];

const inputClass =
  "w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10 focus:border-gray-400";

export default function AdminPickupPointsPage() {
  const [points, setPoints] = useState<PickupPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [showPanel, setShowPanel] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);
  const [seeding, setSeeding] = useState(false);

  const fetchPoints = async () => {
    try {
      const data = await apiFetch("/api/admin/pickup-points");
      setPoints(Array.isArray(data) ? data : []);
    } catch {
      setPoints([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPoints();
  }, []);

  const openAdd = () => {
    setEditingId(null);
    setForm({ ...EMPTY_FORM });
    setShowPanel(true);
  };

  const openEdit = (p: PickupPoint) => {
    setEditingId(p.id);
    setForm({
      name: p.name,
      address: p.address,
      city: p.city,
      county: p.county,
      hours: p.hours,
      phone: p.phone,
      type: p.type,
      isActive: p.isActive,
      lat: p.lat != null ? String(p.lat) : "",
      lng: p.lng != null ? String(p.lng) : "",
    });
    setShowPanel(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = {
        ...form,
        lat: form.lat ? parseFloat(form.lat) : null,
        lng: form.lng ? parseFloat(form.lng) : null,
      };
      if (editingId) {
        await apiFetch(`/api/admin/pickup-points/${editingId}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        });
      } else {
        await apiFetch("/api/admin/pickup-points", {
          method: "POST",
          body: JSON.stringify(payload),
        });
      }
      setShowPanel(false);
      fetchPoints();
    } catch (err: any) {
      alert(err?.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Deactivate this pickup point?")) return;
    try {
      await apiFetch(`/api/admin/pickup-points/${id}`, { method: "DELETE" });
      fetchPoints();
    } catch {}
  };

  const handleToggle = async (p: PickupPoint) => {
    try {
      await apiFetch(`/api/admin/pickup-points/${p.id}`, {
        method: "PUT",
        body: JSON.stringify({ isActive: !p.isActive }),
      });
      fetchPoints();
    } catch {}
  };

  const handleSeed = async () => {
    setSeeding(true);
    try {
      await apiFetch("/api/admin/pickup-points/seed", { method: "POST" });
      fetchPoints();
    } catch (err: any) {
      alert(err?.message || "Seed failed");
    } finally {
      setSeeding(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Pickup Points</h1>
          <p className="text-sm text-gray-500 mt-1">
            Manage collection points where customers can pick up orders
          </p>
        </div>
        <div className="flex gap-2">
          {points.length === 0 && (
            <button
              onClick={handleSeed}
              disabled={seeding}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
            >
              {seeding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Package className="w-4 h-4" />}
              Seed Defaults
            </button>
          )}
          <button
            onClick={openAdd}
            className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800"
          >
            <Plus className="w-4 h-4" />
            Add Point
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white border rounded-xl p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Total</p>
          <p className="text-2xl font-bold mt-1">{points.length}</p>
        </div>
        <div className="bg-white border rounded-xl p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Active</p>
          <p className="text-2xl font-bold mt-1 text-green-600">{points.filter(p => p.isActive).length}</p>
        </div>
        <div className="bg-white border rounded-xl p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Cities</p>
          <p className="text-2xl font-bold mt-1">{new Set(points.map(p => p.city)).size}</p>
        </div>
        <div className="bg-white border rounded-xl p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Inactive</p>
          <p className="text-2xl font-bold mt-1 text-gray-400">{points.filter(p => !p.isActive).length}</p>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Name</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">City</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 hidden md:table-cell">Type</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 hidden lg:table-cell">Hours</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 hidden lg:table-cell">Phone</th>
                <th className="text-center px-4 py-3 font-medium text-gray-600">Active</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {points.map((p) => (
                <tr key={p.id} className={`hover:bg-gray-50 ${!p.isActive ? "opacity-50" : ""}`}>
                  <td className="px-4 py-3">
                    <div className="font-medium">{p.name}</div>
                    <div className="text-xs text-gray-500">{p.address}</div>
                  </td>
                  <td className="px-4 py-3">{p.city}</td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full bg-gray-100 text-gray-700">
                      {p.type}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500 hidden lg:table-cell">{p.hours}</td>
                  <td className="px-4 py-3 text-xs hidden lg:table-cell">{p.phone}</td>
                  <td className="px-4 py-3 text-center">
                    <button onClick={() => handleToggle(p)} className="text-gray-500 hover:text-gray-700">
                      {p.isActive ? (
                        <ToggleRight className="w-6 h-6 text-green-500" />
                      ) : (
                        <ToggleLeft className="w-6 h-6 text-gray-400" />
                      )}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => openEdit(p)} className="p-1.5 hover:bg-gray-100 rounded-lg" title="Edit">
                        <Edit className="w-4 h-4 text-gray-500" />
                      </button>
                      <button onClick={() => handleDelete(p.id)} className="p-1.5 hover:bg-red-50 rounded-lg" title="Deactivate">
                        <Trash2 className="w-4 h-4 text-red-400" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {points.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-gray-400">
                    <MapPin className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p>No pickup points yet. Click &quot;Seed Defaults&quot; to add the default set.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add/Edit Panel */}
      {showPanel && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="font-semibold">{editingId ? "Edit Pickup Point" : "Add Pickup Point"}</h2>
              <button onClick={() => setShowPanel(false)} className="p-1 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Name *</label>
                <input className={inputClass} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Address *</label>
                <input className={inputClass} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">City *</label>
                  <input className={inputClass} value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">County *</label>
                  <input className={inputClass} value={form.county} onChange={(e) => setForm({ ...form, county: e.target.value })} />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Type</label>
                <select
                  className={inputClass}
                  value={form.type}
                  onChange={(e) => setForm({ ...form, type: e.target.value })}
                >
                  {TYPES.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Hours *</label>
                <input className={inputClass} placeholder="Mon-Sat 8:00 AM - 6:00 PM" value={form.hours} onChange={(e) => setForm({ ...form, hours: e.target.value })} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Phone *</label>
                <input className={inputClass} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Latitude</label>
                  <input className={inputClass} type="number" step="any" value={form.lat} onChange={(e) => setForm({ ...form, lat: e.target.value })} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Longitude</label>
                  <input className={inputClass} type="number" step="any" value={form.lng} onChange={(e) => setForm({ ...form, lng: e.target.value })} />
                </div>
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                  className="accent-gray-900"
                />
                <span className="text-sm">Active</span>
              </label>
            </div>
            <div className="flex justify-end gap-2 p-4 border-t">
              <button onClick={() => setShowPanel(false)} className="px-4 py-2 text-sm border rounded-lg hover:bg-gray-50">
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !form.name || !form.address || !form.city || !form.county || !form.hours || !form.phone}
                className="px-4 py-2 text-sm bg-gray-900 text-white rounded-lg hover:bg-gray-800 disabled:opacity-50 flex items-center gap-2"
              >
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                {editingId ? "Update" : "Create"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
