import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import dotenv from "dotenv";
import path from "path";
import { logger } from "./utils/logger";
import { errorHandler } from "./middleware/error.middleware";
import { appRevision } from "./services/app-version.service";
import { synchronizeContentPacks } from "./services/content-pack.service";
import { database } from "./utils/db";
import { getRedisClient } from "./utils/redis";

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });
dotenv.config({ path: path.resolve(__dirname, "../../..", ".env.local") });
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const HOST = process.env.HOST || "127.0.0.1";

// Middleware
app.use(helmet());
const allowedOrigins = (
  process.env.CORS_ALLOWED_ORIGINS ||
  "http://localhost:3000,http://127.0.0.1:3000"
)
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes(origin))
        return callback(null, true);
      return callback(new Error("Origin is not allowed by CORS"));
    },
    credentials: true,
  }),
);
app.use(morgan("combined", { stream: { write: (msg) => logger.info(msg) } }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get("/health", (_req, res) => {
  res.json({
    status: "OK",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || "development",
    revision: appRevision,
  });
});

app.get("/ready", async (_req, res) => {
  const [databaseReady, redisReady] = await Promise.all([
    database.raw("select 1").then(() => true).catch(() => false),
    getRedisClient()
      .then(async (redis) => {
        if (!redis) return false;
        return (await redis.ping()) === "PONG";
      })
      .catch(() => false),
  ]);
  const infrastructureReady = databaseReady && redisReady;
  res.status(infrastructureReady ? 200 : 503).json({
    status: infrastructureReady ? "READY" : "DEGRADED",
    services: {
      postgresql: databaseReady ? "ready" : "unavailable",
      redis: redisReady ? "ready" : "unavailable",
      chatgptContentPack: "ready",
      generationMode: "chatgpt-content-packs-only",
    },
  });
});

// API Routes
app.use("/api/auth", require("./routes/auth").default);
app.use("/api/vocabulary", require("./routes/vocabulary").default);
app.use("/api/progress", require("./routes/progress").default);
app.use("/api/flashcards", require("./routes/flashcards").default);
app.use("/api/control", require("./routes/control").default);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: "Route not found",
    path: req.path,
    method: req.method,
  });
});

// Error handler
app.use(errorHandler);

// Start server
app.listen(Number(PORT), HOST, () => {
  logger.info(`Server running on http://${HOST}:${PORT}`);
  logger.info(`Environment: ${process.env.NODE_ENV || "development"}`);

  logger.info("Vocabulary generation mode: ChatGPT content packs only");
  void synchronizeContentPacks(database).catch((error: unknown) =>
    logger.error("Could not synchronize local ChatGPT content packs", error),
  );
  // Redis was already provisioned in docker-compose.yml but nothing in the
  // app ever connected to it. This makes the connection real; every caller
  // (see utils/redis.ts) degrades gracefully if it's unreachable, so this
  // is safe to attempt even before Docker/Redis is confirmed running.
  void getRedisClient();
});

export default app;
