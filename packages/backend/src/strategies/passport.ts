import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { Strategy as GitHubStrategy } from "passport-github2";
import { Knex } from "knex";

export function createGoogleStrategy(db: Knex) {
  const clientID = process.env.GOOGLE_CLIENT_ID as string;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET as string;
  const callbackURL = process.env.GOOGLE_CALLBACK_URL || "http://localhost:5001/api/auth/oauth/google/callback";

  if (!clientID || !clientSecret) {
    throw new Error("Google OAuth credentials not configured");
  }

  return new GoogleStrategy(
    {
      clientID,
      clientSecret,
      callbackURL,
    },
    async (accessToken: string, refreshToken: string, profile: any, done: any) => {
      try {
        done(null, { profile, accessToken, refreshToken });
      } catch (error) {
        done(error);
      }
    }
  );
}

export function createGitHubStrategy(db: Knex) {
  const clientID = process.env.GITHUB_CLIENT_ID as string;
  const clientSecret = process.env.GITHUB_CLIENT_SECRET as string;
  const callbackURL = process.env.GITHUB_CALLBACK_URL || "http://localhost:5001/api/auth/oauth/github/callback";

  if (!clientID || !clientSecret) {
    throw new Error("GitHub OAuth credentials not configured");
  }

  return new GitHubStrategy(
    {
      clientID,
      clientSecret,
      callbackURL,
      scope: ["user:email"],
    },
    async (accessToken: string, refreshToken: string, profile: any, done: any) => {
      try {
        done(null, { profile, accessToken, refreshToken });
      } catch (error) {
        done(error);
      }
    }
  );
}
