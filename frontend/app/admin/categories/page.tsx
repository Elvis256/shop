"use client";

import { useState, useEffect, useRef } from "react";
import { api } from "@/lib/api";
import {
  Plus,
  Edit2,
  Trash2,
  FolderTree,
  Search,
  X,
  Save,
  Image as ImageIcon,
  Upload,
  Link as LinkIcon,
  Loader2,
} from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

interface Category {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  imageUrl: string | null;
  _count?: { products: number };
}

function getCsrfToken(): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(/csrf_token=([^;]+)/);
  return match ? match[1] : null;
}

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [imageMode, setImageMode] = useState<"url" | "file">("file");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState({
    name: "",
    slug: "",
    description: "",
    imageUrl: "",
  });

  const loadCategories = async () => {
    setLoading(true);
    try {
      const data: any = await api.admin.getCategories();
      setCategories(Array.isArray(data) ? data : data.categories || []);
    } catch (error) {
      console.error("Failed to load categories:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCategories();
  }, []);

  const openModal = (category?: Category) => {
    if (category) {
      setEditingCategory(category);
      setFormData({
        name: category.name,
        slug: category.slug,
        description: category.description || "",
        imageUrl: category.imageUrl || "",
      });
      setImagePreview(category.imageUrl || "");
      setImageMode(category.imageUrl?.startsWith("/uploads") ? "file" : "url");
    } else {
      setEditingCategory(null);
      setFormData({ name: "", slug: "", description: "", imageUrl: "" });
      setImagePreview("");
      setImageMode("file");
    }
    setImageFile(null);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingCategory(null);
    setFormData({ name: "", slug: "", description: "", imageUrl: "" });
    setImageFile(null);
    setImagePreview("");
  };

  const generateSlug = (name: string) =>
    name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

  const handleNameChange = (name: string) => {
    setFormData((prev) => ({
      ...prev,
      name,
      slug: editingCategory ? prev.slug : generateSlug(name),
    }));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    const reader = new FileReader();
    reader.onloadend = () => setImagePreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const uploadImageFile = async (categoryId: string): Promise<string | null> => {
    if (!imageFile) return null;
    setUploading(true);
    try {
      const csrf = getCsrfToken();
      const fd = new FormData();
      fd.append("image", imageFile);
      const res = await fetch(`${API_URL}/api/admin/categories/${categoryId}/image`, {
        method: "POST",
        credentials: "include",
        headers: { ...(csrf ? { "x-csrf-token": csrf } : {}) },
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");
      return data.imageUrl as string;
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        ...formData,
        imageUrl: imageMode === "url" ? formData.imageUrl || null : (editingCategory?.imageUrl || null),
      };

      let savedCategory: Category;
      if (editingCategory) {
        const res: any = await api.admin.updateCategory(editingCategory.id, payload);
        savedCategory = res.category || res;
      } else {
        const res: any = await api.admin.createCategory(payload);
        savedCategory = res.category || res;
      }

      // Upload file image after save if file mode selected
      if (imageMode === "file" && imageFile && savedCategory?.id) {
        await uploadImageFile(savedCategory.id);
      }

      closeModal();
      loadCategories();
    } catch (error) {
      console.error("Failed to save category:", error);
      alert("Failed to save category");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this category? Products in this category will become uncategorized.")) return;
    setDeleting(id);
    try {
      await api.admin.deleteCategory(id);
      loadCategories();
    } catch (error) {
      console.error("Failed to delete category:", error);
      alert("Failed to delete category");
    } finally {
      setDeleting(null);
    }
  };

  const filteredCategories = categories.filter((cat) =>
    cat.name.toLowerCase().includes(search.toLowerCase())
  );

  const previewSrc = imageMode === "url" ? formData.imageUrl : imagePreview;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">Categories</h1>
          <p className="text-gray-500 mt-1">Organize your products into categories</p>
        </div>
        <button
          onClick={() => openModal()}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
        >
          <Plus className="w-5 h-5" />
          Add Category
        </button>
      </div>

      {/* Search */}
      <div className="bg-white rounded-xl border shadow-sm p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search categories..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
          />
        </div>
      </div>

      {/* Categories Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="bg-white rounded-xl border shadow-sm p-6 animate-pulse">
              <div className="w-16 h-16 bg-gray-200 rounded-lg mb-4" />
              <div className="h-5 bg-gray-200 rounded w-3/4 mb-2" />
              <div className="h-4 bg-gray-200 rounded w-1/2" />
            </div>
          ))}
        </div>
      ) : filteredCategories.length === 0 ? (
        <div className="bg-white rounded-xl border shadow-sm p-12 text-center">
          <FolderTree className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h3 className="font-medium text-gray-900 mb-2">No categories found</h3>
          <p className="text-gray-500 text-sm mb-4">
            {search ? "Try a different search term" : "Create your first category to organize products"}
          </p>
          {!search && (
            <button onClick={() => openModal()} className="text-primary hover:text-primary/80 font-medium">
              Add Category
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredCategories.map((category) => (
            <div key={category.id} className="bg-white rounded-xl border shadow-sm p-6 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-4">
                {category.imageUrl ? (
                  <img
                    src={category.imageUrl.startsWith("/uploads") ? `${API_URL}${category.imageUrl}` : category.imageUrl}
                    alt={category.name}
                    className="w-16 h-16 rounded-lg object-cover"
                  />
                ) : (
                  <div className="w-16 h-16 bg-gradient-to-br from-primary/20 to-primary/10 rounded-lg flex items-center justify-center">
                    <FolderTree className="w-8 h-8 text-primary" />
                  </div>
                )}
                <div className="flex gap-2">
                  <button
                    onClick={() => openModal(category)}
                    className="p-2 text-gray-400 hover:text-primary hover:bg-primary/10 rounded-lg transition-colors"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(category.id)}
                    disabled={deleting === category.id}
                    className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <h3 className="font-semibold text-gray-900 mb-1">{category.name}</h3>
              <p className="text-sm text-gray-500 mb-2">/{category.slug}</p>
              {category.description && (
                <p className="text-sm text-gray-600 line-clamp-2 mb-3">{category.description}</p>
              )}
              <div className="pt-3 border-t">
                <span className="text-sm text-gray-500">{category._count?.products || 0} products</span>
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
                {editingCategory ? "Edit Category" : "New Category"}
              </h2>
              <button onClick={closeModal} className="p-2 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Slug *</label>
                <input
                  type="text"
                  value={formData.slug}
                  onChange={(e) => setFormData((prev) => ({ ...prev, slug: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  required
                />
                <p className="text-xs text-gray-500 mt-1">URL-friendly identifier</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none"
                />
              </div>

              {/* Image field with tabs */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Category Image</label>

                {/* Toggle tabs */}
                <div className="flex rounded-lg border border-gray-200 overflow-hidden mb-3">
                  <button
                    type="button"
                    onClick={() => setImageMode("file")}
                    className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-medium transition-colors ${
                      imageMode === "file" ? "bg-primary text-white" : "text-gray-600 hover:bg-gray-50"
                    }`}
                  >
                    <Upload className="w-4 h-4" />Upload File
                  </button>
                  <button
                    type="button"
                    onClick={() => setImageMode("url")}
                    className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-medium transition-colors ${
                      imageMode === "url" ? "bg-primary text-white" : "text-gray-600 hover:bg-gray-50"
                    }`}
                  >
                    <LinkIcon className="w-4 h-4" />Image URL
                  </button>
                </div>

                {imageMode === "file" ? (
                  <div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/gif"
                      onChange={handleFileChange}
                      className="hidden"
                    />
                    {imagePreview ? (
                      <div className="relative group">
                        <img
                          src={imagePreview.startsWith("data:") ? imagePreview : `${API_URL}${imagePreview}`}
                          alt="Preview"
                          className="w-full h-40 object-cover rounded-lg border border-gray-200"
                        />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 rounded-lg flex items-center justify-center gap-3 transition-opacity">
                          <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            className="bg-white text-gray-900 px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-gray-100"
                          >
                            Change Image
                          </button>
                          <button
                            type="button"
                            onClick={() => { setImageFile(null); setImagePreview(""); }}
                            className="bg-red-600 text-white px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-red-700"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="w-full h-40 border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center gap-2 text-gray-500 hover:border-primary hover:text-primary hover:bg-primary/5 transition-colors"
                      >
                        <ImageIcon className="w-8 h-8" />
                        <span className="text-sm font-medium">Click to upload image</span>
                        <span className="text-xs">JPEG, PNG, WebP, GIF — max 5MB</span>
                      </button>
                    )}
                  </div>
                ) : (
                  <div>
                    <div className="flex gap-2">
                      <input
                        type="url"
                        value={formData.imageUrl}
                        onChange={(e) => {
                          setFormData((prev) => ({ ...prev, imageUrl: e.target.value }));
                          setImagePreview(e.target.value);
                        }}
                        placeholder="https://example.com/image.jpg"
                        className="flex-1 px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                      />
                    </div>
                    {formData.imageUrl && (
                      <img
                        src={formData.imageUrl}
                        alt="Preview"
                        className="mt-2 w-full h-32 object-cover rounded-lg border border-gray-200"
                        onError={(e) => (e.currentTarget.style.display = "none")}
                      />
                    )}
                  </div>
                )}
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
                  disabled={saving || uploading}
                  className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
                >
                  {saving || uploading ? <><Loader2 className="w-4 h-4 animate-spin" />{uploading ? "Uploading..." : "Saving..."}</> : <><Save className="w-4 h-4" />Save Category</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
