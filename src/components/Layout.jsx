import { useEffect, useRef, useState, useCallback } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import api from '../services/api';

const NAV_ITEMS = [
  { to: '/',              label: 'Dashboard',     icon: '🏠' },
  { to: '/rota',          label: 'Rota',           icon: '📅' },
  { to: '/service-users', label: 'Service Users',  icon: '👥' },
  { to: '/incidents',     label: 'Incidents',      icon: '🚨' },
  { to: '/medications',   label: 'Medications',    icon: '💊' },
  { to: '/care-plans',    label: 'Care Plans',     icon: '📋' },
  { to: '/training',      label: 'Training',       icon: '📚' },
  { to: '/invoices',      label: 'Invoices',       icon: '💰',  roles: ['ADMIN', 'MANAGER'] },
  { to: '/payroll',       label: 'Payroll',        icon: '🧾',  roles: ['ADMIN', 'MANAGER'] },
  { to: '/finance',       label: 'Finance',        icon: '📊',  roles: ['ADMIN', 'MANAGER'] },
  { to: '/recruitment',   label: 'Recruitment',    icon: '🧑',  roles: ['ADMIN', 'MANAGER'] },
  { to: '/compliance',    label: 'Compliance',     icon: '✅',  roles: ['ADMIN', 'MANAGER'] },
  { to: '/staff-docs',    label: 'Staff Docs',     icon: '📄',  roles: ['ADMIN', 'MANAGER'] },
  { to: '/import',        label: 'Import Data',    icon: '📥',  roles: ['ADMIN', 'MANAGER'] },
];

function getCurrentUser() {
  try {
    const stored = JSON.parse(localStorage.getItem('user') || '{}');
    if (stored.role) return stored;
    const token = localStorage.getItem('token');
    if (token) {
      const payload = JSON.parse(atob(token.split('.')[1]));
      const merged = { ...stored, ...payload };
      localStorage.setItem('user', JSON.stringify(merged));
      return merged;
    }
    return stored;
  } catch { return {}; }
}

export default function Layout({ children, onLogout }) {
  const navigate  = useNavigate();
  const location  = useLocation();
  const user      = getCurrentUser();
  const role      = user.role || 'STAFF';

  const [criticalTasks,    setCriticalTasks]    = useState([]);
  const [bellOpen,         setBellOpen]         = useState(false);
  const [sidebarOpen,      setSidebarOpen]      = useState(false);
  const [isMobile,         setIsMobile]         = useState(() => window.innerWidth < 900);
  const [changePwdOpen,    setChangePwdOpen]    = useState(false);
  const [changePwdForm,    setChangePwdForm]    = useState({ current_password: '', new_password: '' });
  const [changePwdLoading, setChangePwdLoading] = useState(false);
  const [changePwdError,   setChangePwdError]   = useState('');
  const [changePwdSuccess, setChangePwdSuccess] = useState(false);

  const bellRef    = useRef(null);
  const sidebarRef = useRef(null);

  // Responsive breakpoint
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 900);
    window.addEventListener('resize', check, { passive: true });
    return () => window.removeEventListener('resize', check);
  }, []);

  // Close sidebar on route change (mobile)
  useEffect(() => { setSidebarOpen(false); }, [location.pathname]);

  // Prevent body scroll when mobile sidebar is open
  useEffect(() => {
    document.body.style.overflow = (isMobile && sidebarOpen) ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [isMobile, sidebarOpen]);

  // Critical tasks polling
  useEffect(() => {
    fetchCritical();
    const iv = setInterval(fetchCritical, 60000);
    return () => clearInterval(iv);
  }, []);

  async function fetchCritical() {
    try {
      const res = await api.get('/api/tasks?priority=CRITICAL&status=PENDING');
      setCriticalTasks(res.data.tasks ?? res.data ?? []);
    } catch { /* silent */ }
  }

  // Close bell dropdown on outside click
  useEffect(() => {
    if (!bellOpen) return;
    const h = (e) => { if (bellRef.current && !bellRef.current.contains(e.target)) setBellOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [bellOpen]);

  function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    onLogout();
    navigate('/login');
  }

  async function handleChangePassword(e) {
    e.preventDefault();
    setChangePwdLoading(true); setChangePwdError(''); setChangePwdSuccess(false);
    try {
      await api.post('/api/auth/change-password', changePwdForm);
      setChangePwdSuccess(true);
      setChangePwdForm({ current_password: '', new_password: '' });
      setTimeout(() => { setChangePwdOpen(false); setChangePwdSuccess(false); }, 1800);
    } catch (err) {
      setChangePwdError(err.response?.data?.error ?? 'Failed to change password');
    } finally { setChangePwdLoading(false); }
  }

  const visibleItems = NAV_ITEMS.filter((item) => !item.roles || item.roles.includes(role));

  // ── Sidebar inner content (shared between desktop + mobile drawer) ──────────
  const SidebarContent = () => (
    <div style={s.sidebarInner}>
      {/* Logo */}
      <div style={s.logo}>
        <img src="/Enivco-logo.png" alt="Envico" style={s.logoImg} />
        <div style={s.logoSub}>CareOS</div>
      </div>

      <nav style={s.nav}>
        {role === 'ADMIN' && (
          <NavLink to="/" end style={({ isActive }) => ({ ...s.navLink, ...s.ceoLink, ...(isActive ? s.ceoActive : {}) })}>
            <span style={s.icon}>🏛️</span> Executive Overview
          </NavLink>
        )}
        {role === 'ADMIN' && (
          <NavLink to="/ceo-office" style={({ isActive }) => ({ ...s.navLink, ...s.ceoLink, ...(isActive ? s.ceoActive : {}) })}>
            <span style={s.icon}>👔</span> CEO Office
          </NavLink>
        )}
        {role === 'ADMIN' && (
          <NavLink to="/ceo-briefing" style={({ isActive }) => ({ ...s.navLink, ...s.ceoLink, ...(isActive ? s.ceoActive : {}) })}>
            <span style={s.icon}>📊</span> CEO Briefing
          </NavLink>
        )}
        <NavLink to="/assistant" style={({ isActive }) => ({ ...s.navLink, ...s.aiLink, ...(isActive ? s.aiActive : {}) })}>
          <span style={s.icon}>🤖</span> AI Assistant
        </NavLink>
        <div style={s.divider} />
        {visibleItems.map((item) => (
          <NavLink key={item.to} to={item.to} end={item.to === '/'} style={({ isActive }) => ({ ...s.navLink, ...(isActive ? s.navActive : {}) })}>
            <span style={s.icon}>{item.icon}</span> {item.label}
          </NavLink>
        ))}
      </nav>

      {/* Admin-only links */}
      {role === 'ADMIN' && (
        <>
          <NavLink to="/users" style={({ isActive }) => ({ ...s.navLink, ...s.adminLink, ...(isActive ? s.adminActive : {}) })}>
            <span style={s.icon}>👤</span> Users
          </NavLink>
          <NavLink to="/ceo-onboarding" style={({ isActive }) => ({ ...s.navLink, ...s.overviewLink, ...(isActive ? s.overviewActive : {}) })}>
            <span style={s.icon}>🗺️</span> System Overview
          </NavLink>
          {/* Agents — disabled: no backend route */}
        </>
      )}

      {/* Bell */}
      <div ref={bellRef} style={{ position: 'relative', margin: '0.25rem 0.75rem' }}>
        <button style={s.bellBtn} onClick={() => setBellOpen((o) => !o)} title="Critical notifications">
          <span>🔔</span>
          {criticalTasks.length > 0 && (
            <span style={s.bellBadge}>{criticalTasks.length > 9 ? '9+' : criticalTasks.length}</span>
          )}
        </button>
        {bellOpen && (
          <div style={s.bellDropdown}>
            <p style={s.bellTitle}>
              {criticalTasks.length === 0 ? 'No critical tasks' : `${criticalTasks.length} critical task${criticalTasks.length > 1 ? 's' : ''}`}
            </p>
            {criticalTasks.slice(0, 5).map((t) => (
              <div key={t.id} style={s.bellItem}>
                <span style={{ fontSize: '0.75rem', color: '#dc2626', fontWeight: 700 }}>🚨 CRITICAL</span>
                <span style={{ fontSize: '0.85rem', color: '#1f2937', display: 'block', marginTop: '2px' }}>{t.title}</span>
                {t.referral_id && <span style={{ fontSize: '0.75rem', color: '#9ca3af' }}>Ref: {t.referral_id}</span>}
              </div>
            ))}
            {criticalTasks.length > 5 && (
              <p style={{ margin: '0.5rem 0 0', fontSize: '0.78rem', color: '#9ca3af', textAlign: 'center' }}>
                +{criticalTasks.length - 5} more
              </p>
            )}
          </div>
        )}
      </div>

      {/* Change Password */}
      <button style={s.utilBtn} onClick={() => { setChangePwdOpen(true); setChangePwdError(''); setChangePwdSuccess(false); }}>
        <span>🔑</span> Change Password
      </button>

      {/* Logout */}
      <button style={{ ...s.utilBtn, marginBottom: '1rem' }} onClick={logout}>
        <span>↩</span> Logout
      </button>
    </div>
  );

  return (
    <>
      {/* ── Change Password Modal ───────────────────────────────────────── */}
      {changePwdOpen && (
        <div style={cp.overlay}>
          <div style={cp.modal}>
            <h2 style={cp.title}>Change Password</h2>
            {changePwdSuccess && <div style={cp.success}>Password changed successfully!</div>}
            {changePwdError   && <div style={cp.error}>{changePwdError}</div>}
            {!changePwdSuccess && (
              <form onSubmit={handleChangePassword} style={cp.form}>
                <label style={cp.label}>Current Password</label>
                <input style={cp.input} type="password" value={changePwdForm.current_password} onChange={(e) => setChangePwdForm({ ...changePwdForm, current_password: e.target.value })} required autoFocus />
                <label style={cp.label}>New Password</label>
                <input style={cp.input} type="password" value={changePwdForm.new_password} onChange={(e) => setChangePwdForm({ ...changePwdForm, new_password: e.target.value })} required minLength={8} placeholder="Min. 8 characters" />
                <div style={cp.actions}>
                  <button type="button" style={cp.cancel} onClick={() => { setChangePwdOpen(false); setChangePwdError(''); setChangePwdForm({ current_password: '', new_password: '' }); }}>Cancel</button>
                  <button type="submit" style={cp.save} disabled={changePwdLoading}>{changePwdLoading ? 'Saving…' : 'Change Password'}</button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      <div style={s.root}>
        {/* ── MOBILE: top bar ─────────────────────────────────────────────── */}
        {isMobile && (
          <header style={s.mobileBar}>
            <button style={s.hamburger} onClick={() => setSidebarOpen(true)} aria-label="Open menu">
              <span style={s.hamLine} />
              <span style={s.hamLine} />
              <span style={s.hamLine} />
            </button>
            <div style={s.mobileLogo}>
              <img src="/Enivco-logo.png" alt="Envico" style={{ height: '28px', filter: 'brightness(0) invert(1)' }} />
              <span style={{ fontSize: '0.65rem', color: '#8888aa', letterSpacing: '1.5px', textTransform: 'uppercase', marginLeft: '6px' }}>CareOS</span>
            </div>
            <div ref={bellRef} style={{ position: 'relative' }}>
              <button style={s.bellBtnMobile} onClick={() => setBellOpen((o) => !o)}>
                🔔
                {criticalTasks.length > 0 && <span style={s.bellBadge}>{criticalTasks.length > 9 ? '9+' : criticalTasks.length}</span>}
              </button>
              {bellOpen && (
                <div style={{ ...s.bellDropdown, right: 0, left: 'auto', bottom: 'auto', top: '110%' }}>
                  <p style={s.bellTitle}>{criticalTasks.length === 0 ? 'No critical tasks' : `${criticalTasks.length} critical`}</p>
                  {criticalTasks.slice(0, 3).map((t) => (
                    <div key={t.id} style={s.bellItem}>
                      <span style={{ fontSize: '0.72rem', color: '#dc2626', fontWeight: 700 }}>🚨 {t.title}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </header>
        )}

        {/* ── DESKTOP sidebar ─────────────────────────────────────────────── */}
        {!isMobile && (
          <aside style={s.sidebar}>
            <SidebarContent />
          </aside>
        )}

        {/* ── MOBILE: backdrop + drawer ───────────────────────────────────── */}
        {isMobile && (
          <>
            {/* Backdrop */}
            <div
              style={{
                ...s.backdrop,
                opacity: sidebarOpen ? 1 : 0,
                pointerEvents: sidebarOpen ? 'auto' : 'none',
              }}
              onClick={() => setSidebarOpen(false)}
            />
            {/* Drawer */}
            <aside
              ref={sidebarRef}
              style={{
                ...s.drawer,
                transform: sidebarOpen ? 'translateX(0)' : 'translateX(-100%)',
              }}
            >
              {/* Close button */}
              <button style={s.drawerClose} onClick={() => setSidebarOpen(false)} aria-label="Close menu">✕</button>
              <SidebarContent />
            </aside>
          </>
        )}

        {/* ── Main content ────────────────────────────────────────────────── */}
        <main style={isMobile ? s.contentMobile : s.content}>
          {children}
        </main>
      </div>
    </>
  );
}

// ── Styles ──────────────────────────────────────────────────────────────────
const s = {
  root: { display: 'flex', minHeight: '100vh', fontFamily: 'system-ui, sans-serif', background: '#f0f2f5' },

  // Desktop sidebar
  sidebar: { width: '220px', minHeight: '100vh', background: '#1a1a2e', color: '#fff', display: 'flex', flexDirection: 'column', flexShrink: 0, overflowY: 'auto' },
  sidebarInner: { display: 'flex', flexDirection: 'column', flex: 1 },

  // Mobile top bar
  mobileBar: { position: 'fixed', top: 0, left: 0, right: 0, zIndex: 400, height: '56px', background: '#1a1a2e', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 1rem', boxShadow: '0 2px 12px rgba(0,0,0,0.3)' },
  mobileLogo: { display: 'flex', alignItems: 'center' },
  hamburger: { background: 'none', border: 'none', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: '5px', padding: '4px', justifyContent: 'center' },
  hamLine: { display: 'block', width: '22px', height: '2px', background: '#fff', borderRadius: '2px' },
  bellBtnMobile: { position: 'relative', background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.2rem', padding: '4px 6px', color: '#fff' },

  // Mobile drawer
  backdrop: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 490, transition: 'opacity 0.25s ease', backdropFilter: 'blur(2px)' },
  drawer: { position: 'fixed', top: 0, left: 0, bottom: 0, width: '260px', background: '#1a1a2e', zIndex: 500, overflowY: 'auto', transition: 'transform 0.28s cubic-bezier(0.4,0,0.2,1)', boxShadow: '4px 0 24px rgba(0,0,0,0.4)' },
  drawerClose: { position: 'absolute', top: '12px', right: '12px', background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff', cursor: 'pointer', fontSize: '1rem', borderRadius: '6px', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1 },

  // Logo
  logo: { display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '0.25rem', padding: '1.25rem 1.25rem 1rem', borderBottom: '1px solid #2d2d4e' },
  logoImg: { width: '140px', height: 'auto', objectFit: 'contain', filter: 'brightness(0) invert(1)' },
  logoSub: { fontSize: '0.68rem', color: '#8888aa', textTransform: 'uppercase', letterSpacing: '1.5px', paddingLeft: '2px' },

  // Nav
  nav: { display: 'flex', flexDirection: 'column', padding: '0.75rem', gap: '0.2rem', flex: 1 },
  icon: { fontSize: '1rem', width: '20px', textAlign: 'center', flexShrink: 0 },
  divider: { height: '1px', background: '#2d2d4e', margin: '0.35rem 0.25rem 0.5rem' },

  navLink: { display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.6rem 0.75rem', borderRadius: '6px', color: '#b0b0cc', textDecoration: 'none', fontSize: '0.88rem', fontWeight: 500 },
  navActive: { background: '#2d2d4e', color: '#ffffff' },

  ceoLink: { background: 'rgba(217,119,6,0.15)', color: '#fcd34d', border: '1px solid rgba(217,119,6,0.35)', fontWeight: 700, marginBottom: '0.15rem', display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.6rem 0.75rem', borderRadius: '6px', textDecoration: 'none', fontSize: '0.88rem' },
  ceoActive: { background: 'rgba(217,119,6,0.35)', color: '#fff', border: '1px solid rgba(217,119,6,0.65)' },

  aiLink: { background: 'rgba(124,58,237,0.15)', color: '#c4b5fd', border: '1px solid rgba(124,58,237,0.3)', fontWeight: 600, marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.6rem 0.75rem', borderRadius: '6px', textDecoration: 'none', fontSize: '0.88rem' },
  aiActive: { background: 'rgba(124,58,237,0.35)', color: '#fff', border: '1px solid rgba(124,58,237,0.6)' },

  adminLink: { margin: '0.25rem 0.75rem 0.15rem', background: 'rgba(220,38,38,0.1)', color: '#fca5a5', border: '1px solid rgba(220,38,38,0.25)', fontWeight: 600, borderRadius: '6px', display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.6rem 0.75rem', textDecoration: 'none', fontSize: '0.88rem' },
  adminActive: { background: 'rgba(220,38,38,0.25)', color: '#fff', border: '1px solid rgba(220,38,38,0.5)' },

  overviewLink: { margin: '0.15rem 0.75rem', background: 'rgba(45,45,78,0.4)', color: '#8888bb', border: '1px solid rgba(45,45,78,0.8)', fontWeight: 500, borderRadius: '6px', display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.6rem 0.75rem', textDecoration: 'none', fontSize: '0.88rem' },
  overviewActive: { background: '#2d2d4e', color: '#fff', border: '1px solid #4a4a6e' },

  agentLink: { margin: '0.15rem 0.75rem', background: 'rgba(58,181,74,0.08)', color: '#3ab54a', border: '1px solid rgba(58,181,74,0.25)', fontWeight: 600, fontFamily: 'monospace', borderRadius: '6px', display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.6rem 0.75rem', textDecoration: 'none', fontSize: '0.85rem' },
  agentActive: { background: 'rgba(58,181,74,0.2)', color: '#6ee77a', border: '1px solid rgba(58,181,74,0.5)' },

  // Bell
  bellBtn: { position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', padding: '0.55rem 0.75rem', background: 'transparent', border: '1px solid #2d2d4e', borderRadius: '6px', color: '#8888aa', cursor: 'pointer', fontSize: '1rem' },
  bellBadge: { position: 'absolute', top: '4px', right: '6px', background: '#dc2626', color: '#fff', borderRadius: '999px', fontSize: '0.65rem', fontWeight: 700, padding: '1px 5px', lineHeight: 1.4 },
  bellDropdown: { position: 'absolute', bottom: '110%', left: 0, width: '260px', background: '#1e1e35', border: '1px solid #2d2d4e', borderRadius: '8px', boxShadow: '0 8px 24px rgba(0,0,0,0.4)', zIndex: 2000, padding: '0.75rem' },
  bellTitle: { margin: '0 0 0.5rem', fontSize: '0.78rem', fontWeight: 700, color: '#8888aa', textTransform: 'uppercase', letterSpacing: '0.5px' },
  bellItem: { padding: '0.5rem 0', borderBottom: '1px solid #2d2d4e' },

  // Util buttons (change pwd, logout)
  utilBtn: { display: 'flex', alignItems: 'center', gap: '0.5rem', margin: '0.25rem 0.75rem 0', padding: '0.6rem 0.75rem', background: 'transparent', border: '1px solid #2d2d4e', borderRadius: '6px', color: '#8888aa', cursor: 'pointer', fontSize: '0.85rem', textAlign: 'left', width: 'calc(100% - 1.5rem)' },

  // Content
  content: { flex: 1, padding: '2rem', overflowY: 'auto', minWidth: 0 },
  contentMobile: { flex: 1, padding: '1rem', paddingTop: '72px', overflowY: 'auto', minWidth: 0, width: '100%' },
};

// Change password modal styles
const cp = {
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 3000, padding: '1rem' },
  modal:   { background: '#fff', borderRadius: '12px', padding: '2rem', width: '100%', maxWidth: '380px', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' },
  title:   { margin: '0 0 1.25rem', fontSize: '1.1rem', fontWeight: 700, color: '#1a1a2e' },
  form:    { display: 'flex', flexDirection: 'column', gap: '0.75rem' },
  label:   { fontSize: '0.82rem', fontWeight: 600, color: '#374151' },
  input:   { padding: '0.55rem 0.8rem', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '0.9rem', outline: 'none', background: '#f9fafb' },
  actions: { display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' },
  cancel:  { padding: '0.5rem 1.1rem', background: 'transparent', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '0.88rem', cursor: 'pointer', color: '#374151' },
  save:    { padding: '0.5rem 1.1rem', background: '#1a1a2e', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '0.88rem', fontWeight: 600, cursor: 'pointer' },
  error:   { background: '#fee2e2', color: '#991b1b', padding: '0.6rem 0.8rem', borderRadius: '6px', fontSize: '0.85rem', marginBottom: '0.25rem' },
  success: { background: '#dcfce7', color: '#166534', padding: '0.6rem 0.8rem', borderRadius: '6px', fontSize: '0.85rem', marginBottom: '0.25rem', textAlign: 'center', fontWeight: 600 },
};
