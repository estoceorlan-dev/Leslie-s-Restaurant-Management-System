import { useEffect, useMemo, useState } from 'react';
import { EmptyState, PageMessage } from '../../components/Modal.jsx';
import { OrderStatus } from '../../components/Receipt.jsx';
import { api } from '../../services/api.js';
import { formatDateTime, orderTypeLabels } from '../../utils/format.js';

const queueColumns = [
  { status: 'pending', title: 'Pending', detail: 'Waiting to be started' },
  { status: 'preparing', title: 'Preparing', detail: 'Being prepared now' },
  { status: 'ready', title: 'Ready', detail: 'Ready for service' },
];

const nextActions = {
  pending: { status: 'preparing', label: 'Start preparing' },
  preparing: { status: 'ready', label: 'Mark ready' },
  ready: { status: 'completed', label: 'Complete order' },
};

function KitchenOrderCard({ order, updating, onAdvance }) {
  const action = nextActions[order.status];

  return (
    <article className={`kitchen-order-card kitchen-order-card--${order.status}`}>
      <header className="kitchen-order-header">
        <div>
          <strong>{order.order_number}</strong>
          <small>{orderTypeLabels[order.order_type]}{order.table_number ? ` · Table ${order.table_number}` : ''}</small>
        </div>
        <OrderStatus status={order.status} />
      </header>

      <p className="kitchen-order-time">Placed {formatDateTime(order.created_at)}</p>

      <ul className="kitchen-item-list">
        {order.items.map((item) => (
          <li key={item.id}>
            <span className="kitchen-item-quantity">{item.quantity}×</span>
            <div>
              <strong>{item.item_name}</strong>
              {item.notes && <small>Note: {item.notes}</small>}
            </div>
          </li>
        ))}
      </ul>

      <button
        className="primary-button kitchen-status-button"
        type="button"
        disabled={updating}
        onClick={() => onAdvance(order, action.status)}
      >
        {updating ? 'Updating…' : action.label}
      </button>
    </article>
  );
}

export function KitchenQueuePage() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [updatingId, setUpdatingId] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [lastUpdated, setLastUpdated] = useState(null);

  const loadQueue = async ({ silent = false } = {}) => {
    if (silent) setRefreshing(true);
    else setLoading(true);
    try {
      const queue = await api.kitchenOrders();
      setOrders(queue);
      setLastUpdated(new Date());
      setError('');
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadQueue();
    const interval = window.setInterval(() => loadQueue({ silent: true }), 5000);
    return () => window.clearInterval(interval);
  }, []);

  const ordersByStatus = useMemo(() => Object.fromEntries(
    queueColumns.map(({ status }) => [
      status,
      orders.filter((order) => order.status === status),
    ]),
  ), [orders]);

  const advanceOrder = async (order, status) => {
    setUpdatingId(order.id);
    setError('');
    setNotice('');
    try {
      const updated = await api.updateKitchenOrderStatus(order.id, status);
      setNotice(`${updated.order_number} is now ${updated.status}.`);
      await loadQueue({ silent: true });
    } catch (requestError) {
      setError(requestError.message);
      await loadQueue({ silent: true });
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <section className="kitchen-page">
      <div className="page-title-row">
        <div>
          <p className="eyebrow">Live preparation workflow</p>
          <h2>Kitchen order queue</h2>
          <p>Move each confirmed order forward as preparation progresses.</p>
        </div>
        <div className="kitchen-refresh">
          <span className={refreshing ? 'refresh-dot refresh-dot--active' : 'refresh-dot'} />
          <small>{lastUpdated ? `Updated ${lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}` : 'Connecting…'}</small>
          <button className="secondary-button" type="button" onClick={() => loadQueue({ silent: true })} disabled={refreshing}>Refresh</button>
        </div>
      </div>

      <PageMessage>{error}</PageMessage>
      <PageMessage type="success">{notice}</PageMessage>

      <div className="kitchen-summary" aria-label="Kitchen queue summary">
        {queueColumns.map((column) => (
          <div key={column.status}>
            <span className={`queue-count-dot queue-count-dot--${column.status}`} />
            <strong>{ordersByStatus[column.status]?.length ?? 0}</strong>
            <small>{column.title}</small>
          </div>
        ))}
        <div><strong>{orders.length}</strong><small>Active orders</small></div>
      </div>

      {loading ? (
        <div className="table-card loading-state">Loading kitchen orders…</div>
      ) : orders.length === 0 ? (
        <div className="table-card kitchen-empty"><EmptyState>No active orders. New confirmed orders will appear automatically.</EmptyState></div>
      ) : (
        <div className="kitchen-board">
          {queueColumns.map((column) => (
            <section className={`kitchen-column kitchen-column--${column.status}`} key={column.status}>
              <header>
                <div><h3>{column.title}</h3><p>{column.detail}</p></div>
                <span>{ordersByStatus[column.status].length}</span>
              </header>
              <div className="kitchen-column-orders">
                {ordersByStatus[column.status].length === 0 ? (
                  <p className="kitchen-column-empty">No {column.title.toLowerCase()} orders</p>
                ) : ordersByStatus[column.status].map((order) => (
                  <KitchenOrderCard
                    key={order.id}
                    order={order}
                    updating={updatingId === order.id}
                    onAdvance={advanceOrder}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </section>
  );
}
