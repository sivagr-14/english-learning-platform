import { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";
import { logger } from "../utils/logger";
import { ProviderRequestError } from "../services/provider-reliability";

export interface ApiError {
  status: number;
  message: string;
  details?: any;
}

export class AppError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export const errorHandler = (
  err: Error | ZodError | AppError,
  _req: Request,
  res: Response,
  _next: NextFunction,
) => {
  logger.error("Error:", err);

  if (err instanceof ZodError) {
    const details = err.errors.map((e) => ({
      field: e.path.join("."),
      message: e.message,
    }));

    return res.status(400).json({
      message: "Validation failed",
      details,
    });
  }

  if (err instanceof AppError) {
    return res.status(err.status).json({
      message: err.message,
    });
  }

  if (err instanceof ProviderRequestError) {
    const fallbackStatus: Record<ProviderRequestError["code"], number> = {
      cancelled: 408,
      timeout: 504,
      rate_limited: 429,
      provider_unavailable: 503,
      authentication_failed: 401,
      malformed_json: 502,
      validation_failed: 422,
      permanent_failure: 502,
    };
    return res.status(err.status || fallbackStatus[err.code]).json({
      message: err.message,
      code: err.code,
      retryable: err.retryable,
    });
  }

  if (err instanceof Error) {
    const databaseError = err as Error & { code?: string; status?: number };
    const status = databaseError.status;
    if (status && status >= 400 && status < 600) {
      return res.status(status).json({
        message: err.message,
      });
    }

    if (
      err.message.includes("Email already registered") ||
      err.message.includes("Username already taken")
    ) {
      return res.status(409).json({
        message: err.message,
      });
    }

    if (err.message.includes("Invalid email or password")) {
      return res.status(401).json({
        message: err.message,
      });
    }

    if (err.message.includes("Invalid or expired refresh token")) {
      return res.status(401).json({
        message: err.message,
      });
    }

    if (databaseError.code === "42P01") {
      return res.status(503).json({
        message:
          "Database setup is incomplete. Run the database migrations and try again.",
      });
    }
  }

  return res.status(500).json({
    message: "Internal server error",
  });
};
