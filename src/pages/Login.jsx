import { useState, useRef } from 'react';
import api from '../services/api';

const QUICK_USERS = [
  { name: 'Engelbert', role: 'CEO', email: 'admin@test.com', password: '12345678' },
  { name: 'Manager', role: 'Manager', email: 'manager@test.com', password: '12345678' },
  { name: 'Staff', role: 'Staff', email: 'staff@test.com', password: '12345678' },
];

export default function Login({ onLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [hoveredPill, setHoveredPill] = useState(null);
  const submitRef = useRef(null);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await api.post('/api/auth/login', { email, password });
      localStorage.setItem('token', res.data.token);
      if (res.data.user) {
        localStorage.setItem('user', JSON.stringify(res.data.user));
        console.log('[Login] stored user:', res.data.user);
      } else {
        console.warn('[Login] no user object in response — role-based nav may not work');
      }
      onLogin();
    } catch (err) {
      console.error('[Login] error:', err);
      console.error('[Login] status:', err.response?.status);
      console.error('[Login] data:', err.response?.data);
      const msg =
        err.response?.data?.message ||
        err.response?.data?.error ||
        (err.response ? `HTTP ${err.response.status}` : err.message) ||
        'Login failed';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  function fillCredentials(user) {
    setEmail(user.email);
    setPassword(user.password);
    submitRef.current?.focus();
  }

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h1 style={styles.title}>Envico Admin</h1>
        <form onSubmit={handleSubmit}>
          <div style={styles.field}>
            <label style={styles.label}>Email</label>
            <input
              style={styles.input}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
            />
          </div>
          <div style={styles.field}>
            <label style={styles.label}>Password</label>
            <input
              style={styles.input}
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          {error && <p style={styles.error}>{error}</p>}
          <button ref={submitRef} style={styles.button} type="submit" disabled={loading}>
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        {/* Quick Access Pills */}
        <div style={styles.divider} />
        <p style={styles.pillsLabel}>Quick access (click to fill)</p>
        <div style={styles.pillsRow}>
          {QUICK_USERS.map((user) => {
            const isHovered = hoveredPill === user.role;
            return (
              <button
                key={user.role}
                type="button"
                onClick={() => fillCredentials(user)}
                onMouseEnter={() => setHoveredPill(user.role)}
                onMouseLeave={() => setHoveredPill(null)}
                style={{
                  ...styles.pill,
                  ...(isHovered ? styles.pillHover : {}),
                }}
              >
                <span style={{ ...styles.pillName, ...(isHovered ? styles.pillNameHover : {}) }}>
                  {user.name}
                </span>
                <span style={{ ...styles.pillBadge, ...(isHovered ? styles.pillBadgeHover : {}) }}>
                  {user.role}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

const styles = {
  container: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100vh',
    background: '#f0f2f5',
  },
  card: {
    background: '#fff',
    padding: '2rem',
    borderRadius: '8px',
    boxShadow: '0 2px 12px rgba(0,0,0,0.1)',
    width: '360px',
  },
  title: {
    margin: '0 0 1.5rem',
    fontSize: '1.5rem',
    textAlign: 'center',
    color: '#1a1a2e',
  },
  field: {
    marginBottom: '1rem',
  },
  label: {
    display: 'block',
    marginBottom: '4px',
    fontSize: '0.875rem',
    color: '#555',
  },
  input: {
    width: '100%',
    padding: '0.5rem 0.75rem',
    border: '1px solid #ccc',
    borderRadius: '4px',
    fontSize: '1rem',
    boxSizing: 'border-box',
  },
  button: {
    width: '100%',
    padding: '0.65rem',
    background: '#1a1a2e',
    color: '#fff',
    border: 'none',
    borderRadius: '4px',
    fontSize: '1rem',
    cursor: 'pointer',
    marginTop: '0.5rem',
  },
  error: {
    color: '#c0392b',
    fontSize: '0.875rem',
    marginBottom: '0.5rem',
  },
  divider: {
    marginTop: '1.25rem',
    borderTop: '1px solid rgba(0,0,0,0.08)',
  },
  pillsLabel: {
    margin: '0.6rem 0 0.5rem',
    fontSize: '0.7rem',
    color: '#aaa',
    textAlign: 'center',
    letterSpacing: '0.03em',
  },
  pillsRow: {
    display: 'flex',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: '8px',
  },
  pill: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    padding: '5px 14px',
    background: 'rgba(58,138,58,0.08)',
    border: '1px solid rgba(58,138,58,0.35)',
    borderRadius: '9999px',
    cursor: 'pointer',
    transition: 'all 0.15s',
    outline: 'none',
  },
  pillHover: {
    background: '#3a8a3a',
    borderColor: '#3a8a3a',
  },
  pillName: {
    fontSize: '12px',
    fontWeight: 600,
    color: '#444',
  },
  pillNameHover: {
    color: '#fff',
  },
  pillBadge: {
    fontSize: '10px',
    fontWeight: 700,
    fontFamily: 'monospace',
    color: '#3ab54a',
    letterSpacing: '0.04em',
  },
  pillBadgeHover: {
    color: '#fff',
  },
};
