import { useEffect, useMemo, useState } from 'react';
import { EmptyState, PageMessage } from '../../components/Modal.jsx';
import { ReceiptModal } from '../../components/Receipt.jsx';
import { api } from '../../services/api.js';
import { formatCurrency } from '../../utils/format.js';

const paymentOptions = [
  { id: 'cash', label: 'Cash', detail: 'Calculate change' },
  { id: 'gcash', label: 'GCash', detail: 'Manual confirmation' },
  { id: 'maya', label: 'Maya', detail: 'Manual confirmation' },
];

export function CashierOrderPage({ onViewHistory }) {
  const [menuItems, setMenuItems] = useState([]);
  const [tables, setTables] = useState([]);
  const [cart, setCart] = useState([]);
  const [orderType, setOrderType] = useState('dine_in');
  const [tableId, setTableId] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [cashReceived, setCashReceived] = useState('');
  const [category, setCategory] = useState('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [receipt, setReceipt] = useState(null);

  const loadSetup = async () => {
    setLoading(true);
    try {
      const [menu, restaurantTables] = await Promise.all([
        api.availableMenu(),
        api.availableTables(),
      ]);
      setMenuItems(menu);
      setTables(restaurantTables);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadSetup(); }, []);

  useEffect(() => {
    const refreshTables = () => {
      api.availableTables().then(setTables).catch(() => {
        // The regular page error remains reserved for actions the cashier initiated.
      });
    };
    const interval = window.setInterval(refreshTables, 5000);
    window.addEventListener('leslies:order-status-changed', refreshTables);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener('leslies:order-status-changed', refreshTables);
    };
  }, []);

  const categories = useMemo(
    () => [...new Set(menuItems.map((item) => item.category_name))],
    [menuItems],
  );
  const visibleMenu = useMemo(() => menuItems.filter((item) => {
    const matchesCategory = category === 'all' || item.category_name === category;
    const matchesSearch = item.name.toLowerCase().includes(search.toLowerCase());
    return matchesCategory && matchesSearch;
  }), [menuItems, category, search]);

  const subtotalCents = cart.reduce(
    (total, item) => total + item.price_cents * item.quantity,
    0,
  );
  const amountReceivedCents = cashReceived === ''
    ? 0
    : Math.round(Number(cashReceived) * 100);
  const changeCents = Math.max(0, amountReceivedCents - subtotalCents);
  const availableTables = tables.filter((table) => table.status === 'available');

  const addItem = (menuItem) => {
    setCart((current) => {
      const existing = current.find((item) => item.id === menuItem.id);
      if (existing) {
        return current.map((item) => item.id === menuItem.id
          ? { ...item, quantity: Math.min(item.quantity + 1, 99) }
          : item);
      }
      return [...current, { ...menuItem, quantity: 1, notes: '' }];
    });
    setNotice('');
  };

  const updateQuantity = (id, quantity) => {
    if (quantity < 1) {
      setCart((current) => current.filter((item) => item.id !== id));
      return;
    }
    setCart((current) => current.map((item) => item.id === id
      ? { ...item, quantity: Math.min(quantity, 99) }
      : item));
  };

  const updateNotes = (id, notes) => {
    setCart((current) => current.map((item) => item.id === id
      ? { ...item, notes }
      : item));
  };

  const changeOrderType = (type) => {
    setOrderType(type);
    if (type === 'takeout') setTableId('');
  };

  const confirmOrder = async () => {
    setError('');
    setNotice('');

    if (cart.length === 0) return setError('Add at least one menu item to the order.');
    if (orderType === 'dine_in' && !tableId) return setError('Select a table for the dine-in order.');
    if (paymentMethod === 'cash' && amountReceivedCents < subtotalCents) {
      return setError('Cash received must cover the order total.');
    }

    setSubmitting(true);
    try {
      const savedOrder = await api.createOrder({
        order_type: orderType,
        table_id: orderType === 'dine_in' ? Number(tableId) : null,
        payment_method: paymentMethod,
        amount_received_cents: paymentMethod === 'cash' ? amountReceivedCents : null,
        items: cart.map((item) => ({
          menu_item_id: item.id,
          quantity: item.quantity,
          notes: item.notes,
        })),
      });
      setReceipt(savedOrder);
      setCart([]);
      setTableId('');
      setCashReceived('');
      setPaymentMethod('cash');
      setNotice(`${savedOrder.order_number} was saved successfully.`);
      const refreshedTables = await api.availableTables();
      setTables(refreshedTables);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="cashier-page">
      <div className="page-title-row cashier-title-row">
        <div><p className="eyebrow">Point of sale</p><h2>Create an order</h2><p>Build a dine-in or takeout transaction and record payment.</p></div>
        <button className="secondary-button" type="button" onClick={onViewHistory}>View order history</button>
      </div>

      <PageMessage>{error}</PageMessage>
      <PageMessage type="success">{notice}</PageMessage>

      <div className="order-workspace">
        <div className="menu-browser">
          <section className="order-setup-card">
            <div className="order-type-control" aria-label="Order type">
              <button className={orderType === 'dine_in' ? 'active' : ''} type="button" onClick={() => changeOrderType('dine_in')}>Dine-in</button>
              <button className={orderType === 'takeout' ? 'active' : ''} type="button" onClick={() => changeOrderType('takeout')}>Takeout</button>
            </div>
            {orderType === 'dine_in' && <label className="table-select-field"><span>Table</span><select value={tableId} onChange={(event) => setTableId(event.target.value)}><option value="">Select an available table</option>{tables.map((table) => <option key={table.id} value={table.id} disabled={table.status !== 'available'}>Table {table.table_number} · {table.capacity} seats{table.status !== 'available' ? ' · Occupied' : ''}</option>)}</select><small>{availableTables.length} of {tables.length} tables available</small></label>}
            {orderType === 'takeout' && <div className="takeout-note"><strong>Takeout order</strong><span>No table assignment is required.</span></div>}
          </section>

          <div className="menu-toolbar">
            <label className="search-field"><span aria-hidden="true">⌕</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search the menu" /></label>
            <div className="category-tabs"><button type="button" className={category === 'all' ? 'active' : ''} onClick={() => setCategory('all')}>All</button>{categories.map((name) => <button type="button" key={name} className={category === name ? 'active' : ''} onClick={() => setCategory(name)}>{name}</button>)}</div>
          </div>

          {loading ? <div className="menu-loading">Loading menu…</div> : visibleMenu.length === 0 ? <EmptyState>No available menu items match your search.</EmptyState> : <div className="cashier-menu-grid">{visibleMenu.map((item) => {
            const count = cart.find((line) => line.id === item.id)?.quantity ?? 0;
            return <button className="cashier-menu-card" type="button" key={item.id} onClick={() => addItem(item)}><span className="menu-card-category">{item.category_name}</span><strong>{item.name}</strong><span className="menu-card-bottom"><b>{formatCurrency(item.price_cents)}</b><i>{count ? `${count} in order` : '+'}</i></span></button>;
          })}</div>}
        </div>

        <aside className="order-cart">
          <header className="cart-header"><div><p className="eyebrow">Current order</p><h3>{cart.reduce((total, item) => total + item.quantity, 0)} items</h3></div>{cart.length > 0 && <button type="button" onClick={() => setCart([])}>Clear</button>}</header>

          <div className="cart-lines">
            {cart.length === 0 ? <div className="empty-cart"><span>+</span><strong>Your order is empty</strong><p>Select menu items to add them here.</p></div> : cart.map((item) => <article className="cart-line" key={item.id}>
              <div className="cart-line-main"><div><strong>{item.name}</strong><small>{formatCurrency(item.price_cents)} each</small></div><b>{formatCurrency(item.price_cents * item.quantity)}</b></div>
              <div className="cart-line-controls"><div className="quantity-control"><button type="button" aria-label={`Decrease ${item.name}`} onClick={() => updateQuantity(item.id, item.quantity - 1)}>−</button><span>{item.quantity}</span><button type="button" aria-label={`Increase ${item.name}`} onClick={() => updateQuantity(item.id, item.quantity + 1)}>+</button></div><button className="remove-line" type="button" onClick={() => updateQuantity(item.id, 0)}>Remove</button></div>
              <input className="item-note-input" value={item.notes} onChange={(event) => updateNotes(item.id, event.target.value)} maxLength="250" placeholder="Add an item note (optional)" />
            </article>)}
          </div>

          <div className="cart-checkout">
            <dl className="cart-total"><div><dt>Subtotal</dt><dd>{formatCurrency(subtotalCents)}</dd></div><div><dt>Total</dt><dd>{formatCurrency(subtotalCents)}</dd></div></dl>
            <fieldset className="payment-selector"><legend>Payment method</legend><div>{paymentOptions.map((option) => <label className={paymentMethod === option.id ? 'active' : ''} key={option.id}><input type="radio" name="payment" value={option.id} checked={paymentMethod === option.id} onChange={() => setPaymentMethod(option.id)} /><strong>{option.label}</strong><small>{option.detail}</small></label>)}</div></fieldset>
            {paymentMethod === 'cash' && <div className="cash-payment"><label className="form-field"><span>Cash received (₱)</span><input type="number" min="0" step="0.01" value={cashReceived} onChange={(event) => setCashReceived(event.target.value)} placeholder="0.00" /></label><div><span>Change</span><strong>{formatCurrency(changeCents)}</strong></div></div>}
            {paymentMethod !== 'cash' && <div className="digital-payment-note"><strong>Confirm {paymentOptions.find((item) => item.id === paymentMethod)?.label} payment</strong><span>This records a manually verified payment; no gateway is connected.</span></div>}
            <button className="primary-button confirm-order-button" type="button" disabled={submitting || cart.length === 0} onClick={confirmOrder}>{submitting ? 'Saving order…' : `Confirm order · ${formatCurrency(subtotalCents)}`}</button>
          </div>
        </aside>
      </div>

      {receipt && <ReceiptModal order={receipt} onClose={() => setReceipt(null)} />}
    </section>
  );
}
