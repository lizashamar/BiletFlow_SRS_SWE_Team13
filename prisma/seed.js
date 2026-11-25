require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const { seedAccounts, ACCOUNTS, TEST_PASSWORD } = require('../backend_src/scripts/seedAccounts');
const { generateQrHash } = require('../backend_src/utils/qr');

const prisma = new PrismaClient();

const DAY = 24 * 60 * 60 * 1000;
const at = (daysFromNow, hour, minutes = 0) => {
  const d = new Date(Date.now() + daysFromNow * DAY);
  d.setHours(hour, minutes, 0, 0);
  return d;
};

const HOUR = 60 * 60 * 1000;
const startOfHour = new Date(Math.floor(Date.now() / HOUR) * HOUR);
const live = (hoursFromNow) => new Date(startOfHour.getTime() + hoursFromNow * HOUR);

const EVENTS = [
  {
    title: 'Tech Conference Astana 2026',
    description: 'Talks on AI, cloud and startups in Kazakhstan.',
    venueName: 'Expo Congress Center',
    venueAddress: 'Mangilik El Ave 53/1, Astana',
    startTime: live(-1),
    endTime: live(24),
    capacity: 300,
    ticketTypes: [
      { name: 'Standard', price: 5000, totalQuantity: 200 },
      { name: 'VIP', price: 15000, totalQuantity: 50 },
    ],
  },
  {
    title: 'Jazz Night Almaty',
    description: 'Live jazz quartet and guests.',
    venueName: 'Kazakhconcert Hall',
    venueAddress: 'Abylai Khan Ave 83, Almaty',
    startTime: at(10, 19),
    endTime: at(10, 22),
    capacity: 120,
    ticketTypes: [{ name: 'Standard', price: 8000, totalQuantity: 100 }],
  },
  {
    title: 'University Open Day',
    description: 'Free campus tour and student project showcase.',
    venueName: 'Main Atrium',
    venueAddress: 'Kabanbay Batyr Ave 53, Astana',
    startTime: at(1, 11),
    endTime: at(1, 16),
    capacity: 300,
    ticketTypes: [{ name: 'Free entry', price: 0, totalQuantity: 300 }],
  },
];

async function main() {
  console.log('Cleaning up database...');
  await prisma.checkIn.deleteMany();
  await prisma.ticket.deleteMany();
  await prisma.order.deleteMany();
  await prisma.ticketType.deleteMany();
  await prisma.event.deleteMany();

  const users = await seedAccounts(prisma);

  const created = [];
  for (const e of EVENTS) {
    const hasPaid = e.ticketTypes.some((t) => t.price > 0);
    created.push(
      await prisma.event.create({
        data: {
          organizerId: users.organizer.id,
          title: e.title,
          description: e.description,
          venueName: e.venueName,
          venueAddress: e.venueAddress,
          startTime: e.startTime,
          endTime: e.endTime,
          capacity: e.capacity,
          isPublished: true,
          paidSalesActive: hasPaid,
          ticketTypes: {
            create: e.ticketTypes.map((t) => ({
              name: t.name,
              price: t.price,
              isPaid: t.price > 0,
              totalQuantity: t.totalQuantity,
              remainingQuantity: t.totalQuantity,
            })),
          },
        },
        include: { ticketTypes: true },
      })
    );
  }

  const conference = created[0];
  const standard = conference.ticketTypes.find((t) => t.name === 'Standard');
  await prisma.ticketType.update({ where: { id: standard.id }, data: { remainingQuantity: { decrement: 1 } } });
  await prisma.order.create({
    data: {
      userId: users.attendee2.id,
      eventId: conference.id,
      totalAmount: standard.price,
      status: 'COMPLETED',
      tickets: {
        create: [{ ticketTypeId: standard.id, attendeeName: users.attendee2.fullName, qrCodeHash: generateQrHash() }],
      },
    },
  });

  console.log(`"${conference.title}" is live now: check-in open until ${conference.endTime.toLocaleString()}.`);
  console.log(`Seeded ${created.length} events. Accounts (password ${TEST_PASSWORD}):`);
  for (const a of ACCOUNTS) console.log(`  ${a.role.padEnd(15)} ${a.email}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
