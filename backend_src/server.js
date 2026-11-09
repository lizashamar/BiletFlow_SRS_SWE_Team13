require('dotenv').config();
const express = require('express');
const authRoutes = require('./routes/authRoutes');
const eventRoutes = require('./routes/eventRoutes');
const orderRoutes = require('./routes/orderRoutes');
const ticketRoutes = require('./routes/ticketRoutes');
const checkinRoutes = require('./routes/checkinRoutes');
const { cors, notFound, errorHandler } = require('./middleware/common');

const app = express();
const PORT = process.env.PORT || 3001;

app.disable('x-powered-by');
app.use(cors);
app.use(express.json({ limit: '256kb' }));

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'BiletFlow API is running!' });
});

app.use('/api/auth', authRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/tickets', ticketRoutes);
app.use('/api/checkin', checkinRoutes);

app.use(notFound);
app.use(errorHandler);


if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Сервер запущен на http://localhost:${PORT}`);
  });
}

module.exports = app;
