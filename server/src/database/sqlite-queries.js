import { db as connection } from './connection.js';

const statements = {
  get: (sql, ...values) => connection.prepare(sql).get(...values),
  all: (sql, ...values) => connection.prepare(sql).all(...values),
  run: (sql, ...values) => connection.prepare(sql).run(...values).changes,
};

// The LAN server shares one SQLite connection. Hold the queue for the full
// transaction so another request cannot observe or commit a partial write.
let pending = Promise.resolve();
function enqueue(work) {
  const result = pending.then(work);
  pending = result.catch(() => {});
  return result;
}

export const sqlite = {
  get: (...args) => enqueue(() => statements.get(...args)),
  all: (...args) => enqueue(() => statements.all(...args)),
  run: (...args) => enqueue(() => statements.run(...args)),
  transaction: (work) => enqueue(async () => {
    connection.exec('BEGIN IMMEDIATE');
    try {
      const result = await work(statements);
      connection.exec('COMMIT');
      return result;
    } catch (error) {
      connection.exec('ROLLBACK');
      throw error;
    }
  }),
};
