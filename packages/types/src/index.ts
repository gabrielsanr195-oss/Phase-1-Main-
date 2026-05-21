// ── User & Auth ────────────────────────────────────────────────────────────────

export type UserRole = 'admin' | 'keyholder' | 'door' | 'waiter' | 'warehouse' | 'bartender';

export interface JWTPayload {
  sub: string;
  venue_id: string;
  role: UserRole;
  iat?: number;
  exp?: number;
}

// ── QR Codes ───────────────────────────────────────────────────────────────────

export type QRType = 'guest' | 'keyholder' | 'staff' | 'table';

export interface QRPayload {
  sub: string;
  venue_id: string;
  event_id: string;
  type: QRType;
  iat?: number;
  exp?: number;
}

// ── Events ─────────────────────────────────────────────────────────────────────

export type EventStatus =
  | 'phase_0'
  | 'phase_1'
  | 'phase_2'
  | 'phase_3'
  | 'phase_4'
  | 'closed';

// ── Guests ─────────────────────────────────────────────────────────────────────

export type GuestGender = 'male' | 'female' | 'other';

export type GuestEventStatus =
  | 'en_lista'
  | 'confirmed'
  | 'rejected'
  | 'paid'
  | 'checked_in'
  | 'checked_out';

// ── Share Links ────────────────────────────────────────────────────────────────

export type ShareLinkType = 'open' | 'ratio_gated' | 'threshold_gated';

// ── Orders ─────────────────────────────────────────────────────────────────────

export type OrderState = 1 | 2 | 3 | 4 | 5;

export type OrderType = 'pass' | 'extra';

export const ORDER_STATE_LABELS: Record<OrderState, string> = {
  1: 'ORDER_PLACED',
  2: 'IN_PREPARATION',
  3: 'DISPATCHED',
  4: 'RECEIVED_BY_WAITER',
  5: 'DELIVERED_TO_GUEST',
};

// ── Products ───────────────────────────────────────────────────────────────────

export type ProductType = 'type1' | 'type2' | 'type3';
// type1: full bottles with individual QR
// type2: beers, mixers — deducted by quantity
// type3: shots, cocktails — deducted by recipe

export type InventoryAlertLevel = 'ok' | 'yellow' | 'orange' | 'red';

// ── Pagination ─────────────────────────────────────────────────────────────────

export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: PaginationMeta;
}

// ── API Errors ─────────────────────────────────────────────────────────────────

export interface ApiError {
  error: string;
  message?: string;
  statusCode: number;
}
