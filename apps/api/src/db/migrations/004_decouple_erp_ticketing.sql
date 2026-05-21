-- Migration 004 — Decouple ERP from Ticketing
--
-- The ERP (products, orders, inventory) and Ticketing (events, guests, check-in)
-- are independent systems. An order can exist without a ticketing guest.
-- guest_event_id is now an optional bridge: when present, the ERP will apply
-- pass balance credit. When absent, it is a plain table order.
--
-- RULE: Inventory can never block guest entry/exit. The door module
--       must never import or query ERP tables.

ALTER TABLE orders ALTER COLUMN guest_event_id DROP NOT NULL;

-- Rename 'extra' check: when guest_event_id IS NULL, type must be 'extra'.
-- Enforced at the application layer in orders.service.ts.
