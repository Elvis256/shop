"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Section from "@/components/Section";
import ProductGallery from "@/components/ProductGallery";
import ProductTabs from "@/components/ProductTabs";
import AddToCartButton from "@/components/AddToCartButton";
import ProductCard from "@/components/ProductCard";
import { Star, Heart, Zap, Shield, Truck, Package } from "lucide-react";
import { api } from "@/lib/api";

interface Product {
  id: string;
  name: string;
  slug: string;
  description: string;
  price: number;
  currency: string;
  rating: number;
  reviewCount?: number;
  imageUrl: string | null;
  images?: string[];
  category: { name: string; slug: string } | null;
  inStock: boolean;
  stock: number;
}

export default function ProductPage() {
  const params = useParams();
  const slug = params.slug as string;
  const [product, setProduct] = useState<Product | null>(null);
  const [relatedProducts, setRelatedProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [quantity, setQuantity] = useState(1);
  const [isWishlisted, setIsWishlisted] = useState(false);

  useEffect(() => {
    if (slug) {
      loadProduct();
    }
  }, [slug]);

  const loadProduct = async () => {
    try {
      const data = await api.products.get(slug);
      setProduct(data);
      
      // Load related products
      if (data.category?.slug) {
        const related = await api.products.list({ category: data.category.slug, limit: 4 });
        setRelatedProducts(related.products.filter((p: any) => p.id !== data.id).slice(0, 4));
      }
    } catch (error) {
      console.error("Failed to load product:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Section>
        <div className="grid lg:grid-cols-2 gap-12">
          <div className="aspect-square bg-gray-100 rounded-lg animate-pulse" />
          <div className="space-y-6">
            <div className="h-8 bg-gray-100 rounded w-3/4 animate-pulse" />
            <div className="h-6 bg-gray-100 rounded w-1/4 animate-pulse" />
            <div className="h-10 bg-gray-100 rounded w-1/3 animate-pulse" />
            <div className="space-y-2">
              <div className="h-4 bg-gray-100 rounded animate-pulse" />
              <div className="h-4 bg-gray-100 rounded animate-pulse" />
              <div className="h-4 bg-gray-100 rounded w-2/3 animate-pulse" />
            </div>
          </div>
        </div>
      </Section>
    );
  }

  if (!product) {
    return (
      <Section>
        <div className="text-center py-16">
          <h1 className="text-2xl font-semibold mb-4">Product Not Found</h1>
          <p className="text-gray-600">The product you're looking for doesn't exist or has been removed.</p>
        </div>
      </Section>
    );
  }

  const images = product.images || (product.imageUrl ? [product.imageUrl] : []);

  return (
    <>
      <Section>
        <div className="grid lg:grid-cols-2 gap-12">
          {/* Gallery */}
          <ProductGallery images={images} productName={product.name} />

          {/* Product Info */}
          <div className="space-y-6">
            <div>
              {product.category && (
                <p className="text-text-muted text-small mb-2">{product.category.name}</p>
              )}
              <h1 className="mb-4">{product.name}</h1>

              {/* Rating */}
              <div className="flex items-center gap-2">
                <div className="flex">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <Star
                      key={i}
                      className={`w-4 h-4 ${
                        i <= Math.round(product.rating)
                          ? "fill-yellow-400 text-yellow-400"
                          : "text-gray-300"
                      }`}
                    />
                  ))}
                </div>
                <span className="text-text-muted text-small">
                  {product.rating.toFixed(1)} ({product.reviewCount || 0} reviews)
                </span>
              </div>
            </div>

            {/* Price */}
            <div className="text-3xl font-bold">
              {product.currency} {Number(product.price).toLocaleString()}
            </div>

            {/* Stock Status */}
            <div className="flex items-center gap-2">
              {product.inStock ? (
                <>
                  <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                  <span className="text-green-600 text-sm">
                    In Stock {product.stock > 0 && product.stock <= 10 && `(Only ${product.stock} left)`}
                  </span>
                </>
              ) : (
                <>
                  <span className="w-2 h-2 bg-red-500 rounded-full"></span>
                  <span className="text-red-600 text-sm">Out of Stock</span>
                </>
              )}
            </div>

            {/* Description */}
            {product.description && (
              <p className="text-text-muted">{product.description}</p>
            )}

            {/* Key Features */}
            <ul className="space-y-2 text-text-muted">
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-accent rounded-full"></span>
                Premium quality materials
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-accent rounded-full"></span>
                Discreet packaging guaranteed
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-accent rounded-full"></span>
                1 year warranty included
              </li>
            </ul>

            {/* Add to Cart */}
            <div className="space-y-4">
              <AddToCartButton
                product={{
                  id: product.id,
                  name: product.name,
                  slug: product.slug,
                  price: Number(product.price),
                  imageUrl: product.imageUrl,
                  stock: product.stock,
                }}
                showQuantity
              />

              <div className="flex gap-4">
                <button className="btn-secondary flex-1 gap-2 bg-accent text-white hover:bg-accent-hover">
                  <Zap className="w-5 h-5" />
                  1-Click Buy
                </button>
                <button
                  onClick={() => setIsWishlisted(!isWishlisted)}
                  className={`btn-icon border ${
                    isWishlisted ? "bg-red-50 border-red-200 text-red-500" : "border-border"
                  }`}
                >
                  <Heart className={`w-5 h-5 ${isWishlisted ? "fill-current" : ""}`} />
                </button>
              </div>
            </div>

            {/* Trust badges */}
            <div className="grid grid-cols-3 gap-4 pt-6 border-t border-border">
              <div className="flex flex-col items-center text-center text-small">
                <Truck className="w-6 h-6 mb-2 text-accent" />
                <span>Free Shipping</span>
              </div>
              <div className="flex flex-col items-center text-center text-small">
                <Shield className="w-6 h-6 mb-2 text-accent" />
                <span>Secure Payment</span>
              </div>
              <div className="flex flex-col items-center text-center text-small">
                <Package className="w-6 h-6 mb-2 text-accent" />
                <span>Discreet Package</span>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="mt-16">
          <ProductTabs description={product.description} productId={product.id} />
        </div>
      </Section>

      {/* Related Products */}
      {relatedProducts.length > 0 && (
        <Section title="You May Also Like">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {relatedProducts.map((p) => (
              <ProductCard key={p.id} {...p} />
            ))}
          </div>
        </Section>
      )}

      {/* Sticky Mobile CTA */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t p-4 lg:hidden z-20">
        <div className="flex items-center gap-4">
          <div>
            <p className="font-bold">{product.currency} {Number(product.price).toLocaleString()}</p>
            <p className="text-xs text-gray-500">{product.inStock ? "In Stock" : "Out of Stock"}</p>
          </div>
          <AddToCartButton
            product={{
              id: product.id,
              name: product.name,
              slug: product.slug,
              price: Number(product.price),
              imageUrl: product.imageUrl,
              stock: product.stock,
            }}
            className="flex-1"
          />
        </div>
      </div>
    </>
  );
}
