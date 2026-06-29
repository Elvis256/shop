"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Image as ImageIcon,
  Plus,
  Edit,
  Trash2,
  Eye,
  EyeOff,
  ArrowUp,
  ArrowDown,
  X,
  ArrowLeft,
  ExternalLink,
  GripVertical,
  Upload,
} from "lucide-react";

interface Banner {
  id: string;
  title: string;
  subtitle: string | null;
  imageUrl: string;
  mobileImageUrl: string | null;
  linkUrl: string | null;
  buttonText: string | null;
  position: string;
  sortOrder: number;
  isActive: boolean;
  startDate: string | null;
  endDate: string | null;
  createdAt: string;
}

interface FormData {
  title: string;
  subtitle: string;
  imageUrl: string;
  mobileImageUrl: string;
  linkUrl: string;
  buttonText: string;
  position: string;
  isActive: boolean;
  startDate: string;
  endDate: string;
}

const API_URL = typeof window !== "undefined" ? "" : (process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000");

const getCsrfToken = (): string | null => {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(/csrf_token=([^;]+)/);
  return match ? match[1] : null;
};

const emptyForm: FormData = {
  title: "",
  subtitle: "",
  imageUrl: "",
  mobileImageUrl: "",
  linkUrl: "",
  buttonText: "",
  position: "home-hero",
  isActive: true,
  startDate: "",
  endDate: "",
};

export default function BannersPage() {
  const [banners, setBanners] = useState<Banner[]>([]);
  const [loading, setLoading] = useState(true);
  const [panelOpen, setPanelOpen] = useState(false);
  const [editingBanner, setEditingBanner] = useState<Banner | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<FormData>(emptyForm);
  const [uploading, setUploading] = useState<"image" | "mobile" | null>(null);

  const authHeaders = (): Record<string, string> => {
    const h: Record<string, string> = { "Content-Type": "application/json" };
    const csrf = getCsrfToken();
    if (csrf) h["x-csrf-token"] = csrf;
    return h;
  };

  const uploadImage = async (file: File, field: "imageUrl" | "mobileImageUrl") => {
    setUploading(field === "imageUrl" ? "image" : "mobile");
    try {
      const fd = new window.FormData();
      fd.append("image", file);
      const csrf = getCsrfToken();
      const headers: Record<string, string> = {};
      if (csrf) headers["x-csrf-token"] = csrf;
      const res = await fetch(`${API_URL}/api/admin/upload`, {
        method: "POST",
        credentials: "include",
        headers,
        body: fd,
      });
      if (!res.ok) throw new Error("Upload failed");
      const data = await res.json();
      set(field, data.url);
    } catch (err) {
      console.error("Image upload failed:", err);
      alert("Failed to upload image. Try again or paste a URL.");
    } finally {
      setUploading(null);
    }
  };

  const loadBanners = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/banners`, { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setBanners(Array.isArray(data) ? data : data.banners || []);
      }
    } catch (error) {
      console.error("Failed to load banners:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadBanners(); }, []);

  const sorted = [...banners].sort((a, b) => a.sortOrder - b.sortOrder);
  const activeCount = banners.filter((b) => b.isActive).length;
  const inactiveCount = banners.length - activeCount;

  const openPanel = (banner?: Banner) => {
    if (banner) {
      setEditingBanner(banner);
      setForm({
        title: banner.title,
        subtitle: banner.subtitle || "",
        imageUrl: banner.imageUrl,
        mobileImageUrl: banner.mobileImageUrl || "",
        linkUrl: banner.linkUrl || "",
        buttonText: banner.buttonText || "",
        position: banner.position || "home-hero",
        isActive: banner.isActive,
        startDate: banner.startDate ? banner.startDate.slice(0, 10) : "",
        endDate: banner.endDate ? banner.endDate.slice(0, 10) : "",
      });
    } else {
      setEditingBanner(null);
      setForm({ ...emptyForm, position: "home-hero" });
    }
    setPanelOpen(true);
  };

  const closePanel = () => {
    setPanelOpen(false);
    setEditingBanner(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const url = editingBanner
        ? `${API_URL}/api/banners/${editingBanner.id}`
        : `${API_URL}/api/banners`;
      const body: Record<string, unknown> = {
        title: form.title,
        subtitle: form.subtitle || null,
        imageUrl: form.imageUrl,
        mobileImageUrl: form.mobileImageUrl || null,
        linkUrl: form.linkUrl || null,
        buttonText: form.buttonText || null,
        position: form.position,
        isActive: form.isActive,
        startDate: form.startDate || null,
        endDate: form.endDate || null,
      };
      if (!editingBanner) {
        body.sortOrder = banners.length;
      }
      const res = await fetch(url, {
        method: editingBanner ? "PUT" : "POST",
        headers: authHeaders(),
        body: JSON.stringify(body),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to save banner");
      closePanel();
      loadBanners();
    } catch (error) {
      console.error("Save failed:", error);
      alert("Failed to save banner");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this banner?")) return;
    try {
      const res = await fetch(`${API_URL}/api/banners/${id}`, {
        method: "DELETE",
        headers: authHeaders(),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to delete");
      loadBanners();
    } catch (error) {
      console.error("Delete failed:", error);
      alert("Failed to delete banner");
    }
  };

  const toggleActive = async (banner: Banner) => {
    try {
      await fetch(`${API_URL}/api/banners/${banner.id}`, {
        method: "PUT",
        headers: authHeaders(),
        body: JSON.stringify({ isActive: !banner.isActive }),
        credentials: "include",
      });
      loadBanners();
    } catch (error) {
      console.error("Toggle failed:", error);
    }
  };

  const movePosition = async (banner: Banner, direction: "up" | "down") => {
    const idx = sorted.findIndex((b) => b.id === banner.id);
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= sorted.length) return;
    const other = sorted[swapIdx];
    try {
      await Promise.all([
        fetch(`${API_URL}/api/banners/${banner.id}`, {
          method: "PUT",
          headers: authHeaders(),
          body: JSON.stringify({ sortOrder: other.sortOrder }),
          credentials: "include",
        }),
        fetch(`${API_URL}/api/banners/${other.id}`, {
          method: "PUT",
          headers: authHeaders(),
          body: JSON.stringify({ sortOrder: banner.sortOrder }),
          credentials: "include",
        }),
      ]);
      loadBanners();
    } catch (error) {
      console.error("Reorder failed:", error);
    }
  };

  const set = (key: keyof FormData, value: string | boolean) =>
    setForm((f) => ({ ...f, [key]: value }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/admin/content" className="p-2 rounded-lg hover:bg-gray-100 transition-colors">
            <ArrowLeft className="w-5 h-5 text-gray-500" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Banners</h1>
            <p className="text-gray-500 text-sm">Manage homepage and promotional banners</p>
          </div>
        </div>
        <button onClick={() => openPanel()} className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white text-sm rounded-lg hover:bg-gray-800 transition-colors">
          <Plus className="w-4 h-4" /> Add Banner
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Total Banners", value: banners.length },
          { label: "Active", value: activeCount },
          { label: "Inactive", value: inactiveCount },
        ].map((s) => (
          <div key={s.label} className="bg-white border border-gray-200 rounded-lg p-4">
            <p className="font-mono text-2xl text-gray-900">{loading ? "—" : s.value}</p>
            <p className="text-xs text-gray-500 mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-gray-400 text-sm">Loading banners…</div>
        ) : sorted.length === 0 ? (
          <div className="p-12 text-center">
            <ImageIcon className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 text-sm mb-3">No banners yet</p>
            <button onClick={() => openPanel()} className="text-sm text-gray-900 underline hover:no-underline">
              Create your first banner
            </button>
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Preview</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Title &amp; Subtitle</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide hidden md:table-cell">Link</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide hidden md:table-cell">Position</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Status</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {sorted.map((banner, idx) => (
                <tr key={banner.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    {banner.imageUrl ? (
                      <img src={banner.imageUrl.startsWith("/") ? `${API_URL}${banner.imageUrl}` : banner.imageUrl} alt={banner.title} className="w-20 h-10 rounded object-cover bg-gray-100" />
                    ) : (
                      <div className="w-20 h-10 rounded bg-gray-100 flex items-center justify-center">
                        <ImageIcon className="w-4 h-4 text-gray-300" />
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-semibold text-sm text-gray-900">{banner.title}</p>
                    {banner.subtitle && <p className="text-sm text-gray-500 truncate max-w-xs">{banner.subtitle}</p>}
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    {banner.linkUrl ? (
                      <a href={banner.linkUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-gray-500 hover:text-gray-900 flex items-center gap-1 truncate max-w-[160px]">
                        <ExternalLink className="w-3 h-3 flex-shrink-0" />
                        {banner.linkUrl}
                      </a>
                    ) : (
                      <span className="text-xs text-gray-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs text-gray-700">{banner.position}</span>
                      <div className="flex flex-col">
                        <button onClick={() => movePosition(banner, "up")} disabled={idx === 0} className="p-0.5 text-gray-400 hover:text-gray-700 disabled:opacity-20">
                          <ArrowUp className="w-3 h-3" />
                        </button>
                        <button onClick={() => movePosition(banner, "down")} disabled={idx === sorted.length - 1} className="p-0.5 text-gray-400 hover:text-gray-700 disabled:opacity-20">
                          <ArrowDown className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${banner.isActive ? "bg-gray-900 text-white" : "bg-gray-200 text-gray-600"}`}>
                      {banner.isActive ? "Active" : "Hidden"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => openPanel(banner)} className="p-1.5 rounded text-gray-400 hover:text-gray-700 hover:bg-gray-100" title="Edit">
                        <Edit className="w-4 h-4" />
                      </button>
                      <button onClick={() => toggleActive(banner)} className="p-1.5 rounded text-gray-400 hover:text-gray-700 hover:bg-gray-100" title={banner.isActive ? "Hide" : "Show"}>
                        {banner.isActive ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                      <button onClick={() => handleDelete(banner.id)} className="p-1.5 rounded text-gray-400 hover:text-gray-700 hover:bg-gray-100" title="Delete">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Slide-over Panel */}
      {panelOpen && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/30" onClick={closePanel} />
          <div className="relative w-full max-w-md bg-white shadow-xl flex flex-col h-full">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">
                {editingBanner ? "Edit Banner" : "New Banner"}
              </h2>
              <button onClick={closePanel} className="p-2 rounded-lg hover:bg-gray-100">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
              {/* Title */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
                <input type="text" value={form.title} onChange={(e) => set("title", e.target.value)} required
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-300 focus:border-gray-400" />
              </div>

              {/* Subtitle */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Subtitle</label>
                <input type="text" value={form.subtitle} onChange={(e) => set("subtitle", e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-300 focus:border-gray-400" />
              </div>

              {/* Image URL */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Banner Image *</label>
                <div className="flex gap-2">
                  <input type="url" value={form.imageUrl} onChange={(e) => set("imageUrl", e.target.value)} required placeholder="https://... or upload"
                    className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-300 focus:border-gray-400" />
                  <label className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium cursor-pointer transition-colors ${uploading === "image" ? "bg-gray-200 text-gray-500" : "bg-gray-900 text-white hover:bg-gray-800"}`}>
                    <Upload className="w-4 h-4" />
                    {uploading === "image" ? "Uploading..." : "Upload"}
                    <input type="file" accept="image/*" className="hidden" disabled={uploading === "image"}
                      onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadImage(f, "imageUrl"); e.target.value = ""; }} />
                  </label>
                </div>
                <p className="text-xs text-gray-400 mt-1">Upload an image (JPEG, PNG, WebP, max 5MB) or paste a URL</p>
                {form.imageUrl && (
                  <img src={form.imageUrl.startsWith("/") ? `${API_URL}${form.imageUrl}` : form.imageUrl} alt="Preview" className="mt-2 w-full h-32 object-cover rounded-lg border border-gray-200 bg-gray-50" />
                )}
              </div>

              {/* Mobile Image URL */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Mobile Image</label>
                <div className="flex gap-2">
                  <input type="url" value={form.mobileImageUrl} onChange={(e) => set("mobileImageUrl", e.target.value)} placeholder="Optional responsive image"
                    className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-300 focus:border-gray-400" />
                  <label className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium cursor-pointer transition-colors ${uploading === "mobile" ? "bg-gray-200 text-gray-500" : "bg-gray-100 text-gray-700 hover:bg-gray-200"}`}>
                    <Upload className="w-4 h-4" />
                    {uploading === "mobile" ? "..." : "Upload"}
                    <input type="file" accept="image/*" className="hidden" disabled={uploading === "mobile"}
                      onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadImage(f, "mobileImageUrl"); e.target.value = ""; }} />
                  </label>
                </div>
              </div>

              {/* Link URL */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Link URL</label>
                <input type="text" value={form.linkUrl} onChange={(e) => set("linkUrl", e.target.value)} placeholder="https://... or /products"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-300 focus:border-gray-400" />
              </div>

              {/* Button Text */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Button Text</label>
                <input type="text" value={form.buttonText} onChange={(e) => set("buttonText", e.target.value)} placeholder="Shop Now"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-300 focus:border-gray-400" />
              </div>

              {/* Position */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Position</label>
                <select value={form.position} onChange={(e) => set("position", e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-300 focus:border-gray-400 bg-white">
                  <option value="home-hero">Home Hero</option>
                  <option value="home-secondary">Home Secondary</option>
                  <option value="category-top">Category Top</option>
                </select>
              </div>

              {/* Active Toggle */}
              <div className="flex items-center gap-3">
                <button type="button" onClick={() => set("isActive", !form.isActive)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${form.isActive ? "bg-gray-900" : "bg-gray-200"}`}>
                  <span className={`inline-block h-4 w-4 rounded-full bg-white transition-transform ${form.isActive ? "translate-x-6" : "translate-x-1"}`} />
                </button>
                <span className="text-sm text-gray-700">{form.isActive ? "Active" : "Hidden"}</span>
              </div>

              {/* Date Scheduling */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
                  <input type="date" value={form.startDate} onChange={(e) => set("startDate", e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-300 focus:border-gray-400" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
                  <input type="date" value={form.endDate} onChange={(e) => set("endDate", e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-300 focus:border-gray-400" />
                </div>
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                <button type="button" onClick={closePanel}
                  className="px-4 py-2 text-sm text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors">
                  Cancel
                </button>
                <button type="submit" disabled={saving}
                  className="px-4 py-2 text-sm bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50">
                  {saving ? "Saving…" : "Save Banner"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
