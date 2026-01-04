const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');

const connectionString = process.env.DATABASE_URL;

let prisma;

if (connectionString) {
  const pool = new Pool({ connectionString });
  const adapter = new PrismaPg(pool);
  prisma = new PrismaClient({ adapter });
} else {
  // For development/testing without a database
  console.warn('Warning: DATABASE_URL not set. Database operations will fail.');
  prisma = null;
}

module.exports = prisma;
