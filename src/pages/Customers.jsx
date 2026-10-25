import { useEffect, useState } from 'react';
import api from '../api';
import { useLanguage } from '../i18n';
import { useAuth } from '../auth';
import useSessionState from '../useSessionState';

const emptyForm = { name: '', phone: '', email: '', address: '' };

export default function Customers() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const draftKey = user.id || user.email || 'current-user';
  const [customers, setCustomers] = useState(/** @type {import('../types').Customer[]} */ ([]));
  const [form, setForm] = useSessionState(`retail-draft:${draftKey}:customer-form`, emptyForm);
  const [editingId, setEditingId] = useSessionState(`retail-draft:${draftKey}:customer-editing`, null);
  const [error, setError] = useState('');
  const [pendingDelete, setPendingDelete] = useState(/** @type {import('../types').Customer | null} */ (null));
  const [deleteError, setDeleteError] = useState('');
  const [deleting, setDeleting] = useState(false);

  const load = () => api.get('/customers').then(r => setCustomers(r.data));
  useEffect(() => { load(); }, []);

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const resetForm = () => {
    setForm(emptyForm);
    setEditingId(null);
    setError('');
  };

  const getError = (err) =>
    err.response && err.response.data && err.response.data.error ? err.response.data.error : t('Request failed');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      if (editingId) await api.put('/customers/' + editingId, form);
      else await api.post('/customers', form);
      setForm(emptyForm);
      setEditingId(null);
      load();
    } catch (err) {
      setError(getError(err));
    }
  };

  const handleEdit = (c) => {
    setEditingId(c.id);
    setForm({ name: c.name, phone: c.phone || '', email: c.email || '', address: c.address || '' });
  };

  const handleDelete = async () => {
    if (!pendingDelete || deleting) return;
    setDeleting(true);
    setDeleteError('');
    try {
      await api.delete('/customers/' + pendingDelete.id);
      setPendingDelete(null);
      load();
    } catch (err) {
      setDeleteError(getError(err));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div>
      <h1>{t('Customers')}</h1>
      {error && <p className="error">{error}</p>}
      {pendingDelete && <div className="confirm-overlay" onMouseDown={event => { if (event.target === event.currentTarget && !deleting) setPendingDelete(null); }} onKeyDown={event => { if (event.key === 'Escape' && !deleting) setPendingDelete(null); }}>
        <section className="confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="delete-customer-title" aria-describedby="delete-customer-description">
          <div className="confirm-icon" aria-hidden="true">!</div>
          <div className="confirm-copy">
            <h2 id="delete-customer-title">{t('Delete this customer?')}</h2>
            <p id="delete-customer-description">{pendingDelete.name}{pendingDelete.phone ? ` · ${pendingDelete.phone}` : ''}</p>
          </div>
          {deleteError && <p className="error confirm-error">{deleteError}</p>}
          <div className="confirm-actions">
            <button type="button" className="muted" autoFocus disabled={deleting} onClick={() => setPendingDelete(null)}>{t('Cancel')}</button>
            <button type="button" className="danger" disabled={deleting} onClick={handleDelete}>{deleting ? '…' : t('Delete')}</button>
          </div>
        </section>
      </div>}
      <form className="form-grid" onSubmit={handleSubmit}>
        <input name="name" placeholder={t('Name *')} value={form.name} onChange={handleChange} required />
        <input name="phone" placeholder={t('Phone')} value={form.phone} onChange={handleChange} />
        <input name="email" placeholder={t('Email')} value={form.email} onChange={handleChange} />
        <input name="address" placeholder={t('Address')} value={form.address} onChange={handleChange} />
        <div className="form-actions">
          <button type="button" className="muted" onClick={resetForm}>{t('Reset')}</button>
          <button type="submit">{t(editingId ? 'Update Customer' : 'Add Customer')}</button>
          {editingId && <button type="button" className="muted" onClick={() => { setEditingId(null); setForm(emptyForm); }}>{t('Cancel')}</button>}
        </div>
      </form>

      <table>
        <thead><tr><th>{t('Name')}</th><th>{t('Phone')}</th><th>{t('Email')}</th><th>{t('Address')}</th><th>{t('Actions')}</th></tr></thead>
        <tbody>
          {customers.map(c => (
            <tr key={c.id}>
              <td>{c.name}</td>
              <td>{c.phone}</td>
              <td>{c.email}</td>
              <td>{c.address}</td>
              <td>
                <button onClick={() => handleEdit(c)}>{t('Edit')}</button>{' '}
                {user.role === 'OWNER' && <button className="danger" onClick={() => { setDeleteError(''); setPendingDelete(c); }}>{t('Delete')}</button>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
