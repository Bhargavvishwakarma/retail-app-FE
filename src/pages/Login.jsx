import { useCallback, useEffect, useRef, useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth';
import { useLanguage } from '../i18n';
import LoadingButton from '../components/LoadingButton';

let googleScriptPromise;

function loadGoogleIdentity() {
  if (window.google?.accounts?.id) return Promise.resolve(window.google.accounts.id);
  if (googleScriptPromise) return googleScriptPromise;

  googleScriptPromise = new Promise((resolve, reject) => {
    document.querySelector('script[data-google-identity]')?.remove();
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.dataset.googleIdentity = 'true';
    const onLoad = () => {
      if (window.google?.accounts?.id) resolve(window.google.accounts.id);
      else reject(new Error('Google Sign-In could not be loaded. Check your connection and try again.'));
    };
    const onError = () => reject(new Error('Google Sign-In could not be loaded. Check your connection and try again.'));
    script.addEventListener('load', onLoad, { once: true });
    script.addEventListener('error', onError, { once: true });
    document.head.appendChild(script);
  }).catch(error => {
    googleScriptPromise = undefined;
    throw error;
  });
  return googleScriptPromise;
}

function getLoginError(error, method) {
  if (error.message?.startsWith('This browser cannot keep') || error.message?.startsWith('The sign-in response was incomplete')) return error.message;
  const status = error.response?.status;
  if (status === 401 && method === 'password') return 'Invalid email or password';
  if (status === 401) return 'Google could not verify this sign-in. Please choose your account and try again.';
  if (status === 403) return 'This Google account is not enabled for this store. Ask the Owner to register your verified email.';
  if (!error.response) return 'Could not connect to the sign-in service. Check your connection and try again.';
  return 'Sign-in could not be completed. Please try again.';
}

export default function Login() {
  const { user, loading, login, loginWithGoogle } = useAuth();
  const { t } = useLanguage();
  const location = useLocation();
  const navigate = useNavigate();
  const googleButtonRef = useRef(null);
  const inFlightRef = useRef(false);
  const credentialHandlerRef = useRef(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [googleSetupError, setGoogleSetupError] = useState('');
  const [googleRetry, setGoogleRetry] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

  const finishLogin = () => {
    const destination = location.state?.from?.pathname;
    navigate(destination || '/', { replace: true });
  };

  const runLogin = useCallback(async (authenticate, method = 'google') => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    setSubmitting(true);
    setError('');
    try {
      await authenticate();
      finishLogin();
    } catch (err) {
      setError(getLoginError(err, method));
    } finally {
      inFlightRef.current = false;
      setSubmitting(false);
    }
  }, [location.state, navigate]);

  credentialHandlerRef.current = credential => {
    if (!credential?.credential) {
      setError('Google Sign-In was cancelled or did not return a verified account. Please try again.');
      return;
    }
    void runLogin(() => loginWithGoogle(credential.credential));
  };

  useEffect(() => {
    if (loading || !googleClientId || !googleButtonRef.current) return undefined;
    let active = true;
    setGoogleSetupError('');
    loadGoogleIdentity()
      .then(google => {
        if (!active || !googleButtonRef.current) return;
        google.initialize({
          client_id: googleClientId,
          callback: response => credentialHandlerRef.current?.(response),
          auto_select: false,
          cancel_on_tap_outside: true
        });
        google.renderButton(googleButtonRef.current, {
          type: 'standard',
          theme: 'outline',
          size: 'large',
          text: 'signin_with',
          shape: 'rectangular',
          width: Math.min(340, googleButtonRef.current.clientWidth || 340)
        });
      })
      .catch(error => { if (active) setGoogleSetupError(error); });
    return () => { active = false; };
  }, [googleClientId, googleRetry, loading]);

  if (!loading && user) return <Navigate to="/" replace />;
  if (loading) return <main className="login-page"><section className="login-card login-skeleton" aria-busy="true" aria-label={t('Loading sign in')}>
    <span className="visually-hidden" role="status">{t('Loading...')}</span>
    <div aria-hidden="true"><span className="skeleton-block login-skeleton-mark" /><span className="skeleton-block login-skeleton-brand" /><span className="skeleton-block login-skeleton-title" /><span className="skeleton-block login-skeleton-copy" />
      <span className="skeleton-block login-skeleton-label" /><span className="skeleton-block login-skeleton-input" />
      <span className="skeleton-block login-skeleton-label" /><span className="skeleton-block login-skeleton-input" />
      <span className="skeleton-block login-skeleton-submit" />
    </div>
  </section></main>;

  const submit = event => {
    event.preventDefault();
    void runLogin(() => login(email.trim(), password), 'password');
  };

  return <main className="login-page">
    <section className="login-card">
      <div className="login-brand-mark" aria-hidden="true">S</div>
      <span className="eyebrow">SUMANGALI RETAIL</span>
      <h1>{t('Sign in')}</h1>
      <p>{t('Sign in to manage your store workspace.')}</p>
      {error && <div className="error" role="alert">{error}</div>}
      <div className={`google-signin-shell${submitting ? ' is-disabled' : ''}`} aria-busy={submitting} aria-label="Sign in with Google">
        {googleClientId
          ? <div ref={googleButtonRef} className="google-signin-button" />
          : <p className="google-setup-message">Google Sign-In is not configured. Set <code>VITE_GOOGLE_CLIENT_ID</code> in the Vite environment.</p>}
      </div>
      {googleSetupError && <div className="google-setup-error"><p role="alert">{googleSetupError.message}</p><button type="button" className="muted" onClick={() => setGoogleRetry(value => value + 1)}>Retry Google Sign-In</button></div>}
      <div className="login-divider"><span>or use your existing account</span></div>
      <form onSubmit={submit} aria-busy={submitting}>
        <label>{t('Email')}<input type="email" autoComplete="username" value={email} onChange={event => setEmail(event.target.value)} required autoFocus /></label>
        <label>{t('Password')}<input type="password" autoComplete="current-password" value={password} onChange={event => setPassword(event.target.value)} required /></label>
        <LoadingButton type="submit" loading={submitting} loadingText={t('Signing in...')}>{t('Sign in')}</LoadingButton>
      </form>
    </section>
  </main>;
}
