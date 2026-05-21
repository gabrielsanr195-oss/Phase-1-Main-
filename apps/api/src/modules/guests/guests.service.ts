import type { Pool } from 'pg';
import type { GuestRegistrationBody, UpdateGuestStatusBody } from './guests.schema';

export class GuestsService {
  constructor(private readonly db: Pool) {}

  async registerViaShareLink(token: string, input: GuestRegistrationBody) {
    const linkResult = await this.db.query(
      `SELECT sl.*, e.venue_id, e.total_pax, e.reserved_spots, e.invitation_expires_hours,
              e.ratio_target_women, ke.threshold, ke.invites_used
       FROM share_links sl
       JOIN events e ON e.id = sl.event_id
       LEFT JOIN keyholder_events ke
         ON ke.keyholder_id = sl.keyholder_id AND ke.event_id = sl.event_id
       WHERE sl.token = $1`,
      [token],
    );

    if (linkResult.rows.length === 0) throw new RegistrationError('Invalid or expired link', 404);

    const link = linkResult.rows[0]!;

    if (!link.is_active) throw new RegistrationError('Link is no longer active', 410);
    if (link.expires_at && new Date(link.expires_at) < new Date()) {
      throw new RegistrationError('Link has expired', 410);
    }
    if (link.max_uses !== null && link.uses_count >= link.max_uses) {
      throw new RegistrationError('Link has reached maximum uses', 410);
    }

    const venueId: string = link.venue_id;
    const eventId: string = link.event_id;
    const keyholderId: string = link.keyholder_id;
    const passTierId: string = link.pass_tier_id;

    const client = await this.db.connect();
    try {
      await client.query('BEGIN');

      // Upsert guest by (venue_id, phone) — phone is the natural key
      const guestResult = await client.query<{ id: string }>(
        `INSERT INTO guests (venue_id, first_name, last_name, phone, gender, date_of_birth, whatsapp_opt_in)
         VALUES ($1,$2,$3,$4,$5,$6,$7)
         ON CONFLICT (venue_id, phone) DO UPDATE SET
           first_name = EXCLUDED.first_name,
           last_name  = EXCLUDED.last_name,
           gender     = EXCLUDED.gender,
           date_of_birth  = COALESCE(EXCLUDED.date_of_birth, guests.date_of_birth),
           whatsapp_opt_in = EXCLUDED.whatsapp_opt_in
         RETURNING id`,
        [venueId, input.firstName, input.lastName, input.phone, input.gender, input.dateOfBirth ?? null, input.whatsappOptIn ?? false],
      );
      const guestId = guestResult.rows[0]!.id;

      // Idempotent: already registered for this event
      const existing = await client.query(
        `SELECT * FROM guest_events WHERE guest_id = $1 AND event_id = $2`,
        [guestId, eventId],
      );
      if (existing.rows.length > 0) {
        await client.query('ROLLBACK');
        return { guestEvent: existing.rows[0]!, alreadyRegistered: true };
      }

      // Capacity check
      const countResult = await client.query<{ count: string }>(
        `SELECT COUNT(*) as count FROM guest_events WHERE event_id = $1 AND status != 'rejected'`,
        [eventId],
      );
      const currentCount = parseInt(countResult.rows[0]!.count, 10);
      const available = (link.total_pax as number) - (link.reserved_spots as number);
      if (currentCount >= available) {
        throw new RegistrationError('Event is at capacity', 409);
      }

      // Threshold check for threshold_gated links
      if (link.link_type === 'threshold_gated' && link.threshold > 0) {
        if (link.invites_used >= link.threshold) {
          throw new RegistrationError('Keyholder invite limit reached', 409);
        }
      }

      // Determine status: open/threshold_gated → confirmed; ratio_gated → check ratio
      let guestStatus = 'confirmed';
      if (link.link_type === 'ratio_gated') {
        const ratioResult = await client.query<{ gender: string; count: string }>(
          `SELECT g.gender, COUNT(*) AS count
           FROM guest_events ge
           JOIN guests g ON g.id = ge.guest_id
           WHERE ge.event_id = $1 AND ge.status NOT IN ('rejected', 'en_lista')
           GROUP BY g.gender`,
          [eventId],
        );
        let totalConfirmed = 0;
        let womenCount = 0;
        for (const row of ratioResult.rows) {
          const n = parseInt(row.count, 10);
          totalConfirmed += n;
          if (row.gender === 'female') womenCount = n;
        }
        const newTotal = totalConfirmed + 1;
        const newWomen = input.gender === 'female' ? womenCount + 1 : womenCount;
        const newRatio = newWomen / newTotal;
        const target = parseFloat(link.ratio_target_women as string) || 0;
        guestStatus = newRatio >= target ? 'confirmed' : 'en_lista';
      }

      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + (Number(link.invitation_expires_hours) || 96));

      const geResult = await client.query(
        `INSERT INTO guest_events
           (venue_id, guest_id, event_id, keyholder_id, share_link_id, pass_tier_id, status, invitation_expires_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
         RETURNING *`,
        [venueId, guestId, eventId, keyholderId, link.id, passTierId, guestStatus, expiresAt],
      );

      await client.query(
        `UPDATE share_links SET uses_count = uses_count + 1 WHERE id = $1`,
        [link.id],
      );
      await client.query(
        `UPDATE keyholder_events SET invites_used = invites_used + 1
         WHERE keyholder_id = $1 AND event_id = $2`,
        [keyholderId, eventId],
      );

      await client.query('COMMIT');
      return { guestEvent: geResult.rows[0]!, alreadyRegistered: false };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async listGuestEvents(venueId: string, eventId: string, keyholderId?: string) {
    const params: string[] = [venueId, eventId];
    const filter = keyholderId ? 'AND ge.keyholder_id = $3' : '';
    if (keyholderId) params.push(keyholderId);

    const result = await this.db.query(
      `SELECT ge.*,
              g.first_name, g.last_name, g.phone, g.gender,
              pt.name as tier_name, pt.price, pt.currency
       FROM guest_events ge
       JOIN guests g ON g.id = ge.guest_id
       LEFT JOIN pass_tiers pt ON pt.id = ge.pass_tier_id
       WHERE ge.venue_id = $1 AND ge.event_id = $2 ${filter}
       ORDER BY ge.invited_at DESC`,
      params,
    );
    return result.rows;
  }

  async updateGuestEventStatus(venueId: string, guestEventId: string, input: UpdateGuestStatusBody) {
    const tsMap: Record<string, string> = {
      confirmed: 'confirmed_at',
      paid: 'paid_at',
      checked_in: 'checked_in_at',
      checked_out: 'checked_out_at',
    };
    const tsField = tsMap[input.status];

    // Issue RS256 QR token when status transitions to 'paid'
    let qrToken: string | null = null;
    if (input.status === 'paid') {
      try {
        const { getQRPrivateKey } = await import('../../utils/qr-keys');
        const { signQR } = await import('@phase1plus/qr-lib');
        const geResult = await this.db.query<{ event_id: string }>(
          `SELECT event_id FROM guest_events WHERE id = $1 AND venue_id = $2`,
          [guestEventId, venueId],
        );
        if (geResult.rows.length > 0) {
          const privateKeyPem = await getQRPrivateKey();
          qrToken = await signQR(
            { sub: guestEventId, venue_id: venueId, event_id: geResult.rows[0]!.event_id, type: 'guest' },
            privateKeyPem,
          );
        }
      } catch {
        // Keys not configured — status update proceeds, qr_token stays null
      }
    }

    const tsClause = tsField ? `, ${tsField} = NOW()` : '';
    const qrClause = qrToken ? ', qr_token = $5' : '';
    const params: (string | null)[] = [input.status, input.adminNote ?? null, guestEventId, venueId];
    if (qrToken) params.push(qrToken);

    const result = await this.db.query(
      `UPDATE guest_events
       SET status = $1, admin_note = COALESCE($2, admin_note) ${tsClause} ${qrClause}
       WHERE id = $3 AND venue_id = $4
       RETURNING *`,
      params,
    );
    return result.rows[0] ?? null;
  }
}

export class RegistrationError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
  ) {
    super(message);
    this.name = 'RegistrationError';
  }
}
