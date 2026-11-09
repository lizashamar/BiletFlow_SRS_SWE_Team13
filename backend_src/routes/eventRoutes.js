const express = require('express');
const router = express.Router();
const eventController = require('../controllers/eventController');
const { authenticate, optionalAuth, authorize, ROLES } = require('../middleware/authMiddleware');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const organizerOnly = [authenticate, authorize(ROLES.ORGANIZER)];

router.get('/', eventController.getEvents);
router.get('/mine', ...organizerOnly, eventController.getMyEvents);
router.post('/', ...organizerOnly, eventController.createEvent);

router.get('/:id', optionalAuth, eventController.getEventById);
router.get('/:id/calendar.ics', optionalAuth, eventController.getEventCalendar);
router.patch('/:id', ...organizerOnly, eventController.updateEvent);
router.post('/:id/activate-paid-sales', ...organizerOnly, eventController.activatePaidSales);
router.get('/:id/stats', ...organizerOnly, eventController.getEventStats);
router.get('/:id/attendees', ...organizerOnly, eventController.getAttendees);

router.get('/:id/analytics', ...organizerOnly, async (req, res) => {
  try {
    const eventId = parseInt(req.params.id);

    const event = await prisma.event.findUnique({
      where: { id: eventId },
      include: {
        ticketTypes: true,
      },
    });

    if (!event) {
      return res.status(404).json({ error: 'Событие не найдено' });
    }

    const completedOrders = await prisma.order.findMany({
      where: {
        eventId: eventId,
        status: 'COMPLETED',
      },
    });

    const totalRevenue = completedOrders.reduce(
      (sum, order) => sum + Number(order.totalAmount),
      0
    );

    const tickets = await prisma.ticket.findMany({
      where: {
        order: {
          eventId: eventId,
          status: 'COMPLETED',
        },
      },
      include: {
        checkIns: true,
      },
    });

    const totalSoldTickets = tickets.length;
    const checkedInCount = tickets.filter(
      (ticket) => ticket.status === 'CHECKED_IN' || ticket.checkIns.length > 0
    ).length;

    const checkInRate = totalSoldTickets > 0 
      ? ((checkedInCount / totalSoldTickets) * 100).toFixed(2) 
      : 0;

    res.json({
      eventId: event.id,
      title: event.title,
      totalRevenue,
      totalSoldTickets,
      checkedInCount,
      checkInRate: `${checkInRate}%`,
      ticketTypes: event.ticketTypes.map(tt => ({
        name: tt.name,
        price: tt.price,
        totalQuantity: tt.totalQuantity,
        remainingQuantity: tt.remainingQuantity,
      })),
    });
  } catch (error) {
    console.error('Ошибка при получении аналитики:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

module.exports = router;