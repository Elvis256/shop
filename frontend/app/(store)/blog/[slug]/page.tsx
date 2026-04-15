import { Metadata } from "next";
import BlogPostClient from "./BlogPostClient";

const API_URL = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://ugsex.com";

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  try {
    const res = await fetch(`${API_URL}/api/blog/${slug}`, { next: { revalidate: 3600 } });
    if (!res.ok) return {};
    const post = await res.json();
    const title = post.title;
    const description = post.excerpt
      ? post.excerpt.slice(0, 160)
      : post.content?.replace(/<[^>]*>/g, "").slice(0, 160) || "";
    const canonicalUrl = `${SITE_URL}/blog/${slug}`;

    return {
      title,
      description,
      alternates: {
        canonical: canonicalUrl,
      },
      openGraph: {
        title,
        description,
        url: canonicalUrl,
        type: "article",
        publishedTime: post.publishedAt,
        authors: post.author ? [post.author] : undefined,
        images: post.featuredImage
          ? [{ url: post.featuredImage, width: 1200, height: 630, alt: post.title }]
          : [],
      },
      twitter: {
        card: "summary_large_image",
        title,
        description,
        images: post.featuredImage ? [post.featuredImage] : [],
      },
    };
  } catch {
    return {};
  }
}

export default function BlogPostPage() {
  return <BlogPostClient />;
}
