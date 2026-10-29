import { useEffect, useState } from 'react';
import api from '../api';
import { useLanguage } from '../i18n';
import { useAuth } from '../auth';
import useSessionState from '../useSessionState';
import LoadingButton from '../components/LoadingButton';
import Pagination from '../components/Pagination';
import SkeletonTableRows from '../components/SkeletonTableRows';

const USER_LIST_PAGE_SIZE = 10;

export default function Receptionists() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const draftKey = user.id || user.email || 'current-user';
  const [users, setUsers] = useState(/** @type {import('../types').AppUser[]} */ ([]));
  const [userTotal, setUserTotal] = useState(0);
  const [userPage, setUserPage] = useState(0);
  const [reloadUsers, setReloadUsers] = useState(0);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [form, setForm] = useSessionState(`retail-draft:${draftKey}:receptionist-form`, { name: '', email: '' });
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let current = true;
    setLoadingUsers(true);
    api.get('/auth/users', { params: { page: userPage, size: USER_LIST_PAGE_SIZE } })
      .then(response => {
        if (!current) return;
        setUsers(response.data.content);
        setUserTotal(response.data.totalElements);
      })
      .catch(err => { if (current) setError(err.response?.data?.error || t('Request failed')); })
      .finally(() => { if (current) setLoadingUsers(false); });
    return () => { current = false; };
  }, [userPage, reloadUsers, t]);

  const submit = async event => {
    event.preventDefault();
    setError('');
    setMessage('');
    setSaving(true);
    try {
      const response = await api.post('/auth/receptionists', { ...form, password });
      setMessage(`${t('Receptionist account created for')} ${response.data.name} (${response.data.email}).`);
      setForm({ name: '', email: '' });
      setPassword('');
      setUserPage(0);
      setReloadUsers(value => value + 1);
    } catch (err) {
      setError(err.response?.data?.error || t('Request failed'));
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => {
    setForm({ name: '', email: '' });
    setPassword('');
    setError('');
    setMessage('');
  };

  return <div className="receptionists-page">
    <header className="products-heading">
      <div><span className="eyebrow">{t('TEAM ACCESS')}</span><h1>{t('User management')}</h1><p>{t('View store users and create receptionist accounts.')}</p></div>
    </header>
    {error && <p className="error" role="alert">{error}</p>}
    {message && <p className="success" role="status">{message}</p>}

    <section className="user-list-section">
      <div className="products-list-heading"><div><h2>{t('Store users')}</h2><p>{userTotal} {t('accounts')}</p></div></div>
      <div className="table-wrap"><table className="products-table user-table" aria-busy={loadingUsers}>
        <thead><tr><th>{t('Name')}</th><th>{t('Email')}</th><th>{t('Role')}</th><th>{t('Created')}</th></tr></thead>
        <tbody>
          {loadingUsers && <SkeletonTableRows columns={4} label={t('Loading...')} />}
          {!loadingUsers && users.length === 0 && <tr><td className="products-empty" colSpan="4">{t('No users found')}</td></tr>}
          {!loadingUsers && users.map(account => <tr key={account.id}>
            <td>{account.name}</td>
            <td>{account.email}</td>
            <td><span className={`user-role-badge ${account.role === 'OWNER' ? 'owner' : 'receptionist'}`}>{t(account.role === 'OWNER' ? 'Owner' : 'Receptionist')}</span></td>
            <td>{account.createdAt ? new Date(account.createdAt).toLocaleString() : '—'}</td>
          </tr>)}
        </tbody>
      </table></div>
      {!loadingUsers && <Pagination page={userPage} size={USER_LIST_PAGE_SIZE} total={userTotal} onPageChange={setUserPage} />}
    </section>

    <section className="create-receptionist-section">
      <div className="products-list-heading"><div><h2>{t('Create receptionist')}</h2><p>{t('Create a login for a trusted member of your store team.')}</p></div></div>
    <form className="form-grid receptionist-form" onSubmit={submit}>
      <label className="product-field"><span>{t('Name *')}</span><input value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} required /></label>
      <label className="product-field"><span>{t('Email *')}</span><input type="email" autoComplete="off" value={form.email} onChange={event => setForm({ ...form, email: event.target.value })} required /></label>
      <label className="product-field"><span>{t('Password *')}</span><input type="password" autoComplete="new-password" minLength={8} value={password} onChange={event => setPassword(event.target.value)} required /><small>{t('Use at least 8 characters.')}</small></label>
      <div className="form-actions"><button type="button" className="muted" disabled={saving} onClick={resetForm}>{t('Reset')}</button><LoadingButton type="submit" loading={saving} loadingText={t('Creating...')}>{t('Create receptionist')}</LoadingButton></div>
    </form>
    </section>
  </div>;
}
