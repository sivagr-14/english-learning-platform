import { z } from "zod";

export const RegisterSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
    .regex(/[a-z]/, "Password must contain at least one lowercase letter")
    .regex(/[0-9]/, "Password must contain at least one number"),
  username: z
    .string()
    .min(3, "Username must be at least 3 characters")
    .max(30, "Username must be at most 30 characters")
    .optional(),
  first_name: z.string().max(100, "First name is too long").optional(),
  last_name: z.string().max(100, "Last name is too long").optional(),
  native_language: z.string().max(100, "Native language is too long").optional(),
});

export const LoginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

export const RefreshTokenSchema = z.object({
  refreshToken: z.string().min(1, "Refresh token is required"),
});

export const GoogleOAuthSchema = z.object({
  code: z.string().min(1, "Authorization code is required"),
});

export const GitHubOAuthSchema = z.object({
  code: z.string().min(1, "Authorization code is required"),
});

export const MagicLinkSendSchema = z.object({
  email: z.string().email("Invalid email address"),
});

export const MagicLinkVerifySchema = z.object({
  token: z.string().min(1, "Magic link token is required"),
});

export type RegisterInput = z.infer<typeof RegisterSchema>;
export type LoginInput = z.infer<typeof LoginSchema>;
export type RefreshTokenInput = z.infer<typeof RefreshTokenSchema>;
export type GoogleOAuthInput = z.infer<typeof GoogleOAuthSchema>;
export type GitHubOAuthInput = z.infer<typeof GitHubOAuthSchema>;
export type MagicLinkSendInput = z.infer<typeof MagicLinkSendSchema>;
export type MagicLinkVerifyInput = z.infer<typeof MagicLinkVerifySchema>;
