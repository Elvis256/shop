"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Image as ImageIcon,
  Plus,
  Edit2,
  Trash2,
  Eye,
  EyeOff,
  ArrowUp,
  ArrowDown,
  X,
  Save,
  ExternalLink,
  ArrowLeft,
} from "lucide-react";

interface Banner {
  id: string;
  title: string;
  subtitle: string | null;
  imageUrl: string;
  linkUrl: string | null;
  buttonText: string | null;
  position: number;
  isActive: boolean;
  createdAt: string;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export default function BannersPage() {
  const [banners, setBanners] = useState<Banner[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingBanner, setEditingBanner] = useState<Banner | null>(null);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    title: "",
    subtitle: "",
    imageUrl: "",
    linkUrl: "",
    buttonText: "",
    isActive: true,
  });

  const getCsrfToken = (): string | null => {
    if (typeof document === "undefined") return null;
    const match = document.cookie.match(/csrf_token=([^;]+)/);
    return match ? match[1] : null;
  };

  const loadBanners = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/banners`, {
        credentials: "include",
      });
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

  useEffect(() => {
    loadBanners();
  }, []);

  const openModal = (banner?: Banner) => {
    if (banner) {
      setEditingBanner(banner);
      setFormData({
        title: banner.title,
        subtitle: banner.subtitle || "",
        imageUrl: banner.imageUrl,
        linkUrl: banner.linkUrl || "",
        buttonText: banner.buttonText || "",
        isActive: banner.isActive,
      });
    } else {
      setEditingBanner(null);
      setFormData({
        title: "",
        subtitle: "",
        imageUrl: "",
        linkUrl: "",
        buttonText: "",
        isActive: true,
      });
    }
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingBanner(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    const csrfToken = getCsrfToken();
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (csrfToken) headers["x-csrf-token"] = csrfToken;

    try {
      const url = editingBanner
        ? `${API_URL}/api/banners/${editingBanner.id}`
        : `${API_URL}/api/banners`;

      const res = await fetch(url, {
        method: editingBanner ? "PUT" : "POST",
        headers,
        body: JSON.stringify({
          ...formData,
          position: editingBanner?.position ?? banners.length,
        }),
        credentials: "include",
      });

      if (!res.ok) throw new Error("Failed to save banner");

      closeModal();
      loadBanners();
    } catch (error) {
      console.error("Failed to save banner:", error);
      alert("Failed to save banner");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this banner?")) return;

    const csrfToken = getCsrfToken();
    const headers: Record<string, string> = {};
    if (csrfToken) headers["x-csrf-token"] = csrfToken;

    try {
      const res = await fetch(`${API_URL}/api/banners/${id}`, {
        method: "DELETE",
        headers,
        credentials: "include",
      });

      if (!res.ok) throw new Error("Failed to delete");
      loadBanners();
    } catch (error) {
      console.error("Failed to delete banner:", error);
      alert("Failed to delete banner");
    }
  };

  const toggleActive = async (banner: Banner) => {
    const csrfToken = getCsrfToken();
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (csrfToken) headers["x-csrf-token"] = csrfToken;

    try {
      await fetch(`${API_URL}/api/banners/${banner.id}`, {
        method: "PUT",
        headers,
        body: JSON.stringify({ isActive: !banner.isActive }),
        credentials: "include",
      });
      loadBanners();
    } catch (error) {
      console.error("Failed to toggle banner:", error);
    }
  };

  const movePosition = async (banner: Banner, direction: "up" | "down") => {
    const currentIndex = banners.findIndex((b) => b.id === banner.id);
    const newIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;

    if (newIndex < 0 || newIndex >= banners.length) return;

    const csrfToken = getCsrfToken();
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (csrfToken) headers["x-csrf-token"] = csrfToken;

    // Swap positions
    const otherBanner = banners[newIndex];

    try {
      await Promise.all([
        fetch(`${API_URL}/api/banners/${banner.id}`, {
          method: "PUT",
          headers,
          body: JSON.stringify({ position: otherBanner.position }),
          credentials: "include",
        }),
        fetch(`${API_URL}/api/banners/${otherBanner.id}`, {
          method: "PUT",
          headers,
          body: JSON.stringify({ position: banner.position }),
          credentials: "include",
        }),
      ]);
      loadBanners();
    } catch (error) {
      console.error("Failed to reorder:", error);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link
            href="/admin/content"
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">Banners</h1>
            <p className="text-gray-500 mt-1">Manage homepage hero banners</p>
          </div>
        </div>
        <button
          onClick={() => openModal()}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
        >
          <Plus className="w-5 h-5" />
          Add Banner
        </button>
      </div>

      {/* Banners List */}
      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white rounded-xl border shadow-sm p-4 animate-pulse">
              <div className="flex gap-4">
                <div className="w-48 h-28 bg-gray-200 rounded-lg" />
                <div className="flex-1">
                  <div className="h-5 bg-gray-200 rounded w-1/3 mb-2" />
                  <div className="h-4 bg-gray-200 rounded w-1/2" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : banners.length === 0 ? (
        <div className="bg-white rounded-xl border shadow-sm p-12 text-center">
          <ImageIcon className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h3 className="font-medium text-gray-900 mb-2">No banners yet</h3>
          <p className="text-gray-500 text-sm mb-4">
            Create your first banner to display on the homepage
          </p>
          <button
            onClick={() => openModal()}
            className="text-primary hover:text-primary/80 font-medium"
          >
            Add Banner
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {banners
            .sort((a, b) => a.position - b.position)
            .map((banner, index) => (
              <div
                key={banner.id}
                className={`bg-white rounded-xl border shadow-sm p-4 ${
                  !banner.isActive ? "opacity-60" : ""
                }`}
              >
                <div className="flex gap-4">
                  {/* Preview */}
                  <div className="relative w-48 h-28 rounded-lg overflow-hidden flex-shrink-0">
                    <img
                      src={banner.imageUrl}
                      alt={banner.title}
                      className="w-full h-full object-cover"
                    />
                    {!banner.isActive && (
                      <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                        <span className="text-white text-xs font-medium px-2 py-1 bg-black/50 rounded">
                          Hidden
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-semibold text-gray-900">{banner.title}</h3>
                        {banner.subtitle && (
                          <p className="text-sm text-gray-500 mt-1">{banner.subtitle}</p>
                        )}
                      </div>
                      <span className="text-sm text-gray-400">#{index + 1}</span>
                    </div>

                    <div className="flex items-center gap-4 mt-3">
                      {banner.linkUrl && (
                        <a
                          href={banner.linkUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-primary hover:underline flex items-center gap-1"
                        >
                          <ExternalLink className="w-4 h-4" />
                          {banner.buttonText || "View Link"}
                        </a>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    <div className="flex flex-col gap-1">
                      <button
                        onClick={() => movePosition(banner, "up")}
                        disabled={index === 0}
                        className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30"
                      >
                        <ArrowUp className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => movePosition(banner, "down")}
                        disabled={index === banners.length - 1}
                        className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30"
                      >
                        <ArrowDown className="w-4 h-4" />
                      </button>
                    </div>
                    <button
                      onClick={() => toggleActive(banner)}
                      className={`p-2 rounded-lg transition-colors ${
                        banner.isActive
                          ? "text-green-600 hover:bg-green-50"
                          : "text-gray-400 hover:bg-gray-100"
                      }`}
                    >
                      {banner.isActive ? <Eye className="w-5 h-5" /> : <EyeOff className="w-5 h-5" />}
                    </button>
                    <button
                      onClick={() => openModal(banner)}
                      className="p-2 text-gray-400 hover:text-primary hover:bg-primary/10 rounded-lg"
                    >
                      <Edit2 className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => handleDelete(banner.id)}
                      className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
        </div>
      )}

      {/* Modal */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b sticky top-0 bg-white">
              <h2 className="text-lg font-semibold text-gray-900">
                {editingBanner ? "Edit Banner" : "New Banner"}
              </h2>
              <button onClick={closeModal} className="p-2 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Title *
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData((p) => ({ ...p, title: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Subtitle
                </label>
                <input
                  type="text"
                  value={formData.subtitle}
                  onChange={(e) => setFormData((p) => ({ ...p, subtitle: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Image URL *
                </label>
                <input
                  type="url"
                  value={formData.imageUrl}
                  onChange={(e) => setFormData((p) => ({ ...p, imageUrl: e.target.value }))}
                  placeholder="https://..."
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  required
                />
                {formData.imageUrl && (
                  <div className="mt-2 rounded-lg overflow-hidden">
                    <img
                      src={formData.imageUrl}
                      alt="Preview"
                      className="w-full h-32 object-cover"
                    />
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Link URL
                </label>
                <input
                  type="url"
                  value={formData.linkUrl}
                  onChange={(e) => setFormData((p) => ({ ...p, linkUrl: e.target.value }))}
                  placeholder="https://... or /products"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Button Text
                </label>
                <input
                  type="text"
                  value={formData.buttonText}
                  onChange={(e) => setFormData((p) => ({ ...p, buttonText: e.target.value }))}
                  placeholder="Shop Now"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setFormData((p) => ({ ...p, isActive: !p.isActive }))}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    formData.isActive ? "bg-primary" : "bg-gray-200"
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      formData.isActive ? "translate-x-6" : "translate-x-1"
                    }`}
                  />
                </button>
                <span className="text-sm text-gray-700">
                  {formData.isActive ? "Active (visible on store)" : "Inactive (hidden)"}
                </span>
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
                  {saving ? "Saving..." : "Save Banner"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
