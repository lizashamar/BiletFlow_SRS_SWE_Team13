const { PrismaClient, Prisma } = require('@prisma/client');
const prisma = new PrismaClient();
const { HttpError, handleError } = require('../utils/httpError');
const { generateQrHash } = require('../utils/qr');

const MAX_TICKETS_PER_ORDER = 10;

// Валидация и нормализация body: { eventId, items: [{ ticketTypeId, quantity, attendeeNames? }] }
function parseOrderBody(body) {
  const { eventId, items } = body || {};

  if (!Number.isInteger(eventId)) {
    throw new HttpError(400, 'eventId must be an integer');
  }
  if (!Array.isArray(items) || items.length === 0) {
    throw new HttpError(400, 'items must be a non-empty array');
  }

  const merged = new Map(); // ticketTypeId -> { quantity, attendeeNames }
  let totalQty = 0;

  for (const item of items) {
    const { ticketTypeId, quantity, attendeeNames } = item || {};
    if (!Number.isInteger(ticketTypeId) || !Number.isInteger(quantity) || quantity < 1) {
      throw new HttpError(400, 'Each item needs integer ticketTypeId and quantity >= 1');
    }
    if (attendeeNames !== undefined) {
      if (!Array.isArray(attendeeNames) || attendeeNames.length !== quantity ||
          attendeeNames.some((n) => typeof n !== 'string' || !n.trim())) {
        throw new HttpError(400, 'attendeeNames must be an array of non-empty strings, one per ticket');
      }
    }
    totalQty += quantity;
    const prev = merged.get(ticketTypeId);
    if (prev) {
      prev.quantity += quantity;
      prev.attendeeNames = undefined; // при слиянии дублей имена сбрасываем
    } else {
      merged.set(ticketTypeId, { quantity, attendeeNames });
    }
  }

  if (totalQty > MAX_TICKETS_PER_ORDER) {
    throw new HttpError(400, `Maximum ${MAX_TICKETS_PER_ORDER} tickets per order`);
  }

  return { eventId, items: [...merged.entries()].map(([ticketTypeId, v]) => ({ ticketTypeId, ...v })) };
}

// POST /api/orders
exports.createOrder = async (req, res) => {
  try {
    const { eventId, items } = parseOrderBody(req.body);

    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (!user) throw new HttpError(401, 'User no longer exists');

    const order = await prisma.$transaction(async (tx) => {
      const event = await tx.event.findUnique({
        where: { id: eventId },
        include: { ticketTypes: true },
      });
      if (!event || !event.isPublished) throw new HttpError(404, 'Event not found');
      if (event.endTime < new Date()) throw new HttpError(400, 'Event has already ended');

      let total = new Prisma.Decimal(0);
      const toIssue = []; // { ticketTypeId, attendeeName }

      for (const item of items) {
        const tt = event.ticketTypes.find((t) => t.id === item.ticketTypeId);
        if (!tt) throw new HttpError(400, `Ticket type ${item.ticketTypeId} does not belong to this event`);

        const isPaid = tt.isPaid || tt.price.gt(0);
        if (isPaid && !event.paidSalesActive) {
          throw new HttpError(403, 'Paid ticket sales are not active for this event');
        }

        // Атомарное списание остатков: защита от overselling при параллельных заказах
        const updated = await tx.ticketType.updateMany({
          where: { id: tt.id, remainingQuantity: { gte: item.quantity } },
          data: { remainingQuantity: { decrement: item.quantity } },
        });
        if (updated.count === 0) throw new HttpError(409, `Not enough tickets left for "${tt.name}"`);

        total = total.plus(tt.price.mul(item.quantity));
        for (let i = 0; i < item.quantity; i++) {
          toIssue.push({
            ticketTypeId: tt.id,
            attendeeName: item.attendeeNames ? item.attendeeNames[i].trim() : user.fullName,
          });
        }
      }

      // TODO: интеграция с платёжным шлюзом. Пока заказ сразу COMPLETED.
      const created = await tx.order.create({
        data: { userId: user.id, eventId, totalAmount: total, status: 'COMPLETED' },
      });

      for (const t of toIssue) {
        await tx.ticket.create({
          data: {
            orderId: created.id,
            ticketTypeId: t.ticketTypeId,
            attendeeName: t.attendeeName,
            qrCodeHash: generateQrHash(),
          },
        });
      }

      return tx.order.findUnique({
        where: { id: created.id },
        include: { tickets: { include: { ticketType: { select: { name: true, price: true } } } } },
      });
    });

    return res.status(201).json({ message: 'Order placed', order });
  } catch (err) {
    return handleError(res, err);
  }
};

// GET /api/orders — заказы текущего пользователя
exports.getMyOrders = async (req, res) => {
  try {
    const orders = await prisma.order.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: 'desc' },
      include: { event: { select: { id: true, title: true, startTime: true } }, tickets: true },
    });
    return res.json(orders);
  } catch (err) {
    return handleError(res, err);
  }
};

// GET /api/orders/:id
exports.getOrderById = async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) throw new HttpError(400, 'Invalid order id');

    const order = await prisma.order.findUnique({
      where: { id },
      include: { event: { select: { id: true, title: true, startTime: true } }, tickets: true },
    });
    // 404 вместо 403, чтобы не раскрывать существование чужих заказов
    if (!order || (order.userId !== req.user.id && req.user.role !== 'PLATFORM_ADMIN')) {
      throw new HttpError(404, 'Order not found');
    }
    return res.json(order);
  } catch (err) {
    return handleError(res, err);
  }
};
