import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { once } from 'node:events';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const temporaryDirectory = fs.mkdtempSync(
  path.join(os.tmpdir(), 'leslies-integration-check-'),
);
process.env.DATABASE_PATH = path.join(temporaryDirectory, 'restaurant.db');

const [
  { app },
  { db },
  { databaseCounts, initializeDatabase },
  { createInitialAdmin },
  { assertProductionReady },
  { config },
] = await Promise.all([
  import('./app.js'),
  import('./database/connection.js'),
  import('./database/init.js'),
  import('./database/create-admin.js'),
  import('./production-readiness.js'),
  import('./config.js'),
]);

const emptyCounts = initializeDatabase();
assert.deepEqual(
  emptyCounts,
  {
    users: 0,
    authSessions: 0,
    categories: 0,
    menuItems: 0,
    tables: 0,
    orders: 0,
    orderItems: 0,
    inventoryItems: 0,
    stockMovements: 0,
  },
  'Production initialization must create an empty database.',
);
assert.deepEqual(
  initializeDatabase(),
  emptyCounts,
  'Production initialization must remain empty when repeated.',
);
assert.throws(
  () => assertProductionReady(db, temporaryDirectory),
  /production frontend is missing/,
  'Production startup must explain how to build a missing frontend.',
);
assert.throws(
  () => assertProductionReady(db, config.clientDistPath),
  /No active administrator/,
  'Production startup must explain how to bootstrap an empty database.',
);

const CHECK_PASSWORD = 'Check-only-password-2026';
const initialAdmin = createInitialAdmin(db, {
  name: 'Integration Administrator',
  username: 'check_admin',
  password: CHECK_PASSWORD,
});
assert.equal(initialAdmin.role, 'admin');
assert.notEqual(
  db.prepare('SELECT password_hash FROM users WHERE id = ?').get(initialAdmin.id).password_hash,
  CHECK_PASSWORD,
  'The bootstrap password must only be stored as a hash.',
);
assert.throws(
  () => createInitialAdmin(db, {
    name: 'Second Administrator',
    username: 'second_admin',
    password: CHECK_PASSWORD,
  }),
  /account already exists/,
  'The first-administrator command must disable itself after bootstrap.',
);

db.transaction(() => {
  const insertUser = db.prepare(`
    INSERT INTO users (name, username, password_hash, role)
    VALUES (?, ?, ?, ?)
  `);
  const passwordHash = db.prepare(
    'SELECT password_hash FROM users WHERE id = ?',
  ).get(initialAdmin.id).password_hash;
  insertUser.run('Integration Cashier', 'check_cashier', passwordHash, 'cashier');
  insertUser.run('Integration Kitchen Staff', 'check_kitchen', passwordHash, 'kitchen');

  const categoryId = db.prepare(
    'INSERT INTO categories (name) VALUES (?)',
  ).run('Integration Meals').lastInsertRowid;
  const insertMenuItem = db.prepare(`
    INSERT INTO menu_items (category_id, name, price_cents)
    VALUES (?, ?, ?)
  `);
  insertMenuItem.run(categoryId, 'Integration Meal A', 12000);
  insertMenuItem.run(categoryId, 'Integration Meal B', 7500);
  db.prepare(
    'INSERT INTO restaurant_tables (table_number, capacity) VALUES (1, 4)',
  ).run();
  db.prepare(`
    INSERT INTO inventory_items (name, unit, quantity, low_stock_level)
    VALUES ('Integration Supply', 'units', 1, 2)
  `).run();
})();

const counts = databaseCounts();
assert.equal(counts.users, 3, 'Disposable checks should cover all three roles.');
assert.equal(counts.menuItems, 2, 'Disposable checks require two orderable items.');
assert.equal(counts.tables, 1, 'Disposable checks require an available table.');
assert.equal(counts.inventoryItems, 1, 'Disposable checks require an inventory item.');
assert.doesNotThrow(
  () => assertProductionReady(db, config.clientDistPath),
  'A built application with an active administrator should be production-ready.',
);
assert.doesNotThrow(
  () => assertProductionReady(db, temporaryDirectory, { requireClientBuild: false }),
  'Development startup should use Vite without requiring a production frontend build.',
);

const lowStockItems = db.prepare(
  'SELECT COUNT(*) AS count FROM inventory_items WHERE quantity <= low_stock_level',
).get().count;
assert.ok(lowStockItems >= 1, 'Expected at least one check-only low-stock item.');

const server = app.listen(0, '127.0.0.1');
await once(server, 'listening');

const createdIds = { orders: [] };
const issuedTokens = [];

try {
  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;
  const request = async (path, { token, method = 'GET', body } = {}) => {
    const response = await fetch(`${baseUrl}/api${path}`, {
      method,
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const payload = response.status === 204 ? null : await response.json();
    return { response, payload };
  };

  const login = async (username, password = CHECK_PASSWORD) => {
    const result = await request('/auth/login', {
      method: 'POST',
      body: { username, password },
    });
    assert.equal(result.response.status, 200, `${username} should be able to log in.`);
    issuedTokens.push(result.payload.data.token);
    return result.payload.data;
  };

  const healthResult = await request('/health');
  assert.equal(healthResult.response.status, 200, 'Health endpoint should return 200.');
  assert.equal(healthResult.payload.database, 'SQLite connected');

  const applicationResult = await fetch(baseUrl);
  assert.equal(applicationResult.status, 200, 'Express should serve the built React application.');
  assert.match(
    applicationResult.headers.get('content-type') ?? '',
    /^text\/html/,
    'The application entry point should be HTML.',
  );
  assert.match(
    await applicationResult.text(),
    /Leslie's Restaurant Management System/,
    'The served HTML should be the Leslie\'s application entry point.',
  );

  const unknownApiResult = await fetch(`${baseUrl}/api/does-not-exist`);
  assert.equal(unknownApiResult.status, 404, 'Unknown API paths should return 404.');
  assert.match(
    unknownApiResult.headers.get('content-type') ?? '',
    /^application\/json/,
    'Unknown API paths must not fall through to the React application.',
  );

  const unauthorized = await request('/admin/employees');
  assert.equal(unauthorized.response.status, 401, 'Admin endpoints must require authentication.');

  const failedLogin = await request('/auth/login', {
    method: 'POST',
    body: { username: 'check_admin', password: 'incorrect' },
  });
  assert.equal(failedLogin.response.status, 401, 'Incorrect credentials must be rejected.');

  const adminSession = await login('check_admin');
  assert.equal(adminSession.user.role, 'admin');
  const cashierSession = await login('check_cashier');
  const kitchenSession = await login('check_kitchen');
  assert.equal(kitchenSession.user.role, 'kitchen');

  const forbidden = await request('/admin/employees', { token: cashierSession.token });
  assert.equal(forbidden.response.status, 403, 'Cashiers must not access administration endpoints.');

  const suffix = `${Date.now()}${crypto.randomInt(1000, 9999)}`;
  const employeeResult = await request('/admin/employees', {
    token: adminSession.token,
    method: 'POST',
    body: {
      name: 'Verification Employee',
      username: `verify_${suffix}`,
      password: 'verify123',
      role: 'kitchen',
      is_active: true,
    },
  });
  assert.equal(employeeResult.response.status, 201, 'Admin should create an employee.');
  createdIds.employee = employeeResult.payload.data.id;

  const categoryResult = await request('/admin/categories', {
    token: adminSession.token,
    method: 'POST',
    body: { name: `Verification ${suffix}`, is_active: true },
  });
  assert.equal(categoryResult.response.status, 201, 'Admin should create a category.');
  createdIds.category = categoryResult.payload.data.id;

  const menuItemResult = await request('/admin/menu-items', {
    token: adminSession.token,
    method: 'POST',
    body: {
      name: `Verification Meal ${suffix}`,
      category_id: createdIds.category,
      price_cents: 12345,
      is_available: true,
      is_active: true,
    },
  });
  assert.equal(menuItemResult.response.status, 201, 'Admin should create a menu item.');
  assert.equal(menuItemResult.payload.data.price_cents, 12345);
  createdIds.menuItem = menuItemResult.payload.data.id;

  const tableResult = await request('/admin/tables', {
    token: adminSession.token,
    method: 'POST',
    body: { table_number: crypto.randomInt(100, 999), capacity: 6, is_active: true },
  });
  assert.equal(tableResult.response.status, 201, 'Admin should create a table.');
  createdIds.table = tableResult.payload.data.id;

  const archiveCategoryResult = await request(`/admin/categories/${createdIds.category}`, {
    token: adminSession.token,
    method: 'PUT',
    body: { name: categoryResult.payload.data.name, is_active: false },
  });
  assert.equal(archiveCategoryResult.response.status, 200, 'Admin should archive a category.');

  const archiveResult = await request(`/admin/menu-items/${createdIds.menuItem}`, {
    token: adminSession.token,
    method: 'PUT',
    body: {
      name: menuItemResult.payload.data.name,
      category_id: createdIds.category,
      price_cents: 12345,
      is_available: true,
      is_active: false,
    },
  });
  assert.equal(
    archiveResult.response.status,
    200,
    'Admin should archive an item even after its category is archived.',
  );
  assert.equal(archiveResult.payload.data.is_active, 0);

  const cashierMenu = await request('/menu-items', { token: cashierSession.token });
  assert.equal(cashierMenu.response.status, 200, 'Cashiers should read the available menu.');
  assert.ok(
    !cashierMenu.payload.data.some((item) => item.id === createdIds.menuItem),
    'Archived menu items must not be selectable.',
  );

  const kitchenOrderDenied = await request('/orders', {
    token: kitchenSession.token,
    method: 'POST',
    body: {
      order_type: 'takeout',
      table_id: null,
      payment_method: 'cash',
      amount_received_cents: 100000,
      items: [{ menu_item_id: cashierMenu.payload.data[0].id, quantity: 1 }],
    },
  });
  assert.equal(kitchenOrderDenied.response.status, 403, 'Kitchen staff must not create orders.');

  const unauthenticatedKitchenQueue = await request('/kitchen/orders');
  assert.equal(
    unauthenticatedKitchenQueue.response.status,
    401,
    'The kitchen queue must require authentication.',
  );
  const cashierKitchenDenied = await request('/kitchen/orders', {
    token: cashierSession.token,
  });
  assert.equal(
    cashierKitchenDenied.response.status,
    403,
    'Cashiers must not access kitchen status controls.',
  );

  const tablesForOrder = await request('/tables', { token: cashierSession.token });
  const availableTable = tablesForOrder.payload.data.find((table) => table.status === 'available');
  assert.ok(availableTable, 'Expected an available table for ordering checks.');
  const [firstMenuItem, secondMenuItem] = cashierMenu.payload.data;
  const expectedCashTotal = firstMenuItem.price_cents * 2 + secondMenuItem.price_cents;
  const baselineSales = await request('/reports/sales', { token: adminSession.token });
  assert.equal(baselineSales.response.status, 200, 'Administrators should read sales reports.');

  const underpaidOrder = await request('/orders', {
    token: cashierSession.token,
    method: 'POST',
    body: {
      order_type: 'takeout',
      table_id: null,
      payment_method: 'cash',
      amount_received_cents: expectedCashTotal - 1,
      items: [
        { menu_item_id: firstMenuItem.id, quantity: 2, notes: 'Verification note' },
        { menu_item_id: secondMenuItem.id, quantity: 1, notes: '' },
      ],
    },
  });
  assert.equal(underpaidOrder.response.status, 400, 'Underpaid cash orders must be rejected.');

  const cashOrder = await request('/orders', {
    token: cashierSession.token,
    method: 'POST',
    body: {
      order_type: 'dine_in',
      table_id: availableTable.id,
      payment_method: 'cash',
      amount_received_cents: expectedCashTotal + 5000,
      total_cents: 1,
      items: [
        { menu_item_id: firstMenuItem.id, quantity: 2, notes: 'Verification note' },
        { menu_item_id: secondMenuItem.id, quantity: 1, notes: '' },
      ],
    },
  });
  assert.equal(cashOrder.response.status, 201, 'Cashier should save a dine-in cash order.');
  createdIds.orders.push(cashOrder.payload.data.id);
  assert.equal(cashOrder.payload.data.total_cents, expectedCashTotal, 'The server must calculate the total.');
  assert.equal(cashOrder.payload.data.change_cents, 5000, 'The server must calculate cash change.');
  assert.equal(cashOrder.payload.data.items.length, 2, 'Order lines must be saved together.');
  assert.equal(cashOrder.payload.data.items[0].notes, 'Verification note');
  assert.equal(
    db.prepare('SELECT status FROM restaurant_tables WHERE id = ?').get(availableTable.id).status,
    'occupied',
    'Saving a dine-in order must persist the occupied table status.',
  );

  const occupiedTables = await request('/tables', { token: cashierSession.token });
  assert.equal(
    occupiedTables.payload.data.find((table) => table.id === availableTable.id).status,
    'occupied',
    'A table with an active dine-in order must not remain selectable.',
  );

  const archiveOccupiedTable = await request(`/admin/tables/${availableTable.id}`, {
    token: adminSession.token,
    method: 'PUT',
    body: {
      table_number: availableTable.table_number,
      capacity: availableTable.capacity,
      is_active: false,
    },
  });
  assert.equal(
    archiveOccupiedTable.response.status,
    400,
    'A table assigned to an active order must not be archived.',
  );

  const duplicateTableOrder = await request('/orders', {
    token: cashierSession.token,
    method: 'POST',
    body: {
      order_type: 'dine_in',
      table_id: availableTable.id,
      payment_method: 'gcash',
      amount_received_cents: null,
      items: [{ menu_item_id: firstMenuItem.id, quantity: 1, notes: '' }],
    },
  });
  assert.equal(duplicateTableOrder.response.status, 409, 'A table cannot have two active orders.');

  const digitalOrders = [];
  for (const paymentMethod of ['gcash', 'maya']) {
    const digitalOrder = await request('/orders', {
      token: cashierSession.token,
      method: 'POST',
      body: {
        order_type: 'takeout',
        table_id: null,
        payment_method: paymentMethod,
        amount_received_cents: null,
        items: [{ menu_item_id: firstMenuItem.id, quantity: 1, notes: '' }],
      },
    });
    assert.equal(digitalOrder.response.status, 201, `${paymentMethod} orders should be saved.`);
    assert.equal(digitalOrder.payload.data.payment_method, paymentMethod);
    assert.equal(digitalOrder.payload.data.change_cents, 0);
    createdIds.orders.push(digitalOrder.payload.data.id);
    digitalOrders.push(digitalOrder.payload.data);
  }

  const kitchenToken = kitchenSession.token;
  const kitchenQueue = await request('/kitchen/orders', { token: kitchenToken });
  assert.equal(kitchenQueue.response.status, 200, 'Kitchen staff should view the active queue.');
  assert.ok(
    createdIds.orders.every((id) => kitchenQueue.payload.data.some((order) => order.id === id)),
    'Every confirmed active order must appear in the kitchen queue.',
  );
  const queuedCashOrder = kitchenQueue.payload.data.find(
    (order) => order.id === cashOrder.payload.data.id,
  );
  assert.equal(queuedCashOrder.items.length, 2, 'Kitchen orders must include every item.');
  assert.equal(
    queuedCashOrder.items[0].notes,
    'Verification note',
    'Kitchen orders must include preparation notes.',
  );

  const skippedStatus = await request(
    `/kitchen/orders/${cashOrder.payload.data.id}/status`,
    {
      token: kitchenToken,
      method: 'PUT',
      body: { status: 'ready' },
    },
  );
  assert.equal(skippedStatus.response.status, 409, 'Kitchen status steps cannot be skipped.');

  for (const status of ['preparing', 'ready']) {
    const statusUpdate = await request(
      `/kitchen/orders/${cashOrder.payload.data.id}/status`,
      {
        token: kitchenToken,
        method: 'PUT',
        body: { status },
      },
    );
    assert.equal(statusUpdate.response.status, 200, `Kitchen staff should mark an order ${status}.`);
    assert.equal(statusUpdate.payload.data.status, status);
    assert.equal(
      db.prepare('SELECT status FROM restaurant_tables WHERE id = ?').get(availableTable.id).status,
      'occupied',
      'A dine-in table must remain occupied until completion.',
    );
  }

  const statusFeed = await request('/orders/status-feed', { token: cashierSession.token });
  assert.equal(statusFeed.response.status, 200, 'Cashiers should poll order status updates.');
  assert.equal(
    statusFeed.payload.data.find((order) => order.id === cashOrder.payload.data.id).status,
    'ready',
    'The cashier status feed must expose the latest kitchen status.',
  );

  const completedOrder = await request(
    `/kitchen/orders/${cashOrder.payload.data.id}/status`,
    {
      token: kitchenToken,
      method: 'PUT',
      body: { status: 'completed' },
    },
  );
  assert.equal(completedOrder.response.status, 200, 'Kitchen staff should complete a ready order.');
  assert.equal(completedOrder.payload.data.status, 'completed');
  assert.equal(
    db.prepare('SELECT status FROM restaurant_tables WHERE id = ?').get(availableTable.id).status,
    'available',
    'Completing a dine-in order must persist the available table status.',
  );

  const releasedTables = await request('/tables', { token: cashierSession.token });
  assert.equal(
    releasedTables.payload.data.find((table) => table.id === availableTable.id).status,
    'available',
    'The cashier table list must show the released table.',
  );
  const refreshedKitchenQueue = await request('/kitchen/orders', { token: kitchenToken });
  assert.ok(
    !refreshedKitchenQueue.payload.data.some((order) => order.id === cashOrder.payload.data.id),
    'Completed orders must leave the active kitchen queue.',
  );

  for (const status of ['preparing', 'ready', 'completed']) {
    const digitalStatusUpdate = await request(
      `/kitchen/orders/${digitalOrders[0].id}/status`,
      {
        token: kitchenToken,
        method: 'PUT',
        body: { status },
      },
    );
    assert.equal(
      digitalStatusUpdate.response.status,
      200,
      `The GCash verification order should advance to ${status}.`,
    );
  }

  const invalidReportRange = await request('/reports/sales?from=2026-08-24&to=2026-08-01', {
    token: adminSession.token,
  });
  assert.equal(invalidReportRange.response.status, 400, 'Invalid report date ranges must be rejected.');
  const salesReport = await request(
    `/reports/sales?from=${baselineSales.payload.data.range.from}&to=${baselineSales.payload.data.range.to}`,
    { token: adminSession.token },
  );
  assert.equal(salesReport.response.status, 200, 'Administrators should filter completed sales.');
  assert.equal(
    salesReport.payload.data.summary.completed_orders
      - baselineSales.payload.data.summary.completed_orders,
    2,
    'Only the two completed verification orders should be added to report counts.',
  );
  assert.equal(
    salesReport.payload.data.summary.total_sales_cents
      - baselineSales.payload.data.summary.total_sales_cents,
    expectedCashTotal + firstMenuItem.price_cents,
    'Sales totals must include completed orders and exclude the pending Maya order.',
  );
  assert.equal(
    salesReport.payload.data.summary.items_sold
      - baselineSales.payload.data.summary.items_sold,
    4,
    'The completed-order item quantity must match the saved order lines.',
  );
  const baselinePayments = new Map(
    baselineSales.payload.data.payment_methods.map((payment) => [payment.payment_method, payment]),
  );
  const reportPayments = new Map(
    salesReport.payload.data.payment_methods.map((payment) => [payment.payment_method, payment]),
  );
  assert.equal(
    reportPayments.get('cash').total_cents - baselinePayments.get('cash').total_cents,
    expectedCashTotal,
    'Cash sales must be grouped correctly.',
  );
  assert.equal(
    reportPayments.get('gcash').total_cents - baselinePayments.get('gcash').total_cents,
    firstMenuItem.price_cents,
    'GCash sales must be grouped correctly.',
  );
  assert.equal(
    reportPayments.get('maya').total_cents - baselinePayments.get('maya').total_cents,
    0,
    'Pending Maya orders must be excluded from payment totals.',
  );
  const baselineBestSeller = baselineSales.payload.data.best_sellers.find(
    (item) => item.menu_item_id === firstMenuItem.id,
  );
  const reportBestSeller = salesReport.payload.data.best_sellers.find(
    (item) => item.menu_item_id === firstMenuItem.id,
  );
  assert.equal(
    reportBestSeller.quantity_sold - (baselineBestSeller?.quantity_sold ?? 0),
    3,
    'Best-seller quantities must aggregate completed order items.',
  );

  const orderHistory = await request('/orders', { token: cashierSession.token });
  assert.equal(orderHistory.response.status, 200, 'Cashiers should view order history.');
  assert.ok(
    createdIds.orders.every((id) => orderHistory.payload.data.some((order) => order.id === id)),
    'Saved transactions must appear in order history.',
  );

  const savedReceipt = await request(`/orders/${createdIds.orders[0]}`, {
    token: adminSession.token,
  });
  assert.equal(savedReceipt.response.status, 200, 'Administrators should view saved receipts.');
  assert.equal(savedReceipt.payload.data.order_number, cashOrder.payload.data.order_number);
  assert.equal(savedReceipt.payload.data.table_number, availableTable.table_number);

  const inventoryDenied = await request('/inventory/items', { token: cashierSession.token });
  assert.equal(inventoryDenied.response.status, 403, 'Cashiers must not read admin inventory data.');
  const reportsDenied = await request('/reports/sales', { token: kitchenSession.token });
  assert.equal(reportsDenied.response.status, 403, 'Kitchen staff must not read admin reports.');

  const inventoryItem = await request('/inventory/items', {
    token: adminSession.token,
    method: 'POST',
    body: {
      name: `Verification Supply ${suffix}`,
      unit: 'kg',
      quantity: 10,
      low_stock_level: 3,
      is_active: true,
    },
  });
  assert.equal(inventoryItem.response.status, 201, 'Administrators should create inventory items.');
  createdIds.inventoryItem = inventoryItem.payload.data.id;
  assert.equal(inventoryItem.payload.data.quantity, 10);
  assert.equal(
    inventoryItem.payload.data.movement_count,
    1,
    'Non-zero initial stock must create a movement record.',
  );

  const stockDeduction = await request(
    `/inventory/items/${createdIds.inventoryItem}/movements`,
    {
      token: adminSession.token,
      method: 'POST',
      body: { movement_type: 'deduction', quantity: 4, notes: 'Verification usage' },
    },
  );
  assert.equal(stockDeduction.response.status, 201, 'Administrators should deduct stock.');
  assert.equal(stockDeduction.payload.data.item.quantity, 6);
  const stockAddition = await request(
    `/inventory/items/${createdIds.inventoryItem}/movements`,
    {
      token: adminSession.token,
      method: 'POST',
      body: { movement_type: 'addition', quantity: 2.5, notes: 'Verification delivery' },
    },
  );
  assert.equal(stockAddition.response.status, 201, 'Administrators should add stock.');
  assert.equal(stockAddition.payload.data.item.quantity, 8.5);

  const excessiveDeduction = await request(
    `/inventory/items/${createdIds.inventoryItem}/movements`,
    {
      token: adminSession.token,
      method: 'POST',
      body: { movement_type: 'deduction', quantity: 9, notes: '' },
    },
  );
  assert.equal(excessiveDeduction.response.status, 409, 'Stock cannot be deducted below zero.');
  assert.equal(
    db.prepare('SELECT quantity FROM inventory_items WHERE id = ?').get(createdIds.inventoryItem).quantity,
    8.5,
    'A rejected deduction must not change the stored quantity.',
  );

  const movementHistory = await request(
    `/inventory/movements?item_id=${createdIds.inventoryItem}`,
    { token: adminSession.token },
  );
  assert.equal(movementHistory.response.status, 200, 'Administrators should view stock history.');
  assert.equal(movementHistory.payload.data.length, 3, 'Every successful stock change must be retained.');
  assert.ok(
    movementHistory.payload.data.every((movement) => movement.employee_name === adminSession.user.name),
    'Stock movements must identify the employee who recorded them.',
  );

  const lowStockUpdate = await request(`/inventory/items/${createdIds.inventoryItem}`, {
    token: adminSession.token,
    method: 'PUT',
    body: {
      name: inventoryItem.payload.data.name,
      unit: 'kg',
      low_stock_level: 10,
      is_active: true,
    },
  });
  assert.equal(lowStockUpdate.response.status, 200, 'Administrators should edit low-stock levels.');
  assert.equal(lowStockUpdate.payload.data.is_low_stock, 1);

  const inventoryReport = await request('/reports/inventory', { token: adminSession.token });
  assert.equal(inventoryReport.response.status, 200, 'Administrators should view inventory reports.');
  assert.ok(
    inventoryReport.payload.data.items.some((item) => item.id === createdIds.inventoryItem && item.is_low_stock),
    'Low-stock items must appear in the inventory report.',
  );

  const archivedInventoryItem = await request(`/inventory/items/${createdIds.inventoryItem}`, {
    token: adminSession.token,
    method: 'PUT',
    body: {
      name: inventoryItem.payload.data.name,
      unit: 'kg',
      low_stock_level: 10,
      is_active: false,
    },
  });
  assert.equal(archivedInventoryItem.response.status, 200, 'Inventory items should be archivable.');
  const archivedMovement = await request(
    `/inventory/items/${createdIds.inventoryItem}/movements`,
    {
      token: adminSession.token,
      method: 'POST',
      body: { movement_type: 'addition', quantity: 1, notes: '' },
    },
  );
  assert.equal(archivedMovement.response.status, 409, 'Archived items cannot receive movements.');

  const logoutResult = await request('/auth/logout', {
    token: adminSession.token,
    method: 'POST',
  });
  assert.equal(logoutResult.response.status, 204, 'Logout should end the session.');
  const revoked = await request('/auth/me', { token: adminSession.token });
  assert.equal(revoked.response.status, 401, 'Logged-out tokens must be rejected.');

  console.log('Frontend build, Phase 6 inventory and reporting checks passed:', {
    ...counts,
    lowStockItems,
    authentication: 'passed',
    roleAuthorization: 'passed',
    adminCrud: 'passed',
    orderingAndPayments: 'passed',
    receiptsAndHistory: 'passed',
    kitchenQueueAndStatuses: 'passed',
    tableOccupancyWorkflow: 'passed',
    inventoryManagement: 'passed',
    stockMovementHistory: 'passed',
    salesAndLowStockReports: 'passed',
    productionStaticServing: 'passed',
  });
} finally {
  if (createdIds.inventoryItem) {
    db.prepare('DELETE FROM stock_movements WHERE inventory_item_id = ?').run(createdIds.inventoryItem);
    db.prepare('DELETE FROM inventory_items WHERE id = ?').run(createdIds.inventoryItem);
  }
  createdIds.orders.forEach((id) => db.prepare('DELETE FROM orders WHERE id = ?').run(id));
  db.prepare(`
    UPDATE restaurant_tables
    SET status = 'available'
    WHERE NOT EXISTS (
      SELECT 1 FROM orders
      WHERE orders.table_id = restaurant_tables.id
        AND orders.status IN ('pending', 'preparing', 'ready')
    )
  `).run();
  if (createdIds.menuItem) db.prepare('DELETE FROM menu_items WHERE id = ?').run(createdIds.menuItem);
  if (createdIds.category) db.prepare('DELETE FROM categories WHERE id = ?').run(createdIds.category);
  if (createdIds.table) db.prepare('DELETE FROM restaurant_tables WHERE id = ?').run(createdIds.table);
  if (createdIds.employee) db.prepare('DELETE FROM users WHERE id = ?').run(createdIds.employee);
  const removeSession = db.prepare('DELETE FROM auth_sessions WHERE token_hash = ?');
  issuedTokens.forEach((token) => {
    const hash = crypto.createHash('sha256').update(token).digest('hex');
    removeSession.run(hash);
  });

  await new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
  db.close();
  fs.rmSync(temporaryDirectory, { recursive: true, force: true });
}
