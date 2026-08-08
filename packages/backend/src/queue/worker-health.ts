import { getRedisClient } from "../utils/redis";

export const GENERATION_WORKER_HEALTH_KEY = "generation-worker:ready";
export const GENERATION_WORKER_HEALTH_TTL_SECONDS = 15;

export async function generationWorkerReady(): Promise<boolean> {
  try {
    const redis = await getRedisClient();
    return Boolean(await redis?.get(GENERATION_WORKER_HEALTH_KEY));
  } catch {
    return false;
  }
}
