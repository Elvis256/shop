"use client";

import { useEffect } from "react";

export default function StoreError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Store error:", error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center py-20 px-4">
      <div className="max-w-md w-full text-center">
        <div className="text-5xl mb-6">😔</div>
        <h2 className="text-2xl font-bold text-text mb-3">Something went wrong</h2>
        <p className="text-text-muted mb-8">
          We encountered an unexpected error. Please try again.
        </p>
        <button
          onClick={reset}
          className="btn-primary px-8 py-3"
        >
          Try Again
        </button>
      </div>
    </div>
  );
}
