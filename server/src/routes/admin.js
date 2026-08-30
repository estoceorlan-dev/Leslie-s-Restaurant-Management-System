import express from 'express';
import bcrypt from 'bcryptjs';
import { db } from '../database/connection.js';
import { authenticate, requireRoles } from '../middleware/auth.js';

export const adminRouter = express.Router();

adminRouter.use(authenticate, requireRoles('admin'));

const roles = new Set(['admin', 'cashier', 'kitchen']);
const cleanText = (value) => (typeof value === 'string' ? value.trim() : '');
const isBoolean = (value) => typeof value === 'boolean';
const booleanInt = (value) => (value ? 1 : 0);
const positiveId = (value) => Number.isInteger(Number(value)) && Number(value) > 0;

function conflict(response, label) {
  return response.status(409).json({ error: `${label} is already in use.` });
}

function employeePayload(body, { editing = false } = {}) {
  const name = cleanText(body.name);
  const username = cleanText(body.username);
  const password = typeof body.password === 'string' ? body.password : '';
  const role = cleanText(body.role);

  if (name.length < 2 || name.length > 80) {
    return { error: 'Employee name must be between 2 and 80 characters.' };
  }
  if (!/^[A-Za-z0-9._-]{3,30}$/.test(username)) {
    return { error: 'Username must be 3-30 characters using letters, numbers, dots, dashes, or underscores.' };
  }
  if ((!editing || password) && password.length < 6) {
    return { error: 'Password must contain at least 6 characters.' };
  }
  if (!roles.has(role)) {
    return { error: 'Select a valid employee role.' };
  }
  if (!isBoolean(body.is_active)) {
    return { error: 'Employee active status is required.' };
  }

  return { value: { name, username, password, role, is_active: booleanInt(body.is_active) } };
}

adminRouter.get('/employees', (_request, response) => {
  const employees = db.prepare(`
    SELECT id, name, username, role, is_active, created_at, updated_at
    FROM users
    ORDER BY is_active DESC, name COLLATE NOCASE
  `).all();
  response.json({ data: employees });
});

adminRouter.post('/employees', (request, response) => {
  const parsed = employeePayload(request.body);
  if (parsed.error) return response.status(400).json({ error: parsed.error });
  const employee = parsed.value;

  if (db.prepare('SELECT 1 FROM users WHERE username = ?').get(employee.username)) {
    return conflict(response, 'Username');
  }

  const result = db.prepare(`
    INSERT INTO users (name, username, password_hash, role, is_active)
    VALUES (?, ?, ?, ?, ?)
  `).run(
    employee.name,
    employee.username,
    bcrypt.hashSync(employee.password, 10),
    employee.role,
    employee.is_active,
  );

  const created = db.prepare(`
    SELECT id, name, username, role, is_active, created_at, updated_at
    FROM users WHERE id = ?
  `).get(result.lastInsertRowid);
  response.status(201).json({ data: created });
});

adminRouter.put('/employees/:id', (request, response) => {
  if (!positiveId(request.params.id)) {
    return response.status(400).json({ error: 'Invalid employee id.' });
  }
  const id = Number(request.params.id);
  const current = db.prepare('SELECT id, role, is_active FROM users WHERE id = ?').get(id);
  if (!current) return response.status(404).json({ error: 'Employee was not found.' });

  const parsed = employeePayload(request.body, { editing: true });
  if (parsed.error) return response.status(400).json({ error: parsed.error });
  const employee = parsed.value;

  if (id === request.user.id && (!employee.is_active || employee.role !== 'admin')) {
    return response.status(400).json({ error: 'You cannot deactivate or remove the admin role from your own account.' });
  }

  if (current.role === 'admin' && current.is_active && (!employee.is_active || employee.role !== 'admin')) {
    const otherAdmins = db.prepare(`
      SELECT COUNT(*) AS count FROM users
      WHERE role = 'admin' AND is_active = 1 AND id <> ?
    `).get(id).count;
    if (otherAdmins === 0) {
      return response.status(400).json({ error: 'At least one active administrator is required.' });
    }
  }

  if (db.prepare('SELECT 1 FROM users WHERE username = ? AND id <> ?').get(employee.username, id)) {
    return conflict(response, 'Username');
  }

  const update = employee.password
    ? db.prepare(`
        UPDATE users SET name = ?, username = ?, password_hash = ?, role = ?,
          is_active = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
      `).run(
        employee.name,
        employee.username,
        bcrypt.hashSync(employee.password, 10),
        employee.role,
        employee.is_active,
        id,
      )
    : db.prepare(`
        UPDATE users SET name = ?, username = ?, role = ?, is_active = ?,
          updated_at = CURRENT_TIMESTAMP WHERE id = ?
      `).run(employee.name, employee.username, employee.role, employee.is_active, id);

  if (!employee.is_active) {
    db.prepare('DELETE FROM auth_sessions WHERE user_id = ?').run(id);
  }

  const updated = db.prepare(`
    SELECT id, name, username, role, is_active, created_at, updated_at
    FROM users WHERE id = ?
  `).get(id);
  response.json({ data: updated, changes: update.changes });
});

function categoryPayload(body) {
  const name = cleanText(body.name);
  if (name.length < 2 || name.length > 50) {
    return { error: 'Category name must be between 2 and 50 characters.' };
  }
  if (!isBoolean(body.is_active)) return { error: 'Category active status is required.' };
  return { value: { name, is_active: booleanInt(body.is_active) } };
}

adminRouter.get('/categories', (_request, response) => {
  const categories = db.prepare(`
    SELECT categories.id, categories.name, categories.is_active, categories.created_at,
      COUNT(menu_items.id) AS item_count
    FROM categories
    LEFT JOIN menu_items ON menu_items.category_id = categories.id
    GROUP BY categories.id
    ORDER BY categories.is_active DESC, categories.name COLLATE NOCASE
  `).all();
  response.json({ data: categories });
});

adminRouter.post('/categories', (request, response) => {
  const parsed = categoryPayload(request.body);
  if (parsed.error) return response.status(400).json({ error: parsed.error });
  const category = parsed.value;
  if (db.prepare('SELECT 1 FROM categories WHERE name = ? COLLATE NOCASE').get(category.name)) {
    return conflict(response, 'Category name');
  }
  const result = db.prepare('INSERT INTO categories (name, is_active) VALUES (?, ?)')
    .run(category.name, category.is_active);
  response.status(201).json({
    data: db.prepare(`
      SELECT id, name, is_active, created_at, 0 AS item_count
      FROM categories WHERE id = ?
    `).get(result.lastInsertRowid),
  });
});

adminRouter.put('/categories/:id', (request, response) => {
  if (!positiveId(request.params.id)) return response.status(400).json({ error: 'Invalid category id.' });
  const id = Number(request.params.id);
  if (!db.prepare('SELECT 1 FROM categories WHERE id = ?').get(id)) {
    return response.status(404).json({ error: 'Category was not found.' });
  }
  const parsed = categoryPayload(request.body);
  if (parsed.error) return response.status(400).json({ error: parsed.error });
  const category = parsed.value;
  if (db.prepare('SELECT 1 FROM categories WHERE name = ? COLLATE NOCASE AND id <> ?').get(category.name, id)) {
    return conflict(response, 'Category name');
  }
  db.prepare('UPDATE categories SET name = ?, is_active = ? WHERE id = ?')
    .run(category.name, category.is_active, id);
  const updated = db.prepare(`
    SELECT categories.id, categories.name, categories.is_active, categories.created_at,
      COUNT(menu_items.id) AS item_count
    FROM categories LEFT JOIN menu_items ON menu_items.category_id = categories.id
    WHERE categories.id = ? GROUP BY categories.id
  `).get(id);
  response.json({ data: updated });
});

function menuItemPayload(body) {
  const name = cleanText(body.name);
  const categoryId = Number(body.category_id);
  const priceCents = Number(body.price_cents);
  if (name.length < 2 || name.length > 80) return { error: 'Menu item name must be between 2 and 80 characters.' };
  if (!Number.isInteger(categoryId) || categoryId < 1) return { error: 'Select a valid category.' };
  if (!Number.isInteger(priceCents) || priceCents < 0 || priceCents > 100000000) {
    return { error: 'Price must be a valid non-negative amount.' };
  }
  if (!isBoolean(body.is_available) || !isBoolean(body.is_active)) {
    return { error: 'Menu item availability and active status are required.' };
  }
  return {
    value: {
      name,
      category_id: categoryId,
      price_cents: priceCents,
      is_available: booleanInt(body.is_available),
      is_active: booleanInt(body.is_active),
    },
  };
}

const menuItemSelect = `
  SELECT menu_items.id, menu_items.category_id, menu_items.name,
    menu_items.price_cents, menu_items.is_available, menu_items.is_active,
    menu_items.created_at, menu_items.updated_at, categories.name AS category_name
  FROM menu_items INNER JOIN categories ON categories.id = menu_items.category_id
`;

adminRouter.get('/menu-items', (_request, response) => {
  const items = db.prepare(`${menuItemSelect}
    ORDER BY menu_items.is_active DESC, categories.name COLLATE NOCASE, menu_items.name COLLATE NOCASE
  `).all();
  response.json({ data: items });
});

adminRouter.post('/menu-items', (request, response) => {
  const parsed = menuItemPayload(request.body);
  if (parsed.error) return response.status(400).json({ error: parsed.error });
  const item = parsed.value;
  if (!db.prepare('SELECT 1 FROM categories WHERE id = ? AND is_active = 1').get(item.category_id)) {
    return response.status(400).json({ error: 'Select an active category.' });
  }
  if (db.prepare('SELECT 1 FROM menu_items WHERE name = ? COLLATE NOCASE').get(item.name)) {
    return conflict(response, 'Menu item name');
  }
  const result = db.prepare(`
    INSERT INTO menu_items (category_id, name, price_cents, is_available, is_active)
    VALUES (?, ?, ?, ?, ?)
  `).run(item.category_id, item.name, item.price_cents, item.is_available, item.is_active);
  response.status(201).json({
    data: db.prepare(`${menuItemSelect} WHERE menu_items.id = ?`).get(result.lastInsertRowid),
  });
});

adminRouter.put('/menu-items/:id', (request, response) => {
  if (!positiveId(request.params.id)) return response.status(400).json({ error: 'Invalid menu item id.' });
  const id = Number(request.params.id);
  if (!db.prepare('SELECT 1 FROM menu_items WHERE id = ?').get(id)) {
    return response.status(404).json({ error: 'Menu item was not found.' });
  }
  const parsed = menuItemPayload(request.body);
  if (parsed.error) return response.status(400).json({ error: parsed.error });
  const item = parsed.value;
  const category = db.prepare('SELECT is_active FROM categories WHERE id = ?').get(item.category_id);
  if (!category) {
    return response.status(400).json({ error: 'Select a valid category.' });
  }
  if (item.is_active && !category.is_active) {
    return response.status(400).json({ error: 'An active menu item must use an active category.' });
  }
  if (db.prepare('SELECT 1 FROM menu_items WHERE name = ? COLLATE NOCASE AND id <> ?').get(item.name, id)) {
    return conflict(response, 'Menu item name');
  }
  db.prepare(`
    UPDATE menu_items SET category_id = ?, name = ?, price_cents = ?,
      is_available = ?, is_active = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
  `).run(item.category_id, item.name, item.price_cents, item.is_available, item.is_active, id);
  response.json({ data: db.prepare(`${menuItemSelect} WHERE menu_items.id = ?`).get(id) });
});

function tablePayload(body) {
  const tableNumber = Number(body.table_number);
  const capacity = Number(body.capacity);
  if (!Number.isInteger(tableNumber) || tableNumber < 1 || tableNumber > 999) {
    return { error: 'Table number must be a whole number from 1 to 999.' };
  }
  if (!Number.isInteger(capacity) || capacity < 1 || capacity > 50) {
    return { error: 'Capacity must be a whole number from 1 to 50.' };
  }
  if (!isBoolean(body.is_active)) return { error: 'Table active status is required.' };
  return { value: { table_number: tableNumber, capacity, is_active: booleanInt(body.is_active) } };
}

adminRouter.get('/tables', (_request, response) => {
  const tables = db.prepare(`
    SELECT id, table_number, capacity,
      CASE
        WHEN status = 'occupied' OR EXISTS (
          SELECT 1 FROM orders
          WHERE orders.table_id = restaurant_tables.id
            AND orders.status IN ('pending', 'preparing', 'ready')
        ) THEN 'occupied'
        ELSE 'available'
      END AS status,
      is_active
    FROM restaurant_tables ORDER BY is_active DESC, table_number
  `).all();
  response.json({ data: tables });
});

adminRouter.post('/tables', (request, response) => {
  const parsed = tablePayload(request.body);
  if (parsed.error) return response.status(400).json({ error: parsed.error });
  const table = parsed.value;
  if (db.prepare('SELECT 1 FROM restaurant_tables WHERE table_number = ?').get(table.table_number)) {
    return conflict(response, 'Table number');
  }
  const result = db.prepare(`
    INSERT INTO restaurant_tables (table_number, capacity, is_active) VALUES (?, ?, ?)
  `).run(table.table_number, table.capacity, table.is_active);
  response.status(201).json({
    data: db.prepare(`
      SELECT id, table_number, capacity, status, is_active
      FROM restaurant_tables WHERE id = ?
    `).get(result.lastInsertRowid),
  });
});

adminRouter.put('/tables/:id', (request, response) => {
  if (!positiveId(request.params.id)) return response.status(400).json({ error: 'Invalid table id.' });
  const id = Number(request.params.id);
  const current = db.prepare(`
    SELECT id, status,
      EXISTS (
        SELECT 1 FROM orders
        WHERE orders.table_id = restaurant_tables.id
          AND orders.status IN ('pending', 'preparing', 'ready')
      ) AS has_active_order
    FROM restaurant_tables WHERE id = ?
  `).get(id);
  if (!current) return response.status(404).json({ error: 'Table was not found.' });
  const parsed = tablePayload(request.body);
  if (parsed.error) return response.status(400).json({ error: parsed.error });
  const table = parsed.value;
  if (!table.is_active && (current.status === 'occupied' || current.has_active_order)) {
    return response.status(400).json({ error: 'An occupied table cannot be archived.' });
  }
  if (db.prepare('SELECT 1 FROM restaurant_tables WHERE table_number = ? AND id <> ?').get(table.table_number, id)) {
    return conflict(response, 'Table number');
  }
  db.prepare(`
    UPDATE restaurant_tables SET table_number = ?, capacity = ?, is_active = ? WHERE id = ?
  `).run(table.table_number, table.capacity, table.is_active, id);
  response.json({
    data: db.prepare(`
      SELECT id, table_number, capacity, status, is_active
      FROM restaurant_tables WHERE id = ?
    `).get(id),
  });
});
