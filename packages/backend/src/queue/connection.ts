import IORedis from "ioredis";
import { logger } from "../utils/logger";

/**
 * BullMQ needs its own ioredis connection distinct from the `redis` v4
 * client in utils/redis.ts (which is used for simple caching). This is
 * shared across all queues/workers in this module rather than created
 * per-queue, since BullMQ recommends reusing connections.
 *
 * maxRetriesPerRequest: null is required by BullMQ for blocking commands
 * (see BullMQ docs) -- without it, workers silently fail to pick up jobs
 * under connection churn.
 */
export function createQueueConnection(): IORedis {
  const connection = new IORedis(
    process.env.REDIS_URL || "redis://localhost:6379",
    {
      maxRetriesPerRequest: null,
      enableReadyCheck: true,
    },
  );

  connection.on("error", (error) => {
    logger.error("BullMQ Redis connection error", error);
  });

  return connection;
}
