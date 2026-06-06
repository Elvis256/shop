"use client";

import React from "react";

export interface HomeClientProps {
  initialNewArrivals: any[];
  initialBestsellers: any[];
  initialTrending: any[];
  initialTopRated: any[];
  initialFeaturedProducts: any[];
  initialFlashSaleProducts: any[];
  initialCategories: any[];
}

export default function HomeClientDebug(_props: HomeClientProps) {
  return (
    <div data-debug-homepage className="bg-bg min-h-screen p-8">
      <h2 className="text-xl font-bold">Homepage (debug mode)</h2>
      <p className="text-sm text-text-muted">Minimal client component to test hydration. Restoring full homepage after diagnosis.</p>
    </div>
  );
}
