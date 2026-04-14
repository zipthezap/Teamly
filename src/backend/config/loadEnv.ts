import { existsSync } from 'node:fs';

if (!process.env.DATABASE_URL && typeof process.loadEnvFile === 'function' && existsSync('.env')) {
  process.loadEnvFile('.env');
}