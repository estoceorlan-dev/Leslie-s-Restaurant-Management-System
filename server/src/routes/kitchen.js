import express from 'express';
import { db } from '../database/connection.js';
import { authenticate, requireRoles } from '../middleware/auth.js';

export const kitchenRouter = express.Router();

kitchenRouter.use(authenticate, requireRoles('kitchen'));

const nextStatus = {
  pending: 'preparing',
  preparing: 'ready',
  ready: 'completed',
};

function getQueue() {
  const orders = db.prepare(`
    SELECT orders.id, orders.order_number, orders.order_type, orders.table_id,
      restaurant_tables.table_number, orders.status, orders.created_at,
      orders.updated_at
    FROM orders
    LEFT JOIN restaurant_tables ON restaurant_tables.id = orders.table_id
    WHERE orders.status IN ('pending', 'preparing', 'ready')
    ORDER BY
      CASE orders.status
        WHEN 'ready' THEN 1
        WHEN 'preparing' THEN 2
        ELSE 3
      END,
      orders.created_at,
      orders.id
  `).all();

  if (orders.length === 0) return orders;

  const orderIds = orders.map((order) => order.id);
  const placeholders = orderIds.map(() => '?').join(', ');
  const items = db.prepare(`
    SELECT id, order_id, item_name, quantity, notes
    FROM order_items
    WHERE order_id IN (${placeholders})
    ORDER BY order_id, id
  `).all(...orderIds);
  const itemsByOrder = new Map();

  items.forEach((item) => {
    const orderItems = itemsByOrder.get(item.order_id) ?? [];
    orderItems.push({
      id: item.id,
      item_name: item.item_name,
      quantity: item.quantity,
      notes: item.notes,
    });
    itemsByOrder.set(item.order_id, orderItems);
  });

  return orders.map((order) => ({
    ...order,
    items: itemsByOrder.get(order.id) ?? [],
  }));
}

kitchenRouter.get('/orders', (_request, response) => {
  response.json({ data: getQueue() });
});

kitchenRouter.put('/orders/:id/status', (request, response) => {
  const id = Number(request.params.id);
  if (!Number.isInteger(id) || id < 1) {
    return response.status(400).json({ error: 'Invalid order id.' });
  }

  const requestedStatus = request.body?.status;
  if (!Object.values(nextStatus).includes(requestedStatus)) {
    return response.status(400).json({
      error: 'Select the next valid order status.',
    });
  }

  const updateStatus = db.transaction(() => {
    const order = db.prepare(`
      SELECT id, order_number, order_type, table_id, status
      FROM orders WHERE id = ?
    `).get(id);

    if (!order) {
      const error = new Error('Order was not found.');
      error.code = 'ORDER_NOT_FOUND';
      throw error;
    }

    const expectedStatus = nextStatus[order.status];
    if (!expectedStatus) {
      const error = new Error('This order is no longer active in the kitchen queue.');
      error.code = 'ORDER_INACTIVE';
      throw error;
    }
    if (requestedStatus !== expectedStatus) {
      const error = new Error(
        `Order ${order.order_number} must move from ${order.status} to ${expectedStatus}.`,
      );
      error.code = 'INVALID_TRANSITION';
      throw error;
    }

    const update = db.prepare(`
      UPDATE orders
      SET status = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND status = ?
    `).run(requestedStatus, id, order.status);

    if (update.changes !== 1) {
      const error = new Error('The order changed on another screen. Refresh the queue and try again.');
      error.code = 'STALE_ORDER';
      throw error;
    }

    if (requestedStatus === 'completed' && order.table_id) {
      db.prepare(`
        UPDATE restaurant_tables
        SET status = 'available'
        WHERE id = ?
          AND NOT EXISTS (
            SELECT 1 FROM orders
            WHERE table_id = ?
              AND status IN ('pending', 'preparing', 'ready')
          )
      `).run(order.table_id, order.table_id);
    }

    return db.prepare(`
      SELECT orders.id, orders.order_number, orders.order_type,
        restaurant_tables.table_number, orders.status,
        orders.created_at, orders.updated_at
      FROM orders
      LEFT JOIN restaurant_tables ON restaurant_tables.id = orders.table_id
      WHERE orders.id = ?
    `).get(id);
  });

  try {
    return response.json({ data: updateStatus() });
  } catch (error) {
    if (error.code === 'ORDER_NOT_FOUND') {
      return response.status(404).json({ error: error.message });
    }
    if (['ORDER_INACTIVE', 'INVALID_TRANSITION', 'STALE_ORDER'].includes(error.code)) {
      return response.status(409).json({ error: error.message });
    }
    throw error;
  }
});
