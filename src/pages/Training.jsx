import { useEffect, useState } from 'react';
import api from '../services/api';

const STATUS_COLORS = {
  COMPLETED: '#16a34a',
  DUE: '#2563eb',
  OVERDUE: '#dc2626',
  EXPIRED: '#dc2626',
};

const OLIVER_KEYWORDS = ['oliver', 'mcgowan', 'oliver mcgowan'];

function isOliver(name) {
  return OLIVER_KEYWORDS.some((k) => name?.toLowerCase().includes(k));
}

function daysUntil(date) {
  if (!date) return null;
  return Math.ceil((new Date(date) - new Date()) / 86400000);
}

export default function Training() {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [selected, setSelected] = useState(null);
  const [showAdd, setShowAdd] = useState(false);

  useEffect(() => { fetchTraining(); }, []);

  async function fetchTraining() {
    try {
      const res = await api.get('/api/training');
      setRecords(res.data.training ?? []);
    } catch (err) {
      setError(err.response?.data?.message ?? 'Failed to load training records');
    } finally {
      setLoading(false);
    }
  }

  const overdue = records.filter((r) => r.status === 'OVERDUE' || r.status === 'EXPIRED');
  const filtered = filterStatus === 'ALL' ? records : records.filter((r) => r.status === filterStatus);

  return (
    <div>
      <div style={styles.pageHeader}>
        <div>
          <h1 style={styles.title}>Training</h1>
          <p style={styles.subtitle}>{records.length} records</p>
        </div>
        <button style={styles.createBtn} onClick={() => setShowAdd(true)}>+ Add Training</button>
      </div>

      {overdue.length > 0 && (
        <div style={styles.alertBanner}>
          <strong>⚠️ {overdue.length} overdue or expired training record{overdue.length > 1 ? 's' : ''}</strong>
          {' — '}
          {overdue.slice(0, 3).map((r) => `${r.staff?.name ?? 'Staff'}: ${r.training_name}`).join(' · ')}
          {overdue.length > 3 && ` · +${overdue.length - 3} more`}
        </div>
      )}

      <div style={styles.filterBar}>
        {['ALL', 'COMPLETED', 'DUE', 'OVERDUE', 'EXPIRED'].map((s) => (
          <button
            key={s}
            style={{ ...styles.filterBtn, ...(filterStatus === s ? styles.filterBtnActive : {}) }}
            onClick={() => setFilterStatus(s)}
          >
            {s === 'ALL' ? 'All' : s}
          </button>
        ))}
      </div>

      {loading && <p style={styles.state}>Loading...</p>}
      {error && <p style={{ ...styles.state, color: '#dc2626' }}>{error}</p>}

      {!loading && !error && (
        <div style={styles.tableWrap}>
          <table style={styles.table}>
            <thead>
              <tr>
                {['Staff', 'Training', 'Type', 'Status', 'Completed', 'Expiry'].map((h) => (
                  <th key={h} style={styles.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={6} style={styles.empty}>No training records found.</td></tr>
              )}
              {filtered.map((r) => {
                const oliver = isOliver(r.training_name);
                const days = daysUntil(r.expiry_date);
                const expiryWarning = days !== null && days >= 0 && days <= 30;
                return (
                  <tr
                    key={r.id}
                    style={{ ...styles.row, ...(oliver ? styles.oliverRow : {}) }}
                    onClick={() => setSelected(r)}
                  >
                    <td style={styles.td}>
                      <span style={styles.name}>{r.staff?.name ?? `Staff #${r.staff_id}`}</span>
                      <span style={styles.role}>{r.staff?.role}</span>
                    </td>
                    <td style={styles.td}>
                      <span style={styles.trainingName}>{r.training_name}</span>
                      {oliver && <span style={styles.oliverBadge}>Oliver McGowan</span>}
                    </td>
                    <td style={styles.td}><span style={styles.typePill}>{r.training_type}</span></td>
                    <td style={styles.td}><Badge value={r.status} colors={STATUS_COLORS} /></td>
                    <td style={styles.td}>
                      {r.completed_date ? new Date(r.completed_date).toLocaleDateString('en-GB') : <span style={{ color: '#9ca3af' }}>—</span>}
                    </td>
                    <td style={styles.td}>
                      {r.expiry_date
                        ? <span style={{ color: expiryWarning ? '#ea580c' : (r.status === 'EXPIRED' ? '#dc2626' : '#374151'), fontWeight: expiryWarning ? 600 : 400 }}>
                            {new Date(r.expiry_date).toLocaleDateString('en-GB')}
                            {expiryWarning && ` (${days}d)`}
                            {days !== null && days < 0 && ' ⚠️'}
                          </span>
                        : <span style={{ color: '#9ca3af' }}>—</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {selected && <TrainingDetailModal record={selected} onClose={() => setSelected(null)} onUpdated={fetchTraining} />}
      {showAdd && <AddTrainingModal onClose={() => setShowAdd(false)} onCreated={() => { setShowAdd(false); fetchTraining(); }} />}
    </div>
  );
}

function TrainingDetailModal({ record, onClose, onUpdated }) {
  const [updating, setUpdating] = useState(false);

  async function markCompleted() {
    setUpdating(true);
    try {
      await api.patch(`/api/training/${record.id}`, {
        status: 'COMPLETED',
        completed_date: new Date().toISOString().split('T')[0],
      });
      onUpdated(); onClose();
    } catch { /* silent */ } finally { setUpdating(false); }
  }

  return (
    <div style={modalStyles.overlay} onClick={onClose}>
      <div style={modalStyles.box} onClick={(e) => e.stopPropagation()}>
        <div style={modalStyles.header}>
          <div>
            <h2 style={modalStyles.title}>{record.training_name}</h2>
            {isOliver(record.training_name) && <span style={styles.oliverBadge}>Oliver McGowan Mandatory</span>}
          </div>
          <button style={modalStyles.close} onClick={onClose}>×</button>
        </div>
        <div style={modalStyles.body}>
          <Row label="Staff" value={record.staff?.name} />
          <Row label="Role" value={record.staff?.role} />
          <Row label="Type" value={record.training_type} />
          <Row label="Provider" value={record.provider} />
          <Row label="Status" value={record.status} />
          <Row label="Completed" value={record.completed_date ? new Date(record.completed_date).toLocaleDateString('en-GB') : null} />
          <Row label="Expiry" value={record.expiry_date ? new Date(record.expiry_date).toLocaleDateString('en-GB') : null} />
          <Row label="Notes" value={record.notes} />
          {record.certificate_url && (
            <div style={{ marginTop: '0.75rem' }}>
              <a href={record.certificate_url} target="_blank" rel="noreferrer" style={{ color: '#2563eb', fontSize: '0.9rem' }}>View Certificate →</a>
            </div>
          )}
          {(record.status === 'DUE' || record.status === 'OVERDUE') && (
            <button style={{ ...actionBtn, background: '#16a34a', marginTop: '1.25rem' }} onClick={markCompleted} disabled={updating}>
              Mark as Completed
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function AddTrainingModal({ onClose, onCreated }) {
  const [staffList, setStaffList] = useState([]);
  const [form, setForm] = useState({
    staff_id: '', training_name: '', training_type: '',
    provider: '', completed_date: '', expiry_date: '',
    status: 'COMPLETED', notes: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/api/staff').then((res) => setStaffList(res.data.staff ?? res.data ?? [])).catch(() => {});
  }, []);

  function set(f, v) { setForm((p) => ({ ...p, [f]: v })); }

  async function submit(e) {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      await api.post('/api/training', {
        staff_id: parseInt(form.staff_id, 10),
        training_name: form.training_name,
        training_type: form.training_type,
        provider: form.provider || undefined,
        completed_date: form.completed_date || undefined,
        expiry_date: form.expiry_date || undefined,
        status: form.status,
        notes: form.notes || undefined,
      });
      onCreated();
    } catch (err) {
      setError(err.response?.data?.message ?? 'Failed to add training record');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={modalStyles.overlay} onClick={onClose}>
      <div style={modalStyles.box} onClick={(e) => e.stopPropagation()}>
        <div style={modalStyles.header}>
          <h2 style={modalStyles.title}>Add Training Record</h2>
          <button style={modalStyles.close} onClick={onClose}>×</button>
        </div>
        <form onSubmit={submit} style={modalStyles.body}>
          {error && <p style={{ color: '#dc2626', marginBottom: '1rem', fontSize: '0.9rem' }}>{error}</p>}
          <Field label="Staff Member" required>
            <select style={formStyles.input} value={form.staff_id} onChange={(e) => set('staff_id', e.target.value)} required>
              <option value="">Select staff member...</option>
              {staffList.map((s) => <option key={s.id} value={s.id}>{s.name} — {s.role}</option>)}
            </select>
          </Field>
          <Field label="Training Name" required>
            <input style={formStyles.input} value={form.training_name} onChange={(e) => set('training_name', e.target.value)} placeholder="e.g. Oliver McGowan, Fire Safety..." required />
          </Field>
          <div style={formStyles.row}>
            <Field label="Training Type" required>
              <input style={formStyles.input} value={form.training_type} onChange={(e) => set('training_type', e.target.value)} placeholder="e.g. Mandatory, CPD" required />
            </Field>
            <Field label="Provider">
              <input style={formStyles.input} value={form.provider} onChange={(e) => set('provider', e.target.value)} />
            </Field>
          </div>
          <div style={formStyles.row}>
            <Field label="Completed Date">
              <input style={formStyles.input} type="date" value={form.completed_date} onChange={(e) => set('completed_date', e.target.value)} />
            </Field>
            <Field label="Expiry Date">
              <input style={formStyles.input} type="date" value={form.expiry_date} onChange={(e) => set('expiry_date', e.target.value)} />
            </Field>
          </div>
          <Field label="Status">
            <select style={formStyles.input} value={form.status} onChange={(e) => set('status', e.target.value)}>
              <option value="COMPLETED">Completed</option>
              <option value="DUE">Due</option>
              <option value="OVERDUE">Overdue</option>
              <option value="EXPIRED">Expired</option>
            </select>
          </Field>
          <button style={formStyles.submit} type="submit" disabled={submitting}>
            {submitting ? 'Adding...' : 'Add Training Record'}
          </button>
        </form>
      </div>
    </div>
  );
}

function Badge({ value, colors }) {
  if (!value) return <span style={{ color: '#9ca3af' }}>—</span>;
  const color = colors[value] ?? '#6b7280';
  return <span style={{ display: 'inline-block', padding: '2px 10px', borderRadius: '12px', fontSize: '0.78rem', fontWeight: 600, background: `${color}22`, color }}>{value}</span>;
}

function Row({ label, value }) {
  if (!value) return null;
  return (
    <div style={{ display: 'flex', gap: '1rem', marginBottom: '0.5rem', fontSize: '0.9rem' }}>
      <span style={{ color: '#6b7280', minWidth: '130px', fontWeight: 500 }}>{label}</span>
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

const actionBtn = { padding: '0.5rem 1.1rem', border: 'none', borderRadius: '6px', color: '#fff', cursor: 'pointer', fontSize: '0.88rem', fontWeight: 600, display: 'inline-block' };

const styles = {
  pageHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem' },
  title: { margin: '0 0 0.25rem', fontSize: '1.4rem', fontWeight: 700, color: '#1a1a2e' },
  subtitle: { margin: 0, fontSize: '0.85rem', color: '#6b7280' },
  createBtn: { background: '#1a1a2e', color: '#fff', border: 'none', borderRadius: '6px', padding: '0.6rem 1.1rem', cursor: 'pointer', fontSize: '0.9rem', fontWeight: 600 },
  alertBanner: { background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', padding: '0.75rem 1rem', marginBottom: '1.25rem', fontSize: '0.9rem', color: '#dc2626' },
  filterBar: { display: 'flex', gap: '0.5rem', marginBottom: '1.25rem', flexWrap: 'wrap' },
  filterBtn: { padding: '5px 14px', borderRadius: '20px', border: '1px solid #d1d5db', background: '#f9fafb', color: '#374151', fontSize: '0.85rem', cursor: 'pointer', fontWeight: 500 },
  filterBtnActive: { background: '#1a1a2e', color: '#fff', border: '1px solid #1a1a2e' },
  state: { color: '#6b7280', fontSize: '0.95rem' },
  tableWrap: { background: '#fff', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.07)', overflow: 'hidden' },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: { padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px', background: '#f9fafb', borderBottom: '1px solid #e5e7eb' },
  row: { cursor: 'pointer' },
  oliverRow: { background: '#fefce8' },
  td: { padding: '0.75rem 1rem', fontSize: '0.9rem', color: '#374151', borderBottom: '1px solid #f3f4f6' },
  name: { display: 'block', fontWeight: 600, color: '#1a1a2e' },
  role: { display: 'block', fontSize: '0.78rem', color: '#9ca3af' },
  trainingName: { fontWeight: 500 },
  oliverBadge: { display: 'inline-block', marginLeft: '0.5rem', padding: '1px 8px', borderRadius: '10px', fontSize: '0.72rem', fontWeight: 600, background: '#fef08a', color: '#854d0e', border: '1px solid #fde047' },
  typePill: { fontSize: '0.78rem', background: '#f3f4f6', color: '#6b7280', padding: '2px 8px', borderRadius: '4px' },
  empty: { padding: '2rem', textAlign: 'center', color: '#9ca3af', fontSize: '0.9rem' },
};

const modalStyles = {
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
  box: { background: '#fff', borderRadius: '10px', width: '520px', maxWidth: '95vw', maxHeight: '85vh', overflowY: 'auto', boxShadow: '0 8px 32px rgba(0,0,0,0.18)' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '1.25rem 1.5rem', borderBottom: '1px solid #e5e7eb' },
  title: { margin: '0 0 0.25rem', fontSize: '1.1rem', fontWeight: 700, color: '#1a1a2e' },
  close: { background: 'transparent', border: 'none', fontSize: '1.4rem', cursor: 'pointer', color: '#9ca3af', lineHeight: 1 },
  body: { padding: '1.5rem' },
};

const formStyles = {
  row: { display: 'flex', gap: '1rem' },
  label: { display: 'block', fontSize: '0.83rem', fontWeight: 600, color: '#374151', marginBottom: '0.35rem' },
  input: { width: '100%', padding: '0.55rem 0.75rem', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '0.9rem', boxSizing: 'border-box' },
  submit: { width: '100%', padding: '0.7rem', background: '#1a1a2e', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '0.95rem', fontWeight: 600, cursor: 'pointer', marginTop: '0.5rem' },
};
