import express from 'express';
import { db } from '../database/connection.js';
import { authenticate, requireRoles } from '../middleware/auth.js';

export const reportsRouter = express.Router();

reportsRouter.use(authenticate, requireRoles('admin'));

const paymentMethods = ['cash', 'gcash', 'maya'];

function localDateString(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function validDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function parseDateRange(query) {
  const today = localDateString();
  const from = typeof query.from === 'string' && query.from ? query.from : today;
  const to = typeof query.to === 'string' && query.to ? query.to : from;
  if (!validDate(from) || !validDate(to)) {
    return { error: 'Report dates must use the YYYY-MM-DD format.' };
  }
  if (from > to) return { error: 'The start date cannot be after the end date.' };
  return { value: { from, to } };
}

reportsRouter.get('/sales', (request, response) => {
  const parsed = parseDateRange(request.query);
  if (parsed.error) return response.status(400).json({ error: parsed.error });
  const { from, to } = parsed.value;

  const completedOrderFilter = `
    orders.status = 'completed'
    AND date(orders.created_at, 'localtime') BETWEEN ? AND ?
  `;
  const orderSummary = db.prepare(`
    SELECT COUNT(*) AS completed_orders,
      COALESCE(SUM(total_cents), 0) AS total_sales_cents,
      COALESCE(ROUND(AVG(total_cents)), 0) AS average_order_cents
    FROM orders
    WHERE ${completedOrderFilter}
  `).get(from, to);
  const itemSummary = db.prepare(`
    SELECT COALESCE(SUM(order_items.quantity), 0) AS items_sold
    FROM order_items
    INNER JOIN orders ON orders.id = order_items.order_id
    WHERE ${completedOrderFilter}
  `).get(from, to);

  const paymentRows = db.prepare(`
    SELECT payment_method, COUNT(*) AS order_count,
      COALESCE(SUM(total_cents), 0) AS total_cents
    FROM orders
    WHERE ${completedOrderFilter}
    GROUP BY payment_method
  `).all(from, to);
  const paymentsByMethod = new Map(
    paymentRows.map((row) => [row.payment_method, row]),
  );

  const dailySales = db.prepare(`
    SELECT date(created_at, 'localtime') AS date,
      COUNT(*) AS order_count, COALESCE(SUM(total_cents), 0) AS total_cents
    FROM orders
    WHERE ${completedOrderFilter}
    GROUP BY date(created_at, 'localtime')
    ORDER BY date
  `).all(from, to);

  const bestSellers = db.prepare(`
    SELECT order_items.menu_item_id, order_items.item_name,
      SUM(order_items.quantity) AS quantity_sold,
      SUM(order_items.subtotal_cents) AS sales_cents
    FROM order_items
    INNER JOIN orders ON orders.id = order_items.order_id
    WHERE ${completedOrderFilter}
    GROUP BY order_items.menu_item_id, order_items.item_name
    ORDER BY quantity_sold DESC, sales_cents DESC, order_items.item_name COLLATE NOCASE
    LIMIT 10
  `).all(from, to);

  return response.json({
    data: {
      range: { from, to },
      generated_at: new Date().toISOString(),
      summary: { ...orderSummary, ...itemSummary },
      payment_methods: paymentMethods.map((paymentMethod) => (
        paymentsByMethod.get(paymentMethod) ?? {
          payment_method: paymentMethod,
          order_count: 0,
          total_cents: 0,
        }
      )),
      daily_sales: dailySales,
      best_sellers: bestSellers,
    },
  });
});

reportsRouter.get('/inventory', (_request, response) => {
  const items = db.prepare(`
    SELECT id, name, unit, quantity, low_stock_level,
      quantity <= low_stock_level AS is_low_stock,
      quantity = 0 AS is_out_of_stock, updated_at
    FROM inventory_items
    WHERE is_active = 1
    ORDER BY is_low_stock DESC, name COLLATE NOCASE
  `).all();

  return response.json({
    data: {
      generated_at: new Date().toISOString(),
      summary: {
        active_items: items.length,
        low_stock_items: items.filter((item) => item.is_low_stock).length,
        out_of_stock_items: items.filter((item) => item.is_out_of_stock).length,
      },
      items,
    },
  });
});
