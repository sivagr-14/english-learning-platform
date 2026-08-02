import express, { Router, Request, Response, NextFunction } from "express";
import rateLimit from "express-rate-limit";
import { logger } from "../utils/logger";
import { database } from "../utils/db";
import { AuthService } from "../services/auth.service";
import { authMiddleware, AuthenticatedRequest } from "../middleware/auth.middleware";
import {
  RegisterSchema,
  LoginSchema,
  RefreshTokenSchema,
} from "../validations/auth.validations";
import { AppError } from "../middleware/error.middleware";

const router = Router();

// express-rate-limit was already a dependency (and already used for the
// internal /__control endpoints) but was never applied to the public auth
// surface, leaving /login and /register open to credential-stuffing and
// brute-force attempts. Keyed on IP; email/password validity is checked
// after this middleware runs, so failed attempts still count against the
// limit even before the credentials are looked up.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many login attempts. Try again in a few minutes." },
});

const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many registration attempts. Try again later." },
});

const magicLinkLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many magic-link requests. Try again later." },
});

/**
 * POST /api/auth/register
 * Register a new user with email and password
 */
router.post("/register", registerLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = RegisterSchema.parse(req.body);
    const authService = new AuthService(database);

    const result = await authService.register(input);

    logger.info(`User registered: ${result.user.email}`);

    res.status(201).json({
      message: "User registered successfully",
      user: {
        id: result.user.id,
        email: result.user.email,
        username: result.user.username,
        first_name: result.user.first_name,
        last_name: result.user.last_name,
      },
      token: result.token,
      refreshToken: result.refreshToken,
    });
  } catch (error) {
    logger.error("Registration error:", error);
    next(error);
  }
});

/**
 * POST /api/auth/login
 * Login with email and password
 */
router.post("/login", loginLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = LoginSchema.parse(req.body);
    const authService = new AuthService(database);

    const result = await authService.login(input);

    logger.info(`User logged in: ${result.user.email}`);

    res.status(200).json({
      message: "Logged in successfully",
      user: {
        id: result.user.id,
        email: result.user.email,
        username: result.user.username,
        first_name: result.user.first_name,
        last_name: result.user.last_name,
      },
      token: result.token,
      refreshToken: result.refreshToken,
    });
  } catch (error) {
    logger.error("Login error:", error);
    next(error);
  }
});

/**
 * POST /api/auth/refresh
 * Refresh access token using refresh token
 */
router.post("/refresh", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = RefreshTokenSchema.parse(req.body);
    const authService = new AuthService(database);

    const result = await authService.refreshToken(input.refreshToken);

    res.status(200).json({
      message: "Token refreshed successfully",
      token: result.token,
      refreshToken: result.refreshToken,
    });
  } catch (error) {
    logger.error("Token refresh error:", error);
    next(error);
  }
});

/**
 * POST /api/auth/logout
 * Logout user
 */
router.post("/logout", authMiddleware, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const token = req.headers.authorization?.substring(7);

    if (!token) {
      throw new AppError(400, "No token provided");
    }

    const authService = new AuthService(database);
    await authService.logout(token);

    logger.info(`User logged out: ${req.userId}`);

    res.status(200).json({
      message: "Logged out successfully",
    });
  } catch (error) {
    logger.error("Logout error:", error);
    next(error);
  }
});

/**
 * GET /api/auth/me
 * Get current user profile
 */
router.get("/me", authMiddleware, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const user = await database("users").where("id", req.userId).first();

    if (!user) {
      throw new AppError(404, "User not found");
    }

    res.status(200).json({
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        first_name: user.first_name,
        last_name: user.last_name,
        profile_picture_url: user.profile_picture_url,
        native_language: user.native_language,
        current_level: user.current_level,
        learning_goal: user.learning_goal,
        email_verified: user.email_verified,
      },
    });
  } catch (error) {
    logger.error("Get user error:", error);
    next(error);
  }
});

/**
 * POST /api/auth/oauth/google
 * Google OAuth authentication
 */
router.post("/oauth/google", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { GoogleOAuthSchema } = await import("../validations/auth.validations");
    const { OAuthService } = await import("../services/oauth.service");
    const axios = require("axios");

    const input = GoogleOAuthSchema.parse(req.body);
    const code = input.code;

    const tokenResponse = await axios.post(
      "https://oauth2.googleapis.com/token",
      {
        code,
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        redirect_uri: process.env.GOOGLE_CALLBACK_URL || "http://localhost:3001/login/oauth-callback",
        grant_type: "authorization_code",
      }
    );

    const userResponse = await axios.get(
      "https://www.googleapis.com/oauth2/v2/userinfo",
      {
        headers: {
          Authorization: `Bearer ${tokenResponse.data.access_token}`,
        },
      }
    );

    const profile = {
      id: userResponse.data.id,
      displayName: userResponse.data.name,
      emails: [{ value: userResponse.data.email }],
      photos: [{ value: userResponse.data.picture }],
    };

    const oauthService = new OAuthService(database);
    const result = await oauthService.handleOAuthLogin("google", profile);

    logger.info(`Google OAuth login: ${result.user.email}`);

    res.status(200).json({
      message: "Google OAuth successful",
      user: {
        id: result.user.id,
        email: result.user.email,
        first_name: result.user.first_name,
        last_name: result.user.last_name,
        profile_picture_url: result.user.profile_picture_url,
      },
      token: result.token,
      refreshToken: result.refreshToken,
    });
  } catch (error) {
    logger.error("Google OAuth error:", error);
    next(error);
  }
});

/**
 * GET /api/auth/oauth/google/start
 * Redirect user to Google's OAuth consent screen (server-side start)
 */
router.get('/oauth/google/start', (req: Request, res: Response) => {
  const state = (req.query.state as string) || '';
  const redirectUri = process.env.GOOGLE_CALLBACK_URL || `${process.env.API_URL || 'http://localhost:5001'}/api/auth/oauth/google/callback`;

  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${process.env.GOOGLE_CLIENT_ID}&redirect_uri=${encodeURIComponent(
    redirectUri
  )}&response_type=code&scope=${encodeURIComponent('profile email')}&access_type=offline&prompt=consent&state=${encodeURIComponent(state)}`;

  return res.redirect(authUrl);
});

/**
 * GET /api/auth/oauth/google/callback
 * Exchange code for tokens server-side, create/find user, then redirect to frontend with tokens
 */
router.get('/oauth/google/callback', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const axios = require('axios');
    const code = req.query.code as string;
    if (!code) throw new AppError(400, 'Missing code');

    const tokenResponse = await axios.post(
      'https://oauth2.googleapis.com/token',
      {
        code,
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        redirect_uri: process.env.GOOGLE_CALLBACK_URL || `${process.env.API_URL || 'http://localhost:5001'}/api/auth/oauth/google/callback`,
        grant_type: 'authorization_code',
      }
    );

    const userResponse = await axios.get('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokenResponse.data.access_token}` },
    });

    const profile = {
      id: userResponse.data.id,
      displayName: userResponse.data.name,
      emails: [{ value: userResponse.data.email }],
      photos: [{ value: userResponse.data.picture }],
    };

    const { OAuthService } = await import('../services/oauth.service');
    const oauthService = new OAuthService(database);
    const result = await oauthService.handleOAuthLogin('google', profile);

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';

    // redirect to frontend callback with tokens
    const redirectTo = `${frontendUrl}/login/oauth-callback?token=${encodeURIComponent(result.token)}&refreshToken=${encodeURIComponent(
      result.refreshToken
    )}`;

    return res.redirect(redirectTo);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/auth/oauth/github
 * GitHub OAuth authentication
 */
router.post("/oauth/github", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { GitHubOAuthSchema } = await import("../validations/auth.validations");
    const { OAuthService } = await import("../services/oauth.service");
    const axios = require("axios");

    const input = GitHubOAuthSchema.parse(req.body);
    const code = input.code;

    const tokenResponse = await axios.post(
      "https://github.com/login/oauth/access_token",
      {
        client_id: process.env.GITHUB_CLIENT_ID,
        client_secret: process.env.GITHUB_CLIENT_SECRET,
        code,
        redirect_uri: process.env.GITHUB_CALLBACK_URL || "http://localhost:3001/login/oauth-callback",
      },
      {
        headers: {
          Accept: "application/json",
        },
      }
    );

    const userResponse = await axios.get(
      "https://api.github.com/user",
      {
        headers: {
          Authorization: `Bearer ${tokenResponse.data.access_token}`,
        },
      }
    );

    const emailResponse = await axios.get(
      "https://api.github.com/user/emails",
      {
        headers: {
          Authorization: `Bearer ${tokenResponse.data.access_token}`,
        },
      }
    );

    const primaryEmail = emailResponse.data.find((e: any) => e.primary) || emailResponse.data[0];

    const profile = {
      id: String(userResponse.data.id),
      displayName: userResponse.data.name || userResponse.data.login,
      emails: [{ value: primaryEmail.email }],
      photos: [{ value: userResponse.data.avatar_url }],
    };

    const oauthService = new OAuthService(database);
    const result = await oauthService.handleOAuthLogin("github", profile);

    logger.info(`GitHub OAuth login: ${result.user.email}`);

    res.status(200).json({
      message: "GitHub OAuth successful",
      user: {
        id: result.user.id,
        email: result.user.email,
        first_name: result.user.first_name,
        last_name: result.user.last_name,
        profile_picture_url: result.user.profile_picture_url,
      },
      token: result.token,
      refreshToken: result.refreshToken,
    });
  } catch (error) {
    logger.error("GitHub OAuth error:", error);
    next(error);
  }
});

// GitHub server-side start and callback
router.get('/oauth/github/start', (req: Request, res: Response) => {
  const state = (req.query.state as string) || '';
  const redirectUri = process.env.GITHUB_CALLBACK_URL || `${process.env.API_URL || 'http://localhost:5001'}/api/auth/oauth/github/callback`;
  const authUrl = `https://github.com/login/oauth/authorize?client_id=${process.env.GITHUB_CLIENT_ID}&redirect_uri=${encodeURIComponent(
    redirectUri
  )}&scope=${encodeURIComponent('read:user user:email')}&state=${encodeURIComponent(state)}`;
  return res.redirect(authUrl);
});

router.get('/oauth/github/callback', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const axios = require('axios');
    const code = req.query.code as string;
    if (!code) throw new AppError(400, 'Missing code');

    const tokenResponse = await axios.post(
      'https://github.com/login/oauth/access_token',
      {
        client_id: process.env.GITHUB_CLIENT_ID,
        client_secret: process.env.GITHUB_CLIENT_SECRET,
        code,
        redirect_uri: process.env.GITHUB_CALLBACK_URL || `${process.env.API_URL || 'http://localhost:5001'}/api/auth/oauth/github/callback`,
      },
      { headers: { Accept: 'application/json' } }
    );

    const userResponse = await axios.get('https://api.github.com/user', {
      headers: { Authorization: `Bearer ${tokenResponse.data.access_token}` },
    });

    const emailResponse = await axios.get('https://api.github.com/user/emails', {
      headers: { Authorization: `Bearer ${tokenResponse.data.access_token}` },
    });

    const primaryEmail = emailResponse.data.find((e: any) => e.primary) || emailResponse.data[0];

    const profile = {
      id: String(userResponse.data.id),
      displayName: userResponse.data.name || userResponse.data.login,
      emails: [{ value: primaryEmail.email }],
      photos: [{ value: userResponse.data.avatar_url }],
    };

    const { OAuthService } = await import('../services/oauth.service');
    const oauthService = new OAuthService(database);
    const result = await oauthService.handleOAuthLogin('github', profile);

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const redirectTo = `${frontendUrl}/login/oauth-callback?token=${encodeURIComponent(result.token)}&refreshToken=${encodeURIComponent(
      result.refreshToken
    )}`;

    return res.redirect(redirectTo);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/auth/magic-link/send
 * Send magic link to user's email
 */
router.post("/magic-link/send", magicLinkLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { MagicLinkSendSchema } = await import("../validations/auth.validations");
    const { MagicLinkService } = await import("../services/magic-link.service");
    const { EmailService } = await import("../services/email.service");

    const input = MagicLinkSendSchema.parse(req.body);
    const magicLinkService = new MagicLinkService(database);
    const emailService = new EmailService();

    const token = await magicLinkService.generateMagicLink(input.email);
    const appUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";
    
    await emailService.sendMagicLink(input.email, token, appUrl);

    logger.info(`Magic link generated for ${input.email}`);

    res.status(200).json({
      message: "Magic link sent to your email",
      email: input.email,
    });
  } catch (error) {
    logger.error("Magic link send error:", error);
    next(error);
  }
});

/**
 * POST /api/auth/magic-link/verify
 * Verify magic link and authenticate user
 */
router.post("/magic-link/verify", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { MagicLinkVerifySchema } = await import("../validations/auth.validations");
    const { MagicLinkService } = await import("../services/magic-link.service");

    const input = MagicLinkVerifySchema.parse(req.body);
    const magicLinkService = new MagicLinkService(database);

    const result = await magicLinkService.verifyMagicLink(input.token);

    logger.info(`Magic link verified for ${result.user?.email}`);

    res.status(200).json({
      message: result.message,
      user: {
        id: result.user?.id,
        email: result.user?.email,
        first_name: result.user?.first_name,
        last_name: result.user?.last_name,
      },
      token: result.token,
      refreshToken: result.refreshToken,
    });
  } catch (error) {
    logger.error("Magic link verify error:", error);
    next(error);
  }
});

export default router;