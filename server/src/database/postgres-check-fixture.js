import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { createPostgresDatabase } from './postgres.js';
import { importSqlite } from './import-sqlite.js';

export async function postgresFixture(url, sqlite) {
  const control = createPostgresDatabase(url);
  const schema = 'restaurant_check_' + randomUUID().replaceAll('-', '');
  const scoped = new URL(url);
  scoped.searchParams.set('options', '-csearch_path=' + schema);
  const target = createPostgresDatabase(scoped.href);
  const close = async () => {
    await target.close();
    try { await control.run('DROP SCHEMA ' + schema + ' CASCADE'); }
    finally { await control.close(); }
  };
  await control.run('CREATE SCHEMA ' + schema);
  try {
    const current = await target.get('SELECT current_schema() AS name');
    if (current.name !== schema) throw new Error('The test connection must support an isolated search path.');
    const ddl = await readFile(new URL('./postgres.sql', import.meta.url), 'utf8');
    await target.run(ddl);
    await target.run(ddl);
    await importSqlite(sqlite, target);
    process.env.DATABASE_URL = scoped.href;
    return close;
  } catch (error) {
    await close();
    throw error;
  }
}
