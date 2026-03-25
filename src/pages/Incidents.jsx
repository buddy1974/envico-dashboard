import { useEffect, useState } from 'react';
import api from '../services/api';
import OCRDocumentScanner from '../components/OCRDocumentScanner';
import AIWriteButton from '../components/AIWriteButton';

const SEVERITY_COLORS = {
  CRITICAL: '#dc2626',
  HIGH: '#ea580c',
  MEDIUM: '#ca8a04',
  LOW: '#16a34a',
};

const STATUS_COLORS = {
  OPEN: '#2563eb',
  UNDER_INVESTIGATION: '#7c3aed',
  CLOSED: '#6b7280',
};

const INCIDENT_TYPES = ['ACCIDENT', 'SAFEGUARDING', 'MEDICATION_ERROR', 'BEHAVIOUR', 'OTHER'];
const SEVERITY_ORDER = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };

export default function Incidents() {
  const [incidents, setIncidents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState(null);
  const [showReport, setShowReport] = useState(false);

  useEffect(() => { fetchIncidents(); }, []);

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

  const sorted = [...incidents].sort(
    (a, b) => (SEVERITY_ORDER[b.severity] || 0) - (SEVERITY_ORDER[a.severity] || 0)
  );

  return (
    <div>
      <div style={styles.pageHeader}>
        <div>
          <h1 style={styles.title}>Incidents</h1>
          <p style={styles.subtitle}>{incidents.length} total</p>
        </div>
        <button style={styles.createBtn} onClick={() => setShowReport(true)}>+ Report Incident</button>
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
              {sorted.length === 0 && (
                <tr><td colSpan={6} style={styles.empty}>No incidents recorded.</td></tr>
              )}
              {sorted.map((inc) => (
                <tr key={inc.id} style={styles.row} onClick={() => setSelected(inc)}>
                  <td style={styles.td}><span style={styles.type}>{inc.type?.replace('_', ' ') ?? '—'}</span></td>
                  <td style={styles.td}><Badge value={inc.severity} colors={SEVERITY_COLORS} /></td>
                  <td style={styles.td}><Badge value={inc.status} colors={STATUS_COLORS} /></td>
                  <td style={styles.td}>{inc.reported_by ?? '—'}</td>
                  <td style={styles.td}>
                    {inc.service_user
                      ? `${inc.service_user.first_name} ${inc.service_user.last_name}`
                      : inc.service_user_id ?? '—'}
                  </td>
                  <td style={styles.td}>
                    {inc.reported_at ? new Date(inc.reported_at).toLocaleDateString('en-GB') : '—'}
                  </td>
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

function IncidentDetailModal({ incident, onClose }) {
  const suName = incident.service_user
    ? `${incident.service_user.first_name} ${incident.service_user.last_name}`
    : null;
  return (
    <div style={modalStyles.overlay} onClick={onClose}>
      <div style={modalStyles.box} onClick={(e) => e.stopPropagation()}>
        <div style={modalStyles.header}>
          <h2 style={modalStyles.title}>Incident #{incident.id}</h2>
          <button style={modalStyles.close} onClick={onClose}>×</button>
        </div>
        <div style={modalStyles.body}>
          <Row label="Type" value={incident.type?.replace('_', ' ')} />
          <Row label="Severity" value={incident.severity} />
          <Row label="Status" value={incident.status?.replace('_', ' ')} />
          <Row label="Service User" value={suName ?? String(incident.service_user_id)} />
          <Row label="Reported By" value={incident.reported_by} />
          <Row label="Location" value={incident.location} />
          <Row label="Description" value={incident.description} />
          <Row label="Witnesses" value={incident.witnesses} />
          <Row label="Action Taken" value={incident.action_taken} />
          <Row label="Reported At" value={incident.reported_at ? new Date(incident.reported_at).toLocaleString('en-GB') : null} />
        </div>
      </div>
    </div>
  );
}

function ReportIncidentModal({ onClose, onCreated }) {
  const [serviceUsers, setServiceUsers] = useState([]);
  const [form, setForm] = useState({
    type: 'ACCIDENT',
    severity: 'MEDIUM',
    description: '',
    reported_by: '',
    service_user_id: '',
    location: '',
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
      await api.post('/api/incidents', {
        ...form,
        service_user_id: form.service_user_id ? parseInt(form.service_user_id, 10) : undefined,
      });
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
          {error && <p style={{ color: '#dc2626', marginBottom: '1rem', fontSize: '0.9rem' }}>{error}</p>}
          <OCRDocumentScanner
            context="incident"
            label="Scan handwritten incident note"
            onImport={(data) => {
              if (data.description) set('description', data.description);
              if (data.severity) set('severity', data.severity);
              if (data.incident_date) set('incident_date', data.incident_date);
              if (data.immediate_action_taken) set('action_taken', data.immediate_action_taken);
            }}
          />
          <Field label="Service User" required>
            <select style={formStyles.input} value={form.service_user_id} onChange={(e) => set('service_user_id', e.target.value)} required>
              <option value="">Select service user...</option>
              {serviceUsers.map((u) => (
                <option key={u.id} value={u.id}>{u.first_name} {u.last_name}</option>
              ))}
            </select>
          </Field>
          <div style={formStyles.row}>
            <Field label="Type" required>
              <select style={formStyles.input} value={form.type} onChange={(e) => set('type', e.target.value)}>
                {INCIDENT_TYPES.map((t) => (
                  <option key={t} value={t}>{t.replace('_', ' ')}</option>
                ))}
              </select>
            </Field>
            <Field label="Severity">
              <select style={formStyles.input} value={form.severity} onChange={(e) => set('severity', e.target.value)}>
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
                <option value="CRITICAL">Critical</option>
              </select>
            </Field>
          </div>
          <Field label="Reported By" required>
            <input style={formStyles.input} value={form.reported_by} onChange={(e) => set('reported_by', e.target.value)} required />
          </Field>
          <Field label="Location">
            <input style={formStyles.input} value={form.location} onChange={(e) => set('location', e.target.value)} placeholder="Where did it happen?" />
          </Field>
          <div style={{ marginBottom: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
              <label style={formStyles.label}>Description *</label>
              <AIWriteButton
                value={form.description}
                field="incident_description"
                onResult={(text) => set('description', text)}
              />
            </div>
            <textarea
              style={{ ...formStyles.input, height: '80px', resize: 'vertical' }}
              value={form.description}
              onChange={(e) => set('description', e.target.value)}
              required
            />
          </div>
          <button style={formStyles.submit} type="submit" disabled={submitting}>
            {submitting ? 'Submitting...' : 'Submit Report'}
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
      {value.replace('_', ' ')}
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
  createBtn: { background: '#dc2626', color: '#fff', border: 'none', borderRadius: '6px', padding: '0.6rem 1.1rem', cursor: 'pointer', fontSize: '0.9rem', fontWeight: 600 },
  state: { color: '#6b7280', fontSize: '0.95rem' },
  tableWrap: { background: '#fff', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.07)', overflow: 'hidden' },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: { padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px', background: '#f9fafb', borderBottom: '1px solid #e5e7eb' },
  row: { cursor: 'pointer' },
  td: { padding: '0.85rem 1rem', fontSize: '0.9rem', color: '#374151', borderBottom: '1px solid #f3f4f6' },
  type: { fontWeight: 600, color: '#1a1a2e' },
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
