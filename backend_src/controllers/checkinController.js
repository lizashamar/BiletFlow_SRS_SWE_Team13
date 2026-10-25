const crypto = require('crypto');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { HttpError, handleError } = require('../utils/httpError');

const HASH_RE = /^[a-f0-9]{64}$/;
const MAX_SYNC_BATCH = 200;
const MAX_OFFLINE_AGE_MS = 7 * 24 * 60 * 60 * 1000;

const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');

const ticketInclude = {
  ticketType: { select: { name: true } },
  order: { select: { status: true, event: { select: { id: true, title: true, organizerId: true } } } },
};

// Организатор управляет только своими событиями (EVENT_ADMIN / PLATFORM_ADMIN — любыми)
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

// Общая логика для /verify и /sync. Бросает HttpError для невалидных билетов.
async function processScan(user, qrCodeHash, { eventId, scannedAt } = {}) {
  const ticket = await prisma.ticket.findUnique({ where: { qrCodeHash }, include: ticketInclude });
  if (!ticket) throw new HttpError(404, 'Ticket not found: invalid QR code');

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
  const created = await markCheckedIn(ticket.id, user.id, scannedAt);
  if (!created) {
    return { ...base, outcome: 'ALREADY_CHECKED_IN', checkedInAt: await firstCheckInAt(ticket.id) };
  }
  return { ...base, outcome: 'CHECKED_IN', checkedInAt: created.scannedAt };
}

// POST /api/checkin/verify  { qrCodeHash, eventId? }
exports.verifyTicket = async (req, res) => {
  try {
    const { qrCodeHash, eventId } = req.body || {};
    if (typeof qrCodeHash !== 'string' || !HASH_RE.test(qrCodeHash)) {
      throw new HttpError(400, 'qrCodeHash must be a 64-char hex string');
    }
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

// GET /api/checkin/manifest/:eventId
// Список билетов события для офлайн-кэша сканера. Вместо секретных QR-хэшей отдаём
// их SHA-256: украденный телефон не позволит подделать билеты, а сканер сверяет sha256(QR).
exports.getManifest = async (req, res) => {
  try {
    const eventId = Number(req.params.eventId);
    if (!Number.isInteger(eventId)) throw new HttpError(400, 'Invalid event id');

    const event = await prisma.event.findUnique({
      where: { id: eventId },
      select: { id: true, title: true, startTime: true, endTime: true, organizerId: true },
    });
    if (!event) throw new HttpError(404, 'Event not found');
    assertCanManageEvent(req.user, event);

    const tickets = await prisma.ticket.findMany({
      where: { order: { eventId, status: 'COMPLETED' } },
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
      if (typeof qrCodeHash !== 'string' || !HASH_RE.test(qrCodeHash)) {
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
    return res.json({ results });
  } catch (err) {
    return handleError(res, err);
  }
};
