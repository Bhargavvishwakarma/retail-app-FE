import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, NavLink, Navigate, Link, useLocation } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import Products from './pages/Products';
import Pos from './pages/Pos';
import Customers from './pages/Customers';
import Sales from './pages/Sales';
import Login from './pages/Login';
import Receptionists from './pages/Receptionists';
import Chat from './pages/Chat';
import { LanguageProvider, useLanguage } from './i18n';
import { AuthProvider, RequireAuth, useAuth } from './auth';
import LoadingButton from './components/LoadingButton';

function Workspace() {
  const { language, setLanguage, t } = useLanguage();
  const { user, logout, updateWorkspaceTheme } = useAuth();
  const location = useLocation();
  const [theme, setTheme] = useState(() => user.workspaceTheme || 'forest');
  const [themeSaving, setThemeSaving] = useState(false);
  const [themeError, setThemeError] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    setTheme(user.workspaceTheme || 'forest');
  }, [user.id, user.workspaceTheme]);

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!menuOpen) return undefined;
    const closeOnEscape = event => {
      if (event.key === 'Escape') setMenuOpen(false);
    };
    window.addEventListener('keydown', closeOnEscape);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', closeOnEscape);
      document.body.style.overflow = previousOverflow;
    };
  }, [menuOpen]);

  const selectTheme = async nextTheme => {
    if (themeSaving || nextTheme === theme) return;
    setTheme(nextTheme);
    setThemeError('');
    setThemeSaving(true);
    try {
      const savedProfile = await updateWorkspaceTheme(nextTheme);
      setTheme(savedProfile.workspaceTheme || nextTheme);
    } catch (error) {
      setTheme(user.workspaceTheme || 'forest');
      setThemeError(error.response?.data?.detail || 'Could not save this workspace colour. Please try again.');
    } finally {
      setThemeSaving(false);
    }
  };

  return <div className={`layout${location.pathname === '/chat' ? ' chat-workspace' : ''}`} data-theme={theme}>
    <header className="mobile-header">
      <button className="mobile-menu-toggle" type="button" aria-label={menuOpen ? 'Close navigation menu' : 'Open navigation menu'} aria-expanded={menuOpen} aria-controls="workspace-navigation" onClick={() => setMenuOpen(open => !open)}>
        {menuOpen
          ? <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" /></svg>
          : <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16" /></svg>}
      </button>
      <div className="brand">
        <span className="brand-mark" aria-hidden="true">S</span>
        <span className="brand-copy">
          <span className="brand-name">Sumangali</span>
          <span className="brand-description">Sarees &amp; Ready-Made</span>
        </span>
      </div>
    </header>
    {menuOpen && <button className="sidebar-backdrop" type="button" aria-label="Close navigation menu" onClick={() => setMenuOpen(false)} />}
    <aside id="workspace-navigation" className={`sidebar${menuOpen ? ' is-open' : ''}`}>
      <div className="brand">
        <span className="brand-mark" aria-hidden="true">S</span>
        <span className="brand-copy">
          <span className="brand-name">Sumangali</span>
          <span className="brand-description">Sarees &amp; Ready-Made</span>
        </span>
      </div>
      <div className="language-picker">
        <div className="language-label">{t('Language')}</div>
        <details className="language-menu">
          <summary aria-label={`${t('Language')}: ${language === 'en' ? 'English' : 'Kannada'}`}><span>{language === 'en' ? 'English' : 'Kannada'}</span><span className="language-chevron" aria-hidden="true" /></summary>
          <div className="language-options" role="group" aria-label={t('Language')}>
            <button type="button" aria-pressed={language === 'en'} onClick={event => { setLanguage('en'); event.currentTarget.closest('details').open = false; }}>English</button>
            <button type="button" aria-pressed={language === 'kn'} onClick={event => { setLanguage('kn'); event.currentTarget.closest('details').open = false; }}>Kannada</button>
          </div>
        </details>
      </div>
      <button className="sidebar-close-button" type="button" aria-label="Close navigation menu" onClick={() => setMenuOpen(false)}>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" /></svg>
      </button>
      <nav aria-label="Main navigation">
        {user.role === 'OWNER' && <NavLink to="/" end onClick={() => setMenuOpen(false)}><span className="nav-icon" aria-hidden="true">&#8962;</span>{t('Dashboard')}</NavLink>}
        <NavLink to="/pos" onClick={() => setMenuOpen(false)}><span className="nav-icon" aria-hidden="true">&#43;</span>{t('New Sale (POS)')}</NavLink>
        <NavLink to="/products" onClick={() => setMenuOpen(false)}><span className="nav-icon" aria-hidden="true">&#9671;</span>{t('Products')}</NavLink>
        <NavLink to="/customers" onClick={() => setMenuOpen(false)}><span className="nav-icon" aria-hidden="true">&#9823;</span>{t('Customers')}</NavLink>
        {user.role === 'OWNER' && <NavLink to="/sales" onClick={() => setMenuOpen(false)}><span className="nav-icon" aria-hidden="true">&#8599;</span>{t('Sales History')}</NavLink>}
        <NavLink to="/chat" onClick={() => setMenuOpen(false)}><span className="nav-icon" aria-hidden="true">?</span>{t('Chat')}</NavLink>
        {user.role === 'OWNER' && <NavLink to="/receptionists" onClick={() => setMenuOpen(false)}><span className="nav-icon" aria-hidden="true">&#43;</span>{t('Team access')}</NavLink>}
      </nav>
      <Link to="/profile" className="sidebar-user" aria-label="Open profile settings" onClick={() => setMenuOpen(false)}>
        <div><strong>{user.name}</strong><span>{user.role === 'OWNER' ? t('Owner') : t('Receptionist')}</span></div>
        <span className="sidebar-user-chevron" aria-hidden="true">›</span>
      </Link>
    </aside>
    <main className="content">
      <div className="workspace-topbar">
        <Link to="/chat" className="workspace-chat-action" aria-label="Open retailer chat">
          <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M3.25 4.5A2.25 2.25 0 0 1 5.5 2.25h9A2.25 2.25 0 0 1 16.75 4.5v6A2.25 2.25 0 0 1 14.5 12.75H9l-4.75 3v-3.42A2.24 2.24 0 0 1 3.25 10.5v-6Z" /></svg>
          <span>Ask assistant</span>
        </Link>
        <NavLink to="/profile" className="workspace-profile-action">Profile</NavLink>
      </div>
      <Routes>
        <Route path="/" element={user.role === 'OWNER' ? <Dashboard /> : <Navigate to="/pos" replace />} />
        <Route path="/pos" element={<Pos />} />
        <Route path="/products" element={<Products />} />
        <Route path="/customers" element={<Customers />} />
        <Route path="/chat" element={<Chat />} />
        <Route path="/sales" element={user.role === 'OWNER' ? <Sales /> : <Navigate to="/pos" replace />} />
        <Route path="/receptionists" element={user.role === 'OWNER' ? <Receptionists /> : <Navigate to="/pos" replace />} />
        <Route path="/profile" element={<Profile user={user} theme={theme} themeSaving={themeSaving} themeError={themeError} onThemeChange={selectTheme} onLogout={logout} />} />
        <Route path="*" element={<Navigate to={user.role === 'OWNER' ? '/' : '/pos'} replace />} />
      </Routes>
    </main>
  </div>;
}

function LongPressTextSelection({ children }) {
  useEffect(() => {
    let target = null;
    let timer = null;
    let startX = 0;
    let startY = 0;
    let selectionEnabled = false;

    const clearTarget = () => {
      target?.classList.remove('long-press-text-select');
      target = null;
      selectionEnabled = false;
    };
    const cancel = () => {
      if (timer) window.clearTimeout(timer);
      timer = null;
      if (!selectionEnabled) clearTarget();
    };
    const onPointerDown = event => {
      if (event.pointerType !== 'touch' || event.button !== 0) return;
      const root = document.querySelector('.app-selection-root');
      const element = event.target instanceof Element ? event.target : null;
      if (!root?.contains(element)) return;
      if (element.closest('input, textarea, select, button, a, [contenteditable="true"], [role="button"], [role="link"]')) return;

      if (selectionEnabled && window.getSelection()?.isCollapsed) clearTarget();
      cancel();
      target = element;
      startX = event.clientX;
      startY = event.clientY;
      timer = window.setTimeout(() => {
        target?.classList.add('long-press-text-select');
        selectionEnabled = true;
        timer = null;
      }, 450);
    };
    const onPointerMove = event => {
      if (target && !selectionEnabled && Math.hypot(event.clientX - startX, event.clientY - startY) > 10) cancel();
    };
    const onPointerUp = () => {
      if (timer) window.clearTimeout(timer);
      timer = null;
      if (!selectionEnabled) clearTarget();
      else window.setTimeout(() => {
        if (window.getSelection()?.isCollapsed) clearTarget();
      }, 0);
    };
    const onSelectionChange = () => {
      if (selectionEnabled && window.getSelection()?.isCollapsed) clearTarget();
    };

    document.addEventListener('pointerdown', onPointerDown, true);
    document.addEventListener('pointermove', onPointerMove, true);
    document.addEventListener('pointerup', onPointerUp, true);
    document.addEventListener('pointercancel', onPointerUp, true);
    document.addEventListener('selectionchange', onSelectionChange);
    return () => {
      if (timer) window.clearTimeout(timer);
      document.removeEventListener('pointerdown', onPointerDown, true);
      document.removeEventListener('pointermove', onPointerMove, true);
      document.removeEventListener('pointerup', onPointerUp, true);
      document.removeEventListener('pointercancel', onPointerUp, true);
      document.removeEventListener('selectionchange', onSelectionChange);
    };
  }, []);

  return <div className="app-selection-root">{children}</div>;
}

const themes = [
  { id: 'forest', name: 'Forest green', color: '#19745d' },
  { id: 'ocean', name: 'Ocean blue', color: '#3269a8' },
  { id: 'berry', name: 'Berry plum', color: '#80518e' },
  { id: 'clay', name: 'Warm terracotta', color: '#b65d43' },
];

function Profile({ user, theme, themeSaving, themeError, onThemeChange, onLogout }) {
  const { t } = useLanguage();
  const role = user.role === 'OWNER' ? t('Owner') : t('Receptionist');

  return <section className="profile-page">
    <div className="profile-heading">
      <div><span className="eyebrow">ACCOUNT</span><h1>Profile settings</h1><p>Manage your account and workspace appearance.</p></div>
    </div>
    <section className="profile-card" aria-labelledby="profile-account-heading">
      <div className="profile-card-heading"><span className="profile-avatar" aria-hidden="true">{user.name?.trim()?.charAt(0)?.toUpperCase() || 'U'}</span><div><h2 id="profile-account-heading">{user.name}</h2><p>{role}</p></div></div>
      <div className="profile-divider" />
      <div className="profile-section-heading"><div><h2>Workspace colours</h2><p>Choose an accent colour for buttons, highlights, and navigation.</p></div><button type="button" className="muted" disabled={themeSaving} onClick={() => onThemeChange('forest')}>{t('Reset')}</button></div>
      {themeError && <p className="error" role="alert">{themeError}</p>}
      <div className="profile-themes" role="group" aria-label="Workspace colour">
        {themes.map(option => <LoadingButton key={option.id} type="button" className={`profile-theme${theme === option.id ? ' selected' : ''}`} aria-pressed={theme === option.id} disabled={themeSaving} loading={themeSaving && theme === option.id} onClick={() => onThemeChange(option.id)}>
          <span className="profile-theme-swatch" style={{ '--swatch': option.color }} aria-hidden="true" />
          <span>{option.name}</span>
          {theme === option.id && <span className="profile-theme-check" aria-label="Selected">&#10003;</span>}
        </LoadingButton>)}
      </div>
    </section>
    <section className="profile-card profile-signout-card" aria-labelledby="profile-signout-heading">
      <div><h2 id="profile-signout-heading">Sign out</h2><p>Sign out of your Sumangali workspace on this device.</p></div>
      <button type="button" className="profile-signout-button" onClick={onLogout}>{t('Sign out')}</button>
    </section>
  </section>;
}

export default function App() {
  return <LanguageProvider><AuthProvider><BrowserRouter><LongPressTextSelection><Routes>
    <Route path="/login" element={<Login />} />
    <Route path="/*" element={<RequireAuth><Workspace /></RequireAuth>} />
  </Routes></LongPressTextSelection></BrowserRouter></AuthProvider></LanguageProvider>;
}
