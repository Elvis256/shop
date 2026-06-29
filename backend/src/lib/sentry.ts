import * as Sentry from "@sentry/node";
import { logger } from "./logger";

const SENTRY_DSN = process.env.SENTRY_DSN;

if (SENTRY_DSN) {
  Sentry.init({
    dsn: SENTRY_DSN,
    environment: process.env.NODE_ENV || "development",
    tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
    profilesSampleRate: 0.1,
    integrations: [
      Sentry.httpIntegration(),
      Sentry.expressIntegration(),
      Sentry.prismaIntegration(),
    ],
    beforeSend(event) {
      // Scrub sensitive data
      if (event.request?.cookies) {
        delete event.request.cookies;
      }
      if (event.request?.headers) {
        delete event.request.headers["authorization"];
        delete event.request.headers["cookie"];
      }
      return event;
    },
    ignoreErrors: [
      "ECONNREFUSED",
      "ECONNRESET",
      "EPIPE",
      "Network request failed",
    ],
  });
  logger.info("sentry_initialized", { environment: process.env.NODE_ENV });
} else if (process.env.NODE_ENV === "production") {
  logger.warn("sentry_dsn_missing", {
    message: "SENTRY_DSN not configured — error tracking disabled",
  });
}

export default Sentry;
