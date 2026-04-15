"use client";

import { useState, useEffect } from "react";
import ProductCard from "@/components/ProductCard";
import Section from "@/components/Section";
import AnimateOnScroll, { StaggerGrid, StaggerItem } from "@/components/AnimateOnScroll";
import { Sparkles } from "lucide-react";
import { useAuth } from "@/lib/hooks/useAuth";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "";

interface Product {
  id: string;
  name: string;
  slug: string;
  price: number;
  comparePrice?: number;
  compareAtPrice?: number;
  rating: number;
  imageUrl: string | null;
  category: string | null;
  inStock: boolean;
  shippingBadge?: "From Abroad" | "Express";
}

export default function PersonalizedProducts() {
  const { user } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);

  useEffect(() => {
    if (!user) return;

    fetch(`${API_URL}/api/browse/personalized`, { credentials: "include" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.products?.length) setProducts(data.products.slice(0, 6));
      })
      .catch(() => {});
  }, [user]);

  if (!user || products.length === 0) return null;

  return (
    <Section title="">
      <AnimateOnScroll variant="fadeUp">
        <div className="flex items-center gap-3 mb-8">
          <div className="p-2.5 bg-pink-500/10 rounded-2xl text-pink-500">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-text">Picked For You ✨</h2>
            <p className="text-sm text-text-muted">Based on your browsing history</p>
          </div>
        </div>
      </AnimateOnScroll>

      <StaggerGrid className="grid-products">
        {products.map((product) => (
          <StaggerItem key={product.slug}>
            <ProductCard
              id={product.id}
              name={product.name}
              slug={product.slug}
              price={Number(product.price)}
              comparePrice={product.comparePrice ? Number(product.comparePrice) : undefined}
              rating={Number(product.rating)}
              imageUrl={product.imageUrl}
              category={product.category || undefined}
              inStock={product.inStock}
              shippingBadge={product.shippingBadge}
            />
          </StaggerItem>
        ))}
      </StaggerGrid>
    </Section>
  );
}
