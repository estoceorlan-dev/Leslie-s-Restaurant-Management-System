import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { db } from './connection.js';

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
const schemaPath = path.join(currentDirectory, 'schema.sql');

export function databaseCounts(database = db) {
  return {
    users: database.prepare('SELECT COUNT(*) AS count FROM users').get().count,
    authSessions: database.prepare('SELECT COUNT(*) AS count FROM auth_sessions').get()
      .count,
    categories: database.prepare('SELECT COUNT(*) AS count FROM categories').get().count,
    menuItems: database.prepare('SELECT COUNT(*) AS count FROM menu_items').get().count,
    tables: database.prepare('SELECT COUNT(*) AS count FROM restaurant_tables').get()
      .count,
    orders: database.prepare('SELECT COUNT(*) AS count FROM orders').get().count,
    orderItems: database.prepare('SELECT COUNT(*) AS count FROM order_items').get()
      .count,
    inventoryItems: database
      .prepare('SELECT COUNT(*) AS count FROM inventory_items')
      .get().count,
    stockMovements: database.prepare('SELECT COUNT(*) AS count FROM stock_movements')
      .get().count,
  };
}

export function initializeDatabase(database = db) {
  const schema = fs.readFileSync(schemaPath, 'utf8');
  database.exec(schema);

  database.prepare(`
    UPDATE restaurant_tables
    SET status = CASE
      WHEN EXISTS (
        SELECT 1 FROM orders
        WHERE orders.table_id = restaurant_tables.id
          AND orders.status IN ('pending', 'preparing', 'ready')
      ) THEN 'occupied'
      ELSE 'available'
    END
  `).run();

  return databaseCounts(database);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const counts = initializeDatabase();
  console.log('SQLite production schema initialized:', counts);
  db.close();
}
