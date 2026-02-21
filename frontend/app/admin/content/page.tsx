"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Image as ImageIcon,
  FileText,
  Megaphone,
  Plus,
  ArrowRight,
} from "lucide-react";

interface ContentStats {
  banners: number;
  pages: number;
  blogPosts: number;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

const contentSections = [
  {
    id: "banners",
    title: "Banners",
    description: "Manage homepage hero banners and promotional images",
    icon: ImageIcon,
    href: "/admin/content/banners",
    color: "from-blue-500 to-indigo-600",
    bgColor: "bg-blue-50",
  },
  {
    id: "pages",
    title: "Pages",
    description: "Edit static pages like About, FAQ, Terms, and Privacy",
    icon: FileText,
    href: "/admin/content/pages",
    color: "from-emerald-500 to-teal-600",
    bgColor: "bg-emerald-50",
  },
  {
    id: "blog",
    title: "Blog",
    description: "Write and manage blog posts and articles",
    icon: Megaphone,
    href: "/admin/content/blog",
    color: "from-purple-500 to-pink-600",
    bgColor: "bg-purple-50",
  },
];

export default function ContentPage() {
  const [stats, setStats] = useState<ContentStats>({
    banners: 0,
    pages: 0,
    blogPosts: 0,
  });
  const [loading, setLoading] = useState(true);

  const loadStats = async () => {
    setLoading(true);
    try {
      // Load banner count
      const bannersRes = await fetch(`${API_URL}/api/banners`, {
        credentials: "include",
      });
      if (bannersRes.ok) {
        const data = await bannersRes.json();
        const bannerCount = Array.isArray(data) ? data.length : data.banners?.length || 0;
        setStats((s) => ({ ...s, banners: bannerCount }));
      }

      // Load blog posts count
      const blogRes = await fetch(`${API_URL}/api/blog`, {
        credentials: "include",
      });
      if (blogRes.ok) {
        const data = await blogRes.json();
        const blogCount = Array.isArray(data) ? data.length : data.posts?.length || 0;
        setStats((s) => ({ ...s, blogPosts: blogCount }));
      }

      // Static pages count (we'll have a fixed set)
      setStats((s) => ({ ...s, pages: 5 }));
    } catch (error) {
      console.error("Failed to load content stats:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStats();
  }, []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">Content Management</h1>
        <p className="text-gray-500 mt-1">Manage your store&apos;s content and marketing materials</p>
      </div>

      {/* Content Sections */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {contentSections.map((section) => {
          const count = section.id === "banners" 
            ? stats.banners 
            : section.id === "pages" 
              ? stats.pages 
              : stats.blogPosts;

          return (
            <Link
              key={section.id}
              href={section.href}
              className="group bg-white rounded-xl border shadow-sm p-6 hover:shadow-md transition-all"
            >
              <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${section.color} flex items-center justify-center mb-4`}>
                <section.icon className="w-7 h-7 text-white" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 group-hover:text-primary transition-colors">
                {section.title}
              </h3>
              <p className="text-sm text-gray-500 mt-1 mb-4">{section.description}</p>
              <div className="flex items-center justify-between">
                <span className={`inline-flex px-3 py-1 rounded-full text-sm font-medium ${section.bgColor} text-gray-700`}>
                  {loading ? "..." : count} items
                </span>
                <span className="flex items-center gap-1 text-sm text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                  Manage <ArrowRight className="w-4 h-4" />
                </span>
              </div>
            </Link>
          );
        })}
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-xl border shadow-sm p-6">
        <h2 className="font-semibold text-gray-900 mb-4">Quick Actions</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Link
            href="/admin/content/banners"
            className="flex items-center gap-3 p-4 rounded-lg border border-dashed border-gray-300 hover:border-primary hover:bg-primary/5 transition-colors"
          >
            <Plus className="w-5 h-5 text-gray-400" />
            <span className="text-sm font-medium text-gray-600">Add Banner</span>
          </Link>
          <Link
            href="/admin/content/pages"
            className="flex items-center gap-3 p-4 rounded-lg border border-dashed border-gray-300 hover:border-primary hover:bg-primary/5 transition-colors"
          >
            <Plus className="w-5 h-5 text-gray-400" />
            <span className="text-sm font-medium text-gray-600">Edit Page</span>
          </Link>
          <Link
            href="/admin/content/blog"
            className="flex items-center gap-3 p-4 rounded-lg border border-dashed border-gray-300 hover:border-primary hover:bg-primary/5 transition-colors"
          >
            <Plus className="w-5 h-5 text-gray-400" />
            <span className="text-sm font-medium text-gray-600">Write Post</span>
          </Link>
          <Link
            href="/"
            target="_blank"
            className="flex items-center gap-3 p-4 rounded-lg border border-dashed border-gray-300 hover:border-primary hover:bg-primary/5 transition-colors"
          >
            <ArrowRight className="w-5 h-5 text-gray-400" />
            <span className="text-sm font-medium text-gray-600">View Store</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
