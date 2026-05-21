-- Migration 001 — Core Schema
-- Implements the full multi-tenant base: venues, users, guests, events, passes, keyholders, links

-- ── Extensions ─────────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── Venues — top-level multi-tenant entity ─────────────────────────────────────
CREATE TABLE venues (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT        NOT NULL,
  slug       TEXT        NOT NULL UNIQUE,
  country    TEXT        NOT NULL DEFAULT 'GT',
  timezone   TEXT        NOT NULL DEFAULT 'America/Guatemala',
  is_active  BOOLEAN     NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Users — staff, admin, keyholders (NOT guests) ─────────────────────────────
CREATE TABLE users (
  id            UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id      UUID    NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
  email         TEXT    NOT NULL,
  phone         TEXT,
  password_hash TEXT    NOT NULL,
  first_name    TEXT    NOT NULL,
  last_name     TEXT    NOT NULL,
  role          TEXT    NOT NULL CHECK (role IN ('admin','keyholder','door','waiter','warehouse','bartender')),
  is_active     BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (venue_id, email)
);

-- ── Guests — people who attend events ─────────────────────────────────────────
CREATE TABLE guests (
  id              UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id        UUID    NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
  first_name      TEXT    NOT NULL,
  last_name       TEXT    NOT NULL,
  phone           TEXT    NOT NULL,
  gender          TEXT    NOT NULL CHECK (gender IN ('male','female','other')),
  date_of_birth   DATE,
  photo_url       TEXT,
  whatsapp_opt_in BOOLEAN NOT NULL DEFAULT false,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (venue_id, phone)
);

-- ── Events — the central axis; every record belongs to one ────────────────────
CREATE TABLE events (
  id                    UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id              UUID         NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
  name                  TEXT         NOT NULL,
  description           TEXT,
  event_date            TIMESTAMPTZ  NOT NULL,
  doors_open_at         TIMESTAMPTZ,
  ends_at               TIMESTAMPTZ,
  status                TEXT         NOT NULL DEFAULT 'phase_0'
                          CHECK (status IN ('phase_0','phase_1','phase_2','phase_3','phase_4','closed')),
  total_pax             INTEGER      NOT NULL CHECK (total_pax > 0),
  reserved_spots        INTEGER      NOT NULL DEFAULT 0 CHECK (reserved_spots >= 0),
  -- ratio_target_women: 0.00–1.00, e.g. 0.60 = 60% women
  ratio_target_women    DECIMAL(3,2) NOT NULL DEFAULT 0.50
                          CHECK (ratio_target_women BETWEEN 0 AND 1),
  -- how long an unaccepted invitation lives (hours)
  invitation_expires_hours INTEGER   NOT NULL DEFAULT 96,
  created_by            UUID         NOT NULL REFERENCES users(id),
  -- phase 4 gate: inventory audit must be completed before door opens
  inventory_audit_done  BOOLEAN      NOT NULL DEFAULT false,
  created_at            TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ── Pass Tiers — consumption bundle config, per event ─────────────────────────
CREATE TABLE pass_tiers (
  id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id      UUID         NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
  event_id      UUID         NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  name          TEXT         NOT NULL,
  description   TEXT,
  price         DECIMAL(10,2) NOT NULL DEFAULT 0 CHECK (price >= 0),
  currency      TEXT          NOT NULL DEFAULT 'GTQ',
  max_quantity  INTEGER,      -- NULL = unlimited
  quantity_sold INTEGER       NOT NULL DEFAULT 0,
  is_active     BOOLEAN       NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- ── Keyholders — venue-level profile ─────────────────────────────────────────
CREATE TABLE keyholders (
  id           UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id     UUID    NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
  user_id      UUID    NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  display_name TEXT,
  is_active    BOOLEAN NOT NULL DEFAULT true,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (venue_id, user_id)
);

-- ── Keyholder Events — per-event config (threshold is admin-only) ──────────────
CREATE TABLE keyholder_events (
  id            UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id      UUID    NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
  keyholder_id  UUID    NOT NULL REFERENCES keyholders(id) ON DELETE CASCADE,
  event_id      UUID    NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  -- max invites for this keyholder at this event — never shown to the keyholder
  threshold     INTEGER NOT NULL DEFAULT 0 CHECK (threshold >= 0),
  invites_used  INTEGER NOT NULL DEFAULT 0,
  is_active     BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (keyholder_id, event_id)
);

-- ── Share Links — generated by keyholders ─────────────────────────────────────
CREATE TABLE share_links (
  id            UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id      UUID    NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
  keyholder_id  UUID    NOT NULL REFERENCES keyholders(id) ON DELETE CASCADE,
  event_id      UUID    NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  pass_tier_id  UUID    NOT NULL REFERENCES pass_tiers(id),
  link_type     TEXT    NOT NULL CHECK (link_type IN ('open','ratio_gated','threshold_gated')),
  token         TEXT    NOT NULL UNIQUE,
  uses_count    INTEGER NOT NULL DEFAULT 0,
  max_uses      INTEGER,       -- NULL = unlimited
  expires_at    TIMESTAMPTZ,
  is_active     BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Guest Events — guest registration record per event ────────────────────────
CREATE TABLE guest_events (
  id                    UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id              UUID    NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
  guest_id              UUID    NOT NULL REFERENCES guests(id) ON DELETE CASCADE,
  event_id              UUID    NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  keyholder_id          UUID    REFERENCES keyholders(id),
  share_link_id         UUID    REFERENCES share_links(id),
  pass_tier_id          UUID    REFERENCES pass_tiers(id),
  status                TEXT    NOT NULL DEFAULT 'en_lista'
                          CHECK (status IN ('en_lista','confirmed','rejected','paid','checked_in','checked_out')),
  -- RS256 JWT issued after payment; scanned at door
  qr_token              TEXT,
  invited_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  invitation_expires_at TIMESTAMPTZ,
  confirmed_at          TIMESTAMPTZ,
  paid_at               TIMESTAMPTZ,
  checked_in_at         TIMESTAMPTZ,
  checked_out_at        TIMESTAMPTZ,
  admin_note            TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (guest_id, event_id)
);

-- ── Refresh Tokens — auth (hashed; plaintext only in HTTP response) ───────────
CREATE TABLE refresh_tokens (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id   UUID        NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
  user_id    UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT        NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Indexes ───────────────────────────────────────────────────────────────────
CREATE INDEX idx_users_venue_id              ON users(venue_id);
CREATE INDEX idx_guests_venue_id             ON guests(venue_id);
CREATE INDEX idx_events_venue_id             ON events(venue_id);
CREATE INDEX idx_events_status               ON events(venue_id, status);
CREATE INDEX idx_pass_tiers_event_id         ON pass_tiers(event_id);
CREATE INDEX idx_keyholders_venue_id         ON keyholders(venue_id);
CREATE INDEX idx_keyholder_events_event_id   ON keyholder_events(event_id);
CREATE INDEX idx_share_links_token           ON share_links(token);
CREATE INDEX idx_share_links_event_id        ON share_links(event_id);
CREATE INDEX idx_guest_events_event_id       ON guest_events(event_id);
CREATE INDEX idx_guest_events_guest_id       ON guest_events(guest_id);
CREATE INDEX idx_guest_events_status         ON guest_events(event_id, status);
CREATE INDEX idx_refresh_tokens_user_id      ON refresh_tokens(user_id);
CREATE INDEX idx_refresh_tokens_hash         ON refresh_tokens(token_hash);

-- ── updated_at auto-update trigger ───────────────────────────────────────────
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_venues_updated_at      BEFORE UPDATE ON venues      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_users_updated_at       BEFORE UPDATE ON users       FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_guests_updated_at      BEFORE UPDATE ON guests      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_events_updated_at      BEFORE UPDATE ON events      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_pass_tiers_updated_at  BEFORE UPDATE ON pass_tiers  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_guest_events_updated_at BEFORE UPDATE ON guest_events FOR EACH ROW EXECUTE FUNCTION set_updated_at();
