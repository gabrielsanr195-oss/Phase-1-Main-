import type { Pool } from 'pg';
import type { CreateProductBody, AddPassTierItemBody } from './products.schema';

export class ProductsService {
  constructor(private readonly db: Pool) {}

  async createProduct(venueId: string, input: CreateProductBody) {
    const result = await this.db.query(
      `INSERT INTO products (venue_id, name, description, type, sku)
       VALUES ($1,$2,$3,$4,$5)
       RETURNING *`,
      [venueId, input.name, input.description ?? null, input.type, input.sku ?? null],
    );
    return result.rows[0]!;
  }

  async listProducts(venueId: string) {
    const result = await this.db.query(
      `SELECT * FROM products WHERE venue_id = $1 AND is_active = true ORDER BY type, name`,
      [venueId],
    );
    return result.rows;
  }

  async addPassTierItem(venueId: string, passTierId: string, input: AddPassTierItemBody) {
    // Verify pass tier belongs to venue
    const tierCheck = await this.db.query(
      `SELECT id FROM pass_tiers WHERE id = $1 AND venue_id = $2`,
      [passTierId, venueId],
    );
    if (tierCheck.rows.length === 0) throw new ProductError('Pass tier not found', 404);

    const result = await this.db.query(
      `INSERT INTO pass_tier_items (venue_id, pass_tier_id, product_id, quantity)
       VALUES ($1,$2,$3,$4)
       ON CONFLICT (pass_tier_id, product_id) DO UPDATE SET quantity = EXCLUDED.quantity
       RETURNING *`,
      [venueId, passTierId, input.productId, input.quantity],
    );
    return result.rows[0]!;
  }

  async listPassTierItems(venueId: string, passTierId: string) {
    const result = await this.db.query(
      `SELECT pti.*, p.name AS product_name, p.type AS product_type, p.sku
       FROM pass_tier_items pti
       JOIN products p ON p.id = pti.product_id
       WHERE pti.pass_tier_id = $1 AND pti.venue_id = $2
       ORDER BY p.type, p.name`,
      [passTierId, venueId],
    );
    return result.rows;
  }

  async removePassTierItem(venueId: string, passTierId: string, productId: string) {
    await this.db.query(
      `DELETE FROM pass_tier_items WHERE pass_tier_id = $1 AND product_id = $2 AND venue_id = $3`,
      [passTierId, productId, venueId],
    );
  }

  async listInventory(venueId: string, eventId: string) {
    const result = await this.db.query(
      `SELECT ei.*, p.name AS product_name, p.type AS product_type, p.sku
       FROM event_inventory ei
       JOIN products p ON p.id = ei.product_id
       WHERE ei.event_id = $1 AND ei.venue_id = $2
       ORDER BY ei.sub_location, p.type, p.name`,
      [eventId, venueId],
    );
    return result.rows;
  }

  async upsertInventory(
    venueId: string,
    eventId: string,
    productId: string,
    input: { quantity: number; subLocation?: string; alertYellow?: number; alertOrange?: number },
  ) {
    const result = await this.db.query(
      `INSERT INTO event_inventory (venue_id, event_id, product_id, sub_location, quantity, alert_yellow, alert_orange)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       ON CONFLICT (event_id, product_id, sub_location) DO UPDATE SET
         quantity = EXCLUDED.quantity,
         alert_yellow = COALESCE(EXCLUDED.alert_yellow, event_inventory.alert_yellow),
         alert_orange = COALESCE(EXCLUDED.alert_orange, event_inventory.alert_orange)
       RETURNING *`,
      [
        venueId, eventId, productId,
        input.subLocation ?? 'main',
        input.quantity,
        input.alertYellow ?? null,
        input.alertOrange ?? null,
      ],
    );
    return result.rows[0]!;
  }
}

export class ProductError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
  ) {
    super(message);
    this.name = 'ProductError';
  }
}
