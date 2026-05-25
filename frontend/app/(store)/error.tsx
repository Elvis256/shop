"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";

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
    <div className="min-h-[60vh] flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center">
        <div className="w-20 h-20 bg-red-50 dark:bg-red-900/20 rounded-full flex items-center justify-center mx-auto mb-6 ring-8 ring-red-50/50 dark:ring-red-900/10">
          <AlertTriangle className="w-10 h-10 text-red-500" />
        </div>
        <h1 className="text-2xl font-bold text-text mb-3">Something went wrong</h1>
        <p className="text-text-muted mb-8 leading-relaxed">
          We hit an unexpected error. This has been logged and we&apos;ll look into it.
          Please try again or return to the home page.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={reset}
            className="btn-primary inline-flex items-center justify-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Try Again
          </button>
          <Link href="/" className="btn-secondary inline-flex items-center justify-center gap-2">
            <Home className="w-4 h-4" />
            Go Home
          </Link>
        </div>
        {error.digest && (
          <p className="mt-6 text-xs text-text-muted font-mono">Error ID: {error.digest}</p>
        )}
      </div>
    </div>
  );
}
