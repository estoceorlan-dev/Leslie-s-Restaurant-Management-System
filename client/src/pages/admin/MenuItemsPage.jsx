import { useEffect, useMemo, useState } from 'react';
import { api } from '../../services/api.js';
import { EmptyState, Modal, PageMessage, StatusBadge } from '../../components/Modal.jsx';

const formatCurrency = (cents) => new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(cents / 100);
const initialForm = { name: '', category_id: '', price: '', is_available: true, is_active: true };

function encodePhoto(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.onerror = () => reject(new Error('The selected photo could not be read.'));
    reader.readAsDataURL(file);
  });
}

export function MenuItemsPage() {
  const [items, setItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(initialForm);
  const [photo, setPhoto] = useState(undefined);
  const [preview, setPreview] = useState('');
  useEffect(() => {
    if (!photo) {
      setPreview('');
      return;
    }
    const url = URL.createObjectURL(photo);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [photo]);
  const savedPhoto = editing?.photo_version ? `/api/menu-photos/${editing.photo_version}` : '';
  const currentPhoto = photo === undefined ? savedPhoto : preview;
  const selectPhoto = (event) => {
    const file = event.target.files[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024 || !['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      event.target.value = '';
      setError('Choose a JPEG, PNG, or WebP photo up to 2 MiB.');
      return;
    }
    setPhoto(file);
    setError('');
  };

  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('active');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = () => {
    setLoading(true);
    Promise.all([api.menuItems(), api.categories()]).then(([menuItems, menuCategories]) => { setItems(menuItems); setCategories(menuCategories); }).catch((requestError) => setError(requestError.message)).finally(() => setLoading(false));
  };
  useEffect(load, []);

  const activeCategories = categories.filter((category) => category.is_active);
  const openCreate = () => {
    setPhoto(undefined); setEditing('new'); setForm({ ...initialForm, category_id: activeCategories[0]?.id ?? '' }); setError(''); setNotice('');
  };
  const openEdit = (item) => {
    setPhoto(undefined); setEditing(item); setForm({ name: item.name, category_id: item.category_id, price: (item.price_cents / 100).toFixed(2), is_available: Boolean(item.is_available), is_active: Boolean(item.is_active) }); setError(''); setNotice('');
  };
  const close = () => { if (!saving) { setPhoto(undefined); setEditing(null); } };
  const submit = async (event) => {
    event.preventDefault(); setSaving(true); setError('');
    const payload = { name: form.name, category_id: Number(form.category_id), price_cents: Math.round(Number(form.price) * 100), is_available: form.is_available, is_active: form.is_active };
    try {
      if (photo !== undefined) payload.photo = photo === null ? null : await encodePhoto(photo);
      if (editing === 'new') await api.createMenuItem(payload); else await api.updateMenuItem(editing.id, payload);
      setNotice(editing === 'new' ? 'Menu item created.' : 'Menu item updated.'); setEditing(null); setPhoto(undefined); load();
    } catch (requestError) { setError(requestError.message); }
    finally { setSaving(false); }
  };
  const toggleArchived = async (item) => {
    setError(''); setNotice('');
    try {
      await api.updateMenuItem(item.id, { name: item.name, category_id: item.category_id, price_cents: item.price_cents, is_available: Boolean(item.is_available), is_active: !item.is_active });
      setNotice(item.is_active ? 'Menu item archived.' : 'Menu item restored.'); load();
    } catch (requestError) { setError(requestError.message); }
  };

  const visible = useMemo(() => items.filter((item) => {
    const matchesSearch = `${item.name} ${item.category_name}`.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = categoryFilter === 'all' || item.category_id === Number(categoryFilter);
    const matchesStatus = statusFilter === 'all' || (statusFilter === 'active' ? item.is_active : !item.is_active);
    return matchesSearch && matchesCategory && matchesStatus;
  }), [items, search, categoryFilter, statusFilter]);

  return (
    <section className="management-page">
      <div className="page-title-row"><div><p className="eyebrow">Restaurant offering</p><h2>Menu items</h2><p>Keep item names, prices, availability, and categories up to date.</p></div><button className="primary-button" type="button" onClick={openCreate} disabled={!activeCategories.length}>+ Add menu item</button></div>
      <PageMessage>{error}</PageMessage><PageMessage type="success">{notice}</PageMessage>
      {!activeCategories.length && <PageMessage>Create an active category before adding a menu item.</PageMessage>}
      <div className="toolbar toolbar--filters"><label className="search-field"><span aria-hidden="true">⌕</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search menu" /></label><label><span className="sr-only">Category</span><select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}><option value="all">All categories</option>{categories.map((category) => <option value={category.id} key={category.id}>{category.name}</option>)}</select></label><label><span className="sr-only">Status</span><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="active">Active items</option><option value="archived">Archived items</option><option value="all">All statuses</option></select></label></div>
      <div className="table-card">
        {loading ? <div className="loading-state">Loading menu…</div> : visible.length === 0 ? <EmptyState>No menu items match these filters.</EmptyState> : (
          <div className="data-table-wrap"><table className="data-table"><thead><tr><th>Menu item</th><th>Category</th><th>Price</th><th>Availability</th><th>Status</th><th><span className="sr-only">Actions</span></th></tr></thead><tbody>
            {visible.map((item) => <tr key={item.id}><td><div className="menu-item-name">{item.photo_version && <img className="menu-thumb" src={`/api/menu-photos/${item.photo_version}`} alt="" loading="lazy" />}<strong>{item.name}</strong></div></td><td className="muted-cell">{item.category_name}</td><td><strong className="price-cell">{formatCurrency(item.price_cents)}</strong></td><td><StatusBadge active={item.is_available} activeLabel="Available" inactiveLabel="Unavailable" /></td><td><StatusBadge active={item.is_active} /></td><td><div className="row-actions"><button type="button" onClick={() => openEdit(item)}>Edit</button><button className={item.is_active ? 'danger-link' : ''} type="button" onClick={() => toggleArchived(item)}>{item.is_active ? 'Archive' : 'Restore'}</button></div></td></tr>)}
          </tbody></table></div>
        )}
      </div>

      {editing && <Modal title={editing === 'new' ? 'Add menu item' : 'Edit menu item'} subtitle="Prices are stored accurately in Philippine pesos." onClose={close}>
        <form className="modal-form" onSubmit={submit}><PageMessage>{error}</PageMessage><label className="form-field"><span>Item name</span><input autoFocus value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required minLength="2" maxLength="80" /></label><div className="form-grid"><label className="form-field"><span>Category</span><select value={form.category_id} onChange={(event) => setForm({ ...form, category_id: event.target.value })} required>{categories.map((category) => <option value={category.id} key={category.id} disabled={!category.is_active}>{category.name}{category.is_active ? '' : ' (archived)'}</option>)}</select></label><label className="form-field"><span>Price (₱)</span><input type="number" value={form.price} onChange={(event) => setForm({ ...form, price: event.target.value })} min="0" max="1000000" step="0.01" placeholder="0.00" required /></label></div>
          <div className="menu-photo-field">
            <label className="form-field"><span>Menu photo (optional)</span>
              <input type="file" accept="image/jpeg,image/png,image/webp" disabled={saving}
                key={photo === null ? 'removed' : 'picker'} onChange={selectPhoto} aria-describedby="menu-photo-help" />
              <small id="menu-photo-help">JPEG, PNG or WebP, up to 2 MiB.</small>
            </label>
            {currentPhoto && <div className="menu-item-name">
              <img className="menu-preview" src={currentPhoto} alt="Menu photo preview" />
              <button className="secondary-button" type="button" disabled={saving} onClick={() => setPhoto(null)}>Remove photo</button>
            </div>}
          </div>
          <label className="toggle-field"><input type="checkbox" checked={form.is_available} onChange={(event) => setForm({ ...form, is_available: event.target.checked })} /><span><strong>Available for ordering</strong><small>Turn this off when an item is temporarily unavailable.</small></span></label><label className="toggle-field"><input type="checkbox" checked={form.is_active} onChange={(event) => setForm({ ...form, is_active: event.target.checked })} /><span><strong>Item is active</strong><small>Archived items remain in historical records.</small></span></label><div className="modal-actions"><button className="secondary-button" type="button" onClick={close}>Cancel</button><button className="primary-button" disabled={saving}>{saving ? 'Saving…' : 'Save menu item'}</button></div></form>
      </Modal>}
    </section>
  );
}
