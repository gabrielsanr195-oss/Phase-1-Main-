import type { Pool } from 'pg';
import type { CreateOrderBody } from './orders.schema';

type OrderType = 'pass' | 'extra';
type Destination = 'warehouse' | 'bar';
type GroupKey = `${OrderType}-${Destination}`;

export class OrdersService {
  constructor(private readonly db: Pool) {}

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

    // Count delivered pass items for this guest
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

  async createOrder(venueId: string, waiterId: string, input: CreateOrderBody) {
    const client = await this.db.connect();
    try {
      await client.query('BEGIN');

      // Validate guest_event
      const geResult = await client.query<{
        id: string; event_id: string; pass_tier_id: string | null; status: string;
      }>(
        `SELECT id, event_id, pass_tier_id, status
         FROM guest_events WHERE id = $1 AND venue_id = $2`,
        [input.guestEventId, venueId],
      );
      if (geResult.rows.length === 0) throw new OrderError('Guest not found', 404);
      const ge = geResult.rows[0]!;
      if (ge.status !== 'checked_in') throw new OrderError('Guest has not checked in', 422);
      if (ge.event_id !== input.eventId) throw new OrderError('Event mismatch', 422);

      // Fetch products
      const productIds = input.items.map((i) => i.productId);
      const productsResult = await client.query<{ id: string; type: string; name: string }>(
        `SELECT id, type, name FROM products WHERE id = ANY($1) AND venue_id = $2 AND is_active = true`,
        [productIds, venueId],
      );
      const productsMap = new Map(productsResult.rows.map((p) => [p.id, p]));

      // Validate all items exist and block shots
      for (const item of input.items) {
        const p = productsMap.get(item.productId);
        if (!p) throw new OrderError(`Product ${item.productId} not found`, 404);
        if (p.type === 'shot') throw new OrderError('Shots must be ordered directly at the bar', 422);
      }

      // Build pass allocation map (remaining pass items for this guest)
      const passAlloc = new Map<string, number>(); // productId → remaining
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

      // Split items into (type, destination) groups
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

      // Create one order per group
      const createdOrders: Array<{ id: string; type: string; destination: string; itemCount: number }> = [];
      for (const [key, items] of groups) {
        const [type, destination] = key.split('-') as [OrderType, Destination];
        const orderResult = await client.query<{ id: string }>(
          `INSERT INTO orders (venue_id, event_id, guest_event_id, waiter_id, type, destination, table_ref, notes)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
          [venueId, ge.event_id, ge.id, waiterId, type, destination, input.tableRef ?? null, input.notes ?? null],
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

  async listOrders(venueId: string, eventId: string, guestEventId?: string) {
    const params: string[] = [venueId, eventId];
    const guestFilter = guestEventId ? 'AND o.guest_event_id = $3' : '';
    if (guestEventId) params.push(guestEventId);

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
       JOIN guest_events ge ON ge.id = o.guest_event_id
       JOIN guests g ON g.id = ge.guest_id
       JOIN order_items oi ON oi.order_id = o.id
       JOIN products p ON p.id = oi.product_id
       WHERE o.venue_id = $1 AND o.event_id = $2 ${guestFilter}
       GROUP BY o.id, u.first_name, u.last_name, g.first_name, g.last_name
       ORDER BY o.created_at DESC`,
      params,
    );
    return result.rows;
  }

  async advanceStatus(venueId: string, orderId: string, newStatus: number) {
    const current = await this.db.query<{ status: number }>(
      `SELECT status FROM orders WHERE id = $1 AND venue_id = $2`,
      [orderId, venueId],
    );
    if (current.rows.length === 0) throw new OrderError('Order not found', 404);
    const cur = current.rows[0]!.status;
    if (newStatus !== cur + 1) throw new OrderError('Status must advance by exactly one step', 422);

    const tsFields: Record<number, string> = {
      3: ', dispatched_at = NOW()',
      4: ', received_at = NOW()',
      5: ', delivered_at = NOW()',
    };
    const extra = tsFields[newStatus] ?? '';

    const result = await this.db.query(
      `UPDATE orders SET status = $1 ${extra} WHERE id = $2 AND venue_id = $3 RETURNING *`,
      [newStatus, orderId, venueId],
    );
    return result.rows[0]!;
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
