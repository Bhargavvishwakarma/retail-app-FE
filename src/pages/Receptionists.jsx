import { useEffect, useState } from 'react';
import api from '../api';
import { useLanguage } from '../i18n';
import { useAuth } from '../auth';
import useSessionState from '../useSessionState';
import LoadingButton from '../components/LoadingButton';
import Pagination from '../components/Pagination';
import SkeletonTableRows from '../components/SkeletonTableRows';

const USER_LIST_PAGE_SIZE = 10;
const emptyForm = { name: '', email: '' };

function getRequestError(error, action = 'general') {
  const status = error.response?.status;
  if (status === 409 && action === 'create') return 'An account with this email already exists.';
  if (status === 409) return 'The last active Owner cannot be deactivated or demoted.';
  if (status === 403) return 'Your account no longer has permission to manage staff.';
  if (!error.response) return 'Could not connect to the server. Check your connection and try again.';
  if (status === 400) return 'Check the name and email address, then try again.';
  return 'The request could not be completed. Please try again.';
}

export default function Receptionists() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const draftKey = user.id || user.email || 'current-user';
  const [users, setUsers] = useState(/** @type {import('../types').AppUser[]} */ ([]));
  const [userTotal, setUserTotal] = useState(0);
  const [userPage, setUserPage] = useState(0);
  const [reloadUsers, setReloadUsers] = useState(0);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [form, setForm] = useSessionState(`retail-draft:${draftKey}:receptionist-form`, emptyForm);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const [actionKey, setActionKey] = useState('');

  useEffect(() => {
    let current = true;
    setLoadingUsers(true);
    setError('');
    api.get('/auth/users', { params: { page: userPage, size: USER_LIST_PAGE_SIZE } })
      .then(response => {
        if (!current) return;
        setUsers(response.data.content || []);
        setUserTotal(response.data.totalElements || 0);
      })
      .catch(err => { if (current) setError(getRequestError(err)); })
      .finally(() => { if (current) setLoadingUsers(false); });
    return () => { current = false; };
  }, [userPage, reloadUsers]);

  const submit = async event => {
    event.preventDefault();
    if (saving) return;
    setError('');
    setMessage('');
    setSaving(true);
    try {
      const response = await api.post('/auth/receptionists', {
        name: form.name.trim(),
        email: form.email.trim()
      });
      setMessage(`Pre-registered ${response.data.name} (${response.data.email}). They can sign in with Google using this verified email.`);
      setForm(emptyForm);
      setUserPage(0);
      setReloadUsers(value => value + 1);
    } catch (err) {
      setError(getRequestError(err, 'create'));
    } finally {
      setSaving(false);
    }
  };

  const updateAccount = async (account, action) => {
    const key = `${account.id}:${action}`;
    if (actionKey) return;
    setActionKey(key);
    setError('');
    setMessage('');
    try {
      const response = action === 'status'
        ? await api.patch(`/auth/users/${account.id}/status`, { active: !account.active })
        : await api.patch(`/auth/users/${account.id}/role`, { role: account.role === 'OWNER' ? 'RECEPTIONIST' : 'OWNER' });
      setUsers(current => current.map(item => item.id === account.id ? response.data : item));
      setMessage(`${response.data.name}'s account was updated.`);
    } catch (err) {
      setError(getRequestError(err, 'update'));
    } finally {
      setActionKey('');
    }
  };

  return <div className="receptionists-page">
    <header className="products-heading">
      <div><span className="eyebrow">{t('TEAM ACCESS')}</span><h1>{t('User management')}</h1><p>Pre-register staff and manage access to your store.</p></div>
    </header>
    {error && <p className="error" role="alert">{error}</p>}
    {message && <p className="success" role="status">{message}</p>}

    <section className="user-list-section">
      <div className="products-list-heading"><div><h2>{t('Store users')}</h2><p>{userTotal} {t('accounts')}</p></div></div>
      <div className="table-wrap"><table className="products-table user-table" aria-busy={loadingUsers}>
        <thead><tr><th>{t('Name')}</th><th>{t('Email')}</th><th>{t('Role')}</th><th>Account status</th><th>{t('Created')}</th><th>Access</th></tr></thead>
        <tbody>
          {loadingUsers && <SkeletonTableRows columns={6} label={t('Loading...')} />}
          {!loadingUsers && users.length === 0 && <tr><td className="products-empty" colSpan="6">{t('No users found')}</td></tr>}
          {!loadingUsers && users.map(account => {
            const isSelf = account.id === user.id;
            const busy = actionKey.startsWith(`${account.id}:`);
            return <tr key={account.id}>
              <td>{account.name}{isSelf && <span className="staff-self-label">You</span>}</td>
              <td>{account.email}</td>
              <td><span className={`user-role-badge ${account.role === 'OWNER' ? 'owner' : 'receptionist'}`}>{t(account.role === 'OWNER' ? 'Owner' : 'Receptionist')}</span></td>
              <td><span className={`account-status-badge${account.active ? ' active' : ' inactive'}`}>{account.active ? 'Active' : 'Inactive'}</span></td>
              <td>{account.createdAt ? new Date(account.createdAt).toLocaleDateString() : '—'}</td>
              <td>
                {isSelf
                  ? <span className="staff-self-note">Your access is managed by your sign-in.</span>
                  : <div className="staff-actions">
                    <LoadingButton type="button" className="muted" loading={busy && actionKey.endsWith(':status')} loadingText="Saving..." disabled={Boolean(actionKey)} onClick={() => updateAccount(account, 'status')}>
                      {account.active ? 'Deactivate' : 'Activate'}
                    </LoadingButton>
                    <LoadingButton type="button" className="muted" loading={busy && actionKey.endsWith(':role')} loadingText="Saving..." disabled={Boolean(actionKey)} onClick={() => updateAccount(account, 'role')}>
                      Make {account.role === 'OWNER' ? 'Receptionist' : 'Owner'}
                    </LoadingButton>
                  </div>}
              </td>
            </tr>;
          })}
        </tbody>
      </table></div>
      {!loadingUsers && <Pagination page={userPage} size={USER_LIST_PAGE_SIZE} total={userTotal} onPageChange={setUserPage} />}
    </section>

    <section className="create-receptionist-section">
      <div className="products-list-heading"><div><h2>Pre-register a receptionist</h2><p>They can sign in after choosing a Google account with this verified email. The backend does not send email.</p></div></div>
      <form className="form-grid receptionist-form" onSubmit={submit} aria-busy={saving}>
        <label className="product-field"><span>{t('Name *')}</span><input value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} maxLength={120} required /></label>
        <label className="product-field"><span>{t('Email *')}</span><input type="email" autoComplete="off" value={form.email} onChange={event => setForm({ ...form, email: event.target.value })} maxLength={254} required /></label>
        <div className="form-actions"><LoadingButton type="submit" loading={saving} loadingText="Registering...">Pre-register receptionist</LoadingButton></div>
      </form>
    </section>
  </div>;
}
