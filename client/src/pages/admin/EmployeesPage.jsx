import { useEffect, useState } from 'react';
import { api } from '../../services/api.js';
import { EmptyState, Modal, PageMessage, StatusBadge } from '../../components/Modal.jsx';

const emptyForm = { name: '', username: '', password: '', role: 'cashier', is_active: true };
const roleLabels = { admin: 'Administrator', cashier: 'Cashier', kitchen: 'Kitchen staff' };

export function EmployeesPage({ currentUser }) {
  const [employees, setEmployees] = useState([]);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [search, setSearch] = useState('');

  const load = () => {
    setLoading(true);
    api.employees().then(setEmployees).catch((requestError) => setError(requestError.message)).finally(() => setLoading(false));
  };
  useEffect(load, []);

  const openCreate = () => { setEditing('new'); setForm(emptyForm); setError(''); setNotice(''); };
  const openEdit = (employee) => {
    setEditing(employee);
    setForm({ name: employee.name, username: employee.username, password: '', role: employee.role, is_active: Boolean(employee.is_active) });
    setError(''); setNotice('');
  };
  const close = () => setEditing(null);

  const submit = async (event) => {
    event.preventDefault(); setSaving(true); setError('');
    try {
      if (editing === 'new') await api.createEmployee(form);
      else await api.updateEmployee(editing.id, form);
      setNotice(editing === 'new' ? 'Employee account created.' : 'Employee account updated.');
      close(); load();
    } catch (requestError) { setError(requestError.message); }
    finally { setSaving(false); }
  };

  const toggleActive = async (employee) => {
    setError(''); setNotice('');
    try {
      await api.updateEmployee(employee.id, {
        name: employee.name, username: employee.username, password: '', role: employee.role, is_active: !employee.is_active,
      });
      setNotice(employee.is_active ? 'Employee account deactivated.' : 'Employee account reactivated.');
      load();
    } catch (requestError) { setError(requestError.message); }
  };

  const visible = employees.filter((employee) => `${employee.name} ${employee.username} ${employee.role}`.toLowerCase().includes(search.toLowerCase()));

  return (
    <section className="management-page">
      <div className="page-title-row">
        <div><p className="eyebrow">People & access</p><h2>Employee accounts</h2><p>Create accounts, assign roles, and control who can sign in.</p></div>
        <button className="primary-button" type="button" onClick={openCreate}>+ Add employee</button>
      </div>
      <PageMessage>{error}</PageMessage><PageMessage type="success">{notice}</PageMessage>
      <div className="toolbar"><label className="search-field"><span aria-hidden="true">⌕</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search employees" /></label><span>{visible.length} accounts</span></div>
      <div className="table-card">
        {loading ? <div className="loading-state">Loading employees…</div> : visible.length === 0 ? <EmptyState>No employees match your search.</EmptyState> : (
          <div className="data-table-wrap"><table className="data-table"><thead><tr><th>Employee</th><th>Username</th><th>Role</th><th>Status</th><th><span className="sr-only">Actions</span></th></tr></thead>
            <tbody>{visible.map((employee) => <tr key={employee.id}>
              <td><div className="record-name"><span className="record-avatar">{employee.name[0].toUpperCase()}</span><strong>{employee.name}</strong>{employee.id === currentUser.id && <small>You</small>}</div></td>
              <td className="muted-cell">@{employee.username}</td><td>{roleLabels[employee.role]}</td><td><StatusBadge active={employee.is_active} activeLabel="Active" inactiveLabel="Inactive" /></td>
              <td><div className="row-actions"><button type="button" onClick={() => openEdit(employee)}>Edit</button><button className={employee.is_active ? 'danger-link' : ''} type="button" disabled={employee.id === currentUser.id} onClick={() => toggleActive(employee)}>{employee.is_active ? 'Deactivate' : 'Activate'}</button></div></td>
            </tr>)}</tbody></table></div>
        )}
      </div>

      {editing && <Modal title={editing === 'new' ? 'Add employee' : 'Edit employee'} subtitle="Assign only the access this employee needs." onClose={close}>
        <form className="modal-form" onSubmit={submit}>
          <PageMessage>{error}</PageMessage>
          <label className="form-field"><span>Full name</span><input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required maxLength="80" /></label>
          <label className="form-field"><span>Username</span><input value={form.username} onChange={(event) => setForm({ ...form, username: event.target.value })} required minLength="3" maxLength="30" /></label>
          <label className="form-field"><span>{editing === 'new' ? 'Temporary password' : 'New password (optional)'}</span><input type="password" autoComplete="new-password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} required={editing === 'new'} minLength={form.password || editing === 'new' ? 6 : undefined} /><small>{editing === 'new' ? 'At least 6 characters.' : 'Leave blank to keep the current password.'}</small></label>
          <label className="form-field"><span>Role</span><select value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value })}><option value="admin">Administrator</option><option value="cashier">Cashier</option><option value="kitchen">Kitchen staff</option></select></label>
          <label className="toggle-field"><input type="checkbox" checked={form.is_active} onChange={(event) => setForm({ ...form, is_active: event.target.checked })} /><span><strong>Account is active</strong><small>Inactive employees cannot sign in.</small></span></label>
          <div className="modal-actions"><button className="secondary-button" type="button" onClick={close}>Cancel</button><button className="primary-button" disabled={saving}>{saving ? 'Saving…' : 'Save employee'}</button></div>
        </form>
      </Modal>}
    </section>
  );
}
