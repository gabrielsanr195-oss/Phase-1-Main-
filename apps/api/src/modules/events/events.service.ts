import type { Pool } from 'pg';
import type { CreateEventBody, CreatePassTierBody } from './events.schema';

export class EventsService {
  constructor(private readonly db: Pool) {}

  async createEvent(venueId: string, userId: string, input: CreateEventBody) {
    const result = await this.db.query(
      `INSERT INTO events (
        venue_id, name, description, event_date, doors_open_at, ends_at,
        total_pax, ratio_target_women, invitation_expires_hours, created_by
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
      RETURNING *`,
      [
        venueId,
        input.name,
        input.description ?? null,
        input.eventDate,
        input.doorsOpenAt ?? null,
        input.endsAt ?? null,
        input.totalPax,
        input.ratioTargetWomen ?? 0.50,
        input.invitationExpiresHours ?? 96,
        userId,
      ],
    );
    return result.rows[0]!;
  }

  async listEvents(venueId: string) {
    const result = await this.db.query(
      `SELECT * FROM events WHERE venue_id = $1 ORDER BY event_date DESC`,
      [venueId],
    );
    return result.rows;
  }

  async getEvent(venueId: string, eventId: string) {
    const result = await this.db.query(
      `SELECT * FROM events WHERE id = $1 AND venue_id = $2`,
      [eventId, venueId],
    );
    return result.rows[0] ?? null;
  }

  async createPassTier(venueId: string, eventId: string, input: CreatePassTierBody) {
    const result = await this.db.query(
      `INSERT INTO pass_tiers (venue_id, event_id, name, description, price, currency, max_quantity)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [
        venueId,
        eventId,
        input.name,
        input.description ?? null,
        input.price,
        input.currency,
        input.maxQuantity ?? null,
      ],
    );
    return result.rows[0]!;
  }

  async listPassTiers(venueId: string, eventId: string) {
    const result = await this.db.query(
      `SELECT * FROM pass_tiers WHERE event_id = $1 AND venue_id = $2 AND is_active = true ORDER BY created_at ASC`,
      [eventId, venueId],
    );
    return result.rows;
  }
}
