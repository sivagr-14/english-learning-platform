jest.mock("../utils/redis", () => ({
  getRedisClient: jest.fn(),
}));

import { getRedisClient } from "../utils/redis";
import {
  GENERATION_WORKER_HEALTH_KEY,
  generationWorkerReady,
} from "../queue/worker-health";

const mockedGetRedisClient = getRedisClient as jest.MockedFunction<
  typeof getRedisClient
>;

describe("generation worker health", () => {
  it("reports ready only while a worker heartbeat exists", async () => {
    const get = jest.fn().mockResolvedValue('{"pid":123}');
    mockedGetRedisClient.mockResolvedValue({ get } as any);

    await expect(generationWorkerReady()).resolves.toBe(true);
    expect(get).toHaveBeenCalledWith(GENERATION_WORKER_HEALTH_KEY);

    get.mockResolvedValue(null);
    await expect(generationWorkerReady()).resolves.toBe(false);
  });

  it("fails closed when Redis is unavailable", async () => {
    mockedGetRedisClient.mockResolvedValue(null);
    await expect(generationWorkerReady()).resolves.toBe(false);
  });
});
