import { useEffect, useMemo, useState } from 'react';
import { EmptyState, PageMessage } from '../../components/Modal.jsx';
import { api } from '../../services/api.js';
import { formatCurrency, formatDate, formatDateTime, formatQuantity, paymentLabels } from '../../utils/format.js';

function localDateValue(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function ReportsPage() {
  const today = localDateValue();
  const monthStart = `${today.slice(0, 8)}01`;
  const [draftRange, setDraftRange] = useState({ from: today, to: today });
  const [range, setRange] = useState({ from: today, to: today });
  const [sales, setSales] = useState(null);
  const [inventory, setInventory] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async (selectedRange = range) => {
    setLoading(true);
    setError('');
    try {
      const [salesReport, inventoryReport] = await Promise.all([
        api.salesReport(selectedRange.from, selectedRange.to),
        api.inventoryReport(),
      ]);
      setSales(salesReport);
      setInventory(inventoryReport);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(range); }, []);

  const applyRange = (event) => {
    event.preventDefault();
    setRange(draftRange);
    load(draftRange);
  };
  const usePreset = (from, to) => {
    const selected = { from, to };
    setDraftRange(selected);
    setRange(selected);
    load(selected);
  };

  const chartMax = useMemo(() => Math.max(
    1,
    ...(sales?.daily_sales ?? []).map((day) => day.total_cents),
  ), [sales]);
  const paymentMax = Math.max(
    1,
    ...(sales?.payment_methods ?? []).map((payment) => payment.total_cents),
  );
  const lowStockItems = inventory?.items.filter((item) => item.is_low_stock) ?? [];

  return (
    <section className="reports-page">
      <div className="page-title-row no-print"><div><p className="eyebrow">Business overview</p><h2>Sales and stock reports</h2><p>Review completed sales, payment totals, popular items, and low-stock supplies.</p></div><button className="secondary-button" type="button" onClick={() => window.print()} disabled={!sales}>Print report</button></div>

      <form className="report-filters no-print" onSubmit={applyRange}>
        <div className="report-presets"><button type="button" className={range.from === today && range.to === today ? 'active' : ''} onClick={() => usePreset(today, today)}>Today</button><button type="button" className={range.from === monthStart && range.to === today ? 'active' : ''} onClick={() => usePreset(monthStart, today)}>This month</button></div>
        <label className="form-field"><span>From</span><input type="date" value={draftRange.from} max={draftRange.to} onChange={(event) => setDraftRange({ ...draftRange, from: event.target.value })} required /></label>
        <label className="form-field"><span>To</span><input type="date" value={draftRange.to} min={draftRange.from} onChange={(event) => setDraftRange({ ...draftRange, to: event.target.value })} required /></label>
        <button className="primary-button" type="submit">Apply dates</button>
      </form>

      <PageMessage>{error}</PageMessage>

      {loading ? <div className="table-card loading-state">Preparing reports…</div> : sales && inventory && <div className="printable-report" id="printable-sales-report">
        <header className="report-print-header print-only"><div><span className="receipt-logo">L</span><div><h1>Leslie&apos;s Restaurant</h1><p>Sales and low-stock report</p></div></div><small>Generated {formatDateTime(sales.generated_at)}</small></header>
        <div className="report-range-line"><strong>{formatDate(sales.range.from)}{sales.range.from !== sales.range.to ? ` – ${formatDate(sales.range.to)}` : ''}</strong><span>Completed orders only</span></div>

        <section className="report-summary-grid">
          <article><small>Total sales</small><strong>{formatCurrency(sales.summary.total_sales_cents)}</strong></article>
          <article><small>Completed orders</small><strong>{sales.summary.completed_orders}</strong></article>
          <article><small>Average order</small><strong>{formatCurrency(sales.summary.average_order_cents)}</strong></article>
          <article><small>Items sold</small><strong>{sales.summary.items_sold}</strong></article>
        </section>

        <div className="report-grid">
          <section className="report-card sales-chart-card">
            <div className="panel-heading"><div><p className="eyebrow">Completed sales</p><h3>Daily sales</h3></div></div>
            {sales.daily_sales.length === 0 ? <EmptyState>No completed sales in this date range.</EmptyState> : <div className="sales-chart" aria-label="Daily sales chart">{sales.daily_sales.map((day) => <div className="sales-bar-column" key={day.date}><div className="sales-bar-value">{formatCurrency(day.total_cents)}</div><div className="sales-bar-track"><span style={{ height: `${Math.max(4, day.total_cents / chartMax * 100)}%` }} /></div><strong>{formatDate(day.date, { month: 'short', day: 'numeric' })}</strong><small>{day.order_count} {day.order_count === 1 ? 'order' : 'orders'}</small></div>)}</div>}
          </section>

          <section className="report-card payment-report-card">
            <div className="panel-heading"><div><p className="eyebrow">Payment mix</p><h3>Sales by payment method</h3></div></div>
            <div className="payment-breakdown">{sales.payment_methods.map((payment) => <article key={payment.payment_method}><div><strong>{paymentLabels[payment.payment_method]}</strong><span>{payment.order_count} {payment.order_count === 1 ? 'order' : 'orders'}</span></div><b>{formatCurrency(payment.total_cents)}</b><div className="payment-bar"><span style={{ width: `${payment.total_cents / paymentMax * 100}%` }} /></div></article>)}</div>
          </section>
        </div>

        <div className="report-grid report-grid--tables">
          <section className="report-card">
            <div className="panel-heading"><div><p className="eyebrow">Menu performance</p><h3>Best-selling items</h3></div></div>
            {sales.best_sellers.length === 0 ? <EmptyState>No item sales in this date range.</EmptyState> : <div className="data-table-wrap"><table className="data-table best-seller-table"><thead><tr><th>Rank</th><th>Menu item</th><th>Qty sold</th><th>Sales</th></tr></thead><tbody>{sales.best_sellers.map((item, index) => <tr key={`${item.menu_item_id}-${item.item_name}`}><td><span className="rank-number">{index + 1}</span></td><td><strong>{item.item_name}</strong></td><td>{item.quantity_sold}</td><td><strong className="price-cell">{formatCurrency(item.sales_cents)}</strong></td></tr>)}</tbody></table></div>}
          </section>

          <section className="report-card low-stock-report-card">
            <div className="panel-heading"><div><p className="eyebrow">Inventory attention</p><h3>Low-stock items</h3></div><span className="low-stock-count">{lowStockItems.length}</span></div>
            {lowStockItems.length === 0 ? <EmptyState>No active items are low on stock.</EmptyState> : <div className="data-table-wrap"><table className="data-table"><thead><tr><th>Item</th><th>Current</th><th>Low level</th></tr></thead><tbody>{lowStockItems.map((item) => <tr key={item.id}><td><strong>{item.name}</strong>{item.is_out_of_stock ? <small className="table-subtext danger-text">Out of stock</small> : null}</td><td><strong>{formatQuantity(item.quantity)} {item.unit}</strong></td><td>{formatQuantity(item.low_stock_level)} {item.unit}</td></tr>)}</tbody></table></div>}
          </section>
        </div>
      </div>}
    </section>
  );
}
