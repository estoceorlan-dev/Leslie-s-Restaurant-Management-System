import { useEffect, useState } from 'react';
import { api } from '../../services/api.js';
import { EmptyState, Modal, PageMessage, StatusBadge } from '../../components/Modal.jsx';

export function CategoriesPage() {
  const [categories, setCategories] = useState([]);
  const [editing, setEditing] = useState(null);
  const [name, setName] = useState('');
  const [active, setActive] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = () => {
    setLoading(true);
    api.categories().then(setCategories).catch((requestError) => setError(requestError.message)).finally(() => setLoading(false));
  };
  useEffect(load, []);

  const open = (category = 'new') => {
    setEditing(category); setName(category === 'new' ? '' : category.name); setActive(category === 'new' ? true : Boolean(category.is_active)); setError(''); setNotice('');
  };
  const close = () => setEditing(null);
  const submit = async (event) => {
    event.preventDefault(); setSaving(true); setError('');
    try {
      if (editing === 'new') await api.createCategory({ name, is_active: active });
      else await api.updateCategory(editing.id, { name, is_active: active });
      setNotice(editing === 'new' ? 'Menu category created.' : 'Menu category updated.'); close(); load();
    } catch (requestError) { setError(requestError.message); }
    finally { setSaving(false); }
  };
  const toggle = async (category) => {
    setError(''); setNotice('');
    try {
      await api.updateCategory(category.id, { name: category.name, is_active: !category.is_active });
      setNotice(category.is_active ? 'Category archived.' : 'Category restored.'); load();
    } catch (requestError) { setError(requestError.message); }
  };

  return (
    <section className="management-page">
      <div className="page-title-row"><div><p className="eyebrow">Menu structure</p><h2>Menu categories</h2><p>Organize items so staff can find them quickly during ordering.</p></div><button className="primary-button" type="button" onClick={() => open()}>+ Add category</button></div>
      <PageMessage>{error}</PageMessage><PageMessage type="success">{notice}</PageMessage>
      <div className="table-card">
        {loading ? <div className="loading-state">Loading categories…</div> : categories.length === 0 ? <EmptyState>Add your first menu category.</EmptyState> : (
          <div className="data-table-wrap"><table className="data-table"><thead><tr><th>Category</th><th>Menu items</th><th>Status</th><th><span className="sr-only">Actions</span></th></tr></thead><tbody>
            {categories.map((category) => <tr key={category.id}><td><div className="category-name"><span aria-hidden="true">#</span><strong>{category.name}</strong></div></td><td className="muted-cell">{category.item_count} {category.item_count === 1 ? 'item' : 'items'}</td><td><StatusBadge active={category.is_active} /></td><td><div className="row-actions"><button type="button" onClick={() => open(category)}>Edit</button><button className={category.is_active ? 'danger-link' : ''} type="button" onClick={() => toggle(category)}>{category.is_active ? 'Archive' : 'Restore'}</button></div></td></tr>)}
          </tbody></table></div>
        )}
      </div>
      <p className="page-hint">Archived categories and their items remain in your records but are unavailable for new orders.</p>

      {editing && <Modal title={editing === 'new' ? 'Add category' : 'Edit category'} subtitle="Use a short name your team will recognize." onClose={close}>
        <form className="modal-form" onSubmit={submit}><PageMessage>{error}</PageMessage><label className="form-field"><span>Category name</span><input autoFocus value={name} onChange={(event) => setName(event.target.value)} required minLength="2" maxLength="50" placeholder="e.g. Rice meals" /></label><label className="toggle-field"><input type="checkbox" checked={active} onChange={(event) => setActive(event.target.checked)} /><span><strong>Category is active</strong><small>Active categories can be assigned to menu items.</small></span></label><div className="modal-actions"><button className="secondary-button" type="button" onClick={close}>Cancel</button><button className="primary-button" disabled={saving}>{saving ? 'Saving…' : 'Save category'}</button></div></form>
      </Modal>}
    </section>
  );
}
