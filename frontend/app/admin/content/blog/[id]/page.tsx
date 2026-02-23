"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Save, Eye, EyeOff, Star, Loader2 } from "lucide-react";

interface PostForm {
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  featuredImage: string;
  author: string;
  category: string;
  tags: string;
  status: "DRAFT" | "PUBLISHED";
  featured: boolean;
}

const CATEGORIES = ["Guides", "Relationships", "Self-Care", "Wellness", "News", "Tips"];

export default function BlogPostEditorPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const isNew = params.id === "new";

  const [form, setForm] = useState<PostForm>({
    title: "",
    slug: "",
    excerpt: "",
    content: "",
    featuredImage: "",
    author: "",
    category: "",
    tags: "",
    status: "DRAFT",
    featured: false,
  });
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isNew) {
      fetch(`/api/admin/blog/${params.id}`, { credentials: "include" })
        .then(r => r.json())
        .then(data => {
          if (data.post) {
            const p = data.post;
            setForm({
              title: p.title || "",
              slug: p.slug || "",
              excerpt: p.excerpt || "",
              content: p.content || "",
              featuredImage: p.featuredImage || "",
              author: p.author || "",
              category: p.category || "",
              tags: (p.tags || []).join(", "),
              status: p.status || "DRAFT",
              featured: p.featured || false,
            });
          }
        })
        .catch(() => setError("Failed to load post"))
        .finally(() => setLoading(false));
    }
  }, [params.id, isNew]);

  function generateSlug(title: string) {
    return title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  }

  function handleTitleChange(title: string) {
    setForm(f => ({ ...f, title, slug: isNew ? generateSlug(title) : f.slug }));
  }

  async function handleSave(publishNow?: boolean) {
    if (!form.title.trim() || !form.content.trim()) {
      setError("Title and content are required");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const payload = {
        ...form,
        tags: form.tags.split(",").map(t => t.trim()).filter(Boolean),
        status: publishNow ? "PUBLISHED" : form.status,
      };

      const url = isNew ? "/api/admin/blog" : `/api/admin/blog/${params.id}`;
      const method = isNew ? "POST" : "PUT";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save");
      router.push("/admin/content/blog");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <Loader2 className="w-8 h-8 animate-spin text-accent" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Link href="/admin/content/blog" className="p-2 hover:bg-gray-100 rounded-lg">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-xl font-bold">{isNew ? "New Blog Post" : "Edit Post"}</h1>
            <p className="text-sm text-gray-500">{isNew ? "Write and publish a new article" : `Editing: ${form.title}`}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setForm(f => ({ ...f, status: f.status === "PUBLISHED" ? "DRAFT" : "PUBLISHED" }))}
            className="btn-secondary flex items-center gap-2 text-sm"
          >
            {form.status === "PUBLISHED" ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            {form.status === "PUBLISHED" ? "Set Draft" : "Set Live"}
          </button>
          <button
            onClick={() => handleSave()}
            disabled={saving}
            className="btn-secondary flex items-center gap-2 text-sm"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save Draft
          </button>
          <button
            onClick={() => handleSave(true)}
            disabled={saving}
            className="btn-primary flex items-center gap-2 text-sm"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Eye className="w-4 h-4" />}
            Publish
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">{error}</div>
      )}

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Main content */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white rounded-xl border p-6 space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1.5">Title *</label>
              <input
                type="text"
                value={form.title}
                onChange={e => handleTitleChange(e.target.value)}
                className="input w-full text-lg font-medium"
                placeholder="Post title..."
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">URL Slug</label>
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-400">/blog/</span>
                <input
                  type="text"
                  value={form.slug}
                  onChange={e => setForm(f => ({ ...f, slug: e.target.value }))}
                  className="input flex-1"
                  placeholder="url-friendly-slug"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Excerpt</label>
              <textarea
                value={form.excerpt}
                onChange={e => setForm(f => ({ ...f, excerpt: e.target.value }))}
                rows={2}
                className="input w-full resize-none"
                placeholder="Brief summary shown in blog list..."
              />
            </div>
          </div>

          <div className="bg-white rounded-xl border p-6">
            <label className="block text-sm font-medium mb-1.5">Content *</label>
            <textarea
              value={form.content}
              onChange={e => setForm(f => ({ ...f, content: e.target.value }))}
              rows={20}
              className="input w-full resize-y font-mono text-sm"
              placeholder="Write your article content here... (HTML or plain text supported)"
            />
            <p className="text-xs text-gray-400 mt-2">HTML tags are supported. {form.content.length} characters</p>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <div className="bg-white rounded-xl border p-5 space-y-4">
            <h3 className="font-semibold text-sm">Post Settings</h3>

            <div>
              <label className="block text-sm font-medium mb-1.5">Status</label>
              <select
                value={form.status}
                onChange={e => setForm(f => ({ ...f, status: e.target.value as "DRAFT" | "PUBLISHED" }))}
                className="input w-full"
              >
                <option value="DRAFT">Draft</option>
                <option value="PUBLISHED">Published</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5">Category</label>
              <select
                value={form.category}
                onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                className="input w-full"
              >
                <option value="">Select category...</option>
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5">Author</label>
              <input
                type="text"
                value={form.author}
                onChange={e => setForm(f => ({ ...f, author: e.target.value }))}
                className="input w-full"
                placeholder="Wellness Team"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5">Tags</label>
              <input
                type="text"
                value={form.tags}
                onChange={e => setForm(f => ({ ...f, tags: e.target.value }))}
                className="input w-full"
                placeholder="wellness, guides, tips"
              />
              <p className="text-xs text-gray-400 mt-1">Comma-separated</p>
            </div>

            <div className="flex items-center justify-between pt-2 border-t">
              <div>
                <p className="text-sm font-medium">Featured Post</p>
                <p className="text-xs text-gray-400">Show on homepage</p>
              </div>
              <button
                onClick={() => setForm(f => ({ ...f, featured: !f.featured }))}
                className={`p-2 rounded-lg transition-colors ${
                  form.featured ? "text-purple-500 bg-purple-50" : "text-gray-400 hover:text-gray-600"
                }`}
              >
                <Star className="w-5 h-5" fill={form.featured ? "currentColor" : "none"} />
              </button>
            </div>
          </div>

          <div className="bg-white rounded-xl border p-5 space-y-3">
            <h3 className="font-semibold text-sm">Featured Image</h3>
            <input
              type="url"
              value={form.featuredImage}
              onChange={e => setForm(f => ({ ...f, featuredImage: e.target.value }))}
              className="input w-full"
              placeholder="https://..."
            />
            {form.featuredImage && (
              <img src={form.featuredImage} alt="Preview" className="w-full h-32 object-cover rounded-lg" onError={e => (e.currentTarget.style.display = "none")} />
            )}
          </div>

          <div className="bg-blue-50 rounded-xl p-4 text-xs text-blue-700 space-y-1">
            <p className="font-semibold">Preview your post</p>
            {!isNew && (
              <a
                href={`/blog/${form.slug}`}
                target="_blank"
                rel="noopener noreferrer"
                className="underline"
              >
                View on site →
              </a>
            )}
            <p>Save as draft first, then publish when ready.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
