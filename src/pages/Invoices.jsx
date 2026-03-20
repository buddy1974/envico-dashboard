import { useEffect, useState } from 'react';
import api from '../services/api';

const STATUS_COLORS = {
  DRAFT: '#9ca3af',
  SENT: '#2563eb',
  PAID: '#16a34a',
  OVERDUE: '#dc2626',
  CANCELLED: '#6b7280',
};

function fmt(n) {
  return `£${Number(n ?? 0).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function Invoices() {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [marking, setMarking] = useState(null);

  useEffect(() => { fetchInvoices(); }, []);

  async function fetchInvoices() {
    try {
      const res = await api.get('/api/invoices');
      setInvoices(res.data.invoices ?? []);
    } catch (err) {
      setError(err.response?.data?.message ?? 'Failed to load invoices');
    } finally {
      setLoading(false);
    }
  }

  async function markPaid(e, id) {
    e.stopPropagation();
    setMarking(id);
    try {
      await api.post(`/api/invoices/${id}/mark-paid`);
      fetchInvoices();
    } catch {
      // silent
    } finally {
      setMarking(null);
    }
  }

  const filtered = filterStatus === 'ALL' ? invoices : invoices.filter((i) => i.status === filterStatus);

  const totalInvoiced = invoices.reduce((s, i) => s + Number(i.amount_total ?? 0), 0);
  const totalPaid = invoices.filter((i) => i.status === 'PAID').reduce((s, i) => s + Number(i.amount_total ?? 0), 0);
  const totalOutstanding = invoices.filter((i) => ['SENT', 'OVERDUE'].includes(i.status)).reduce((s, i) => s + Number(i.amount_total ?? 0), 0);

  return (
    <div>
      <div style={styles.pageHeader}>
        <div>
          <h1 style={styles.title}>Invoices</h1>
          <p style={styles.subtitle}>{invoices.length} total</p>
        </div>
        <button style={styles.createBtn} onClick={() => setShowCreate(true)}>+ Create Invoice</button>
      </div>

      <div style={styles.summaryGrid}>
        <SummaryCard label="Total Invoiced" value={fmt(totalInvoiced)} color="#1a1a2e" />
        <SummaryCard label="Total Paid" value={fmt(totalPaid)} color="#16a34a" />
        <SummaryCard label="Outstanding" value={fmt(totalOutstanding)} color="#dc2626" />
      </div>

      <div style={styles.filterBar}>
        {['ALL', 'DRAFT', 'SENT', 'PAID', 'OVERDUE', 'CANCELLED'].map((s) => (
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
                {['Invoice #', 'Service User', 'Amount', 'Status', 'Due Date', ''].map((h) => (
                  <th key={h} style={styles.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={6} style={styles.empty}>No invoices found.</td></tr>
              )}
              {filtered.map((inv) => {
                const isOverdue = inv.due_date && new Date(inv.due_date) < new Date() && inv.status !== 'PAID' && inv.status !== 'CANCELLED';
                return (
                  <tr key={inv.id} style={styles.row} onClick={() => setSelected(inv)}>
                    <td style={styles.td}><span style={styles.invNum}>{inv.invoice_number}</span></td>
                    <td style={styles.td}>
                      {inv.service_user ? `${inv.service_user.first_name} ${inv.service_user.last_name}` : `User #${inv.service_user_id}`}
                    </td>
                    <td style={styles.td}><strong>{fmt(inv.amount_total)}</strong></td>
                    <td style={styles.td}><Badge value={inv.status} colors={STATUS_COLORS} /></td>
                    <td style={styles.td}>
                      {inv.due_date
                        ? <span style={{ color: isOverdue ? '#dc2626' : '#374151', fontWeight: isOverdue ? 600 : 400 }}>
                            {new Date(inv.due_date).toLocaleDateString('en-GB')}{isOverdue ? ' ⚠️' : ''}
                          </span>
                        : <span style={{ color: '#9ca3af' }}>—</span>}
                    </td>
                    <td style={{ ...styles.td, textAlign: 'right' }}>
                      {(inv.status === 'SENT' || inv.status === 'OVERDUE') && (
                        <button
                          style={styles.markPaidBtn}
                          onClick={(e) => markPaid(e, inv.id)}
                          disabled={marking === inv.id}
                        >
                          {marking === inv.id ? '...' : 'Mark Paid'}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {selected && <InvoiceDetailModal invoice={selected} onClose={() => setSelected(null)} onUpdated={fetchInvoices} />}
      {showCreate && (
        <CreateInvoiceModal onClose={() => setShowCreate(false)} onCreated={() => { setShowCreate(false); fetchInvoices(); }} />
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

function InvoiceDetailModal({ invoice, onClose, onUpdated }) {
  const [updating, setUpdating] = useState(false);
  const suName = invoice.service_user
    ? `${invoice.service_user.first_name} ${invoice.service_user.last_name}`
    : `User #${invoice.service_user_id}`;

  async function updateStatus(status) {
    setUpdating(true);
    try {
      await api.patch(`/api/invoices/${invoice.id}`, { status });
      onUpdated();
      onClose();
    } catch { /* silent */ } finally { setUpdating(false); }
  }

  async function markPaid() {
    setUpdating(true);
    try {
      await api.post(`/api/invoices/${invoice.id}/mark-paid`);
      onUpdated();
      onClose();
    } catch { /* silent */ } finally { setUpdating(false); }
  }

  return (
    <div style={modalStyles.overlay} onClick={onClose}>
      <div style={modalStyles.box} onClick={(e) => e.stopPropagation()}>
        <div style={modalStyles.header}>
          <h2 style={modalStyles.title}>{invoice.invoice_number}</h2>
          <button style={modalStyles.close} onClick={onClose}>×</button>
        </div>
        <div style={modalStyles.body}>
          <Row label="Service User" value={suName} />
          <Row label="Status" value={invoice.status} />
          <Row label="Amount (Net)" value={fmt(invoice.amount_net)} />
          <Row label="Amount (Total)" value={fmt(invoice.amount_total)} />
          <Row label="Weekly Rate" value={invoice.weekly_rate ? fmt(invoice.weekly_rate) : null} />
          <Row label="Weeks" value={invoice.weeks ? String(invoice.weeks) : null} />
          <Row label="Period" value={invoice.period_start ? `${new Date(invoice.period_start).toLocaleDateString('en-GB')} – ${new Date(invoice.period_end).toLocaleDateString('en-GB')}` : null} />
          <Row label="Due Date" value={invoice.due_date ? new Date(invoice.due_date).toLocaleDateString('en-GB') : null} />
          <Row label="Paid At" value={invoice.paid_at ? new Date(invoice.paid_at).toLocaleString('en-GB') : null} />
          <Row label="Created By" value={invoice.created_by} />
          <Row label="Notes" value={invoice.notes} />

          <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.25rem', flexWrap: 'wrap' }}>
            {invoice.status === 'DRAFT' && (
              <button style={{ ...actionBtn, background: '#2563eb' }} onClick={() => updateStatus('SENT')} disabled={updating}>Send Invoice</button>
            )}
            {(invoice.status === 'SENT' || invoice.status === 'OVERDUE') && (
              <button style={{ ...actionBtn, background: '#16a34a' }} onClick={markPaid} disabled={updating}>Mark as Paid</button>
            )}
            {invoice.status !== 'CANCELLED' && invoice.status !== 'PAID' && (
              <button style={{ ...actionBtn, background: '#6b7280' }} onClick={() => updateStatus('CANCELLED')} disabled={updating}>Cancel</button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function CreateInvoiceModal({ onClose, onCreated }) {
  const [serviceUsers, setServiceUsers] = useState([]);
  const [form, setForm] = useState({
    service_user_id: '', period_start: '', period_end: '',
    weeks: '', weekly_rate: '', created_by: '', notes: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/api/service-users').then((res) => setServiceUsers(res.data.service_users ?? [])).catch(() => {});
  }, []);

  function set(f, v) { setForm((p) => ({ ...p, [f]: v })); }

  const preview = form.weeks && form.weekly_rate
    ? Number(form.weeks) * Number(form.weekly_rate)
    : null;

  async function submit(e) {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      await api.post('/api/invoices', {
        service_user_id: parseInt(form.service_user_id, 10),
        period_start: form.period_start,
        period_end: form.period_end,
        weeks: parseFloat(form.weeks),
        weekly_rate: parseFloat(form.weekly_rate),
        created_by: form.created_by,
        notes: form.notes || undefined,
      });
      onCreated();
    } catch (err) {
      setError(err.response?.data?.message ?? 'Failed to create invoice');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={modalStyles.overlay} onClick={onClose}>
      <div style={modalStyles.box} onClick={(e) => e.stopPropagation()}>
        <div style={modalStyles.header}>
          <h2 style={modalStyles.title}>Create Invoice</h2>
          <button style={modalStyles.close} onClick={onClose}>×</button>
        </div>
        <form onSubmit={submit} style={modalStyles.body}>
          {error && <p style={{ color: '#dc2626', marginBottom: '1rem', fontSize: '0.9rem' }}>{error}</p>}
          <Field label="Service User" required>
            <select style={formStyles.input} value={form.service_user_id} onChange={(e) => set('service_user_id', e.target.value)} required>
              <option value="">Select service user...</option>
              {serviceUsers.map((u) => <option key={u.id} value={u.id}>{u.first_name} {u.last_name}</option>)}
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
            <Field label="Weeks" required>
              <input style={formStyles.input} type="number" step="0.5" min="0.5" value={form.weeks} onChange={(e) => set('weeks', e.target.value)} required />
            </Field>
            <Field label="Weekly Rate (£)" required>
              <input style={formStyles.input} type="number" step="0.01" min="0" value={form.weekly_rate} onChange={(e) => set('weekly_rate', e.target.value)} required />
            </Field>
          </div>
          {preview !== null && (
            <div style={{ marginBottom: '1rem', padding: '0.6rem 0.75rem', background: '#f0fdf4', borderRadius: '6px', fontSize: '0.9rem', color: '#16a34a', fontWeight: 600 }}>
              Total: {fmt(preview)}
            </div>
          )}
          <Field label="Created By" required>
            <input style={formStyles.input} value={form.created_by} onChange={(e) => set('created_by', e.target.value)} required />
          </Field>
          <Field label="Notes">
            <textarea style={{ ...formStyles.input, height: '60px', resize: 'vertical' }} value={form.notes} onChange={(e) => set('notes', e.target.value)} />
          </Field>
          <button style={formStyles.submit} type="submit" disabled={submitting}>
            {submitting ? 'Creating...' : 'Create Invoice'}
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
  summaryGrid: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem', marginBottom: '1.25rem' },
  card: { background: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '4px', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' },
  filterBar: { display: 'flex', gap: '0.5rem', marginBottom: '1.25rem', flexWrap: 'wrap' },
  filterBtn: { padding: '5px 14px', borderRadius: '20px', border: '1px solid #d1d5db', background: '#f9fafb', color: '#374151', fontSize: '0.85rem', cursor: 'pointer', fontWeight: 500 },
  filterBtnActive: { background: '#1a1a2e', color: '#fff', border: '1px solid #1a1a2e' },
  state: { color: '#6b7280', fontSize: '0.95rem' },
  tableWrap: { background: '#fff', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.07)', overflow: 'hidden' },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: { padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px', background: '#f9fafb', borderBottom: '1px solid #e5e7eb' },
  row: { cursor: 'pointer' },
  td: { padding: '0.75rem 1rem', fontSize: '0.9rem', color: '#374151', borderBottom: '1px solid #f3f4f6' },
  invNum: { fontWeight: 700, color: '#1a1a2e', fontFamily: 'monospace', fontSize: '0.85rem' },
  markPaidBtn: { padding: '4px 12px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: '5px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600 },
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
