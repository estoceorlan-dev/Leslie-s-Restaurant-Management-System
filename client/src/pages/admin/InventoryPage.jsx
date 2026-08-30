import { useEffect, useMemo, useState } from 'react';
import { EmptyState, Modal, PageMessage, StatusBadge } from '../../components/Modal.jsx';
import { api } from '../../services/api.js';
import { formatDateTime, formatQuantity } from '../../utils/format.js';

const emptyItemForm = {
  name: '',
  unit: '',
  quantity: '',
  low_stock_level: '',
  is_active: true,
};

const emptyMovementForm = {
  movement_type: 'addition',
  quantity: '',
  notes: '',
};

function StockLevel({ item }) {
  if (!item.is_active) return <span className="stock-level stock-level--archived">Archived</span>;
  if (item.quantity === 0) return <span className="stock-level stock-level--out">Out of stock</span>;
  if (item.is_low_stock) return <span className="stock-level stock-level--low">Low stock</span>;
  return <span className="stock-level stock-level--healthy">Healthy</span>;
}

function InventoryReportTable({ items }) {
  return (
    <table className="data-table inventory-table">
      <thead><tr><th>Item</th><th>Current quantity</th><th>Low-stock level</th><th>Status</th><th>Last updated</th></tr></thead>
      <tbody>{items.map((item) => (
        <tr key={item.id}>
          <td><strong>{item.name}</strong></td>
          <td><strong>{formatQuantity(item.quantity)} {item.unit}</strong></td>
          <td>{formatQuantity(item.low_stock_level)} {item.unit}</td>
          <td><StockLevel item={item} /></td>
          <td className="muted-cell">{formatDateTime(item.updated_at)}</td>
        </tr>
      ))}</tbody>
    </table>
  );
}

export function InventoryPage() {
  const [items, setItems] = useState([]);
  const [movements, setMovements] = useState([]);
  const [search, setSearch] = useState('');
  const [stockFilter, setStockFilter] = useState('all');
  const [movementItemId, setMovementItemId] = useState('all');
  const [editing, setEditing] = useState(null);
  const [adjusting, setAdjusting] = useState(null);
  const [itemForm, setItemForm] = useState(emptyItemForm);
  const [movementForm, setMovementForm] = useState(emptyMovementForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const [inventoryItems, stockMovements] = await Promise.all([
        api.inventoryItems(),
        api.stockMovements(),
      ]);
      setItems(inventoryItems);
      setMovements(stockMovements);
      setError('');
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const activeItems = items.filter((item) => item.is_active);
  const lowStockItems = activeItems.filter((item) => item.is_low_stock);
  const visibleItems = useMemo(() => items.filter((item) => {
    const matchesSearch = `${item.name} ${item.unit}`.toLowerCase().includes(search.toLowerCase());
    const matchesFilter = stockFilter === 'all'
      || (stockFilter === 'low' && item.is_active && item.is_low_stock)
      || (stockFilter === 'healthy' && item.is_active && !item.is_low_stock)
      || (stockFilter === 'archived' && !item.is_active);
    return matchesSearch && matchesFilter;
  }), [items, search, stockFilter]);
  const visibleMovements = movementItemId === 'all'
    ? movements
    : movements.filter((movement) => movement.inventory_item_id === Number(movementItemId));

  const openItem = (item = 'new') => {
    setEditing(item);
    setItemForm(item === 'new' ? emptyItemForm : {
      name: item.name,
      unit: item.unit,
      quantity: item.quantity,
      low_stock_level: item.low_stock_level,
      is_active: Boolean(item.is_active),
    });
    setError('');
    setNotice('');
  };

  const saveItem = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      const payload = {
        name: itemForm.name,
        unit: itemForm.unit,
        low_stock_level: Number(itemForm.low_stock_level),
        is_active: itemForm.is_active,
        ...(editing === 'new' ? { quantity: Number(itemForm.quantity) } : {}),
      };
      if (editing === 'new') await api.createInventoryItem(payload);
      else await api.updateInventoryItem(editing.id, payload);
      setNotice(editing === 'new' ? 'Inventory item created.' : 'Inventory item updated.');
      setEditing(null);
      await load();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  };

  const toggleItem = async (item) => {
    setError('');
    setNotice('');
    try {
      await api.updateInventoryItem(item.id, {
        name: item.name,
        unit: item.unit,
        low_stock_level: item.low_stock_level,
        is_active: !item.is_active,
      });
      setNotice(item.is_active ? 'Inventory item archived.' : 'Inventory item restored.');
      await load();
    } catch (requestError) {
      setError(requestError.message);
    }
  };

  const openMovement = (item) => {
    setAdjusting(item);
    setMovementForm(emptyMovementForm);
    setError('');
    setNotice('');
  };

  const saveMovement = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      await api.recordStockMovement(adjusting.id, {
        movement_type: movementForm.movement_type,
        quantity: Number(movementForm.quantity),
        notes: movementForm.notes,
      });
      setNotice(`Stock ${movementForm.movement_type} recorded for ${adjusting.name}.`);
      setAdjusting(null);
      await load();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="management-page inventory-page">
      <div className="page-title-row no-print">
        <div><p className="eyebrow">Stock control</p><h2>Inventory</h2><p>Manage supplies, record adjustments, and monitor low-stock levels.</p></div>
        <div className="title-actions"><button className="secondary-button" type="button" onClick={() => window.print()}>Print inventory</button><button className="primary-button" type="button" onClick={() => openItem()}>+ Add stock item</button></div>
      </div>

      <PageMessage>{error}</PageMessage>
      <PageMessage type="success">{notice}</PageMessage>

      <div className="inventory-summary no-print">
        <article><small>Active items</small><strong>{activeItems.length}</strong></article>
        <article><small>Low stock</small><strong>{lowStockItems.length}</strong></article>
        <article><small>Out of stock</small><strong>{activeItems.filter((item) => item.quantity === 0).length}</strong></article>
        <article><small>Movements recorded</small><strong>{movements.length}</strong></article>
      </div>

      <div className="toolbar toolbar--filters no-print">
        <label className="search-field"><span aria-hidden="true">⌕</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search inventory" /></label>
        <label><span className="sr-only">Stock status</span><select value={stockFilter} onChange={(event) => setStockFilter(event.target.value)}><option value="all">All inventory</option><option value="low">Low stock</option><option value="healthy">Healthy stock</option><option value="archived">Archived</option></select></label>
        <span>{visibleItems.length} items</span>
      </div>
      <div className="table-card no-print">
        {loading ? <div className="loading-state">Loading inventory…</div> : visibleItems.length === 0 ? <EmptyState>No inventory items match these filters.</EmptyState> : <div className="data-table-wrap"><table className="data-table inventory-table"><thead><tr><th>Item</th><th>Quantity</th><th>Low level</th><th>Status</th><th>Movements</th><th><span className="sr-only">Actions</span></th></tr></thead><tbody>{visibleItems.map((item) => <tr className={item.is_low_stock && item.is_active ? 'low-stock-row' : ''} key={item.id}><td><div className="inventory-item-name"><strong>{item.name}</strong><small>{item.unit}</small></div></td><td><strong>{formatQuantity(item.quantity)} {item.unit}</strong></td><td>{formatQuantity(item.low_stock_level)} {item.unit}</td><td><StockLevel item={item} /></td><td>{item.movement_count}<small className="table-subtext">{item.last_movement_at ? formatDateTime(item.last_movement_at) : 'No adjustments'}</small></td><td><div className="row-actions">{item.is_active && <button type="button" onClick={() => openMovement(item)}>Adjust</button>}<button type="button" onClick={() => openItem(item)}>Edit</button><button className={item.is_active ? 'danger-link' : ''} type="button" onClick={() => toggleItem(item)}>{item.is_active ? 'Archive' : 'Restore'}</button></div></td></tr>)}</tbody></table></div>}
      </div>

      <section className="movement-section no-print">
        <div className="panel-heading"><div><p className="eyebrow">Audit trail</p><h3>Stock movement history</h3></div><label><span className="sr-only">Inventory item</span><select value={movementItemId} onChange={(event) => setMovementItemId(event.target.value)}><option value="all">All items</option>{items.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label></div>
        <div className="table-card">{visibleMovements.length === 0 ? <EmptyState>No stock movements have been recorded.</EmptyState> : <div className="data-table-wrap"><table className="data-table movement-table"><thead><tr><th>Date & time</th><th>Item</th><th>Movement</th><th>Quantity</th><th>Recorded by</th><th>Notes</th></tr></thead><tbody>{visibleMovements.map((movement) => <tr key={movement.id}><td className="muted-cell">{formatDateTime(movement.created_at)}</td><td><strong>{movement.item_name}</strong></td><td><span className={`movement-type movement-type--${movement.movement_type}`}>{movement.movement_type}</span></td><td><strong>{movement.movement_type === 'addition' ? '+' : '−'}{formatQuantity(movement.quantity)} {movement.unit}</strong></td><td>{movement.employee_name}</td><td className="muted-cell">{movement.notes || '—'}</td></tr>)}</tbody></table></div>}</div>
      </section>

      <section className="printable-report print-only" id="printable-inventory-report">
        <header className="report-print-header"><div><span className="receipt-logo">L</span><div><h1>Leslie&apos;s Restaurant</h1><p>Inventory report</p></div></div><small>Generated {formatDateTime(new Date().toISOString())}</small></header>
        <div className="report-range-line"><strong>{activeItems.length} active items</strong><span>{lowStockItems.length} at or below the low-stock level</span></div>
        <InventoryReportTable items={activeItems} />
      </section>

      {editing && <Modal title={editing === 'new' ? 'Add stock item' : 'Edit stock item'} subtitle={editing === 'new' ? 'Initial stock creates the first movement record.' : 'Use Adjust to change the current quantity.'} onClose={() => setEditing(null)}><form className="modal-form" onSubmit={saveItem}><PageMessage>{error}</PageMessage><div className="form-grid"><label className="form-field"><span>Item name</span><input autoFocus value={itemForm.name} onChange={(event) => setItemForm({ ...itemForm, name: event.target.value })} maxLength="80" required /></label><label className="form-field"><span>Unit</span><input value={itemForm.unit} onChange={(event) => setItemForm({ ...itemForm, unit: event.target.value })} placeholder="kg, bottles, pieces" maxLength="30" required /></label>{editing === 'new' && <label className="form-field"><span>Initial quantity</span><input type="number" min="0" max="1000000000" step="0.001" value={itemForm.quantity} onChange={(event) => setItemForm({ ...itemForm, quantity: event.target.value })} required /></label>}<label className="form-field"><span>Low-stock level</span><input type="number" min="0" max="1000000000" step="0.001" value={itemForm.low_stock_level} onChange={(event) => setItemForm({ ...itemForm, low_stock_level: event.target.value })} required /></label></div><label className="toggle-field"><input type="checkbox" checked={itemForm.is_active} onChange={(event) => setItemForm({ ...itemForm, is_active: event.target.checked })} /><span><strong>Item is active</strong><small>Only active items can receive stock adjustments.</small></span></label><div className="modal-actions"><button className="secondary-button" type="button" onClick={() => setEditing(null)}>Cancel</button><button className="primary-button" disabled={saving}>{saving ? 'Saving…' : 'Save item'}</button></div></form></Modal>}

      {adjusting && <Modal title={`Adjust ${adjusting.name}`} subtitle={`Current stock: ${formatQuantity(adjusting.quantity)} ${adjusting.unit}`} onClose={() => setAdjusting(null)}><form className="modal-form" onSubmit={saveMovement}><PageMessage>{error}</PageMessage><fieldset className="movement-selector"><legend>Movement type</legend><div><label className={movementForm.movement_type === 'addition' ? 'active' : ''}><input type="radio" name="movement_type" checked={movementForm.movement_type === 'addition'} onChange={() => setMovementForm({ ...movementForm, movement_type: 'addition' })} /><strong>Add stock</strong><small>Increase current quantity</small></label><label className={movementForm.movement_type === 'deduction' ? 'active movement-deduction' : 'movement-deduction'}><input type="radio" name="movement_type" checked={movementForm.movement_type === 'deduction'} onChange={() => setMovementForm({ ...movementForm, movement_type: 'deduction' })} /><strong>Deduct stock</strong><small>Decrease current quantity</small></label></div></fieldset><label className="form-field"><span>Quantity ({adjusting.unit})</span><input autoFocus type="number" min="0.001" max={movementForm.movement_type === 'deduction' ? adjusting.quantity : 1000000000} step="0.001" value={movementForm.quantity} onChange={(event) => setMovementForm({ ...movementForm, quantity: event.target.value })} required /></label><label className="form-field"><span>Notes (optional)</span><textarea rows="3" value={movementForm.notes} onChange={(event) => setMovementForm({ ...movementForm, notes: event.target.value })} maxLength="250" placeholder="Delivery, spoilage, correction…" /></label><div className="modal-actions"><button className="secondary-button" type="button" onClick={() => setAdjusting(null)}>Cancel</button><button className="primary-button" disabled={saving}>{saving ? 'Recording…' : 'Record movement'}</button></div></form></Modal>}
    </section>
  );
}
