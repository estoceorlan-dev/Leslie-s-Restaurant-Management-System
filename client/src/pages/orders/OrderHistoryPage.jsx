import { useEffect, useMemo, useState } from 'react';
import { EmptyState, PageMessage } from '../../components/Modal.jsx';
import { OrderStatus, ReceiptModal } from '../../components/Receipt.jsx';
import { api } from '../../services/api.js';
import {
  formatCurrency,
  formatDateTime,
  orderTypeLabels,
  paymentLabels,
} from '../../utils/format.js';

export function OrderHistoryPage({ onNewOrder }) {
  const [orders, setOrders] = useState([]);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [paymentFilter, setPaymentFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [receipt, setReceipt] = useState(null);
  const [receiptLoading, setReceiptLoading] = useState(false);
  const [receiptError, setReceiptError] = useState('');

  const load = () => {
    setLoading(true); setError('');
    api.orders().then(setOrders).catch((requestError) => setError(requestError.message)).finally(() => setLoading(false));
  };
  useEffect(load, []);

  const visible = useMemo(() => orders.filter((order) => {
    const text = `${order.order_number} ${order.cashier_name} ${order.table_number ?? ''}`.toLowerCase();
    return text.includes(search.toLowerCase())
      && (typeFilter === 'all' || order.order_type === typeFilter)
      && (paymentFilter === 'all' || order.payment_method === paymentFilter);
  }), [orders, search, typeFilter, paymentFilter]);

  const openReceipt = async (id) => {
    setReceipt({}); setReceiptLoading(true); setReceiptError('');
    try { setReceipt(await api.order(id)); }
    catch (requestError) { setReceiptError(requestError.message); setReceipt({}); }
    finally { setReceiptLoading(false); }
  };

  return (
    <section className="management-page order-history-page">
      <div className="page-title-row"><div><p className="eyebrow">Saved transactions</p><h2>Order history</h2><p>Review saved payment records and reprint customer receipts.</p></div><div className="title-actions">{onNewOrder && <button className="primary-button" type="button" onClick={onNewOrder}>+ New order</button>}<button className="secondary-button" type="button" onClick={load}>Refresh</button></div></div>
      <PageMessage>{error}</PageMessage>
      <div className="toolbar toolbar--filters"><label className="search-field"><span aria-hidden="true">⌕</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Order number or cashier" /></label><label><span className="sr-only">Order type</span><select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}><option value="all">All order types</option><option value="dine_in">Dine-in</option><option value="takeout">Takeout</option></select></label><label><span className="sr-only">Payment method</span><select value={paymentFilter} onChange={(event) => setPaymentFilter(event.target.value)}><option value="all">All payments</option><option value="cash">Cash</option><option value="gcash">GCash</option><option value="maya">Maya</option></select></label><span>{visible.length} orders</span></div>
      <div className="table-card">
        {loading ? <div className="loading-state">Loading order history…</div> : visible.length === 0 ? <EmptyState>No saved orders match these filters.</EmptyState> : <div className="data-table-wrap"><table className="data-table order-history-table"><thead><tr><th>Order</th><th>Date & time</th><th>Type</th><th>Items</th><th>Payment</th><th>Status</th><th>Total</th><th><span className="sr-only">Actions</span></th></tr></thead><tbody>{visible.map((order) => <tr key={order.id}><td><strong>{order.order_number}</strong><small className="table-subtext">{order.cashier_name}</small></td><td className="muted-cell">{formatDateTime(order.created_at)}</td><td>{orderTypeLabels[order.order_type]}{order.table_number ? <small className="table-subtext">Table {order.table_number}</small> : null}</td><td>{order.total_quantity}</td><td>{paymentLabels[order.payment_method]}</td><td><OrderStatus status={order.status} /></td><td><strong className="price-cell">{formatCurrency(order.total_cents)}</strong></td><td><div className="row-actions"><button type="button" onClick={() => openReceipt(order.id)}>View receipt</button></div></td></tr>)}</tbody></table></div>}
      </div>
      {receipt !== null && <ReceiptModal order={receipt?.id ? receipt : null} loading={receiptLoading} error={receiptError} onClose={() => { setReceipt(null); setReceiptError(''); }} />}
    </section>
  );
}
