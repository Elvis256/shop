import { Metadata } from "next";
import ProductPageClient from "./ProductPageClient";
import ProductSchema from "@/components/schemas/ProductSchema";
import Breadcrumb from "@/components/schemas/BreadcrumbSchema";
import BreadcrumbUI from "@/components/ui/BreadcrumbUI";
import RelatedProducts from "@/components/ui/RelatedProducts";

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

async function getRelatedProducts(categoryId: string, excludeSlug: string) {
  try {
    const res = await fetch(
      `${API_URL}/api/products?category=${categoryId}&limit=4`,
      { next: { revalidate: 3600 } }
    );
    if (!res.ok) return [];
    const data = await res.json();
    const products = data.products || data;
    return (products as Array<Record<string, unknown>>)
      .filter((p) => p.slug !== excludeSlug)
      .slice(0, 4);
  } catch {
    return [];
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProduct(slug);
  if (!product) return {};

  const category = product.category as { name: string } | undefined;
  const title = `${product.name}${category ? ` - ${category.name}` : ''} | PleasureZone Uganda`;
  const rawDesc = product.description?.replace(/<[^>]*>/g, '') || '';
  const description = rawDesc
    ? `${rawDesc.slice(0, 120)} Shop ${product.name} online at PleasureZone Uganda. Fast discreet delivery.`.slice(0, 160)
    : `Buy ${product.name} online at PleasureZone Uganda. ${category ? `Best ${category.name} with` : 'Fast'} discreet delivery & secure checkout.`;
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
  const category = product?.category as { id: string; name: string } | undefined;
  const relatedProducts = category?.id
    ? await getRelatedProducts(category.id, slug)
    : [];

  const breadcrumbItems = [
    { name: "Home", url: "/" },
    ...(category ? [{ name: category.name, url: `/category?cat=${encodeURIComponent(category.name)}` }] : []),
    { name: product?.name as string || slug },
  ];

  return (
    <>
      {product && <ProductJsonLd product={product} slug={slug} />}
      <div className="max-w-7xl mx-auto px-4">
        <BreadcrumbUI items={breadcrumbItems} className="my-4" />
      </div>
      <ProductPageClient initialProduct={product} />
      {relatedProducts.length > 0 && (
        <div className="max-w-7xl mx-auto px-4">
          <RelatedProducts
            products={relatedProducts.map((p: Record<string, unknown>) => ({
              id: p.id as string,
              slug: p.slug as string,
              name: p.name as string,
              price: p.price as number,
              salePrice: p.salePrice as number | undefined,
              imageUrl: (p.imageUrl as string) || (p.images as { url: string }[])?.[0]?.url,
            }))}
            title="You May Also Like"
          />
        </div>
      )}
    </>
  );
}
