/**
 * Related Blog Posts Section
 * Displays blog posts for internal linking and engagement
 * Improves time on site and indexing
 */

import Link from "next/link";
import Image from "next/image";
import { CalendarIcon, UserIcon } from "lucide-react";

interface BlogPost {
  id: string;
  slug: string;
  title: string;
  excerpt?: string;
  featuredImage?: string;
  author?: string;
  publishedAt?: string;
}

interface RelatedBlogPostsProps {
  posts: BlogPost[];
  title?: string;
  className?: string;
}

export default function RelatedBlogPosts({
  posts,
  title = "Related Blog Posts",
  className = "",
}: RelatedBlogPostsProps) {
  if (!posts || posts.length === 0) return null;

  const formatDate = (dateString?: string) => {
    if (!dateString) return null;
    try {
      return new Date(dateString).toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    } catch {
      return null;
    }
  };

  return (
    <div className={`py-8 ${className}`}>
      <h2 className="text-2xl font-bold mb-6 text-gray-900">{title}</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {posts.map((post) => (
          <Link
            key={post.id}
            href={`/blog/${post.slug}`}
            className="group"
          >
            <div className="flex gap-4">
              {post.featuredImage && (
                <div className="relative w-32 h-32 flex-shrink-0 bg-gray-100 rounded-lg overflow-hidden">
                  <Image
                    src={post.featuredImage}
                    alt={post.title}
                    fill
                    className="object-cover group-hover:scale-105 transition-transform"
                  />
                </div>
              )}
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900 line-clamp-2 group-hover:text-pink-600 transition-colors">
                  {post.title}
                </h3>
                {post.excerpt && (
                  <p className="text-sm text-gray-600 line-clamp-2 mt-2">
                    {post.excerpt}
                  </p>
                )}
                <div className="flex items-center gap-3 mt-3 text-xs text-gray-500">
                  {post.publishedAt && (
                    <div className="flex items-center gap-1">
                      <CalendarIcon className="w-3 h-3" />
                      {formatDate(post.publishedAt)}
                    </div>
                  )}
                  {post.author && (
                    <div className="flex items-center gap-1">
                      <UserIcon className="w-3 h-3" />
                      {post.author}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
