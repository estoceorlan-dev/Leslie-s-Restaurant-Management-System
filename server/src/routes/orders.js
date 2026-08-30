import express from 'express';
import { db } from '../database/connection.js';
import { authenticate, requireRoles } from '../middleware/auth.js';

export const ordersRouter = express.Router();

ordersRouter.use(authenticate, requireRoles('admin', 'cashier'));

const orderTypes = new Set(['dine_in', 'takeout']);
const paymentMethods = new Set(['cash', 'gcash', 'maya']);
const activeOrderStatuses = ['pending', 'preparing', 'ready'];

const orderHeaderSelect = `
  SELECT orders.id, orders.order_number, orders.order_type, orders.table_id,
    restaurant_tables.table_number, orders.cashier_id, users.name AS cashier_name,
    orders.status, orders.payment_method, orders.subtotal_cents,
    orders.total_cents, orders.amount_received_cents, orders.change_cents,
    orders.created_at, orders.updated_at
  FROM orders
  INNER JOIN users ON users.id = orders.cashier_id
  LEFT JOIN restaurant_tables ON restaurant_tables.id = orders.table_id
`;

function getOrder(id) {
  const order = db.prepare(`${orderHeaderSelect} WHERE orders.id = ?`).get(id);
  if (!order) return null;

  order.items = db.prepare(`
    SELECT id, menu_item_id, item_name, quantity, unit_price_cents,
      subtotal_cents, notes
    FROM order_items
    WHERE order_id = ?
    ORDER BY id
  `).all(id);

  return order;
}

function parseOrder(body) {
  if (!body || typeof body !== 'object') return { error: 'Order details are required.' };

  const orderType = body.order_type;
  const paymentMethod = body.payment_method;
  const tableId = body.table_id === null || body.table_id === undefined || body.table_id === ''
    ? null
    : Number(body.table_id);

  if (!orderTypes.has(orderType)) return { error: 'Select dine-in or takeout.' };
  if (!paymentMethods.has(paymentMethod)) return { error: 'Select cash, GCash, or Maya.' };
  if (orderType === 'dine_in' && (!Number.isInteger(tableId) || tableId < 1)) {
    return { error: 'Select an available table for a dine-in order.' };
  }
  if (orderType === 'takeout' && tableId !== null) {
    return { error: 'A takeout order cannot be assigned to a table.' };
  }
  if (!Array.isArray(body.items) || body.items.length === 0) {
    return { error: 'Add at least one menu item to the order.' };
  }
  if (body.items.length > 50) return { error: 'An order cannot contain more than 50 different items.' };

  const seenIds = new Set();
  const items = [];
  for (const rawItem of body.items) {
    const menuItemId = Number(rawItem?.menu_item_id);
    const quantity = Number(rawItem?.quantity);
    const notes = typeof rawItem?.notes === 'string' ? rawItem.notes.trim() : '';

    if (!Number.isInteger(menuItemId) || menuItemId < 1) {
      return { error: 'Every order line must reference a valid menu item.' };
    }
    if (seenIds.has(menuItemId)) return { error: 'Duplicate menu items are not allowed in an order.' };
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 99) {
      return { error: 'Each item quantity must be a whole number from 1 to 99.' };
    }
    if (notes.length > 250) return { error: 'Item notes cannot exceed 250 characters.' };

    seenIds.add(menuItemId);
    items.push({ menu_item_id: menuItemId, quantity, notes: notes || null });
  }

  const amountReceivedCents = body.amount_received_cents === null || body.amount_received_cents === undefined
    ? null
    : Number(body.amount_received_cents);
  if (
    paymentMethod === 'cash'
    && (!Number.isSafeInteger(amountReceivedCents) || amountReceivedCents < 0)
  ) {
    return { error: 'Enter a valid cash amount received.' };
  }

  return {
    value: {
      order_type: orderType,
      table_id: tableId,
      payment_method: paymentMethod,
      amount_received_cents: paymentMethod === 'cash' ? amountReceivedCents : null,
      items,
    },
  };
}

ordersRouter.get('/', (request, response) => {
  const requestedLimit = Number(request.query.limit ?? 100);
  const limit = Number.isInteger(requestedLimit)
    ? Math.min(Math.max(requestedLimit, 1), 200)
    : 100;

  const orders = db.prepare(`
    SELECT orders.id, orders.order_number, orders.order_type,
      restaurant_tables.table_number, users.name AS cashier_name,
      orders.status, orders.payment_method, orders.total_cents,
      orders.amount_received_cents, orders.change_cents, orders.created_at,
      SUM(order_items.quantity) AS total_quantity
    FROM orders
    INNER JOIN users ON users.id = orders.cashier_id
    LEFT JOIN restaurant_tables ON restaurant_tables.id = orders.table_id
    INNER JOIN order_items ON order_items.order_id = orders.id
    GROUP BY orders.id
    ORDER BY orders.id DESC
    LIMIT ?
  `).all(limit);

  response.json({ data: orders });
});

ordersRouter.get('/status-feed', (_request, response) => {
  const orders = db.prepare(`
    SELECT orders.id, orders.order_number, orders.status,
      orders.order_type, restaurant_tables.table_number,
      orders.created_at, orders.updated_at
    FROM orders
    LEFT JOIN restaurant_tables ON restaurant_tables.id = orders.table_id
    ORDER BY orders.id DESC
    LIMIT 200
  `).all();

  response.json({ data: orders });
});

ordersRouter.get('/:id', (request, response) => {
  const id = Number(request.params.id);
  if (!Number.isInteger(id) || id < 1) {
    return response.status(400).json({ error: 'Invalid order id.' });
  }

  const order = getOrder(id);
  if (!order) return response.status(404).json({ error: 'Order was not found.' });
  return response.json({ data: order });
});

ordersRouter.post('/', (request, response) => {
  const parsed = parseOrder(request.body);
  if (parsed.error) return response.status(400).json({ error: parsed.error });
  const orderInput = parsed.value;

  const findMenuItem = db.prepare(`
    SELECT menu_items.id, menu_items.name, menu_items.price_cents
    FROM menu_items
    INNER JOIN categories ON categories.id = menu_items.category_id
    WHERE menu_items.id = ?
      AND menu_items.is_active = 1
      AND menu_items.is_available = 1
      AND categories.is_active = 1
  `);

  let subtotalCents = 0;
  const pricedItems = [];
  for (const item of orderInput.items) {
    const menuItem = findMenuItem.get(item.menu_item_id);
    if (!menuItem) {
      return response.status(409).json({
        error: 'A selected menu item is no longer available. Refresh the menu and try again.',
      });
    }

    const itemSubtotal = menuItem.price_cents * item.quantity;
    if (!Number.isSafeInteger(itemSubtotal) || !Number.isSafeInteger(subtotalCents + itemSubtotal)) {
      return response.status(400).json({ error: 'The order total is too large.' });
    }
    subtotalCents += itemSubtotal;
    pricedItems.push({ ...item, ...menuItem, subtotal_cents: itemSubtotal });
  }

  if (
    orderInput.payment_method === 'cash'
    && orderInput.amount_received_cents < subtotalCents
  ) {
    return response.status(400).json({ error: 'Cash received must cover the order total.' });
  }

  const saveOrder = db.transaction(() => {
    if (orderInput.order_type === 'dine_in') {
      const table = db.prepare(`
        SELECT id FROM restaurant_tables
        WHERE id = ? AND is_active = 1 AND status = 'available'
      `).get(orderInput.table_id);
      const existingOrder = db.prepare(`
        SELECT 1 FROM orders
        WHERE table_id = ? AND status IN (${activeOrderStatuses.map(() => '?').join(', ')})
      `).get(orderInput.table_id, ...activeOrderStatuses);

      if (!table || existingOrder) {
        const error = new Error('The selected table is no longer available.');
        error.code = 'TABLE_UNAVAILABLE';
        throw error;
      }
    }

    const sequence = db.prepare(`
      SELECT COALESCE((SELECT seq + 1 FROM sqlite_sequence WHERE name = 'orders'), 1) AS next_id
    `).get().next_id;
    const datePart = new Date().toISOString().slice(0, 10).replaceAll('-', '');
    const orderNumber = `ORD-${datePart}-${String(sequence).padStart(4, '0')}`;
    const changeCents = orderInput.payment_method === 'cash'
      ? orderInput.amount_received_cents - subtotalCents
      : 0;

    const result = db.prepare(`
      INSERT INTO orders (
        order_number, order_type, table_id, cashier_id, status,
        payment_method, subtotal_cents, total_cents,
        amount_received_cents, change_cents
      ) VALUES (?, ?, ?, ?, 'pending', ?, ?, ?, ?, ?)
    `).run(
      orderNumber,
      orderInput.order_type,
      orderInput.table_id,
      request.user.id,
      orderInput.payment_method,
      subtotalCents,
      subtotalCents,
      orderInput.amount_received_cents,
      changeCents,
    );

    const insertOrderItem = db.prepare(`
      INSERT INTO order_items (
        order_id, menu_item_id, item_name, quantity,
        unit_price_cents, subtotal_cents, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    pricedItems.forEach((item) => {
      insertOrderItem.run(
        result.lastInsertRowid,
        item.menu_item_id,
        item.name,
        item.quantity,
        item.price_cents,
        item.subtotal_cents,
        item.notes,
      );
    });

    if (orderInput.table_id) {
      db.prepare(`
        UPDATE restaurant_tables SET status = 'occupied' WHERE id = ?
      `).run(orderInput.table_id);
    }

    return Number(result.lastInsertRowid);
  });

  try {
    const orderId = saveOrder();
    return response.status(201).json({ data: getOrder(orderId) });
  } catch (error) {
    if (error.code === 'TABLE_UNAVAILABLE') {
      return response.status(409).json({ error: error.message });
    }
    throw error;
  }
});
