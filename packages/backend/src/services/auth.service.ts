import { Knex } from "knex";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { v4 as uuidv4 } from "uuid";
import { logger } from "../utils/logger";
import { getJwtDurationSeconds } from "../utils/jwt-duration";

export interface User {
  id: string;
  email: string;
  username?: string;
  password_hash?: string;
  first_name?: string;
  last_name?: string;
  profile_picture_url?: string;
  native_language?: string;
  current_level?: string;
  learning_goal?: string;
  email_verified: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface RegisterInput {
  email: string;
  password: string;
  username?: string;
  first_name?: string;
  last_name?: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface AuthResponse {
  user: User;
  token: string;
  refreshToken: string;
}

export class AuthService {
  private db: Knex;

  constructor(db: Knex) {
    this.db = db;
  }

  async register(input: RegisterInput): Promise<AuthResponse> {
    const { email, password, username, first_name, last_name } = input;

    const existingUserQuery = this.db("users").where("email", email);
    if (username) {
      existingUserQuery.orWhere("username", username);
    }
    const existingUser = await existingUserQuery.first();

    if (existingUser) {
      throw new Error(
        existingUser.email === email
          ? "Email already registered"
          : "Username already taken",
      );
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const userId = uuidv4();
    const now = new Date();
    const { token, refreshToken } = this.generateTokens(userId);

    const user = await this.db.transaction(async (trx) => {
      await trx("users").insert({
        id: userId,
        email,
        username: username || null,
        password_hash: hashedPassword,
        first_name: first_name || null,
        last_name: last_name || null,
        native_language: "Tamil",
        current_level: "A1",
        email_verified: false,
        created_at: now,
        updated_at: now,
      });

      const createdUser = await trx("users").where("id", userId).first();
      await this.createSession(userId, token, refreshToken, trx);
      return createdUser;
    });

    return {
      user,
      token,
      refreshToken,
    };
  }

  async login(input: LoginInput): Promise<AuthResponse> {
    const { email, password } = input;

    const user = await this.db("users").where("email", email).first();

    if (!user) {
      throw new Error("Invalid email or password");
    }

    const isValidPassword = await bcrypt.compare(password, user.password_hash);

    if (!isValidPassword) {
      throw new Error("Invalid email or password");
    }

    const { token, refreshToken } = this.generateTokens(user.id);

    await this.createSession(user.id, token, refreshToken);

    return {
      user,
      token,
      refreshToken,
    };
  }

  async verifyToken(token: string): Promise<string | null> {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as {
        userId: string;
      };
      return decoded.userId;
    } catch {
      return null;
    }
  }

  async refreshToken(refreshToken: string): Promise<AuthResponse> {
    const session = await this.db("user_sessions")
      .where("refresh_token", refreshToken)
      .andWhere("revoked_at", null)
      .first();

    if (!session || new Date(session.expires_at) < new Date()) {
      throw new Error("Invalid or expired refresh token");
    }

    const user = await this.db("users").where("id", session.user_id).first();

    if (!user) {
      throw new Error("User not found");
    }

    const { token: newToken, refreshToken: newRefreshToken } =
      this.generateTokens(user.id);

    await this.db("user_sessions")
      .where("id", session.id)
      .update({ revoked_at: new Date() });

    await this.createSession(user.id, newToken, newRefreshToken);

    return {
      user,
      token: newToken,
      refreshToken: newRefreshToken,
    };
  }

  async logout(token: string): Promise<void> {
    await this.db("user_sessions").where("token", token).update({
      revoked_at: new Date(),
    });
  }

  private generateTokens(userId: string): {
    token: string;
    refreshToken: string;
  } {
    const secret = process.env.JWT_SECRET as string;
    if (!secret) {
      throw new Error("JWT_SECRET is not configured");
    }
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
    refreshToken: string,
    db: Knex | Knex.Transaction = this.db,
  ): Promise<void> {
    const expiresAt = new Date();
    expiresAt.setSeconds(
      expiresAt.getSeconds() +
        getJwtDurationSeconds(process.env.JWT_REFRESH_EXPIRATION || "30d"),
    );

    await db("user_sessions").insert({
      id: uuidv4(),
      user_id: userId,
      token,
      refresh_token: refreshToken,
      expires_at: expiresAt,
      created_at: new Date(),
    });
  }
}
