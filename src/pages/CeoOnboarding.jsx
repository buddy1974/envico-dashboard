import { useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import api from '../services/api';

function getUserRole() {
  try {
    const stored = JSON.parse(localStorage.getItem('user') || '{}');
    if (stored.role) return stored.role;
    const token = localStorage.getItem('token');
    if (token) return JSON.parse(atob(token.split('.')[1])).role ?? null;
    return null;
  } catch { return null; }
}

// ─── Module definitions — all 16 ─────────────────────────────────────────────
const MODULES = [
  {
    to: '/dashboard',
    icon: '🏠',
    label: 'Task Dashboard',
    desc: 'Daily task management and critical alerts',
    phase: 1,
    color: '#3b82f6',
  },
  {
    to: '/rota',
    icon: '📅',
    label: 'Rota & Shifts',
    desc: 'Staff scheduling, clock-in and shift gaps',
    phase: 8,
    color: '#06b6d4',
  },
  {
    to: '/service-users',
    icon: '👥',
    label: 'Service Users',
    desc: 'Resident profiles, funding and care overview',
    phase: 2,
    color: '#3b82f6',
  },
  {
    to: '/incidents',
    icon: '🚨',
    label: 'Incidents',
    desc: 'Incident reporting, tracking and resolution',
    phase: 2,
    color: '#ef4444',
  },
  {
    to: '/medications',
    icon: '💊',
    label: 'Medications',
    desc: 'EMAR, MAR charts and medication records',
    phase: 2,
    color: '#3b82f6',
  },
  {
    to: '/care-plans',
    icon: '📋',
    label: 'Care Plans',
    desc: 'Person-centred care documentation and reviews',
    phase: 2,
    color: '#3b82f6',
  },
  {
    to: '/invoices',
    icon: '💰',
    label: 'Invoices',
    desc: 'Billing, invoice management and chase workflow',
    phase: 3,
    color: '#16a34a',
  },
  {
    to: '/payroll',
    icon: '🧾',
    label: 'Payroll',
    desc: 'Staff payroll preparation and approval',
    phase: 3,
    color: '#16a34a',
  },
  {
    to: '/finance',
    icon: '📊',
    label: 'Finance',
    desc: 'Transactions, income and financial overview',
    phase: 3,
    color: '#16a34a',
  },
  {
    to: '/training',
    icon: '📚',
    label: 'Training',
    desc: 'Staff training and Oliver McGowan compliance',
    phase: 4,
    color: '#d97706',
  },
  {
    to: '/recruitment',
    icon: '🧑',
    label: 'Recruitment',
    desc: 'Job applications pipeline and hiring workflow',
    phase: 4,
    color: '#d97706',
  },
  {
    to: '/compliance',
    icon: '✅',
    label: 'Compliance',
    desc: 'CQC compliance monitoring and action tracker',
    phase: 4,
    color: '#d97706',
  },
  {
    to: '/staff-docs',
    icon: '📄',
    label: 'Staff Documents',
    desc: 'DBS certificates and document expiry tracking',
    phase: 4,
    color: '#d97706',
  },
  {
    to: '/ceo-office',
    icon: '👔',
    label: 'CEO Office',
    desc: 'Gmail integration, Google Calendar and AI commands',
    phase: 7,
    color: '#b45309',
  },
  {
    to: '/assistant',
    icon: '🤖',
    label: 'AI Assistant',
    desc: 'Donna AI — natural language care queries powered by Claude',
    phase: 5,
    color: '#7c3aed',
  },
  {
    to: '/agents',
    icon: '⚡',
    label: 'Agents Monitor',
    desc: 'SYS.AGENTS — live terminal view of all automation agents',
    phase: 8,
    color: '#3ab54a',
  },
];

// ─── Status strip ─────────────────────────────────────────────────────────────
const METRIC_DEFS = [
  { id: 'tasks',      icon: '📌', label: 'Open Tasks',        color: '#3b82f6' },
  { id: 'referrals',  icon: '📥', label: 'Referrals',         color: '#7c3aed' },
  { id: 'compliance', icon: '✅', label: 'Compliance Due',     color: '#d97706' },
  { id: 'training',   icon: '📚', label: 'Training Overdue',  color: '#ef4444' },
];

// Wraps an api call with a 5-second hard timeout — always resolves, never hangs
function withTimeout(promise, ms = 5000) {
  const timer = new Promise((resolve) => setTimeout(() => resolve(null), ms));
  return Promise.race([promise.then((r) => r).catch(() => null), timer]);
}

async function fetchMetrics() {
  const [tasksRes, referralsRes, complianceRes, trainingRes] = await Promise.all([
    withTimeout(api.get('/api/tasks/summary')),
    withTimeout(api.get('/api/referrals')),
    withTimeout(api.get('/api/compliance')),
    withTimeout(api.get('/api/training/overdue')),
  ]);

  // tasks: { data: { open, total, count } } or { open, total }
  const tasks = (() => {
    if (!tasksRes) return '—';
    const d = tasksRes.data?.data ?? tasksRes.data ?? {};
    const v = d.open ?? d.total ?? d.count;
    return v != null ? v : '—';
  })();

  // referrals: array | { data: array } | { referrals: array } | { total }
  const referrals = (() => {
    if (!referralsRes) return '—';
    const raw = referralsRes.data;
    if (Array.isArray(raw)) return raw.length;
    if (Array.isArray(raw?.data)) return raw.data.length;
    if (Array.isArray(raw?.referrals)) return raw.referrals.length;
    const v = raw?.total ?? raw?.count;
    return v != null ? v : '—';
  })();

  // compliance: array of items — count DUE or OVERDUE
  const compliance = (() => {
    if (!complianceRes) return '—';
    const d = complianceRes.data?.data ?? complianceRes.data ?? [];
    const items = Array.isArray(d) ? d : [];
    return items.filter((i) => i.status === 'DUE' || i.status === 'OVERDUE').length;
  })();

  // training overdue: array | { data: array } | { total }
  const training = (() => {
    if (!trainingRes) return '—';
    const d = trainingRes.data?.data ?? trainingRes.data ?? [];
    if (Array.isArray(d)) return d.length;
    const v = d?.total ?? d?.count;
    return v != null ? v : '—';
  })();

  return { tasks, referrals, compliance, training };
}

function StatusStrip() {
  const EMPTY = { tasks: null, referrals: null, compliance: null, training: null };
  const [values, setValues] = useState(EMPTY);
  const [refreshing, setRefreshing] = useState(false);

  async function load() {
    setRefreshing(true);
    setValues(EMPTY);
    const result = await fetchMetrics();
    setValues(result);
    setRefreshing(false);
  }

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div>
      <div style={s.stripHeader}>
        <span style={s.stripLabel}>Live status</span>
        <button style={{ ...s.refreshBtn, opacity: refreshing ? 0.5 : 1 }} onClick={load} disabled={refreshing}>
          {refreshing ? '···' : '↻ Refresh'}
        </button>
      </div>
      <div style={s.strip}>
        {METRIC_DEFS.map((m) => {
          const val = values[m.id];
          return (
            <div key={m.id} style={s.metricCard}>
              <div style={s.metricTop}>
                <span style={s.metricIcon}>{m.icon}</span>
                <span style={{ ...s.metricDot, background: m.color }} />
              </div>
              <div style={{ ...s.metricVal, color: m.color }}>
                {val === null ? <span style={s.metricSpin}>···</span> : val}
              </div>
              <div style={s.metricLabel}>{m.label}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Module card ──────────────────────────────────────────────────────────────
function ModuleCard({ mod, onOpen }) {
  const [hover, setHover] = useState(false);
  return (
    <div
      style={{ ...s.modCard, ...(hover ? { ...s.modCardHover, borderColor: mod.color } : {}) }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <div style={s.modTop}>
        <span style={s.modIcon}>{mod.icon}</span>
        <span style={{ ...s.modPhase, color: mod.color, borderColor: mod.color }}>P{mod.phase}</span>
      </div>
      <div style={s.modName}>{mod.label}</div>
      <div style={s.modDesc}>{mod.desc}</div>
      <div style={s.modFooter}>
        <span style={s.modLive}>● LIVE</span>
        <button
          style={{ ...s.modBtn, background: mod.color }}
          onClick={() => onOpen(mod.to)}
        >
          Open
        </button>
      </div>
    </div>
  );
}

// ─── System Health row ────────────────────────────────────────────────────────
const HEALTH_PILLS = [
  { id: 'api', label: 'Backend API' },
  { id: 'db',  label: 'Database' },
  { id: 'n8n', label: 'n8n Automation' },
];

const STATUS_CONFIG = {
  ok:       { color: '#16a34a', bg: '#f0fdf4', border: '#86efac', text: 'OK' },
  error:    { color: '#dc2626', bg: '#fef2f2', border: '#fca5a5', text: 'ERROR' },
  unknown:  { color: '#d97706', bg: '#fffbeb', border: '#fde68a', text: 'UNKNOWN' },
  checking: { color: '#9ca3af', bg: '#f9fafb', border: '#e5e7eb', text: 'checking…' },
};

function SystemHealth() {
  const [status, setStatus] = useState({ api: 'checking', db: 'checking', n8n: 'checking' });

  useEffect(() => {
    // Backend API + DB — use the shared api instance (auth header included)
    api.get('/api/health')
      .then((res) => {
        setStatus((prev) => ({ ...prev, api: 'ok' }));
        // Infer DB status from health response body
        const d = res.data ?? {};
        const dbField = d.db ?? d.database ?? d.postgres ?? d.prisma;
        const dbOk = dbField != null
          ? ['ok', 'connected', 'up', 'healthy'].includes(String(dbField).toLowerCase())
          : (d.status === 'ok' || d.status === 'healthy' || res.status === 200);
        setStatus((prev) => ({ ...prev, db: dbOk ? 'ok' : 'error' }));
      })
      .catch(() => {
        setStatus((prev) => ({ ...prev, api: 'error', db: 'unknown' }));
      });

    // n8n — cross-origin, use no-cors so opaque response = reachable
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 5000);
    fetch('https://n8n.maxpromo.digital/healthz', { signal: ctrl.signal, mode: 'no-cors' })
      .then(() => setStatus((prev) => ({ ...prev, n8n: 'ok' })))
      .catch(() => setStatus((prev) => ({ ...prev, n8n: 'unknown' })))
      .finally(() => clearTimeout(timer));
  }, []);

  return (
    <div style={s.healthRow}>
      <span style={s.healthRowLabel}>System Health</span>
      <div style={s.healthPills}>
        {HEALTH_PILLS.map(({ id, label }) => {
          const cfg = STATUS_CONFIG[status[id]] ?? STATUS_CONFIG.checking;
          return (
            <div
              key={id}
              style={{ ...s.healthPill, background: cfg.bg, border: `1px solid ${cfg.border}` }}
            >
              <span style={{ ...s.healthDot, background: cfg.color }} />
              <span style={s.healthPillLabel}>{label}</span>
              <span style={{ ...s.healthPillStatus, color: cfg.color }}>{cfg.text}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Quick commands terminal ──────────────────────────────────────────────────
function QuickCommands({ onNavigate }) {
  const [active, setActive] = useState(null);

  const cmds = [
    { id: 'briefing',    label: '> get daily briefing',      to: '/ceo-office' },
    { id: 'agents',      label: '> open agents monitor',     to: '/agents' },
    { id: 'compliance',  label: '> view compliance status',  to: '/compliance' },
  ];

  function run(cmd) {
    setActive(cmd.id);
    setTimeout(() => {
      setActive(null);
      onNavigate(cmd.to);
    }, 500);
  }

  return (
    <div style={s.terminal}>
      {/* Chrome bar */}
      <div style={s.termChrome}>
        <div style={s.termDots}>
          <span style={{ ...s.termDot, background: '#ef4444' }} />
          <span style={{ ...s.termDot, background: '#f59e0b' }} />
          <span style={{ ...s.termDot, background: '#3ab54a' }} />
        </div>
        <span style={s.termTitle}>envico@careos — quick-commands</span>
        <span style={s.termLive}>● READY</span>
      </div>

      {/* Command buttons */}
      <div style={s.termBody}>
        <div style={s.termPromptLine}>
          <span style={s.termPs1}>CEO@envico:~$</span>
          <span style={s.termHint}>click a command to execute</span>
        </div>
        {cmds.map((cmd) => (
          <button
            key={cmd.id}
            style={{
              ...s.termCmd,
              ...(active === cmd.id ? s.termCmdActive : {}),
            }}
            onClick={() => run(cmd)}
          >
            <span style={s.termCmdText}>{cmd.label}</span>
            {active === cmd.id && <span style={s.termCmdRunning}>executing…</span>}
          </button>
        ))}
        <div style={s.termCursor}>
          <span style={s.termPs1}>CEO@envico:~$</span>
          <span style={s.termBlink}>▌</span>
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function CeoOnboarding() {
  if (getUserRole() !== 'ADMIN') return <Navigate to="/" replace />;

  const navigate = useNavigate();

  return (
    <div style={s.page}>

      {/* Terminal header bar */}
      <div style={s.header}>
        <div style={s.headerLeft}>
          <div style={s.headerDots}>
            <span style={{ ...s.hDot, background: '#ef4444' }} />
            <span style={{ ...s.hDot, background: '#f59e0b' }} />
            <span style={{ ...s.hDot, background: '#3ab54a' }} />
          </div>
          <div>
            <div style={s.headerTitle}>CareOS 2026 — System Overview</div>
            <div style={s.headerSub}>Welcome. Everything is running.</div>
          </div>
        </div>
        <div style={s.headerRight}>
          <span style={s.headerBadge}>16 MODULES</span>
          <span style={s.headerBadge}>ALL LIVE</span>
        </div>
      </div>

      {/* Section 1 — Status strip */}
      <StatusStrip />

      {/* Section 2 — Module grid */}
      <div style={s.section}>
        <div style={s.sectionHead}>
          <span style={s.sectionTitle}>All Modules</span>
          <span style={s.sectionSub}>8 phases · 16 modules · fully operational</span>
        </div>
        <div style={s.modGrid}>
          {MODULES.map((mod) => (
            <ModuleCard key={mod.to} mod={mod} onOpen={(to) => navigate(to)} />
          ))}
        </div>
      </div>

      {/* Section 3 — System Health */}
      <SystemHealth />

      {/* Section 4 — Quick commands */}
      <QuickCommands onNavigate={(to) => navigate(to)} />

    </div>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = {
  page: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1.25rem',
    maxWidth: '1100px',
  },

  // Header bar
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    background: '#0d1117',
    border: '1px solid #1e2d1e',
    borderRadius: '10px',
    padding: '1rem 1.25rem',
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '1rem',
  },
  headerDots: { display: 'flex', gap: '6px', alignItems: 'center' },
  hDot: { width: 11, height: 11, borderRadius: '50%' },
  headerTitle: {
    fontFamily: 'monospace',
    fontSize: '1rem',
    fontWeight: 700,
    color: '#3ab54a',
    letterSpacing: '0.04em',
  },
  headerSub: {
    fontFamily: 'monospace',
    fontSize: '0.72rem',
    color: '#4a7a50',
    marginTop: '2px',
    letterSpacing: '0.04em',
  },
  headerRight: {
    display: 'flex',
    gap: '0.5rem',
  },
  headerBadge: {
    fontFamily: 'monospace',
    fontSize: '0.68rem',
    letterSpacing: '0.1em',
    border: '1px solid #1e3320',
    borderRadius: '4px',
    padding: '3px 10px',
    color: '#3ab54a',
    background: 'rgba(58,181,74,0.08)',
  },

  // Status strip
  stripHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '0.5rem',
  },
  stripLabel: {
    fontSize: '0.72rem',
    fontWeight: 700,
    color: '#9ca3af',
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
  },
  refreshBtn: {
    fontFamily: 'monospace',
    fontSize: '0.72rem',
    letterSpacing: '0.06em',
    padding: '3px 12px',
    background: 'transparent',
    border: '1px solid #d1d5db',
    borderRadius: '5px',
    color: '#6b7280',
    cursor: 'pointer',
    transition: 'border-color 0.15s, color 0.15s',
  },
  strip: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: '0.75rem',
  },
  metricCard: {
    background: '#ffffff',
    border: '1px solid #e5e7eb',
    borderRadius: '10px',
    padding: '1rem 1.25rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.25rem',
  },
  metricTop: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  metricIcon: { fontSize: '1.3rem', lineHeight: 1 },
  metricDot: {
    width: 8,
    height: 8,
    borderRadius: '50%',
  },
  metricVal: {
    fontSize: '2rem',
    fontWeight: 800,
    lineHeight: 1.1,
    marginTop: '0.25rem',
  },
  metricSpin: {
    fontSize: '1.5rem',
    color: '#d1d5db',
    letterSpacing: '0.1em',
  },
  metricLabel: {
    fontSize: '0.78rem',
    color: '#9ca3af',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
  },

  // Module grid section
  section: {
    background: '#ffffff',
    border: '1px solid #e5e7eb',
    borderRadius: '12px',
    padding: '1.25rem',
  },
  sectionHead: {
    display: 'flex',
    alignItems: 'baseline',
    gap: '0.75rem',
    marginBottom: '1rem',
  },
  sectionTitle: {
    fontSize: '0.88rem',
    fontWeight: 800,
    color: '#111827',
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
  },
  sectionSub: {
    fontSize: '0.75rem',
    color: '#9ca3af',
    fontFamily: 'monospace',
  },
  modGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '0.75rem',
  },

  // Module card
  modCard: {
    background: '#f9fafb',
    border: '1px solid #e5e7eb',
    borderRadius: '9px',
    padding: '0.9rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.3rem',
    transition: 'border-color 0.15s, box-shadow 0.15s',
    cursor: 'default',
  },
  modCardHover: {
    background: '#fff',
    boxShadow: '0 2px 12px rgba(0,0,0,0.07)',
  },
  modTop: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '0.15rem',
  },
  modIcon: { fontSize: '1.35rem', lineHeight: 1 },
  modPhase: {
    fontFamily: 'monospace',
    fontSize: '0.65rem',
    fontWeight: 700,
    letterSpacing: '0.06em',
    border: '1px solid',
    borderRadius: '3px',
    padding: '1px 6px',
    background: 'transparent',
  },
  modName: {
    fontSize: '0.85rem',
    fontWeight: 700,
    color: '#111827',
  },
  modDesc: {
    fontSize: '0.72rem',
    color: '#9ca3af',
    lineHeight: 1.45,
    flex: 1,
  },
  modFooter: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: '0.4rem',
  },
  modLive: {
    fontFamily: 'monospace',
    fontSize: '0.65rem',
    color: '#16a34a',
    fontWeight: 700,
    letterSpacing: '0.06em',
  },
  modBtn: {
    padding: '3px 14px',
    color: '#fff',
    border: 'none',
    borderRadius: '5px',
    fontSize: '0.75rem',
    fontWeight: 700,
    cursor: 'pointer',
    letterSpacing: '0.02em',
  },

  // System health row
  healthRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '1rem',
    background: '#ffffff',
    border: '1px solid #e5e7eb',
    borderRadius: '10px',
    padding: '0.75rem 1.25rem',
  },
  healthRowLabel: {
    fontSize: '0.72rem',
    fontWeight: 700,
    color: '#9ca3af',
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    flexShrink: 0,
    minWidth: '90px',
  },
  healthPills: {
    display: 'flex',
    gap: '0.5rem',
    flexWrap: 'wrap',
  },
  healthPill: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.4rem',
    borderRadius: '20px',
    padding: '4px 12px',
  },
  healthDot: {
    width: 7,
    height: 7,
    borderRadius: '50%',
    flexShrink: 0,
  },
  healthPillLabel: {
    fontSize: '0.78rem',
    fontWeight: 600,
    color: '#374151',
  },
  healthPillStatus: {
    fontSize: '0.72rem',
    fontWeight: 700,
    letterSpacing: '0.04em',
  },

  // Terminal quick commands
  terminal: {
    background: '#050d05',
    border: '1px solid #1e3320',
    borderRadius: '10px',
    overflow: 'hidden',
    fontFamily: 'monospace',
  },
  termChrome: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    padding: '0.55rem 0.9rem',
    background: '#0d1b0d',
    borderBottom: '1px solid #1e3320',
  },
  termDots: { display: 'flex', gap: '6px', alignItems: 'center' },
  termDot: { width: 10, height: 10, borderRadius: '50%' },
  termTitle: {
    flex: 1,
    fontSize: '0.75rem',
    color: '#4a7a50',
    letterSpacing: '0.06em',
  },
  termLive: {
    fontSize: '0.72rem',
    color: '#3ab54a',
    letterSpacing: '0.08em',
  },
  termBody: {
    padding: '0.9rem 1rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.4rem',
  },
  termPromptLine: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    marginBottom: '0.25rem',
  },
  termPs1: {
    color: '#3ab54a',
    fontSize: '0.78rem',
    fontWeight: 700,
    letterSpacing: '0.04em',
  },
  termHint: {
    color: '#2d5e33',
    fontSize: '0.72rem',
  },
  termCmd: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0.55rem 0.9rem',
    background: '#0a160a',
    border: '1px solid #1e3320',
    borderRadius: '5px',
    cursor: 'pointer',
    transition: 'background 0.15s, border-color 0.15s',
    textAlign: 'left',
  },
  termCmdActive: {
    background: '#0d2210',
    borderColor: '#3ab54a',
  },
  termCmdText: {
    fontFamily: 'monospace',
    fontSize: '0.82rem',
    color: '#6ee77a',
    letterSpacing: '0.04em',
  },
  termCmdRunning: {
    fontFamily: 'monospace',
    fontSize: '0.72rem',
    color: '#3ab54a',
    letterSpacing: '0.06em',
    animation: 'none',
  },
  termCursor: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    marginTop: '0.15rem',
    padding: '0.3rem 0',
  },
  termBlink: {
    color: '#3ab54a',
    fontSize: '0.85rem',
  },
};
