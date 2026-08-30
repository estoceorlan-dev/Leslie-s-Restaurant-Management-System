import { useEffect, useRef, useState } from 'react';
import { api } from '../services/api.js';

const statusLabels = {
  pending: 'Pending',
  preparing: 'Preparing',
  ready: 'Ready',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

export function OrderStatusNotifications() {
  const previousStatuses = useRef(null);
  const [alerts, setAlerts] = useState([]);

  useEffect(() => {
    let active = true;

    const checkStatuses = async () => {
      try {
        const orders = await api.orderStatusFeed();
        if (!active) return;

        const currentStatuses = new Map(
          orders.map((order) => [order.id, order.status]),
        );

        if (previousStatuses.current) {
          const changes = orders.filter((order) => {
            const previous = previousStatuses.current.get(order.id);
            return previous && previous !== order.status;
          });

          if (changes.length > 0) {
            const newAlerts = changes.map((order) => ({
              id: `${order.id}-${order.updated_at}-${order.status}`,
              orderNumber: order.order_number,
              status: order.status,
              tableNumber: order.table_number,
            }));
            setAlerts((current) => [...newAlerts, ...current].slice(0, 4));
            window.dispatchEvent(new CustomEvent('leslies:order-status-changed', {
              detail: changes,
            }));
          }
        }

        previousStatuses.current = currentStatuses;
      } catch {
        // The next polling cycle retries automatically if the local server is busy.
      }
    };

    checkStatuses();
    const interval = window.setInterval(checkStatuses, 5000);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, []);

  if (alerts.length === 0) return null;

  return (
    <aside className="status-notifications" aria-live="polite" aria-label="Order status notifications">
      {alerts.map((alert) => (
        <div className={`status-notification status-notification--${alert.status}`} key={alert.id}>
          <span className="status-notification-icon" aria-hidden="true">✓</span>
          <div>
            <strong>{alert.orderNumber} is {statusLabels[alert.status]}</strong>
            <small>
              {alert.tableNumber ? `Table ${alert.tableNumber} · ` : ''}
              The kitchen updated this order.
            </small>
          </div>
          <button
            type="button"
            aria-label={`Dismiss ${alert.orderNumber} notification`}
            onClick={() => setAlerts((current) => current.filter((item) => item.id !== alert.id))}
          >
            ×
          </button>
        </div>
      ))}
    </aside>
  );
}
