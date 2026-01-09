// prisma/seed.js
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error(
    'DATABASE_URL is not set. Please set it in your .env file.\n' +
    'Example: DATABASE_URL="postgresql://user:password@localhost:5432/teamly?schema=public"'
  );
}

const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const bcrypt = require('bcryptjs');

async function main() {
  // Hash the password for both users
  const hashedPassword = await bcrypt.hash('password123', 10);

  // Create two initial users
  const user1 = await prisma.user.upsert({
    where: { email: 'alice@example.com' },
    update: {},
    create: {
      email: 'alice@example.com',
      password: hashedPassword, // In production, hash passwords!
      name: 'Alice',
      emailVerified: true,
    },
  });
  const user2 = await prisma.user.upsert({
    where: { email: 'bob@example.com' },
    update: {},
    create: {
      email: 'bob@example.com',
      password: hashedPassword,
      name: 'Bob',
      emailVerified: true,
    },
  });
  const user3 = await prisma.user.upsert({
    where: { email: 'charlie@example.com' },
    update: {},
    create: {
      email: 'charlie@example.com',
      password: hashedPassword,
      name: 'Charlie',
      emailVerified: true,
    },
  });
  const user4 = await prisma.user.upsert({
    where: { email: 'diana@example.com' },
    update: {},
    create: {
      email: 'diana@example.com',
      password: hashedPassword,
      name: 'Diana',
      emailVerified: true,
    },
  });
  console.log('Seeded users:', user1.email, user2.email, user3.email, user4.email);

  // Create a group with Alice as admin
  const group = await prisma.group.upsert({
    where: { id: 'seed-group-alice-admin' },
    update: {},
    create: {
      id: 'seed-group-alice-admin',
      name: "Alice's Sports Club",
      description: 'A group for organizing weekly sports events',
      isPublic: true,
      creatorId: user1.id,
      members: {
        create: [
          {
            userId: user1.id,
            role: 'admin'
          },
          {
            userId: user2.id,
            role: 'member'
          }
        ]
      }
    }
  });
  console.log('Seeded group:', group.name, '(Alice as admin)');

  // Create multiple events in the group
  const events = [
    {
      id: 'seed-event-alice-group',
      title: 'Weekend Football Match',
      description: 'Join us for a friendly football match this weekend!',
      eventType: 'football',
      location: 'Central Park Field 3',
      startTime: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
      endTime: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000 + 2 * 60 * 60 * 1000), // 2 hours duration
      maxPlayers: 20,
      creatorId: user1.id,
      groupId: group.id,
      participants: [{ userId: user1.id, status: 'confirmed' }]
    },
    {
      id: 'seed-event-tennis-group',
      title: 'Tennis Doubles Tournament',
      description: 'Compete in our tennis doubles tournament!',
      eventType: 'tennis',
      location: 'Riverside Tennis Courts',
      startTime: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14 days from now
      endTime: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000 + 3 * 60 * 60 * 1000), // 3 hours duration
      maxPlayers: 16,
      creatorId: user2.id,
      groupId: group.id,
      participants: [{ userId: user2.id, status: 'confirmed' }, { userId: user3.id, status: 'pending' }]
    },
    {
      id: 'seed-event-basketball-group',
      title: 'Basketball Pickup Game',
      description: 'Join us for a casual basketball game!',
      eventType: 'basketball',
      location: 'Downtown Gym',
      startTime: new Date(Date.now() + 21 * 24 * 60 * 60 * 1000), // 21 days from now
      endTime: new Date(Date.now() + 21 * 24 * 60 * 60 * 1000 + 1.5 * 60 * 60 * 1000), // 1.5 hours duration
      maxPlayers: 10,
      creatorId: user3.id,
      groupId: group.id,
      participants: [{ userId: user3.id, status: 'confirmed' }, { userId: user4.id, status: 'pending' }]
    }
  ];

  for (const eventData of events) {
    await prisma.event.upsert({
      where: { id: eventData.id },
      update: {},
      create: {
        ...eventData,
        participants: {
          create: eventData.participants
        }
      }
    });
    console.log('Seeded event:', eventData.title);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
