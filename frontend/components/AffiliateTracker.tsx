"use client";

import { Suspense, useEffect } from "react";
import { useSearchParams } from "next/navigation";

function AffiliateTrackerInner() {
  const searchParams = useSearchParams();

  useEffect(() => {
    const ref = searchParams.get("ref");
    if (ref) {
      localStorage.setItem("affiliate_ref", ref);
      localStorage.setItem("affiliate_ref_time", Date.now().toString());
    }
  }, [searchParams]);

  return null;
}

export default function AffiliateTracker() {
  return (
    <Suspense fallback={null}>
      <AffiliateTrackerInner />
    </Suspense>
  );
}
