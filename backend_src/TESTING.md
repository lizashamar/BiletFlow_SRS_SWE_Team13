# Backend testing report (events, orders, check-in)

Run: `node --test backend_src/tests/api.test.js` (no database needed; uses an in-memory Prisma stand-in).

Real DB accounts for manual / Postman testing: `node backend_src/scripts/seedAccounts.js`
(password `Password123!` for attendee@, attendee2@, organizer@, organizer2@, scanner1@, admin@ `biletflow.kz`).

## Issues found and fixed

| # | Issue | Fix |
|---|-------|-----|
| 1 | `POST /api/events` was a mock: nothing saved, no ticket types, EVENT_ADMIN could "create" events | Real implementation, organizer-only, validation, draft by default |
| 2 | Seeded accounts could not log in (placeholder bcrypt hash) and login fell back to plaintext `password === hash` | Fallback removed; `scripts/seedAccounts.js` creates working accounts per role |
| 3 | Login: wrong credentials returned 400, missing body returned 500 with raw `error.message` | 401 with a generic message, 400 on bad input |
| 4 | QR validation required 64-hex, so the seeded ticket `BF_QR_HASH_...` was always "invalid" | Accepts `[A-Za-z0-9_-]{8,255}`; authenticity is the DB lookup |
| 5 | Mobile app calls `POST /api/tickets/check-in {qrToken}` (route did not exist) and treats non-2xx as offline | Added alias returning HTTP 200 + `{status: VALID/INVALID/ALREADY_CHECKED_IN/CANCELLED}` |
| 6 | Each controller created its own `PrismaClient` (4 pools) | Single `db.js` |
| 7 | Malformed JSON gave an HTML 500 page; unknown routes gave HTML 404; no CORS for the web frontend | JSON error handlers + CORS |
| 8 | JWT secret silently defaulted to `supersecretkey` in production | Throws if `JWT_SECRET` missing when `NODE_ENV=production` |
| 9 | Order totals used `Decimal` helpers (breaks without generated client) | Integer-cent arithmetic |

## Known issues NOT fixable inside `backend_src/` (need schema / other-folder changes)

1. **No Staff Assignment table** (SRS 4.8 "view only assigned events"): any EVENT_ADMIN can scan any event. Needs a `StaffAssignment` model in `prisma/schema.prisma`.
2. **No audit_logs table** (SRS 4.9/4.16): audit events are written to stdout as `[AUDIT] {json}` (`utils/audit.js`).
3. **No Payment/Refund/Cancelled-event models**: payments are simulated, refund = order `REFUNDED` + tickets `REFUNDED`/`CANCELLED`.
4. `prisma/seed.js` still creates users with an unusable hash and no seat/promo/support entities; use `scripts/seedAccounts.js`.
5. Offline conflict policy is "first sync wins" (the earlier physical scan is not preferred when two devices sync out of order).
6. Mobile `scanCache.ts` only caches recent scans; it does not yet download `/api/checkin/manifest/:eventId` or upload a queue to `/api/checkin/sync`. Backend endpoints are ready and tested; the client side is outside backend scope.
7. In-memory test DB approximates PostgreSQL; run the suite once against a real DB before the demo.
