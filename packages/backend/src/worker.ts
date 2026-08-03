import dotenv from "dotenv";
dotenv.config();
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
