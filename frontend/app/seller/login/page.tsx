"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function VendorLoginRedirect() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to main login — seller access is determined by Seller record, not a separate login
    router.replace("/auth/login?redirect=/seller");
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4" />
        <p className="text-gray-500">Redirecting to login...</p>
      </div>
    </div>
  );
}
