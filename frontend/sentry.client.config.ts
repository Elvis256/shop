import * as Sentry from "@sentry/nextjs";

if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    environment: process.env.NODE_ENV || "development",
    tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
    replaysSessionSampleRate: 0.01,
    replaysOnErrorSampleRate: 1.0,
    integrations: [
      Sentry.replayIntegration(),
      Sentry.browserTracingIntegration(),
    ],
    beforeSend(event) {
      // Don't send events in development
      if (process.env.NODE_ENV !== "production") return null;
      return event;
    },
    ignoreErrors: [
      "ResizeObserver loop",
      "Non-Error promise rejection",
      "Load failed",
      "Failed to fetch",
      "NetworkError",
      "AbortError",
    ],
  });
}
