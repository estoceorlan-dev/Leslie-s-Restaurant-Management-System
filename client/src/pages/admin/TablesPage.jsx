import { useEffect, useState } from 'react';
import { api } from '../../services/api.js';
import { EmptyState, Modal, PageMessage, StatusBadge } from '../../components/Modal.jsx';

export function TablesPage() {
  const [tables, setTables] = useState([]);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ table_number: '', capacity: 4, is_active: true });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const load = () => { setLoading(true); api.tables().then(setTables).catch((requestError) => setError(requestError.message)).finally(() => setLoading(false)); };
  useEffect(load, []);
  const open = (table = 'new') => { setEditing(table); setForm(table === 'new' ? { table_number: '', capacity: 4, is_active: true } : { table_number: table.table_number, capacity: table.capacity, is_active: Boolean(table.is_active) }); setError(''); setNotice(''); };
  const close = () => setEditing(null);
  const submit = async (event) => {
    event.preventDefault(); setSaving(true); setError('');
    const payload = { table_number: Number(form.table_number), capacity: Number(form.capacity), is_active: form.is_active };
    try { if (editing === 'new') await api.createTable(payload); else await api.updateTable(editing.id, payload); setNotice(editing === 'new' ? 'Restaurant table added.' : 'Restaurant table updated.'); close(); load(); }
    catch (requestError) { setError(requestError.message); } finally { setSaving(false); }
  };
  const toggle = async (table) => {
    setError(''); setNotice('');
    try { await api.updateTable(table.id, { table_number: table.table_number, capacity: table.capacity, is_active: !table.is_active }); setNotice(table.is_active ? 'Table archived.' : 'Table restored.'); load(); }
    catch (requestError) { setError(requestError.message); }
  };

  return (
    <section className="management-page">
      <div className="page-title-row"><div><p className="eyebrow">Dining room</p><h2>Restaurant tables</h2><p>Set up table numbers and seating capacity for dine-in orders.</p></div><button className="primary-button" type="button" onClick={() => open()}>+ Add table</button></div>
      <PageMessage>{error}</PageMessage><PageMessage type="success">{notice}</PageMessage>
      {loading ? <div className="table-card loading-state">Loading tables…</div> : tables.length === 0 ? <div className="table-card"><EmptyState>Add your first restaurant table.</EmptyState></div> : <div className="tables-grid">{tables.map((table) => <article className={`restaurant-table-card ${!table.is_active ? 'restaurant-table-card--archived' : ''}`} key={table.id}><div className="table-card-top"><div className="table-number"><small>Table</small><strong>{table.table_number}</strong></div><StatusBadge active={table.is_active} /></div><div className="capacity"><span className="chair-dots" aria-hidden="true">● ● ●</span><strong>{table.capacity}</strong><span>{table.capacity === 1 ? 'seat' : 'seats'}</span></div><div className="table-card-footer"><span className={`occupancy occupancy--${table.status}`}>{table.status}</span><div className="row-actions"><button type="button" onClick={() => open(table)}>Edit</button><button className={table.is_active ? 'danger-link' : ''} type="button" onClick={() => toggle(table)}>{table.is_active ? 'Archive' : 'Restore'}</button></div></div></article>)}</div>}
      <p className="page-hint">Occupied tables cannot be archived. Dine-in orders occupy their table until the kitchen completes the order.</p>
      {editing && <Modal title={editing === 'new' ? 'Add table' : 'Edit table'} subtitle="Use the same number shown in your dining room." onClose={close}><form className="modal-form" onSubmit={submit}><PageMessage>{error}</PageMessage><div className="form-grid"><label className="form-field"><span>Table number</span><input autoFocus type="number" value={form.table_number} onChange={(event) => setForm({ ...form, table_number: event.target.value })} min="1" max="999" step="1" required /></label><label className="form-field"><span>Seating capacity</span><input type="number" value={form.capacity} onChange={(event) => setForm({ ...form, capacity: event.target.value })} min="1" max="50" step="1" required /></label></div><label className="toggle-field"><input type="checkbox" checked={form.is_active} onChange={(event) => setForm({ ...form, is_active: event.target.checked })} /><span><strong>Table is active</strong><small>Active tables can be assigned to dine-in orders.</small></span></label><div className="modal-actions"><button className="secondary-button" type="button" onClick={close}>Cancel</button><button className="primary-button" disabled={saving}>{saving ? 'Saving…' : 'Save table'}</button></div></form></Modal>}
    </section>
  );
}
