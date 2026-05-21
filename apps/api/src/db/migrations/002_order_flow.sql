-- Migration 002 — Order Flow
-- Products catalog, pass-tier bundles, orders (comandas), order items

-- ── Products — venue-level catalog ───────────────────────────────────────────
-- type: bottle = full bottle tracked by unit (Type 1)
--       drink  = beer/mixer tracked by quantity (Type 2)
--       shot   = shot/cocktail deducted by recipe (Type 3); blocked in waiter flow
CREATE TABLE products (
  id          UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id    UUID    NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
  name        TEXT    NOT NULL,
  description TEXT,
  type        TEXT    NOT NULL CHECK (type IN ('bottle','drink','shot')),
  sku         TEXT,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Pass Tier Items — consumption bundle per tier ─────────────────────────────
-- e.g. Tier Básico: 6 drinks + 1 bottle + 2 mixers
CREATE TABLE pass_tier_items (
  id           UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id     UUID    NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
  pass_tier_id UUID    NOT NULL REFERENCES pass_tiers(id) ON DELETE CASCADE,
  product_id   UUID    NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  quantity     INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (pass_tier_id, product_id)
);

-- ── Orders (Comandas) — one per (pass|extra, warehouse|bar) combination ───────
-- status: 1=placed  2=preparing  3=dispatched(inv decremented)
--         4=received_by_waiter   5=delivered_to_guest
CREATE TABLE orders (
  id             UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id       UUID    NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
  event_id       UUID    NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  guest_event_id UUID    NOT NULL REFERENCES guest_events(id) ON DELETE CASCADE,
  waiter_id      UUID    NOT NULL REFERENCES users(id),
  -- 'pass' = covered by the guest pass tier; 'extra' = billed separately
  type           TEXT    NOT NULL CHECK (type IN ('pass','extra')),
  -- destination: warehouse handles bottles, bar handles drinks/shots
  destination    TEXT    NOT NULL CHECK (destination IN ('warehouse','bar')),
  status         INTEGER NOT NULL DEFAULT 1 CHECK (status BETWEEN 1 AND 5),
  table_ref      TEXT,
  notes          TEXT,
  dispatched_at  TIMESTAMPTZ,
  received_at    TIMESTAMPTZ,
  delivered_at   TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Order Items — line items per comanda ──────────────────────────────────────
CREATE TABLE order_items (
  id         UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id   UUID    NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
  order_id   UUID    NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id UUID    NOT NULL REFERENCES products(id),
  quantity   INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
  unit_price DECIMAL(10,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Indexes ───────────────────────────────────────────────────────────────────
CREATE INDEX idx_products_venue_id        ON products(venue_id);
CREATE INDEX idx_pass_tier_items_tier_id  ON pass_tier_items(pass_tier_id);
CREATE INDEX idx_orders_event_id          ON orders(event_id);
CREATE INDEX idx_orders_guest_event_id    ON orders(guest_event_id);
CREATE INDEX idx_orders_status            ON orders(event_id, status);
CREATE INDEX idx_order_items_order_id     ON order_items(order_id);

-- ── updated_at triggers ───────────────────────────────────────────────────────
CREATE TRIGGER trg_products_updated_at BEFORE UPDATE ON products FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_orders_updated_at   BEFORE UPDATE ON orders   FOR EACH ROW EXECUTE FUNCTION set_updated_at();
