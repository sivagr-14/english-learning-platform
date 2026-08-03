import dotenv from "dotenv";
import fs from "fs";
import path from "path";

function findDotenvLocal(): string | null {
  const candidates = [
    path.resolve(process.cwd(), ".env.local"),
    path.resolve(__dirname, "../../../.env.local"),
    path.resolve(__dirname, "../../.env.local"),
    path.resolve(__dirname, "../.env.local"),
    path.resolve(__dirname, ".env.local"),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }
  return null;
}

const dotenvPath = findDotenvLocal();
if (dotenvPath) {
  dotenv.config({ path: dotenvPath });
  console.info(`Loaded .env.local from ${dotenvPath}`);
} else {
  dotenv.config();
  console.warn("No .env.local found while starting worker");
}

import { startGenerationWorker } from "./queue/generation.worker";
import { logger } from "./utils/logger";

const worker = startGenerationWorker();

process.on("SIGTERM", async () => {
  logger.info("Worker received SIGTERM, shutting down gracefully");
  await worker.close();
  process.exit(0);
});

process.on("SIGINT", async () => {
  logger.info("Worker received SIGINT, shutting down gracefully");
  await worker.close();
  process.exit(0);
});
