import path from 'node:path';
import express from 'express';
import { config } from './config.js';
import { db } from './database/connection.js';
import { authenticate, requireRoles } from './middleware/auth.js';
import { adminRouter } from './routes/admin.js';
import { authRouter } from './routes/auth.js';
import { kitchenRouter } from './routes/kitchen.js';
import { inventoryRouter } from './routes/inventory.js';
import { ordersRouter } from './routes/orders.js';
import { reportsRouter } from './routes/reports.js';

export const app = express();

app.disable('x-powered-by');
app.use(express.json());

app.get('/api/health', (_request, response) => {
  db.prepare('SELECT 1').get();
  response.json({
    status: 'ok',
    service: 'Express API',
    database: 'SQLite connected',
  });
});

app.use('/api/auth', authRouter);
app.use('/api/admin', adminRouter);
app.use('/api/inventory', inventoryRouter);
app.use('/api/kitchen', kitchenRouter);
app.use('/api/orders', ordersRouter);
app.use('/api/reports', reportsRouter);

app.get('/api/menu-items', authenticate, requireRoles('admin', 'cashier'), (_request, response) => {
  const menuItems = db
    .prepare(`
      SELECT
        menu_items.id,
        menu_items.name,
        menu_items.price_cents,
        menu_items.is_available,
        categories.name AS category_name
      FROM menu_items
      INNER JOIN categories ON categories.id = menu_items.category_id
      WHERE menu_items.is_active = 1
        AND menu_items.is_available = 1
        AND categories.is_active = 1
      ORDER BY categories.name, menu_items.name
    `)
    .all();

  response.json({ data: menuItems });
});

app.get('/api/tables', authenticate, requireRoles('admin', 'cashier'), (_request, response) => {
  const tables = db
    .prepare(`
      SELECT id, table_number, capacity,
        CASE
          WHEN status = 'occupied' OR EXISTS (
            SELECT 1 FROM orders
            WHERE orders.table_id = restaurant_tables.id
              AND orders.status IN ('pending', 'preparing', 'ready')
          ) THEN 'occupied'
          ELSE 'available'
        END AS status
      FROM restaurant_tables
      WHERE is_active = 1
      ORDER BY table_number
    `)
    .all();

  response.json({ data: tables });
});

app.get('/api/inventory-items', authenticate, requireRoles('admin'), (_request, response) => {
  const inventoryItems = db
    .prepare(`
      SELECT
        id,
        name,
        unit,
        quantity,
        low_stock_level,
        quantity <= low_stock_level AS is_low_stock
      FROM inventory_items
      WHERE is_active = 1
      ORDER BY name
    `)
    .all();

  response.json({ data: inventoryItems });
});

app.use('/api', (_request, response) => {
  response.status(404).json({ error: 'API endpoint not found.' });
});

app.use(express.static(config.clientDistPath));

app.get(/^\/(?!api(?:\/|$)).*/, (_request, response, next) => {
  response.sendFile(path.join(config.clientDistPath, 'index.html'), (error) => {
    if (error) next(error);
  });
});

app.use((error, _request, response, _next) => {
  console.error(error);
  if (error?.type === 'entity.parse.failed') {
    return response.status(400).json({ error: 'Request body must contain valid JSON.' });
  }
  response.status(500).json({ error: 'An unexpected server error occurred.' });
});
