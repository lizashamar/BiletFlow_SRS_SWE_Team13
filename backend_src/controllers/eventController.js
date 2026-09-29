const getEvents = (req, res) => {
  res.json([
    { id: 1, title: 'Концерт на Астана Арене', price: 15000, date: '2026-10-15' },
    { id: 2, title: 'IT Conference Astana', price: 0, date: '2026-11-01' }
  ]);
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