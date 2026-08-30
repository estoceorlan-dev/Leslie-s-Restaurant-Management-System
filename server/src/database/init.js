import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import bcrypt from 'bcryptjs';
import { db } from './connection.js';

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
const schemaPath = path.join(currentDirectory, 'schema.sql');

export function initializeDatabase() {
  const schema = fs.readFileSync(schemaPath, 'utf8');
  db.exec(schema);

  db.prepare(`
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

  const seed = db.transaction(() => {
    const insertUser = db.prepare(`
      INSERT OR IGNORE INTO users (name, username, password_hash, role)
      VALUES (@name, @username, @password_hash, @role)
    `);
    const demoPasswordHash = bcrypt.hashSync('demo123', 10);
    const testPasswordHash = bcrypt.hashSync('test123', 10);

    [
      { name: 'System Admin', username: 'admin', role: 'admin' },
      { name: 'Demo Cashier', username: 'cashier', role: 'cashier' },
      { name: 'Demo Kitchen Staff', username: 'kitchen', role: 'kitchen' },
    ].forEach((user) =>
      insertUser.run({ ...user, password_hash: demoPasswordHash }),
    );

    [
      { name: 'Test Administrator', username: 'test_admin', role: 'admin' },
      { name: 'Test Cashier', username: 'test_cashier', role: 'cashier' },
      { name: 'Test Kitchen Staff', username: 'test_kitchen', role: 'kitchen' },
    ].forEach((user) =>
      insertUser.run({ ...user, password_hash: testPasswordHash }),
    );

    const insertCategory = db.prepare(
      'INSERT OR IGNORE INTO categories (name) VALUES (?)',
    );
    ['Meals', 'Drinks', 'Desserts'].forEach((name) => insertCategory.run(name));

    const categoryRows = db.prepare('SELECT id, name FROM categories').all();
    const categoryIds = Object.fromEntries(
      categoryRows.map((category) => [category.name, category.id]),
    );
    const insertMenuItem = db.prepare(`
      INSERT OR IGNORE INTO menu_items (category_id, name, price_cents)
      VALUES (@category_id, @name, @price_cents)
    `);

    [
      { category: 'Meals', name: 'Fried Chicken', price_cents: 12000 },
      { category: 'Meals', name: 'Pancit', price_cents: 9500 },
      { category: 'Meals', name: 'Pork Adobo', price_cents: 13500 },
      { category: 'Drinks', name: 'Iced Tea', price_cents: 4500 },
      { category: 'Drinks', name: 'Bottled Water', price_cents: 2500 },
      { category: 'Desserts', name: 'Leche Flan', price_cents: 6000 },
    ].forEach(({ category, ...item }) =>
      insertMenuItem.run({ ...item, category_id: categoryIds[category] }),
    );

    const insertTable = db.prepare(`
      INSERT OR IGNORE INTO restaurant_tables (table_number, capacity)
      VALUES (?, ?)
    `);
    [1, 2, 3, 4, 5, 6].forEach((tableNumber) =>
      insertTable.run(tableNumber, 4),
    );

    const insertInventoryItem = db.prepare(`
      INSERT OR IGNORE INTO inventory_items
        (name, unit, quantity, low_stock_level)
      VALUES (@name, @unit, @quantity, @low_stock_level)
    `);
    [
      { name: 'Rice', unit: 'kg', quantity: 15, low_stock_level: 5 },
      { name: 'Chicken', unit: 'kg', quantity: 10, low_stock_level: 4 },
      { name: 'Cooking Oil', unit: 'bottles', quantity: 2, low_stock_level: 3 },
    ].forEach((item) => insertInventoryItem.run(item));
  });

  seed();

  return {
    users: db.prepare('SELECT COUNT(*) AS count FROM users').get().count,
    menuItems: db.prepare('SELECT COUNT(*) AS count FROM menu_items').get().count,
    tables: db.prepare('SELECT COUNT(*) AS count FROM restaurant_tables').get()
      .count,
    inventoryItems: db
      .prepare('SELECT COUNT(*) AS count FROM inventory_items')
      .get().count,
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const counts = initializeDatabase();
  console.log('SQLite database initialized:', counts);
  db.close();
}
