"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Plus, Edit, Trash2, MapPin, X, Globe } from "lucide-react";

interface ShippingZone {
  id: string;
  name: string;
  countries: string[];
  cities: string[];
  rate: number;
  currency: string;
  freeAbove: number | null;
  estimatedDays: string | null;
  isActive: boolean;
  createdAt: string;
}

const emptyForm = {
  name: "",
  countries: "",
  cities: "",
  rate: 0,
  currency: "UGX",
  freeAbove: "",
  estimatedDays: "",
  isActive: true,
};

export default function AdminShippingPage() {
  const [zones, setZones] = useState<ShippingZone[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [saving, setSaving] = useState(false);

  const loadZones = () => {
    setLoading(true);
    api.admin.getShippingZones()
      .then((data) => setZones(data.zones))
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadZones(); }, []);

  const openNew = () => {
    setForm({ ...emptyForm });
    setEditingId(null);
    setShowForm(true);
  };

  const openEdit = (zone: ShippingZone) => {
    setForm({
      name: zone.name,
      countries: zone.countries.join(", "),
      cities: zone.cities.join(", "),
      rate: zone.rate,
      currency: zone.currency,
      freeAbove: zone.freeAbove != null ? String(zone.freeAbove) : "",
      estimatedDays: zone.estimatedDays || "",
      isActive: zone.isActive,
    });
    setEditingId(zone.id);
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const payload = {
      name: form.name,
      countries: form.countries.split(",").map((s) => s.trim()).filter(Boolean),
      cities: form.cities.split(",").map((s) => s.trim()).filter(Boolean),
      rate: Number(form.rate),
      currency: form.currency,
      freeAbove: form.freeAbove ? Number(form.freeAbove) : null,
      estimatedDays: form.estimatedDays || null,
      isActive: form.isActive,
    };
    try {
      if (editingId) {
        await api.admin.updateShippingZone(editingId, payload);
      } else {
        await api.admin.createShippingZone(payload);
      }
      setShowForm(false);
      loadZones();
    } catch (err) {
      console.error(err);
      alert("Failed to save shipping zone");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this shipping zone?")) return;
    await api.admin.deleteShippingZone(id);
    loadZones();
  };

  const handleToggle = async (zone: ShippingZone) => {
    await api.admin.updateShippingZone(zone.id, { isActive: !zone.isActive });
    loadZones();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Shipping Zones</h1>
          <p className="text-text-muted">Configure shipping rates by region</p>
        </div>
        <button onClick={openNew} className="btn-primary gap-2 flex items-center">
          <Plus className="w-4 h-4" />
          Add Zone
        </button>
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg">
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="text-lg font-semibold">{editingId ? "Edit" : "New"} Shipping Zone</h2>
              <button onClick={() => setShowForm(false)} className="p-1 hover:bg-gray-100 rounded">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Zone Name *</label>
                <input className="input w-full" placeholder="e.g. Kampala, Upcountry" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Countries (comma-separated)</label>
                  <input className="input w-full" placeholder="UG, KE, TZ" value={form.countries} onChange={(e) => setForm({ ...form, countries: e.target.value })} />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Cities (comma-separated)</label>
                  <input className="input w-full" placeholder="Kampala, Entebbe" value={form.cities} onChange={(e) => setForm({ ...form, cities: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Shipping Rate *</label>
                  <input className="input w-full" type="number" min="0" step="100" required value={form.rate} onChange={(e) => setForm({ ...form, rate: Number(e.target.value) })} />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Currency</label>
                  <input className="input w-full" value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Free Shipping Above</label>
                  <input className="input w-full" type="number" min="0" placeholder="Leave blank to disable" value={form.freeAbove} onChange={(e) => setForm({ ...form, freeAbove: e.target.value })} />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Estimated Days</label>
                  <input className="input w-full" placeholder="1-2 days" value={form.estimatedDays} onChange={(e) => setForm({ ...form, estimatedDays: e.target.value })} />
                </div>
              </div>
              <label className="flex items-center gap-3 cursor-pointer">
                <input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} className="w-4 h-4" />
                <span className="text-sm">Active</span>
              </label>
              <div className="flex gap-3 pt-2">
                <button type="submit" disabled={saving} className="btn-primary flex-1">
                  {saving ? "Saving..." : editingId ? "Update Zone" : "Create Zone"}
                </button>
                <button type="button" onClick={() => setShowForm(false)} className="btn-secondary flex-1">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Zones List */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => <div key={i} className="h-40 bg-gray-100 rounded-xl animate-pulse" />)}
        </div>
      ) : zones.length === 0 ? (
        <div className="bg-white rounded-xl border p-12 text-center">
          <Globe className="w-12 h-12 mx-auto mb-4 text-gray-300" />
          <h3 className="text-lg font-semibold text-gray-700 mb-2">No shipping zones yet</h3>
          <p className="text-text-muted mb-6">Create zones to configure shipping rates by region.</p>
          <button onClick={openNew} className="btn-primary gap-2 inline-flex items-center">
            <Plus className="w-4 h-4" />
            Add First Zone
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {zones.map((zone) => (
            <div key={zone.id} className={`bg-white rounded-xl border p-5 ${!zone.isActive ? "opacity-60" : ""}`}>
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <MapPin className="w-5 h-5 text-accent" />
                  <h3 className="font-semibold text-gray-900">{zone.name}</h3>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${zone.isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                  {zone.isActive ? "Active" : "Inactive"}
                </span>
              </div>

              {(zone.countries.length > 0 || zone.cities.length > 0) && (
                <p className="text-sm text-text-muted mb-3 truncate">
                  {[...zone.countries, ...zone.cities].join(", ")}
                </p>
              )}

              <div className="space-y-1.5 mb-4">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Rate</span>
                  <span className="font-semibold">{Number(zone.rate).toLocaleString()} {zone.currency}</span>
                </div>
                {zone.freeAbove != null && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Free above</span>
                    <span className="font-medium text-green-600">{Number(zone.freeAbove).toLocaleString()} {zone.currency}</span>
                  </div>
                )}
                {zone.estimatedDays && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Delivery</span>
                    <span>{zone.estimatedDays}</span>
                  </div>
                )}
              </div>

              <div className="flex gap-2 pt-3 border-t">
                <button
                  onClick={() => handleToggle(zone)}
                  className={`flex-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${zone.isActive ? "bg-gray-100 hover:bg-gray-200 text-gray-700" : "bg-green-100 hover:bg-green-200 text-green-700"}`}
                >
                  {zone.isActive ? "Deactivate" : "Activate"}
                </button>
                <button onClick={() => openEdit(zone)} className="p-1.5 hover:bg-gray-100 rounded-lg" title="Edit">
                  <Edit className="w-4 h-4 text-gray-500" />
                </button>
                <button onClick={() => handleDelete(zone.id)} className="p-1.5 hover:bg-red-50 rounded-lg" title="Delete">
                  <Trash2 className="w-4 h-4 text-red-500" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
