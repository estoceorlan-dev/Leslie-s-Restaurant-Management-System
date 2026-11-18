import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';
import { createPostgresDatabase } from './postgres.js';

// Keep parent records ahead of their foreign keys. Sessions expire at cutover.
const tables = ['users', 'categories', 'restaurant_tables', 'menu_items', 'orders',
  'order_items', 'inventory_items', 'stock_movements', 'menu_images'];

export async function importSqlite(source, target) {
  source.exec('BEGIN');
  try {
    await target.transaction(async (tx) => {
      await tx.run(`LOCK TABLE auth_sessions, ${tables.join(', ')} IN ACCESS EXCLUSIVE MODE`);
      await tx.run("SET LOCAL TIME ZONE 'UTC'");
      for (const table of tables) {
        if (await tx.get(`SELECT 1 FROM ${table} LIMIT 1`)) {
          throw new Error('The destination must be an empty, initialized restaurant database.');
        }
      }
      for (const table of tables) {
        // Backups from before menu photos shipped have no image table.
        if (table === 'menu_images' && !source.prepare(
          "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'menu_images'",
        ).get()) continue;
        const fields = await tx.all(`
          SELECT column_name FROM information_schema.columns
          WHERE table_schema = current_schema() AND table_name = ? ORDER BY ordinal_position
        `, table);
        const columns = fields.map(({ column_name }) => '"' + column_name.replaceAll('"', '""') + '"').join(', ');
        const placeholders = fields.map(() => '?').join(', ');
        const rows = source.prepare(`SELECT ${columns} FROM ${table}`).raw().iterate();
        for (const row of rows) {
          await tx.run(`INSERT INTO ${table} (${columns}) VALUES (${placeholders})`, ...row);
        }
        if (table !== 'menu_images') {
          const lastId = source.prepare('SELECT seq FROM sqlite_sequence WHERE name = ?').get(table)?.seq ?? 0;
          const nextId = Number(lastId) + 1;
          if (!Number.isSafeInteger(nextId) || nextId < 1) throw new Error('Invalid SQLite ID sequence.');
          await tx.run(`ALTER TABLE ${table} ALTER COLUMN id RESTART WITH ${nextId}`);
        }
      }
    });
  } finally {
    source.exec('ROLLBACK');
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const connection = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
  if (!connection || !process.argv[2]) throw new Error('Supply a SQLite backup path and a destination PostgreSQL connection.');
  const source = new Database(process.argv[2], { readonly: true, fileMustExist: true });
  const target = createPostgresDatabase(connection);
  try {
    await importSqlite(source, target);
    console.log('Restaurant records and menu photos imported. Employees can sign in with their existing accounts.');
  } finally {
    source.close();
    await target.close();
  }
}
