const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Cleaning up database...');
  await prisma.checkIn.deleteMany();
  await prisma.ticket.deleteMany();
  await prisma.order.deleteMany();
  await prisma.ticketType.deleteMany();
  await prisma.event.deleteMany();
  await prisma.user.deleteMany();

  console.log('Seeding users...');
  const organizer = await prisma.user.create({
    data: {
      email: 'organizer@biletflow.kz',
      passwordHash: '$2b$10$e8R...hash_placeholder',
      fullName: 'Avenue Events KZ',
      role: 'ORGANIZER',
    },
  });

  const attendee = await prisma.user.create({
    data: {
      email: 'alisher@example.com',
      passwordHash: '$2b$10$e8R...hash_placeholder',
      fullName: 'Alisher Akturin',
      role: 'ATTENDEE',
    },
  });

  const scannerAdmin = await prisma.user.create({
    data: {
      email: 'scanner1@biletflow.kz',
      passwordHash: '$2b$10$e8R...hash_placeholder',
      fullName: 'Gate Staff 1',
      role: 'EVENT_ADMIN',
    },
  });

  console.log('Seeding event...');
  const event = await prisma.event.create({
    data: {
      organizerId: organizer.id,
      title: 'bts Concert Astana',
      description: 'Live performance in Astana Arena',
      venueName: 'Astana Arena',
      venueAddress: 'Kabanbay Batyr Str 53, Astana',
      startTime: new Date('2026-10-15T20:00:00Z'),
      endTime: new Date('2026-10-15T23:00:00Z'),
      capacity: 10000,
      isPublished: true,
      paidSalesActive: true,
    },
  });

  console.log('Seeding ticket types...');
  const vipType = await prisma.ticketType.create({
    data: {
      eventId: event.id,
      name: 'VIP Fan Zone',
      price: 25000.00,
      totalQuantity: 500,
      remainingQuantity: 499,
      isPaid: true,
    },
  });

  console.log('Seeding order...');
  const order = await prisma.order.create({
    data: {
      userId: attendee.id,
      eventId: event.id,
      totalAmount: 25000.00,
      status: 'COMPLETED',
    },
  });

  console.log('Seeding ticket...');
  const ticket = await prisma.ticket.create({
    data: {
      orderId: order.id,
      ticketTypeId: vipType.id,
      attendeeName: 'Alisher Akturin',
      qrCodeHash: 'BF_QR_HASH_991823712893',
      status: 'VALID',
    },
  });

  console.log('Seeding test check-in record...');
  await prisma.checkIn.create({
    data: {
      ticketId: ticket.id,
      scannedBy: scannerAdmin.id,
    },
  });

  console.log('Seeding finished successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });