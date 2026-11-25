if (global.__BILETFLOW_PRISMA__) {
  module.exports = global.__BILETFLOW_PRISMA__;
} else {
  const { PrismaClient } = require('@prisma/client');
  module.exports = new PrismaClient();
}
