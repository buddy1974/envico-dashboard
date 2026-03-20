import { useEffect, useState } from 'react';
import api from '../services/api';

const STATUS_COLORS = {
  DRAFT: '#9ca3af',
  ACTIVE: '#16a34a',
  UNDER_REVIEW: '#ea580c',
  ARCHIVED: '#dc2626',
};

export default function CarePlans() {
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [filterStatus, setFilterStatus] = useState('ALL');

  useEffect(() => { fetchPlans(); }, []);

  async function fetchPlans() {
    try {
      const res = await api.get('/api/care-plans');
      setPlans(res.data.care_plans ?? []);
    } catch (err) {
      setError(err.response?.data?.message ?? 'Failed to load care plans');
    } finally {
      setLoading(false);
    }
  }

  const filtered = filterStatus === 'ALL'
    ? plans
    : plans.filter((p) => p.status === filterStatus);

  return (
    <div>
      <div style={styles.pageHeader}>
        <div>
          <h1 style={styles.title}>Care Plans</h1>
          <p style={styles.subtitle}>{plans.length} total</p>
        </div>
        <button style={styles.createBtn} onClick={() => setShowCreate(true)}>+ New Care Plan</button>
      </div>

      <div style={styles.filterBar}>
        {['ALL', 'DRAFT', 'ACTIVE', 'UNDER_REVIEW', 'ARCHIVED'].map((s) => (
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
                {['Service User', 'Title', 'Status', 'Version', 'Review Date', 'Created By'].map((h) => (
                  <th key={h} style={styles.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={6} style={styles.empty}>No care plans found.</td></tr>
              )}
              {filtered.map((p) => (
                <tr key={p.id} style={styles.row} onClick={() => setSelected(p)}>
                  <td style={styles.td}>
                    <span style={styles.name}>
                      {p.service_user
                        ? `${p.service_user.first_name} ${p.service_user.last_name}`
                        : `User #${p.service_user_id}`}
                    </span>
                  </td>
                  <td style={styles.td}>{p.title}</td>
                  <td style={styles.td}><Badge value={p.status} colors={STATUS_COLORS} /></td>
                  <td style={styles.td}>v{p.version ?? 1}</td>
                  <td style={styles.td}>
                    {p.review_date
                      ? <ReviewDate date={p.review_date} />
                      : <span style={{ color: '#9ca3af' }}>—</span>}
                  </td>
                  <td style={styles.td}>{p.created_by}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selected && <CarePlanDetailModal plan={selected} onClose={() => setSelected(null)} onUpdated={fetchPlans} />}
      {showCreate && (
        <CreateCarePlanModal
          onClose={() => setShowCreate(false)}
          onCreated={() => { setShowCreate(false); fetchPlans(); }}
        />
      )}
    </div>
  );
}

function ReviewDate({ date }) {
  const d = new Date(date);
  const now = new Date();
  const daysUntil = Math.ceil((d - now) / 86400000);
  const color = daysUntil < 0 ? '#dc2626' : daysUntil < 14 ? '#ea580c' : '#374151';
  return (
    <span style={{ color, fontWeight: daysUntil < 14 ? 600 : 400 }}>
      {d.toLocaleDateString('en-GB')}
      {daysUntil < 0 && ' ⚠️'}
    </span>
  );
}

function CarePlanDetailModal({ plan, onClose, onUpdated }) {
  const [updating, setUpdating] = useState(false);
  const suName = plan.service_user
    ? `${plan.service_user.first_name} ${plan.service_user.last_name}`
    : `User #${plan.service_user_id}`;

  const goals = Array.isArray(plan.goals) ? plan.goals : [];

  async function updateStatus(status) {
    setUpdating(true);
    try {
      await api.patch(`/api/care-plans/${plan.id}`, { status });
      onUpdated();
      onClose();
    } catch {
      /* silent */
    } finally {
      setUpdating(false);
    }
  }

  return (
    <div style={modalStyles.overlay} onClick={onClose}>
      <div style={modalStyles.box} onClick={(e) => e.stopPropagation()}>
        <div style={modalStyles.header}>
          <div>
            <h2 style={modalStyles.title}>{plan.title}</h2>
            <span style={{ fontSize: '0.8rem', color: '#6b7280' }}>v{plan.version ?? 1}</span>
          </div>
          <button style={modalStyles.close} onClick={onClose}>×</button>
        </div>
        <div style={modalStyles.body}>
          <Row label="Service User" value={suName} />
          <Row label="Status" value={plan.status?.replace('_', ' ')} />
          <Row label="Created By" value={plan.created_by} />
          <Row label="Review Date" value={plan.review_date ? new Date(plan.review_date).toLocaleDateString('en-GB') : null} />
          <Row label="Description" value={plan.description} />

          {goals.length > 0 && (
            <div style={{ marginTop: '1rem' }}>
              <p style={{ fontSize: '0.83rem', fontWeight: 600, color: '#374151', marginBottom: '0.5rem' }}>Goals</p>
              <ul style={{ margin: 0, paddingLeft: '1.25rem' }}>
                {goals.map((g, i) => (
                  <li key={i} style={{ fontSize: '0.9rem', color: '#1f2937', marginBottom: '0.35rem' }}>
                    {typeof g === 'string' ? g : JSON.stringify(g)}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.25rem', flexWrap: 'wrap' }}>
            {plan.status === 'DRAFT' && (
              <button style={{ ...actionBtn, background: '#16a34a' }} onClick={() => updateStatus('ACTIVE')} disabled={updating}>
                Activate
              </button>
            )}
            {plan.status === 'ACTIVE' && (
              <button style={{ ...actionBtn, background: '#ea580c' }} onClick={() => updateStatus('UNDER_REVIEW')} disabled={updating}>
                Mark Under Review
              </button>
            )}
            {plan.status === 'UNDER_REVIEW' && (
              <button style={{ ...actionBtn, background: '#16a34a' }} onClick={() => updateStatus('ACTIVE')} disabled={updating}>
                Re-activate
              </button>
            )}
            {plan.status !== 'ARCHIVED' && (
              <button style={{ ...actionBtn, background: '#6b7280' }} onClick={() => updateStatus('ARCHIVED')} disabled={updating}>
                Archive
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function CreateCarePlanModal({ onClose, onCreated }) {
  const [serviceUsers, setServiceUsers] = useState([]);
  const [form, setForm] = useState({
    service_user_id: '',
    title: '', description: '', goals_raw: '',
    review_date: '', created_by: '',
    status: 'DRAFT',
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

    const goals = form.goals_raw
      .split('\n')
      .map((g) => g.trim())
      .filter(Boolean);

    try {
      await api.post('/api/care-plans', {
        service_user_id: parseInt(form.service_user_id, 10),
        title: form.title,
        description: form.description || undefined,
        goals,
        review_date: form.review_date || undefined,
        created_by: form.created_by,
        status: form.status,
      });
      onCreated();
    } catch (err) {
      setError(err.response?.data?.message ?? 'Failed to create care plan');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={modalStyles.overlay} onClick={onClose}>
      <div style={modalStyles.box} onClick={(e) => e.stopPropagation()}>
        <div style={modalStyles.header}>
          <h2 style={modalStyles.title}>New Care Plan</h2>
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
          <Field label="Title" required>
            <input style={formStyles.input} value={form.title} onChange={(e) => set('title', e.target.value)} required />
          </Field>
          <div style={formStyles.row}>
            <Field label="Status">
              <select style={formStyles.input} value={form.status} onChange={(e) => set('status', e.target.value)}>
                <option value="DRAFT">Draft</option>
                <option value="ACTIVE">Active</option>
              </select>
            </Field>
            <Field label="Review Date">
              <input style={formStyles.input} type="date" value={form.review_date} onChange={(e) => set('review_date', e.target.value)} />
            </Field>
          </div>
          <Field label="Created By" required>
            <input style={formStyles.input} value={form.created_by} onChange={(e) => set('created_by', e.target.value)} required />
          </Field>
          <Field label="Description">
            <textarea
              style={{ ...formStyles.input, height: '60px', resize: 'vertical' }}
              value={form.description}
              onChange={(e) => set('description', e.target.value)}
            />
          </Field>
          <Field label="Goals (one per line)">
            <textarea
              style={{ ...formStyles.input, height: '80px', resize: 'vertical' }}
              value={form.goals_raw}
              onChange={(e) => set('goals_raw', e.target.value)}
              placeholder="Improve mobility&#10;Maintain medication compliance&#10;..."
            />
          </Field>
          <button style={formStyles.submit} type="submit" disabled={submitting}>
            {submitting ? 'Creating...' : 'Create Care Plan'}
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

const actionBtn = { padding: '0.5rem 1.1rem', border: 'none', borderRadius: '6px', color: '#fff', cursor: 'pointer', fontSize: '0.88rem', fontWeight: 600 };

const styles = {
  pageHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' },
  title: { margin: '0 0 0.25rem', fontSize: '1.4rem', fontWeight: 700, color: '#1a1a2e' },
  subtitle: { margin: 0, fontSize: '0.85rem', color: '#6b7280' },
  createBtn: { background: '#1a1a2e', color: '#fff', border: 'none', borderRadius: '6px', padding: '0.6rem 1.1rem', cursor: 'pointer', fontSize: '0.9rem', fontWeight: 600 },
  filterBar: { display: 'flex', gap: '0.5rem', marginBottom: '1.25rem', flexWrap: 'wrap' },
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
  box: { background: '#fff', borderRadius: '10px', width: '540px', maxWidth: '95vw', maxHeight: '85vh', overflowY: 'auto', boxShadow: '0 8px 32px rgba(0,0,0,0.18)' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.25rem 1.5rem', borderBottom: '1px solid #e5e7eb' },
  title: { margin: '0 0 0.15rem', fontSize: '1.1rem', fontWeight: 700, color: '#1a1a2e' },
  close: { background: 'transparent', border: 'none', fontSize: '1.4rem', cursor: 'pointer', color: '#9ca3af', lineHeight: 1 },
  body: { padding: '1.5rem' },
};

const formStyles = {
  row: { display: 'flex', gap: '1rem' },
  label: { display: 'block', fontSize: '0.83rem', fontWeight: 600, color: '#374151', marginBottom: '0.35rem' },
  input: { width: '100%', padding: '0.55rem 0.75rem', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '0.9rem', boxSizing: 'border-box' },
  submit: { width: '100%', padding: '0.7rem', background: '#1a1a2e', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '0.95rem', fontWeight: 600, cursor: 'pointer', marginTop: '0.5rem' },
};
