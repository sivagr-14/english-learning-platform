import { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";
import { logger } from "../utils/logger";

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

  if (err instanceof Error) {
    const status = (err as Error & { status?: number }).status;
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
  }

  return res.status(500).json({
    message: "Internal server error",
  });
};
