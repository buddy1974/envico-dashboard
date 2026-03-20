import { useEffect, useState } from 'react';
import api from '../services/api';

const STATUS_COLORS = {
  ACTIVE: '#16a34a',
  SUSPENDED: '#ea580c',
  DISCONTINUED: '#9ca3af',
};

export default function Medications() {
  const [medications, setMedications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState(null);
  const [showAdd, setShowAdd] = useState(false);
  const [filterStatus, setFilterStatus] = useState('ALL');

  useEffect(() => { fetchMedications(); }, []);

  async function fetchMedications() {
    try {
      const res = await api.get('/api/medications');
      setMedications(res.data.medications ?? []);
    } catch (err) {
      setError(err.response?.data?.message ?? 'Failed to load medications');
    } finally {
      setLoading(false);
    }
  }

  const filtered = filterStatus === 'ALL'
    ? medications
    : medications.filter((m) => m.status === filterStatus);

  return (
    <div>
      <div style={styles.pageHeader}>
        <div>
          <h1 style={styles.title}>Medications</h1>
          <p style={styles.subtitle}>{medications.length} total</p>
        </div>
        <button style={styles.createBtn} onClick={() => setShowAdd(true)}>+ Add Medication</button>
      </div>

      <div style={styles.filterBar}>
        {['ALL', 'ACTIVE', 'SUSPENDED', 'DISCONTINUED'].map((s) => (
          <button
            key={s}
            style={{ ...styles.filterBtn, ...(filterStatus === s ? styles.filterBtnActive : {}) }}
            onClick={() => setFilterStatus(s)}
          >
            {s === 'ALL' ? 'All' : s.charAt(0) + s.slice(1).toLowerCase()}
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
                {['Service User', 'Medication', 'Dosage', 'Frequency', 'Route', 'Status'].map((h) => (
                  <th key={h} style={styles.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={6} style={styles.empty}>No medications found.</td></tr>
              )}
              {filtered.map((m) => (
                <tr key={m.id} style={styles.row} onClick={() => setSelected(m)}>
                  <td style={styles.td}>
                    <span style={styles.name}>
                      {m.service_user
                        ? `${m.service_user.first_name} ${m.service_user.last_name}`
                        : `User #${m.service_user_id}`}
                    </span>
                  </td>
                  <td style={styles.td}><strong>{m.name}</strong></td>
                  <td style={styles.td}>{m.dosage}</td>
                  <td style={styles.td}>{m.frequency}</td>
                  <td style={styles.td}>{m.route}</td>
                  <td style={styles.td}><Badge value={m.status} colors={STATUS_COLORS} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selected && <MedicationDetailModal med={selected} onClose={() => setSelected(null)} onUpdated={fetchMedications} />}
      {showAdd && (
        <AddMedicationModal
          onClose={() => setShowAdd(false)}
          onCreated={() => { setShowAdd(false); fetchMedications(); }}
        />
      )}
    </div>
  );
}

function MedicationDetailModal({ med, onClose, onUpdated }) {
  const [updating, setUpdating] = useState(false);
  const suName = med.service_user
    ? `${med.service_user.first_name} ${med.service_user.last_name}`
    : `User #${med.service_user_id}`;

  async function updateStatus(status) {
    setUpdating(true);
    try {
      await api.patch(`/api/medications/${med.id}`, { status });
      onUpdated();
      onClose();
    } catch {
      /* silent — user stays on modal */
    } finally {
      setUpdating(false);
    }
  }

  return (
    <div style={modalStyles.overlay} onClick={onClose}>
      <div style={modalStyles.box} onClick={(e) => e.stopPropagation()}>
        <div style={modalStyles.header}>
          <h2 style={modalStyles.title}>{med.name}</h2>
          <button style={modalStyles.close} onClick={onClose}>×</button>
        </div>
        <div style={modalStyles.body}>
          <Row label="Service User" value={suName} />
          <Row label="Dosage" value={med.dosage} />
          <Row label="Frequency" value={med.frequency} />
          <Row label="Route" value={med.route} />
          <Row label="Prescribed By" value={med.prescribed_by} />
          <Row label="Start Date" value={med.start_date ? new Date(med.start_date).toLocaleDateString('en-GB') : null} />
          <Row label="End Date" value={med.end_date ? new Date(med.end_date).toLocaleDateString('en-GB') : null} />
          <Row label="Status" value={med.status} />
          <Row label="Notes" value={med.notes} />

          {med.status === 'ACTIVE' && (
            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.25rem' }}>
              <button
                style={{ ...actionBtn, background: '#ea580c' }}
                onClick={() => updateStatus('SUSPENDED')}
                disabled={updating}
              >
                Suspend
              </button>
              <button
                style={{ ...actionBtn, background: '#6b7280' }}
                onClick={() => updateStatus('DISCONTINUED')}
                disabled={updating}
              >
                Discontinue
              </button>
            </div>
          )}
          {med.status === 'SUSPENDED' && (
            <div style={{ marginTop: '1.25rem' }}>
              <button
                style={{ ...actionBtn, background: '#16a34a' }}
                onClick={() => updateStatus('ACTIVE')}
                disabled={updating}
              >
                Reactivate
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function AddMedicationModal({ onClose, onCreated }) {
  const [serviceUsers, setServiceUsers] = useState([]);
  const [form, setForm] = useState({
    service_user_id: '',
    name: '', dosage: '', frequency: '', route: '',
    prescribed_by: '', start_date: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/api/service-users').then((res) => setServiceUsers(res.data.service_users ?? [])).catch(() => {});
  }, []);

  function set(field, value) { setForm((p) => ({ ...p, [field]: value })); }

  async function submit(e) {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      await api.post('/api/medications', {
        ...form,
        service_user_id: parseInt(form.service_user_id, 10),
      });
      onCreated();
    } catch (err) {
      setError(err.response?.data?.message ?? 'Failed to add medication');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={modalStyles.overlay} onClick={onClose}>
      <div style={modalStyles.box} onClick={(e) => e.stopPropagation()}>
        <div style={modalStyles.header}>
          <h2 style={modalStyles.title}>Add Medication</h2>
          <button style={modalStyles.close} onClick={onClose}>×</button>
        </div>
        <form onSubmit={submit} style={modalStyles.body}>
          {error && <p style={{ color: '#dc2626', marginBottom: '1rem', fontSize: '0.9rem' }}>{error}</p>}
          <Field label="Service User" required>
            <select style={formStyles.input} value={form.service_user_id} onChange={(e) => set('service_user_id', e.target.value)} required>
              <option value="">Select service user...</option>
              {serviceUsers.map((u) => (
                <option key={u.id} value={u.id}>{u.first_name} {u.last_name}</option>
              ))}
            </select>
          </Field>
          <Field label="Medication Name" required>
            <input style={formStyles.input} value={form.name} onChange={(e) => set('name', e.target.value)} required />
          </Field>
          <div style={formStyles.row}>
            <Field label="Dosage" required>
              <input style={formStyles.input} value={form.dosage} onChange={(e) => set('dosage', e.target.value)} placeholder="e.g. 10mg" required />
            </Field>
            <Field label="Frequency" required>
              <input style={formStyles.input} value={form.frequency} onChange={(e) => set('frequency', e.target.value)} placeholder="e.g. Once daily" required />
            </Field>
          </div>
          <div style={formStyles.row}>
            <Field label="Route" required>
              <input style={formStyles.input} value={form.route} onChange={(e) => set('route', e.target.value)} placeholder="e.g. Oral, IV" required />
            </Field>
            <Field label="Start Date" required>
              <input style={formStyles.input} type="date" value={form.start_date} onChange={(e) => set('start_date', e.target.value)} required />
            </Field>
          </div>
          <Field label="Prescribed By" required>
            <input style={formStyles.input} value={form.prescribed_by} onChange={(e) => set('prescribed_by', e.target.value)} required />
          </Field>
          <button style={formStyles.submit} type="submit" disabled={submitting}>
            {submitting ? 'Adding...' : 'Add Medication'}
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

const actionBtn = { padding: '0.5rem 1.1rem', border: 'none', borderRadius: '6px', color: '#fff', cursor: 'pointer', fontSize: '0.88rem', fontWeight: 600 };

const styles = {
  pageHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' },
  title: { margin: '0 0 0.25rem', fontSize: '1.4rem', fontWeight: 700, color: '#1a1a2e' },
  subtitle: { margin: 0, fontSize: '0.85rem', color: '#6b7280' },
  createBtn: { background: '#1a1a2e', color: '#fff', border: 'none', borderRadius: '6px', padding: '0.6rem 1.1rem', cursor: 'pointer', fontSize: '0.9rem', fontWeight: 600 },
  filterBar: { display: 'flex', gap: '0.5rem', marginBottom: '1.25rem' },
  filterBtn: { padding: '5px 14px', borderRadius: '20px', border: '1px solid #d1d5db', background: '#f9fafb', color: '#374151', fontSize: '0.85rem', cursor: 'pointer', fontWeight: 500 },
  filterBtnActive: { background: '#1a1a2e', color: '#fff', border: '1px solid #1a1a2e' },
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
  box: { background: '#fff', borderRadius: '10px', width: '520px', maxWidth: '95vw', maxHeight: '85vh', overflowY: 'auto', boxShadow: '0 8px 32px rgba(0,0,0,0.18)' },
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
