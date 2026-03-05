import { Metadata } from "next";
import ProductPageClient from "./ProductPageClient";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  try {
    const res = await fetch(`${API_URL}/api/products/${slug}`, { next: { revalidate: 3600 } });
    if (!res.ok) return {};
    const product = await res.json();
    const title = `${product.name} | UgSex`;
    const description = product.description
      ? product.description.slice(0, 160)
      : `Buy ${product.name} online. Fast discreet delivery.`;
    const image = product.imageUrl || product.images?.[0]?.url;
    return {
      title,
      description,
      openGraph: {
        title,
        description,
        url: `${API_URL}/product/${slug}`,
        images: image ? [{ url: image, width: 800, height: 800, alt: product.name }] : [],
        type: "website",
      },
      twitter: {
        card: "summary_large_image",
        title,
        description,
        images: image ? [image] : [],
      },
    };
  } catch {
    return {};
  }
}

export default function ProductPage({ params }: Props) {
  return <ProductPageClient />;
}
