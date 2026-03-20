import { useEffect, useState } from 'react';
import api from '../services/api';

const STATUS_COLORS = {
  COMPLIANT: '#16a34a',
  NON_COMPLIANT: '#dc2626',
  ACTION_REQUIRED: '#ea580c',
  UNDER_REVIEW: '#2563eb',
};

const CHECK_TYPES = ['SAFEGUARDING', 'MEDICATION', 'STAFFING', 'DOCUMENTATION', 'TRAINING'];

export default function Compliance() {
  const [checks, setChecks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [selected, setSelected] = useState(null);
  const [showAdd, setShowAdd] = useState(false);

  useEffect(() => { fetchChecks(); }, []);

  async function fetchChecks() {
    try {
      const res = await api.get('/api/compliance');
      setChecks(res.data.checks ?? []);
    } catch (err) {
      setError(err.response?.data?.message ?? 'Failed to load compliance checks');
    } finally {
      setLoading(false);
    }
  }

  const now = new Date();
  const overdue = checks.filter((c) => new Date(c.due_date) < now && c.status !== 'COMPLIANT');
  const compliantCount = checks.filter((c) => c.status === 'COMPLIANT').length;
  const actionCount = checks.filter((c) => c.status === 'ACTION_REQUIRED' || c.status === 'NON_COMPLIANT').length;

  const filtered = filterStatus === 'ALL' ? checks : checks.filter((c) => c.status === filterStatus);

  return (
    <div>
      <div style={styles.pageHeader}>
        <div>
          <h1 style={styles.title}>Compliance</h1>
          <p style={styles.subtitle}>{checks.length} checks</p>
        </div>
        <button style={styles.createBtn} onClick={() => setShowAdd(true)}>+ Add Check</button>
      </div>

      <div style={styles.summaryGrid}>
        <SummaryCard label="Total Checks" value={checks.length} color="#1a1a2e" />
        <SummaryCard label="Compliant" value={compliantCount} color="#16a34a" />
        <SummaryCard label="Action Required" value={actionCount} color="#ea580c" />
        <SummaryCard label="Overdue" value={overdue.length} color="#dc2626" />
      </div>

      {overdue.length > 0 && (
        <div style={styles.alertBanner}>
          <strong>🚨 {overdue.length} overdue compliance check{overdue.length > 1 ? 's' : ''}</strong>
          {' — '}
          {overdue.slice(0, 3).map((c) => c.title).join(' · ')}
          {overdue.length > 3 && ` · +${overdue.length - 3} more`}
        </div>
      )}

      <div style={styles.filterBar}>
        {['ALL', 'COMPLIANT', 'UNDER_REVIEW', 'ACTION_REQUIRED', 'NON_COMPLIANT'].map((s) => (
          <button
            key={s}
            style={{ ...styles.filterBtn, ...(filterStatus === s ? styles.filterBtnActive : {}) }}
            onClick={() => setFilterStatus(s)}
          >
            {s === 'ALL' ? 'All' : s.replace('_', ' ')}
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
                {['Title', 'Type', 'Status', 'Due Date', 'Assigned To', 'Service User'].map((h) => (
                  <th key={h} style={styles.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={6} style={styles.empty}>No compliance checks found.</td></tr>
              )}
              {filtered.map((c) => {
                const isOverdue = new Date(c.due_date) < now && c.status !== 'COMPLIANT';
                return (
                  <tr key={c.id} style={{ ...styles.row, ...(isOverdue ? styles.overdueRow : {}) }} onClick={() => setSelected(c)}>
                    <td style={styles.td}><span style={styles.title_}>{c.title}</span></td>
                    <td style={styles.td}><span style={styles.typePill}>{c.check_type?.replace('_', ' ')}</span></td>
                    <td style={styles.td}><Badge value={c.status} colors={STATUS_COLORS} /></td>
                    <td style={styles.td}>
                      <span style={{ color: isOverdue ? '#dc2626' : '#374151', fontWeight: isOverdue ? 600 : 400 }}>
                        {new Date(c.due_date).toLocaleDateString('en-GB')}{isOverdue ? ' ⚠️' : ''}
                      </span>
                    </td>
                    <td style={styles.td}>{c.assigned_to ?? '—'}</td>
                    <td style={styles.td}>
                      {c.service_user ? `${c.service_user.first_name} ${c.service_user.last_name}` : <span style={{ color: '#9ca3af' }}>—</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {selected && <ComplianceDetailModal check={selected} onClose={() => setSelected(null)} onUpdated={() => { setSelected(null); fetchChecks(); }} />}
      {showAdd && <AddComplianceModal onClose={() => setShowAdd(false)} onCreated={() => { setShowAdd(false); fetchChecks(); }} />}
    </div>
  );
}

function SummaryCard({ label, value, color }) {
  return (
    <div style={styles.card}>
      <span style={{ fontSize: '1.5rem', fontWeight: 700, color, lineHeight: 1 }}>{value}</span>
      <span style={{ fontSize: '0.75rem', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 500 }}>{label}</span>
    </div>
  );
}

function ComplianceDetailModal({ check, onClose, onUpdated }) {
  const [updating, setUpdating] = useState(false);
  const [findings, setFindings] = useState(check.findings ?? '');

  async function updateStatus(status) {
    setUpdating(true);
    try {
      await api.patch(`/api/compliance/${check.id}`, {
        status,
        ...(status === 'COMPLIANT' ? { completed_date: new Date().toISOString().split('T')[0] } : {}),
        ...(findings ? { findings } : {}),
      });
      onUpdated();
    } catch { /* silent */ } finally { setUpdating(false); }
  }

  return (
    <div style={modalStyles.overlay} onClick={onClose}>
      <div style={modalStyles.box} onClick={(e) => e.stopPropagation()}>
        <div style={modalStyles.header}>
          <h2 style={modalStyles.title}>{check.title}</h2>
          <button style={modalStyles.close} onClick={onClose}>×</button>
        </div>
        <div style={modalStyles.body}>
          <Row label="Type" value={check.check_type?.replace('_', ' ')} />
          <Row label="Status" value={check.status?.replace('_', ' ')} />
          <Row label="Assigned To" value={check.assigned_to} />
          <Row label="Due Date" value={new Date(check.due_date).toLocaleDateString('en-GB')} />
          <Row label="Completed" value={check.completed_date ? new Date(check.completed_date).toLocaleDateString('en-GB') : null} />
          <Row label="Conducted By" value={check.conducted_by} />
          <Row label="Description" value={check.description} />
          <Row label="Findings" value={check.findings} />
          <Row label="Actions Required" value={check.actions_required} />
          <Row label="Service User" value={check.service_user ? `${check.service_user.first_name} ${check.service_user.last_name}` : null} />

          {check.status !== 'COMPLIANT' && (
            <div style={{ marginTop: '1.25rem' }}>
              <label style={{ display: 'block', fontSize: '0.83rem', fontWeight: 600, color: '#374151', marginBottom: '0.35rem' }}>Findings (optional)</label>
              <textarea
                style={{ width: '100%', padding: '0.55rem 0.75rem', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '0.9rem', boxSizing: 'border-box', height: '60px', resize: 'vertical', marginBottom: '0.75rem' }}
                value={findings}
                onChange={(e) => setFindings(e.target.value)}
              />
              <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                <button style={{ ...actionBtn, background: '#16a34a' }} onClick={() => updateStatus('COMPLIANT')} disabled={updating}>Mark Compliant</button>
                {check.status !== 'ACTION_REQUIRED' && (
                  <button style={{ ...actionBtn, background: '#ea580c' }} onClick={() => updateStatus('ACTION_REQUIRED')} disabled={updating}>Action Required</button>
                )}
                {check.status !== 'UNDER_REVIEW' && (
                  <button style={{ ...actionBtn, background: '#2563eb' }} onClick={() => updateStatus('UNDER_REVIEW')} disabled={updating}>Under Review</button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function AddComplianceModal({ onClose, onCreated }) {
  const [form, setForm] = useState({ check_type: 'SAFEGUARDING', title: '', description: '', due_date: '', assigned_to: '' });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  function set(f, v) { setForm((p) => ({ ...p, [f]: v })); }

  async function submit(e) {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      await api.post('/api/compliance', {
        check_type: form.check_type, title: form.title,
        description: form.description || undefined,
        due_date: form.due_date, assigned_to: form.assigned_to,
      });
      onCreated();
    } catch (err) {
      setError(err.response?.data?.message ?? 'Failed to create compliance check');
    } finally { setSubmitting(false); }
  }

  return (
    <div style={modalStyles.overlay} onClick={onClose}>
      <div style={modalStyles.box} onClick={(e) => e.stopPropagation()}>
        <div style={modalStyles.header}>
          <h2 style={modalStyles.title}>Add Compliance Check</h2>
          <button style={modalStyles.close} onClick={onClose}>×</button>
        </div>
        <form onSubmit={submit} style={modalStyles.body}>
          {error && <p style={{ color: '#dc2626', marginBottom: '1rem', fontSize: '0.9rem' }}>{error}</p>}
          <div style={formStyles.row}>
            <Field label="Check Type" required>
              <select style={formStyles.input} value={form.check_type} onChange={(e) => set('check_type', e.target.value)}>
                {CHECK_TYPES.map((t) => <option key={t} value={t}>{t.replace('_', ' ')}</option>)}
              </select>
            </Field>
            <Field label="Due Date" required>
              <input style={formStyles.input} type="date" value={form.due_date} onChange={(e) => set('due_date', e.target.value)} required />
            </Field>
          </div>
          <Field label="Title" required>
            <input style={formStyles.input} value={form.title} onChange={(e) => set('title', e.target.value)} required />
          </Field>
          <Field label="Assigned To" required>
            <input style={formStyles.input} value={form.assigned_to} onChange={(e) => set('assigned_to', e.target.value)} required />
          </Field>
          <Field label="Description">
            <textarea style={{ ...formStyles.input, height: '70px', resize: 'vertical' }} value={form.description} onChange={(e) => set('description', e.target.value)} />
          </Field>
          <button style={formStyles.submit} type="submit" disabled={submitting}>{submitting ? 'Creating...' : 'Create Check'}</button>
        </form>
      </div>
    </div>
  );
}

function Badge({ value, colors }) {
  if (!value) return <span style={{ color: '#9ca3af' }}>—</span>;
  const color = colors[value] ?? '#6b7280';
  return <span style={{ display: 'inline-block', padding: '2px 10px', borderRadius: '12px', fontSize: '0.78rem', fontWeight: 600, background: `${color}22`, color }}>{value.replace('_', ' ')}</span>;
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
  pageHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem' },
  title: { margin: '0 0 0.25rem', fontSize: '1.4rem', fontWeight: 700, color: '#1a1a2e' },
  subtitle: { margin: 0, fontSize: '0.85rem', color: '#6b7280' },
  createBtn: { background: '#1a1a2e', color: '#fff', border: 'none', borderRadius: '6px', padding: '0.6rem 1.1rem', cursor: 'pointer', fontSize: '0.9rem', fontWeight: 600 },
  summaryGrid: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.75rem', marginBottom: '1.25rem' },
  card: { background: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '4px', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' },
  alertBanner: { background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', padding: '0.75rem 1rem', marginBottom: '1.25rem', fontSize: '0.9rem', color: '#dc2626' },
  filterBar: { display: 'flex', gap: '0.5rem', marginBottom: '1.25rem', flexWrap: 'wrap' },
  filterBtn: { padding: '5px 14px', borderRadius: '20px', border: '1px solid #d1d5db', background: '#f9fafb', color: '#374151', fontSize: '0.85rem', cursor: 'pointer', fontWeight: 500 },
  filterBtnActive: { background: '#1a1a2e', color: '#fff', border: '1px solid #1a1a2e' },
  state: { color: '#6b7280', fontSize: '0.95rem' },
  tableWrap: { background: '#fff', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.07)', overflow: 'hidden' },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: { padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px', background: '#f9fafb', borderBottom: '1px solid #e5e7eb' },
  row: { cursor: 'pointer' },
  overdueRow: { background: '#fff5f5' },
  td: { padding: '0.75rem 1rem', fontSize: '0.9rem', color: '#374151', borderBottom: '1px solid #f3f4f6' },
  title_: { fontWeight: 600, color: '#1a1a2e' },
  typePill: { fontSize: '0.78rem', background: '#f3f4f6', color: '#6b7280', padding: '2px 8px', borderRadius: '4px' },
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
