// Тестовые аккаунты по одному на каждую роль (SRS 2.3) + демо-данные для ручной проверки API.
//
//   node backend_src/scripts/seedAccounts.js          (нужен DATABASE_URL; только dev/staging)
//
// Скрипт идемпотентен: существующим пользователям обновляется пароль/роль.
// Раньше prisma/seed.js создавал пользователей с заведомо нерабочим bcrypt-хэшем
// ('$2b$10$e8R...hash_placeholder'), поэтому войти ни под одним seed-аккаунтом было нельзя.
// Этот модуль также используется интеграционными тестами (с in-memory БД).
const bcrypt = require('bcryptjs');

const TEST_PASSWORD = 'Password123!';

const ACCOUNTS = [
  { key: 'attendee', email: 'attendee@biletflow.kz', fullName: 'Test Attendee', role: 'ATTENDEE' },
  { key: 'attendee2', email: 'attendee2@biletflow.kz', fullName: 'Second Attendee', role: 'ATTENDEE' },
  { key: 'organizer', email: 'organizer@biletflow.kz', fullName: 'Avenue Events KZ', role: 'ORGANIZER' },
  { key: 'organizer2', email: 'organizer2@biletflow.kz', fullName: 'Other Organizer', role: 'ORGANIZER' },
  { key: 'scanner', email: 'scanner1@biletflow.kz', fullName: 'Gate Staff 1', role: 'EVENT_ADMIN' },
  { key: 'admin', email: 'admin@biletflow.kz', fullName: 'Platform Admin', role: 'PLATFORM_ADMIN' },
];

async function seedAccounts(prisma, { rounds = 10 } = {}) {
  const passwordHash = await bcrypt.hash(TEST_PASSWORD, rounds);
  const users = {};
  for (const a of ACCOUNTS) {
    const existing = await prisma.user.findUnique({ where: { email: a.email } });
    users[a.key] = existing
      ? await prisma.user.update({ where: { id: existing.id }, data: { passwordHash, role: a.role, fullName: a.fullName } })
      : await prisma.user.create({ data: { email: a.email, passwordHash, fullName: a.fullName, role: a.role } });
  }
  return users;
}

module.exports = { seedAccounts, ACCOUNTS, TEST_PASSWORD };

if (require.main === module) {
  require('dotenv').config();
  if (process.env.NODE_ENV === 'production') {
    console.error('Refusing to create well-known test accounts when NODE_ENV=production');
    process.exit(1);
  }
  const prisma = require('../db');
  seedAccounts(prisma)
    .then((users) => {
      console.log('Test accounts ready (password for all: %s):', TEST_PASSWORD);
      for (const a of ACCOUNTS) console.log(`  ${a.role.padEnd(15)} ${a.email}`);
      return prisma.$disconnect();
    })
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}
