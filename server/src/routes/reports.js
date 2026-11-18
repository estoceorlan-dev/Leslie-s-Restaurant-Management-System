import express from 'express';
import { db, postgres } from '../database/queries.js';
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
  const today = postgres
    ? new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
    : localDateString();
  const from = typeof query.from === 'string' && query.from ? query.from : today;
  const to = typeof query.to === 'string' && query.to ? query.to : from;
  if (!validDate(from) || !validDate(to)) {
    return { error: 'Report dates must use the YYYY-MM-DD format.' };
  }
  if (from > to) return { error: 'The start date cannot be after the end date.' };
  return { value: { from, to } };
}

reportsRouter.get('/sales', async (request, response) => {
  const parsed = parseDateRange(request.query);
  if (parsed.error) return response.status(400).json({ error: parsed.error });
  const { from, to } = parsed.value;

  const salesDate = postgres
    ? "CAST(orders.created_at AT TIME ZONE 'Asia/Manila' AS DATE)"
    : "date(orders.created_at, 'localtime')";
  const completedOrderFilter = `
    orders.status = 'completed'
    AND ${salesDate} BETWEEN ? AND ?
  `;
  const orderSummary = await db.get(`
    SELECT COUNT(*) AS completed_orders,
      COALESCE(SUM(total_cents), 0) AS total_sales_cents,
      COALESCE(ROUND(AVG(total_cents)), 0) AS average_order_cents
    FROM orders
    WHERE ${completedOrderFilter}
  `, from, to);
  const itemSummary = await db.get(`
    SELECT COALESCE(SUM(order_items.quantity), 0) AS items_sold
    FROM order_items
    INNER JOIN orders ON orders.id = order_items.order_id
    WHERE ${completedOrderFilter}
  `, from, to);

  const paymentRows = await db.all(`
    SELECT payment_method, COUNT(*) AS order_count,
      COALESCE(SUM(total_cents), 0) AS total_cents
    FROM orders
    WHERE ${completedOrderFilter}
    GROUP BY payment_method
  `, from, to);
  const paymentsByMethod = new Map(
    paymentRows.map((row) => [row.payment_method, row]),
  );

  const dailySales = await db.all(`
    SELECT ${salesDate} AS date,
      COUNT(*) AS order_count, COALESCE(SUM(total_cents), 0) AS total_cents
    FROM orders
    WHERE ${completedOrderFilter}
    GROUP BY ${salesDate}
    ORDER BY date
  `, from, to);

  const bestSellers = await db.all(`
    SELECT order_items.menu_item_id, order_items.item_name,
      SUM(order_items.quantity) AS quantity_sold,
      SUM(order_items.subtotal_cents) AS sales_cents
    FROM order_items
    INNER JOIN orders ON orders.id = order_items.order_id
    WHERE ${completedOrderFilter}
    GROUP BY order_items.menu_item_id, order_items.item_name
    ORDER BY quantity_sold DESC, sales_cents DESC, lower(order_items.item_name)
    LIMIT 10
  `, from, to);

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

reportsRouter.get('/inventory', async (_request, response) => {
  const items = await db.all(`
    SELECT id, name, unit, quantity, low_stock_level,
      CAST(quantity <= low_stock_level AS INTEGER) AS is_low_stock,
      CAST(quantity = 0 AS INTEGER) AS is_out_of_stock, updated_at
    FROM inventory_items
    WHERE is_active = 1
    ORDER BY is_low_stock DESC, lower(name)
  `);

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
