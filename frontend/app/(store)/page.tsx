"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Section from "@/components/Section";
import TrustStrip from "@/components/TrustStrip";
import CategoryCard from "@/components/CategoryCard";
import ProductCard from "@/components/ProductCard";
import dynamic from "next/dynamic";
import HeroBanner from "@/components/HeroBanner";
import PrivacySection from "@/components/PrivacySection";
import NewsletterSignup from "@/components/NewsletterSignup";
import RecentlyViewed from "@/components/RecentlyViewed";
import FlashSaleCountdown from "@/components/FlashSaleCountdown";
import DailyDeal from "@/components/DailyDeal";
const ScrollProgress = dynamic(() => import("@/components/ScrollProgress"), { ssr: false });
const AnimateOnScroll = dynamic(() => import("@/components/AnimateOnScroll").then(m => m.default), { ssr: false });
const StaggerGrid = dynamic(() => import("@/components/AnimateOnScroll").then(m => m.StaggerGrid), { ssr: false });
const StaggerItem = dynamic(() => import("@/components/AnimateOnScroll").then(m => m.StaggerItem), { ssr: false });
import ProductCarousel, { CarouselItem } from "@/components/ProductCarousel";
import PersonalizedProducts from "@/components/PersonalizedProducts";
import PointsMultiplier from "@/components/PointsMultiplier";
import { Zap, TrendingUp, Star, Sparkles, ArrowRight, Shield, Truck, Clock, Gift } from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

interface Product {
  id: string;
  name: string;
  slug: string;
  price: number;
  comparePrice?: number;
  compareAtPrice?: number;
  flashSalePrice?: number;
  flashSaleEndsAt?: string;
  rating: number;
  reviewCount?: number;
  imageUrl: string | null;
  category: string | null;
  inStock: boolean;
  isNew?: boolean;
  isBestseller?: boolean;
  stock?: number;
  soldRecently?: number;
  createdAt?: string;
  shippingBadge?: "From Abroad" | "Express";
}

interface Category {
  id: string;
  name: string;
  slug: string;
  imageUrl?: string;
  productCount?: number;
}

function ProductSkeleton() {
  return (
    <div>
      <div className="aspect-[4/5] bg-surface-secondary rounded-24 mb-4 skeleton-shimmer" />
      <div className="h-3 bg-surface-secondary rounded-full mb-2 w-1/3 skeleton-shimmer" />
      <div className="h-4 bg-surface-secondary rounded-full mb-2 skeleton-shimmer" />
      <div className="h-3 bg-surface-secondary rounded-full w-1/2 skeleton-shimmer" />
    </div>
  );
}

function SectionHeader({ icon, title, subtitle, badge }: { icon: React.ReactNode; title: string; subtitle: string; badge?: string }) {
  return (
    <AnimateOnScroll variant="fadeUp">
      <div className="flex items-center gap-3 mb-8">
        <div className="p-2.5 bg-primary/10 rounded-2xl text-primary">{icon}</div>
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-bold text-text">{title}</h2>
            {badge && <span className="text-xs font-semibold bg-red-500 text-white px-2 py-0.5 rounded-full animate-pulse-soft">{badge}</span>}
          </div>
          <p className="text-sm text-text-muted">{subtitle}</p>
        </div>
      </div>
    </AnimateOnScroll>
  );
}

function ValueProposition() {
  const values = [
    { icon: <Shield className="w-6 h-6" />, title: "100% Discreet", desc: "Plain packaging, no logos" },
    { icon: <Truck className="w-6 h-6" />, title: "Fast Delivery", desc: "Same-day in Kampala" },
    { icon: <Clock className="w-6 h-6" />, title: "24/7 Support", desc: "Always here to help" },
    { icon: <Gift className="w-6 h-6" />, title: "Earn Rewards", desc: "Points on every order" },
  ];
  return (
    <StaggerGrid className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 py-8 sm:py-10 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
      {values.map((v) => (
        <StaggerItem key={v.title}>
          <div className="flex flex-col items-center text-center p-4 sm:p-5 rounded-2xl bg-surface hover:shadow-lg transition-all duration-300 group cursor-default hover-lift">
            <div className="p-3 rounded-xl bg-primary/10 text-primary mb-3 group-hover:bg-primary group-hover:text-white transition-colors duration-300">{v.icon}</div>
            <h3 className="font-semibold text-text text-sm">{v.title}</h3>
            <p className="text-xs text-text-muted mt-1">{v.desc}</p>
          </div>
        </StaggerItem>
      ))}
    </StaggerGrid>
  );
}

export default function Home() {
  const [newArrivals, setNewArrivals] = useState<Product[]>([]);
  const [bestsellers, setBestsellers] = useState<Product[]>([]);
  const [trending, setTrending] = useState<Product[]>([]);
  const [topRated, setTopRated] = useState<Product[]>([]);
  const [flashSaleProducts, setFlashSaleProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [newRes, bestRes, flashRes, catRes, trendRes, topRes] = await Promise.all([
        fetch(`${API_URL}/api/products?limit=12&status=ACTIVE&sortBy=createdAt&sortOrder=desc`),
        fetch(`${API_URL}/api/products?limit=12&status=ACTIVE&sort=bestseller`),
        fetch(`${API_URL}/api/products?limit=8&status=ACTIVE&flashSale=true`),
        fetch(`${API_URL}/api/categories`),
        fetch(`${API_URL}/api/recommendations/trending`).catch(() => null),
        fetch(`${API_URL}/api/recommendations/top-rated`).catch(() => null),
      ]);

      if (newRes.ok) {
        const d = await newRes.json();
        setNewArrivals(d.products || []);
      }
      if (bestRes.ok) {
        const d = await bestRes.json();
        setBestsellers(d.products || []);
      }
      if (flashRes.ok) {
        const d = await flashRes.json();
        const fp = (d.products || []).filter((p: Product) => p.flashSalePrice);
        setFlashSaleProducts(fp);
      }
      if (catRes.ok) {
        const d = await catRes.json();
        setCategories(d.categories || []);
      }
      if (trendRes?.ok) {
        const d = await trendRes.json();
        setTrending(d.products || []);
      }
      if (topRes?.ok) {
        const d = await topRes.json();
        setTopRated(d.products || []);
      }
    } catch (error) {
      console.error("Failed to load data:", error);
    } finally {
      setLoading(false);
    }
  };

  const flashSaleEnd = flashSaleProducts
    .filter((p) => p.flashSaleEndsAt)
    .map((p) => new Date(p.flashSaleEndsAt!))
    .sort((a, b) => a.getTime() - b.getTime())[0];

  return (
    <div className="bg-bg min-h-screen">
      <PointsMultiplier />
      <ScrollProgress />
      <HeroBanner />
      <TrustStrip />
      <ValueProposition />
      <DailyDeal />

      {/* Flash Sale Section — horizontal carousel for urgency */}
      {(loading || flashSaleProducts.length > 0) && (
        <Section title="" bgColor="gray">
          <AnimateOnScroll variant="fadeUp">
            <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-red-500 rounded-xl animate-pulse-soft">
                  <Zap className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-text">Flash Sale</h2>
                  <p className="text-sm text-text-muted">Limited time deals</p>
                </div>
              </div>
              {flashSaleEnd && <FlashSaleCountdown endTime={flashSaleEnd} />}
            </div>
          </AnimateOnScroll>

          {loading ? (
            <div className="grid-products">
              {Array.from({ length: 4 }).map((_, i) => <ProductSkeleton key={i} />)}
            </div>
          ) : (
            <ProductCarousel>
              {flashSaleProducts.map((p) => (
                <CarouselItem key={p.slug}>
                  <ProductCard
                    id={p.id}
                    name={p.name}
                    slug={p.slug}
                    price={p.flashSalePrice ? Number(p.flashSalePrice) : Number(p.price)}
                    comparePrice={p.flashSalePrice ? Number(p.price) : p.comparePrice ? Number(p.comparePrice) : undefined}
                    rating={Number(p.rating)}
                    imageUrl={p.imageUrl}
                    category={p.category || undefined}
                    inStock={p.inStock}
                    badgeText="🔥 SALE"
                    shippingBadge={p.shippingBadge}
                  />
                </CarouselItem>
              ))}
            </ProductCarousel>
          )}
        </Section>
      )}

      {/* Trending Now — horizontal carousel */}
      {(loading || trending.length > 0) && (
        <Section
          title=""
          viewAllLink="/search?sort=popular"
          viewAllText="See All"
        >
          <SectionHeader
            icon={<TrendingUp className="w-5 h-5" />}
            title="Trending Now"
            subtitle="Most popular this week"
            badge="HOT"
          />
          {loading ? (
            <div className="grid-products">
              {Array.from({ length: 4 }).map((_, i) => <ProductSkeleton key={i} />)}
            </div>
          ) : (
            <ProductCarousel>
              {trending.slice(0, 12).map((product) => (
                <CarouselItem key={product.slug}>
                  <ProductCard
                    id={product.id}
                    name={product.name}
                    slug={product.slug}
                    price={Number(product.price)}
                    comparePrice={product.compareAtPrice ? Number(product.compareAtPrice) : undefined}
                    rating={Number(product.rating)}
                    imageUrl={product.imageUrl}
                    category={product.category || undefined}
                    inStock={product.stock !== 0}
                    badgeText={product.soldRecently ? `${product.soldRecently} sold` : undefined}
                    shippingBadge={product.shippingBadge}
                  />
                </CarouselItem>
              ))}
            </ProductCarousel>
          )}
        </Section>
      )}

      {/* Categories Section — staggered grid */}
      <Section
        title="Shop by Category"
        subtitle="Explore our curated collections"
        viewAllLink="/category"
        viewAllText="View All"
        bgColor="gray"
      >
        <StaggerGrid className="grid-categories">
          {loading ? (
            Array.from({ length: 6 }).map((_, i) => (
              <StaggerItem key={i}>
                <div className="aspect-[4/5] sm:aspect-square bg-surface rounded-24 skeleton-shimmer" />
              </StaggerItem>
            ))
          ) : categories.length > 0 ? (
            categories.slice(0, 6).map((category) => (
              <StaggerItem key={category.slug}>
                <CategoryCard
                  title={category.name}
                  slug={category.slug}
                  imageUrl={category.imageUrl}
                />
              </StaggerItem>
            ))
          ) : (
            <div className="col-span-full text-center py-12 text-text-muted">No categories available</div>
          )}
        </StaggerGrid>
      </Section>

      {/* New Arrivals Section — full grid with stagger */}
      <Section
        title=""
        viewAllLink="/category?sort=newest"
        viewAllText="View All"
      >
        <SectionHeader
          icon={<Sparkles className="w-5 h-5" />}
          title="New Arrivals"
          subtitle="Fresh picks just added to the store"
        />
        <StaggerGrid className="grid-products">
          {loading ? (
            Array.from({ length: 8 }).map((_, i) => <StaggerItem key={i}><ProductSkeleton /></StaggerItem>)
          ) : newArrivals.length > 0 ? (
            newArrivals.map((product) => (
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
                  isNew={true}
                  isBestseller={product.isBestseller}
                  shippingBadge={product.shippingBadge}
                />
              </StaggerItem>
            ))
          ) : (
            <div className="col-span-full text-center py-12 text-text-muted">No products available</div>
          )}
        </StaggerGrid>
      </Section>

      {/* Top Rated — horizontal carousel */}
      {(loading || topRated.length > 0) && (
        <Section title="" bgColor="gray">
          <SectionHeader
            icon={<Star className="w-5 h-5" />}
            title="Top Rated"
            subtitle="Highest rated by our customers"
          />
          {loading ? (
            <div className="grid-products">
              {Array.from({ length: 4 }).map((_, i) => <ProductSkeleton key={i} />)}
            </div>
          ) : (
            <ProductCarousel>
              {topRated.slice(0, 12).map((product) => (
                <CarouselItem key={product.slug}>
                  <ProductCard
                    id={product.id}
                    name={product.name}
                    slug={product.slug}
                    price={Number(product.price)}
                    comparePrice={product.compareAtPrice ? Number(product.compareAtPrice) : undefined}
                    rating={Number(product.rating)}
                    imageUrl={product.imageUrl}
                    category={product.category || undefined}
                    inStock={product.stock !== 0}
                    shippingBadge={product.shippingBadge}
                  />
                </CarouselItem>
              ))}
            </ProductCarousel>
          )}
        </Section>
      )}

      {/* Bestsellers Section — full grid with stagger */}
      <Section
        title=""
        viewAllLink="/category"
        viewAllText="Shop All"
      >
        <SectionHeader
          icon={<TrendingUp className="w-5 h-5" />}
          title="Bestsellers"
          subtitle="Loved by our customers"
        />
        <StaggerGrid className="grid-products">
          {loading ? (
            Array.from({ length: 8 }).map((_, i) => <StaggerItem key={i}><ProductSkeleton /></StaggerItem>)
          ) : bestsellers.length > 0 ? (
            bestsellers.map((product) => (
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
                  isNew={product.isNew}
                  isBestseller={true}
                  shippingBadge={product.shippingBadge}
                />
              </StaggerItem>
            ))
          ) : (
            <div className="col-span-full text-center py-12 text-text-muted">No products available</div>
          )}
        </StaggerGrid>
      </Section>

      <PrivacySection />
      <PersonalizedProducts />
      <RecentlyViewed />

      {/* Newsletter Section */}
      <Section bgColor="gray">
        <AnimateOnScroll variant="scaleIn">
          <div className="max-w-2xl mx-auto text-center py-8">
            <h2 className="section-title mb-4">Stay in the Loop</h2>
            <p className="text-text-muted text-lg mb-10">
              Subscribe for exclusive offers, new arrivals, and wellness tips.
            </p>
            <NewsletterSignup variant="hero" source="homepage" />
          </div>
        </AnimateOnScroll>
      </Section>
    </div>
  );
}

