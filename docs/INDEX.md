# Phase 1+ — Session Index

> Source of truth for session state. Update at the end of every session.

## Estado actual
**Sprint**: 3 — Admin Dashboard + Door Scan
**Last session**: Sprint 3 complete — web-admin dashboard, door scan API, QR issuance, web-staff door app
**Next**: Sprint 4 — Keyholder web app (web-client keyholder view) + share link generation UI

## Completed ✅
- [x] S0-1: Monorepo (pnpm workspaces + TypeScript)
- [x] S0-2: Docker Compose (PostgreSQL 16 + Redis 7)
- [x] S0-3: CI/CD (GitHub Actions — lint, typecheck, test, build)
- [x] S0-4: Core DB schema (001_core_schema.sql — all Phase 0 tables)
- [x] S0-5: Auth system (register, login, refresh, logout)
- [x] S0-6: packages/qr-lib (RS256 sign/validate + tests)
- [x] S0-7: Multi-tenant middleware (venue_id from JWT, never from body)
- [x] S2-1: Events API — create, list, get + pass-tier management
- [x] S2-2: Keyholders API — create (user+record), list, assign to event with threshold
- [x] S2-3: Share Links API — create (keyholder), list, public resolve endpoint
- [x] S2-4: Guest registration — POST /register/:token (public, idempotent by phone)
- [x] S2-5: Guest management — list by event (admin/keyholder), update status (admin)
- [x] S2-6: web-client — RegisterPage (/r/:token) + ConfirmationPage (/r/:token/done)
- [x] S3-1: API door module — POST /door/scan (RS256 QR validate → check-in)
- [x] S3-2: QR issuance — auto-sign RS256 JWT when guest status → 'paid'
- [x] S3-3: utils/qr-keys.ts — cached key file loader
- [x] S3-4: web-admin — Login, Events list/create, EventDetail (pass tiers + guest management), Keyholders
- [x] S3-5: web-staff — Door app (login + QR scan/check-in with instant visual feedback)

## In progress 🔄
_nothing — sprint 3 done_

## Key files
| File | Purpose |
|------|---------|
| `apps/api/src/app.ts` | Fastify app factory — public + protected scopes |
| `apps/api/src/config.ts` | Env config (validated at startup) |
| `apps/api/src/plugins/tenant.ts` | Multi-tenant onRequest hook |
| `apps/api/src/plugins/auth.ts` | JWT plugin + authenticate decorator |
| `apps/api/src/modules/auth/` | Auth routes, service, schemas |
| `apps/api/src/modules/events/` | Events + pass-tiers CRUD |
| `apps/api/src/modules/keyholders/` | Keyholder create/list/assign |
| `apps/api/src/modules/share-links/` | Share link create/list + public resolve |
| `apps/api/src/modules/guests/` | Guest registration (public) + admin management |
| `apps/api/src/db/migrations/001_core_schema.sql` | Full Phase 0 DB schema |
| `apps/api/src/db/migrate.ts` | Migration runner |
| `apps/web-client/src/App.tsx` | Router: /r/:token, /r/:token/done |
| `apps/web-client/src/pages/RegisterPage.tsx` | Guest self-registration form |
| `apps/web-client/src/pages/ConfirmationPage.tsx` | Post-registration confirmation |
| `apps/web-client/src/api/client.ts` | Fetch wrapper (get/post) |
| `apps/web-admin/src/` | Admin dashboard: Login, Events, EventDetail, Keyholders |
| `apps/web-admin/src/context/AuthContext.tsx` | Auth state + localStorage persistence |
| `apps/web-staff/src/pages/DoorPage.tsx` | QR scan input → check-in result (green/red) |
| `apps/api/src/modules/door/` | Door scan — validate RS256 QR, mark checked_in |
| `apps/api/src/utils/qr-keys.ts` | Cached PEM key file loader |
| `packages/qr-lib/` | RS256 QR sign/validate (jose) |
| `packages/types/` | Shared TypeScript types |
| `docker-compose.yml` | Local dev: PostgreSQL + Redis |
| `.env.example` | All environment variables documented |
| `docs/API_CONTRACTS.md` | Auth + Sprint 2 endpoint contracts |

## API Routes — Sprint 2

### Protected (requires JWT)
| Method | Path | Roles |
|--------|------|-------|
| POST | /events | admin |
| GET | /events | admin, keyholder |
| GET | /events/:id | admin, keyholder |
| POST | /events/:id/pass-tiers | admin |
| GET | /events/:id/pass-tiers | admin, keyholder |
| POST | /keyholders | admin |
| GET | /keyholders | admin |
| GET | /keyholders/:id | admin |
| POST | /keyholders/:id/events | admin |
| POST | /share-links | keyholder, admin |
| GET | /share-links | admin (all), keyholder (own) |
| GET | /guests?eventId= | admin (all), keyholder (own) |
| PATCH | /guests/:id/status | admin |

### Public (no auth)
| Method | Path | Purpose |
|--------|------|---------|
| GET | /share-links/:token | Resolve link info for registration page |
| POST | /register/:token | Guest self-registers via share link |

## Immovable rules (never change without explicit PO approval)
1. Every table has `venue_id UUID NOT NULL`
2. All IDs are `UUID DEFAULT gen_random_uuid()` — no SERIAL
3. QRs are RS256 JWTs via `packages/qr-lib` exclusively
4. Comanda Pass and Comanda Extra are always separate
5. QR never contains table number
6. FEL is mandatory on every transaction
7. Inventory decrements on DISPATCH (state 3), not on order
8. Offline mode is a design requirement for staff apps
