import { NavLink, useNavigate } from 'react-router-dom';

const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', icon: '🏠' },
  { to: '/service-users', label: 'Service Users', icon: '👥' },
  { to: '/incidents', label: 'Incidents', icon: '🚨' },
  { to: '/medications', label: 'Medications', icon: '💊' },
  { to: '/care-plans', label: 'Care Plans', icon: '📋' },
  { to: '/invoices', label: 'Invoices', icon: '💰' },
  { to: '/payroll', label: 'Payroll', icon: '🧾' },
  { to: '/finance', label: 'Finance', icon: '📊' },
  { to: '/training', label: 'Training', icon: '📚' },
  { to: '/recruitment', label: 'Recruitment', icon: '🧑' },
  { to: '/compliance', label: 'Compliance', icon: '✅' },
  { to: '/staff-docs', label: 'Staff Docs', icon: '📄' },
];

function getCurrentUserRole() {
  try { return JSON.parse(localStorage.getItem('user') || '{}').role ?? null; } catch { return null; }
}

export default function Layout({ children, onLogout }) {
  const navigate = useNavigate();
  const userRole = getCurrentUserRole();

  function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    onLogout();
    navigate('/login');
  }

  return (
    <div style={styles.root}>
      <aside style={styles.sidebar}>
        <div style={styles.logo}>
          <img src="/Enivco-logo.png" alt="Envico" style={styles.logoImg} />
          <div style={styles.logoSub}>CareOS</div>
        </div>

        <nav style={styles.nav}>
          {/* CEO Office — pinned at top, gold accent */}
          <NavLink
            to="/ceo-office"
            style={({ isActive }) => ({
              ...styles.navLink,
              ...styles.ceoLink,
              ...(isActive ? styles.ceoLinkActive : {}),
            })}
          >
            <span style={styles.navIcon}>👔</span>
            CEO Office
          </NavLink>

          {/* AI Assistant — accent colour */}
          <NavLink
            to="/assistant"
            style={({ isActive }) => ({
              ...styles.navLink,
              ...styles.assistantLink,
              ...(isActive ? styles.assistantLinkActive : {}),
            })}
          >
            <span style={styles.navIcon}>🤖</span>
            AI Assistant
          </NavLink>

          <div style={styles.divider} />

          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              style={({ isActive }) => ({
                ...styles.navLink,
                ...(isActive ? styles.navLinkActive : {}),
              })}
            >
              <span style={styles.navIcon}>{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
        </nav>

        {userRole === 'ADMIN' && (
          <NavLink
            to="/users"
            style={({ isActive }) => ({
              ...styles.navLink,
              ...styles.adminLink,
              ...(isActive ? styles.adminLinkActive : {}),
            })}
          >
            <span style={styles.navIcon}>👤</span>
            Users
          </NavLink>
        )}

        <button style={styles.logoutBtn} onClick={logout}>
          <span>↩</span> Logout
        </button>
      </aside>

      <main style={styles.content}>{children}</main>
    </div>
  );
}

const styles = {
  root: {
    display: 'flex',
    minHeight: '100vh',
    fontFamily: 'system-ui, sans-serif',
    background: '#f0f2f5',
  },
  sidebar: {
    width: '220px',
    minHeight: '100vh',
    background: '#1a1a2e',
    color: '#fff',
    display: 'flex',
    flexDirection: 'column',
    padding: '0',
    flexShrink: 0,
    overflowY: 'auto',
  },
  logo: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: '0.25rem',
    padding: '1.25rem 1.25rem 1rem',
    borderBottom: '1px solid #2d2d4e',
  },
  logoImg: {
    width: '150px',
    height: 'auto',
    objectFit: 'contain',
    filter: 'brightness(0) invert(1)',
  },
  logoSub: {
    fontSize: '0.68rem',
    color: '#8888aa',
    textTransform: 'uppercase',
    letterSpacing: '1.5px',
    paddingLeft: '2px',
  },
  nav: {
    display: 'flex',
    flexDirection: 'column',
    padding: '0.75rem 0.75rem',
    gap: '0.2rem',
    flex: 1,
  },
  navLink: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.6rem',
    padding: '0.55rem 0.75rem',
    borderRadius: '6px',
    color: '#b0b0cc',
    textDecoration: 'none',
    fontSize: '0.88rem',
    fontWeight: 500,
    transition: 'background 0.15s, color 0.15s',
  },
  navLinkActive: {
    background: '#2d2d4e',
    color: '#ffffff',
  },
  ceoLink: {
    background: 'rgba(217, 119, 6, 0.15)',
    color: '#fcd34d',
    border: '1px solid rgba(217, 119, 6, 0.35)',
    fontWeight: 700,
    marginBottom: '0.2rem',
  },
  ceoLinkActive: {
    background: 'rgba(217, 119, 6, 0.35)',
    color: '#ffffff',
    border: '1px solid rgba(217, 119, 6, 0.65)',
  },
  assistantLink: {
    background: 'rgba(124, 58, 237, 0.15)',
    color: '#c4b5fd',
    border: '1px solid rgba(124, 58, 237, 0.3)',
    fontWeight: 600,
    marginBottom: '0.25rem',
  },
  assistantLinkActive: {
    background: 'rgba(124, 58, 237, 0.35)',
    color: '#ffffff',
    border: '1px solid rgba(124, 58, 237, 0.6)',
  },
  divider: {
    height: '1px',
    background: '#2d2d4e',
    margin: '0.35rem 0.25rem 0.5rem',
  },
  navIcon: {
    fontSize: '1rem',
    width: '20px',
    textAlign: 'center',
  },
  adminLink: {
    margin: '0.5rem 0.75rem 0.25rem',
    background: 'rgba(220, 38, 38, 0.1)',
    color: '#fca5a5',
    border: '1px solid rgba(220, 38, 38, 0.25)',
    fontWeight: 600,
    borderRadius: '6px',
  },
  adminLinkActive: {
    background: 'rgba(220, 38, 38, 0.25)',
    color: '#ffffff',
    border: '1px solid rgba(220, 38, 38, 0.5)',
  },
  logoutBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    margin: '0.75rem',
    padding: '0.6rem 0.75rem',
    background: 'transparent',
    border: '1px solid #2d2d4e',
    borderRadius: '6px',
    color: '#8888aa',
    cursor: 'pointer',
    fontSize: '0.85rem',
    textAlign: 'left',
    flexShrink: 0,
  },
  content: {
    flex: 1,
    padding: '2rem',
    overflowY: 'auto',
    minWidth: 0,
  },
};
