import { Metadata } from "next";
import BlogPostClient from "./BlogPostClient";
import ArticleSchema from "@/components/schemas/ArticleSchema";

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

async function getBlogPost(slug: string) {
  try {
    const res = await fetch(`${API_URL}/api/blog/${slug}`, { next: { revalidate: 3600 } });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export default async function BlogPostPage({ params }: Props) {
  const { slug } = await params;
  const post = await getBlogPost(slug);

  return (
    <>
      {post && (
        <ArticleSchema
          title={post.title}
          description={post.excerpt || post.content?.replace(/<[^>]*>/g, "").slice(0, 160) || ""}
          image={post.featuredImage}
          publishedAt={post.publishedAt}
          updatedAt={post.updatedAt || post.publishedAt}
          author={{ name: post.author || "PleasureZone" }}
          content={post.content}
          postUrl={`${SITE_URL}/blog/${slug}`}
        />
      )}
      <BlogPostClient />
    </>
  );
}
