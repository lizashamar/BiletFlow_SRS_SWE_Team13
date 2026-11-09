// Интеграционные тесты событий, заказов и check-in (+ офлайн-синхронизация) по ролям из SRS.
// Запуск:  node --test backend_src/tests
// БД — in-memory (tests/helpers/fakePrisma.js), аккаунты — scripts/seedAccounts.js.
process.env.JWT_SECRET = 'test-secret';
process.env.AUDIT_SILENT = '1';
process.env.RATE_LIMIT_DISABLED = '1';

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const { createFakePrisma } = require('./helpers/fakePrisma');

const db = createFakePrisma();
global.__BILETFLOW_PRISMA__ = db;

const app = require('../server');
const { seedAccounts, TEST_PASSWORD } = require('../scripts/seedAccounts');

let server;
let base;
let users;
let tokens;
let ids; // { event, draft, otherEvent, free, paid, ... }

const DAY = 24 * 3600 * 1000;
const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');

async function api(method, path, { token, body, raw } = {}) {
  const res = await fetch(base + path, {
    method,
    headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body),
  });
  if (raw) return res;
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* not json */ }
  return { status: res.status, body: json, text };
}

async function login(email) {
  const r = await api('POST', '/api/auth/login', { body: { email, password: TEST_PASSWORD } });
  assert.equal(r.status, 200, `login ${email}`);
  return r.body.token;
}

async function order(token, items, eventId = ids.event) {
  return api('POST', '/api/orders', { token, body: { eventId, items } });
}

test.before(async () => {
  server = app.listen(0);
  await new Promise((r) => server.once('listening', r));
  base = `http://127.0.0.1:${server.address().port}`;
});
test.after(() => server.close());

test.beforeEach(async () => {
  db.$reset();
  users = await seedAccounts(db, { rounds: 4 });
  tokens = {};
  for (const k of Object.keys(users)) tokens[k] = await login(users[k].email);

  const mk = (organizerId, title, over = {}) =>
    db.event.create({
      data: {
        organizerId, title, venueName: 'Arena', venueAddress: 'Astana', capacity: 1000,
        startTime: new Date(Date.now() + 7 * DAY), endTime: new Date(Date.now() + 8 * DAY),
        isPublished: true, paidSalesActive: true, ...over,
      },
    });
  const event = await mk(users.organizer.id, 'Main Event');
  const draft = await mk(users.organizer.id, 'Draft Event', { isPublished: false });
  const otherEvent = await mk(users.organizer2.id, 'Other Organizer Event');
  const free = await db.ticketType.create({ data: { eventId: event.id, name: 'Free', price: 0, totalQuantity: 5, remainingQuantity: 5 } });
  const paid = await db.ticketType.create({ data: { eventId: event.id, name: 'VIP', price: 25000, isPaid: true, totalQuantity: 3, remainingQuantity: 3 } });
  ids = { event: event.id, draft: draft.id, otherEvent: otherEvent.id, free: free.id, paid: paid.id };
});

// ---------------------------------------------------------------- AUTH / RBAC
test('auth: every seeded role can log in and receives its role', async () => {
  for (const [key, u] of Object.entries(users)) {
    const r = await api('POST', '/api/auth/login', { body: { email: u.email, password: TEST_PASSWORD } });
    assert.equal(r.status, 200, key);
    assert.equal(r.body.user.role, u.role);
  }
});

test('auth: wrong password / unknown user -> 401 with identical message; missing fields -> 400', async () => {
  const a = await api('POST', '/api/auth/login', { body: { email: users.attendee.email, password: 'nope' } });
  const b = await api('POST', '/api/auth/login', { body: { email: 'ghost@x.kz', password: 'nope' } });
  assert.equal(a.status, 401);
  assert.equal(b.status, 401);
  assert.equal(a.body.error, b.body.error);
  assert.equal((await api('POST', '/api/auth/login', { body: {} })).status, 400);
  assert.equal((await api('POST', '/api/auth/login')).status, 400);
});

test('auth: plaintext "password == hash" fallback is gone', async () => {
  await db.user.create({ data: { email: 'plain@x.kz', passwordHash: 'plaintext', fullName: 'P', role: 'ATTENDEE' } });
  const r = await api('POST', '/api/auth/login', { body: { email: 'plain@x.kz', password: 'plaintext' } });
  assert.equal(r.status, 401);
});

test('auth: malformed JSON -> 400 JSON error, unknown route -> 404 JSON', async () => {
  const r = await api('POST', '/api/auth/login', { body: '{bad json' });
  assert.equal(r.status, 400);
  assert.match(r.body.error, /Malformed/);
  assert.equal((await api('GET', '/api/nope')).status, 404);
});

test('auth: register creates attendee, rejects duplicates, weak passwords and privileged roles', async () => {
  const ok = await api('POST', '/api/auth/register', { body: { email: 'New@Example.com', password: 'longenough1', fullName: 'New User' } });
  assert.equal(ok.status, 201);
  assert.equal(ok.body.user.role, 'ATTENDEE');
  assert.equal(ok.body.user.email, 'new@example.com');
  assert.equal((await api('POST', '/api/auth/register', { body: { email: 'new@example.com', password: 'longenough1', fullName: 'X' } })).status, 409);
  assert.equal((await api('POST', '/api/auth/register', { body: { email: 'a@b.kz', password: 'short', fullName: 'X' } })).status, 400);
  assert.equal((await api('POST', '/api/auth/register', { body: { email: 'a@b.kz', password: 'longenough1', fullName: 'X', role: 'PLATFORM_ADMIN' } })).status, 400);
  const me = await api('GET', '/api/auth/me', { token: ok.body.token });
  assert.equal(me.body.user.email, 'new@example.com');
});

test('rbac: missing/invalid/expired token -> 401; wrong role -> 403', async () => {
  assert.equal((await api('GET', '/api/orders')).status, 401);
  assert.equal((await api('GET', '/api/orders', { token: 'garbage' })).status, 401);
  const jwt = require('jsonwebtoken');
  const expired = jwt.sign({ id: 1, role: 'ATTENDEE' }, 'test-secret', { expiresIn: -10 });
  const r = await api('GET', '/api/orders', { token: expired });
  assert.equal(r.status, 401);
  assert.equal(r.body.error, 'Token expired');

  assert.equal((await api('GET', '/api/checkin/events', { token: tokens.attendee })).status, 403);
  assert.equal((await api('POST', '/api/events', { token: tokens.attendee, body: {} })).status, 403);
  assert.equal((await api('POST', '/api/events', { token: tokens.scanner, body: {} })).status, 403);
  assert.equal((await order(tokens.organizer, [{ ticketTypeId: ids.free, quantity: 1 }])).status, 403);
  assert.equal((await api('POST', '/api/tickets/check-in', { token: tokens.attendee, body: { qrToken: 'x'.repeat(10) } })).status, 403);
});

// ---------------------------------------------------------------- EVENTS
const newEventBody = (over = {}) => ({
  title: 'Spring Fest', description: 'Fun', venueName: 'Palace', venueAddress: 'Almaty',
  startTime: new Date(Date.now() + 10 * DAY).toISOString(), endTime: new Date(Date.now() + 11 * DAY).toISOString(),
  capacity: 100,
  ticketTypes: [{ name: 'Free', price: 0, totalQuantity: 50 }, { name: 'VIP', price: 5000, totalQuantity: 20 }],
  ...over,
});

test('events: public list shows only published events with ticket types; search & upcoming filters', async () => {
  const r = await api('GET', '/api/events');
  assert.equal(r.status, 200);
  const titles = r.body.map((e) => e.title).sort();
  assert.deepEqual(titles, ['Main Event', 'Other Organizer Event']);
  const main = r.body.find((e) => e.title === 'Main Event');
  assert.equal(main.ticketTypes.length, 2);
  assert.equal(main.price, 0);
  assert.equal(typeof main.ticketTypes[0].price, 'number');
  assert.equal((await api('GET', '/api/events?q=main')).body.length, 1);
});

test('events: draft is hidden from public/other organizers but visible to owner', async () => {
  assert.equal((await api('GET', `/api/events/${ids.draft}`)).status, 404);
  assert.equal((await api('GET', `/api/events/${ids.draft}`, { token: tokens.attendee })).status, 404);
  assert.equal((await api('GET', `/api/events/${ids.draft}`, { token: tokens.organizer2 })).status, 404);
  assert.equal((await api('GET', `/api/events/${ids.draft}`, { token: tokens.organizer })).status, 200);
  assert.equal((await api('GET', `/api/events/${ids.draft}`, { token: tokens.admin })).status, 200);
  assert.equal((await api('GET', '/api/events/abc')).status, 400);
});

test('events: organizer creates a draft event with ticket types (persisted, owned by caller)', async () => {
  const r = await api('POST', '/api/events', { token: tokens.organizer, body: newEventBody() });
  assert.equal(r.status, 201);
  assert.equal(r.body.event.isPublished, false);
  assert.equal(r.body.event.paidSalesActive, false);
  assert.equal(r.body.event.organizerId, users.organizer.id);
  assert.equal(r.body.event.ticketTypes.length, 2);
  assert.equal(r.body.event.ticketTypes[1].isPaid, true);
  assert.equal(r.body.event.ticketTypes[0].remainingQuantity, 50);
  const mine = await api('GET', '/api/events/mine', { token: tokens.organizer });
  assert.ok(mine.body.some((e) => e.id === r.body.event.id));
  assert.ok(!(await api('GET', '/api/events/mine', { token: tokens.organizer2 })).body.some((e) => e.id === r.body.event.id));
});

test('events: create validation (missing fields, dates, capacity, quantities, negative price)', async () => {
  const bad = async (over) => (await api('POST', '/api/events', { token: tokens.organizer, body: newEventBody(over) })).status;
  assert.equal(await bad({ title: '' }), 400);
  assert.equal(await bad({ startTime: 'not-a-date' }), 400);
  assert.equal(await bad({ endTime: new Date(Date.now() + 9 * DAY).toISOString() }), 400);
  assert.equal(await bad({ capacity: 0 }), 400);
  assert.equal(await bad({ capacity: 10 }), 400); // 70 билетов > 10 мест
  assert.equal(await bad({ ticketTypes: [] }), 400);
  assert.equal(await bad({ ticketTypes: [{ name: 'X', price: -1, totalQuantity: 5 }] }), 400);
  assert.equal(await bad({ ticketTypes: [{ name: 'X', price: 1, totalQuantity: 0 }] }), 400);
  assert.equal((await api('POST', '/api/events', { token: tokens.organizer, body: { title: 'x', price: 5 } })).status, 400);
});

test('events: owner publishes/unpublishes; other organizer cannot edit (403); unknown id 404', async () => {
  const c = await api('POST', '/api/events', { token: tokens.organizer, body: newEventBody() });
  const id = c.body.event.id;
  assert.equal((await api('PATCH', `/api/events/${id}`, { token: tokens.organizer2, body: { title: 'hack' } })).status, 403);
  assert.equal((await api('PATCH', `/api/events/${id}`, { token: tokens.organizer, body: {} })).status, 400);
  const pub = await api('PATCH', `/api/events/${id}`, { token: tokens.organizer, body: { isPublished: true } });
  assert.equal(pub.body.event.isPublished, true);
  assert.ok((await api('GET', '/api/events')).body.some((e) => e.id === id));
  await api('PATCH', `/api/events/${id}`, { token: tokens.organizer, body: { isPublished: false } });
  assert.ok(!(await api('GET', '/api/events')).body.some((e) => e.id === id));
  assert.equal((await api('PATCH', `/api/events/${id}`, { token: tokens.organizer, body: { capacity: 10 } })).status, 400);
  assert.equal((await api('PATCH', '/api/events/9999', { token: tokens.organizer, body: { title: 'x' } })).status, 404);
});

test('events: paid-sales activation needs checklist, is simulated, and unlocks paid checkout', async () => {
  const c = await api('POST', '/api/events', { token: tokens.organizer, body: newEventBody() });
  const id = c.body.event.id;
  await api('PATCH', `/api/events/${id}`, { token: tokens.organizer, body: { isPublished: true } });
  const paidId = c.body.event.ticketTypes[1].id;

  // до активации платный билет купить нельзя
  const before = await order(tokens.attendee, [{ ticketTypeId: paidId, quantity: 1 }], id);
  assert.equal(before.status, 403);

  const incomplete = await api('POST', `/api/events/${id}/activate-paid-sales`, { token: tokens.organizer, body: { acceptTerms: false } });
  assert.equal(incomplete.status, 400);
  assert.deepEqual(incomplete.body.missing.sort(), ['payoutAccountProvided', 'termsAccepted']);
  assert.equal((await api('POST', `/api/events/${id}/activate-paid-sales`, { token: tokens.organizer2, body: { acceptTerms: true, payoutAccount: 'KZ12345678' } })).status, 403);

  const ok = await api('POST', `/api/events/${id}/activate-paid-sales`, { token: tokens.organizer, body: { acceptTerms: true, payoutAccount: 'KZ1234567890' } });
  assert.equal(ok.status, 200);
  assert.equal(ok.body.simulated, true);
  assert.equal((await api('POST', `/api/events/${id}/activate-paid-sales`, { token: tokens.organizer, body: { acceptTerms: true, payoutAccount: 'KZ1234567890' } })).status, 409);
  assert.equal((await order(tokens.attendee, [{ ticketTypeId: paidId, quantity: 1 }], id)).status, 201);
});

test('events: stats & attendees are owner-only and reflect sales / refunds / check-ins', async () => {
  const o1 = await order(tokens.attendee, [{ ticketTypeId: ids.paid, quantity: 2 }, { ticketTypeId: ids.free, quantity: 1 }]);
  const o2 = await order(tokens.attendee2, [{ ticketTypeId: ids.paid, quantity: 1 }]);
  assert.equal(o1.status, 201);
  await api('POST', `/api/orders/${o2.body.order.id}/refund`, { token: tokens.organizer });
  await api('POST', '/api/checkin/verify', { token: tokens.scanner, body: { qrCodeHash: o1.body.order.tickets[0].qrCodeHash } });

  const s = await api('GET', `/api/events/${ids.event}/stats`, { token: tokens.organizer });
  assert.equal(s.status, 200);
  assert.equal(s.body.capacity.sold, 3);
  assert.equal(s.body.capacity.ticketCapacity, 8);
  assert.equal(s.body.revenue.netRevenue, 50000);
  assert.equal(s.body.revenue.refunds, 25000);
  assert.equal(s.body.revenue.grossSales, 75000);
  assert.equal(s.body.attendance.checkedIn, 1);
  assert.equal(s.body.attendance.absent, 2);
  assert.equal(s.body.byTicketType.find((t) => t.name === 'VIP').sold, 2);
  assert.equal(s.body.salesOverTime.length, 1);

  const a = await api('GET', `/api/events/${ids.event}/attendees`, { token: tokens.organizer });
  assert.equal(a.body.total, 4);
  assert.equal((await api('GET', `/api/events/${ids.event}/attendees?status=CHECKED_IN`, { token: tokens.organizer })).body.total, 1);
  assert.equal((await api('GET', `/api/events/${ids.event}/attendees?status=BOGUS`, { token: tokens.organizer })).status, 400);

  for (const p of ['stats', 'attendees']) {
    assert.equal((await api('GET', `/api/events/${ids.event}/${p}`, { token: tokens.organizer2 })).status, 403);
    assert.equal((await api('GET', `/api/events/${ids.event}/${p}`, { token: tokens.attendee })).status, 403);
    assert.equal((await api('GET', `/api/events/${ids.event}/${p}`)).status, 401);
  }
});

test('events: calendar .ics export has stable UID, times and location', async () => {
  const r = await api('GET', `/api/events/${ids.event}/calendar.ics`, { raw: true });
  assert.equal(r.status, 200);
  assert.match(r.headers.get('content-type'), /text\/calendar/);
  const text = await r.text();
  assert.match(text, /BEGIN:VCALENDAR/);
  assert.match(text, new RegExp(`UID:event-${ids.event}@biletflow.kz`));
  assert.match(text, /DTSTART:\d{8}T\d{6}Z/);
  assert.match(text, /SUMMARY:Main Event/);
  assert.match(text, /LOCATION:Arena\\, Astana/);
  assert.equal((await api('GET', `/api/events/${ids.draft}/calendar.ics`)).status, 404);
});

// ---------------------------------------------------------------- ORDERS
test('orders: free registration creates zero-value COMPLETED order with unique QR tickets', async () => {
  const r = await order(tokens.attendee, [{ ticketTypeId: ids.free, quantity: 2, attendeeNames: ['Aigerim', 'Dana'] }]);
  assert.equal(r.status, 201);
  assert.equal(Number(r.body.order.totalAmount), 0);
  assert.equal(r.body.order.status, 'COMPLETED');
  assert.equal(r.body.order.tickets.length, 2);
  const [a, b] = r.body.order.tickets;
  assert.notEqual(a.qrCodeHash, b.qrCodeHash);
  assert.match(a.qrCodeHash, /^[a-f0-9]{64}$/);
  assert.deepEqual([a.attendeeName, b.attendeeName], ['Aigerim', 'Dana']);
});

test('orders: totals are exact and attendee name defaults to the buyer', async () => {
  const r = await order(tokens.attendee, [{ ticketTypeId: ids.paid, quantity: 2 }, { ticketTypeId: ids.free, quantity: 1 }]);
  assert.equal(Number(r.body.order.totalAmount), 50000);
  assert.ok(r.body.order.tickets.every((t) => t.attendeeName === 'Test Attendee'));
  const tt = await db.ticketType.findUnique({ where: { id: ids.paid } });
  assert.equal(tt.remainingQuantity, 1);
});

test('orders: validation failures -> 400 (bad body, qty 0, >10 tickets, names mismatch, foreign ticket type)', async () => {
  const send = async (b) => (await api('POST', '/api/orders', { token: tokens.attendee, body: b })).status;
  assert.equal(await send({}), 400);
  assert.equal(await send({ eventId: ids.event, items: [] }), 400);
  assert.equal(await send({ eventId: ids.event, items: [{ ticketTypeId: ids.free, quantity: 0 }] }), 400);
  assert.equal(await send({ eventId: ids.event, items: [{ ticketTypeId: ids.free, quantity: 11 }] }), 400);
  assert.equal(await send({ eventId: ids.event, items: [{ ticketTypeId: ids.free, quantity: 2, attendeeNames: ['one'] }] }), 400);
  assert.equal(await send({ eventId: ids.event, items: [{ ticketTypeId: 9999, quantity: 1 }] }), 400);
  assert.equal(await send({ eventId: 9999, items: [{ ticketTypeId: ids.free, quantity: 1 }] }), 404);
});

test('orders: unpublished and already-ended events cannot be ordered', async () => {
  const t = await db.ticketType.create({ data: { eventId: ids.draft, name: 'F', totalQuantity: 5, remainingQuantity: 5 } });
  assert.equal((await order(tokens.attendee, [{ ticketTypeId: t.id, quantity: 1 }], ids.draft)).status, 404);
  const past = await db.event.create({ data: { organizerId: users.organizer.id, title: 'Past', venueName: 'v', venueAddress: 'a', capacity: 5, isPublished: true, startTime: new Date(Date.now() - 2 * DAY), endTime: new Date(Date.now() - DAY) } });
  const pt = await db.ticketType.create({ data: { eventId: past.id, name: 'F', totalQuantity: 5, remainingQuantity: 5 } });
  assert.equal((await order(tokens.attendee, [{ ticketTypeId: pt.id, quantity: 1 }], past.id)).status, 400);
});

test('orders: no overselling - sold-out -> 409 and failed order rolls back earlier stock deductions', async () => {
  assert.equal((await order(tokens.attendee, [{ ticketTypeId: ids.paid, quantity: 4 }])).status, 409);
  // второй элемент не проходит -> первый (free x2) тоже откатывается
  const r = await order(tokens.attendee, [{ ticketTypeId: ids.free, quantity: 2 }, { ticketTypeId: ids.paid, quantity: 4 }]);
  assert.equal(r.status, 409);
  assert.equal((await db.ticketType.findUnique({ where: { id: ids.free } })).remainingQuantity, 5);
  assert.equal((await db.order.findMany({})).length, 0);
});

test('orders: concurrent purchases of the last tickets never oversell', async () => {
  await db.ticketType.updateMany({ where: { id: ids.paid }, data: { remainingQuantity: 1 } });
  const results = await Promise.all([tokens.attendee, tokens.attendee2, tokens.attendee, tokens.attendee2].map((t) => order(t, [{ ticketTypeId: ids.paid, quantity: 1 }])));
  const statuses = results.map((r) => r.status).sort();
  assert.deepEqual(statuses, [201, 409, 409, 409]);
  assert.equal((await db.ticketType.findUnique({ where: { id: ids.paid } })).remainingQuantity, 0);
});

test('orders: attendee sees only own orders/tickets (404 for others), admin sees all', async () => {
  const o = await order(tokens.attendee, [{ ticketTypeId: ids.free, quantity: 1 }]);
  const oid = o.body.order.id;
  const tid = o.body.order.tickets[0].id;
  assert.equal((await api('GET', '/api/orders', { token: tokens.attendee })).body.length, 1);
  assert.equal((await api('GET', '/api/orders', { token: tokens.attendee2 })).body.length, 0);
  assert.equal((await api('GET', `/api/orders/${oid}`, { token: tokens.attendee })).status, 200);
  assert.equal((await api('GET', `/api/orders/${oid}`, { token: tokens.attendee2 })).status, 404);
  assert.equal((await api('GET', `/api/orders/${oid}`, { token: tokens.admin })).status, 200);
  assert.equal((await api('GET', `/api/tickets/${tid}`, { token: tokens.attendee2 })).status, 404);
  assert.equal((await api('GET', `/api/tickets/${tid}`, { token: tokens.attendee })).body.ticketType.name, 'Free');
  assert.equal((await api('GET', '/api/tickets?status=VALID', { token: tokens.attendee })).body.length, 1);
  assert.equal((await api('GET', '/api/tickets?status=BOGUS', { token: tokens.attendee })).status, 400);
  assert.equal((await api('GET', '/api/orders/abc', { token: tokens.attendee })).status, 400);
});

test('refund: owner refunds, tickets invalidated, stock restored; scanning refunded ticket is rejected', async () => {
  const o = await order(tokens.attendee, [{ ticketTypeId: ids.paid, quantity: 2 }]);
  const oid = o.body.order.id;
  assert.equal((await api('POST', `/api/orders/${oid}/refund`, { token: tokens.attendee })).status, 403);
  assert.equal((await api('POST', `/api/orders/${oid}/refund`, { token: tokens.organizer2 })).status, 403);
  const r = await api('POST', `/api/orders/${oid}/refund`, { token: tokens.organizer });
  assert.equal(r.status, 200);
  assert.equal(r.body.ticketStatus, 'REFUNDED');
  assert.equal((await db.ticketType.findUnique({ where: { id: ids.paid } })).remainingQuantity, 3);
  assert.equal((await api('GET', `/api/orders/${oid}`, { token: tokens.attendee })).body.status, 'REFUNDED');
  const scan = await api('POST', '/api/checkin/verify', { token: tokens.scanner, body: { qrCodeHash: o.body.order.tickets[0].qrCodeHash } });
  assert.equal(scan.status, 403);
  assert.equal((await api('POST', `/api/orders/${oid}/refund`, { token: tokens.organizer })).status, 409); // повторный возврат
  assert.equal((await api('POST', '/api/orders/9999/refund', { token: tokens.organizer })).status, 404);
});

test('refund: free registration is cancelled; checked-in order cannot be refunded until check-in is undone', async () => {
  const f = await order(tokens.attendee, [{ ticketTypeId: ids.free, quantity: 1 }]);
  const rf = await api('POST', `/api/orders/${f.body.order.id}/refund`, { token: tokens.organizer });
  assert.equal(rf.body.ticketStatus, 'CANCELLED');

  const o = await order(tokens.attendee, [{ ticketTypeId: ids.paid, quantity: 1 }]);
  const t = o.body.order.tickets[0];
  await api('POST', '/api/checkin/verify', { token: tokens.scanner, body: { qrCodeHash: t.qrCodeHash } });
  assert.equal((await api('POST', `/api/orders/${o.body.order.id}/refund`, { token: tokens.organizer })).status, 409);
  await api('POST', '/api/checkin/undo', { token: tokens.scanner, body: { ticketId: t.id } });
  assert.equal((await api('POST', `/api/orders/${o.body.order.id}/refund`, { token: tokens.organizer })).status, 200);
});

// ---------------------------------------------------------------- CHECK-IN
async function ticketFor(eventTypeId = ids.free, buyer = tokens.attendee, names) {
  const r = await order(buyer, [{ ticketTypeId: eventTypeId, quantity: 1, ...(names ? { attendeeNames: names } : {}) }]);
  assert.equal(r.status, 201);
  return r.body.order.tickets[0];
}

test('check-in: scanner verifies once; second scan is 409 ALREADY_CHECKED_IN with first timestamp', async () => {
  const t = await ticketFor();
  const first = await api('POST', '/api/checkin/verify', { token: tokens.scanner, body: { qrCodeHash: t.qrCodeHash, eventId: ids.event } });
  assert.equal(first.status, 200);
  assert.equal(first.body.valid, true);
  const second = await api('POST', '/api/checkin/verify', { token: tokens.scanner, body: { qrCodeHash: t.qrCodeHash } });
  assert.equal(second.status, 409);
  assert.equal(second.body.valid, false);
  assert.equal(second.body.checkedInAt, first.body.checkedInAt);
  assert.equal((await db.checkIn.findMany({})).length, 1);
});

test('check-in: concurrent scans of one ticket admit exactly one person', async () => {
  const t = await ticketFor();
  const rs = await Promise.all(Array.from({ length: 6 }, () => api('POST', '/api/checkin/verify', { token: tokens.scanner, body: { qrCodeHash: t.qrCodeHash } })));
  assert.equal(rs.filter((r) => r.status === 200).length, 1);
  assert.equal(rs.filter((r) => r.status === 409).length, 5);
  assert.equal((await db.checkIn.findMany({})).length, 1);
});

test('check-in: invalid / malformed / unknown QR and campaign-style tokens are never accepted', async () => {
  const v = (b, token = tokens.scanner) => api('POST', '/api/checkin/verify', { token, body: b });
  assert.equal((await v({})).status, 400);
  assert.equal((await v({ qrCodeHash: 123 })).status, 400);
  assert.equal((await v({ qrCodeHash: 'short' })).status, 400);
  assert.equal((await v({ qrCodeHash: "'; DROP TABLE tickets;--" })).status, 400);
  assert.equal((await v({ qrCodeHash: 'a'.repeat(64) })).status, 404);
  assert.equal((await v({ qrCodeHash: 'CAMPAIGN_PROMO_TOKEN_SPRING' })).status, 404);
  assert.equal((await v({ qrCodeHash: 'a'.repeat(64), eventId: 'x' })).status, 400);
});

test('check-in: legacy seeded token format (BF_QR_HASH_...) is accepted', async () => {
  const o = await db.order.create({ data: { userId: users.attendee.id, eventId: ids.event, totalAmount: 0, status: 'COMPLETED' } });
  await db.ticket.create({ data: { orderId: o.id, ticketTypeId: ids.free, attendeeName: 'Legacy', qrCodeHash: 'BF_QR_HASH_991823712893' } });
  assert.equal((await api('POST', '/api/checkin/verify', { token: tokens.scanner, body: { qrCodeHash: 'BF_QR_HASH_991823712893' } })).status, 200);
});

test('check-in: wrong event, other organizer, pending order and unauthenticated scans are rejected', async () => {
  const t = await ticketFor();
  assert.equal((await api('POST', '/api/checkin/verify', { token: tokens.scanner, body: { qrCodeHash: t.qrCodeHash, eventId: ids.otherEvent } })).status, 403);
  assert.equal((await api('POST', '/api/checkin/verify', { token: tokens.organizer2, body: { qrCodeHash: t.qrCodeHash } })).status, 403);
  assert.equal((await api('POST', '/api/checkin/verify', { body: { qrCodeHash: t.qrCodeHash } })).status, 401);
  const o = await db.order.create({ data: { userId: users.attendee.id, eventId: ids.event, totalAmount: 5, status: 'PENDING' } });
  await db.ticket.create({ data: { orderId: o.id, ticketTypeId: ids.free, attendeeName: 'P', qrCodeHash: 'p'.repeat(64) } });
  assert.equal((await api('POST', '/api/checkin/verify', { token: tokens.scanner, body: { qrCodeHash: 'p'.repeat(64) } })).status, 403);
  // владелец-организатор может сканировать сам
  assert.equal((await api('POST', '/api/checkin/verify', { token: tokens.organizer, body: { qrCodeHash: t.qrCodeHash } })).status, 200);
});

test('check-in: undo reverses an accidental check-in, allows re-scan, and rejects non-checked-in tickets', async () => {
  const t = await ticketFor();
  assert.equal((await api('POST', '/api/checkin/undo', { token: tokens.scanner, body: { ticketId: t.id } })).status, 409);
  await api('POST', '/api/checkin/verify', { token: tokens.scanner, body: { qrCodeHash: t.qrCodeHash } });
  assert.equal((await api('POST', '/api/checkin/undo', { token: tokens.organizer2, body: { ticketId: t.id } })).status, 403);
  const u = await api('POST', '/api/checkin/undo', { token: tokens.scanner, body: { qrCodeHash: t.qrCodeHash } });
  assert.equal(u.status, 200);
  assert.equal(u.body.ticket.status, 'VALID');
  assert.equal((await api('POST', '/api/checkin/verify', { token: tokens.scanner, body: { qrCodeHash: t.qrCodeHash } })).status, 200);
  assert.equal((await api('POST', '/api/checkin/undo', { token: tokens.scanner, body: { ticketId: 9999 } })).status, 404);
  assert.equal((await api('POST', '/api/checkin/undo', { token: tokens.scanner, body: {} })).status, 400);
});

test('check-in: search by name + manual check-in + live stats', async () => {
  await ticketFor(ids.free, tokens.attendee, ['Aigerim Nurova']);
  await ticketFor(ids.paid, tokens.attendee2, ['Bauyrzhan Sarsen']);
  const s = await api('GET', `/api/checkin/search/${ids.event}?q=aiger`, { token: tokens.scanner });
  assert.equal(s.body.results.length, 1);
  assert.equal(s.body.results[0].status, 'VALID');
  assert.equal((await api('GET', `/api/checkin/search/${ids.event}?q=a`, { token: tokens.scanner })).status, 400);
  assert.equal((await api('GET', `/api/checkin/search/${ids.event}?q=zzzz`, { token: tokens.scanner })).body.results.length, 0);

  const m = await api('POST', '/api/checkin/manual', { token: tokens.scanner, body: { ticketId: s.body.results[0].ticketId } });
  assert.equal(m.status, 200);
  assert.equal((await api('POST', '/api/checkin/manual', { token: tokens.scanner, body: { ticketId: s.body.results[0].ticketId } })).status, 409);
  assert.equal((await api('POST', '/api/checkin/manual', { token: tokens.scanner, body: { ticketId: 'x' } })).status, 400);

  const st = await api('GET', `/api/checkin/stats/${ids.event}`, { token: tokens.scanner });
  assert.deepEqual([st.body.registered, st.body.checkedIn, st.body.remaining, st.body.checkInPercent], [2, 1, 1, 50]);
  assert.equal((await api('GET', `/api/checkin/stats/${ids.event}`, { token: tokens.organizer2 })).status, 403);
  assert.equal((await api('GET', '/api/checkin/stats/9999', { token: tokens.scanner })).status, 404);
});

test('check-in: scanner event list (organizer sees own, event admin sees published)', async () => {
  const org = await api('GET', '/api/checkin/events', { token: tokens.organizer });
  assert.deepEqual(org.body.map((e) => e.title).sort(), ['Draft Event', 'Main Event']);
  const adm = await api('GET', '/api/checkin/events', { token: tokens.scanner });
  assert.deepEqual(adm.body.map((e) => e.title).sort(), ['Main Event', 'Other Organizer Event']);
});

// ---------------------------------------------------------------- OFFLINE
test('offline: manifest exposes SHA-256 of QR (never the raw QR), is no-store and event-scoped', async () => {
  const t = await ticketFor();
  const r = await api('GET', `/api/checkin/manifest/${ids.event}`, { token: tokens.scanner, raw: true });
  assert.equal(r.status, 200);
  assert.equal(r.headers.get('cache-control'), 'no-store');
  const body = await r.json();
  assert.equal(body.tickets.length, 1);
  assert.equal(body.tickets[0].h, sha256(t.qrCodeHash));
  assert.ok(!JSON.stringify(body).includes(t.qrCodeHash));
  assert.equal((await api('GET', `/api/checkin/manifest/${ids.event}`, { token: tokens.organizer2 })).status, 403);
  assert.equal((await api('GET', '/api/checkin/manifest/abc', { token: tokens.scanner })).status, 400);
  assert.equal((await api('GET', '/api/checkin/manifest/9999', { token: tokens.scanner })).status, 404);
});

test('offline sync: batch of queued scans is applied, preserving the offline scan time', async () => {
  const [a, b] = [await ticketFor(), await ticketFor(ids.free, tokens.attendee2)];
  const when = new Date(Date.now() - 3600 * 1000).toISOString();
  const r = await api('POST', '/api/checkin/sync', { token: tokens.scanner, body: { eventId: ids.event, scans: [{ qrCodeHash: a.qrCodeHash, scannedAt: when }, { qrCodeHash: b.qrCodeHash, scannedAt: when }] } });
  assert.equal(r.status, 200);
  assert.deepEqual(r.body.results.map((x) => x.status), ['CHECKED_IN', 'CHECKED_IN']);
  assert.equal(new Date(r.body.results[0].checkedInAt).toISOString(), when);
  assert.equal(r.body.summary.CHECKED_IN, 2);
});

test('offline sync: resending the same batch is idempotent; two devices scanning the same ticket -> second is ALREADY_CHECKED_IN', async () => {
  const t = await ticketFor();
  const body = { eventId: ids.event, scans: [{ qrCodeHash: t.qrCodeHash, scannedAt: new Date().toISOString() }] };
  assert.equal((await api('POST', '/api/checkin/sync', { token: tokens.scanner, body })).body.results[0].status, 'CHECKED_IN');
  assert.equal((await api('POST', '/api/checkin/sync', { token: tokens.scanner, body })).body.results[0].status, 'ALREADY_CHECKED_IN');
  assert.equal((await db.checkIn.findMany({})).length, 1);
});

test('offline sync: mixed batch reports per-scan REJECTED reasons without failing the batch', async () => {
  const good = await ticketFor();
  const other = await db.order.create({ data: { userId: users.attendee.id, eventId: ids.otherEvent, totalAmount: 0, status: 'COMPLETED' } });
  const ot = await db.ticketType.create({ data: { eventId: ids.otherEvent, name: 'F', totalQuantity: 1, remainingQuantity: 1 } });
  await db.ticket.create({ data: { orderId: other.id, ticketTypeId: ot.id, attendeeName: 'Z', qrCodeHash: 'z'.repeat(64) } });
  const r = await api('POST', '/api/checkin/sync', { token: tokens.scanner, body: { eventId: ids.event, scans: [
    { qrCodeHash: good.qrCodeHash }, { qrCodeHash: 'b'.repeat(64) }, { qrCodeHash: 'bad!' }, { qrCodeHash: 'z'.repeat(64) }, null,
  ] } });
  assert.equal(r.status, 200);
  assert.deepEqual(r.body.results.map((x) => x.status), ['CHECKED_IN', 'REJECTED', 'REJECTED', 'REJECTED', 'REJECTED']);
  assert.match(r.body.results[3].reason, /different event/);
});

test('offline sync: absurd timestamps (future / older than 7 days / garbage) fall back to server time', async () => {
  const mk = async (n) => (await ticketFor(ids.free, n % 2 ? tokens.attendee : tokens.attendee2));
  const [f, o, g] = [await mk(1), await mk(2), await mk(3)];
  const before = Date.now() - 1000;
  const r = await api('POST', '/api/checkin/sync', { token: tokens.scanner, body: { eventId: ids.event, scans: [
    { qrCodeHash: f.qrCodeHash, scannedAt: new Date(Date.now() + 5 * DAY).toISOString() },
    { qrCodeHash: o.qrCodeHash, scannedAt: new Date(Date.now() - 30 * DAY).toISOString() },
    { qrCodeHash: g.qrCodeHash, scannedAt: 'garbage' },
  ] } });
  for (const x of r.body.results) assert.ok(new Date(x.checkedInAt).getTime() >= before);
});

test('offline sync: request validation and authorization', async () => {
  const s = (b, token = tokens.scanner) => api('POST', '/api/checkin/sync', { token, body: b });
  assert.equal((await s({})).status, 400);
  assert.equal((await s({ eventId: ids.event, scans: [] })).status, 400);
  assert.equal((await s({ eventId: ids.event, scans: Array.from({ length: 201 }, () => ({ qrCodeHash: 'a'.repeat(64) })) })).status, 400);
  assert.equal((await s({ eventId: '1', scans: [{ qrCodeHash: 'a'.repeat(64) }] })).status, 400);
  assert.equal((await s({ eventId: ids.event, scans: [{ qrCodeHash: 'a'.repeat(64) }] }, tokens.attendee)).status, 403);
  assert.equal((await s({ eventId: ids.event, scans: [{ qrCodeHash: 'a'.repeat(64) }] }, null)).status, 401);
  // организатор другого события: каждый скан отклоняется
  const t = await ticketFor();
  const r = await s({ eventId: ids.event, scans: [{ qrCodeHash: t.qrCodeHash }] }, tokens.organizer2);
  assert.equal(r.body.results[0].status, 'REJECTED');
});

// ---------------------------------------------------------------- MOBILE ALIAS
test('mobile alias POST /api/tickets/check-in: VALID / ALREADY_CHECKED_IN / INVALID / CANCELLED, always HTTP 200', async () => {
  const t = await ticketFor(ids.free, tokens.attendee, ['Mobile Guest']);
  const call = (qrToken, token = tokens.scanner) => api('POST', '/api/tickets/check-in', { token, body: { qrToken } });

  const ok = await call(t.qrCodeHash);
  assert.equal(ok.status, 200);
  assert.equal(ok.body.status, 'VALID');
  assert.equal(ok.body.ticket.attendeeName, 'Mobile Guest');
  assert.equal(ok.body.ticket.eventName, 'Main Event');

  assert.equal((await call(t.qrCodeHash)).body.status, 'ALREADY_CHECKED_IN');
  assert.equal((await call('f'.repeat(64))).body.status, 'INVALID');
  assert.equal((await call('!!')).body.status, 'INVALID');

  const o = await order(tokens.attendee, [{ ticketTypeId: ids.paid, quantity: 1 }]);
  await api('POST', `/api/orders/${o.body.order.id}/refund`, { token: tokens.organizer });
  const refunded = await call(o.body.order.tickets[0].qrCodeHash);
  assert.equal(refunded.status, 200);
  assert.equal(refunded.body.status, 'CANCELLED');

  // чужой организатор получает настоящий 403, а не «неверный QR»
  const t2 = await ticketFor();
  assert.equal((await call(t2.qrCodeHash, tokens.organizer2)).status, 403);
});

test('health endpoint & CORS preflight', async () => {
  assert.equal((await api('GET', '/api/health')).body.status, 'ok');
  const r = await fetch(base + '/api/orders', { method: 'OPTIONS' });
  assert.equal(r.status, 204);
  assert.equal(r.headers.get('access-control-allow-origin'), '*');
});
