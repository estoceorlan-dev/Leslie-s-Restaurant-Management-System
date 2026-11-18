import { createPostgresDatabase } from './postgres.js';

if (process.env.DATABASE_URL_UNPOOLED && !process.env.DATABASE_URL) {
  throw new Error('Set DATABASE_URL for application queries when using PostgreSQL.');
}

export const postgres = Boolean(process.env.DATABASE_URL);
export const db = postgres
  ? createPostgresDatabase(process.env.DATABASE_URL)
  : await import('./sqlite-queries.js').then((module) => module.sqlite);
