import { Knex } from "knex";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import { v4 as uuidv4 } from "uuid";
import { logger } from "../utils/logger";
import { getJwtDurationSeconds } from "../utils/jwt-duration";

export interface MagicLinkResponse {
  user?: {
    id: string;
    email: string;
    first_name?: string;
    last_name?: string;
    profile_picture_url?: string;
  };
  token?: string;
  refreshToken?: string;
  message: string;
}

export class MagicLinkService {
  private db: Knex;

  constructor(db: Knex) {
    this.db = db;
  }

  async generateMagicLink(email: string): Promise<string> {
    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 15);

    await this.db("magic_links").insert({
      id: uuidv4(),
      email: email.toLowerCase(),
      token,
      expires_at: expiresAt,
      created_at: new Date(),
    });

    return token;
  }

  async verifyMagicLink(token: string): Promise<MagicLinkResponse> {
    const magicLink = await this.db("magic_links")
      .where("token", token)
      .where("expires_at", ">", new Date())
      .where("used_at", null)
      .first();

    if (!magicLink) {
      throw new Error("Invalid or expired magic link");
    }

    const email = magicLink.email;

    const client = await this.db.transaction();
    try {
      let user = await this.db("users").where("email", email).first();

      if (!user) {
        const userId = uuidv4();
        const now = new Date();

        await this.db("users").insert({
          id: userId,
          email,
          first_name: null,
          last_name: null,
          native_language: "Tamil",
          current_level: "A1",
          email_verified: true,
          created_at: now,
          updated_at: now,
        });

        user = await this.db("users").where("id", userId).first();
      } else {
        await this.db("users")
          .where("id", user.id)
          .update({
            email_verified: true,
            updated_at: new Date(),
          });
        user = await this.db("users").where("id", user.id).first();
      }

      await this.db("magic_links")
        .where("id", magicLink.id)
        .update({ used_at: new Date() });

      const { token: jwtToken, refreshToken } = this.generateTokens(user.id);
      await this.createSession(user.id, jwtToken, refreshToken);

      return {
        user: {
          id: user.id,
          email: user.email,
          first_name: user.first_name,
          last_name: user.last_name,
          profile_picture_url: user.profile_picture_url,
        },
        token: jwtToken,
        refreshToken,
        message: "Magic link verified successfully",
      };
    } catch (error) {
      logger.error("Magic link verification error:", error);
      throw error;
    }
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
