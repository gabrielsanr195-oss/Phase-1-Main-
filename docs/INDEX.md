# Phase 1+ — Session Index

> Source of truth for session state. Update at the end of every session.

## Estado actual
**Sprint**: 0 — Foundation
**Last session**: Phase 0 complete — monorepo scaffold, auth, QR lib, DB schema
**Next**: Sprint 2 — Keyholder & Guest registration flows (web-client + API)

## Completed ✅
- [x] S0-1: Monorepo (pnpm workspaces + TypeScript)
- [x] S0-2: Docker Compose (PostgreSQL 16 + Redis 7)
- [x] S0-3: CI/CD (GitHub Actions — lint, typecheck, test, build)
- [x] S0-4: Core DB schema (001_core_schema.sql — all Phase 0 tables)
- [x] S0-5: Auth system (register, login, refresh, logout)
- [x] S0-6: packages/qr-lib (RS256 sign/validate + tests)
- [x] S0-7: Multi-tenant middleware (venue_id from JWT, never from body)

## In progress 🔄
_nothing — sprint 0 done_

## Key files
| File | Purpose |
|------|---------|
| `apps/api/src/app.ts` | Fastify app factory |
| `apps/api/src/config.ts` | Env config (validated at startup) |
| `apps/api/src/plugins/tenant.ts` | Multi-tenant onRequest hook |
| `apps/api/src/plugins/auth.ts` | JWT plugin + authenticate decorator |
| `apps/api/src/modules/auth/` | Auth routes, service, schemas |
| `apps/api/src/db/migrations/001_core_schema.sql` | Full Phase 0 DB schema |
| `apps/api/src/db/migrate.ts` | Migration runner |
| `packages/qr-lib/` | RS256 QR sign/validate (jose) |
| `packages/types/` | Shared TypeScript types |
| `docker-compose.yml` | Local dev: PostgreSQL + Redis |
| `.env.example` | All environment variables documented |
| `docs/API_CONTRACTS.md` | Auth endpoint contracts |

## Immovable rules (never change without explicit PO approval)
1. Every table has `venue_id UUID NOT NULL`
2. All IDs are `UUID DEFAULT gen_random_uuid()` — no SERIAL
3. QRs are RS256 JWTs via `packages/qr-lib` exclusively
4. Comanda Pass and Comanda Extra are always separate
5. QR never contains table number
6. FEL is mandatory on every transaction
7. Inventory decrements on DISPATCH (state 3), not on order
8. Offline mode is a design requirement for staff apps
