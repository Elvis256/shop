"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Image as ImageIcon,
  FileText,
  BookOpen,
  Plus,
  ArrowRight,
  ExternalLink,
  RefreshCw,
} from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

interface SectionStats {
  count: number;
  lastUpdated: string | null;
}

export default function ContentPage() {
  const [stats, setStats] = useState<Record<string, SectionStats>>({
    banners: { count: 0, lastUpdated: null },
    pages: { count: 5, lastUpdated: null },
    blog: { count: 0, lastUpdated: null },
  });
  const [loading, setLoading] = useState(true);

  const loadStats = async () => {
    setLoading(true);
    try {
      const [bannersRes, blogRes] = await Promise.all([
        fetch(`${API_URL}/api/banners`, { credentials: "include" }).catch(() => null),
        fetch(`${API_URL}/api/blog`, { credentials: "include" }).catch(() => null),
      ]);

      const banners = bannersRes?.ok ? await bannersRes.json() : null;
      const bannerList = banners ? (Array.isArray(banners) ? banners : banners.banners || []) : [];

      const blog = blogRes?.ok ? await blogRes.json() : null;
      const postList = blog ? (Array.isArray(blog) ? blog : blog.posts || []) : [];

      setStats({
        banners: {
          count: bannerList.length,
          lastUpdated: bannerList[0]?.createdAt || null,
        },
        pages: { count: 5, lastUpdated: null },
        blog: {
          count: postList.length,
          lastUpdated: postList[0]?.createdAt || postList[0]?.publishedAt || null,
        },
      });
    } catch (error) {
      console.error("Failed to load content stats:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadStats(); }, []);

  const sections = [
    { id: "banners", title: "Banners", desc: "Homepage hero banners and promotions", icon: ImageIcon, href: "/admin/content/banners" },
    { id: "pages", title: "Pages", desc: "Static pages like About, FAQ, Terms", icon: FileText, href: "/admin/content/pages" },
    { id: "blog", title: "Blog", desc: "Blog posts and articles", icon: BookOpen, href: "/admin/content/blog" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Content Management</h1>
          <p className="text-gray-500 text-sm mt-1">Manage your store&apos;s content and media</p>
        </div>
        <button onClick={loadStats} disabled={loading} className="p-2 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors disabled:opacity-50">
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        {sections.map((s) => {
          const stat = stats[s.id];
          return (
            <Link key={s.id} href={s.href} className="group bg-white border border-gray-200 rounded-lg p-5 hover:border-gray-300 transition-colors">
              <div className="flex items-start justify-between mb-3">
                <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center">
                  <s.icon className="w-5 h-5 text-gray-500" />
                </div>
                <span className="text-xs text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                  Manage <ArrowRight className="w-3 h-3" />
                </span>
              </div>
              <h3 className="font-semibold text-gray-900">{s.title}</h3>
              <p className="text-sm text-gray-500 mt-0.5 mb-3">{s.desc}</p>
              <div className="flex items-center justify-between text-xs text-gray-400">
                <span className="font-mono text-gray-900 text-sm">{loading ? "—" : stat.count}</span>
                {stat.lastUpdated && (
                  <span>Updated {new Date(stat.lastUpdated).toLocaleDateString()}</span>
                )}
              </div>
            </Link>
          );
        })}
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-5">
        <h2 className="text-sm font-semibold text-gray-900 mb-3">Quick Actions</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <Link href="/admin/content/banners" className="flex items-center gap-3 p-3 rounded-lg border border-dashed border-gray-300 hover:border-gray-400 hover:bg-gray-50 transition-colors">
            <Plus className="w-4 h-4 text-gray-400" />
            <span className="text-sm text-gray-600">Add Banner</span>
          </Link>
          <Link href="/admin/content/pages" className="flex items-center gap-3 p-3 rounded-lg border border-dashed border-gray-300 hover:border-gray-400 hover:bg-gray-50 transition-colors">
            <FileText className="w-4 h-4 text-gray-400" />
            <span className="text-sm text-gray-600">Edit Page</span>
          </Link>
          <Link href="/admin/content/blog/new" className="flex items-center gap-3 p-3 rounded-lg border border-dashed border-gray-300 hover:border-gray-400 hover:bg-gray-50 transition-colors">
            <BookOpen className="w-4 h-4 text-gray-400" />
            <span className="text-sm text-gray-600">Write Post</span>
          </Link>
          <Link href="/" target="_blank" className="flex items-center gap-3 p-3 rounded-lg border border-dashed border-gray-300 hover:border-gray-400 hover:bg-gray-50 transition-colors">
            <ExternalLink className="w-4 h-4 text-gray-400" />
            <span className="text-sm text-gray-600">View Store</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
