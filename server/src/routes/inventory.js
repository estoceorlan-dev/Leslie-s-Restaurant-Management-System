import express from 'express';
import { db } from '../database/connection.js';
import { authenticate, requireRoles } from '../middleware/auth.js';

export const inventoryRouter = express.Router();

inventoryRouter.use(authenticate, requireRoles('admin'));

const movementTypes = new Set(['addition', 'deduction']);
const cleanText = (value) => (typeof value === 'string' ? value.trim() : '');
const isBoolean = (value) => typeof value === 'boolean';

const inventoryItemSelect = `
  SELECT inventory_items.id, inventory_items.name, inventory_items.unit,
    inventory_items.quantity, inventory_items.low_stock_level,
    inventory_items.is_active, inventory_items.created_at,
    inventory_items.updated_at,
    inventory_items.quantity <= inventory_items.low_stock_level AS is_low_stock,
    (SELECT COUNT(*) FROM stock_movements
      WHERE stock_movements.inventory_item_id = inventory_items.id) AS movement_count,
    (SELECT MAX(created_at) FROM stock_movements
      WHERE stock_movements.inventory_item_id = inventory_items.id) AS last_movement_at
  FROM inventory_items
`;

function getInventoryItem(id) {
  return db.prepare(`${inventoryItemSelect} WHERE inventory_items.id = ?`).get(id);
}

function parseQuantity(value, label, { allowZero = true } = {}) {
  const quantity = Number(value);
  const normalized = Math.round(quantity * 1000) / 1000;
  if (
    !Number.isFinite(quantity)
    || quantity < (allowZero ? 0 : Number.EPSILON)
    || quantity > 1_000_000_000
    || Math.abs(quantity - normalized) > 1e-9
  ) {
    return { error: `${label} must be a ${allowZero ? 'non-negative' : 'positive'} number with up to three decimal places.` };
  }
  return { value: normalized };
}

function parseInventoryItem(body, { creating = false } = {}) {
  if (!body || typeof body !== 'object') {
    return { error: 'Inventory item details are required.' };
  }

  const name = cleanText(body.name);
  const unit = cleanText(body.unit);
  if (name.length < 2 || name.length > 80) {
    return { error: 'Item name must be between 2 and 80 characters.' };
  }
  if (unit.length < 1 || unit.length > 30) {
    return { error: 'Unit must be between 1 and 30 characters.' };
  }
  if (!isBoolean(body.is_active)) {
    return { error: 'Inventory item active status is required.' };
  }

  const lowStock = parseQuantity(body.low_stock_level, 'Low-stock level');
  if (lowStock.error) return lowStock;

  let quantity = 0;
  if (creating) {
    const initialQuantity = parseQuantity(body.quantity, 'Initial quantity');
    if (initialQuantity.error) return initialQuantity;
    quantity = initialQuantity.value;
  }

  return {
    value: {
      name,
      unit,
      quantity,
      low_stock_level: lowStock.value,
      is_active: body.is_active ? 1 : 0,
    },
  };
}

inventoryRouter.get('/items', (_request, response) => {
  const items = db.prepare(`
    ${inventoryItemSelect}
    ORDER BY inventory_items.is_active DESC,
      is_low_stock DESC,
      inventory_items.name COLLATE NOCASE
  `).all();
  response.json({ data: items });
});

inventoryRouter.post('/items', (request, response) => {
  const parsed = parseInventoryItem(request.body, { creating: true });
  if (parsed.error) return response.status(400).json({ error: parsed.error });
  const item = parsed.value;

  if (db.prepare('SELECT 1 FROM inventory_items WHERE name = ? COLLATE NOCASE').get(item.name)) {
    return response.status(409).json({ error: 'Inventory item name is already in use.' });
  }

  const createItem = db.transaction(() => {
    const result = db.prepare(`
      INSERT INTO inventory_items
        (name, unit, quantity, low_stock_level, is_active)
      VALUES (?, ?, 0, ?, ?)
    `).run(item.name, item.unit, item.low_stock_level, item.is_active);
    const id = Number(result.lastInsertRowid);

    if (item.quantity > 0) {
      db.prepare(`
        INSERT INTO stock_movements
          (inventory_item_id, user_id, movement_type, quantity, notes)
        VALUES (?, ?, 'addition', ?, 'Initial stock')
      `).run(id, request.user.id, item.quantity);
      db.prepare(`
        UPDATE inventory_items
        SET quantity = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(item.quantity, id);
    }

    return id;
  });

  const id = createItem();
  return response.status(201).json({ data: getInventoryItem(id) });
});

inventoryRouter.put('/items/:id', (request, response) => {
  const id = Number(request.params.id);
  if (!Number.isInteger(id) || id < 1) {
    return response.status(400).json({ error: 'Invalid inventory item id.' });
  }
  if (!getInventoryItem(id)) {
    return response.status(404).json({ error: 'Inventory item was not found.' });
  }

  const parsed = parseInventoryItem(request.body);
  if (parsed.error) return response.status(400).json({ error: parsed.error });
  const item = parsed.value;

  if (db.prepare(`
    SELECT 1 FROM inventory_items
    WHERE name = ? COLLATE NOCASE AND id <> ?
  `).get(item.name, id)) {
    return response.status(409).json({ error: 'Inventory item name is already in use.' });
  }

  db.prepare(`
    UPDATE inventory_items
    SET name = ?, unit = ?, low_stock_level = ?, is_active = ?,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(item.name, item.unit, item.low_stock_level, item.is_active, id);

  return response.json({ data: getInventoryItem(id) });
});

inventoryRouter.get('/movements', (request, response) => {
  const requestedLimit = Number(request.query.limit ?? 200);
  const limit = Number.isInteger(requestedLimit)
    ? Math.min(Math.max(requestedLimit, 1), 500)
    : 200;
  const itemId = request.query.item_id === undefined || request.query.item_id === ''
    ? null
    : Number(request.query.item_id);
  if (itemId !== null && (!Number.isInteger(itemId) || itemId < 1)) {
    return response.status(400).json({ error: 'Invalid inventory item filter.' });
  }

  const movements = itemId === null
    ? db.prepare(`
        SELECT stock_movements.id, stock_movements.inventory_item_id,
          inventory_items.name AS item_name, inventory_items.unit,
          stock_movements.movement_type, stock_movements.quantity,
          stock_movements.notes, stock_movements.created_at,
          users.name AS employee_name
        FROM stock_movements
        INNER JOIN inventory_items ON inventory_items.id = stock_movements.inventory_item_id
        INNER JOIN users ON users.id = stock_movements.user_id
        ORDER BY stock_movements.id DESC
        LIMIT ?
      `).all(limit)
    : db.prepare(`
        SELECT stock_movements.id, stock_movements.inventory_item_id,
          inventory_items.name AS item_name, inventory_items.unit,
          stock_movements.movement_type, stock_movements.quantity,
          stock_movements.notes, stock_movements.created_at,
          users.name AS employee_name
        FROM stock_movements
        INNER JOIN inventory_items ON inventory_items.id = stock_movements.inventory_item_id
        INNER JOIN users ON users.id = stock_movements.user_id
        WHERE stock_movements.inventory_item_id = ?
        ORDER BY stock_movements.id DESC
        LIMIT ?
      `).all(itemId, limit);

  return response.json({ data: movements });
});

inventoryRouter.post('/items/:id/movements', (request, response) => {
  const id = Number(request.params.id);
  if (!Number.isInteger(id) || id < 1) {
    return response.status(400).json({ error: 'Invalid inventory item id.' });
  }

  const movementType = cleanText(request.body?.movement_type);
  if (!movementTypes.has(movementType)) {
    return response.status(400).json({ error: 'Select stock addition or deduction.' });
  }
  const parsedQuantity = parseQuantity(request.body?.quantity, 'Movement quantity', {
    allowZero: false,
  });
  if (parsedQuantity.error) {
    return response.status(400).json({ error: parsedQuantity.error });
  }
  const notes = cleanText(request.body?.notes);
  if (notes.length > 250) {
    return response.status(400).json({ error: 'Movement notes cannot exceed 250 characters.' });
  }

  const recordMovement = db.transaction(() => {
    const current = db.prepare(`
      SELECT id, quantity, is_active FROM inventory_items WHERE id = ?
    `).get(id);
    if (!current) {
      const error = new Error('Inventory item was not found.');
      error.code = 'ITEM_NOT_FOUND';
      throw error;
    }
    if (!current.is_active) {
      const error = new Error('Archived inventory items cannot receive stock movements.');
      error.code = 'ITEM_ARCHIVED';
      throw error;
    }

    const direction = movementType === 'addition' ? 1 : -1;
    const quantity = parsedQuantity.value;
    const newQuantity = Math.round((current.quantity + direction * quantity) * 1000) / 1000;
    if (newQuantity < 0) {
      const error = new Error('Stock deduction cannot reduce the quantity below zero.');
      error.code = 'INSUFFICIENT_STOCK';
      throw error;
    }

    db.prepare(`
      UPDATE inventory_items
      SET quantity = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(newQuantity, id);
    const result = db.prepare(`
      INSERT INTO stock_movements
        (inventory_item_id, user_id, movement_type, quantity, notes)
      VALUES (?, ?, ?, ?, ?)
    `).run(id, request.user.id, movementType, quantity, notes || null);

    const movement = db.prepare(`
      SELECT stock_movements.id, stock_movements.inventory_item_id,
        inventory_items.name AS item_name, inventory_items.unit,
        stock_movements.movement_type, stock_movements.quantity,
        stock_movements.notes, stock_movements.created_at,
        users.name AS employee_name
      FROM stock_movements
      INNER JOIN inventory_items ON inventory_items.id = stock_movements.inventory_item_id
      INNER JOIN users ON users.id = stock_movements.user_id
      WHERE stock_movements.id = ?
    `).get(result.lastInsertRowid);

    return { item: getInventoryItem(id), movement };
  });

  try {
    return response.status(201).json({ data: recordMovement() });
  } catch (error) {
    if (error.code === 'ITEM_NOT_FOUND') {
      return response.status(404).json({ error: error.message });
    }
    if (['ITEM_ARCHIVED', 'INSUFFICIENT_STOCK'].includes(error.code)) {
      return response.status(409).json({ error: error.message });
    }
    throw error;
  }
});
