import { useEffect, useState } from 'react';
import { api } from '../../services/api.js';
import { PageMessage } from '../../components/Modal.jsx';
import { formatCurrency, formatQuantity } from '../../utils/format.js';

function localDateValue(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function SummaryIcon({ name }) {
  const paths = {
    sales: <><path d="M4 19V9m6 10V5m6 14v-7m4 7H2" /><path d="m4 6 5-3 5 3 6-4" /></>,
    orders: <><path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3Z" /><path d="M9 8h6m-6 4h6" /></>,
    stock: <><path d="M4 7h16v13H4V7Z" /><path d="M3 4h18v3H3V4Zm5 7h8" /></>,
    menu: <><path d="M4 6h16M4 12h16M4 18h16" /><circle cx="7" cy="6" r="1" /><circle cx="7" cy="12" r="1" /><circle cx="7" cy="18" r="1" /></>,
  };
  return <svg viewBox="0 0 24 24" aria-hidden="true">{paths[name]}</svg>;
}

export function AdminDashboard({ user, onNavigate }) {
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let current = true;
    const today = localDateValue();
    Promise.all([api.salesReport(today, today), api.inventoryReport(), api.menuItems()])
      .then(([sales, inventory, menuItems]) => {
        if (current) setSummary({ sales, inventory, menuItems });
      })
      .catch((requestError) => current && setError(requestError.message));
    return () => { current = false; };
  }, []);

  const cards = [
    { label: "Today's sales", value: summary ? formatCurrency(summary.sales.summary.total_sales_cents) : null, target: 'reports', accent: 'green', icon: 'sales' },
    { label: 'Completed orders', value: summary?.sales.summary.completed_orders, target: 'reports', accent: 'blue', icon: 'orders' },
    { label: 'Low-stock items', value: summary?.inventory.summary.low_stock_items, target: 'inventory', accent: 'clay', icon: 'stock' },
    { label: 'Active menu items', value: summary?.menuItems.filter((item) => item.is_active).length, target: 'menu', accent: 'gold', icon: 'menu' },
  ];
  const lowStock = summary?.inventory.items.filter((item) => item.is_low_stock).slice(0, 5) ?? [];
  const bestSellers = summary?.sales.best_sellers.slice(0, 5) ?? [];

  return (
    <div className="dashboard-page">
      <section className="welcome-banner">
        <div>
          <p className="eyebrow">Administration</p>
          <h2>Good day, {user.name.split(' ')[0]}.</h2>
          <p>Monitor today&apos;s completed sales and supplies that need attention.</p>
        </div>
        <div className="phase-pill"><span>Phase 6</span><strong>Operations and reports live</strong></div>
      </section>

      <PageMessage>{error}</PageMessage>

      <section className="summary-grid" aria-label="Restaurant setup summary">
        {cards.map((card) => (
          <button className="summary-card" type="button" key={card.label} onClick={() => onNavigate(card.target)}>
            <span className={`summary-icon summary-icon--${card.accent}`}><SummaryIcon name={card.icon} /></span>
            <span><small>{card.label}</small><strong>{card.value ?? '—'}</strong></span>
            <span className="card-arrow">→</span>
          </button>
        ))}
      </section>

      <section className="dashboard-grid">
        <article className="panel-card">
          <div className="panel-heading"><div><p className="eyebrow">Today&apos;s menu performance</p><h3>Best-selling items</h3></div><button className="secondary-button" type="button" onClick={() => onNavigate('reports')}>View reports</button></div>
          {bestSellers.length === 0 ? <p className="system-note">Completed orders will appear here as sales are recorded.</p> : <ol className="dashboard-best-sellers">{bestSellers.map((item, index) => <li key={`${item.menu_item_id}-${item.item_name}`}><span>{index + 1}</span><div><strong>{item.item_name}</strong><small>{item.quantity_sold} sold</small></div><strong>{formatCurrency(item.sales_cents)}</strong></li>)}</ol>}
        </article>

        <article className="panel-card">
          <div className="panel-heading"><div><p className="eyebrow">Inventory attention</p><h3>Low-stock supplies</h3></div><button className="secondary-button" type="button" onClick={() => onNavigate('inventory')}>Open inventory</button></div>
          {lowStock.length === 0 ? <p className="system-note">All active inventory items are above their low-stock levels.</p> : <div className="dashboard-low-stock-list">{lowStock.map((item) => <button type="button" key={item.id} onClick={() => onNavigate('inventory')}><div><strong>{item.name}</strong><small>Low level: {formatQuantity(item.low_stock_level)} {item.unit}</small></div><span>{formatQuantity(item.quantity)} {item.unit}</span></button>)}</div>}
        </article>
      </section>

      <section className="panel-card dashboard-tools">
        <div className="panel-heading"><div><p className="eyebrow">Quick access</p><h3>Administration tools</h3></div></div>
        <div className="quick-links">
          <button type="button" onClick={() => onNavigate('inventory')}><strong>Adjust inventory</strong><span>Record stock additions, deductions, and low-stock levels.</span></button>
          <button type="button" onClick={() => onNavigate('reports')}><strong>Review sales</strong><span>Filter completed sales and print management reports.</span></button>
          <button type="button" onClick={() => onNavigate('menu')}><strong>Update the menu</strong><span>Manage prices, availability, and archived items.</span></button>
        </div>
      </section>
    </div>
  );
}
