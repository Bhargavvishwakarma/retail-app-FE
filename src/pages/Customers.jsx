import { useEffect, useState } from 'react';
import api from '../api';
import { useLanguage } from '../i18n';
import { useAuth } from '../auth';
import useSessionState from '../useSessionState';
import LoadingButton from '../components/LoadingButton';
import Pagination from '../components/Pagination';
import SkeletonTableRows from '../components/SkeletonTableRows';

const emptyForm = { name: '', phone: '', email: '', address: '' };
const CUSTOMER_LIST_PAGE_SIZE = 10;

export default function Customers() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const draftKey = user.id || user.email || 'current-user';
  const [customers, setCustomers] = useState(/** @type {import('../types').Customer[]} */ ([]));
  const [customerTotal, setCustomerTotal] = useState(0);
  const [customerPage, setCustomerPage] = useState(0);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [reloadCustomers, setReloadCustomers] = useState(0);
  const [loadingCustomers, setLoadingCustomers] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useSessionState(`retail-draft:${draftKey}:customer-form`, emptyForm);
  const [editingId, setEditingId] = useSessionState(`retail-draft:${draftKey}:customer-editing`, null);
  const [error, setError] = useState('');
  const [pendingDelete, setPendingDelete] = useState(/** @type {import('../types').Customer | null} */ (null));
  const [deleteError, setDeleteError] = useState('');
  const [deleting, setDeleting] = useState(false);

  const getError = err => err.response?.data?.error || t('Request failed');

  useEffect(() => {
    const timeout = setTimeout(() => {
      setCustomerPage(0);
      setDebouncedSearch(search.trim());
    }, 250);
    return () => clearTimeout(timeout);
  }, [search]);

  useEffect(() => {
    let current = true;
    setLoadingCustomers(true);
    api.get('/customers', { params: { search: debouncedSearch, page: customerPage, size: CUSTOMER_LIST_PAGE_SIZE } })
      .then(response => {
        if (!current) return;
        setCustomers(response.data.content);
        setCustomerTotal(response.data.totalElements);
      })
      .catch(err => { if (current) setError(getError(err)); })
      .finally(() => { if (current) setLoadingCustomers(false); });
    return () => { current = false; };
  }, [debouncedSearch, customerPage, reloadCustomers, t]);

  const reload = () => setReloadCustomers(value => value + 1);

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const resetForm = () => {
    setForm(emptyForm);
    setEditingId(null);
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (saving) return;
    setError('');
    setSaving(true);
    try {
      if (editingId) await api.put('/customers/' + editingId, form);
      else await api.post('/customers', form);
      setForm(emptyForm);
      setEditingId(null);
      setCustomerPage(0);
      reload();
    } catch (err) {
      setError(getError(err));
    } finally {
      setSaving(false);
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
      setCustomerPage(0);
      reload();
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
            <LoadingButton type="button" className="danger" loading={deleting} loadingText={t('Deleting...')} onClick={handleDelete}>{t('Delete')}</LoadingButton>
          </div>
        </section>
      </div>}
      <form className="form-grid" aria-busy={saving} onSubmit={handleSubmit}>
        <input name="name" placeholder={t('Name *')} value={form.name} onChange={handleChange} required />
        <input name="phone" placeholder={t('Phone')} value={form.phone} onChange={handleChange} />
        <input name="email" placeholder={t('Email')} value={form.email} onChange={handleChange} />
        <input name="address" placeholder={t('Address')} value={form.address} onChange={handleChange} />
        <div className="form-actions">
          <button type="button" className="muted" disabled={saving} onClick={resetForm}>{t('Reset')}</button>
          <LoadingButton type="submit" loading={saving} loadingText={t('Saving...')}>{t(editingId ? 'Update Customer' : 'Add Customer')}</LoadingButton>
          {editingId && <button type="button" className="muted" disabled={saving} onClick={() => { setEditingId(null); setForm(emptyForm); }}>{t('Cancel')}</button>}
        </div>
      </form>

      <div className="products-list-heading"><div><h2>{t('Customer list')}</h2><p>{customerTotal} {t('customers')}</p></div><div className="products-list-controls"><input className="search-box" aria-label={t('Search customers')} placeholder={t('Search customers by name, phone, or email...')} value={search} onChange={event => setSearch(event.target.value)} /><button type="button" className="muted" onClick={() => { setSearch(''); setCustomerPage(0); }}>{t('Reset')}</button></div></div>
      <div className="table-wrap customer-table-wrap"><table className="customer-table" aria-busy={loadingCustomers}>
        <thead><tr><th>{t('Name')}</th><th>{t('Phone')}</th><th>{t('Email')}</th><th>{t('Address')}</th><th>{t('Actions')}</th></tr></thead>
        <tbody aria-busy={loadingCustomers}>
          {loadingCustomers && <SkeletonTableRows columns={5} label={t('Loading customers...')} />}
          {!loadingCustomers && customers.length === 0 && <tr><td className="products-empty" colSpan="5">{t('No customers found')}</td></tr>}
          {!loadingCustomers && customers.map(c => (
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
      </table></div>
      {!loadingCustomers && <Pagination page={customerPage} size={CUSTOMER_LIST_PAGE_SIZE} total={customerTotal} onPageChange={setCustomerPage} />}
    </div>
  );
}
