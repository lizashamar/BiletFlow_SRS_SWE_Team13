const crypto = require('crypto');
const prisma = require('../db');
const { HttpError, handleError } = require('../utils/httpError');
const { audit } = require('../utils/audit');

// QR-токен: 64 hex (генерируется utils/qr.js), но допускаем и более ранние/сидовые значения
// вида BF_QR_HASH_123 — колонка qr_code_hash это VarChar(255). Формат проверяем, чтобы не
// гонять мусор в БД; подлинность определяет только точное совпадение в таблице tickets.
const QR_RE = /^[A-Za-z0-9_-]{8,255}$/;
const MAX_SYNC_BATCH = 200;
const MAX_OFFLINE_AGE_MS = 7 * 24 * 60 * 60 * 1000;

const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');
const isQr = (v) => typeof v === 'string' && QR_RE.test(v);

const ticketInclude = {
  ticketType: { select: { name: true } },
  order: { select: { status: true, event: { select: { id: true, title: true, organizerId: true } } } },
};

// Организатор управляет только своими событиями (EVENT_ADMIN / PLATFORM_ADMIN — любыми).
// ВАЖНО: в схеме БД нет таблицы staff_assignments, поэтому EVENT_ADMIN пока не ограничен
// «назначенными» событиями (SRS 4.8) — см. docs/known issues в отчёте.
function assertCanManageEvent(user, event) {
  if (user.role === 'ORGANIZER' && event.organizerId !== user.id) {
    throw new HttpError(403, 'You can only manage check-in for your own events');
  }
}

function assertTicketUsable(ticket) {
  if (ticket.order.status !== 'COMPLETED') {
    throw new HttpError(403, `Ticket is not valid (order ${ticket.order.status})`);
  }
  if (['CANCELLED', 'REFUNDED'].includes(ticket.status)) {
    throw new HttpError(403, `Ticket is not valid (${ticket.status})`);
  }
}

// Время офлайн-скана приходит с телефона: не доверяем слепо (будущее / слишком старое -> now)
function sanitizeScannedAt(value) {
  const now = Date.now();
  const t = value ? Date.parse(value) : NaN;
  if (Number.isNaN(t) || t > now + 60 * 1000 || t < now - MAX_OFFLINE_AGE_MS) return new Date(now);
  return new Date(t);
}

async function firstCheckInAt(ticketId) {
  const first = await prisma.checkIn.findFirst({ where: { ticketId }, orderBy: { scannedAt: 'asc' } });
  return first ? first.scannedAt : null;
}

// Атомарный переход VALID -> CHECKED_IN. Возвращает запись CheckIn или null, если билет уже использован.
// Если два сканера бьют в один билет одновременно, count=1 получит только один.
function markCheckedIn(ticketId, scannerId, scannedAt) {
  return prisma.$transaction(async (tx) => {
    const updated = await tx.ticket.updateMany({
      where: { id: ticketId, status: 'VALID' },
      data: { status: 'CHECKED_IN' },
    });
    if (updated.count === 0) return null;
    return tx.checkIn.create({ data: { ticketId, scannedBy: scannerId, scannedAt } });
  });
}

// Общая логика для /verify, /sync, /manual и мобильного алиаса. Бросает HttpError для невалидных билетов.
async function processTicket(user, ticket, { eventId, scannedAt } = {}) {
  const event = ticket.order.event;
  assertCanManageEvent(user, event);
  if (eventId !== undefined && event.id !== eventId) {
    throw new HttpError(403, 'Ticket belongs to a different event');
  }
  assertTicketUsable(ticket);

  const base = {
    ticket: { id: ticket.id, attendeeName: ticket.attendeeName, ticketType: ticket.ticketType.name },
    event: { id: event.id, title: event.title },
  };

  if (ticket.status === 'CHECKED_IN') {
    return { ...base, outcome: 'ALREADY_CHECKED_IN', checkedInAt: await firstCheckInAt(ticket.id) };
  }
  const created = await markCheckedIn(ticket.id, user.id, scannedAt || new Date());
  if (!created) {
    return { ...base, outcome: 'ALREADY_CHECKED_IN', checkedInAt: await firstCheckInAt(ticket.id) };
  }
  audit('checkin.record', user, { ticketId: ticket.id, eventId: event.id });
  return { ...base, outcome: 'CHECKED_IN', checkedInAt: created.scannedAt };
}

async function processScan(user, qrCodeHash, opts) {
  const ticket = await prisma.ticket.findUnique({ where: { qrCodeHash }, include: ticketInclude });
  if (!ticket) throw new HttpError(404, 'Ticket not found: invalid QR code');
  return processTicket(user, ticket, opts);
}

function parseEventId(raw) {
  const id = Number(raw);
  if (!Number.isInteger(id) || id < 1) throw new HttpError(400, 'Invalid event id');
  return id;
}

async function loadManageableEvent(user, raw) {
  const event = await prisma.event.findUnique({
    where: { id: parseEventId(raw) },
    select: { id: true, title: true, startTime: true, endTime: true, organizerId: true },
  });
  if (!event) throw new HttpError(404, 'Event not found');
  assertCanManageEvent(user, event);
  return event;
}

// POST /api/checkin/verify  { qrCodeHash, eventId? }
exports.verifyTicket = async (req, res) => {
  try {
    const { qrCodeHash, eventId } = req.body || {};
    if (!isQr(qrCodeHash)) throw new HttpError(400, 'qrCodeHash must be a valid QR token string');
    if (eventId !== undefined && !Number.isInteger(eventId)) {
      throw new HttpError(400, 'eventId must be an integer');
    }

    const r = await processScan(req.user, qrCodeHash, { eventId });

    if (r.outcome === 'ALREADY_CHECKED_IN') {
      return res.status(409).json({
        valid: false,
        error: 'Ticket already checked in',
        checkedInAt: r.checkedInAt,
        ticket: r.ticket,
      });
    }
    return res.json({
      valid: true,
      message: 'Check-in successful',
      checkedInAt: r.checkedInAt,
      ticket: r.ticket,
      event: r.event,
    });
  } catch (err) {
    return handleError(res, err);
  }
};

// POST /api/tickets/check-in  { qrToken, eventId? }
// Совместимость с мобильным приложением (mobile/src/services/checkIn.ts): ответ всегда 200
// с полем status = VALID | INVALID | ALREADY_CHECKED_IN | CANCELLED, т.к. клиент считает
// любой не-2xx ответ сетевой ошибкой и уходит в офлайн-режим.
exports.mobileCheckIn = async (req, res) => {
  try {
    const { qrToken, eventId } = req.body || {};
    if (!isQr(qrToken)) {
      return res.json({ status: 'INVALID', message: 'Invalid QR code' });
    }
    if (eventId !== undefined && !Number.isInteger(eventId)) throw new HttpError(400, 'eventId must be an integer');

    try {
      const r = await processScan(req.user, qrToken, { eventId });
      const ticket = { id: r.ticket.id, attendeeName: r.ticket.attendeeName, eventName: r.event.title };
      if (r.outcome === 'ALREADY_CHECKED_IN') {
        return res.json({ status: 'ALREADY_CHECKED_IN', message: 'Ticket already checked in', ticket });
      }
      return res.json({ status: 'VALID', message: 'Check-in successful', ticket });
    } catch (err) {
      if (!(err instanceof HttpError)) throw err;
      if (err.status === 404) return res.json({ status: 'INVALID', message: 'Invalid QR code' });
      // чужое событие / отменён / возвращён — билет существует, но войти нельзя
      if (err.status === 403 && /different event|not valid/.test(err.message)) {
        return res.json({ status: 'CANCELLED', message: err.message });
      }
      throw err; // 403 на чужое мероприятие организатора и т.п.
    }
  } catch (err) {
    return handleError(res, err);
  }
};

// GET /api/checkin/events — события, доступные сканеру (SRS 4.8: «выбор события»)
exports.getScannerEvents = async (req, res) => {
  try {
    const where = req.user.role === 'ORGANIZER' ? { organizerId: req.user.id } : { isPublished: true };
    const events = await prisma.event.findMany({
      where,
      orderBy: { startTime: 'asc' },
      select: { id: true, title: true, venueName: true, startTime: true, endTime: true },
    });
    return res.json(events);
  } catch (err) {
    return handleError(res, err);
  }
};

// GET /api/checkin/stats/:eventId — зарегистрировано / отмечено (SRS 4.8)
exports.getStats = async (req, res) => {
  try {
    const event = await loadManageableEvent(req.user, req.params.eventId);
    const base = { order: { eventId: event.id, status: 'COMPLETED' } };
    const [checkedIn, valid, cancelled] = await Promise.all([
      prisma.ticket.count({ where: { ...base, status: 'CHECKED_IN' } }),
      prisma.ticket.count({ where: { ...base, status: 'VALID' } }),
      prisma.ticket.count({ where: { ...base, status: { in: ['CANCELLED', 'REFUNDED'] } } }),
    ]);
    const registered = checkedIn + valid;
    return res.json({
      event: { id: event.id, title: event.title },
      registered,
      checkedIn,
      remaining: valid,
      invalidated: cancelled,
      checkInPercent: registered ? Math.round((checkedIn / registered) * 1000) / 10 : 0,
    });
  } catch (err) {
    return handleError(res, err);
  }
};

// GET /api/checkin/search/:eventId?q=name — ручной поиск гостя (SRS 4.8)
exports.searchAttendees = async (req, res) => {
  try {
    const event = await loadManageableEvent(req.user, req.params.eventId);
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    if (q.length < 2) throw new HttpError(400, 'q must be at least 2 characters');
    const tickets = await prisma.ticket.findMany({
      where: {
        order: { eventId: event.id, status: 'COMPLETED' },
        attendeeName: { contains: q, mode: 'insensitive' },
      },
      orderBy: { attendeeName: 'asc' },
      take: 25,
      select: { id: true, attendeeName: true, status: true, ticketType: { select: { name: true } } },
    });
    return res.json({
      results: tickets.map((t) => ({ ticketId: t.id, attendeeName: t.attendeeName, ticketType: t.ticketType.name, status: t.status })),
    });
  } catch (err) {
    return handleError(res, err);
  }
};

async function loadTicketById(ticketId) {
  if (!Number.isInteger(ticketId)) throw new HttpError(400, 'ticketId must be an integer');
  const ticket = await prisma.ticket.findUnique({ where: { id: ticketId }, include: ticketInclude });
  if (!ticket) throw new HttpError(404, 'Ticket not found');
  return ticket;
}

// POST /api/checkin/manual  { ticketId, eventId? } — отметка вручную после поиска
exports.manualCheckIn = async (req, res) => {
  try {
    const { ticketId, eventId } = req.body || {};
    const ticket = await loadTicketById(ticketId);
    const r = await processTicket(req.user, ticket, { eventId });
    if (r.outcome === 'ALREADY_CHECKED_IN') {
      return res.status(409).json({ valid: false, error: 'Ticket already checked in', checkedInAt: r.checkedInAt, ticket: r.ticket });
    }
    return res.json({ valid: true, message: 'Check-in successful', checkedInAt: r.checkedInAt, ticket: r.ticket, event: r.event });
  } catch (err) {
    return handleError(res, err);
  }
};

// POST /api/checkin/undo  { ticketId } | { qrCodeHash } — отмена ошибочной отметки (SRS 4.8, UC4)
exports.undoCheckIn = async (req, res) => {
  try {
    const { ticketId, qrCodeHash } = req.body || {};
    let ticket;
    if (qrCodeHash !== undefined) {
      if (!isQr(qrCodeHash)) throw new HttpError(400, 'qrCodeHash must be a valid QR token string');
      ticket = await prisma.ticket.findUnique({ where: { qrCodeHash }, include: ticketInclude });
      if (!ticket) throw new HttpError(404, 'Ticket not found');
    } else {
      ticket = await loadTicketById(ticketId);
    }
    assertCanManageEvent(req.user, ticket.order.event);

    const reverted = await prisma.$transaction(async (tx) => {
      const upd = await tx.ticket.updateMany({ where: { id: ticket.id, status: 'CHECKED_IN' }, data: { status: 'VALID' } });
      if (upd.count === 0) return false;
      // Записи check_ins удаляем, иначе «время первого входа» после повторного сканирования будет неверным.
      // Факт отмены сохраняется в аудит-логе.
      await tx.checkIn.deleteMany({ where: { ticketId: ticket.id } });
      return true;
    });
    if (!reverted) throw new HttpError(409, 'Ticket is not checked in');

    audit('checkin.undo', req.user, { ticketId: ticket.id, eventId: ticket.order.event.id });
    return res.json({ message: 'Check-in reversed', ticket: { id: ticket.id, attendeeName: ticket.attendeeName, status: 'VALID' } });
  } catch (err) {
    return handleError(res, err);
  }
};

// GET /api/checkin/manifest/:eventId
// Список билетов события для офлайн-кэша сканера. Вместо секретных QR-хэшей отдаём
// их SHA-256: украденный телефон не позволит подделать билеты, а сканер сверяет sha256(QR).
exports.getManifest = async (req, res) => {
  try {
    const event = await loadManageableEvent(req.user, req.params.eventId);

    const tickets = await prisma.ticket.findMany({
      where: { order: { eventId: event.id, status: 'COMPLETED' } },
      select: { qrCodeHash: true, status: true, attendeeName: true, ticketType: { select: { name: true } } },
    });

    res.set('Cache-Control', 'no-store');
    return res.json({
      event: { id: event.id, title: event.title, startTime: event.startTime },
      generatedAt: new Date().toISOString(),
      tickets: tickets.map((t) => ({
        h: sha256(t.qrCodeHash),
        s: t.status,
        n: t.attendeeName,
        t: t.ticketType.name,
      })),
    });
  } catch (err) {
    return handleError(res, err);
  }
};

// POST /api/checkin/sync  { eventId, scans: [{ qrCodeHash, scannedAt }] }
// Выгрузка сканов, сделанных офлайн. Каждый скан проходит ту же атомарную проверку,
// поэтому двойной проход на двух офлайн-устройствах отсекается на втором синке.
// Повторная отправка той же пачки безопасна (идемпотентно): уже отмеченные -> ALREADY_CHECKED_IN.
exports.syncCheckins = async (req, res) => {
  try {
    const { eventId, scans } = req.body || {};
    if (!Number.isInteger(eventId)) throw new HttpError(400, 'eventId must be an integer');
    if (!Array.isArray(scans) || scans.length === 0 || scans.length > MAX_SYNC_BATCH) {
      throw new HttpError(400, `scans must be an array of 1..${MAX_SYNC_BATCH} items`);
    }

    const results = [];
    for (const scan of scans) {
      const qrCodeHash = scan && scan.qrCodeHash;
      if (!isQr(qrCodeHash)) {
        results.push({ qrCodeHash, status: 'REJECTED', reason: 'Invalid QR format' });
        continue;
      }
      try {
        const r = await processScan(req.user, qrCodeHash, {
          eventId,
          scannedAt: sanitizeScannedAt(scan.scannedAt),
        });
        results.push({ qrCodeHash, status: r.outcome, checkedInAt: r.checkedInAt });
      } catch (err) {
        if (err instanceof HttpError) {
          results.push({ qrCodeHash, status: 'REJECTED', reason: err.message });
        } else {
          console.error(err);
          // ERROR = временная ошибка сервера, клиент оставит скан в очереди
          results.push({ qrCodeHash, status: 'ERROR', reason: 'Server error' });
        }
      }
    }
    const summary = results.reduce((acc, r) => ({ ...acc, [r.status]: (acc[r.status] || 0) + 1 }), {});
    return res.json({ results, summary });
  } catch (err) {
    return handleError(res, err);
  }
};
