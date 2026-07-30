import { Request, Response, NextFunction } from "express";
import { logger } from "../utils/logger";
import { database } from "../utils/db";
import { AuthService } from "../services/auth.service";

export interface AuthenticatedRequest extends Request {
  userId?: string;
  user?: any;
}

export const authMiddleware = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const token = authHeader.substring(7);

    const authService = new AuthService(database);
    const userId = await authService.verifyToken(token);

    if (!userId) {
      return res.status(401).json({ error: "Invalid token" });
    }

    req.userId = userId;
    next();
  } catch (error) {
    logger.error("Auth middleware error:", error);
    return res.status(401).json({ error: "Unauthorized" });
  }
};

export const optionalAuthMiddleware = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.substring(7);
      const authService = new AuthService(database);
      const userId = await authService.verifyToken(token);

      if (userId) {
        req.userId = userId;
      }
    }

    next();
  } catch (error) {
    logger.error("Optional auth middleware error:", error);
    next();
  }
};
