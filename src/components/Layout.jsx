import { NavLink, useNavigate } from 'react-router-dom';

const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', icon: '🏠' },
  { to: '/service-users', label: 'Service Users', icon: '👥' },
  { to: '/incidents', label: 'Incidents', icon: '🚨' },
  { to: '/medications', label: 'Medications', icon: '💊' },
  { to: '/care-plans', label: 'Care Plans', icon: '📋' },
];

export default function Layout({ children, onLogout }) {
  const navigate = useNavigate();

  function logout() {
    localStorage.removeItem('token');
    onLogout();
    navigate('/login');
  }

  return (
    <div style={styles.root}>
      <aside style={styles.sidebar}>
        <div style={styles.logo}>
          <span style={styles.logoIcon}>🌿</span>
          <div>
            <div style={styles.logoName}>Envico</div>
            <div style={styles.logoSub}>CareOS</div>
          </div>
        </div>

        <nav style={styles.nav}>
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
  },
  logo: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    padding: '1.5rem 1.25rem 1.25rem',
    borderBottom: '1px solid #2d2d4e',
  },
  logoIcon: {
    fontSize: '1.8rem',
  },
  logoName: {
    fontSize: '1rem',
    fontWeight: 700,
    letterSpacing: '0.5px',
    lineHeight: 1.2,
  },
  logoSub: {
    fontSize: '0.7rem',
    color: '#8888aa',
    textTransform: 'uppercase',
    letterSpacing: '1px',
  },
  nav: {
    display: 'flex',
    flexDirection: 'column',
    padding: '1rem 0.75rem',
    gap: '0.25rem',
    flex: 1,
  },
  navLink: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.6rem',
    padding: '0.6rem 0.75rem',
    borderRadius: '6px',
    color: '#b0b0cc',
    textDecoration: 'none',
    fontSize: '0.9rem',
    fontWeight: 500,
    transition: 'background 0.15s, color 0.15s',
  },
  navLinkActive: {
    background: '#2d2d4e',
    color: '#ffffff',
  },
  navIcon: {
    fontSize: '1rem',
    width: '20px',
    textAlign: 'center',
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
  },
  content: {
    flex: 1,
    padding: '2rem',
    overflowY: 'auto',
  },
};
