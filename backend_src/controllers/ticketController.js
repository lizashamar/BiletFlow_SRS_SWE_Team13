const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { HttpError, handleError } = require('../utils/httpError');

const ticketInclude = {
  ticketType: { select: { name: true, price: true } },
  order: {
    select: {
      id: true,
      userId: true,
      event: { select: { id: true, title: true, venueName: true, venueAddress: true, startTime: true, endTime: true } },
    },
  },
};

// GET /api/tickets?status=VALID — билеты текущего пользователя (с qrCodeHash для отрисовки QR)
exports.getMyTickets = async (req, res) => {
  try {
    const where = { order: { userId: req.user.id, status: 'COMPLETED' } };
    if (req.query.status) {
      const allowed = ['VALID', 'CHECKED_IN', 'CANCELLED', 'REFUNDED'];
      if (!allowed.includes(req.query.status)) throw new HttpError(400, 'Invalid status filter');
      where.status = req.query.status;
    }
    const tickets = await prisma.ticket.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: ticketInclude,
    });
    return res.json(tickets);
  } catch (err) {
    return handleError(res, err);
  }
};

// GET /api/tickets/:id
exports.getTicketById = async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) throw new HttpError(400, 'Invalid ticket id');

    const ticket = await prisma.ticket.findUnique({ where: { id }, include: ticketInclude });
    if (!ticket || (ticket.order.userId !== req.user.id && req.user.role !== 'PLATFORM_ADMIN')) {
      throw new HttpError(404, 'Ticket not found');
    }
    return res.json(ticket);
  } catch (err) {
    return handleError(res, err);
  }
};
