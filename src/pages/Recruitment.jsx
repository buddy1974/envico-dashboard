import { useEffect, useState } from 'react';
import api from '../services/api';

const PIPELINE = ['NEW', 'SHORTLISTED', 'INTERVIEW', 'OFFERED', 'HIRED', 'REJECTED'];

const STATUS_COLORS = {
  NEW: '#9ca3af',
  SHORTLISTED: '#2563eb',
  INTERVIEW: '#ea580c',
  OFFERED: '#16a34a',
  HIRED: '#15803d',
  REJECTED: '#dc2626',
};

const NEXT_STAGE = {
  NEW: 'SHORTLISTED',
  SHORTLISTED: 'INTERVIEW',
  INTERVIEW: 'OFFERED',
  OFFERED: 'HIRED',
};

export default function Recruitment() {
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [selected, setSelected] = useState(null);
  const [showAdd, setShowAdd] = useState(false);
  const [advancing, setAdvancing] = useState(null);

  useEffect(() => { fetchApplications(); }, []);

  async function fetchApplications() {
    try {
      const res = await api.get('/api/recruitment');
      setApplications(res.data.applications ?? []);
    } catch (err) {
      setError(err.response?.data?.message ?? 'Failed to load applications');
    } finally {
      setLoading(false);
    }
  }

  async function advanceStage(e, app) {
    e.stopPropagation();
    const next = NEXT_STAGE[app.status];
    if (!next) return;
    setAdvancing(app.id);
    try {
      await api.patch(`/api/recruitment/${app.id}`, { status: next });
      fetchApplications();
    } catch { /* silent */ } finally { setAdvancing(null); }
  }

  const counts = PIPELINE.reduce((acc, s) => {
    acc[s] = applications.filter((a) => a.status === s).length;
    return acc;
  }, {});

  const filtered = filterStatus === 'ALL' ? applications : applications.filter((a) => a.status === filterStatus);
  const active = applications.filter((a) => !['HIRED', 'REJECTED'].includes(a.status));

  return (
    <div>
      <div style={styles.pageHeader}>
        <div>
          <h1 style={styles.title}>Recruitment</h1>
          <p style={styles.subtitle}>{applications.length} total · {active.length} active</p>
        </div>
        <button style={styles.createBtn} onClick={() => setShowAdd(true)}>+ Add Application</button>
      </div>

      {/* Pipeline summary */}
      <div style={styles.pipelineGrid}>
        {PIPELINE.map((s) => (
          <div
            key={s}
            style={{ ...styles.pipelineCard, borderTop: `3px solid ${STATUS_COLORS[s]}`, cursor: 'pointer', opacity: filterStatus === s ? 1 : 0.8 }}
            onClick={() => setFilterStatus(filterStatus === s ? 'ALL' : s)}
          >
            <span style={{ fontSize: '1.4rem', fontWeight: 700, color: STATUS_COLORS[s], lineHeight: 1 }}>{counts[s] ?? 0}</span>
            <span style={{ fontSize: '0.72rem', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 600, marginTop: '2px' }}>{s}</span>
          </div>
        ))}
      </div>

      <div style={styles.filterBar}>
        <button style={{ ...styles.filterBtn, ...(filterStatus === 'ALL' ? styles.filterBtnActive : {}) }} onClick={() => setFilterStatus('ALL')}>All</button>
        {PIPELINE.map((s) => (
          <button key={s} style={{ ...styles.filterBtn, ...(filterStatus === s ? styles.filterBtnActive : {}) }} onClick={() => setFilterStatus(s)}>
            {s}
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
                {['Applicant', 'Role Applied', 'Status', 'Applied', 'Interview', ''].map((h) => (
                  <th key={h} style={styles.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={6} style={styles.empty}>No applications found.</td></tr>
              )}
              {filtered.map((app) => (
                <tr key={app.id} style={styles.row} onClick={() => setSelected(app)}>
                  <td style={styles.td}>
                    <span style={styles.name}>{app.first_name} {app.last_name}</span>
                    <span style={styles.email}>{app.email}</span>
                  </td>
                  <td style={styles.td}>{app.role_applied}</td>
                  <td style={styles.td}><Badge value={app.status} colors={STATUS_COLORS} /></td>
                  <td style={styles.td}>{app.applied_at ? new Date(app.applied_at).toLocaleDateString('en-GB') : '—'}</td>
                  <td style={styles.td}>
                    {app.interview_date
                      ? new Date(app.interview_date).toLocaleDateString('en-GB')
                      : <span style={{ color: '#9ca3af' }}>—</span>}
                  </td>
                  <td style={{ ...styles.td, textAlign: 'right' }}>
                    {NEXT_STAGE[app.status] && (
                      <button
                        style={styles.advanceBtn}
                        onClick={(e) => advanceStage(e, app)}
                        disabled={advancing === app.id}
                      >
                        {advancing === app.id ? '...' : `→ ${NEXT_STAGE[app.status]}`}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selected && (
        <ApplicationDetailModal
          app={selected}
          onClose={() => setSelected(null)}
          onUpdated={() => { setSelected(null); fetchApplications(); }}
        />
      )}
      {showAdd && <AddApplicationModal onClose={() => setShowAdd(false)} onCreated={() => { setShowAdd(false); fetchApplications(); }} />}
    </div>
  );
}

function ApplicationDetailModal({ app, onClose, onUpdated }) {
  const [showHireForm, setShowHireForm] = useState(false);
  const [hireForm, setHireForm] = useState({ role: app.role_applied, phone: app.phone ?? '' });
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState('');

  async function updateStatus(status) {
    setUpdating(true);
    try {
      await api.patch(`/api/recruitment/${app.id}`, { status });
      onUpdated();
    } catch { /* silent */ } finally { setUpdating(false); }
  }

  async function hire(e) {
    e.preventDefault();
    setUpdating(true);
    setError('');
    try {
      await api.post(`/api/recruitment/${app.id}/hire`, hireForm);
      onUpdated();
    } catch (err) {
      setError(err.response?.data?.message ?? 'Failed to hire applicant');
    } finally { setUpdating(false); }
  }

  return (
    <div style={modalStyles.overlay} onClick={onClose}>
      <div style={modalStyles.box} onClick={(e) => e.stopPropagation()}>
        <div style={modalStyles.header}>
          <h2 style={modalStyles.title}>{app.first_name} {app.last_name}</h2>
          <button style={modalStyles.close} onClick={onClose}>×</button>
        </div>
        <div style={modalStyles.body}>
          <Row label="Role Applied" value={app.role_applied} />
          <Row label="Status" value={app.status} />
          <Row label="Email" value={app.email} />
          <Row label="Phone" value={app.phone} />
          <Row label="Applied" value={app.applied_at ? new Date(app.applied_at).toLocaleDateString('en-GB') : null} />
          <Row label="Interview" value={app.interview_date ? new Date(app.interview_date).toLocaleString('en-GB') : null} />
          <Row label="Interview Notes" value={app.interview_notes} />
          <Row label="Outcome Notes" value={app.outcome_notes} />
          <Row label="Reviewed By" value={app.reviewed_by} />

          {!showHireForm && (
            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.25rem', flexWrap: 'wrap' }}>
              {NEXT_STAGE[app.status] && (
                <button style={{ ...actionBtn, background: STATUS_COLORS[NEXT_STAGE[app.status]] }} onClick={() => updateStatus(NEXT_STAGE[app.status])} disabled={updating}>
                  Move to {NEXT_STAGE[app.status]}
                </button>
              )}
              {app.status === 'OFFERED' && (
                <button style={{ ...actionBtn, background: '#15803d' }} onClick={() => setShowHireForm(true)}>Hire ✓</button>
              )}
              {app.status !== 'REJECTED' && app.status !== 'HIRED' && (
                <button style={{ ...actionBtn, background: '#dc2626' }} onClick={() => updateStatus('REJECTED')} disabled={updating}>Reject</button>
              )}
            </div>
          )}

          {showHireForm && (
            <form onSubmit={hire} style={{ marginTop: '1.25rem', borderTop: '1px solid #e5e7eb', paddingTop: '1.25rem' }}>
              {error && <p style={{ color: '#dc2626', fontSize: '0.9rem', marginBottom: '0.75rem' }}>{error}</p>}
              <p style={{ fontSize: '0.85rem', fontWeight: 600, color: '#374151', marginBottom: '1rem' }}>Confirm hire — this creates a Staff record</p>
              <Field label="Confirmed Role" required>
                <input style={formStyles.input} value={hireForm.role} onChange={(e) => setHireForm((p) => ({ ...p, role: e.target.value }))} required />
              </Field>
              <Field label="Phone" required>
                <input style={formStyles.input} value={hireForm.phone} onChange={(e) => setHireForm((p) => ({ ...p, phone: e.target.value }))} required />
              </Field>
              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.75rem' }}>
                <button style={{ ...actionBtn, background: '#15803d' }} type="submit" disabled={updating}>Confirm Hire</button>
                <button style={{ ...actionBtn, background: '#6b7280' }} type="button" onClick={() => setShowHireForm(false)}>Cancel</button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

function AddApplicationModal({ onClose, onCreated }) {
  const [form, setForm] = useState({ first_name: '', last_name: '', email: '', phone: '', role_applied: '', interview_date: '' });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  function set(f, v) { setForm((p) => ({ ...p, [f]: v })); }

  async function submit(e) {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      await api.post('/api/recruitment', {
        first_name: form.first_name, last_name: form.last_name,
        email: form.email, phone: form.phone || undefined,
        role_applied: form.role_applied,
        interview_date: form.interview_date || undefined,
      });
      onCreated();
    } catch (err) {
      setError(err.response?.data?.message ?? 'Failed to add application');
    } finally { setSubmitting(false); }
  }

  return (
    <div style={modalStyles.overlay} onClick={onClose}>
      <div style={modalStyles.box} onClick={(e) => e.stopPropagation()}>
        <div style={modalStyles.header}>
          <h2 style={modalStyles.title}>Add Application</h2>
          <button style={modalStyles.close} onClick={onClose}>×</button>
        </div>
        <form onSubmit={submit} style={modalStyles.body}>
          {error && <p style={{ color: '#dc2626', marginBottom: '1rem', fontSize: '0.9rem' }}>{error}</p>}
          <div style={formStyles.row}>
            <Field label="First Name" required><input style={formStyles.input} value={form.first_name} onChange={(e) => set('first_name', e.target.value)} required /></Field>
            <Field label="Last Name" required><input style={formStyles.input} value={form.last_name} onChange={(e) => set('last_name', e.target.value)} required /></Field>
          </div>
          <Field label="Email" required><input style={formStyles.input} type="email" value={form.email} onChange={(e) => set('email', e.target.value)} required /></Field>
          <div style={formStyles.row}>
            <Field label="Phone"><input style={formStyles.input} value={form.phone} onChange={(e) => set('phone', e.target.value)} /></Field>
            <Field label="Role Applied" required><input style={formStyles.input} value={form.role_applied} onChange={(e) => set('role_applied', e.target.value)} required /></Field>
          </div>
          <Field label="Interview Date">
            <input style={formStyles.input} type="datetime-local" value={form.interview_date} onChange={(e) => set('interview_date', e.target.value)} />
          </Field>
          <button style={formStyles.submit} type="submit" disabled={submitting}>{submitting ? 'Adding...' : 'Add Application'}</button>
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

const actionBtn = { padding: '0.5rem 1.1rem', border: 'none', borderRadius: '6px', color: '#fff', cursor: 'pointer', fontSize: '0.88rem', fontWeight: 600 };

const styles = {
  pageHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem' },
  title: { margin: '0 0 0.25rem', fontSize: '1.4rem', fontWeight: 700, color: '#1a1a2e' },
  subtitle: { margin: 0, fontSize: '0.85rem', color: '#6b7280' },
  createBtn: { background: '#1a1a2e', color: '#fff', border: 'none', borderRadius: '6px', padding: '0.6rem 1.1rem', cursor: 'pointer', fontSize: '0.9rem', fontWeight: 600 },
  pipelineGrid: { display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '0.5rem', marginBottom: '1.25rem' },
  pipelineCard: { background: '#fff', borderRadius: '8px', padding: '0.75rem', display: 'flex', flexDirection: 'column', alignItems: 'center', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', border: '1px solid #e5e7eb' },
  filterBar: { display: 'flex', gap: '0.5rem', marginBottom: '1.25rem', flexWrap: 'wrap' },
  filterBtn: { padding: '5px 14px', borderRadius: '20px', border: '1px solid #d1d5db', background: '#f9fafb', color: '#374151', fontSize: '0.85rem', cursor: 'pointer', fontWeight: 500 },
  filterBtnActive: { background: '#1a1a2e', color: '#fff', border: '1px solid #1a1a2e' },
  state: { color: '#6b7280', fontSize: '0.95rem' },
  tableWrap: { background: '#fff', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.07)', overflow: 'hidden' },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: { padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px', background: '#f9fafb', borderBottom: '1px solid #e5e7eb' },
  row: { cursor: 'pointer' },
  td: { padding: '0.75rem 1rem', fontSize: '0.9rem', color: '#374151', borderBottom: '1px solid #f3f4f6' },
  name: { display: 'block', fontWeight: 600, color: '#1a1a2e' },
  email: { display: 'block', fontSize: '0.78rem', color: '#9ca3af' },
  advanceBtn: { padding: '4px 12px', background: '#1a1a2e', color: '#fff', border: 'none', borderRadius: '5px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600, whiteSpace: 'nowrap' },
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
