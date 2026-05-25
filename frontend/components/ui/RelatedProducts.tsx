/**
 * Related Products Section
 * Displays products from same category for internal linking
 * Improves UX and increases page views
 */

import Link from "next/link";
import Image from "next/image";

interface Product {
  id: string;
  slug: string;
  name: string;
  price: number;
  salePrice?: number;
  imageUrl?: string;
  category?: string;
}

interface RelatedProductsProps {
  products: Product[];
  title?: string;
  className?: string;
}

export default function RelatedProducts({
  products,
  title = "Related Products",
  className = "",
}: RelatedProductsProps) {
  if (!products || products.length === 0) return null;

  return (
    <div className={`py-8 ${className}`}>
      <h2 className="text-2xl font-bold mb-6 text-gray-900">{title}</h2>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {products.map((product) => (
          <Link
            key={product.id}
            href={`/product/${product.slug}`}
            className="group"
          >
            <div className="relative aspect-square mb-2 bg-gray-100 rounded-lg overflow-hidden">
              {product.imageUrl ? (
                <Image
                  src={product.imageUrl}
                  alt={product.name}
                  fill
                  className="object-cover group-hover:scale-105 transition-transform"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-gray-200 text-gray-400">
                  No Image
                </div>
              )}
            </div>
            <h3 className="text-sm font-semibold text-gray-900 line-clamp-2 group-hover:text-pink-600 transition-colors">
              {product.name}
            </h3>
            <div className="text-sm text-gray-600 mt-1">
              {product.salePrice ? (
                <>
                  <span className="line-through text-xs text-gray-400">
                    {product.price.toLocaleString()} UGX
                  </span>
                  <span className="ml-2 font-semibold text-pink-600">
                    {product.salePrice.toLocaleString()} UGX
                  </span>
                </>
              ) : (
                <span className="font-semibold text-pink-600">
                  {product.price.toLocaleString()} UGX
                </span>
              )}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
