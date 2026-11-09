# BiletFlow Final Report - Backend part (Liza Shamarova)

> Draft for merging into `TeamName_Final_Report.pdf`. Each block says which of the 12 required
> sections it belongs to. Items in **[brackets]** are facts only you/the team know - fill them in.
> Remove this note before submitting.

---

## Identification (cover page - backend facts)

- Backend repository: https://github.com/lizashamar/BiletFlow_SRS_SWE_Team13 (folder `backend_src/`, schema in `prisma/`)
- Final commit/tag tested: **[git rev-parse --short HEAD after you commit]**
- Reporting cut-off: **[date]**
- Member: Liza Shamarova, student ID **[ID]**, role: backend developer (API, RBAC, check-in/offline sync, backend testing)

---

## Executive-summary sentence (backend)

The backend is a Node.js/Express REST API over PostgreSQL (Prisma) that lets organizers create events,
attendees register or buy simulated-payment tickets, and event admins check attendees in, including
a manifest/batch-sync path for offline scanning. 39 automated integration tests covering all four
roles pass; the main limitation is that the tests ran on an in-memory database stand-in and that
several SRS items (staff assignment, audit-log table, real payments) need schema work not done.

---

## 1. Knowledge base for engineering (backend)

Explain concepts and tie each to code:

| Concept | Where it shows up in the code | Why it matters |
|---|---|---|
| **Stateless authentication with JWT** | `middleware/authMiddleware.js` (`authenticate`), `controllers/authController.js` | Mobile scanner and web app send `Authorization: Bearer`; token carries `id`, `email`, `role`, expires in 24 h. Secret comes from `JWT_SECRET`; `config.js` refuses to start in production without it. |
| **Role-based access control (RBAC)** | `authorize(...roles)`; roles ATTENDEE / ORGANIZER / EVENT_ADMIN / PLATFORM_ADMIN | SRS 4.1 and 2.3. Role gives route access; *ownership* checks (`assertOwner`, `assertCanManageEvent`) stop organizer B from touching organizer A's event. |
| **Password hashing** | `bcryptjs` in login/register | SRS section 7 requires secure hashing. We removed an insecure fallback that compared the plain password to the stored value. |
| **Atomic conditional updates (preventing overselling and double entry)** | `orderController.createOrder`: `updateMany({ where: { remainingQuantity >= qty }, data: decrement })`; `checkinController.markCheckedIn`: `updateMany({ where: { status: 'VALID' } })` inside `$transaction` | Two requests racing for the last ticket or the same QR: the database lets exactly one `count = 1` win. Tested by concurrent-request tests (see 3). |
| **Database transactions** | `prisma.$transaction` in create order, refund, check-in, undo | A failed multi-item order rolls back earlier stock deductions (tested). |
| **Input validation and generic errors** | `parseOrderBody`, `HttpError`, `handleError`, `middleware/common.js` | Bad input gives 400, not a stack trace; login returns the same 401 message for unknown user and wrong password (no account enumeration). |
| **Offline-first sync design** | `GET /api/checkin/manifest/:eventId`, `POST /api/checkin/sync` | Manifest contains SHA-256 of each QR token, not the token, so a stolen phone cannot be used to forge tickets. Sync is idempotent; server re-validates every queued scan and sanitizes the phone's timestamp (future or older than 7 days replaced by server time). |
| **Money as integers** | `totalCents` in `createOrder` | Avoids floating-point rounding errors on KZT totals. |
| **iCalendar (RFC 5545)** | `utils/ics.js` | Stable `UID` lets an updated file replace an earlier calendar entry (SRS 4.11). |

---

## 2. Problem analysis - backend rows of the requirements-to-results table

Statuses are what I can support with the code and `backend_src/tests/api.test.js` at the tested commit.
"Verified" means an automated test passes against the in-memory database (see limits in section 3).

| SRS ref | Requirement | Status | Implementation evidence | Verification / remaining gap |
|---|---|---|---|---|
| 4.1 | Register, sign in, role-based permissions | **Implemented** (email verification and password reset **Not implemented**) | `authController.js`, `authRoutes.js`, `authMiddleware.js` | Tests: login for all 4 roles, 401/400 cases, register (duplicate, weak password, privileged role refused), expired/invalid token, 403 for wrong role. |
| 4.2 | Create, edit, publish/unpublish events | **Partial** | `eventController.js` (`createEvent`, `updateEvent`, `getEventById`, `getMyEvents`) | Tested incl. validation and ownership. Gaps: duplicate event, cancel event, public/unlisted/private visibility, registration open/close times - not implemented. |
| 4.3 | Ticket types, inventory, no sales when sold out | **Implemented** (sales windows, per-order limit configurable: **Partial**) | `createEvent` ticket types; `createOrder` atomic stock decrement; fixed limit of 10 tickets/order | Tested: sold-out 409, rollback, concurrent last-ticket race (exactly 1 of 4 succeeds). |
| 4.4 | Free registration, zero-value order, QR ticket | **Implemented** (confirmation email **Not implemented**) | `createOrder` | Tested: total 0, unique 64-hex QR per ticket. |
| 4.5 | Paid-sales activation per event | **Implemented as simulation** | `activatePaidSales` checks paid ticket type, payout account, accepted terms | Tested checklist and that paid checkout is blocked before activation. Fee payment and identity check are not modelled (SRS allows simulation). |
| 4.6 | Checkout and payments | **Partial / agreed simulation** | Order is `COMPLETED` immediately (`// TODO` payment gateway) | No payment-failure path; no processing fee calculation. |
| 4.7 | Digital tickets, statuses, QR | **Partial** | `ticketController.js`, `utils/qr.js` (256-bit random token) | Tested ticket ownership (404 for other users). PDF generation **Not implemented** on backend. |
| 4.8 | Mobile verification and check-in | **Implemented** (restriction to *assigned* events **Not implemented**) | `checkinController.js`: `verify`, `manual`, `search`, `undo`, `stats`, `events`, `manifest`, `sync`; mobile alias `POST /api/tickets/check-in` | Tested: single admission, concurrent scans admit one person, undo then re-scan, wrong event, other organizer, pending order, refunded ticket, campaign-style token rejected. **Gap:** no `StaffAssignment` table, so any EVENT_ADMIN can scan any event. |
| 4.8 (offline) | Synchronize check-ins (SRS says offline deferred; commitment added it) | **Backend implemented; mobile client Partial** | `manifest`, `sync` | Tested: batch apply, offline time preserved, resend idempotent, two devices same ticket, mixed good/bad batch, bad timestamps, batch limit 200. **Gap:** `mobile/src/storage/scanCache.ts` does not yet use manifest/sync; not tested on a physical phone. |
| 4.9 | Orders, cancellations, refunds, audit | **Partial** | `getMyOrders`, `getOrderById`, `refundOrder` (restocks, invalidates tickets, blocks refund after check-in) | Tested. **Gap:** no audit table - events only printed as `[AUDIT]` JSON lines (`utils/audit.js`); refund policy configuration not implemented. |
| 4.11 | Calendar export | **Implemented** (bonus) | `utils/ics.js`, `GET /api/events/:id/calendar.ics` | Test checks UID, DTSTART, location. Not opened in a real calendar app **[say if you did]**. |
| 4.15 | Organizer analytics | **Partial** | `GET /events/:id/stats`, `/attendees` | Tested capacity, revenue, refunds, per-type, check-in rate. Campaign metrics and date/ticket-type filters not implemented. |
| 4.3.1, 4.12-4.14, 4.16 | Seating, admin portal, support chat, promo codes, timeline | **Not implemented (backend)** | - | State as such, or as agreed scope change if the team recorded it **[where]**. |
| Section 7 | Security, backups, load | **Partial** | JWT secret guard, rate-limited login, `scripts/backup.sh` (pg_dump), indexes `tickets(status)`, `tickets(ticket_type_id)` | Backup script and load test were written by a teammate and I did **not** run them: the load-test URL `/api/check-ins` does not exist (real route `/api/checkin/verify`). |

---

## 3. Investigation (backend) - verification of journeys and failure cases

**Question.** Do the event, order and check-in endpoints behave correctly for each user role, including
failure cases and the offline-sync path?

**Method.** I wrote `backend_src/tests/api.test.js` (Node built-in test runner, real HTTP calls against the
Express app, JWTs obtained by logging in as seeded accounts). Accounts: one per role, created by
`backend_src/scripts/seedAccounts.js`. Because no PostgreSQL was available on my machine, the database
is `tests/helpers/fakePrisma.js`, an in-memory implementation of the Prisma calls the code uses, with
serialized, roll-back-on-error transactions.

**Tested commit / environment:** **[commit]**, Windows 11, Node v22.18, run on **[date]**.
**Command:** `node --test backend_src/tests/api.test.js`
**Result:** 39 tests, 39 pass, 0 fail.

Journeys and failure cases (expected = actual in all):

| Journey / case | Expected | Result |
|---|---|---|
| Each role logs in | 200 + correct role | Pass |
| Wrong password / unknown user / empty body / bad JSON | 401 same message / 400 / 400 | Pass |
| Attendee calls organizer or scanner endpoint | 403 | Pass |
| Organizer creates, edits, publishes event; other organizer edits it | 201/200; 403 | Pass |
| Attendee buys paid ticket before activation | 403 | Pass |
| Attendee registers for free event, buys paid ticket | 201, exact total, QR issued | Pass |
| Order exceeds stock; second item fails | 409; first item's stock restored | Pass |
| 4 concurrent buyers, 1 ticket left | 1 x 201, 3 x 409, stock 0 | Pass |
| Organizer refunds paid order | tickets REFUNDED, stock restored, QR rejected at gate | Pass |
| Scanner scans valid / repeated / unknown / malformed QR | 200 / 409 / 404 / 400 | Pass |
| 6 simultaneous scans of one ticket | exactly one admitted | Pass |
| Undo check-in, re-scan | 200, then 200 again | Pass |
| Offline: manifest has no raw QR; batch sync; resend; two devices; invalid scans; future timestamp | as designed | Pass |

**Defects found by this investigation and fixed** (interpretation: they would have broken the demo):
mock `POST /events`; seeded users could not log in; seeded ticket rejected as invalid QR; mobile app
called a non-existent endpoint; login 500/400 error codes; separate DB connection pools; plaintext
password fallback. Full list: `backend_src/TESTING.md`.

**What this establishes / limits.** The business logic and the HTTP contract are verified. It does **not**
verify behaviour on real PostgreSQL (real transaction isolation, unique constraints, query plans), real
load, the mobile app on a phone, or the web frontend integration. **[If you later run the suite or
a Postman collection against real Postgres, add that result here.]**

---

## 4. Design (backend)

**Components:** React web app and Expo mobile app -> Express API (`server.js`, routes -> controllers) ->
Prisma -> PostgreSQL. Cross-cutting: `authMiddleware` (JWT + RBAC), `middleware/common.js` (CORS,
rate limit, JSON errors), `db.js` (single Prisma client), `utils/audit.js`, `utils/qr.js`, `utils/ics.js`.

**Data relationships (implemented in `prisma/schema.prisma`):** User 1-* Event (organizer);
Event 1-* TicketType; Event 1-* Order; User 1-* Order; Order 1-* Ticket; TicketType 1-* Ticket;
Ticket 1-* CheckIn; User 1-* CheckIn (scanner). *Proposed, not implemented:* StaffAssignment, AuditLog,
Payment, Refund, SeatHold, PromoCode.

**End-to-end interaction (use in the report as a sequence diagram):**
1. Organizer `POST /api/auth/login` -> JWT. `POST /api/events` (draft + ticket types) -> `PATCH` `isPublished: true`.
2. Attendee `POST /api/orders` -> in one transaction: validate, atomically decrement stock, create order, create tickets with random QR tokens.
3. Event admin (mobile) `GET /api/checkin/manifest/:eventId` while online -> scans offline against SHA-256 list.
4. Back online `POST /api/checkin/sync` -> each scan re-validated atomically (`VALID -> CHECKED_IN`), per-scan result returned.
5. Organizer `GET /api/events/:id/stats` -> sold, revenue, attendance.

**Alternatives and trade-offs (explain in 1-2 sentences each):**
- *Atomic `updateMany` vs. read-then-write or row locks:* chosen for simplicity and correctness under concurrency without explicit locking.
- *Manifest of hashes vs. plaintext QR tokens offline:* security of lost phones vs. needing to hash on the device.
- *"First sync wins" for two offline devices vs. "earliest scan wins":* simpler, but may credit the wrong device; documented as a limitation.
- *Audit to stdout vs. a table:* table needs a schema change outside my scope/time.
- *Mobile alias always returning HTTP 200 for ticket outcomes:* the app treats any non-2xx as "offline", so ticket outcomes are in the body.
- **Change after integration/testing:** added `/api/tickets/check-in` after finding the mobile client and API disagreed on route and response shape.

---

## 5. Use of engineering tools

- Git/GitHub feature branches and pull requests (`feature/events-checkin-sync`, merged as PR #10).
- Prisma (schema, migrations, client), PostgreSQL, Express, bcryptjs, jsonwebtoken.
- Node's built-in test runner + `fetch` for API tests (no extra dependency); in-memory Prisma stand-in.
- **AI assistance (declare per course rules - adjust wording to what you actually did):** I used Claude Code to
  review the backend, implement the fixes and extra endpoints, and draft the test suite. I checked
  the work by reading every change, running the 39 tests, and checking behaviour against the SRS
  sections listed in section 2. **[Add what you personally reviewed or changed.]** The in-memory database
  stand-in was AI-written, so tests prove the code against that model, not against Postgres itself.
- Outcome improved by tools: automated tests found/ prevented regressions of the concurrency and authorization defects above.

---

## 6. Individual and team work - my row

| Member | Work | Role in shared work | Evidence | Result / limitation |
|---|---|---|---|---|
| Liza Shamarova | Express structure, auth + RBAC, orders, check-in validation (commit `be47170`), events/check-in sync integration (PR #10), backend testing, fixes and new endpoints (this milestone), `TESTING.md` | Defined API contract used by the mobile scanner (teammate **[name]**, commits by `azhumadildakaraganda-blip`) and frontend **[name]**; reviewed PRs #9-#12 | commits above, `backend_src/tests/api.test.js` | Backend features per section 2; gaps listed there |

Collaboration problem to describe (true in the repo - confirm and reword): the mobile app was built against
`/api/tickets/check-in {qrToken}` while the backend exposed `/api/checkin/verify {qrCodeHash}`, and the
two sides were never run together. Response: read the mobile code, added a compatible endpoint, and
documented the contract in `TESTING.md`. Lesson: agree on a written API contract before parallel work.
(Other members' contributions: see their own rows - commits show teammates also wrote the DB indexes,
backup script, and the mobile and frontend code.)

---

## 7. Communication skills (backend example)

Use the API-contract mismatch above as the "misunderstanding" example, plus the `TESTING.md` issue table
as the artifact that made the gaps visible to the team. **[Add one real piece of feedback you received.]**

---

## 8. Professionalism - concrete concerns

- **Security:** credentials: bcrypt hashes, generic login error, login rate-limit (20 / 15 min / IP, in-memory,
  single instance only). JWT secret must be set in production. Offline manifest uses hashed QR values.
  Authorization checked both by role and by event ownership (tested 403 cases). QR tokens are 256-bit random values.
- **Privacy:** buyer email appears only in the owner-only attendee list; attendee can only read own orders/tickets
  (404 rather than 403 to avoid revealing other users' orders).
- **Reliability:** transactions, atomic updates, idempotent sync, single DB client; `scripts/backup.sh` exists (untested by me).
- **Maintainability:** controllers share `HttpError`/`handleError`; tests double as documentation.
- **Readiness limits:** no HTTPS termination configured, CORS defaults to `*` (set `CORS_ORIGIN`), rate limiter is
  per process, payments simulated and must always be labelled so (responses include `simulated: true`),
  no audit table, no email delivery, not load-tested, not run on real Postgres by me.
- Passwords in `seedAccounts.js` are well-known test values; the script refuses to run with `NODE_ENV=production`.

---

## 9. Impact on society and environment (backend angle)

Connectivity: Kazakhstan venues often have poor mobile data; the manifest + batch-sync design lets the
gate keep working offline, at the cost of staleness (a ticket refunded after the manifest download is
still accepted until sync; mitigated by re-downloading the manifest before the event - **uncertainty:**
not measured). Hosting: a single small API + Postgres instance is enough for MVP scale, limiting resource use.

## 10. Ethics and equity (backend angle)

Concrete issue: wrongly denying entry vs. admitting a duplicate. We chose "never admit twice" and give the
gate staff manual search and undo, so a false rejection can be corrected by a person. Stakeholders:
attendees, gate staff, organizers. Data minimisation: no card data stored, simulated payments labelled.
Remaining risk: name search is case-insensitive substring only (no Cyrillic/Latin transliteration), so
Kazakh/Russian spelling variants may be missed. Reused work: Express, Prisma, bcryptjs, jsonwebtoken (open source);
AI assistance as declared in section 5.

## 11. Economics and project management (backend part)

Commitment reconciliation (from the biweekly report, due 9 Nov 2026):

| Commitment | Result | Evidence |
|---|---|---|
| Test backend event, order and check-in endpoints with seeded accounts for required roles; fix or document issues | **Done** - 39 automated tests, defects fixed or documented | `tests/api.test.js`, `TESTING.md` |
| Complete mobile scanner integration and offline check-in testing | **Partial** - backend and compatibility endpoint done and tested; mobile client does not yet call manifest/sync; no physical-device test **[confirm]** | `checkinController.js`, mobile `scanCache.ts` |

Carried forward: mobile manifest download + sync queue, StaffAssignment table, AuditLog table, real-DB test run, load test with correct URL.
Operating cost estimate: **[fill with currency, date and source, e.g. a free-tier Postgres host and a small VM; state free-tier limits and assumptions]** - I did not research prices, so do not copy numbers from this draft.

## 12. Lifelong learning - reflection (write in your own words)

Skeleton (must be yours; the guide asks for gap, resources, application, evidence):
- **Gap:** e.g. concurrency control in databases / writing integration tests without a database.
- **Resources:** **[Prisma docs on `updateMany` and transactions, Node test runner docs, course material...]**
- **Application:** atomic `updateMany` in order creation and check-in; in-memory test database.
- **Evidence:** the concurrent tests (4 buyers/1 ticket; 6 scans/1 ticket) pass.
- **Team lessons / next priorities:** agree API contract early; test on the real database; add StaffAssignment and AuditLog; finish offline client.

---

## Reproduction instructions (backend)

```bash
npm ci
cp .env.example .env            # you need to create/keep a .env.example with PORT, JWT_SECRET, DATABASE_URL (no real secrets)
npx prisma migrate deploy && npx prisma generate
node backend_src/scripts/seedAccounts.js     # accounts: attendee@, attendee2@, organizer@, organizer2@, scanner1@, admin@biletflow.kz
npm start                                     # API on :5000, GET /api/health
node --test backend_src/tests/api.test.js     # automated tests (no database needed)
```
Demo password for the seeded test accounts: `Password123!` (dev only). The repository currently has no `.env.example`
for the backend - add one before submission.

## References (add in the team's chosen style)

SRS BiletFlow v0.3; Prisma documentation (transactions, `updateMany`); RFC 5545 (iCalendar); Express and
jsonwebtoken documentation; OWASP ASVS / Authentication Cheat Sheet **[cite only what you actually used]**.
