import { useEffect, useState } from 'react';
import api from '../services/api';

const STATUS_COLORS = {
  DRAFT: '#9ca3af',
  APPROVED: '#2563eb',
  PAID: '#16a34a',
};

function fmt(n) {
  return `£${Number(n ?? 0).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function Payroll() {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [approving, setApproving] = useState(null);

  useEffect(() => { fetchPayroll(); }, []);

  async function fetchPayroll() {
    try {
      const res = await api.get('/api/payroll');
      setRecords(res.data.payroll ?? []);
    } catch (err) {
      setError(err.response?.data?.message ?? 'Failed to load payroll');
    } finally {
      setLoading(false);
    }
  }

  async function approve(e, id) {
    e.stopPropagation();
    setApproving(id);
    try {
      await api.post(`/api/payroll/${id}/approve`, { approved_by: 'Admin' });
      fetchPayroll();
    } catch { /* silent */ } finally { setApproving(null); }
  }

  const now = new Date();
  const thisMonthRecords = records.filter((r) => {
    const d = new Date(r.period_start);
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  });
  const totalThisMonth = thisMonthRecords.reduce((s, r) => s + Number(r.gross_pay ?? 0), 0);

  const filtered = filterStatus === 'ALL' ? records : records.filter((r) => r.status === filterStatus);

  return (
    <div>
      <div style={styles.pageHeader}>
        <div>
          <h1 style={styles.title}>Payroll</h1>
          <p style={styles.subtitle}>{records.length} records</p>
        </div>
        <button style={styles.createBtn} onClick={() => setShowCreate(true)}>+ Add Payroll Record</button>
      </div>

      <div style={styles.summaryGrid}>
        <SummaryCard label="Total Payroll This Month" value={fmt(totalThisMonth)} color="#1a1a2e" />
        <SummaryCard label="Records This Month" value={String(thisMonthRecords.length)} color="#2563eb" />
        <SummaryCard label="Pending Approval" value={String(records.filter((r) => r.status === 'DRAFT').length)} color="#ea580c" />
      </div>

      <div style={styles.filterBar}>
        {['ALL', 'DRAFT', 'APPROVED', 'PAID'].map((s) => (
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
                {['Staff', 'Role', 'Period', 'Hours', 'Gross Pay', 'Net Pay', 'Status', ''].map((h) => (
                  <th key={h} style={styles.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={8} style={styles.empty}>No payroll records found.</td></tr>
              )}
              {filtered.map((r) => (
                <tr key={r.id} style={styles.row} onClick={() => setSelected(r)}>
                  <td style={styles.td}><span style={styles.name}>{r.staff?.name ?? `Staff #${r.staff_id}`}</span></td>
                  <td style={styles.td}><span style={styles.role}>{r.staff?.role ?? '—'}</span></td>
                  <td style={styles.td}>
                    {r.period_start
                      ? `${new Date(r.period_start).toLocaleDateString('en-GB')} – ${new Date(r.period_end).toLocaleDateString('en-GB')}`
                      : '—'}
                  </td>
                  <td style={styles.td}>{Number(r.hours_worked ?? 0).toFixed(1)}h</td>
                  <td style={styles.td}><strong>{fmt(r.gross_pay)}</strong></td>
                  <td style={styles.td}>{fmt(r.net_pay)}</td>
                  <td style={styles.td}><Badge value={r.status} colors={STATUS_COLORS} /></td>
                  <td style={{ ...styles.td, textAlign: 'right' }}>
                    {r.status === 'DRAFT' && (
                      <button
                        style={styles.approveBtn}
                        onClick={(e) => approve(e, r.id)}
                        disabled={approving === r.id}
                      >
                        {approving === r.id ? '...' : 'Approve'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selected && <PayrollDetailModal record={selected} onClose={() => setSelected(null)} onUpdated={fetchPayroll} />}
      {showCreate && (
        <CreatePayrollModal onClose={() => setShowCreate(false)} onCreated={() => { setShowCreate(false); fetchPayroll(); }} />
      )}
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

function PayrollDetailModal({ record, onClose, onUpdated }) {
  const [updating, setUpdating] = useState(false);

  async function approve() {
    setUpdating(true);
    try {
      await api.post(`/api/payroll/${record.id}/approve`, { approved_by: 'Admin' });
      onUpdated();
      onClose();
    } catch { /* silent */ } finally { setUpdating(false); }
  }

  async function markPaid() {
    setUpdating(true);
    try {
      await api.patch(`/api/payroll/${record.id}`, { status: 'PAID' });
      onUpdated();
      onClose();
    } catch { /* silent */ } finally { setUpdating(false); }
  }

  return (
    <div style={modalStyles.overlay} onClick={onClose}>
      <div style={modalStyles.box} onClick={(e) => e.stopPropagation()}>
        <div style={modalStyles.header}>
          <h2 style={modalStyles.title}>{record.staff?.name ?? `Staff #${record.staff_id}`}</h2>
          <button style={modalStyles.close} onClick={onClose}>×</button>
        </div>
        <div style={modalStyles.body}>
          <Row label="Role" value={record.staff?.role} />
          <Row label="Status" value={record.status} />
          <Row label="Period" value={record.period_start ? `${new Date(record.period_start).toLocaleDateString('en-GB')} – ${new Date(record.period_end).toLocaleDateString('en-GB')}` : null} />
          <Row label="Hours Worked" value={`${Number(record.hours_worked ?? 0).toFixed(1)}h`} />
          <Row label="Hourly Rate" value={fmt(record.hourly_rate)} />
          <Row label="Overtime Hours" value={record.overtime_hours > 0 ? `${record.overtime_hours}h @ ${fmt(record.overtime_rate)}/h` : null} />
          <Row label="Gross Pay" value={fmt(record.gross_pay)} />
          <Row label="Deductions" value={record.deductions > 0 ? fmt(record.deductions) : null} />
          <Row label="Net Pay" value={fmt(record.net_pay)} />
          <Row label="Approved By" value={record.approved_by} />
          <Row label="Notes" value={record.notes} />

          <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.25rem' }}>
            {record.status === 'DRAFT' && (
              <button style={{ ...actionBtn, background: '#2563eb' }} onClick={approve} disabled={updating}>Approve</button>
            )}
            {record.status === 'APPROVED' && (
              <button style={{ ...actionBtn, background: '#16a34a' }} onClick={markPaid} disabled={updating}>Mark as Paid</button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function CreatePayrollModal({ onClose, onCreated }) {
  const [staffList, setStaffList] = useState([]);
  const [form, setForm] = useState({
    staff_id: '', period_start: '', period_end: '',
    hours_worked: '', hourly_rate: '',
    overtime_hours: '', overtime_rate: '', deductions: '', notes: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/api/staff').then((res) => setStaffList(res.data.staff ?? res.data ?? [])).catch(() => {});
  }, []);

  function set(f, v) { setForm((p) => ({ ...p, [f]: v })); }

  const grossPreview = form.hours_worked && form.hourly_rate
    ? (parseFloat(form.hours_worked) * parseFloat(form.hourly_rate)) +
      ((parseFloat(form.overtime_hours) || 0) * (parseFloat(form.overtime_rate) || 0))
    : null;
  const netPreview = grossPreview !== null ? grossPreview - (parseFloat(form.deductions) || 0) : null;

  async function submit(e) {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      await api.post('/api/payroll', {
        staff_id: parseInt(form.staff_id, 10),
        period_start: form.period_start,
        period_end: form.period_end,
        hours_worked: parseFloat(form.hours_worked),
        hourly_rate: parseFloat(form.hourly_rate),
        ...(form.overtime_hours ? { overtime_hours: parseFloat(form.overtime_hours) } : {}),
        ...(form.overtime_rate ? { overtime_rate: parseFloat(form.overtime_rate) } : {}),
        ...(form.deductions ? { deductions: parseFloat(form.deductions) } : {}),
        ...(form.notes ? { notes: form.notes } : {}),
      });
      onCreated();
    } catch (err) {
      setError(err.response?.data?.message ?? 'Failed to create payroll record');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={modalStyles.overlay} onClick={onClose}>
      <div style={modalStyles.box} onClick={(e) => e.stopPropagation()}>
        <div style={modalStyles.header}>
          <h2 style={modalStyles.title}>Add Payroll Record</h2>
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
            <Field label="Period Start" required>
              <input style={formStyles.input} type="date" value={form.period_start} onChange={(e) => set('period_start', e.target.value)} required />
            </Field>
            <Field label="Period End" required>
              <input style={formStyles.input} type="date" value={form.period_end} onChange={(e) => set('period_end', e.target.value)} required />
            </Field>
          </div>
          <div style={formStyles.row}>
            <Field label="Hours Worked" required>
              <input style={formStyles.input} type="number" step="0.5" min="0" value={form.hours_worked} onChange={(e) => set('hours_worked', e.target.value)} required />
            </Field>
            <Field label="Hourly Rate (£)" required>
              <input style={formStyles.input} type="number" step="0.01" min="0" value={form.hourly_rate} onChange={(e) => set('hourly_rate', e.target.value)} required />
            </Field>
          </div>
          <div style={formStyles.row}>
            <Field label="Overtime Hours">
              <input style={formStyles.input} type="number" step="0.5" min="0" value={form.overtime_hours} onChange={(e) => set('overtime_hours', e.target.value)} />
            </Field>
            <Field label="Overtime Rate (£)">
              <input style={formStyles.input} type="number" step="0.01" min="0" value={form.overtime_rate} onChange={(e) => set('overtime_rate', e.target.value)} />
            </Field>
          </div>
          <Field label="Deductions (£)">
            <input style={formStyles.input} type="number" step="0.01" min="0" value={form.deductions} onChange={(e) => set('deductions', e.target.value)} />
          </Field>

          {grossPreview !== null && (
            <div style={{ marginBottom: '1rem', padding: '0.75rem', background: '#f8f9fa', borderRadius: '6px', fontSize: '0.9rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#6b7280' }}>Gross Pay</span>
                <strong>{fmt(grossPreview)}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px' }}>
                <span style={{ color: '#6b7280' }}>Net Pay</span>
                <strong style={{ color: '#16a34a' }}>{fmt(netPreview)}</strong>
              </div>
            </div>
          )}

          <button style={formStyles.submit} type="submit" disabled={submitting}>
            {submitting ? 'Creating...' : 'Create Record'}
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
  pageHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem' },
  title: { margin: '0 0 0.25rem', fontSize: '1.4rem', fontWeight: 700, color: '#1a1a2e' },
  subtitle: { margin: 0, fontSize: '0.85rem', color: '#6b7280' },
  createBtn: { background: '#1a1a2e', color: '#fff', border: 'none', borderRadius: '6px', padding: '0.6rem 1.1rem', cursor: 'pointer', fontSize: '0.9rem', fontWeight: 600 },
  summaryGrid: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem', marginBottom: '1.25rem' },
  card: { background: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '4px', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' },
  filterBar: { display: 'flex', gap: '0.5rem', marginBottom: '1.25rem' },
  filterBtn: { padding: '5px 14px', borderRadius: '20px', border: '1px solid #d1d5db', background: '#f9fafb', color: '#374151', fontSize: '0.85rem', cursor: 'pointer', fontWeight: 500 },
  filterBtnActive: { background: '#1a1a2e', color: '#fff', border: '1px solid #1a1a2e' },
  state: { color: '#6b7280', fontSize: '0.95rem' },
  tableWrap: { background: '#fff', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.07)', overflow: 'hidden' },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: { padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px', background: '#f9fafb', borderBottom: '1px solid #e5e7eb' },
  row: { cursor: 'pointer' },
  td: { padding: '0.75rem 1rem', fontSize: '0.9rem', color: '#374151', borderBottom: '1px solid #f3f4f6' },
  name: { fontWeight: 600, color: '#1a1a2e' },
  role: { fontSize: '0.82rem', color: '#6b7280' },
  approveBtn: { padding: '4px 12px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '5px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600 },
  empty: { padding: '2rem', textAlign: 'center', color: '#9ca3af', fontSize: '0.9rem' },
};

const modalStyles = {
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
  box: { background: '#fff', borderRadius: '10px', width: '540px', maxWidth: '95vw', maxHeight: '85vh', overflowY: 'auto', boxShadow: '0 8px 32px rgba(0,0,0,0.18)' },
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
