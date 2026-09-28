const express = require('express');
const app = express();
const PORT = 5000;

app.use(express.json());

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Сервер BiletFlow успешно работает!' });
});

app.get('/api/events', (req, res) => {
  res.json([
    { id: 1, title: 'Концерт на Астана Арене', price: 15000, date: '2026-10-15' },
    { id: 2, title: 'IT Conference Astana', price: 0, date: '2026-11-01' }
  ]);
});

app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Заполните email и пароль' });
  }

  res.json({
    message: 'Успешный вход!',
    user: { id: 1, email: email, role: 'USER' }
  });
});

app.post('/api/events', (req, res) => {
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
});

app.listen(PORT, () => {
  console.log(`🚀 Сервер запущен на http://localhost:${PORT}`);
});