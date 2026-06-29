"use client";

import { useEffect } from "react";

// Monkey-patch fetch to automatically include CSRF token on all
// same-origin state-changing requests (POST, PUT, DELETE, PATCH).
// This prevents 403 errors from the backend CSRF middleware.
export default function CsrfFetchInterceptor() {
  useEffect(() => {
    const originalFetch = window.fetch;

    window.fetch = function (input: RequestInfo | URL, init?: RequestInit) {
      // Determine if request is same-origin
      let url: string;
      if (typeof input === "string") {
        url = input;
      } else if (input instanceof URL) {
        url = input.href;
      } else {
        url = input.url;
      }
      const isSameOrigin =
        url.startsWith("/") || url.startsWith(window.location.origin);

      const method = (init?.method || "GET").toUpperCase();
      const needsCsrf =
        isSameOrigin && !["GET", "HEAD", "OPTIONS"].includes(method);

      if (needsCsrf) {
        const match = document.cookie.match(/csrf_token=([^;]+)/);
        const csrfToken = match ? match[1] : null;
        if (csrfToken) {
          const headers = new Headers(init?.headers);
          if (!headers.has("x-csrf-token")) {
            headers.set("x-csrf-token", csrfToken);
          }
          init = { ...init, headers };
        }
      }

      return originalFetch.call(this, input, init);
    };

    return () => {
      window.fetch = originalFetch;
    };
  }, []);

  return null;
}
