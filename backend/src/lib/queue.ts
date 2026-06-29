import { Queue, Worker, QueueEvents, Job } from "bullmq";
import { logger } from "./logger";

const REDIS_URL = process.env.REDIS_URL || "redis://127.0.0.1:6379";

// Parse Redis URL into connection object for BullMQ
function parseRedisConnection() {
  try {
    const url = new URL(REDIS_URL);
    return {
      host: url.hostname || "127.0.0.1",
      port: parseInt(url.port || "6379"),
      password: url.password || undefined,
      db: parseInt(url.pathname?.slice(1) || "0"),
    };
  } catch {
    return { host: "127.0.0.1", port: 6379 };
  }
}

const connection = parseRedisConnection();

/**
 * Job queue definitions — each queue handles a specific type of background work.
 * BullMQ provides: retries, backoff, rate limiting, concurrency, and monitoring.
 */

// --- Queue instances ---
export const stockCleanupQueue = new Queue("stock-cleanup", {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 5000 },
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 500 },
  },
});

export const emailQueue = new Queue("emails", {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 10000 },
    removeOnComplete: { count: 200 },
    removeOnFail: { count: 500 },
  },
});

export const syncQueue = new Queue("sync-jobs", {
  connection,
  defaultJobOptions: {
    attempts: 2,
    backoff: { type: "exponential", delay: 30000 },
    removeOnComplete: { count: 50 },
    removeOnFail: { count: 200 },
  },
});

export const maintenanceQueue = new Queue("maintenance", {
  connection,
  defaultJobOptions: {
    attempts: 2,
    backoff: { type: "fixed", delay: 60000 },
    removeOnComplete: { count: 50 },
    removeOnFail: { count: 100 },
  },
});

export const webhookQueue = new Queue("webhooks", {
  connection,
  defaultJobOptions: {
    attempts: 5,
    backoff: { type: "exponential", delay: 60000 },
    removeOnComplete: { count: 200 },
    removeOnFail: { count: 500 },
  },
});

export const notificationQueue = new Queue("notifications", {
  connection,
  defaultJobOptions: {
    attempts: 5,
    backoff: { type: "exponential", delay: 10000 },
    removeOnComplete: { count: 500 },
    removeOnFail: { count: 1000 },
  },
});

// --- Helper to add repeatable jobs ---

export async function scheduleRepeatingJobs() {
  // Stock reservation cleanup — every 5 minutes
  await stockCleanupQueue.add(
    "cleanup-expired-reservations",
    {},
    { repeat: { every: 5 * 60 * 1000 } }
  );

  // Maintenance jobs
  await maintenanceQueue.add(
    "dispute-sla-escalation",
    {},
    { repeat: { every: 60 * 60 * 1000 } } // hourly
  );

  await maintenanceQueue.add(
    "escrow-auto-release",
    {},
    { repeat: { every: 60 * 60 * 1000 } } // hourly
  );

  await maintenanceQueue.add(
    "webhook-retry",
    {},
    { repeat: { every: 5 * 60 * 1000 } } // every 5 min
  );

  await maintenanceQueue.add(
    "delayed-dispatch-release",
    {},
    { repeat: { every: 5 * 60 * 1000 } } // every 5 min
  );

  await maintenanceQueue.add(
    "token-cleanup",
    {},
    { repeat: { every: 6 * 60 * 60 * 1000 } } // every 6 hours
  );

  await maintenanceQueue.add(
    "expired-coupon-cleanup",
    {},
    { repeat: { every: 12 * 60 * 60 * 1000 } } // every 12 hours
  );

  await maintenanceQueue.add(
    "order-history-cleanup",
    {},
    { repeat: { every: 24 * 60 * 60 * 1000 } } // daily
  );

  await maintenanceQueue.add(
    "guest-data-cleanup",
    {},
    { repeat: { every: 24 * 60 * 60 * 1000 } } // daily
  );

  // Sync jobs
  await syncQueue.add(
    "aliexpress-tracking",
    {},
    { repeat: { every: 30 * 60 * 1000 } } // every 30 min
  );

  await syncQueue.add(
    "aliexpress-price",
    {},
    { repeat: { every: 6 * 60 * 60 * 1000 } } // every 6 hours
  );

  await syncQueue.add(
    "cj-tracking",
    {},
    { repeat: { every: 30 * 60 * 1000 } } // every 30 min
  );

  await syncQueue.add(
    "cj-price",
    {},
    { repeat: { every: 6 * 60 * 60 * 1000 } } // every 6 hours
  );

  // Email-related repeating jobs
  await emailQueue.add(
    "abandoned-cart-check",
    {},
    { repeat: { every: 60 * 60 * 1000 } } // hourly
  );

  await emailQueue.add(
    "review-request-check",
    {},
    { repeat: { every: 24 * 60 * 60 * 1000 } } // daily
  );

  await emailQueue.add(
    "restock-reminder-check",
    {},
    { repeat: { every: 24 * 60 * 60 * 1000 } } // daily
  );

  await emailQueue.add(
    "installment-reminder-check",
    {},
    { repeat: { every: 12 * 60 * 60 * 1000 } } // every 12 hours
  );

  await emailQueue.add(
    "layaway-reminder-check",
    {},
    { repeat: { every: 12 * 60 * 60 * 1000 } } // every 12 hours
  );

  logger.info("queue_repeating_jobs_scheduled");
}

/**
 * Create a worker for a queue with error logging
 */
export function createWorker(
  queueName: string,
  processor: (job: Job) => Promise<void>,
  opts?: { concurrency?: number }
) {
  const worker = new Worker(queueName, processor, {
    connection,
    concurrency: opts?.concurrency || 3,
  });

  worker.on("completed", (job) => {
    logger.info("job_completed", { queue: queueName, job: job.name, id: job.id });
  });

  worker.on("failed", (job, err) => {
    logger.error("job_failed", {
      queue: queueName,
      job: job?.name,
      id: job?.id,
      error: err.message,
      attempt: job?.attemptsMade,
    });
  });

  worker.on("error", (err) => {
    logger.error("worker_error", { queue: queueName, error: err.message });
  });

  return worker;
}

/**
 * Gracefully close all queues and workers
 */
export async function closeQueues(workers: Worker[]) {
  await Promise.all([
    ...workers.map((w) => w.close()),
    stockCleanupQueue.close(),
    emailQueue.close(),
    syncQueue.close(),
    maintenanceQueue.close(),
    webhookQueue.close(),
    notificationQueue.close(),
  ]);
}
