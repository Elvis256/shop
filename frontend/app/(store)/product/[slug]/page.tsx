import { Metadata } from "next";
import ProductPageClient from "./ProductPageClient";
import ProductSchema from "@/components/schemas/ProductSchema";
import Breadcrumb from "@/components/schemas/BreadcrumbSchema";

const API_URL = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://ugsex.com";

interface Props {
  params: Promise<{ slug: string }>;
}

async function getProduct(slug: string) {
  try {
    const res = await fetch(`${API_URL}/api/products/${slug}`, { next: { revalidate: 3600 } });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProduct(slug);
  if (!product) return {};

  const title = `${product.name} | PleasureZone`;
  const description = product.description
    ? product.description.replace(/<[^>]*>/g, '').slice(0, 160)
    : `Buy ${product.name} online. Fast discreet delivery.`;
  const image = product.imageUrl || product.images?.[0]?.url;
  const canonicalUrl = `${SITE_URL}/product/${slug}`;

  return {
    title,
    description,
    alternates: { canonical: canonicalUrl },
    openGraph: {
      title,
      description,
      url: canonicalUrl,
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
}

function ProductJsonLd({ product, slug }: { product: Record<string, unknown>; slug: string }) {
  const image = (product.imageUrl as string) || (product.images as { url: string }[])?.[0]?.url;
  const plainDescription = (product.description as string)
    ?.replace(/<[^>]*>/g, '').slice(0, 500) || '';
  const price = (product.salePrice as number) || (product.price as number) || 0;
  const inStock = (product.stock as number) > 0 && product.status === 'ACTIVE';
  const rating = product.averageRating as number | undefined;
  const reviewCount = product.reviewCount as number | undefined;
  const category = product.category as { name: string } | undefined;

  return (
    <>
      <ProductSchema
        name={product.name as string}
        description={plainDescription}
        image={image}
        sku={product.sku as string || product.id as string}
        brand="PleasureZone"
        offers={{
          priceCurrency: 'UGX',
          price: price.toString(),
          availability: inStock ? 'InStock' : 'OutOfStock',
          url: `${SITE_URL}/product/${slug}`,
        }}
        ratingValue={rating}
        reviewCount={reviewCount}
        category={category?.name}
      />
      <Breadcrumb
        items={[
          { name: 'Home', url: SITE_URL },
          ...(category ? [{ name: category.name, url: `${SITE_URL}/category?cat=${encodeURIComponent(category.name)}` }] : []),
          { name: product.name as string, url: `${SITE_URL}/product/${slug}` }
        ]}
      />
    </>
  );
}

export default async function ProductPage({ params }: Props) {
  const { slug } = await params;
  const product = await getProduct(slug);

  return (
    <>
      {product && <ProductJsonLd product={product} slug={slug} />}
      <ProductPageClient />
    </>
  );
}
