const express = require('express');
const authRoutes = require('../backend_src/routes/authRoutes');
const eventRoutes = require('../backend_src/routes/eventRoutes');

const app = express();
const PORT = 5000;

app.use(express.json());

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'BiletFlow API is running!' });
});

app.use('/api/auth', authRoutes);
app.use('/api/events', eventRoutes);

app.listen(PORT, () => {
  console.log(`Сервер запущен на http://localhost:${PORT}`);
});