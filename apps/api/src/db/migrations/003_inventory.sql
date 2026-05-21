-- Migration 003 — Event Inventory
-- Per-event stock tracking with sub-location support

CREATE TABLE event_inventory (
  id            UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id      UUID    NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
  event_id      UUID    NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  product_id    UUID    NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  -- 'main' = main warehouse; 'bar1', 'bar2', etc = sub-inventories
  sub_location  TEXT    NOT NULL DEFAULT 'main',
  quantity      INTEGER NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  -- alert thresholds; NULL = not configured
  alert_yellow  INTEGER CHECK (alert_yellow IS NULL OR alert_yellow >= 0),
  alert_orange  INTEGER CHECK (alert_orange IS NULL OR alert_orange >= 0),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (event_id, product_id, sub_location)
);

CREATE INDEX idx_event_inventory_event_id   ON event_inventory(event_id);
CREATE INDEX idx_event_inventory_product_id ON event_inventory(product_id);

CREATE TRIGGER trg_event_inventory_updated_at
  BEFORE UPDATE ON event_inventory
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
