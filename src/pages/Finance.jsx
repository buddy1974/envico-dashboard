import { useEffect, useState } from 'react';
import api from '../services/api';

const CATEGORIES = ['CARE_FEES', 'STAFF_WAGES', 'UTILITIES', 'SUPPLIES', 'TRANSPORT', 'TRAINING', 'OTHER'];

function fmt(n) {
  return `£${Number(n ?? 0).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function Finance() {
  const [transactions, setTransactions] = useState([]);
  const [summary, setSummary] = useState({ total_income: 0, total_expenses: 0, net: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('ALL');
  const [showAdd, setShowAdd] = useState(false);

  useEffect(() => { fetchAll(); }, []);

  async function fetchAll() {
    try {
      const [txRes, sumRes] = await Promise.all([
        api.get('/api/finance/transactions'),
        api.get('/api/finance/summary'),
      ]);
      setTransactions(txRes.data.transactions ?? []);
      setSummary(sumRes.data.summary ?? {});
    } catch (err) {
      setError(err.response?.data?.message ?? 'Failed to load finance data');
    } finally {
      setLoading(false);
    }
  }

  const filtered = filter === 'ALL'
    ? transactions
    : transactions.filter((t) => t.type === filter);

  const netColor = summary.net >= 0 ? '#16a34a' : '#dc2626';

  return (
    <div>
      <div style={styles.pageHeader}>
        <div>
          <h1 style={styles.title}>Finance</h1>
          <p style={styles.subtitle}>{transactions.length} transactions</p>
        </div>
        <button style={styles.createBtn} onClick={() => setShowAdd(true)}>+ Add Transaction</button>
      </div>

      <div style={styles.summaryGrid}>
        <SummaryCard label="Total Income" value={fmt(summary.total_income)} color="#16a34a" accent="#f0fdf4" />
        <SummaryCard label="Total Expenses" value={fmt(summary.total_expenses)} color="#dc2626" accent="#fef2f2" />
        <SummaryCard label="Net Position" value={fmt(summary.net)} color={netColor} accent={summary.net >= 0 ? '#f0fdf4' : '#fef2f2'} />
      </div>

      <div style={styles.filterBar}>
        {['ALL', 'INCOME', 'EXPENSE'].map((f) => (
          <button
            key={f}
            style={{ ...styles.filterBtn, ...(filter === f ? styles.filterBtnActive : {}) }}
            onClick={() => setFilter(f)}
          >
            {f === 'ALL' ? 'All' : f.charAt(0) + f.slice(1).toLowerCase()}
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
                {['Date', 'Description', 'Category', 'Type', 'Amount', 'Recorded By'].map((h) => (
                  <th key={h} style={styles.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={6} style={styles.empty}>No transactions found.</td></tr>
              )}
              {filtered.map((tx) => (
                <tr key={tx.id} style={styles.row}>
                  <td style={styles.td}>
                    {tx.transaction_date ? new Date(tx.transaction_date).toLocaleDateString('en-GB') : '—'}
                  </td>
                  <td style={styles.td}>
                    <span style={styles.desc}>{tx.description}</span>
                    {tx.reference && <span style={styles.ref}> · {tx.reference}</span>}
                  </td>
                  <td style={styles.td}>
                    <span style={styles.cat}>{tx.category?.replace('_', ' ') ?? '—'}</span>
                  </td>
                  <td style={styles.td}>
                    <span style={{
                      display: 'inline-block', padding: '2px 10px', borderRadius: '12px',
                      fontSize: '0.78rem', fontWeight: 600,
                      background: tx.type === 'INCOME' ? '#f0fdf422' : '#fef2f222',
                      color: tx.type === 'INCOME' ? '#16a34a' : '#dc2626',
                      border: `1px solid ${tx.type === 'INCOME' ? '#16a34a44' : '#dc262644'}`,
                    }}>
                      {tx.type === 'INCOME' ? '↑ Income' : '↓ Expense'}
                    </span>
                  </td>
                  <td style={styles.td}>
                    <strong style={{ color: tx.type === 'INCOME' ? '#16a34a' : '#dc2626' }}>
                      {tx.type === 'EXPENSE' ? '−' : '+'}{fmt(tx.amount)}
                    </strong>
                  </td>
                  <td style={styles.td}>{tx.recorded_by ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showAdd && (
        <AddTransactionModal onClose={() => setShowAdd(false)} onCreated={() => { setShowAdd(false); fetchAll(); }} />
      )}
    </div>
  );
}

function SummaryCard({ label, value, color, accent }) {
  return (
    <div style={{ ...styles.card, background: accent }}>
      <span style={{ fontSize: '1.5rem', fontWeight: 700, color, lineHeight: 1 }}>{value}</span>
      <span style={{ fontSize: '0.75rem', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 500 }}>{label}</span>
    </div>
  );
}

function AddTransactionModal({ onClose, onCreated }) {
  const [form, setForm] = useState({
    type: 'INCOME', category: 'CARE_FEES',
    amount: '', description: '', reference: '',
    transaction_date: new Date().toISOString().split('T')[0],
    recorded_by: '', notes: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  function set(f, v) { setForm((p) => ({ ...p, [f]: v })); }

  async function submit(e) {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      await api.post('/api/finance/transactions', {
        type: form.type,
        category: form.category,
        amount: parseFloat(form.amount),
        description: form.description,
        reference: form.reference || undefined,
        transaction_date: form.transaction_date,
        recorded_by: form.recorded_by,
        notes: form.notes || undefined,
      });
      onCreated();
    } catch (err) {
      setError(err.response?.data?.message ?? 'Failed to add transaction');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={modalStyles.overlay} onClick={onClose}>
      <div style={modalStyles.box} onClick={(e) => e.stopPropagation()}>
        <div style={modalStyles.header}>
          <h2 style={modalStyles.title}>Add Transaction</h2>
          <button style={modalStyles.close} onClick={onClose}>×</button>
        </div>
        <form onSubmit={submit} style={modalStyles.body}>
          {error && <p style={{ color: '#dc2626', marginBottom: '1rem', fontSize: '0.9rem' }}>{error}</p>}

          <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.25rem' }}>
            {['INCOME', 'EXPENSE'].map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => set('type', t)}
                style={{
                  flex: 1, padding: '0.6rem', border: '2px solid',
                  borderColor: form.type === t ? (t === 'INCOME' ? '#16a34a' : '#dc2626') : '#e5e7eb',
                  borderRadius: '6px', cursor: 'pointer', fontWeight: 600, fontSize: '0.9rem',
                  background: form.type === t ? (t === 'INCOME' ? '#f0fdf4' : '#fef2f2') : '#fff',
                  color: form.type === t ? (t === 'INCOME' ? '#16a34a' : '#dc2626') : '#6b7280',
                }}
              >
                {t === 'INCOME' ? '↑ Income' : '↓ Expense'}
              </button>
            ))}
          </div>

          <div style={formStyles.row}>
            <Field label="Category" required>
              <select style={formStyles.input} value={form.category} onChange={(e) => set('category', e.target.value)}>
                {CATEGORIES.map((c) => <option key={c} value={c}>{c.replace('_', ' ')}</option>)}
              </select>
            </Field>
            <Field label="Amount (£)" required>
              <input style={formStyles.input} type="number" step="0.01" min="0" value={form.amount} onChange={(e) => set('amount', e.target.value)} required />
            </Field>
          </div>
          <Field label="Description" required>
            <input style={formStyles.input} value={form.description} onChange={(e) => set('description', e.target.value)} required />
          </Field>
          <div style={formStyles.row}>
            <Field label="Date" required>
              <input style={formStyles.input} type="date" value={form.transaction_date} onChange={(e) => set('transaction_date', e.target.value)} required />
            </Field>
            <Field label="Reference">
              <input style={formStyles.input} value={form.reference} onChange={(e) => set('reference', e.target.value)} placeholder="e.g. INV-2026-1234" />
            </Field>
          </div>
          <Field label="Recorded By" required>
            <input style={formStyles.input} value={form.recorded_by} onChange={(e) => set('recorded_by', e.target.value)} required />
          </Field>
          <button style={formStyles.submit} type="submit" disabled={submitting}>
            {submitting ? 'Adding...' : 'Add Transaction'}
          </button>
        </form>
      </div>
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
  pageHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem' },
  title: { margin: '0 0 0.25rem', fontSize: '1.4rem', fontWeight: 700, color: '#1a1a2e' },
  subtitle: { margin: 0, fontSize: '0.85rem', color: '#6b7280' },
  createBtn: { background: '#1a1a2e', color: '#fff', border: 'none', borderRadius: '6px', padding: '0.6rem 1.1rem', cursor: 'pointer', fontSize: '0.9rem', fontWeight: 600 },
  summaryGrid: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem', marginBottom: '1.25rem' },
  card: { border: '1px solid #e5e7eb', borderRadius: '8px', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '4px', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' },
  filterBar: { display: 'flex', gap: '0.5rem', marginBottom: '1.25rem' },
  filterBtn: { padding: '5px 14px', borderRadius: '20px', border: '1px solid #d1d5db', background: '#f9fafb', color: '#374151', fontSize: '0.85rem', cursor: 'pointer', fontWeight: 500 },
  filterBtnActive: { background: '#1a1a2e', color: '#fff', border: '1px solid #1a1a2e' },
  state: { color: '#6b7280', fontSize: '0.95rem' },
  tableWrap: { background: '#fff', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.07)', overflow: 'hidden' },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: { padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px', background: '#f9fafb', borderBottom: '1px solid #e5e7eb' },
  row: {},
  td: { padding: '0.75rem 1rem', fontSize: '0.9rem', color: '#374151', borderBottom: '1px solid #f3f4f6' },
  desc: { fontWeight: 500, color: '#1a1a2e' },
  ref: { color: '#9ca3af', fontSize: '0.82rem' },
  cat: { fontSize: '0.82rem', color: '#6b7280', background: '#f3f4f6', padding: '2px 8px', borderRadius: '4px' },
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
