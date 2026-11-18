import path from 'node:path';
import express from 'express';
import { config } from './config.js';
import { db, postgres } from './database/queries.js';
import { authenticate, requireRoles } from './middleware/auth.js';
import { adminRouter } from './routes/admin.js';
import { authRouter } from './routes/auth.js';
import { kitchenRouter } from './routes/kitchen.js';
import { inventoryRouter } from './routes/inventory.js';
import { ordersRouter } from './routes/orders.js';
import { reportsRouter } from './routes/reports.js';

export const app = express();

app.disable('x-powered-by');
app.use('/api', (_request, response, next) => {
  response.set('Cache-Control', 'no-store');
  next();
});
app.use('/api/admin', adminRouter);
app.use(express.json());

app.get('/api/health', async (_request, response) => {
  await db.get('SELECT 1');
  response.json({
    status: 'ok',
    service: 'Express API',
    database: postgres ? 'PostgreSQL connected' : 'SQLite connected',
  });
});

app.use('/api/auth', authRouter);
app.use('/api/inventory', inventoryRouter);
app.use('/api/kitchen', kitchenRouter);
app.use('/api/orders', ordersRouter);
app.use('/api/reports', reportsRouter);

app.get('/api/menu-items', authenticate, requireRoles('admin', 'cashier'), async (_request, response) => {
  const menuItems = await db.all(`
      SELECT
        menu_items.id,
        menu_items.name,
        menu_images.version AS photo_version,
        menu_items.price_cents,
        menu_items.is_available,
        categories.name AS category_name
      FROM menu_items
      INNER JOIN categories ON categories.id = menu_items.category_id
      LEFT JOIN menu_images ON menu_images.menu_item_id = menu_items.id
      WHERE menu_items.is_active = 1
        AND menu_items.is_available = 1
        AND categories.is_active = 1
      ORDER BY categories.name, menu_items.name
    `);

  response.json({ data: menuItems });
});

app.get('/api/tables', authenticate, requireRoles('admin', 'cashier'), async (_request, response) => {
  const tables = await db.all(`
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
    `);

  response.json({ data: tables });
});

app.get('/api/inventory-items', authenticate, requireRoles('admin'), async (_request, response) => {
  const inventoryItems = await db.all(`
      SELECT
        id,
        name,
        unit,
        quantity,
        low_stock_level,
        CAST(quantity <= low_stock_level AS INTEGER) AS is_low_stock
      FROM inventory_items
      WHERE is_active = 1
      ORDER BY name
    `);

  response.json({ data: inventoryItems });
});

app.get('/api/menu-photos/:version', async (request, response) => {
  const image = await db.get('SELECT photo FROM menu_images WHERE version = ?', request.params.version);
  if (!image) return response.sendStatus(404);
  response.set('Cache-Control', 'public, max-age=86400, immutable');
  response.set('X-Content-Type-Options', 'nosniff');
  response.type('image/webp').send(image.photo);
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
  if (error?.type === 'entity.too.large') {
    return response.status(413).json({ error: 'The request is too large. Menu photos may be up to 2 MiB.' });
  }
  if (error.code === '23505' || error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
    return response.status(409).json({ error: 'A record with those details already exists.' });
  }
  if (error?.type === 'entity.parse.failed') {
    return response.status(400).json({ error: 'Request body must contain valid JSON.' });
  }
  console.error('API request failed:', error.code ?? error.name);
  response.status(500).json({ error: 'An unexpected server error occurred.' });
});
