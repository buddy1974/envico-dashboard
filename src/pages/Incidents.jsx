import { useEffect, useState } from 'react';
import api from '../services/api';

const SEVERITY_COLORS = {
  CRITICAL: '#dc2626',
  HIGH: '#ea580c',
  MEDIUM: '#ca8a04',
  LOW: '#16a34a',
};

const STATUS_COLORS = {
  OPEN: '#2563eb',
  INVESTIGATING: '#7c3aed',
  RESOLVED: '#16a34a',
  CLOSED: '#6b7280',
};

export default function Incidents() {
  const [incidents, setIncidents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState(null);
  const [showReport, setShowReport] = useState(false);

  useEffect(() => {
    fetchIncidents();
  }, []);

  async function fetchIncidents() {
    try {
      const res = await api.get('/api/incidents');
      setIncidents(res.data.incidents ?? res.data ?? []);
    } catch (err) {
      setError(err.response?.data?.message ?? 'Failed to load incidents');
    } finally {
      setLoading(false);
    }
  }

  const bySeverity = (a, b) => {
    const order = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };
    return (order[b.severity] || 0) - (order[a.severity] || 0);
  };

  return (
    <div>
      <div style={styles.pageHeader}>
        <div>
          <h1 style={styles.title}>Incidents</h1>
          <p style={styles.subtitle}>{incidents.length} total</p>
        </div>
        <button style={styles.createBtn} onClick={() => setShowReport(true)}>
          + Report Incident
        </button>
      </div>

      {loading && <p style={styles.state}>Loading...</p>}
      {error && <p style={{ ...styles.state, color: '#dc2626' }}>{error}</p>}

      {!loading && !error && (
        <div style={styles.tableWrap}>
          <table style={styles.table}>
            <thead>
              <tr>
                {['Type', 'Severity', 'Status', 'Reported By', 'Service User', 'Date'].map((h) => (
                  <th key={h} style={styles.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {incidents.length === 0 && (
                <tr>
                  <td colSpan={6} style={styles.empty}>No incidents recorded.</td>
                </tr>
              )}
              {[...incidents].sort(bySeverity).map((inc) => (
                <tr key={inc.id} style={styles.row} onClick={() => setSelected(inc)}>
                  <td style={styles.td}><span style={styles.type}>{inc.type ?? inc.incident_type ?? '—'}</span></td>
                  <td style={styles.td}>
                    <Badge value={inc.severity} colors={SEVERITY_COLORS} />
                  </td>
                  <td style={styles.td}>
                    <Badge value={inc.status} colors={STATUS_COLORS} />
                  </td>
                  <td style={styles.td}>{inc.reported_by ?? '—'}</td>
                  <td style={styles.td}>{inc.service_user_name ?? inc.service_user_id ?? '—'}</td>
                  <td style={styles.td}>{inc.created_at ? new Date(inc.created_at).toLocaleDateString('en-GB') : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selected && <IncidentDetailModal incident={selected} onClose={() => setSelected(null)} />}
      {showReport && (
        <ReportIncidentModal
          onClose={() => setShowReport(false)}
          onCreated={() => { setShowReport(false); fetchIncidents(); }}
        />
      )}
    </div>
  );
}

function Badge({ value, colors }) {
  if (!value) return <span style={{ color: '#9ca3af' }}>—</span>;
  const color = colors[value] ?? '#6b7280';
  return (
    <span style={{
      display: 'inline-block',
      padding: '2px 10px',
      borderRadius: '12px',
      fontSize: '0.78rem',
      fontWeight: 600,
      background: `${color}22`,
      color,
    }}>
      {value}
    </span>
  );
}

function IncidentDetailModal({ incident, onClose }) {
  return (
    <div style={modalStyles.overlay} onClick={onClose}>
      <div style={modalStyles.box} onClick={(e) => e.stopPropagation()}>
        <div style={modalStyles.header}>
          <h2 style={modalStyles.title}>Incident #{incident.id}</h2>
          <button style={modalStyles.close} onClick={onClose}>×</button>
        </div>
        <div style={modalStyles.body}>
          <Row label="Type" value={incident.type ?? incident.incident_type} />
          <Row label="Severity" value={incident.severity} />
          <Row label="Status" value={incident.status} />
          <Row label="Reported By" value={incident.reported_by} />
          <Row label="Service User" value={incident.service_user_name ?? incident.service_user_id} />
          <Row label="Description" value={incident.description} />
          <Row label="Action Taken" value={incident.action_taken} />
          <Row label="Date" value={incident.created_at ? new Date(incident.created_at).toLocaleString('en-GB') : '—'} />
        </div>
      </div>
    </div>
  );
}

function ReportIncidentModal({ onClose, onCreated }) {
  const [form, setForm] = useState({
    type: '',
    severity: 'MEDIUM',
    description: '',
    reported_by: '',
    service_user_id: '',
  });
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
      await api.post('/api/incidents', form);
      onCreated();
    } catch (err) {
      setError(err.response?.data?.message ?? 'Failed to report incident');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={modalStyles.overlay} onClick={onClose}>
      <div style={modalStyles.box} onClick={(e) => e.stopPropagation()}>
        <div style={modalStyles.header}>
          <h2 style={modalStyles.title}>Report Incident</h2>
          <button style={modalStyles.close} onClick={onClose}>×</button>
        </div>
        <form onSubmit={submit} style={modalStyles.body}>
          {error && <p style={{ color: '#dc2626', marginBottom: '1rem' }}>{error}</p>}
          <Field label="Incident Type" required>
            <input style={formStyles.input} value={form.type} onChange={(e) => set('type', e.target.value)} placeholder="e.g. Fall, Medication Error, Behaviour" required />
          </Field>
          <Field label="Severity">
            <select style={formStyles.input} value={form.severity} onChange={(e) => set('severity', e.target.value)}>
              <option value="LOW">Low</option>
              <option value="MEDIUM">Medium</option>
              <option value="HIGH">High</option>
              <option value="CRITICAL">Critical</option>
            </select>
          </Field>
          <Field label="Service User ID">
            <input style={formStyles.input} value={form.service_user_id} onChange={(e) => set('service_user_id', e.target.value)} placeholder="Service user ID or name" />
          </Field>
          <Field label="Reported By" required>
            <input style={formStyles.input} value={form.reported_by} onChange={(e) => set('reported_by', e.target.value)} required />
          </Field>
          <Field label="Description">
            <textarea
              style={{ ...formStyles.input, height: '80px', resize: 'vertical' }}
              value={form.description}
              onChange={(e) => set('description', e.target.value)}
              placeholder="Describe what happened..."
            />
          </Field>
          <button style={formStyles.submit} type="submit" disabled={submitting}>
            {submitting ? 'Submitting...' : 'Submit Report'}
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
      <span style={{ color: '#6b7280', minWidth: '140px', fontWeight: 500 }}>{label}</span>
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
  createBtn: { background: '#dc2626', color: '#fff', border: 'none', borderRadius: '6px', padding: '0.6rem 1.1rem', cursor: 'pointer', fontSize: '0.9rem', fontWeight: 600 },
  state: { color: '#6b7280', fontSize: '0.95rem' },
  tableWrap: { background: '#fff', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.07)', overflow: 'hidden' },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: { padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px', background: '#f9fafb', borderBottom: '1px solid #e5e7eb' },
  row: { cursor: 'pointer', transition: 'background 0.1s' },
  td: { padding: '0.85rem 1rem', fontSize: '0.9rem', color: '#374151', borderBottom: '1px solid #f3f4f6' },
  type: { fontWeight: 600, color: '#1a1a2e' },
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
  label: { display: 'block', fontSize: '0.83rem', fontWeight: 600, color: '#374151', marginBottom: '0.35rem' },
  input: { width: '100%', padding: '0.55rem 0.75rem', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '0.9rem', boxSizing: 'border-box', outline: 'none' },
  submit: { width: '100%', padding: '0.7rem', background: '#1a1a2e', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '0.95rem', fontWeight: 600, cursor: 'pointer', marginTop: '0.5rem' },
};
