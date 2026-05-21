// ERP Module — Orders Service
//
// ARCHITECTURAL BOUNDARY:
//   This service belongs to the ERP system (products / orders / inventory).
//   It must NOT import from Ticketing services (events, guests, share-links, door).
//   The only allowed cross-system access is reading guest_events + pass_tier_items
//   via SQL when a guest QR is optionally provided by the caller.
//
//   Inventory can never block guest entry/exit — that is enforced in door.service.ts
//   which has zero dependency on ERP tables.

import type { Pool } from 'pg';
import type { CreateOrderBody } from './orders.schema';

type OrderType = 'pass' | 'extra';
type Destination = 'warehouse' | 'bar';
type GroupKey = `${OrderType}-${Destination}`;

export class OrdersService {
  constructor(private readonly db: Pool) {}

  // ── Ticketing bridge — only called when waiter scans a guest QR ─────────────
  async lookupGuest(venueId: string, guestEventId: string) {
    const result = await this.db.query(
      `SELECT ge.id, ge.event_id, ge.pass_tier_id, ge.status,
              g.first_name, g.last_name, g.phone,
              pt.name AS tier_name
       FROM guest_events ge
       JOIN guests g ON g.id = ge.guest_id
       LEFT JOIN pass_tiers pt ON pt.id = ge.pass_tier_id
       WHERE ge.id = $1 AND ge.venue_id = $2`,
      [guestEventId, venueId],
    );
    if (result.rows.length === 0) throw new OrderError('Guest not found', 404);

    const ge = result.rows[0]!;
    const passBalance = await this.getPassBalance(venueId, guestEventId, ge.pass_tier_id as string | null);

    return {
      guestEventId: ge.id as string,
      eventId: ge.event_id as string,
      status: ge.status as string,
      firstName: ge.first_name as string,
      lastName: ge.last_name as string,
      phone: ge.phone as string,
      tierName: ge.tier_name as string | null,
      passBalance,
    };
  }

  async getPassBalance(venueId: string, guestEventId: string, passTierId: string | null) {
    if (!passTierId) return [];

    const tierItems = await this.db.query<{
      product_id: string; quantity: number; product_name: string; product_type: string;
    }>(
      `SELECT pti.product_id, pti.quantity, p.name AS product_name, p.type AS product_type
       FROM pass_tier_items pti
       JOIN products p ON p.id = pti.product_id
       WHERE pti.pass_tier_id = $1 AND pti.venue_id = $2`,
      [passTierId, venueId],
    );
    if (tierItems.rows.length === 0) return [];

    const consumed = await this.db.query<{ product_id: string; consumed: string }>(
      `SELECT oi.product_id, SUM(oi.quantity) AS consumed
       FROM order_items oi
       JOIN orders o ON o.id = oi.order_id
       WHERE o.guest_event_id = $1 AND o.venue_id = $2 AND o.type = 'pass' AND o.status = 5
       GROUP BY oi.product_id`,
      [guestEventId, venueId],
    );
    const consumedMap = new Map(consumed.rows.map((r) => [r.product_id as string, parseInt(r.consumed, 10)]));

    return tierItems.rows.map((item) => ({
      productId: item.product_id,
      productName: item.product_name,
      productType: item.product_type,
      allocated: item.quantity,
      consumed: consumedMap.get(item.product_id) ?? 0,
      remaining: Math.max(0, item.quantity - (consumedMap.get(item.product_id) ?? 0)),
    }));
  }

  // ── Create order — works with or without a guest QR ─────────────────────────
  async createOrder(venueId: string, waiterId: string, input: CreateOrderBody) {
    const client = await this.db.connect();
    try {
      await client.query('BEGIN');

      // Fetch products (ERP-only concern)
      const productIds = input.items.map((i) => i.productId);
      const productsResult = await client.query<{ id: string; type: string; name: string }>(
        `SELECT id, type, name FROM products WHERE id = ANY($1) AND venue_id = $2 AND is_active = true`,
        [productIds, venueId],
      );
      const productsMap = new Map(productsResult.rows.map((p) => [p.id, p]));

      for (const item of input.items) {
        const p = productsMap.get(item.productId);
        if (!p) throw new OrderError(`Product ${item.productId} not found`, 404);
        if (p.type === 'shot') throw new OrderError('Shots must be ordered directly at the bar', 422);
      }

      // ── PATH A: Plain table order — no guest, all items are 'extra' ──────────
      if (!input.guestEventId) {
        const groups = new Map<`extra-${Destination}`, Array<{ productId: string; quantity: number }>>();
        for (const reqItem of input.items) {
          const product = productsMap.get(reqItem.productId)!;
          const destination: Destination = product.type === 'bottle' ? 'warehouse' : 'bar';
          const key = `extra-${destination}` as const;
          const arr = groups.get(key) ?? [];
          arr.push({ productId: reqItem.productId, quantity: reqItem.quantity });
          groups.set(key, arr);
        }

        const createdOrders: Array<{ id: string; type: string; destination: string; itemCount: number }> = [];
        for (const [key, items] of groups) {
          const [, destination] = key.split('-') as ['extra', Destination];
          const orderResult = await client.query<{ id: string }>(
            `INSERT INTO orders (venue_id, event_id, guest_event_id, waiter_id, type, destination, table_ref, notes)
             VALUES ($1,$2,NULL,$3,'extra',$4,$5,$6) RETURNING id`,
            [venueId, input.eventId, waiterId, destination, input.tableRef, input.notes ?? null],
          );
          const orderId = orderResult.rows[0]!.id;
          for (const item of items) {
            await client.query(
              `INSERT INTO order_items (venue_id, order_id, product_id, quantity, unit_price)
               VALUES ($1,$2,$3,$4,0)`,
              [venueId, orderId, item.productId, item.quantity],
            );
          }
          createdOrders.push({ id: orderId, type: 'extra', destination, itemCount: items.length });
        }

        await client.query('COMMIT');
        return createdOrders;
      }

      // ── PATH B: Guest order — apply pass balance when available ─────────────
      const geResult = await client.query<{
        id: string; event_id: string; pass_tier_id: string | null;
      }>(
        `SELECT id, event_id, pass_tier_id FROM guest_events WHERE id = $1 AND venue_id = $2`,
        [input.guestEventId, venueId],
      );
      if (geResult.rows.length === 0) throw new OrderError('Guest not found', 404);
      const ge = geResult.rows[0]!;
      if (ge.event_id !== input.eventId) throw new OrderError('Guest does not belong to this event', 422);

      const passAlloc = new Map<string, number>();
      if (ge.pass_tier_id) {
        const tierItems = await client.query<{ product_id: string; quantity: number }>(
          `SELECT product_id, quantity FROM pass_tier_items WHERE pass_tier_id = $1 AND venue_id = $2`,
          [ge.pass_tier_id, venueId],
        );
        for (const r of tierItems.rows) passAlloc.set(r.product_id, r.quantity);

        const consumed = await client.query<{ product_id: string; consumed: string }>(
          `SELECT oi.product_id, SUM(oi.quantity) AS consumed
           FROM order_items oi
           JOIN orders o ON o.id = oi.order_id
           WHERE o.guest_event_id = $1 AND o.venue_id = $2 AND o.type = 'pass' AND o.status = 5
           GROUP BY oi.product_id`,
          [ge.id, venueId],
        );
        for (const r of consumed.rows) {
          const prev = passAlloc.get(r.product_id) ?? 0;
          passAlloc.set(r.product_id, Math.max(0, prev - parseInt(r.consumed, 10)));
        }
      }

      const groups = new Map<GroupKey, Array<{ productId: string; quantity: number }>>();
      for (const reqItem of input.items) {
        const product = productsMap.get(reqItem.productId)!;
        const destination: Destination = product.type === 'bottle' ? 'warehouse' : 'bar';
        let remaining = reqItem.quantity;

        const passRemaining = passAlloc.get(reqItem.productId) ?? 0;
        if (passRemaining > 0) {
          const passQty = Math.min(remaining, passRemaining);
          passAlloc.set(reqItem.productId, passRemaining - passQty);
          remaining -= passQty;
          const key: GroupKey = `pass-${destination}`;
          const arr = groups.get(key) ?? [];
          arr.push({ productId: reqItem.productId, quantity: passQty });
          groups.set(key, arr);
        }

        if (remaining > 0) {
          const key: GroupKey = `extra-${destination}`;
          const arr = groups.get(key) ?? [];
          arr.push({ productId: reqItem.productId, quantity: remaining });
          groups.set(key, arr);
        }
      }

      if (groups.size === 0) throw new OrderError('No items to order', 422);

      const createdOrders: Array<{ id: string; type: string; destination: string; itemCount: number }> = [];
      for (const [key, items] of groups) {
        const [type, destination] = key.split('-') as [OrderType, Destination];
        const orderResult = await client.query<{ id: string }>(
          `INSERT INTO orders (venue_id, event_id, guest_event_id, waiter_id, type, destination, table_ref, notes)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
          [venueId, ge.event_id, ge.id, waiterId, type, destination, input.tableRef, input.notes ?? null],
        );
        const orderId = orderResult.rows[0]!.id;
        for (const item of items) {
          await client.query(
            `INSERT INTO order_items (venue_id, order_id, product_id, quantity, unit_price)
             VALUES ($1,$2,$3,$4,0)`,
            [venueId, orderId, item.productId, item.quantity],
          );
        }
        createdOrders.push({ id: orderId, type, destination, itemCount: items.length });
      }

      await client.query('COMMIT');
      return createdOrders;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async listOrders(
    venueId: string,
    eventId: string,
    opts: { guestEventId?: string; destination?: string; statuses?: number[] } = {},
  ) {
    const params: Array<string | number | number[]> = [venueId, eventId];
    const filters: string[] = [];

    if (opts.guestEventId) {
      params.push(opts.guestEventId);
      filters.push(`AND o.guest_event_id = $${params.length}`);
    }
    if (opts.destination) {
      params.push(opts.destination);
      filters.push(`AND o.destination = $${params.length}`);
    }
    if (opts.statuses && opts.statuses.length > 0) {
      params.push(opts.statuses as unknown as string);
      filters.push(`AND o.status = ANY($${params.length})`);
    }

    const result = await this.db.query(
      `SELECT o.*,
              u.first_name AS waiter_first, u.last_name AS waiter_last,
              g.first_name AS guest_first, g.last_name AS guest_last,
              json_agg(
                json_build_object(
                  'id', oi.id,
                  'productId', oi.product_id,
                  'productName', p.name,
                  'productType', p.type,
                  'quantity', oi.quantity,
                  'unitPrice', oi.unit_price
                ) ORDER BY oi.created_at
              ) AS items
       FROM orders o
       JOIN users u ON u.id = o.waiter_id
       LEFT JOIN guest_events ge ON ge.id = o.guest_event_id
       LEFT JOIN guests g ON g.id = ge.guest_id
       JOIN order_items oi ON oi.order_id = o.id
       JOIN products p ON p.id = oi.product_id
       WHERE o.venue_id = $1 AND o.event_id = $2 ${filters.join(' ')}
       GROUP BY o.id, u.first_name, u.last_name, g.first_name, g.last_name
       ORDER BY o.created_at DESC`,
      params,
    );
    return result.rows;
  }

  async advanceStatus(venueId: string, orderId: string, newStatus: number) {
    const client = await this.db.connect();
    try {
      await client.query('BEGIN');

      const current = await client.query<{ status: number; event_id: string }>(
        `SELECT status, event_id FROM orders WHERE id = $1 AND venue_id = $2`,
        [orderId, venueId],
      );
      if (current.rows.length === 0) throw new OrderError('Order not found', 404);
      const { status: cur, event_id: eventId } = current.rows[0]!;
      if (newStatus !== cur + 1) throw new OrderError('Status must advance by exactly one step', 422);

      // State 3 = dispatch: decrement inventory (ERP-only, never affects guest entry)
      if (newStatus === 3) {
        const items = await client.query<{ product_id: string; quantity: number }>(
          `SELECT product_id, quantity FROM order_items WHERE order_id = $1 AND venue_id = $2`,
          [orderId, venueId],
        );
        for (const item of items.rows) {
          const inv = await client.query<{ quantity: number }>(
            `UPDATE event_inventory
             SET quantity = quantity - $1
             WHERE event_id = $2 AND product_id = $3 AND venue_id = $4 AND quantity >= $1
             RETURNING quantity`,
            [item.quantity, eventId, item.product_id, venueId],
          );
          if (inv.rows.length === 0) {
            const exists = await client.query(
              `SELECT 1 FROM event_inventory WHERE event_id = $1 AND product_id = $2 AND venue_id = $3`,
              [eventId, item.product_id, venueId],
            );
            if (exists.rows.length > 0) {
              throw new OrderError('Insufficient inventory to dispatch', 422);
            }
          }
        }
      }

      const tsFields: Record<number, string> = {
        3: ', dispatched_at = NOW()',
        4: ', received_at = NOW()',
        5: ', delivered_at = NOW()',
      };
      const extra = tsFields[newStatus] ?? '';

      const result = await client.query(
        `UPDATE orders SET status = $1 ${extra} WHERE id = $2 AND venue_id = $3 RETURNING *`,
        [newStatus, orderId, venueId],
      );

      await client.query('COMMIT');
      return result.rows[0]!;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async notifyPassBalance(venueId: string, orderId: string) {
    const orderRow = await this.db.query<{ guest_event_id: string | null }>(
      `SELECT guest_event_id FROM orders WHERE id = $1 AND venue_id = $2`,
      [orderId, venueId],
    );
    if (orderRow.rows.length === 0) return;
    const geId = orderRow.rows[0]!.guest_event_id;
    if (!geId) return; // plain table order — no pass to notify

    const geRow = await this.db.query<{ phone: string; pass_tier_id: string | null; first_name: string }>(
      `SELECT g.phone, ge.pass_tier_id, g.first_name
       FROM guest_events ge JOIN guests g ON g.id = ge.guest_id
       WHERE ge.id = $1 AND ge.venue_id = $2`,
      [geId, venueId],
    );
    if (geRow.rows.length === 0) return;
    const { phone, pass_tier_id, first_name } = geRow.rows[0]!;

    const balance = await this.getPassBalance(venueId, geId, pass_tier_id);
    if (balance.length === 0) return;

    const remaining = balance.filter((b) => b.remaining > 0);
    const message = remaining.length === 0
      ? `${first_name}, tu pass ha sido consumido completamente. ¡Que lo hayas disfrutado!`
      : `${first_name}, items entregados. Saldo restante: ${remaining.map((b) => `${b.remaining} ${b.productName}`).join(' · ')}`;

    const token = process.env['WHATSAPP_TOKEN'];
    const phoneId = process.env['WHATSAPP_PHONE_ID'];
    if (token && phoneId) {
      await fetch(`https://graph.facebook.com/v18.0/${phoneId}/messages`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: phone,
          type: 'text',
          text: { body: message },
        }),
      });
    } else {
      console.log(`[WhatsApp stub] → ${phone}: ${message}`);
    }
  }
}

export class OrderError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
  ) {
    super(message);
    this.name = 'OrderError';
  }
}
