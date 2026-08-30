const TOKEN_KEY = 'leslies_auth_token';

export function getStoredToken() {
  return window.localStorage.getItem(TOKEN_KEY);
}

export function storeToken(token) {
  if (token) window.localStorage.setItem(TOKEN_KEY, token);
  else window.localStorage.removeItem(TOKEN_KEY);
}

async function request(path, options = {}) {
  const token = getStoredToken();
  const response = await fetch(`/api${path}`, {
    ...options,
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  if (response.status === 204) return null;

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload.error || 'The local server returned an error.');
    error.status = response.status;
    throw error;
  }
  return payload.data;
}

const json = (method, body) => ({ method, body: JSON.stringify(body) });

export const api = {
  login: (credentials) => request('/auth/login', json('POST', credentials)),
  me: () => request('/auth/me'),
  logout: () => request('/auth/logout', { method: 'POST' }),

  employees: () => request('/admin/employees'),
  createEmployee: (employee) => request('/admin/employees', json('POST', employee)),
  updateEmployee: (id, employee) => request(`/admin/employees/${id}`, json('PUT', employee)),

  categories: () => request('/admin/categories'),
  createCategory: (category) => request('/admin/categories', json('POST', category)),
  updateCategory: (id, category) => request(`/admin/categories/${id}`, json('PUT', category)),

  menuItems: () => request('/admin/menu-items'),
  createMenuItem: (item) => request('/admin/menu-items', json('POST', item)),
  updateMenuItem: (id, item) => request(`/admin/menu-items/${id}`, json('PUT', item)),

  tables: () => request('/admin/tables'),
  createTable: (table) => request('/admin/tables', json('POST', table)),
  updateTable: (id, table) => request(`/admin/tables/${id}`, json('PUT', table)),

  inventoryItems: () => request('/inventory/items'),
  createInventoryItem: (item) => request('/inventory/items', json('POST', item)),
  updateInventoryItem: (id, item) => request(`/inventory/items/${id}`, json('PUT', item)),
  stockMovements: (itemId, limit = 200) => request(
    `/inventory/movements?limit=${limit}${itemId ? `&item_id=${itemId}` : ''}`,
  ),
  recordStockMovement: (id, movement) => request(
    `/inventory/items/${id}/movements`,
    json('POST', movement),
  ),

  salesReport: (from, to) => request(`/reports/sales?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`),
  inventoryReport: () => request('/reports/inventory'),

  availableMenu: () => request('/menu-items'),
  availableTables: () => request('/tables'),
  createOrder: (order) => request('/orders', json('POST', order)),
  orders: (limit = 100) => request(`/orders?limit=${limit}`),
  order: (id) => request(`/orders/${id}`),
  orderStatusFeed: () => request('/orders/status-feed'),

  kitchenOrders: () => request('/kitchen/orders'),
  updateKitchenOrderStatus: (id, status) => request(
    `/kitchen/orders/${id}/status`,
    json('PUT', { status }),
  ),
};
