import { Metadata } from "next";
import BlogPostClient from "./BlogPostClient";
import ArticleSchema from "@/components/schemas/ArticleSchema";
import BreadcrumbSchema from "@/components/schemas/BreadcrumbSchema";
import BreadcrumbUI from "@/components/ui/BreadcrumbUI";
import RelatedBlogPosts from "@/components/ui/RelatedBlogPosts";

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
    const title = `${post.title} | PleasureZone Blog`;
    const rawExcerpt = post.excerpt || post.content?.replace(/<[^>]*>/g, "").slice(0, 200) || "";
    const description = rawExcerpt
      ? `${rawExcerpt.slice(0, 140)} Read more on PleasureZone Blog.`.slice(0, 160)
      : `Read ${post.title} on PleasureZone Blog. Tips, guides & product reviews.`;
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

async function getRelatedPosts(currentSlug: string) {
  try {
    const res = await fetch(`${API_URL}/api/blog?limit=4`, { next: { revalidate: 3600 } });
    if (!res.ok) return [];
    const data = await res.json();
    const posts = data.posts || data;
    return (posts as Array<Record<string, unknown>>)
      .filter((p) => p.slug !== currentSlug)
      .slice(0, 3);
  } catch {
    return [];
  }
}

export default async function BlogPostPage({ params }: Props) {
  const { slug } = await params;
  const post = await getBlogPost(slug);
  const relatedPosts = await getRelatedPosts(slug);

  const breadcrumbItems = [
    { name: "Home", url: "/" },
    { name: "Blog", url: "/blog" },
    { name: post?.title || slug },
  ];

  return (
    <>
      {post && (
        <>
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
          <BreadcrumbSchema
            items={[
              { name: "Home", url: SITE_URL },
              { name: "Blog", url: `${SITE_URL}/blog` },
              { name: post.title, url: `${SITE_URL}/blog/${slug}` },
            ]}
          />
        </>
      )}
      <div className="max-w-4xl mx-auto px-4">
        <BreadcrumbUI items={breadcrumbItems} className="my-4" />
      </div>
      <BlogPostClient />
      {relatedPosts.length > 0 && (
        <div className="max-w-4xl mx-auto px-4">
          <RelatedBlogPosts
            posts={relatedPosts.map((p: Record<string, unknown>) => ({
              id: p.id as string,
              slug: p.slug as string,
              title: p.title as string,
              excerpt: p.excerpt as string | undefined,
              featuredImage: p.featuredImage as string | undefined,
              author: p.author as string | undefined,
              publishedAt: p.publishedAt as string | undefined,
            }))}
            title="More from Our Blog"
          />
        </div>
      )}
    </>
  );
}
