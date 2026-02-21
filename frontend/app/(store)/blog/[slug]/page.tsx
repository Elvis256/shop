"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import Section from "@/components/Section";
import { Calendar, User, Tag, ArrowLeft, Share2, Facebook, Twitter } from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

interface BlogPost {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  featuredImage: string | null;
  author: string | null;
  category: string | null;
  tags: string[];
  publishedAt: string;
  relatedPosts: {
    id: string;
    title: string;
    slug: string;
    excerpt: string;
    featuredImage: string | null;
    publishedAt: string;
  }[];
}

export default function BlogPostPage() {
  const params = useParams();
  const slug = params.slug as string;
  const [post, setPost] = useState<BlogPost | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (slug) {
      loadPost();
    }
  }, [slug]);

  const loadPost = async () => {
    try {
      const res = await fetch(`${API_URL}/api/blog/${slug}`);
      if (res.ok) {
        const data = await res.json();
        setPost(data);
      }
    } catch (error) {
      console.error("Failed to load post:", error);
    } finally {
      setLoading(false);
    }
  };

  const shareUrl = typeof window !== "undefined" ? window.location.href : "";

  if (loading) {
    return (
      <Section>
        <div className="max-w-3xl mx-auto animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-3/4 mb-4" />
          <div className="h-4 bg-gray-200 rounded w-1/4 mb-8" />
          <div className="h-96 bg-gray-200 rounded-lg mb-8" />
          <div className="space-y-4">
            <div className="h-4 bg-gray-200 rounded" />
            <div className="h-4 bg-gray-200 rounded" />
            <div className="h-4 bg-gray-200 rounded w-3/4" />
          </div>
        </div>
      </Section>
    );
  }

  if (!post) {
    return (
      <Section>
        <div className="text-center py-16">
          <h1 className="text-2xl font-bold mb-4">Article Not Found</h1>
          <p className="text-gray-600 mb-8">The article you're looking for doesn't exist.</p>
          <Link href="/blog" className="btn-primary">
            Back to Blog
          </Link>
        </div>
      </Section>
    );
  }

  return (
    <>
      <Section>
        <div className="max-w-3xl mx-auto">
          {/* Back Link */}
          <Link
            href="/blog"
            className="inline-flex items-center gap-2 text-gray-600 hover:text-accent mb-8"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Blog
          </Link>

          {/* Header */}
          <header className="mb-8">
            {post.category && (
              <Link
                href={`/blog?category=${post.category}`}
                className="text-accent text-sm font-medium uppercase tracking-wide hover:underline"
              >
                {post.category}
              </Link>
            )}
            <h1 className="text-3xl md:text-4xl font-bold mt-2 mb-4">{post.title}</h1>
            
            <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500">
              {post.author && (
                <span className="flex items-center gap-1">
                  <User className="w-4 h-4" />
                  {post.author}
                </span>
              )}
              <span className="flex items-center gap-1">
                <Calendar className="w-4 h-4" />
                {new Date(post.publishedAt).toLocaleDateString("en-US", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </span>
            </div>
          </header>

          {/* Featured Image */}
          {post.featuredImage && (
            <div className="relative aspect-video rounded-xl overflow-hidden mb-8">
              <Image
                src={post.featuredImage}
                alt={post.title}
                fill
                className="object-cover"
                priority
              />
            </div>
          )}

          {/* Content */}
          <article
            className="prose prose-lg max-w-none mb-12"
            dangerouslySetInnerHTML={{ __html: post.content }}
          />

          {/* Tags */}
          {post.tags.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 mb-8">
              <Tag className="w-4 h-4 text-gray-500" />
              {post.tags.map((tag) => (
                <Link
                  key={tag}
                  href={`/blog?tag=${tag}`}
                  className="px-3 py-1 bg-gray-100 rounded-full text-sm text-gray-700 hover:bg-gray-200"
                >
                  {tag}
                </Link>
              ))}
            </div>
          )}

          {/* Share */}
          <div className="flex items-center gap-4 py-6 border-t border-b">
            <span className="font-medium">Share:</span>
            <a
              href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 bg-blue-600 text-white rounded-full hover:bg-blue-700"
            >
              <Facebook className="w-5 h-5" />
            </a>
            <a
              href={`https://twitter.com/intent/tweet?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(post.title)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 bg-sky-500 text-white rounded-full hover:bg-sky-600"
            >
              <Twitter className="w-5 h-5" />
            </a>
            <button
              onClick={() => navigator.clipboard.writeText(shareUrl)}
              className="p-2 bg-gray-200 text-gray-700 rounded-full hover:bg-gray-300"
            >
              <Share2 className="w-5 h-5" />
            </button>
          </div>
        </div>
      </Section>

      {/* Related Posts */}
      {post.relatedPosts && post.relatedPosts.length > 0 && (
        <Section className="bg-gray-50">
          <h2 className="text-2xl font-bold mb-8 text-center">Related Articles</h2>
          <div className="grid md:grid-cols-3 gap-6">
            {post.relatedPosts.map((related) => (
              <Link
                key={related.id}
                href={`/blog/${related.slug}`}
                className="group bg-white rounded-xl overflow-hidden shadow hover:shadow-lg transition-shadow"
              >
                <div className="aspect-video bg-gray-100 relative">
                  {related.featuredImage ? (
                    <Image
                      src={related.featuredImage}
                      alt={related.title}
                      fill
                      className="object-cover group-hover:scale-105 transition-transform"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-400">
                      <span className="text-4xl">📝</span>
                    </div>
                  )}
                </div>
                <div className="p-4">
                  <h3 className="font-bold group-hover:text-accent transition-colors line-clamp-2">
                    {related.title}
                  </h3>
                  <p className="text-sm text-gray-500 mt-2">
                    {new Date(related.publishedAt).toLocaleDateString()}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </Section>
      )}
    </>
  );
}
