import type { Pool } from 'pg';
import type Redis from 'ioredis';
import bcrypt from 'bcryptjs';
import { randomBytes, createHash } from 'crypto';

const BCRYPT_ROUNDS = 12;

export interface RegisterInput {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone?: string;
  venueName: string;
  venueSlug: string;
}

export interface LoginInput {
  email: string;
  password: string;
  venueSlug: string;
}

export interface AuthUser {
  id: string;
  venueId: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
}

export class AuthService {
  constructor(
    private readonly db: Pool,
    private readonly redis: Redis,
  ) {}

  async register(input: RegisterInput): Promise<AuthUser> {
    const client = await this.db.connect();
    try {
      await client.query('BEGIN');

      const venueResult = await client.query<{ id: string }>(
        `INSERT INTO venues (name, slug) VALUES ($1, $2) RETURNING id`,
        [input.venueName, input.venueSlug],
      );
      const venueId = venueResult.rows[0]!.id;

      const passwordHash = await bcrypt.hash(input.password, BCRYPT_ROUNDS);

      const userResult = await client.query<{
        id: string;
        venue_id: string;
        email: string;
        first_name: string;
        last_name: string;
        role: string;
      }>(
        `INSERT INTO users (venue_id, email, password_hash, first_name, last_name, role, phone)
         VALUES ($1, $2, $3, $4, $5, 'admin', $6)
         RETURNING id, venue_id, email, first_name, last_name, role`,
        [venueId, input.email, passwordHash, input.firstName, input.lastName, input.phone ?? null],
      );

      await client.query('COMMIT');

      const row = userResult.rows[0]!;
      return {
        id: row.id,
        venueId: row.venue_id,
        email: row.email,
        firstName: row.first_name,
        lastName: row.last_name,
        role: row.role,
      };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async login(input: LoginInput): Promise<AuthUser> {
    const venueResult = await this.db.query<{ id: string }>(
      `SELECT id FROM venues WHERE slug = $1 AND is_active = true`,
      [input.venueSlug],
    );

    if (venueResult.rows.length === 0) {
      throw new AuthError('Invalid credentials');
    }

    const venueId = venueResult.rows[0]!.id;

    const userResult = await this.db.query<{
      id: string;
      venue_id: string;
      email: string;
      password_hash: string;
      first_name: string;
      last_name: string;
      role: string;
      is_active: boolean;
    }>(
      `SELECT id, venue_id, email, password_hash, first_name, last_name, role, is_active
       FROM users WHERE venue_id = $1 AND email = $2`,
      [venueId, input.email],
    );

    if (userResult.rows.length === 0) {
      throw new AuthError('Invalid credentials');
    }

    const user = userResult.rows[0]!;

    if (!user.is_active) {
      throw new AuthError('Account disabled', 403);
    }

    const valid = await bcrypt.compare(input.password, user.password_hash);
    if (!valid) {
      throw new AuthError('Invalid credentials');
    }

    return {
      id: user.id,
      venueId: user.venue_id,
      email: user.email,
      firstName: user.first_name,
      lastName: user.last_name,
      role: user.role,
    };
  }

  async storeRefreshToken(userId: string, venueId: string): Promise<string> {
    const token = randomBytes(48).toString('hex');
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const expiresInSeconds = 30 * 24 * 60 * 60; // 30 days
    const expiresAt = new Date(Date.now() + expiresInSeconds * 1000);

    await this.db.query(
      `INSERT INTO refresh_tokens (venue_id, user_id, token_hash, expires_at)
       VALUES ($1, $2, $3, $4)`,
      [venueId, userId, tokenHash, expiresAt],
    );

    await this.redis.setex(
      `refresh:${tokenHash}`,
      expiresInSeconds,
      JSON.stringify({ userId, venueId }),
    );

    return token;
  }

  async verifyRefreshToken(token: string): Promise<{ userId: string; venueId: string }> {
    const tokenHash = createHash('sha256').update(token).digest('hex');

    const cached = await this.redis.get(`refresh:${tokenHash}`);
    if (cached) {
      return JSON.parse(cached) as { userId: string; venueId: string };
    }

    const result = await this.db.query<{ user_id: string; venue_id: string }>(
      `SELECT user_id, venue_id FROM refresh_tokens
       WHERE token_hash = $1 AND expires_at > NOW()`,
      [tokenHash],
    );

    if (result.rows.length === 0) {
      throw new AuthError('Invalid or expired refresh token', 401);
    }

    return {
      userId: result.rows[0]!.user_id,
      venueId: result.rows[0]!.venue_id,
    };
  }

  async revokeRefreshToken(token: string): Promise<void> {
    const tokenHash = createHash('sha256').update(token).digest('hex');
    await this.db.query(`DELETE FROM refresh_tokens WHERE token_hash = $1`, [tokenHash]);
    await this.redis.del(`refresh:${tokenHash}`);
  }
}

export class AuthError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number = 401,
  ) {
    super(message);
    this.name = 'AuthError';
  }
}
