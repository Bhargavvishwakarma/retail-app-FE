import { useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth';
import { useLanguage } from '../i18n';

export default function Login() {
  const { user, loading, login } = useAuth();
  const { t } = useLanguage();
  const location = useLocation();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!loading && user) return <Navigate to={user.role === 'OWNER' ? '/' : '/pos'} replace />;

  const submit = async event => {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      const loggedInUser = await login(email.trim(), password);
      const destination = location.state?.from?.pathname;
      navigate(destination || (loggedInUser.role === 'OWNER' ? '/' : '/pos'), { replace: true });
    } catch (err) {
      setError(err.response?.data?.error || t('Invalid email or password'));
    } finally {
      setSubmitting(false);
    }
  };

  return <main className="login-page">
    <form className="login-card" onSubmit={submit}>
      <div className="login-brand-mark" aria-hidden="true">S</div>
      <span className="eyebrow">SUMANGALI RETAIL</span>
      <h1>{t('Sign in')}</h1>
      <p>{t('Sign in to manage your store workspace.')}</p>
      {error && <div className="error" role="alert">{error}</div>}
      <label>{t('Email')}<input type="email" autoComplete="username" value={email} onChange={event => setEmail(event.target.value)} required autoFocus /></label>
      <label>{t('Password')}<input type="password" autoComplete="current-password" value={password} onChange={event => setPassword(event.target.value)} required /></label>
      <button type="submit" disabled={submitting}>{submitting ? t('Signing in...') : t('Sign in')}</button>
    </form>
  </main>;
}
