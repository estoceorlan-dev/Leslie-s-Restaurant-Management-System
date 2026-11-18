import { decodeMenuPhoto, saveMenuPhoto } from '../menu-images.js';
import express from 'express';
import bcrypt from 'bcryptjs';
import { db, postgres } from '../database/queries.js';
import { authenticate, requireRoles } from '../middleware/auth.js';

export const adminRouter = express.Router();

adminRouter.use('/menu-items', express.json({ limit: '3mb' }));
adminRouter.use(express.json());
adminRouter.use(authenticate, requireRoles('admin'));

const roles = new Set(['admin', 'cashier', 'kitchen']);
const cleanText = (value) => (typeof value === 'string' ? value.trim() : '');
const isBoolean = (value) => typeof value === 'boolean';
const booleanInt = (value) => (value ? 1 : 0);
const positiveId = (value) => Number.isInteger(Number(value)) && Number(value) > 0;

function conflict(response, label) {
  return response.status(409).json({ error: `${label} is already in use.` });
}

function employeePayload(body = {}, { editing = false } = {}) {
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

adminRouter.get('/employees', async (_request, response) => {
  const employees = await db.all(`
    SELECT id, name, username, role, is_active, created_at, updated_at
    FROM users
    ORDER BY is_active DESC, lower(name)
  `);
  response.json({ data: employees });
});

adminRouter.post('/employees', async (request, response) => {
  const parsed = employeePayload(request.body);
  if (parsed.error) return response.status(400).json({ error: parsed.error });
  const employee = parsed.value;

  if (await db.get('SELECT 1 FROM users WHERE username = ?', employee.username)) {
    return conflict(response, 'Username');
  }

  const result = await db.get(`
    INSERT INTO users (name, username, password_hash, role, is_active)
    VALUES (?, ?, ?, ?, ?) RETURNING id
  `, employee.name,
    employee.username,
    await bcrypt.hash(employee.password, 10),
    employee.role,
    employee.is_active);

  const created = await db.get(`
    SELECT id, name, username, role, is_active, created_at, updated_at
    FROM users WHERE id = ?
  `, result.id);
  response.status(201).json({ data: created });
});

adminRouter.put('/employees/:id', async (request, response) => {
  if (!positiveId(request.params.id)) {
    return response.status(400).json({ error: 'Invalid employee id.' });
  }
  const id = Number(request.params.id);
  const parsed = employeePayload(request.body, { editing: true });
  if (parsed.error) return response.status(400).json({ error: parsed.error });
  const employee = parsed.value;

  if (id === request.user.id && (!employee.is_active || employee.role !== 'admin')) {
    return response.status(400).json({ error: 'You cannot deactivate or remove the admin role from your own account.' });
  }

  const passwordHash = employee.password ? await bcrypt.hash(employee.password, 10) : null;
  const updated = await db.transaction(async (tx) => {
    if (postgres) await tx.run('LOCK TABLE users IN SHARE ROW EXCLUSIVE MODE');
    const current = await tx.get('SELECT role, is_active FROM users WHERE id = ?', id);
    if (!current) return { status: 404, error: 'Employee was not found.' };
    if (current.role === 'admin' && current.is_active && (!employee.is_active || employee.role !== 'admin')) {
      const other = await tx.get("SELECT 1 FROM users WHERE role = 'admin' AND is_active = 1 AND id <> ? LIMIT 1", id);
      if (!other) return { status: 400, error: 'At least one active administrator is required.' };
    }
    if (await tx.get('SELECT 1 FROM users WHERE username = ? AND id <> ?', employee.username, id)) {
      return { status: 409, error: 'Username is already in use.' };
    }
    const data = await tx.get(`
      UPDATE users SET name = ?, username = ?, role = ?, is_active = ?,
        password_hash = COALESCE(?, password_hash), updated_at = CURRENT_TIMESTAMP
      WHERE id = ? RETURNING id, name, username, role, is_active, created_at, updated_at
    `, employee.name, employee.username, employee.role, employee.is_active, passwordHash, id);
    if (!employee.is_active || passwordHash) await tx.run('DELETE FROM auth_sessions WHERE user_id = ?', id);
    return { data, changes: 1 };
  });
  if (updated.error) return response.status(updated.status).json({ error: updated.error });
  return response.json(updated);
});

function categoryPayload(body = {}) {
  const name = cleanText(body.name);
  if (name.length < 2 || name.length > 50) {
    return { error: 'Category name must be between 2 and 50 characters.' };
  }
  if (!isBoolean(body.is_active)) return { error: 'Category active status is required.' };
  return { value: { name, is_active: booleanInt(body.is_active) } };
}

adminRouter.get('/categories', async (_request, response) => {
  const categories = await db.all(`
    SELECT categories.id, categories.name, categories.is_active, categories.created_at,
      COUNT(menu_items.id) AS item_count
    FROM categories
    LEFT JOIN menu_items ON menu_items.category_id = categories.id
    GROUP BY categories.id
    ORDER BY categories.is_active DESC, lower(categories.name)
  `);
  response.json({ data: categories });
});

adminRouter.post('/categories', async (request, response) => {
  const parsed = categoryPayload(request.body);
  if (parsed.error) return response.status(400).json({ error: parsed.error });
  const category = parsed.value;
  if (await db.get('SELECT 1 FROM categories WHERE lower(name) = lower(?)', category.name)) {
    return conflict(response, 'Category name');
  }
  const result = await db.get('INSERT INTO categories (name, is_active) VALUES (?, ?) RETURNING id', category.name, category.is_active);
  response.status(201).json({
    data: await db.get(`
      SELECT id, name, is_active, created_at, 0 AS item_count
      FROM categories WHERE id = ?
    `, result.id),
  });
});

adminRouter.put('/categories/:id', async (request, response) => {
  if (!positiveId(request.params.id)) return response.status(400).json({ error: 'Invalid category id.' });
  const id = Number(request.params.id);
  if (!await db.get('SELECT 1 FROM categories WHERE id = ?', id)) {
    return response.status(404).json({ error: 'Category was not found.' });
  }
  const parsed = categoryPayload(request.body);
  if (parsed.error) return response.status(400).json({ error: parsed.error });
  const category = parsed.value;
  if (await db.get('SELECT 1 FROM categories WHERE lower(name) = lower(?) AND id <> ?', category.name, id)) {
    return conflict(response, 'Category name');
  }
  await db.run('UPDATE categories SET name = ?, is_active = ? WHERE id = ?', category.name, category.is_active, id);
  const updated = await db.get(`
    SELECT categories.id, categories.name, categories.is_active, categories.created_at,
      COUNT(menu_items.id) AS item_count
    FROM categories LEFT JOIN menu_items ON menu_items.category_id = categories.id
    WHERE categories.id = ? GROUP BY categories.id
  `, id);
  response.json({ data: updated });
});

async function menuItemPayload(body) {
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
  let photo;
  try {
    photo = await decodeMenuPhoto(body.photo);
  } catch (error) {
    return { error: error.message };
  }
  return {
    value: {
      photo,
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
    menu_images.version AS photo_version, menu_items.created_at, menu_items.updated_at, categories.name AS category_name
  FROM menu_items INNER JOIN categories ON categories.id = menu_items.category_id
  LEFT JOIN menu_images ON menu_images.menu_item_id = menu_items.id
`;

adminRouter.get('/menu-items', async (_request, response) => {
  const items = await db.all(`${menuItemSelect}
    ORDER BY menu_items.is_active DESC, lower(categories.name), lower(menu_items.name)
  `);
  response.json({ data: items });
});

adminRouter.post('/menu-items', async (request, response) => {
  const parsed = await menuItemPayload(request.body ?? {});
  if (parsed.error) return response.status(400).json({ error: parsed.error });
  const item = parsed.value;
  if (!await db.get('SELECT 1 FROM categories WHERE id = ? AND is_active = 1', item.category_id)) {
    return response.status(400).json({ error: 'Select an active category.' });
  }
  if (await db.get('SELECT 1 FROM menu_items WHERE lower(name) = lower(?)', item.name)) {
    return conflict(response, 'Menu item name');
  }
  const created = await db.transaction(async (tx) => {
    const { id } = await tx.get(`
      INSERT INTO menu_items (category_id, name, price_cents, is_available, is_active)
      VALUES (?, ?, ?, ?, ?) RETURNING id
    `, item.category_id, item.name, item.price_cents, item.is_available, item.is_active);
    await saveMenuPhoto(tx, id, item.photo);
    return tx.get(`${menuItemSelect} WHERE menu_items.id = ?`, id);
  });
  response.status(201).json({ data: created });
});

adminRouter.put('/menu-items/:id', async (request, response) => {
  if (!positiveId(request.params.id)) return response.status(400).json({ error: 'Invalid menu item id.' });
  const id = Number(request.params.id);
  if (!await db.get('SELECT 1 FROM menu_items WHERE id = ?', id)) {
    return response.status(404).json({ error: 'Menu item was not found.' });
  }
  const parsed = await menuItemPayload(request.body ?? {});
  if (parsed.error) return response.status(400).json({ error: parsed.error });
  const item = parsed.value;
  const category = await db.get('SELECT is_active FROM categories WHERE id = ?', item.category_id);
  if (!category) {
    return response.status(400).json({ error: 'Select a valid category.' });
  }
  if (item.is_active && !category.is_active) {
    return response.status(400).json({ error: 'An active menu item must use an active category.' });
  }
  if (await db.get('SELECT 1 FROM menu_items WHERE lower(name) = lower(?) AND id <> ?', item.name, id)) {
    return conflict(response, 'Menu item name');
  }
  const updated = await db.transaction(async (tx) => {
    await tx.run(`
      UPDATE menu_items SET category_id = ?, name = ?, price_cents = ?,
        is_available = ?, is_active = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
    `, item.category_id, item.name, item.price_cents, item.is_available, item.is_active, id);
    await saveMenuPhoto(tx, id, item.photo);
    return tx.get(`${menuItemSelect} WHERE menu_items.id = ?`, id);
  });
  response.json({ data: updated });
});

function tablePayload(body = {}) {
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

adminRouter.get('/tables', async (_request, response) => {
  const tables = await db.all(`
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
  `);
  response.json({ data: tables });
});

adminRouter.post('/tables', async (request, response) => {
  const parsed = tablePayload(request.body);
  if (parsed.error) return response.status(400).json({ error: parsed.error });
  const table = parsed.value;
  if (await db.get('SELECT 1 FROM restaurant_tables WHERE table_number = ?', table.table_number)) {
    return conflict(response, 'Table number');
  }
  const result = await db.get(`
    INSERT INTO restaurant_tables (table_number, capacity, is_active) VALUES (?, ?, ?) RETURNING id
  `, table.table_number, table.capacity, table.is_active);
  response.status(201).json({
    data: await db.get(`
      SELECT id, table_number, capacity, status, is_active
      FROM restaurant_tables WHERE id = ?
    `, result.id),
  });
});

adminRouter.put('/tables/:id', async (request, response) => {
  if (!positiveId(request.params.id)) return response.status(400).json({ error: 'Invalid table id.' });
  const id = Number(request.params.id);
  const current = await db.get(`
    SELECT id, status,
      EXISTS (
        SELECT 1 FROM orders
        WHERE orders.table_id = restaurant_tables.id
          AND orders.status IN ('pending', 'preparing', 'ready')
      ) AS has_active_order
    FROM restaurant_tables WHERE id = ?
  `, id);
  if (!current) return response.status(404).json({ error: 'Table was not found.' });
  const parsed = tablePayload(request.body);
  if (parsed.error) return response.status(400).json({ error: parsed.error });
  const table = parsed.value;
  if (!table.is_active && (current.status === 'occupied' || current.has_active_order)) {
    return response.status(400).json({ error: 'An occupied table cannot be archived.' });
  }
  if (await db.get('SELECT 1 FROM restaurant_tables WHERE table_number = ? AND id <> ?', table.table_number, id)) {
    return conflict(response, 'Table number');
  }
  const changes = await db.run(`
    UPDATE restaurant_tables SET table_number = ?, capacity = ?, is_active = ?
    WHERE id = ? AND (? = 1 OR status = 'available')
  `, table.table_number, table.capacity, table.is_active, id, table.is_active);
  if (!changes) return response.status(409).json({ error: 'The table is now occupied.' });
  response.json({
    data: await db.get(`
      SELECT id, table_number, capacity, status, is_active
      FROM restaurant_tables WHERE id = ?
    `, id),
  });
});
