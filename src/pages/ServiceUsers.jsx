import { useEffect, useState } from 'react';
import api from '../services/api';

const STATUS_COLORS = {
  ACTIVE: '#16a34a',
  INACTIVE: '#6b7280',
  SUSPENDED: '#dc2626',
};

export default function ServiceUsers() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState(null);
  const [showCreate, setShowCreate] = useState(false);

  useEffect(() => {
    fetchUsers();
  }, []);

  async function fetchUsers() {
    try {
      const res = await api.get('/api/service-users');
      setUsers(res.data.serviceUsers ?? res.data ?? []);
    } catch (err) {
      setError(err.response?.data?.message ?? 'Failed to load service users');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <div style={styles.pageHeader}>
        <div>
          <h1 style={styles.title}>Service Users</h1>
          <p style={styles.subtitle}>{users.length} registered</p>
        </div>
        <button style={styles.createBtn} onClick={() => setShowCreate(true)}>
          + New Service User
        </button>
      </div>

      {loading && <p style={styles.state}>Loading...</p>}
      {error && <p style={{ ...styles.state, color: '#dc2626' }}>{error}</p>}

      {!loading && !error && (
        <div style={styles.tableWrap}>
          <table style={styles.table}>
            <thead>
              <tr>
                {['Name', 'Care Type', 'Date of Birth', 'Status'].map((h) => (
                  <th key={h} style={styles.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {users.length === 0 && (
                <tr>
                  <td colSpan={4} style={styles.empty}>No service users found.</td>
                </tr>
              )}
              {users.map((u) => (
                <tr
                  key={u.id}
                  style={styles.row}
                  onClick={() => setSelected(u)}
                >
                  <td style={styles.td}>
                    <span style={styles.name}>{u.name ?? u.full_name ?? '—'}</span>
                  </td>
                  <td style={styles.td}>{u.care_type ?? '—'}</td>
                  <td style={styles.td}>{u.dob ? new Date(u.dob).toLocaleDateString('en-GB') : '—'}</td>
                  <td style={styles.td}>
                    <span style={{
                      ...styles.badge,
                      background: `${STATUS_COLORS[u.status] ?? '#6b7280'}22`,
                      color: STATUS_COLORS[u.status] ?? '#6b7280',
                    }}>
                      {u.status ?? 'UNKNOWN'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selected && <UserDetailModal user={selected} onClose={() => setSelected(null)} />}
      {showCreate && <CreateUserModal onClose={() => setShowCreate(false)} onCreated={() => { setShowCreate(false); fetchUsers(); }} />}
    </div>
  );
}

function UserDetailModal({ user, onClose }) {
  return (
    <div style={modalStyles.overlay} onClick={onClose}>
      <div style={modalStyles.box} onClick={(e) => e.stopPropagation()}>
        <div style={modalStyles.header}>
          <h2 style={modalStyles.title}>{user.name ?? user.full_name}</h2>
          <button style={modalStyles.close} onClick={onClose}>×</button>
        </div>
        <div style={modalStyles.body}>
          <Row label="ID" value={user.id} />
          <Row label="Care Type" value={user.care_type} />
          <Row label="Date of Birth" value={user.dob ? new Date(user.dob).toLocaleDateString('en-GB') : '—'} />
          <Row label="Status" value={user.status} />
          <Row label="Address" value={user.address} />
          <Row label="Phone" value={user.phone} />
          <Row label="Emergency Contact" value={user.emergency_contact} />
          <Row label="NHS Number" value={user.nhs_number} />
          <Row label="Created" value={user.created_at ? new Date(user.created_at).toLocaleString('en-GB') : '—'} />
        </div>
      </div>
    </div>
  );
}

function CreateUserModal({ onClose, onCreated }) {
  const [form, setForm] = useState({ name: '', care_type: '', dob: '', status: 'ACTIVE' });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  function set(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function submit(e) {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      await api.post('/api/service-users', form);
      onCreated();
    } catch (err) {
      setError(err.response?.data?.message ?? 'Failed to create service user');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={modalStyles.overlay} onClick={onClose}>
      <div style={modalStyles.box} onClick={(e) => e.stopPropagation()}>
        <div style={modalStyles.header}>
          <h2 style={modalStyles.title}>New Service User</h2>
          <button style={modalStyles.close} onClick={onClose}>×</button>
        </div>
        <form onSubmit={submit} style={modalStyles.body}>
          {error && <p style={{ color: '#dc2626', marginBottom: '1rem' }}>{error}</p>}
          <Field label="Full Name" required>
            <input style={formStyles.input} value={form.name} onChange={(e) => set('name', e.target.value)} required />
          </Field>
          <Field label="Care Type">
            <input style={formStyles.input} value={form.care_type} onChange={(e) => set('care_type', e.target.value)} placeholder="e.g. Residential, Domiciliary" />
          </Field>
          <Field label="Date of Birth">
            <input style={formStyles.input} type="date" value={form.dob} onChange={(e) => set('dob', e.target.value)} />
          </Field>
          <Field label="Status">
            <select style={formStyles.input} value={form.status} onChange={(e) => set('status', e.target.value)}>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
              <option value="SUSPENDED">Suspended</option>
            </select>
          </Field>
          <button style={formStyles.submit} type="submit" disabled={submitting}>
            {submitting ? 'Creating...' : 'Create Service User'}
          </button>
        </form>
      </div>
    </div>
  );
}

function Row({ label, value }) {
  if (!value) return null;
  return (
    <div style={{ display: 'flex', gap: '1rem', marginBottom: '0.5rem', fontSize: '0.9rem' }}>
      <span style={{ color: '#6b7280', minWidth: '150px', fontWeight: 500 }}>{label}</span>
      <span style={{ color: '#1f2937' }}>{value}</span>
    </div>
  );
}

function Field({ label, children, required }) {
  return (
    <div style={{ marginBottom: '1rem' }}>
      <label style={formStyles.label}>{label}{required && ' *'}</label>
      {children}
    </div>
  );
}

const styles = {
  pageHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' },
  title: { margin: '0 0 0.25rem', fontSize: '1.4rem', fontWeight: 700, color: '#1a1a2e' },
  subtitle: { margin: 0, fontSize: '0.85rem', color: '#6b7280' },
  createBtn: { background: '#1a1a2e', color: '#fff', border: 'none', borderRadius: '6px', padding: '0.6rem 1.1rem', cursor: 'pointer', fontSize: '0.9rem', fontWeight: 600 },
  state: { color: '#6b7280', fontSize: '0.95rem' },
  tableWrap: { background: '#fff', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.07)', overflow: 'hidden' },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: { padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px', background: '#f9fafb', borderBottom: '1px solid #e5e7eb' },
  row: { cursor: 'pointer', transition: 'background 0.1s' },
  td: { padding: '0.85rem 1rem', fontSize: '0.9rem', color: '#374151', borderBottom: '1px solid #f3f4f6' },
  name: { fontWeight: 600, color: '#1a1a2e' },
  badge: { display: 'inline-block', padding: '2px 10px', borderRadius: '12px', fontSize: '0.78rem', fontWeight: 600 },
  empty: { padding: '2rem', textAlign: 'center', color: '#9ca3af', fontSize: '0.9rem' },
};

const modalStyles = {
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
  box: { background: '#fff', borderRadius: '10px', width: '480px', maxWidth: '95vw', maxHeight: '85vh', overflowY: 'auto', boxShadow: '0 8px 32px rgba(0,0,0,0.18)' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.25rem 1.5rem', borderBottom: '1px solid #e5e7eb' },
  title: { margin: 0, fontSize: '1.1rem', fontWeight: 700, color: '#1a1a2e' },
  close: { background: 'transparent', border: 'none', fontSize: '1.4rem', cursor: 'pointer', color: '#9ca3af', lineHeight: 1 },
  body: { padding: '1.5rem' },
};

const formStyles = {
  label: { display: 'block', fontSize: '0.83rem', fontWeight: 600, color: '#374151', marginBottom: '0.35rem' },
  input: { width: '100%', padding: '0.55rem 0.75rem', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '0.9rem', boxSizing: 'border-box', outline: 'none' },
  submit: { width: '100%', padding: '0.7rem', background: '#1a1a2e', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '0.95rem', fontWeight: 600, cursor: 'pointer', marginTop: '0.5rem' },
};
