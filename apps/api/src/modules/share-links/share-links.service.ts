import type { Pool } from 'pg';
import { randomBytes } from 'crypto';
import type { CreateShareLinkBody } from './share-links.schema';

export class ShareLinksService {
  constructor(private readonly db: Pool) {}

  async createShareLink(venueId: string, keyholderId: string, input: CreateShareLinkBody) {
    const token = randomBytes(24).toString('base64url');
    const result = await this.db.query(
      `INSERT INTO share_links
         (venue_id, keyholder_id, event_id, pass_tier_id, link_type, token, max_uses, expires_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [
        venueId,
        keyholderId,
        input.eventId,
        input.passTierId,
        input.linkType,
        token,
        input.maxUses ?? null,
        input.expiresAt ?? null,
      ],
    );
    return result.rows[0]!;
  }

  async listShareLinks(venueId: string, keyholderId?: string) {
    if (keyholderId) {
      const result = await this.db.query(
        `SELECT sl.*, e.name as event_name, pt.name as tier_name, pt.price, pt.currency
         FROM share_links sl
         JOIN events e ON e.id = sl.event_id
         JOIN pass_tiers pt ON pt.id = sl.pass_tier_id
         WHERE sl.venue_id = $1 AND sl.keyholder_id = $2
         ORDER BY sl.created_at DESC`,
        [venueId, keyholderId],
      );
      return result.rows;
    }
    const result = await this.db.query(
      `SELECT sl.*, e.name as event_name, pt.name as tier_name, pt.price, pt.currency,
              u.first_name as kh_first_name, u.last_name as kh_last_name
       FROM share_links sl
       JOIN events e ON e.id = sl.event_id
       JOIN pass_tiers pt ON pt.id = sl.pass_tier_id
       JOIN keyholders k ON k.id = sl.keyholder_id
       JOIN users u ON u.id = k.user_id
       WHERE sl.venue_id = $1
       ORDER BY sl.created_at DESC`,
      [venueId],
    );
    return result.rows;
  }

  async resolveToken(token: string) {
    const result = await this.db.query(
      `SELECT sl.*,
              e.name as event_name, e.description as event_description,
              e.event_date, e.doors_open_at, e.status as event_status,
              e.total_pax, e.reserved_spots,
              pt.name as tier_name, pt.description as tier_description,
              pt.price, pt.currency, pt.max_quantity, pt.quantity_sold
       FROM share_links sl
       JOIN events e ON e.id = sl.event_id
       JOIN pass_tiers pt ON pt.id = sl.pass_tier_id
       WHERE sl.token = $1`,
      [token],
    );
    return result.rows[0] ?? null;
  }
}
