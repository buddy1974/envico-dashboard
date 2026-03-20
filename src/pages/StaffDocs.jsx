import { useEffect, useState } from 'react';
import api from '../services/api';

const STATUS_COLORS = {
  VALID: '#16a34a',
  EXPIRED: '#dc2626',
  PENDING: '#ea580c',
  REJECTED: '#dc2626',
};

const DOC_TYPES = ['DBS', 'CONTRACT', 'RIGHT_TO_WORK', 'TRAINING_CERT', 'ID', 'OTHER'];

function daysUntilExpiry(date) {
  if (!date) return null;
  return Math.ceil((new Date(date) - new Date()) / 86400000);
}

export default function StaffDocs() {
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [filterType, setFilterType] = useState('ALL');
  const [selected, setSelected] = useState(null);
  const [showAdd, setShowAdd] = useState(false);

  useEffect(() => { fetchDocs(); }, []);

  async function fetchDocs() {
    try {
      const res = await api.get('/api/staff-documents');
      setDocs(res.data.documents ?? []);
    } catch (err) {
      setError(err.response?.data?.message ?? 'Failed to load staff documents');
    } finally {
      setLoading(false);
    }
  }

  const expiring = docs.filter((d) => {
    const days = daysUntilExpiry(d.expiry_date);
    return days !== null && days >= 0 && days <= 30 && d.status === 'VALID';
  });
  const expired = docs.filter((d) => d.status === 'EXPIRED');

  const filtered = docs.filter((d) => {
    const statusMatch = filterStatus === 'ALL' || d.status === filterStatus;
    const typeMatch = filterType === 'ALL' || d.type === filterType;
    return statusMatch && typeMatch;
  });

  return (
    <div>
      <div style={styles.pageHeader}>
        <div>
          <h1 style={styles.title}>Staff Documents</h1>
          <p style={styles.subtitle}>{docs.length} documents</p>
        </div>
        <button style={styles.createBtn} onClick={() => setShowAdd(true)}>+ Add Document</button>
      </div>

      {(expired.length > 0 || expiring.length > 0) && (
        <div style={styles.alertBanner}>
          {expired.length > 0 && (
            <div><strong>🔴 {expired.length} expired document{expired.length > 1 ? 's' : ''}:</strong>{' '}
              {expired.slice(0, 3).map((d) => `${d.staff?.name ?? 'Staff'} — ${d.type}`).join(' · ')}
              {expired.length > 3 && ` · +${expired.length - 3} more`}
            </div>
          )}
          {expiring.length > 0 && (
            <div style={{ marginTop: expired.length > 0 ? '0.35rem' : 0 }}>
              <strong>⚠️ {expiring.length} expiring within 30 days:</strong>{' '}
              {expiring.slice(0, 3).map((d) => `${d.staff?.name ?? 'Staff'} — ${d.type} (${daysUntilExpiry(d.expiry_date)}d)`).join(' · ')}
              {expiring.length > 3 && ` · +${expiring.length - 3} more`}
            </div>
          )}
        </div>
      )}

      <div style={styles.filters}>
        <div style={styles.filterBar}>
          {['ALL', 'VALID', 'PENDING', 'EXPIRED', 'REJECTED'].map((s) => (
            <button key={s} style={{ ...styles.filterBtn, ...(filterStatus === s ? styles.filterBtnActive : {}) }} onClick={() => setFilterStatus(s)}>
              {s === 'ALL' ? 'All Status' : s}
            </button>
          ))}
        </div>
        <div style={styles.filterBar}>
          {['ALL', ...DOC_TYPES].map((t) => (
            <button key={t} style={{ ...styles.filterBtnSm, ...(filterType === t ? styles.filterBtnActive : {}) }} onClick={() => setFilterType(t)}>
              {t === 'ALL' ? 'All Types' : t.replace('_', ' ')}
            </button>
          ))}
        </div>
      </div>

      {loading && <p style={styles.state}>Loading...</p>}
      {error && <p style={{ ...styles.state, color: '#dc2626' }}>{error}</p>}

      {!loading && !error && (
        <div style={styles.tableWrap}>
          <table style={styles.table}>
            <thead>
              <tr>
                {['Staff', 'Document', 'Type', 'Status', 'Issued', 'Expires'].map((h) => (
                  <th key={h} style={styles.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={6} style={styles.empty}>No documents found.</td></tr>
              )}
              {filtered.map((d) => {
                const days = daysUntilExpiry(d.expiry_date);
                const isExpiring = days !== null && days >= 0 && days <= 30;
                const isExpired = d.status === 'EXPIRED' || (days !== null && days < 0);
                return (
                  <tr
                    key={d.id}
                    style={{ ...styles.row, ...(isExpired ? styles.expiredRow : isExpiring ? styles.expiringRow : {}) }}
                    onClick={() => setSelected(d)}
                  >
                    <td style={styles.td}>
                      <span style={styles.name}>{d.staff?.name ?? `Staff #${d.staff_id}`}</span>
                      <span style={styles.role}>{d.staff?.role}</span>
                    </td>
                    <td style={styles.td}><span style={styles.docTitle}>{d.title}</span></td>
                    <td style={styles.td}><span style={styles.typePill}>{d.type?.replace('_', ' ')}</span></td>
                    <td style={styles.td}><Badge value={d.status} colors={STATUS_COLORS} /></td>
                    <td style={styles.td}>
                      {d.issued_date ? new Date(d.issued_date).toLocaleDateString('en-GB') : <span style={{ color: '#9ca3af' }}>—</span>}
                    </td>
                    <td style={styles.td}>
                      {d.expiry_date
                        ? <span style={{ color: isExpired ? '#dc2626' : isExpiring ? '#ea580c' : '#374151', fontWeight: (isExpired || isExpiring) ? 600 : 400 }}>
                            {new Date(d.expiry_date).toLocaleDateString('en-GB')}
                            {isExpired && ' 🔴'}
                            {!isExpired && isExpiring && ` (${days}d) ⚠️`}
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

      {selected && <DocDetailModal doc={selected} onClose={() => setSelected(null)} onUpdated={() => { setSelected(null); fetchDocs(); }} />}
      {showAdd && <AddDocModal onClose={() => setShowAdd(false)} onCreated={() => { setShowAdd(false); fetchDocs(); }} />}
    </div>
  );
}

function DocDetailModal({ doc, onClose, onUpdated }) {
  const [updating, setUpdating] = useState(false);

  async function updateStatus(status) {
    setUpdating(true);
    try {
      await api.patch(`/api/staff-documents/${doc.id}`, { status });
      onUpdated();
    } catch { /* silent */ } finally { setUpdating(false); }
  }

  return (
    <div style={modalStyles.overlay} onClick={onClose}>
      <div style={modalStyles.box} onClick={(e) => e.stopPropagation()}>
        <div style={modalStyles.header}>
          <h2 style={modalStyles.title}>{doc.title}</h2>
          <button style={modalStyles.close} onClick={onClose}>×</button>
        </div>
        <div style={modalStyles.body}>
          <Row label="Staff" value={doc.staff?.name} />
          <Row label="Role" value={doc.staff?.role} />
          <Row label="Type" value={doc.type?.replace('_', ' ')} />
          <Row label="Status" value={doc.status} />
          <Row label="Reference No" value={doc.reference_no} />
          <Row label="Issued" value={doc.issued_date ? new Date(doc.issued_date).toLocaleDateString('en-GB') : null} />
          <Row label="Expires" value={doc.expiry_date ? new Date(doc.expiry_date).toLocaleDateString('en-GB') : null} />
          <Row label="Verified By" value={doc.verified_by} />
          <Row label="Notes" value={doc.notes} />
          {doc.file_url && <div style={{ marginTop: '0.75rem' }}><a href={doc.file_url} target="_blank" rel="noreferrer" style={{ color: '#2563eb', fontSize: '0.9rem' }}>View Document →</a></div>}

          {doc.status !== 'VALID' && (
            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.25rem' }}>
              <button style={{ ...actionBtn, background: '#16a34a' }} onClick={() => updateStatus('VALID')} disabled={updating}>Mark Valid</button>
            </div>
          )}
          {doc.status === 'VALID' && (
            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.25rem' }}>
              <button style={{ ...actionBtn, background: '#dc2626' }} onClick={() => updateStatus('EXPIRED')} disabled={updating}>Mark Expired</button>
              <button style={{ ...actionBtn, background: '#6b7280' }} onClick={() => updateStatus('REJECTED')} disabled={updating}>Reject</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function AddDocModal({ onClose, onCreated }) {
  const [staffList, setStaffList] = useState([]);
  const [form, setForm] = useState({ staff_id: '', type: 'DBS', title: '', reference_no: '', issued_date: '', expiry_date: '', status: 'VALID', notes: '' });
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
      await api.post('/api/staff-documents', {
        staff_id: parseInt(form.staff_id, 10),
        type: form.type, title: form.title,
        reference_no: form.reference_no || undefined,
        issued_date: form.issued_date || undefined,
        expiry_date: form.expiry_date || undefined,
        status: form.status,
        notes: form.notes || undefined,
      });
      onCreated();
    } catch (err) {
      setError(err.response?.data?.message ?? 'Failed to add document');
    } finally { setSubmitting(false); }
  }

  return (
    <div style={modalStyles.overlay} onClick={onClose}>
      <div style={modalStyles.box} onClick={(e) => e.stopPropagation()}>
        <div style={modalStyles.header}>
          <h2 style={modalStyles.title}>Add Staff Document</h2>
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
          <div style={formStyles.row}>
            <Field label="Document Type" required>
              <select style={formStyles.input} value={form.type} onChange={(e) => set('type', e.target.value)}>
                {DOC_TYPES.map((t) => <option key={t} value={t}>{t.replace('_', ' ')}</option>)}
              </select>
            </Field>
            <Field label="Status">
              <select style={formStyles.input} value={form.status} onChange={(e) => set('status', e.target.value)}>
                <option value="VALID">Valid</option>
                <option value="PENDING">Pending</option>
                <option value="EXPIRED">Expired</option>
              </select>
            </Field>
          </div>
          <Field label="Title" required>
            <input style={formStyles.input} value={form.title} onChange={(e) => set('title', e.target.value)} placeholder="e.g. Enhanced DBS Certificate" required />
          </Field>
          <Field label="Reference Number">
            <input style={formStyles.input} value={form.reference_no} onChange={(e) => set('reference_no', e.target.value)} />
          </Field>
          <div style={formStyles.row}>
            <Field label="Issued Date">
              <input style={formStyles.input} type="date" value={form.issued_date} onChange={(e) => set('issued_date', e.target.value)} />
            </Field>
            <Field label="Expiry Date">
              <input style={formStyles.input} type="date" value={form.expiry_date} onChange={(e) => set('expiry_date', e.target.value)} />
            </Field>
          </div>
          <button style={formStyles.submit} type="submit" disabled={submitting}>{submitting ? 'Adding...' : 'Add Document'}</button>
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
  alertBanner: { background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', padding: '0.75rem 1rem', marginBottom: '1.25rem', fontSize: '0.88rem', color: '#dc2626', lineHeight: 1.5 },
  filters: { display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1.25rem' },
  filterBar: { display: 'flex', gap: '0.5rem', flexWrap: 'wrap' },
  filterBtn: { padding: '5px 14px', borderRadius: '20px', border: '1px solid #d1d5db', background: '#f9fafb', color: '#374151', fontSize: '0.85rem', cursor: 'pointer', fontWeight: 500 },
  filterBtnSm: { padding: '4px 12px', borderRadius: '20px', border: '1px solid #d1d5db', background: '#f9fafb', color: '#374151', fontSize: '0.78rem', cursor: 'pointer', fontWeight: 500 },
  filterBtnActive: { background: '#1a1a2e', color: '#fff', border: '1px solid #1a1a2e' },
  state: { color: '#6b7280', fontSize: '0.95rem' },
  tableWrap: { background: '#fff', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.07)', overflow: 'hidden' },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: { padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px', background: '#f9fafb', borderBottom: '1px solid #e5e7eb' },
  row: { cursor: 'pointer' },
  expiredRow: { background: '#fff5f5' },
  expiringRow: { background: '#fffbeb' },
  td: { padding: '0.75rem 1rem', fontSize: '0.9rem', color: '#374151', borderBottom: '1px solid #f3f4f6' },
  name: { display: 'block', fontWeight: 600, color: '#1a1a2e' },
  role: { display: 'block', fontSize: '0.78rem', color: '#9ca3af' },
  docTitle: { fontWeight: 500 },
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
