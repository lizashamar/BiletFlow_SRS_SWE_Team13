const prisma = require('../db');
const { HttpError, handleError } = require('../utils/httpError');
const { audit } = require('../utils/audit');
const { buildEventIcs } = require('../utils/ics');

const MAX_TICKET_TYPES = 20;
const toPrice = (v) => Number(v);
const round2 = (n) => Math.round(n * 100) / 100;

function parseId(raw, what = 'event') {
  const id = Number(raw);
  if (!Number.isInteger(id) || id < 1) throw new HttpError(400, `Invalid ${what} id`);
  return id;
}

function parseDate(v, field) {
  const t = typeof v === 'string' ? Date.parse(v) : NaN;
  if (Number.isNaN(t)) throw new HttpError(400, `${field} must be a valid ISO date`);
  return new Date(t);
}

const reqString = (v, field, max) => {
  if (typeof v !== 'string' || !v.trim() || v.length > max) {
    throw new HttpError(400, `${field} is required (max ${max} chars)`);
  }
  return v.trim();
};

// Организатор управляет только своими событиями; PLATFORM_ADMIN — любыми.
function assertOwner(user, event) {
  if (user.role !== 'PLATFORM_ADMIN' && event.organizerId !== user.id) {
    throw new HttpError(403, 'You can only manage your own events');
  }
}

// SRS 4.16: Upcoming / Active / Completed (статуса Cancelled в схеме нет)
function lifecycle(e, now = new Date()) {
  if (e.endTime < now) return 'COMPLETED';
  if (e.startTime <= now) return 'ACTIVE';
  return 'UPCOMING';
}

function serializeEvent(e) {
  const ticketTypes = (e.ticketTypes || []).map((t) => ({
    id: t.id,
    name: t.name,
    price: toPrice(t.price),
    isPaid: t.isPaid,
    totalQuantity: t.totalQuantity,
    remainingQuantity: t.remainingQuantity,
  }));
  const prices = ticketTypes.map((t) => t.price);
  return {
    id: e.id,
    organizerId: e.organizerId,
    title: e.title,
    description: e.description,
    venueName: e.venueName,
    venueAddress: e.venueAddress,
    startTime: e.startTime,
    endTime: e.endTime,
    capacity: e.capacity,
    isPublished: e.isPublished,
    paidSalesActive: e.paidSalesActive,
    status: lifecycle(e),
    ticketTypes,
    // поля обратной совместимости со старым моком ({ id, title, price, date })
    date: e.startTime,
    location: e.venueName,
    price: prices.length ? Math.min(...prices) : 0, // "от" — минимальная цена
  };
}

// GET /api/events?q=&upcoming=true — опубликованные события вместе с типами билетов
const getEvents = async (req, res) => {
  try {
    const where = { isPublished: true };
    if (typeof req.query.q === 'string' && req.query.q.trim()) {
      where.title = { contains: req.query.q.trim(), mode: 'insensitive' };
    }
    if (req.query.upcoming === 'true') where.endTime = { gte: new Date() };
    const events = await prisma.event.findMany({
      where,
      orderBy: { startTime: 'asc' },
      include: { ticketTypes: { orderBy: { price: 'asc' } } },
    });
    res.json(events.map(serializeEvent));
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to load events' });
  }
};

// Публичный доступ только к опубликованным; черновик видит владелец / PLATFORM_ADMIN.
async function loadVisibleEvent(id, user) {
  const event = await prisma.event.findUnique({
    where: { id },
    include: { ticketTypes: { orderBy: { price: 'asc' } } },
  });
  const canSeeDraft = !!user && !!event && (user.role === 'PLATFORM_ADMIN' || user.id === event.organizerId);
  if (!event || (!event.isPublished && !canSeeDraft)) throw new HttpError(404, 'Event not found');
  return event;
}

// GET /api/events/:id (optionalAuth)
const getEventById = async (req, res) => {
  try {
    const event = await loadVisibleEvent(parseId(req.params.id), req.user);
    res.json(serializeEvent(event));
  } catch (err) {
    handleError(res, err);
  }
};

function parseTicketTypes(list) {
  if (!Array.isArray(list) || list.length === 0 || list.length > MAX_TICKET_TYPES) {
    throw new HttpError(400, `ticketTypes must be an array of 1..${MAX_TICKET_TYPES} items`);
  }
  return list.map((t, i) => {
    const name = reqString(t && t.name, `ticketTypes[${i}].name`, 100);
    const price = t.price === undefined ? 0 : Number(t.price);
    if (!Number.isFinite(price) || price < 0 || price > 99999999) {
      throw new HttpError(400, `ticketTypes[${i}].price must be a number >= 0`);
    }
    if (!Number.isInteger(t.totalQuantity) || t.totalQuantity < 1) {
      throw new HttpError(400, `ticketTypes[${i}].totalQuantity must be an integer >= 1`);
    }
    return { name, price: round2(price), totalQuantity: t.totalQuantity };
  });
}

// POST /api/events — создаёт событие (всегда черновик) вместе с типами билетов
const createEvent = async (req, res) => {
  try {
    const b = req.body || {};
    const title = reqString(b.title, 'title', 255);
    const venueName = reqString(b.venueName, 'venueName', 255);
    const venueAddress = reqString(b.venueAddress, 'venueAddress', 255);
    const startTime = parseDate(b.startTime, 'startTime');
    const endTime = parseDate(b.endTime, 'endTime');
    if (endTime <= startTime) throw new HttpError(400, 'endTime must be after startTime');
    if (!Number.isInteger(b.capacity) || b.capacity < 1) throw new HttpError(400, 'capacity must be an integer >= 1');
    const types = parseTicketTypes(b.ticketTypes);
    const totalTickets = types.reduce((s, t) => s + t.totalQuantity, 0);
    if (totalTickets > b.capacity) {
      throw new HttpError(400, `Ticket quantities (${totalTickets}) exceed event capacity (${b.capacity})`);
    }
    if (b.description !== undefined && b.description !== null && typeof b.description !== 'string') {
      throw new HttpError(400, 'description must be a string');
    }

    const event = await prisma.event.create({
      data: {
        organizerId: req.user.id,
        title,
        description: b.description || null,
        venueName,
        venueAddress,
        startTime,
        endTime,
        capacity: b.capacity,
        isPublished: false,
        paidSalesActive: false,
        ticketTypes: {
          create: types.map((t) => ({
            name: t.name,
            price: t.price,
            isPaid: t.price > 0,
            totalQuantity: t.totalQuantity,
            remainingQuantity: t.totalQuantity,
          })),
        },
      },
      include: { ticketTypes: true },
    });
    audit('event.create', req.user, { eventId: event.id });
    res.status(201).json({ message: 'Event created', event: serializeEvent(event) });
  } catch (err) {
    handleError(res, err);
  }
};

// GET /api/events/mine?status=UPCOMING|ACTIVE|COMPLETED
const getMyEvents = async (req, res) => {
  try {
    const where = req.user.role === 'PLATFORM_ADMIN' ? {} : { organizerId: req.user.id };
    const events = await prisma.event.findMany({
      where,
      orderBy: { startTime: 'desc' },
      include: { ticketTypes: true },
    });
    let out = events.map(serializeEvent);
    if (req.query.status) {
      const wanted = String(req.query.status).toUpperCase();
      if (!['UPCOMING', 'ACTIVE', 'COMPLETED'].includes(wanted)) throw new HttpError(400, 'Invalid status filter');
      out = out.filter((e) => e.status === wanted);
    }
    res.json(out);
  } catch (err) {
    handleError(res, err);
  }
};

async function loadOwnedEvent(req) {
  const event = await prisma.event.findUnique({
    where: { id: parseId(req.params.id) },
    include: { ticketTypes: true },
  });
  if (!event) throw new HttpError(404, 'Event not found');
  assertOwner(req.user, event);
  return event;
}

// PATCH /api/events/:id — редактирование и публикация/снятие с публикации
const updateEvent = async (req, res) => {
  try {
    const event = await loadOwnedEvent(req);
    const b = req.body || {};
    const data = {};

    if (b.title !== undefined) data.title = reqString(b.title, 'title', 255);
    if (b.venueName !== undefined) data.venueName = reqString(b.venueName, 'venueName', 255);
    if (b.venueAddress !== undefined) data.venueAddress = reqString(b.venueAddress, 'venueAddress', 255);
    if (b.description !== undefined) {
      if (b.description !== null && typeof b.description !== 'string') throw new HttpError(400, 'description must be a string');
      data.description = b.description;
    }
    if (b.startTime !== undefined) data.startTime = parseDate(b.startTime, 'startTime');
    if (b.endTime !== undefined) data.endTime = parseDate(b.endTime, 'endTime');
    if ((data.endTime || event.endTime) <= (data.startTime || event.startTime)) {
      throw new HttpError(400, 'endTime must be after startTime');
    }
    if (b.capacity !== undefined) {
      const allocated = event.ticketTypes.reduce((s, t) => s + t.totalQuantity, 0);
      const min = Math.max(1, allocated);
      if (!Number.isInteger(b.capacity) || b.capacity < min) {
        throw new HttpError(400, `capacity must be an integer >= ${min} (tickets already allocated)`);
      }
      data.capacity = b.capacity;
    }
    if (b.isPublished !== undefined) {
      if (typeof b.isPublished !== 'boolean') throw new HttpError(400, 'isPublished must be a boolean');
      if (b.isPublished && event.ticketTypes.length === 0) {
        throw new HttpError(400, 'Cannot publish an event without ticket types');
      }
      data.isPublished = b.isPublished;
    }
    if (Object.keys(data).length === 0) throw new HttpError(400, 'No updatable fields supplied');

    const updated = await prisma.event.update({ where: { id: event.id }, data, include: { ticketTypes: true } });
    if (data.isPublished !== undefined && data.isPublished !== event.isPublished) {
      audit(data.isPublished ? 'event.publish' : 'event.unpublish', req.user, { eventId: event.id });
    } else {
      audit('event.update', req.user, { eventId: event.id, fields: Object.keys(data) });
    }
    res.json({ message: 'Event updated', event: serializeEvent(updated) });
  } catch (err) {
    handleError(res, err);
  }
};

// POST /api/events/:id/activate-paid-sales { acceptTerms, payoutAccount }
// SRS 4.5: ДЕМО-симуляция (без реальных платежей): проверяем чек-лист и включаем платные продажи.
const activatePaidSales = async (req, res) => {
  try {
    const event = await loadOwnedEvent(req);
    if (event.paidSalesActive) throw new HttpError(409, 'Paid sales are already active for this event');

    const { acceptTerms, payoutAccount } = req.body || {};
    const checklist = {
      hasPaidTicketType: event.ticketTypes.some((t) => t.isPaid || toPrice(t.price) > 0),
      payoutAccountProvided: typeof payoutAccount === 'string' && payoutAccount.trim().length >= 8,
      termsAccepted: acceptTerms === true,
    };
    const missing = Object.keys(checklist).filter((k) => !checklist[k]);
    if (missing.length) {
      return res.status(400).json({ error: 'Activation checklist incomplete', checklist, missing });
    }

    const updated = await prisma.event.update({
      where: { id: event.id },
      data: { paidSalesActive: true },
      include: { ticketTypes: true },
    });
    audit('event.activate_paid_sales', req.user, { eventId: event.id, simulated: true });
    res.json({
      message: 'Paid sales activated (SIMULATION - no real money was charged)',
      simulated: true,
      event: serializeEvent(updated),
    });
  } catch (err) {
    handleError(res, err);
  }
};

// GET /api/events/:id/stats — аналитика организатора (SRS 4.15) по данным БД
const getEventStats = async (req, res) => {
  try {
    const event = await loadOwnedEvent(req);
    const [tickets, orders] = await Promise.all([
      prisma.ticket.findMany({
        where: { order: { eventId: event.id, status: 'COMPLETED' } },
        select: { status: true, ticketTypeId: true },
      }),
      prisma.order.findMany({
        where: { eventId: event.id, status: { in: ['COMPLETED', 'REFUNDED'] } },
        select: { totalAmount: true, status: true, createdAt: true },
      }),
    ]);

    const active = tickets.filter((t) => ['VALID', 'CHECKED_IN'].includes(t.status));
    const checkedIn = tickets.filter((t) => t.status === 'CHECKED_IN').length;
    const totalCapacity = event.ticketTypes.reduce((s, t) => s + t.totalQuantity, 0);
    const remaining = event.ticketTypes.reduce((s, t) => s + t.remainingQuantity, 0);

    const byTicketType = event.ticketTypes.map((t) => {
      const sold = active.filter((x) => x.ticketTypeId === t.id).length;
      return {
        id: t.id,
        name: t.name,
        price: toPrice(t.price),
        total: t.totalQuantity,
        remaining: t.remainingQuantity,
        sold,
        revenue: round2(sold * toPrice(t.price)),
      };
    });

    const sum = (arr) => round2(arr.reduce((s, o) => s + Number(o.totalAmount), 0));
    const completed = orders.filter((o) => o.status === 'COMPLETED');
    const refunded = orders.filter((o) => o.status === 'REFUNDED');

    const perDay = new Map();
    for (const o of orders) {
      const day = o.createdAt.toISOString().slice(0, 10);
      const d = perDay.get(day) || { date: day, orders: 0, revenue: 0 };
      d.orders += 1;
      d.revenue = round2(d.revenue + Number(o.totalAmount));
      perDay.set(day, d);
    }

    res.json({
      event: { id: event.id, title: event.title, status: lifecycle(event) },
      capacity: {
        eventCapacity: event.capacity,
        ticketCapacity: totalCapacity,
        sold: active.length,
        remaining,
        percentSold: totalCapacity ? Math.round((active.length / totalCapacity) * 1000) / 10 : 0,
      },
      revenue: {
        grossSales: round2(sum(completed) + sum(refunded)),
        refunds: sum(refunded),
        netRevenue: sum(completed),
        currency: 'KZT',
        simulated: true,
      },
      byTicketType,
      salesOverTime: [...perDay.values()].sort((a, b) => a.date.localeCompare(b.date)),
      attendance: {
        checkedIn,
        absent: active.length - checkedIn,
        checkInPercent: active.length ? Math.round((checkedIn / active.length) * 1000) / 10 : 0,
      },
    });
  } catch (err) {
    handleError(res, err);
  }
};

// GET /api/events/:id/attendees?status=VALID|CHECKED_IN|CANCELLED|REFUNDED
const getAttendees = async (req, res) => {
  try {
    const event = await loadOwnedEvent(req);
    const where = { order: { eventId: event.id } };
    if (req.query.status) {
      if (!['VALID', 'CHECKED_IN', 'CANCELLED', 'REFUNDED'].includes(req.query.status)) {
        throw new HttpError(400, 'Invalid status filter');
      }
      where.status = req.query.status;
    }
    const tickets = await prisma.ticket.findMany({
      where,
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        attendeeName: true,
        status: true,
        createdAt: true,
        ticketType: { select: { name: true } },
        order: { select: { id: true, status: true, user: { select: { email: true } } } },
      },
    });
    res.json({
      event: { id: event.id, title: event.title },
      total: tickets.length,
      attendees: tickets.map((t) => ({
        ticketId: t.id,
        attendeeName: t.attendeeName,
        ticketType: t.ticketType.name,
        status: t.status,
        orderId: t.order.id,
        orderStatus: t.order.status,
        buyerEmail: t.order.user.email,
        registeredAt: t.createdAt,
      })),
    });
  } catch (err) {
    handleError(res, err);
  }
};

// GET /api/events/:id/calendar.ics — экспорт в iCalendar (SRS 4.11)
const getEventCalendar = async (req, res) => {
  try {
    const event = await loadVisibleEvent(parseId(req.params.id), req.user);
    res.set('Content-Type', 'text/calendar; charset=utf-8');
    res.set('Content-Disposition', `attachment; filename="event-${event.id}.ics"`);
    res.send(buildEventIcs(event, { baseUrl: process.env.PUBLIC_URL || '' }));
  } catch (err) {
    handleError(res, err);
  }
};

module.exports = {
  getEvents,
  getEventById,
  createEvent,
  getMyEvents,
  updateEvent,
  activatePaidSales,
  getEventStats,
  getAttendees,
  getEventCalendar,
};
