"use client";

import { useState, useEffect } from "react";
import Section from "@/components/Section";
import TrustStrip from "@/components/TrustStrip";
import CategoryCard from "@/components/CategoryCard";
import ProductCard from "@/components/ProductCard";
import Hero from "@/components/Hero";
import PrivacySection from "@/components/PrivacySection";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

interface Product {
  id: string;
  name: string;
  slug: string;
  price: number;
  rating: number;
  imageUrl: string | null;
  category: string | null;
  inStock: boolean;
}

interface Category {
  id: string;
  name: string;
  slug: string;
  imageUrl?: string;
  productCount?: number;
}

export default function Home() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [productsRes, categoriesRes] = await Promise.all([
        fetch(`${API_URL}/api/products?limit=8&status=ACTIVE`),
        fetch(`${API_URL}/api/categories`),
      ]);

      if (productsRes.ok) {
        const productsData = await productsRes.json();
        setProducts(productsData.products || []);
      }

      if (categoriesRes.ok) {
        const categoriesData = await categoriesRes.json();
        setCategories(categoriesData.categories || []);
      }
    } catch (error) {
      console.error("Failed to load data:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Hero />
      <TrustStrip />

      <Section title="Shop by Category">
        <div className="grid-categories">
          {loading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="aspect-square bg-gray-100 rounded-lg animate-pulse" />
            ))
          ) : categories.length > 0 ? (
            categories.slice(0, 4).map((category) => (
              <CategoryCard key={category.slug} title={category.name} slug={category.slug} imageUrl={category.imageUrl} />
            ))
          ) : (
            <p className="text-gray-500 col-span-4">No categories yet</p>
          )}
        </div>
      </Section>

      <Section title="Top Sellers">
        <div className="grid-products">
          {loading ? (
            Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="card animate-pulse">
                <div className="aspect-square bg-gray-100 rounded-lg mb-4" />
                <div className="h-4 bg-gray-100 rounded mb-2" />
                <div className="h-4 bg-gray-100 rounded w-1/2" />
              </div>
            ))
          ) : products.length > 0 ? (
            products.map((product) => (
              <ProductCard
                key={product.slug}
                id={product.id}
                name={product.name}
                slug={product.slug}
                price={Number(product.price)}
                rating={Number(product.rating)}
                imageUrl={product.imageUrl}
                inStock={product.inStock}
              />
            ))
          ) : (
            <p className="text-gray-500 col-span-4">No products yet</p>
          )}
        </div>
      </Section>

      <PrivacySection />
    </>
  );
}
