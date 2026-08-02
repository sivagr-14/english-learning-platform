import { createClient, RedisClientType } from "redis";
import { logger } from "./logger";

let client: RedisClientType | null = null;
let connecting: Promise<void> | null = null;
let available = false;

/**
 * Redis is a cache, not a source of truth. Every call in this module is
 * best-effort: if Redis is down or was never started, callers fall back to
 * hitting Postgres directly instead of failing the request. This mirrors how
 * the app already treats optional infrastructure (e.g. Docker Desktop checks
 * in the startup page) rather than introducing a new hard dependency.
 */
export async function getRedisClient(): Promise<RedisClientType | null> {
  if (client && available) return client;
  if (!connecting) {
    connecting = (async () => {
      try {
        client = createClient({ url: process.env.REDIS_URL || "redis://localhost:6379" });
        client.on("error", (err) => {
          available = false;
          logger.warn("Redis connection error (caching disabled until reconnect)", err);
        });
        client.on("ready", () => {
          available = true;
          logger.info("Redis connected; caching enabled");
        });
        await client.connect();
      } catch (error) {
        available = false;
        logger.warn("Redis unavailable at startup; continuing without cache", error);
      }
    })();
  }
  await connecting;
  return available ? client : null;
}

export async function cacheGetJson<T>(key: string): Promise<T | null> {
  try {
    const redis = await getRedisClient();
    if (!redis) return null;
    const raw = await redis.get(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch (error) {
    logger.warn(`Redis GET failed for ${key}`, error);
    return null;
  }
}

export async function cacheSetJson(
  key: string,
  value: unknown,
  ttlSeconds: number,
): Promise<void> {
  try {
    const redis = await getRedisClient();
    if (!redis) return;
    await redis.set(key, JSON.stringify(value), { EX: ttlSeconds });
  } catch (error) {
    logger.warn(`Redis SET failed for ${key}`, error);
  }
}

export async function cacheInvalidate(keyOrPrefix: string): Promise<void> {
  try {
    const redis = await getRedisClient();
    if (!redis) return;
    if (keyOrPrefix.endsWith("*")) {
      const keys = await redis.keys(keyOrPrefix);
      if (keys.length) await redis.del(keys);
    } else {
      await redis.del(keyOrPrefix);
    }
  } catch (error) {
    logger.warn(`Redis invalidate failed for ${keyOrPrefix}`, error);
  }
}

export async function closeRedis(): Promise<void> {
  if (client && available) {
    await client.quit();
    available = false;
  }
}
