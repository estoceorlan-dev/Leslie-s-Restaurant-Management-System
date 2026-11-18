import pg from 'pg';
import { attachDatabasePool } from '@neon/functions';

// Aggregates and cent amounts are returned as JSON numbers by the API.
pg.types.setTypeParser(20, Number);
pg.types.setTypeParser(1700, Number);
pg.types.setTypeParser(1082, (date) => date);

function queries(client) {
  async function query(sql, values) {
    let index = 0;
    return client.query(sql.replaceAll('?', () => '$' + ++index), values);
  }
  return {
    async get(sql, ...values) { return (await query(sql, values)).rows[0]; },
    async all(sql, ...values) { return (await query(sql, values)).rows; },
    async run(sql, ...values) { return (await query(sql, values)).rowCount; },
  };
}

export function createPostgresDatabase(connectionString) {
  const pool = new pg.Pool({ connectionString, max: 5, connectionTimeoutMillis: 10000 });
  attachDatabasePool(pool);
  return {
    ...queries(pool),
    async transaction(work) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const result = await work(queries(client));
        await client.query('COMMIT');
        return result;
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    },
    close: () => pool.end(),
  };
}
