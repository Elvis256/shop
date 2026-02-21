"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import Section from "@/components/Section";
import { Calendar, User, Tag, ArrowRight, Search, BookOpen } from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

interface BlogPost {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  featuredImage: string | null;
  author: string | null;
  category: string | null;
  tags: string[];
  featured: boolean;
  publishedAt: string;
}

interface BlogCategory {
  name: string;
  count: number;
}

export default function BlogPage() {
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [categories, setCategories] = useState<BlogCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    loadData();
  }, [selectedCategory]);

  const loadData = async () => {
    try {
      const categoryParam = selectedCategory ? `&category=${selectedCategory}` : "";
      const [postsRes, categoriesRes] = await Promise.all([
        fetch(`${API_URL}/api/blog?limit=12${categoryParam}`),
        fetch(`${API_URL}/api/blog/categories`),
      ]);

      if (postsRes.ok) {
        const data = await postsRes.json();
        setPosts(data.posts || []);
      }

      if (categoriesRes.ok) {
        const data = await categoriesRes.json();
        setCategories(data || []);
      }
    } catch (error) {
      console.error("Failed to load blog:", error);
    } finally {
      setLoading(false);
    }
  };

  const filteredPosts = searchQuery
    ? posts.filter(
        (post) =>
          post.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          post.excerpt?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : posts;

  const featuredPost = filteredPosts.find((p) => p.featured);
  const regularPosts = filteredPosts.filter((p) => !p.featured || p.id !== featuredPost?.id);

  if (loading) {
    return (
      <div className="bg-gray-50 min-h-screen">
        <div className="container py-12">
          <div className="animate-pulse space-y-8">
            <div className="h-12 bg-gray-200 rounded w-1/3 mx-auto" />
            <div className="h-80 bg-white rounded-xl" />
            <div className="grid md:grid-cols-3 gap-6">
              {[1, 2, 3].map((i) => (
                <div key={i} className="bg-white rounded-xl overflow-hidden">
                  <div className="h-48 bg-gray-200" />
                  <div className="p-5 space-y-3">
                    <div className="h-5 bg-gray-200 rounded w-3/4" />
                    <div className="h-4 bg-gray-200 rounded" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-50 min-h-screen">
      {/* Hero Section */}
      <div className="bg-gradient-to-br from-primary via-primary-hover to-violet-600 text-white py-16 sm:py-20">
        <div className="container">
          <div className="text-center max-w-3xl mx-auto">
            <div className="inline-flex items-center gap-2 bg-white/20 backdrop-blur-sm px-4 py-1.5 rounded-full text-sm font-medium mb-6">
              <BookOpen className="w-4 h-4" />
              Our Blog
            </div>
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-4">
              Pleasure Zone Blog
            </h1>
            <p className="text-lg text-white/80 mb-8">
              Tips, guides, and insights on intimacy, wellness, and self-care. 
              Empowering you to explore with confidence.
            </p>

            {/* Search */}
            <div className="relative max-w-md mx-auto">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search articles..."
                className="w-full pl-12 pr-4 py-3.5 border-0 rounded-full focus:ring-2 focus:ring-white/50 text-gray-900 shadow-lg"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="container py-12">
        {/* Categories */}
        {categories.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-10 justify-center">
            <button
              onClick={() => setSelectedCategory(null)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                !selectedCategory
                  ? "bg-primary text-white shadow-md"
                  : "bg-white text-gray-700 hover:bg-gray-100 border border-gray-200"
              }`}
            >
              All Articles
            </button>
            {categories.map((cat) => (
              <button
                key={cat.name}
                onClick={() => setSelectedCategory(cat.name)}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                  selectedCategory === cat.name
                    ? "bg-primary text-white shadow-md"
                    : "bg-white text-gray-700 hover:bg-gray-100 border border-gray-200"
                }`}
              >
                {cat.name} ({cat.count})
              </button>
            ))}
          </div>
        )}

        {/* Featured Post */}
        {featuredPost && (
          <Link href={`/blog/${featuredPost.slug}`} className="block mb-12">
            <div className="grid lg:grid-cols-2 gap-0 bg-white rounded-2xl overflow-hidden shadow-lg hover:shadow-xl transition-shadow group">
              <div className="aspect-video lg:aspect-auto bg-gray-100 relative min-h-[250px] lg:min-h-[350px]">
                {featuredPost.featuredImage ? (
                  <Image
                    src={featuredPost.featuredImage}
                    alt={featuredPost.title}
                    fill
                    className="object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary-50 to-violet-50">
                    <BookOpen className="w-16 h-16 text-primary/30" />
                  </div>
                )}
                <span className="absolute top-4 left-4 bg-primary text-white px-3 py-1.5 rounded-full text-sm font-medium">
                  Featured
                </span>
              </div>
              <div className="p-6 sm:p-8 lg:p-10 flex flex-col justify-center">
                {featuredPost.category && (
                  <span className="text-primary text-sm font-medium mb-3">
                    {featuredPost.category}
                  </span>
                )}
                <h2 className="text-xl sm:text-2xl lg:text-3xl font-bold mb-4 text-gray-900 group-hover:text-primary transition-colors">
                  {featuredPost.title}
                </h2>
                <p className="text-gray-600 mb-6 line-clamp-3 leading-relaxed">{featuredPost.excerpt}</p>
                <div className="flex items-center gap-4 text-sm text-gray-500 mb-6">
                  {featuredPost.author && (
                    <span className="flex items-center gap-1.5">
                      <User className="w-4 h-4" />
                      {featuredPost.author}
                    </span>
                  )}
                  <span className="flex items-center gap-1.5">
                    <Calendar className="w-4 h-4" />
                    {new Date(featuredPost.publishedAt).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </span>
                </div>
                <span className="text-primary font-semibold flex items-center gap-2 group-hover:gap-3 transition-all">
                  Read Article <ArrowRight className="w-4 h-4" />
                </span>
              </div>
            </div>
          </Link>
        )}

        {/* Posts Grid */}
        {regularPosts.length > 0 ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {regularPosts.map((post) => (
              <Link
                key={post.id}
                href={`/blog/${post.slug}`}
                className="group bg-white rounded-xl overflow-hidden shadow-sm hover:shadow-md border border-gray-100 transition-all"
              >
                <div className="aspect-video bg-gray-100 relative overflow-hidden">
                  {post.featuredImage ? (
                    <Image
                      src={post.featuredImage}
                      alt={post.title}
                      fill
                      className="object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100">
                      <BookOpen className="w-10 h-10 text-gray-300" />
                    </div>
                  )}
                </div>
                <div className="p-5">
                  {post.category && (
                    <span className="text-primary text-xs font-semibold uppercase tracking-wide">
                      {post.category}
                    </span>
                  )}
                  <h3 className="font-bold text-lg mt-2 mb-2 text-gray-900 group-hover:text-primary transition-colors line-clamp-2">
                    {post.title}
                  </h3>
                  <p className="text-gray-500 text-sm line-clamp-2 mb-4">{post.excerpt}</p>
                  <div className="flex items-center justify-between text-xs text-gray-400">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5" />
                      {new Date(post.publishedAt).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                      })}
                    </span>
                    {post.tags.length > 0 && (
                      <span className="flex items-center gap-1 bg-gray-100 px-2 py-0.5 rounded-full">
                        <Tag className="w-3 h-3" />
                        {post.tags[0]}
                      </span>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="text-center py-16">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <BookOpen className="w-8 h-8 text-gray-400" />
            </div>
            <p className="text-gray-500 text-lg">No articles found. Check back soon!</p>
          </div>
        )}
      </div>

      {/* Newsletter CTA */}
      <Section bgColor="gray">
        <div className="bg-gradient-to-br from-gray-900 via-gray-900 to-primary-700 text-white rounded-2xl p-8 sm:p-12 lg:p-16 text-center">
          <h2 className="text-2xl sm:text-3xl font-bold mb-4">Stay Updated</h2>
          <p className="text-gray-300 mb-8 max-w-xl mx-auto">
            Subscribe to our newsletter for the latest articles, tips, and exclusive offers.
          </p>
          <Link 
            href="/#newsletter" 
            className="inline-flex items-center gap-2 bg-primary text-white px-8 py-3.5 rounded-full font-semibold hover:bg-primary-hover transition-colors group"
          >
            Subscribe Now
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </Link>
        </div>
      </Section>
    </div>
  );
}
