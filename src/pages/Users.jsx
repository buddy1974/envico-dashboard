import { useEffect, useState } from 'react';
import api from '../services/api';

const ROLE_COLOURS = {
  ADMIN:   { background: '#fee2e2', color: '#991b1b' },
  MANAGER: { background: '#ffedd5', color: '#9a3412' },
  STAFF:   { background: '#dbeafe', color: '#1e40af' },
};

const STATUS_COLOURS = {
  active:   { background: '#dcfce7', color: '#166534' },
  inactive: { background: '#f3f4f6', color: '#6b7280' },
};

function Badge({ label, colours }) {
  return (
    <span style={{ ...styles.badge, ...colours }}>
      {label}
    </span>
  );
}

function formatDate(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
}

const EMPTY_FORM = { name: '', email: '', password: '', role: 'STAFF', location_id: '' };

export default function Users() {
  const [users, setUsers]       = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm]         = useState(EMPTY_FORM);
  const [saving, setSaving]     = useState(false);
  const [formError, setFormError] = useState('');
  const [actionLoading, setActionLoading] = useState(null);

  // Get current user id from localStorage
  const currentUser = (() => {
    try { return JSON.parse(localStorage.getItem('user') || '{}'); } catch { return {}; }
  })();

  async function load() {
    try {
      setLoading(true);
      const res = await api.get('/api/users');
      setUsers(res.data.users ?? []);
    } catch (err) {
      setError(err.response?.data?.error ?? 'Failed to load users');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function handleAdd(e) {
    e.preventDefault();
    setSaving(true);
    setFormError('');
    try {
      const payload = {
        name: form.name.trim(),
        email: form.email.trim(),
        password: form.password,
        role: form.role,
      };
      if (form.location_id) payload.location_id = parseInt(form.location_id, 10);
      await api.post('/api/users', payload);
      setForm(EMPTY_FORM);
      setShowForm(false);
      await load();
    } catch (err) {
      setFormError(err.response?.data?.error ?? 'Failed to create user');
    } finally {
      setSaving(false);
    }
  }

  async function handleDeactivate(user) {
    if (!window.confirm(`Deactivate ${user.name}?`)) return;
    setActionLoading(user.id);
    try {
      await api.post(`/api/users/${user.id}/deactivate`);
      await load();
    } catch (err) {
      alert(err.response?.data?.error ?? 'Failed to deactivate user');
    } finally {
      setActionLoading(null);
    }
  }

  async function handleReactivate(user) {
    if (!window.confirm(`Reactivate ${user.name}?`)) return;
    setActionLoading(user.id);
    try {
      await api.patch(`/api/users/${user.id}`, { is_active: true });
      await load();
    } catch (err) {
      alert(err.response?.data?.error ?? 'Failed to reactivate user');
    } finally {
      setActionLoading(null);
    }
  }

  const activeCount   = users.filter((u) => u.is_active).length;
  const inactiveCount = users.filter((u) => !u.is_active).length;
  const adminCount    = users.filter((u) => u.role === 'ADMIN').length;

  return (
    <div style={styles.page}>
      {/* Header */}
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>User Management</h1>
          <p style={styles.sub}>ADMIN only · Manage team accounts and access</p>
        </div>
        <button style={styles.addBtn} onClick={() => { setShowForm(true); setFormError(''); setForm(EMPTY_FORM); }}>
          + Add User
        </button>
      </div>

      {/* Summary cards */}
      <div style={styles.cards}>
        <div style={styles.card}>
          <div style={styles.cardNum}>{users.length}</div>
          <div style={styles.cardLabel}>Total Users</div>
        </div>
        <div style={styles.card}>
          <div style={{ ...styles.cardNum, color: '#166534' }}>{activeCount}</div>
          <div style={styles.cardLabel}>Active</div>
        </div>
        <div style={styles.card}>
          <div style={{ ...styles.cardNum, color: '#6b7280' }}>{inactiveCount}</div>
          <div style={styles.cardLabel}>Inactive</div>
        </div>
        <div style={styles.card}>
          <div style={{ ...styles.cardNum, color: '#991b1b' }}>{adminCount}</div>
          <div style={styles.cardLabel}>Admins</div>
        </div>
      </div>

      {/* Add User modal */}
      {showForm && (
        <div style={styles.modalOverlay}>
          <div style={styles.modal}>
            <h2 style={styles.modalTitle}>Add New User</h2>
            {formError && <div style={styles.formError}>{formError}</div>}
            <form onSubmit={handleAdd} style={styles.form}>
              <div style={styles.row}>
                <label style={styles.label}>Full Name *</label>
                <input
                  style={styles.input}
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Jane Smith"
                  required
                />
              </div>
              <div style={styles.row}>
                <label style={styles.label}>Email *</label>
                <input
                  style={styles.input}
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="jane@envico.co.uk"
                  required
                />
              </div>
              <div style={styles.row}>
                <label style={styles.label}>Password *</label>
                <input
                  style={styles.input}
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  placeholder="Min. 8 characters"
                  required
                  minLength={8}
                />
              </div>
              <div style={styles.row}>
                <label style={styles.label}>Role *</label>
                <select
                  style={styles.input}
                  value={form.role}
                  onChange={(e) => setForm({ ...form, role: e.target.value })}
                >
                  <option value="STAFF">STAFF</option>
                  <option value="MANAGER">MANAGER</option>
                  <option value="ADMIN">ADMIN</option>
                </select>
              </div>
              <div style={styles.row}>
                <label style={styles.label}>Location ID</label>
                <input
                  style={styles.input}
                  type="number"
                  value={form.location_id}
                  onChange={(e) => setForm({ ...form, location_id: e.target.value })}
                  placeholder="Optional"
                  min={1}
                />
              </div>
              <div style={styles.formActions}>
                <button type="button" style={styles.cancelBtn} onClick={() => setShowForm(false)}>
                  Cancel
                </button>
                <button type="submit" style={styles.saveBtn} disabled={saving}>
                  {saving ? 'Creating...' : 'Create User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Table */}
      <div style={styles.tableWrap}>
        {loading && <p style={styles.msg}>Loading users...</p>}
        {error   && <p style={{ ...styles.msg, color: '#dc2626' }}>{error}</p>}
        {!loading && !error && (
          <table style={styles.table}>
            <thead>
              <tr>
                {['Name', 'Email', 'Role', 'Status', 'Last Login', 'Location', 'Actions'].map((h) => (
                  <th key={h} style={styles.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id} style={styles.tr}>
                  <td style={styles.td}>
                    <div style={styles.userName}>{user.name}</div>
                    <div style={styles.userId}>#{user.id}</div>
                  </td>
                  <td style={styles.td}>{user.email}</td>
                  <td style={styles.td}>
                    <Badge label={user.role} colours={ROLE_COLOURS[user.role] ?? {}} />
                  </td>
                  <td style={styles.td}>
                    <Badge
                      label={user.is_active ? 'Active' : 'Inactive'}
                      colours={user.is_active ? STATUS_COLOURS.active : STATUS_COLOURS.inactive}
                    />
                  </td>
                  <td style={styles.td}>{formatDate(user.last_login)}</td>
                  <td style={styles.td}>{user.location_id ?? '—'}</td>
                  <td style={styles.td}>
                    {user.id === currentUser.id ? (
                      <span style={styles.selfLabel}>You</span>
                    ) : user.is_active ? (
                      <button
                        style={styles.deactivateBtn}
                        onClick={() => handleDeactivate(user)}
                        disabled={actionLoading === user.id}
                      >
                        {actionLoading === user.id ? '...' : 'Deactivate'}
                      </button>
                    ) : (
                      <button
                        style={styles.reactivateBtn}
                        onClick={() => handleReactivate(user)}
                        disabled={actionLoading === user.id}
                      >
                        {actionLoading === user.id ? '...' : 'Reactivate'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr>
                  <td colSpan={7} style={{ ...styles.td, textAlign: 'center', color: '#9ca3af' }}>
                    No users found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

const styles = {
  page: { display: 'flex', flexDirection: 'column', gap: '1.5rem' },
  header: {
    display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem',
  },
  title: { margin: 0, fontSize: '1.5rem', fontWeight: 700, color: '#1a1a2e' },
  sub:   { margin: '4px 0 0', fontSize: '0.85rem', color: '#6b7280' },
  addBtn: {
    padding: '0.6rem 1.25rem', background: '#1a1a2e', color: '#fff',
    border: 'none', borderRadius: '8px', fontSize: '0.9rem', fontWeight: 600,
    cursor: 'pointer', whiteSpace: 'nowrap',
  },
  cards: { display: 'flex', gap: '1rem', flexWrap: 'wrap' },
  card: {
    background: '#fff', border: '1px solid #e5e7eb', borderRadius: '10px',
    padding: '1rem 1.5rem', minWidth: '120px', textAlign: 'center',
    boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
  },
  cardNum:   { fontSize: '1.8rem', fontWeight: 800, color: '#1a1a2e', lineHeight: 1 },
  cardLabel: { fontSize: '0.78rem', color: '#6b7280', marginTop: '4px', textTransform: 'uppercase', letterSpacing: '0.5px' },
  tableWrap: {
    background: '#fff', border: '1px solid #e5e7eb', borderRadius: '10px',
    overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
  },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: {
    padding: '0.75rem 1rem', background: '#f9fafb', textAlign: 'left',
    fontSize: '0.78rem', fontWeight: 600, color: '#6b7280',
    textTransform: 'uppercase', letterSpacing: '0.5px',
    borderBottom: '1px solid #e5e7eb',
  },
  tr: { borderBottom: '1px solid #f3f4f6' },
  td: { padding: '0.85rem 1rem', fontSize: '0.88rem', color: '#374151', verticalAlign: 'middle' },
  userName: { fontWeight: 600, color: '#1a1a2e' },
  userId:   { fontSize: '0.75rem', color: '#9ca3af', marginTop: '1px' },
  badge: {
    display: 'inline-block', padding: '3px 10px', borderRadius: '20px',
    fontSize: '0.75rem', fontWeight: 600, letterSpacing: '0.3px',
  },
  deactivateBtn: {
    padding: '4px 12px', background: 'transparent', border: '1px solid #fca5a5',
    color: '#dc2626', borderRadius: '6px', fontSize: '0.8rem', cursor: 'pointer', fontWeight: 500,
  },
  reactivateBtn: {
    padding: '4px 12px', background: 'transparent', border: '1px solid #86efac',
    color: '#16a34a', borderRadius: '6px', fontSize: '0.8rem', cursor: 'pointer', fontWeight: 500,
  },
  selfLabel: { fontSize: '0.8rem', color: '#9ca3af', fontStyle: 'italic' },
  msg: { padding: '2rem', textAlign: 'center', color: '#6b7280' },
  // Modal
  modalOverlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
  },
  modal: {
    background: '#fff', borderRadius: '12px', padding: '2rem',
    width: '100%', maxWidth: '480px', boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
  },
  modalTitle: { margin: '0 0 1.25rem', fontSize: '1.2rem', fontWeight: 700, color: '#1a1a2e' },
  form: { display: 'flex', flexDirection: 'column', gap: '1rem' },
  row:  { display: 'flex', flexDirection: 'column', gap: '4px' },
  label: { fontSize: '0.82rem', fontWeight: 600, color: '#374151' },
  input: {
    padding: '0.55rem 0.8rem', border: '1px solid #d1d5db', borderRadius: '6px',
    fontSize: '0.9rem', outline: 'none', background: '#f9fafb',
  },
  formError: {
    background: '#fee2e2', color: '#991b1b', padding: '0.6rem 0.8rem',
    borderRadius: '6px', fontSize: '0.85rem', marginBottom: '0.5rem',
  },
  formActions: { display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' },
  cancelBtn: {
    padding: '0.55rem 1.25rem', background: 'transparent', border: '1px solid #d1d5db',
    borderRadius: '6px', fontSize: '0.9rem', cursor: 'pointer', color: '#374151',
  },
  saveBtn: {
    padding: '0.55rem 1.25rem', background: '#1a1a2e', color: '#fff',
    border: 'none', borderRadius: '6px', fontSize: '0.9rem', fontWeight: 600, cursor: 'pointer',
  },
};
