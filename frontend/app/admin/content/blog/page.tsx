"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  PlusCircle, Edit2, Trash2, Eye, EyeOff, Star,
  Search, RefreshCw, FileText, Calendar, Tag
} from "lucide-react";

interface BlogPost {
  id: string;
  title: string;
  slug: string;
  excerpt?: string;
  author?: string;
  category?: string;
  tags: string[];
  status: "DRAFT" | "PUBLISHED";
  featured: boolean;
  publishedAt?: string;
  createdAt: string;
}

export default function AdminBlogPage() {
  const router = useRouter();
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [deleting, setDeleting] = useState<string | null>(null);

  async function loadPosts() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/blog?limit=100", { credentials: "include" });
      const data = await res.json();
      setPosts(data.posts || []);
    } catch {
      console.error("Failed to load posts");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadPosts(); }, []);

  async function togglePublish(post: BlogPost) {
    const newStatus = post.status === "PUBLISHED" ? "DRAFT" : "PUBLISHED";
    try {
      await fetch(`/api/admin/blog/${post.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ status: newStatus }),
      });
      setPosts(ps => ps.map(p => p.id === post.id ? { ...p, status: newStatus } : p));
    } catch {
      alert("Failed to update status");
    }
  }

  async function toggleFeatured(post: BlogPost) {
    try {
      await fetch(`/api/admin/blog/${post.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ featured: !post.featured }),
      });
      setPosts(ps => ps.map(p => p.id === post.id ? { ...p, featured: !p.featured } : p));
    } catch {
      alert("Failed to update");
    }
  }

  async function deletePost(id: string) {
    if (!confirm("Delete this post? This cannot be undone.")) return;
    setDeleting(id);
    try {
      await fetch(`/api/admin/blog/${id}`, { method: "DELETE", credentials: "include" });
      setPosts(ps => ps.filter(p => p.id !== id));
    } catch {
      alert("Failed to delete post");
    } finally {
      setDeleting(null);
    }
  }

  const filtered = posts.filter(p => {
    const matchSearch = p.title.toLowerCase().includes(search.toLowerCase()) ||
      (p.category || "").toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "all" || p.status.toLowerCase() === statusFilter ||
      (statusFilter === "featured" && p.featured);
    return matchSearch && matchStatus;
  });

  const stats = {
    total: posts.length,
    published: posts.filter(p => p.status === "PUBLISHED").length,
    drafts: posts.filter(p => p.status === "DRAFT").length,
    featured: posts.filter(p => p.featured).length,
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Blog Posts</h1>
          <p className="text-gray-500 text-sm mt-1">Write and manage your blog articles</p>
        </div>
        <Link href="/admin/content/blog/new" className="btn-primary flex items-center gap-2 text-sm">
          <PlusCircle className="w-4 h-4" />
          New Post
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          { label: "Total Posts", value: stats.total, color: "text-gray-700" },
          { label: "Published", value: stats.published, color: "text-green-600" },
          { label: "Drafts", value: stats.drafts, color: "text-yellow-600" },
          { label: "Featured", value: stats.featured, color: "text-purple-600" },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-xl p-4 border">
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-gray-500 text-sm">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search posts..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="input pl-9 w-full"
          />
        </div>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="input w-40">
          <option value="all">All Posts</option>
          <option value="published">Published</option>
          <option value="draft">Drafts</option>
          <option value="featured">Featured</option>
        </select>
        <button onClick={loadPosts} className="btn-secondary p-2" disabled={loading}>
          <RefreshCw className={`w-5 h-5 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {/* Posts Table */}
      <div className="bg-white rounded-xl border overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-gray-400">Loading posts...</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center">
            <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">No posts found</p>
            <Link href="/admin/content/blog/new" className="btn-primary mt-4 inline-flex items-center gap-2 text-sm">
              <PlusCircle className="w-4 h-4" /> Write your first post
            </Link>
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Post</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase hidden md:table-cell">Category</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase hidden md:table-cell">Date</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.map(post => (
                <tr key={post.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div>
                      <p className="font-medium text-sm">{post.title}</p>
                      {post.excerpt && <p className="text-xs text-gray-400 truncate max-w-xs mt-0.5">{post.excerpt}</p>}
                      {post.tags.length > 0 && (
                        <div className="flex gap-1 mt-1 flex-wrap">
                          {post.tags.slice(0, 3).map(t => (
                            <span key={t} className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded text-xs">
                              <Tag className="w-2.5 h-2.5" />{t}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    {post.category ? (
                      <span className="px-2 py-1 bg-purple-50 text-purple-700 rounded-full text-xs">{post.category}</span>
                    ) : <span className="text-gray-400 text-xs">—</span>}
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <div className="flex items-center gap-1 text-xs text-gray-500">
                      <Calendar className="w-3 h-3" />
                      {post.publishedAt
                        ? new Date(post.publishedAt).toLocaleDateString()
                        : new Date(post.createdAt).toLocaleDateString()}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        post.status === "PUBLISHED"
                          ? "bg-green-100 text-green-700"
                          : "bg-yellow-100 text-yellow-700"
                      }`}>
                        {post.status === "PUBLISHED" ? "Live" : "Draft"}
                      </span>
                      {post.featured && (
                        <span className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded-full text-xs font-medium">Featured</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => toggleFeatured(post)}
                        className={`p-1.5 rounded ${post.featured ? "text-purple-500 hover:text-purple-700" : "text-gray-400 hover:text-gray-600"}`}
                        title={post.featured ? "Unfeature" : "Feature"}
                      >
                        <Star className="w-4 h-4" fill={post.featured ? "currentColor" : "none"} />
                      </button>
                      <button
                        onClick={() => togglePublish(post)}
                        className={`p-1.5 rounded ${post.status === "PUBLISHED" ? "text-green-500 hover:text-red-500" : "text-gray-400 hover:text-green-500"}`}
                        title={post.status === "PUBLISHED" ? "Unpublish" : "Publish"}
                      >
                        {post.status === "PUBLISHED" ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                      </button>
                      <Link href={`/admin/content/blog/${post.id}`} className="p-1.5 rounded text-blue-500 hover:text-blue-700" title="Edit">
                        <Edit2 className="w-4 h-4" />
                      </Link>
                      <button
                        onClick={() => deletePost(post.id)}
                        disabled={deleting === post.id}
                        className="p-1.5 rounded text-red-400 hover:text-red-600 disabled:opacity-50"
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
        )}
      </div>
    </div>
  );
}
