"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import {
  Package,
  MapPin,
  Plus,
  Edit,
  Trash2,
  X,
  ChevronDown,
  ChevronUp,
  Truck,
  Calculator,
  Settings as SettingsIcon,
  Globe,
  ToggleLeft,
  ToggleRight,
  Check,
} from "lucide-react";

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

const EMPTY_FORM = {
  name: "",
  countries: "",
  cities: "",
  rate: 0,
  currency: "UGX",
  freeAbove: "",
  estimatedDays: "",
  isActive: true,
};

const CITY_SUGGESTIONS = [
  "Kampala", "Entebbe", "Jinja", "Mbarara", "Gulu", "Lira",
  "Mbale", "Fort Portal", "Masaka", "Soroti", "Arua", "Kabale", "Moroto",
];

const API_URL = typeof window !== "undefined" ? "" : (process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000");

const inputClass =
  "w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10 focus:border-gray-400";

const fmt = (v: string | number | null | undefined) =>
  v != null && v !== "" ? `${Number(v).toLocaleString()} UGX` : "—";

export default function AdminShippingPage() {
  // --- zones state ---
  const [zones, setZones] = useState<ShippingZone[]>([]);
  const [loading, setLoading] = useState(true);
  const [showPanel, setShowPanel] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);

  // --- settings state ---
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsSaved, setSettingsSaved] = useState(false);

  // --- calculator state ---
  const [calcOpen, setCalcOpen] = useState(false);
  const [calcCity, setCalcCity] = useState("");
  const [calcItems, setCalcItems] = useState([{ productId: "", quantity: 1 }]);
  const [calcResult, setCalcResult] = useState<Record<string, unknown> | null>(null);
  const [calculating, setCalculating] = useState(false);

  // ---- data loading ----
  const loadData = async () => {
    setLoading(true);
    try {
      const [zoneData, settingsData] = await Promise.all([
        api.admin.getShippingZones(),
        api.admin.getSettings(),
      ]);
      setZones(zoneData.zones || []);
      setSettings(settingsData || {});
    } catch (err) {
      console.error("Failed to load shipping data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  // ---- zone CRUD ----
  const openNew = () => {
    setForm({ ...EMPTY_FORM });
    setEditingId(null);
    setShowPanel(true);
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
    setShowPanel(true);
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
      setShowPanel(false);
      loadData();
    } catch (err) {
      console.error("Failed to save zone:", err);
      alert("Failed to save shipping zone");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this shipping zone?")) return;
    try {
      await api.admin.deleteShippingZone(id);
      loadData();
    } catch (err) {
      console.error("Failed to delete zone:", err);
    }
  };

  const handleToggle = async (zone: ShippingZone) => {
    try {
      await api.admin.updateShippingZone(zone.id, { isActive: !zone.isActive });
      loadData();
    } catch (err) {
      console.error("Failed to toggle zone:", err);
    }
  };

  // ---- city chip helpers ----
  const currentCities = form.cities.split(",").map((s) => s.trim()).filter(Boolean);
  const addCity = (city: string) => {
    if (currentCities.includes(city)) return;
    setForm({ ...form, cities: [...currentCities, city].join(", ") });
  };
  const removeCity = (city: string) => {
    setForm({ ...form, cities: currentCities.filter((c) => c !== city).join(", ") });
  };

  // ---- settings helpers ----
  const s = (key: string) => settings[key] || "";
  const setS = (key: string, value: string) => setSettings((prev) => ({ ...prev, [key]: value }));

  const saveSettings = async () => {
    setSavingSettings(true);
    try {
      await api.admin.updateSettings(settings);
      setSettingsSaved(true);
      setTimeout(() => setSettingsSaved(false), 2000);
    } catch (err) {
      console.error("Failed to save settings:", err);
      alert("Failed to save settings");
    } finally {
      setSavingSettings(false);
    }
  };

  // ---- shipping calculator ----
  const runCalculator = async () => {
    setCalculating(true);
    setCalcResult(null);
    try {
      const res = await fetch(`${API_URL}/api/settings/shipping/calculate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          city: calcCity,
          items: calcItems.filter((i) => i.productId).map((i) => ({
            productId: i.productId,
            quantity: Number(i.quantity) || 1,
          })),
        }),
      });
      const data = await res.json();
      setCalcResult(data);
    } catch (err) {
      console.error("Calculator error:", err);
      setCalcResult({ error: "Failed to calculate shipping" });
    } finally {
      setCalculating(false);
    }
  };

  // ---- derived stats ----
  const activeZones = zones.filter((z) => z.isActive).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Shipping</h1>
          <p className="text-sm text-gray-500 mt-0.5">Manage zones, rates, and delivery settings</p>
        </div>
        <button
          onClick={openNew}
          className="flex items-center gap-1.5 px-3 py-2 text-sm bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Zone
        </button>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Active Zones", value: loading ? "—" : String(activeZones), icon: Truck },
          { label: "Total Zones", value: loading ? "—" : String(zones.length), icon: Globe },
          { label: "Default Rate", value: loading ? "—" : fmt(s("shipping_default_rate")), icon: Package },
          { label: "Free Threshold", value: loading ? "—" : fmt(s("shipping_free_threshold")), icon: MapPin },
        ].map((stat) => (
          <div key={stat.label} className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs text-gray-500 uppercase tracking-wide">{stat.label}</p>
              <stat.icon className="w-4 h-4 text-gray-400" />
            </div>
            <p className="text-2xl font-semibold text-gray-900 mt-1 font-mono">{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Zones Table */}
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-900">Shipping Zones</h2>
          <span className="text-xs text-gray-500">{zones.length} zone{zones.length !== 1 ? "s" : ""}</span>
        </div>

        {loading ? (
          <div className="divide-y divide-gray-100">
            {[1, 2, 3].map((i) => (
              <div key={i} className="px-5 py-4 flex gap-4">
                <div className="h-4 w-32 bg-gray-100 rounded animate-pulse" />
                <div className="h-4 w-48 bg-gray-100 rounded animate-pulse" />
                <div className="h-4 w-20 bg-gray-100 rounded animate-pulse ml-auto" />
              </div>
            ))}
          </div>
        ) : zones.length === 0 ? (
          <div className="py-16 text-center">
            <Globe className="w-10 h-10 mx-auto mb-3 text-gray-300" />
            <h3 className="text-sm font-semibold text-gray-700 mb-1">No shipping zones yet</h3>
            <p className="text-sm text-gray-500 mb-4">Create your first zone to configure regional shipping rates.</p>
            <button
              onClick={openNew}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-sm bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add First Zone
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-left">
                  <th className="px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Zone Name</th>
                  <th className="px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Coverage</th>
                  <th className="px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Rate</th>
                  <th className="px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Free Above</th>
                  <th className="px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Est. Delivery</th>
                  <th className="px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Status</th>
                  <th className="px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {zones.map((zone) => (
                  <tr key={zone.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-3 font-medium text-gray-900">{zone.name}</td>
                    <td className="px-5 py-3 text-gray-500 max-w-[200px] truncate">
                      {[...zone.countries, ...zone.cities].join(", ") || "—"}
                    </td>
                    <td className="px-5 py-3 font-mono text-gray-900">
                      {Number(zone.rate).toLocaleString()} {zone.currency}
                    </td>
                    <td className="px-5 py-3 font-mono text-gray-900">
                      {zone.freeAbove != null ? `${Number(zone.freeAbove).toLocaleString()} ${zone.currency}` : "—"}
                    </td>
                    <td className="px-5 py-3 text-gray-500">{zone.estimatedDays || "—"}</td>
                    <td className="px-5 py-3">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full ${
                          zone.isActive
                            ? "bg-gray-100 text-gray-700 border border-gray-200"
                            : "bg-gray-50 text-gray-400 border border-gray-100"
                        }`}
                      >
                        {zone.isActive ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => openEdit(zone)}
                          className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                          title="Edit"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleToggle(zone)}
                          className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                          title={zone.isActive ? "Deactivate" : "Activate"}
                        >
                          {zone.isActive ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
                        </button>
                        <button
                          onClick={() => handleDelete(zone.id)}
                          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Slide-over Panel */}
      {showPanel && (
        <>
          <div className="fixed inset-0 bg-black/30 z-40" onClick={() => setShowPanel(false)} />
          <div className="fixed inset-y-0 right-0 w-full max-w-md bg-white shadow-xl z-50 flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">
                {editingId ? "Edit Zone" : "New Shipping Zone"}
              </h2>
              <button onClick={() => setShowPanel(false)} className="p-1.5 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Zone Name *</label>
                <input
                  className={inputClass}
                  placeholder="e.g. Kampala Metro"
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Countries (comma-separated)</label>
                <input
                  className={inputClass}
                  placeholder="UG, KE, TZ"
                  value={form.countries}
                  onChange={(e) => setForm({ ...form, countries: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Cities</label>
                <input
                  className={inputClass}
                  placeholder="Type or pick below"
                  value={form.cities}
                  onChange={(e) => setForm({ ...form, cities: e.target.value })}
                />
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {CITY_SUGGESTIONS.map((city) => {
                    const selected = currentCities.includes(city);
                    return (
                      <button
                        key={city}
                        type="button"
                        onClick={() => (selected ? removeCity(city) : addCity(city))}
                        className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                          selected
                            ? "bg-gray-900 text-white"
                            : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                        }`}
                      >
                        {city}
                        {selected && <span className="ml-1">×</span>}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Shipping Rate (UGX) *</label>
                  <input
                    className={inputClass}
                    type="number"
                    min="0"
                    step="100"
                    required
                    value={form.rate}
                    onChange={(e) => setForm({ ...form, rate: Number(e.target.value) })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Currency</label>
                  <input
                    className={inputClass}
                    value={form.currency}
                    onChange={(e) => setForm({ ...form, currency: e.target.value })}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Free Shipping Above</label>
                  <input
                    className={inputClass}
                    type="number"
                    min="0"
                    placeholder="Optional"
                    value={form.freeAbove}
                    onChange={(e) => setForm({ ...form, freeAbove: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Estimated Delivery</label>
                  <input
                    className={inputClass}
                    placeholder="1-2 days"
                    value={form.estimatedDays}
                    onChange={(e) => setForm({ ...form, estimatedDays: e.target.value })}
                  />
                </div>
              </div>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                  className="w-4 h-4 rounded border-gray-300"
                />
                <span className="text-sm text-gray-700">Active</span>
              </label>
            </form>
            <div className="px-6 py-4 border-t border-gray-200 flex gap-3">
              <button
                type="button"
                onClick={() => {
                  const formEl = document.querySelector<HTMLFormElement>("form");
                  formEl?.requestSubmit();
                }}
                disabled={saving}
                className="flex-1 px-4 py-2 text-sm bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50"
              >
                {saving ? "Saving..." : editingId ? "Update Zone" : "Create Zone"}
              </button>
              <button
                type="button"
                onClick={() => setShowPanel(false)}
                className="flex-1 px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </>
      )}

      {/* Global Shipping Settings */}
      <div className="bg-white rounded-lg border border-gray-200">
        <button
          onClick={() => setSettingsOpen(!settingsOpen)}
          className="w-full px-5 py-4 flex items-center justify-between text-left"
        >
          <div className="flex items-center gap-2">
            <SettingsIcon className="w-4 h-4 text-gray-500" />
            <h2 className="text-base font-semibold text-gray-900">Global Shipping Settings</h2>
          </div>
          {settingsOpen ? (
            <ChevronUp className="w-4 h-4 text-gray-400" />
          ) : (
            <ChevronDown className="w-4 h-4 text-gray-400" />
          )}
        </button>

        {settingsOpen && (
          <div className="px-5 pb-5 space-y-6 border-t border-gray-100 pt-5">
            {/* Default Rates */}
            <div>
              <h3 className="text-sm font-medium text-gray-900 mb-3">Default Rates (UGX)</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Standard Rate</label>
                  <input className={inputClass} type="number" min="0" value={s("shipping_default_rate")} onChange={(e) => setS("shipping_default_rate", e.target.value)} />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Express Rate</label>
                  <input className={inputClass} type="number" min="0" value={s("shipping_express_rate")} onChange={(e) => setS("shipping_express_rate", e.target.value)} />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Upcountry Rate</label>
                  <input className={inputClass} type="number" min="0" value={s("shipping_upcountry_rate")} onChange={(e) => setS("shipping_upcountry_rate", e.target.value)} />
                </div>
              </div>
            </div>

            {/* Free Threshold */}
            <div>
              <h3 className="text-sm font-medium text-gray-900 mb-3">Free Shipping Threshold (UGX)</h3>
              <div className="max-w-xs">
                <input className={inputClass} type="number" min="0" value={s("shipping_free_threshold")} onChange={(e) => setS("shipping_free_threshold", e.target.value)} />
              </div>
            </div>

            {/* Delivery Estimates */}
            <div>
              <h3 className="text-sm font-medium text-gray-900 mb-3">Delivery Estimates (Days)</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Standard</label>
                  <input className={inputClass} value={s("shipping_standard_days")} onChange={(e) => setS("shipping_standard_days", e.target.value)} placeholder="1-3" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Express</label>
                  <input className={inputClass} value={s("shipping_express_days")} onChange={(e) => setS("shipping_express_days", e.target.value)} placeholder="Same day" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Upcountry</label>
                  <input className={inputClass} value={s("shipping_upcountry_days")} onChange={(e) => setS("shipping_upcountry_days", e.target.value)} placeholder="3-7" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Processing</label>
                  <input className={inputClass} value={s("shipping_processing_days")} onChange={(e) => setS("shipping_processing_days", e.target.value)} placeholder="1" />
                </div>
              </div>
            </div>

            {/* Pickup */}
            <div>
              <h3 className="text-sm font-medium text-gray-900 mb-3">Pickup</h3>
              <label className="flex items-center gap-3 cursor-pointer mb-3">
                <input
                  type="checkbox"
                  checked={s("shipping_allow_pickup") === "true"}
                  onChange={(e) => setS("shipping_allow_pickup", e.target.checked ? "true" : "false")}
                  className="w-4 h-4 rounded border-gray-300"
                />
                <span className="text-sm text-gray-700">Enable self-pickup</span>
              </label>
              {s("shipping_allow_pickup") === "true" && (
                <textarea
                  className={`${inputClass} resize-none`}
                  rows={3}
                  placeholder="Pickup address..."
                  value={s("shipping_pickup_address")}
                  onChange={(e) => setS("shipping_pickup_address", e.target.value)}
                />
              )}
            </div>

            {/* International */}
            <div>
              <h3 className="text-sm font-medium text-gray-900 mb-3">International Shipping</h3>
              <label className="flex items-center gap-3 cursor-pointer mb-3">
                <input
                  type="checkbox"
                  checked={s("shipping_intl_included") === "true"}
                  onChange={(e) => setS("shipping_intl_included", e.target.checked ? "true" : "false")}
                  className="w-4 h-4 rounded border-gray-300"
                />
                <span className="text-sm text-gray-700">Include international shipping</span>
              </label>
              {s("shipping_intl_included") === "true" && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">International Rate (UGX)</label>
                    <input className={inputClass} type="number" min="0" value={s("shipping_intl_rate")} onChange={(e) => setS("shipping_intl_rate", e.target.value)} />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Estimated Days</label>
                    <input className={inputClass} value={s("shipping_intl_days")} onChange={(e) => setS("shipping_intl_days", e.target.value)} placeholder="7-14" />
                  </div>
                </div>
              )}
            </div>

            {/* Discreet Shipping */}
            <div>
              <h3 className="text-sm font-medium text-gray-900 mb-3">Discreet Shipping</h3>
              <label className="flex items-center gap-3 cursor-pointer mb-3">
                <input
                  type="checkbox"
                  checked={s("shipping_discreet_default") === "true"}
                  onChange={(e) => setS("shipping_discreet_default", e.target.checked ? "true" : "false")}
                  className="w-4 h-4 rounded border-gray-300"
                />
                <span className="text-sm text-gray-700">Default to discreet packaging</span>
              </label>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Discreet Packaging Note</label>
                <input className={inputClass} value={s("shipping_discreet_note")} onChange={(e) => setS("shipping_discreet_note", e.target.value)} placeholder="Plain packaging, no branding" />
              </div>
            </div>

            {/* Save */}
            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={saveSettings}
                disabled={savingSettings}
                className="flex items-center gap-1.5 px-4 py-2 text-sm bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50"
              >
                {savingSettings ? "Saving..." : "Save Settings"}
              </button>
              {settingsSaved && (
                <span className="flex items-center gap-1 text-sm text-gray-500">
                  <Check className="w-4 h-4" /> Saved
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Test Calculator */}
      <div className="bg-white rounded-lg border border-gray-200">
        <button
          onClick={() => setCalcOpen(!calcOpen)}
          className="w-full px-5 py-4 flex items-center justify-between text-left"
        >
          <div className="flex items-center gap-2">
            <Calculator className="w-4 h-4 text-gray-500" />
            <h2 className="text-base font-semibold text-gray-900">Test Calculator</h2>
          </div>
          {calcOpen ? (
            <ChevronUp className="w-4 h-4 text-gray-400" />
          ) : (
            <ChevronDown className="w-4 h-4 text-gray-400" />
          )}
        </button>

        {calcOpen && (
          <div className="px-5 pb-5 space-y-4 border-t border-gray-100 pt-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-gray-500 mb-1">City</label>
                <input
                  className={inputClass}
                  placeholder="e.g. Kampala"
                  value={calcCity}
                  onChange={(e) => setCalcCity(e.target.value)}
                />
              </div>
            </div>

            <div>
              <label className="block text-xs text-gray-500 mb-2">Items</label>
              {calcItems.map((item, idx) => (
                <div key={idx} className="flex gap-2 mb-2">
                  <input
                    className={inputClass}
                    placeholder="Product ID"
                    value={item.productId}
                    onChange={(e) => {
                      const next = [...calcItems];
                      next[idx] = { ...next[idx], productId: e.target.value };
                      setCalcItems(next);
                    }}
                  />
                  <input
                    className={`${inputClass} w-24`}
                    type="number"
                    min="1"
                    placeholder="Qty"
                    value={item.quantity}
                    onChange={(e) => {
                      const next = [...calcItems];
                      next[idx] = { ...next[idx], quantity: Number(e.target.value) };
                      setCalcItems(next);
                    }}
                  />
                  {calcItems.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setCalcItems(calcItems.filter((_, i) => i !== idx))}
                      className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
              <button
                type="button"
                onClick={() => setCalcItems([...calcItems, { productId: "", quantity: 1 }])}
                className="text-xs text-gray-500 hover:text-gray-700 transition-colors"
              >
                + Add item
              </button>
            </div>

            <button
              onClick={runCalculator}
              disabled={calculating || !calcCity}
              className="flex items-center gap-1.5 px-4 py-2 text-sm bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50"
            >
              {calculating ? "Calculating..." : "Calculate"}
            </button>

            {calcResult && (
              <div className="mt-3 p-4 bg-gray-50 border border-gray-200 rounded-lg">
                <h4 className="text-xs font-medium text-gray-500 uppercase mb-2">Result</h4>
                <pre className="text-sm font-mono text-gray-900 whitespace-pre-wrap">
                  {JSON.stringify(calcResult, null, 2)}
                </pre>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
