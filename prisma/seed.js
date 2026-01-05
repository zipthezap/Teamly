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
  console.log('Seeded users:', user1.email, user2.email);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
