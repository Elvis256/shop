"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Section from "@/components/Section";
import TrustStrip from "@/components/TrustStrip";
import CategoryCard from "@/components/CategoryCard";
import ProductCard from "@/components/ProductCard";
import HeroBanner from "@/components/HeroBanner";
import PrivacySection from "@/components/PrivacySection";
import NewsletterSignup from "@/components/NewsletterSignup";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

interface Product {
  id: string;
  name: string;
  slug: string;
  price: number;
  comparePrice?: number;
  rating: number;
  imageUrl: string | null;
  category: string | null;
  inStock: boolean;
  isNew?: boolean;
  isBestseller?: boolean;
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
    <div className="bg-bg min-h-screen">
      <HeroBanner />
      <TrustStrip />

      {/* Categories Section */}
      <Section 
        title="Shop by Category" 
        subtitle="Explore our curated collections"
        viewAllLink="/category"
        viewAllText="View All"
      >
        <div className="grid-categories">
          {loading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="aspect-square bg-surface-secondary rounded-24 animate-pulse" />
            ))
          ) : categories.length > 0 ? (
            categories.slice(0, 4).map((category) => (
              <CategoryCard 
                key={category.slug} 
                title={category.name} 
                slug={category.slug} 
                imageUrl={category.imageUrl} 
              />
            ))
          ) : (
            <div className="col-span-full text-center py-12 text-text-muted">
              No categories available
            </div>
          )}
        </div>
      </Section>

      {/* Products Section */}
      <Section 
        title="Popular Products" 
        subtitle="Bestsellers loved by our customers"
        viewAllLink="/category"
        viewAllText="Shop All"
        bgColor="gray"
      >
        <div className="grid-products">
          {loading ? (
            Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="animate-pulse">
                <div className="aspect-[4/5] bg-surface rounded-24 mb-4" />
                <div className="h-3 bg-surface rounded-full mb-2 w-1/3" />
                <div className="h-4 bg-surface rounded-full mb-2" />
                <div className="h-3 bg-surface rounded-full w-1/2" />
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
                comparePrice={product.comparePrice ? Number(product.comparePrice) : undefined}
                rating={Number(product.rating)}
                imageUrl={product.imageUrl}
                category={product.category || undefined}
                inStock={product.inStock}
                isNew={product.isNew}
                isBestseller={product.isBestseller}
              />
            ))
          ) : (
            <div className="col-span-full text-center py-12 text-text-muted">
              No products available
            </div>
          )}
        </div>
      </Section>

      <PrivacySection />

      {/* Newsletter Section */}
      <Section bgColor="gray">
        <div className="max-w-2xl mx-auto text-center py-8">
          <h2 className="section-title mb-4">Stay in the Loop</h2>
          <p className="text-text-muted text-lg mb-10">
            Subscribe for exclusive offers, new arrivals, and wellness tips.
          </p>
          <NewsletterSignup variant="hero" source="homepage" />
        </div>
      </Section>
    </div>
  );
}
