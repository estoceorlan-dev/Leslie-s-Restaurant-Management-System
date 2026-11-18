import { readFile } from 'node:fs/promises';
import { createPostgresDatabase } from './postgres.js';

if (process.env.DATABASE_URL || process.env.DATABASE_URL_UNPOOLED) {
  const db = createPostgresDatabase(process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL);
  try {
    const schema = await readFile(new URL('./postgres.sql', import.meta.url), 'utf8');
    await db.transaction(async (tx) => {
      await tx.get('SELECT pg_advisory_xact_lock(82503199)');
      await tx.run(schema);
    });
    console.log('PostgreSQL schema initialized.');
  } finally {
    await db.close();
  }
} else {
  const { initializeDatabase } = await import('./init.js');
  const { db } = await import('./connection.js');
  try {
    console.log('SQLite schema initialized:', initializeDatabase());
  } finally {
    db.close();
  }
}
