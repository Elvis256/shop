/**
 * OpenTelemetry distributed tracing setup.
 * Automatically instruments: HTTP, Express, Prisma, Redis, and fetch calls.
 *
 * To enable: set OTEL_EXPORTER_OTLP_ENDPOINT in environment
 * Example: OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318
 *
 * Compatible with: Jaeger, Zipkin, Grafana Tempo, Datadog, New Relic
 */

const OTEL_ENDPOINT = process.env.OTEL_EXPORTER_OTLP_ENDPOINT;

if (OTEL_ENDPOINT) {
  const { NodeSDK } = require("@opentelemetry/sdk-node");
  const {
    getNodeAutoInstrumentations,
  } = require("@opentelemetry/auto-instrumentations-node");
  const {
    OTLPTraceExporter,
  } = require("@opentelemetry/exporter-trace-otlp-http");

  const sdk = new NodeSDK({
    serviceName: process.env.OTEL_SERVICE_NAME || "shop-backend",
    traceExporter: new OTLPTraceExporter({
      url: `${OTEL_ENDPOINT}/v1/traces`,
    }),
    instrumentations: [
      getNodeAutoInstrumentations({
        // Disable noisy FS instrumentation
        "@opentelemetry/instrumentation-fs": { enabled: false },
        // Configure HTTP to capture useful details
        "@opentelemetry/instrumentation-http": {
          ignoreIncomingPaths: ["/health", "/health/quick"],
        },
      }),
    ],
  });

  sdk.start();

  // Graceful shutdown
  process.on("SIGTERM", () => {
    sdk.shutdown().catch(console.error);
  });

  console.log(
    `[tracing] OpenTelemetry initialized → ${OTEL_ENDPOINT}`
  );
}

export {};
