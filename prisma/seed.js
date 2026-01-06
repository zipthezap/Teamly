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
    },
  });
  const user2 = await prisma.user.upsert({
    where: { email: 'bob@example.com' },
    update: {},
    create: {
      email: 'bob@example.com',
      password: hashedPassword,
      name: 'Bob',
    },
  });
  const user3 = await prisma.user.upsert({
    where: { email: 'charlie@example.com' },
    update: {},
    create: {
      email: 'charlie@example.com',
      password: hashedPassword,
      name: 'Charlie',
    },
  });
  const user4 = await prisma.user.upsert({
    where: { email: 'diana@example.com' },
    update: {},
    create: {
      email: 'diana@example.com',
      password: hashedPassword,
      name: 'Diana',
    },
  });
  console.log('Seeded users:', user1.email, user2.email, user3.email, user4.email);

  // Create a group with Alice as admin
  const group = await prisma.group.upsert({
    where: { id: 'seed-group-alice-admin' },
    update: {},
    create: {
      id: 'seed-group-alice-admin',
      name: 'Alice\'s Sports Club',
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

  // Create an event in that group created by Alice
  const event = await prisma.event.upsert({
    where: { id: 'seed-event-alice-group' },
    update: {},
    create: {
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
      participants: {
        create: {
          userId: user1.id,
          status: 'confirmed'
        }
      }
    }
  });
  console.log('Seeded event:', event.title, '(created by Alice in group)');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
