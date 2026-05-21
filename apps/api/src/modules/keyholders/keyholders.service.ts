import type { Pool } from 'pg';
import bcrypt from 'bcryptjs';
import type { CreateKeyholderBody, AssignToEventBody } from './keyholders.schema';

const BCRYPT_ROUNDS = 12;

export class KeyholdersService {
  constructor(private readonly db: Pool) {}

  async createKeyholder(venueId: string, input: CreateKeyholderBody) {
    const client = await this.db.connect();
    try {
      await client.query('BEGIN');

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
         VALUES ($1,$2,$3,$4,$5,'keyholder',$6)
         RETURNING id, venue_id, email, first_name, last_name, role`,
        [venueId, input.email, passwordHash, input.firstName, input.lastName, input.phone ?? null],
      );

      const user = userResult.rows[0]!;

      const khResult = await client.query(
        `INSERT INTO keyholders (venue_id, user_id, display_name)
         VALUES ($1,$2,$3) RETURNING *`,
        [venueId, user.id, input.displayName ?? null],
      );

      await client.query('COMMIT');
      return {
        user: {
          id: user.id,
          email: user.email,
          firstName: user.first_name,
          lastName: user.last_name,
          role: user.role,
          venueId: user.venue_id,
        },
        keyholder: khResult.rows[0]!,
      };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async listKeyholders(venueId: string) {
    const result = await this.db.query(
      `SELECT k.id, k.display_name, k.is_active, k.created_at,
              u.id as user_id, u.email, u.first_name, u.last_name, u.phone
       FROM keyholders k
       JOIN users u ON u.id = k.user_id
       WHERE k.venue_id = $1
       ORDER BY u.first_name ASC`,
      [venueId],
    );
    return result.rows;
  }

  async getKeyholder(venueId: string, keyholderId: string) {
    const result = await this.db.query(
      `SELECT k.id, k.display_name, k.is_active, k.created_at,
              u.id as user_id, u.email, u.first_name, u.last_name, u.phone
       FROM keyholders k
       JOIN users u ON u.id = k.user_id
       WHERE k.id = $1 AND k.venue_id = $2`,
      [keyholderId, venueId],
    );
    return result.rows[0] ?? null;
  }

  async getKeyholderByUserId(venueId: string, userId: string) {
    const result = await this.db.query(
      `SELECT * FROM keyholders WHERE venue_id = $1 AND user_id = $2`,
      [venueId, userId],
    );
    return result.rows[0] ?? null;
  }

  async assignToEvent(venueId: string, keyholderId: string, input: AssignToEventBody) {
    const result = await this.db.query(
      `INSERT INTO keyholder_events (venue_id, keyholder_id, event_id, threshold)
       VALUES ($1,$2,$3,$4)
       ON CONFLICT (keyholder_id, event_id) DO UPDATE SET threshold = EXCLUDED.threshold
       RETURNING *`,
      [venueId, keyholderId, input.eventId, input.threshold],
    );
    return result.rows[0]!;
  }
}
