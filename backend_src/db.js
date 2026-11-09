// Единый PrismaClient на всё приложение (раньше каждый контроллер создавал свой пул соединений).
// Тесты подменяют клиент in-memory реализацией через global.__BILETFLOW_PRISMA__.
if (global.__BILETFLOW_PRISMA__) {
  module.exports = global.__BILETFLOW_PRISMA__;
} else {
  const { PrismaClient } = require('@prisma/client');
  module.exports = new PrismaClient();
}
