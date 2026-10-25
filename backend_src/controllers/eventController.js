const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// GET /api/events — опубликованные события вместе с типами билетов
const getEvents = async (req, res) => {
  try {
    const events = await prisma.event.findMany({
      where: { isPublished: true },
      orderBy: { startTime: 'asc' },
      include: {
        ticketTypes: { orderBy: { price: 'asc' } },
      },
    });

    const result = events.map((e) => {
      const ticketTypes = e.ticketTypes.map((t) => ({
        id: t.id,
        name: t.name,
        price: Number(t.price),
        isPaid: t.isPaid,
        totalQuantity: t.totalQuantity,
        remainingQuantity: t.remainingQuantity,
      }));
      const prices = ticketTypes.map((t) => t.price);

      return {
        id: e.id,
        title: e.title,
        description: e.description,
        venueName: e.venueName,
        venueAddress: e.venueAddress,
        startTime: e.startTime,
        endTime: e.endTime,
        capacity: e.capacity,
        paidSalesActive: e.paidSalesActive,
        ticketTypes,
        // поля обратной совместимости со старым моком ({ id, title, price, date })
        date: e.startTime,
        location: e.venueName,
        price: prices.length ? Math.min(...prices) : 0, // "от" — минимальная цена
      };
    });

    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to load events' });
  }
};

const createEvent = (req, res) => {
  const { title, price, date } = req.body;

  if (!title || !price) {
    return res.status(400).json({ error: 'Название и цена обязательны' });
  }

  const newEvent = {
    id: Date.now(),
    title,
    price,
    date: date || new Date().toISOString()
  };

  res.status(201).json({
    message: 'Ивент успешно создан!',
    event: newEvent
  });
};

module.exports = {
  getEvents,
  createEvent
};