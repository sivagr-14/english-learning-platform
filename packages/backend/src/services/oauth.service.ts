import { Knex } from "knex";
import { v4 as uuidv4 } from "uuid";
import { logger } from "../utils/logger";
import jwt from "jsonwebtoken";
import { getJwtDurationSeconds } from "../utils/jwt-duration";

export interface OAuthProfile {
  id: string;
  displayName: string;
  emails: Array<{ value: string }>;
  photos: Array<{ value: string }>;
}

export interface OAuthUser {
  id: string;
  email: string;
  first_name?: string;
  last_name?: string;
  profile_picture_url?: string;
}

export interface OAuthResponse {
  user: OAuthUser;
  token: string;
  refreshToken: string;
}

export class OAuthService {
  private db: Knex;

  constructor(db: Knex) {
    this.db = db;
  }

  async handleOAuthLogin(
    provider: "google" | "github",
    profile: OAuthProfile
  ): Promise<OAuthResponse> {
    const email = profile.emails?.[0]?.value;
    if (!email) {
      throw new Error("Email not provided by OAuth provider");
    }

    const providerId = profile.id;
    const displayName = profile.displayName || "";
    const profilePictureUrl = profile.photos?.[0]?.value;

    const client = await this.db.transaction();
    try {
      let oauthAccount = await this.db("oauth_accounts")
        .where("provider", provider)
        .andWhere("provider_user_id", providerId)
        .first();

      if (oauthAccount) {
        const user = await this.db("users")
          .where("id", oauthAccount.user_id)
          .first();

        if (!user) {
          throw new Error("User associated with OAuth account not found");
        }

        const { token, refreshToken } = this.generateTokens(user.id);
        await this.createSession(user.id, token, refreshToken);

        return {
          user: {
            id: user.id,
            email: user.email,
            first_name: user.first_name,
            last_name: user.last_name,
            profile_picture_url: user.profile_picture_url,
          },
          token,
          refreshToken,
        };
      }

      let user = await this.db("users").where("email", email).first();

      if (!user) {
        const userId = uuidv4();
        const names = this.parseDisplayName(displayName);

        await this.db("users").insert({
          id: userId,
          email,
          first_name: names.first || null,
          last_name: names.last || null,
          profile_picture_url: profilePictureUrl || null,
          native_language: "Tamil",
          current_level: "A1",
          email_verified: true,
          created_at: new Date(),
          updated_at: new Date(),
        });

        user = await this.db("users").where("id", userId).first();
      } else {
        await this.db("users")
          .where("id", user.id)
          .update({
            profile_picture_url: profilePictureUrl || user.profile_picture_url,
            updated_at: new Date(),
          });
        user = await this.db("users").where("id", user.id).first();
      }

      await this.db("oauth_accounts").insert({
        id: uuidv4(),
        user_id: user.id,
        provider,
        provider_user_id: providerId,
        created_at: new Date(),
        updated_at: new Date(),
      });

      const { token, refreshToken } = this.generateTokens(user.id);
      await this.createSession(user.id, token, refreshToken);

      return {
        user: {
          id: user.id,
          email: user.email,
          first_name: user.first_name,
          last_name: user.last_name,
          profile_picture_url: user.profile_picture_url,
        },
        token,
        refreshToken,
      };
    } catch (error) {
      logger.error("OAuth login error:", error);
      throw error;
    }
  }

  private parseDisplayName(displayName: string): {
    first?: string;
    last?: string;
  } {
    const parts = displayName.split(" ");
    return {
      first: parts[0],
      last: parts.slice(1).join(" ") || undefined,
    };
  }

  private generateTokens(userId: string): {
    token: string;
    refreshToken: string;
  } {
    const secret = process.env.JWT_SECRET as string;
    const expiresIn = process.env.JWT_EXPIRATION || "1h";
    const refreshExpiresIn = process.env.JWT_REFRESH_EXPIRATION || "30d";

    const token = jwt.sign({ userId }, secret, {
      expiresIn,
    } as any);

    const refreshToken = jwt.sign({ userId }, secret, {
      expiresIn: refreshExpiresIn,
    } as any);

    return { token, refreshToken };
  }

  private async createSession(
    userId: string,
    token: string,
    refreshToken: string
  ): Promise<void> {
    const expiresAt = new Date();
    expiresAt.setSeconds(
      expiresAt.getSeconds() +
        getJwtDurationSeconds(process.env.JWT_REFRESH_EXPIRATION || "30d")
    );

    await this.db("user_sessions").insert({
      id: uuidv4(),
      user_id: userId,
      token,
      refresh_token: refreshToken,
      expires_at: expiresAt,
      created_at: new Date(),
    });
  }
}
