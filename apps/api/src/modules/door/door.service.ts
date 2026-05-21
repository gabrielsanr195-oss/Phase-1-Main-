import type { Pool } from 'pg';
import { validateQR } from '@phase1plus/qr-lib';
import { getQRPublicKey } from '../../utils/qr-keys';

export class DoorService {
  constructor(private readonly db: Pool) {}

  async scan(venueId: string, qrToken: string) {
    let publicKeyPem: string;
    try {
      publicKeyPem = await getQRPublicKey();
    } catch {
      throw new DoorError('QR keys not configured on server', 503);
    }

    let payload: { venue_id: string; event_id: string };
    try {
      payload = await validateQR(qrToken, publicKeyPem) as typeof payload;
    } catch {
      throw new DoorError('Invalid or expired QR code', 400);
    }

    if (payload.venue_id !== venueId) {
      throw new DoorError('QR belongs to a different venue', 403);
    }

    const result = await this.db.query(
      `SELECT ge.id, ge.status, ge.checked_in_at, ge.event_id,
              g.first_name, g.last_name, g.phone, g.gender,
              pt.name as tier_name
       FROM guest_events ge
       JOIN guests g ON g.id = ge.guest_id
       LEFT JOIN pass_tiers pt ON pt.id = ge.pass_tier_id
       WHERE ge.qr_token = $1 AND ge.venue_id = $2`,
      [qrToken, venueId],
    );

    if (result.rows.length === 0) throw new DoorError('QR not found — not issued or already invalidated', 404);

    const ge = result.rows[0]!;

    if (ge.event_id !== payload.event_id) {
      throw new DoorError('QR event mismatch', 403);
    }

    if (ge.status === 'checked_in') {
      return { ...ge, checkInResult: 'already_in' as const };
    }
    if (ge.status === 'rejected') {
      throw new DoorError('Guest is on the reject list', 403);
    }
    if (!['paid', 'confirmed'].includes(ge.status as string)) {
      throw new DoorError(`Guest status is '${ge.status as string}' — not cleared for entry`, 403);
    }

    const updated = await this.db.query(
      `UPDATE guest_events SET status = 'checked_in', checked_in_at = NOW()
       WHERE id = $1 RETURNING id, status, checked_in_at`,
      [ge.id],
    );

    return {
      id: ge.id,
      status: updated.rows[0]!.status as string,
      checked_in_at: updated.rows[0]!.checked_in_at as string,
      first_name: ge.first_name as string,
      last_name: ge.last_name as string,
      phone: ge.phone as string,
      gender: ge.gender as string,
      tier_name: ge.tier_name as string | null,
      checkInResult: 'success' as const,
    };
  }
}

export class DoorError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
  ) {
    super(message);
    this.name = 'DoorError';
  }
}
