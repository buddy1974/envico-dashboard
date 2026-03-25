import { useEffect, useState } from 'react';
import api from '../services/api';
import OCRDocumentScanner from '../components/OCRDocumentScanner';
import AddressAutocomplete from '../components/AddressAutocomplete';

const STATUS_COLORS = {
  ACTIVE: '#16a34a',
  INACTIVE: '#6b7280',
  DISCHARGED: '#dc2626',
};

const CARE_TYPE_LABELS = {
  SUPPORTED_LIVING: 'Supported Living',
  DOMICILIARY: 'Domiciliary',
  RESIDENTIAL: 'Residential',
};

export default function ServiceUsers() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState(null);
  const [showCreate, setShowCreate] = useState(false);

  useEffect(() => { fetchUsers(); }, []);

  async function fetchUsers() {
    try {
      const res = await api.get('/api/service-users');
      setUsers(res.data.service_users ?? []);
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
        <button style={styles.createBtn} onClick={() => setShowCreate(true)}>+ New Service User</button>
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
                <tr><td colSpan={4} style={styles.empty}>No service users found.</td></tr>
              )}
              {users.map((u) => (
                <tr key={u.id} style={styles.row} onClick={() => setSelected(u)}>
                  <td style={styles.td}>
                    <span style={styles.name}>{u.first_name} {u.last_name}</span>
                  </td>
                  <td style={styles.td}>{CARE_TYPE_LABELS[u.care_type] ?? u.care_type ?? '—'}</td>
                  <td style={styles.td}>{u.dob ? new Date(u.dob).toLocaleDateString('en-GB') : '—'}</td>
                  <td style={styles.td}>
                    <Badge value={u.status} colors={STATUS_COLORS} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selected && <UserDetailModal user={selected} onClose={() => setSelected(null)} />}
      {showCreate && (
        <CreateUserModal
          onClose={() => setShowCreate(false)}
          onCreated={() => { setShowCreate(false); fetchUsers(); }}
        />
      )}
    </div>
  );
}

function UserDetailModal({ user, onClose }) {
  return (
    <div style={modalStyles.overlay} onClick={onClose}>
      <div style={modalStyles.box} onClick={(e) => e.stopPropagation()}>
        <div style={modalStyles.header}>
          <h2 style={modalStyles.title}>{user.first_name} {user.last_name}</h2>
          <button style={modalStyles.close} onClick={onClose}>×</button>
        </div>
        <div style={modalStyles.body}>
          <Row label="ID" value={String(user.id)} />
          <Row label="Care Type" value={CARE_TYPE_LABELS[user.care_type] ?? user.care_type} />
          <Row label="Date of Birth" value={user.dob ? new Date(user.dob).toLocaleDateString('en-GB') : null} />
          <Row label="Status" value={user.status} />
          <Row label="NHS Number" value={user.nhs_number} />
          <Row label="Phone" value={user.phone} />
          <Row label="Address" value={[user.address_line1, user.city, user.postcode].filter(Boolean).join(', ')} />
          <Row label="GP" value={user.gp_name} />
          <Row label="Next of Kin" value={user.nok_name} />
          <Row label="NOK Phone" value={user.nok_phone} />
          <Row label="Referral ID" value={user.referral_id} />
          <Row label="Created" value={user.created_at ? new Date(user.created_at).toLocaleString('en-GB') : null} />
        </div>
      </div>
    </div>
  );
}

function CreateUserModal({ onClose, onCreated }) {
  const [form, setForm] = useState({
    first_name: '', last_name: '', dob: '',
    care_type: 'SUPPORTED_LIVING', status: 'ACTIVE',
    phone: '', nhs_number: '',
    address_line1: '', postcode: '', city: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  function set(field, value) { setForm((p) => ({ ...p, [field]: value })); }

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
          {error && <p style={{ color: '#dc2626', marginBottom: '1rem', fontSize: '0.9rem' }}>{error}</p>}
          <OCRDocumentScanner
            context="referral"
            label="Scan referral form or letter"
            onImport={(data) => {
              if (data.full_name) {
                const parts = data.full_name.trim().split(' ');
                set('first_name', parts[0] ?? '');
                set('last_name', parts.slice(1).join(' ') || '');
              }
              if (data.date_of_birth) set('dob', data.date_of_birth);
              if (data.phone) set('phone', data.phone);
              if (data.address) set('address_line1', data.address);
            }}
          />
          <div style={formStyles.row}>
            <Field label="First Name" required>
              <input style={formStyles.input} value={form.first_name} onChange={(e) => set('first_name', e.target.value)} required />
            </Field>
            <Field label="Last Name" required>
              <input style={formStyles.input} value={form.last_name} onChange={(e) => set('last_name', e.target.value)} required />
            </Field>
          </div>
          <Field label="Date of Birth" required>
            <input style={formStyles.input} type="date" value={form.dob} onChange={(e) => set('dob', e.target.value)} required />
          </Field>
          <Field label="Care Type">
            <select style={formStyles.input} value={form.care_type} onChange={(e) => set('care_type', e.target.value)}>
              <option value="SUPPORTED_LIVING">Supported Living</option>
              <option value="DOMICILIARY">Domiciliary</option>
              <option value="RESIDENTIAL">Residential</option>
            </select>
          </Field>
          <div style={formStyles.row}>
            <Field label="Phone">
              <input style={formStyles.input} value={form.phone} onChange={(e) => set('phone', e.target.value)} />
            </Field>
            <Field label="NHS Number">
              <input style={formStyles.input} value={form.nhs_number} onChange={(e) => set('nhs_number', e.target.value)} />
            </Field>
          </div>
          <AddressAutocomplete
            label="Address"
            placeholder="Start typing address..."
            value={form.address_line1}
            onChange={(val) => set('address_line1', val)}
            onSelect={(r) => {
              set('address_line1', r.street);
              set('postcode', r.postcode ?? '');
              set('city', r.city ?? '');
            }}
          />
          <div style={formStyles.row}>
            <Field label="City">
              <input style={formStyles.input} value={form.city} onChange={(e) => set('city', e.target.value)} />
            </Field>
            <Field label="Postcode">
              <input style={formStyles.input} value={form.postcode} onChange={(e) => set('postcode', e.target.value)} />
            </Field>
          </div>
          <button style={formStyles.submit} type="submit" disabled={submitting}>
            {submitting ? 'Creating...' : 'Create Service User'}
          </button>
        </form>
      </div>
    </div>
  );
}

function Badge({ value, colors }) {
  if (!value) return <span style={{ color: '#9ca3af' }}>—</span>;
  const color = colors[value] ?? '#6b7280';
  return (
    <span style={{ display: 'inline-block', padding: '2px 10px', borderRadius: '12px', fontSize: '0.78rem', fontWeight: 600, background: `${color}22`, color }}>
      {value}
    </span>
  );
}

function Row({ label, value }) {
  if (!value) return null;
  return (
    <div style={{ display: 'flex', gap: '1rem', marginBottom: '0.5rem', fontSize: '0.9rem' }}>
      <span style={{ color: '#6b7280', minWidth: '140px', fontWeight: 500 }}>{label}</span>
      <span style={{ color: '#1f2937' }}>{value}</span>
    </div>
  );
}

function Field({ label, children, required }) {
  return (
    <div style={{ marginBottom: '1rem', flex: 1 }}>
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
  row: { cursor: 'pointer' },
  td: { padding: '0.85rem 1rem', fontSize: '0.9rem', color: '#374151', borderBottom: '1px solid #f3f4f6' },
  name: { fontWeight: 600, color: '#1a1a2e' },
  empty: { padding: '2rem', textAlign: 'center', color: '#9ca3af', fontSize: '0.9rem' },
};

const modalStyles = {
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
  box: { background: '#fff', borderRadius: '10px', width: '500px', maxWidth: '95vw', maxHeight: '85vh', overflowY: 'auto', boxShadow: '0 8px 32px rgba(0,0,0,0.18)' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.25rem 1.5rem', borderBottom: '1px solid #e5e7eb' },
  title: { margin: 0, fontSize: '1.1rem', fontWeight: 700, color: '#1a1a2e' },
  close: { background: 'transparent', border: 'none', fontSize: '1.4rem', cursor: 'pointer', color: '#9ca3af', lineHeight: 1 },
  body: { padding: '1.5rem' },
};

const formStyles = {
  row: { display: 'flex', gap: '1rem' },
  label: { display: 'block', fontSize: '0.83rem', fontWeight: 600, color: '#374151', marginBottom: '0.35rem' },
  input: { width: '100%', padding: '0.55rem 0.75rem', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '0.9rem', boxSizing: 'border-box' },
  submit: { width: '100%', padding: '0.7rem', background: '#1a1a2e', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '0.95rem', fontWeight: 600, cursor: 'pointer', marginTop: '0.5rem' },
};
