const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { HttpError, handleError } = require('../utils/httpError');

// POST /api/checkin/verify  { qrCodeHash }
// Доступ: ORGANIZER (только свои события), EVENT_ADMIN, PLATFORM_ADMIN
exports.verifyTicket = async (req, res) => {
  try {
    const { qrCodeHash } = req.body || {};
    if (typeof qrCodeHash !== 'string' || !/^[a-f0-9]{64}$/.test(qrCodeHash)) {
      throw new HttpError(400, 'qrCodeHash must be a 64-char hex string');
    }

    const ticket = await prisma.ticket.findUnique({
      where: { qrCodeHash },
      include: {
        ticketType: { select: { name: true } },
        order: { select: { status: true, event: { select: { id: true, title: true, organizerId: true } } } },
      },
    });
    if (!ticket) throw new HttpError(404, 'Ticket not found: invalid QR code');

    const event = ticket.order.event;

    // Организатор может сканировать только билеты своих событий
    if (req.user.role === 'ORGANIZER' && event.organizerId !== req.user.id) {
      throw new HttpError(403, 'You can only check in tickets for your own events');
    }
    if (ticket.order.status !== 'COMPLETED' || ['CANCELLED', 'REFUNDED'].includes(ticket.status)) {
      throw new HttpError(403, `Ticket is not valid (${ticket.status})`);
    }

    if (ticket.status === 'CHECKED_IN') {
      return respondAlreadyUsed(res, ticket);
    }

    // Double-spend protection: атомарный переход VALID -> CHECKED_IN.
    // Если два сканера одновременно проверят один билет, count=1 получит только один.
    const result = await prisma.$transaction(async (tx) => {
      const updated = await tx.ticket.updateMany({
        where: { id: ticket.id, status: 'VALID' },
        data: { status: 'CHECKED_IN' },
      });
      if (updated.count === 0) return null;
      return tx.checkIn.create({ data: { ticketId: ticket.id, scannedBy: req.user.id } });
    });

    if (!result) return respondAlreadyUsed(res, ticket);

    return res.json({
      valid: true,
      message: 'Check-in successful',
      checkedInAt: result.scannedAt,
      ticket: { id: ticket.id, attendeeName: ticket.attendeeName, ticketType: ticket.ticketType.name },
      event: { id: event.id, title: event.title },
    });
  } catch (err) {
    return handleError(res, err);
  }
};

async function respondAlreadyUsed(res, ticket) {
  const first = await prisma.checkIn.findFirst({
    where: { ticketId: ticket.id },
    orderBy: { scannedAt: 'asc' },
  });
  return res.status(409).json({
    valid: false,
    error: 'Ticket already checked in',
    checkedInAt: first ? first.scannedAt : null,
    ticket: { id: ticket.id, attendeeName: ticket.attendeeName },
  });
}
