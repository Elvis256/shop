import { Metadata } from "next";
import HomeClient from "./HomeClient";

const API_URL = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export const revalidate = 300; // ISR: revalidate every 5 minutes

export const metadata: Metadata = {
  title: "PleasureZone Uganda - Premium Intimate Wellness Products",
  description: "Shop premium intimate wellness products online at PleasureZone Uganda. Fast discreet delivery, secure checkout, and earn rewards on every order.",
};

async function fetchJSON(url: string) {
  try {
    const res = await fetch(url, { next: { revalidate: 300 } });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export default async function Home() {
  const [newRes, bestRes, flashRes, catRes, trendRes, topRes, featRes] = await Promise.all([
    fetchJSON(`${API_URL}/api/products?limit=12&status=ACTIVE&sortBy=createdAt&sortOrder=desc`),
    fetchJSON(`${API_URL}/api/products?limit=12&status=ACTIVE&sort=bestseller`),
    fetchJSON(`${API_URL}/api/products?limit=8&status=ACTIVE&flashSale=true`),
    fetchJSON(`${API_URL}/api/categories`),
    fetchJSON(`${API_URL}/api/recommendations/trending`),
    fetchJSON(`${API_URL}/api/recommendations/top-rated`),
    fetchJSON(`${API_URL}/api/products?featured=true&limit=12&status=ACTIVE`),
  ]);

  const flashProducts = (flashRes?.products || []).filter((p: { flashSalePrice?: number }) => p.flashSalePrice);

  return (
    <HomeClient
      initialNewArrivals={newRes?.products || []}
      initialBestsellers={bestRes?.products || []}
      initialFlashSaleProducts={flashProducts}
      initialCategories={catRes?.categories || []}
      initialTrending={trendRes?.products || []}
      initialTopRated={topRes?.products || []}
      initialFeaturedProducts={featRes?.products || []}
    />
  );
}
