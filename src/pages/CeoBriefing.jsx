import { useCallback, useEffect, useRef, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import api from '../services/api';

function getUserRole() {
  try { return JSON.parse(localStorage.getItem('user') || '{}').role ?? null; } catch { return null; }
}

const TODAY = new Date().toLocaleDateString('en-GB', {
  weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
});

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmtTime(d) {
  if (!d) return '';
  return new Date(d).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}
function fmtCurrency(n) {
  if (!n && n !== 0) return '—';
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 0 }).format(n);
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────
function Skeleton({ lines = 3 }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem' }}>
      {Array.from({ length: lines }).map((_, i) => (
        <div key={i} style={{ height: i === 0 ? 18 : 13, borderRadius: 4, background: '#e5e7eb', animation: 'pulse 1.4s ease-in-out infinite', opacity: 1 - i * 0.2 }} />
      ))}
    </div>
  );
}

function Spinner({ size = 16, colour = '#fff' }) {
  return (
    <span style={{ display: 'inline-block', width: size, height: size, border: `2px solid rgba(255,255,255,0.25)`, borderTopColor: colour, borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
  );
}

// ─── Data Panel wrapper ───────────────────────────────────────────────────────
function DataPanel({ title, icon, borderColour, children, loading }) {
  return (
    <div style={{ ...p.card, borderLeft: `4px solid ${borderColour}` }}>
      <div style={p.panelHeader}>
        <span style={p.panelIcon}>{icon}</span>
        <span style={{ ...p.panelTitle, color: borderColour }}>{title}</span>
      </div>
      {loading ? <Skeleton /> : <>{children}</>}
    </div>
  );
}

function StatRow({ label, value, colour }) {
  return (
    <div style={p.statRow}>
      <span style={p.statLabel}>{label}</span>
      <span style={{ ...p.statValue, color: colour ?? '#1a1a2e' }}>{value ?? '—'}</span>
    </div>
  );
}

function AllClear() {
  return <div style={p.allClear}>✅ All clear</div>;
}

// ─── Panel 1 — Urgent ────────────────────────────────────────────────────────
function UrgentPanel() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get('/api/tasks', { params: { priority: 'CRITICAL', status: 'PENDING' } }).catch(() => ({ data: { tasks: [] } })),
      api.get('/api/compliance', { params: { status: 'ACTION_REQUIRED' } }).catch(() => ({ data: { items: [] } })),
      api.get('/api/incidents', { params: { severity: 'CRITICAL', status: 'OPEN' } }).catch(() => ({ data: { incidents: [] } })),
    ]).then(([tasks, compliance, incidents]) => {
      setData({
        criticalTasks:     (tasks.data.tasks      ?? tasks.data.data      ?? []).length,
        complianceIssues:  (compliance.data.items ?? compliance.data.data ?? []).length,
        criticalIncidents: (incidents.data.incidents ?? incidents.data.data ?? []).length,
      });
    }).finally(() => setLoading(false));
  }, []);

  const navigate  = useNavigate();
  const allClear = data && data.criticalTasks === 0 && data.complianceIssues === 0 && data.criticalIncidents === 0;
  return (
    <DataPanel title="URGENT" icon="🔴" borderColour="#dc2626" loading={loading}>
      {allClear ? <AllClear /> : <>
        <StatRow label="Critical tasks"     value={data?.criticalTasks}     colour={data?.criticalTasks     > 0 ? '#dc2626' : '#166534'} />
        <StatRow label="Compliance actions" value={data?.complianceIssues}  colour={data?.complianceIssues  > 0 ? '#dc2626' : '#166534'} />
        <StatRow label="Critical incidents" value={data?.criticalIncidents} colour={data?.criticalIncidents > 0 ? '#dc2626' : '#166534'} />
      </>}
      {!loading && (
        <button
          onClick={() => navigate('/dashboard?filter=CRITICAL')}
          style={{ marginTop: '0.5rem', background: 'none', border: 'none', padding: 0, color: '#dc2626', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer', textAlign: 'left' }}
        >
          View all →
        </button>
      )}
    </DataPanel>
  );
}

// ─── Panel 2 — Operations ────────────────────────────────────────────────────
function OperationsPanel() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get('/api/service-users').catch(() => ({ data: { service_users: [] } })),
      api.get('/api/tasks/summary').catch(() => ({ data: { pending: 0 } })),
      api.get('/api/incidents').catch(() => ({ data: { incidents: [] } })),
    ]).then(([su, tasks, incidents]) => {
      const allSU  = su.data.service_users ?? su.data.data ?? [];
      const active = allSU.filter((u) => u.status === 'ACTIVE').length || allSU.length;
      const allInc = incidents.data.incidents ?? incidents.data.data ?? [];
      const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 7);
      setData({
        activeServiceUsers: active,
        pendingTasks: tasks.data.pending ?? tasks.data.total_pending ?? 0,
        weeklyIncidents: allInc.filter((i) => new Date(i.created_at ?? i.date) >= weekAgo).length,
      });
    }).finally(() => setLoading(false));
  }, []);

  return (
    <DataPanel title="OPERATIONS" icon="🔵" borderColour="#3b82f6" loading={loading}>
      <StatRow label="Service users active" value={data?.activeServiceUsers} />
      <StatRow label="Tasks pending"        value={data?.pendingTasks}       colour={data?.pendingTasks > 10 ? '#d97706' : undefined} />
      <StatRow label="Incidents this week"  value={data?.weeklyIncidents}    colour={data?.weeklyIncidents > 3 ? '#dc2626' : undefined} />
    </DataPanel>
  );
}

// ─── Panel 3 — People & HR ───────────────────────────────────────────────────
function PeoplePanel() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get('/api/training/overdue').catch(() => ({ data: { training: [] } })),
      api.get('/api/staff-documents/expiring').catch(() => ({ data: { documents: [] } })),
      api.get('/api/recruitment').catch(() => ({ data: { applications: [] } })),
      api.get('/api/rotas/current').catch(() => ({ data: { shifts: [] } })),
    ]).then(([training, docs, recruitment, rota]) => {
      const today  = new Date().toISOString().slice(0, 10);
      const shifts = rota.data.shifts ?? rota.data.data ?? [];
      const apps   = recruitment.data.applications ?? recruitment.data.data ?? [];
      setData({
        onDutyToday:      shifts.filter((s) => s.date === today && s.status === 'IN_PROGRESS').length,
        trainingOverdue:  (training.data.training ?? training.data.data ?? []).length,
        docsExpiring:     (docs.data.documents    ?? docs.data.data     ?? []).length,
        openApplications: apps.filter((a) => !['HIRED', 'REJECTED'].includes(a.status)).length,
      });
    }).finally(() => setLoading(false));
  }, []);

  return (
    <DataPanel title="PEOPLE & HR" icon="🟣" borderColour="#7c3aed" loading={loading}>
      <StatRow label="Staff on duty today"  value={data?.onDutyToday}       colour="#166534" />
      <StatRow label="Training overdue"     value={data?.trainingOverdue}   colour={data?.trainingOverdue > 0 ? '#d97706' : undefined} />
      <StatRow label="Docs expiring (30d)"  value={data?.docsExpiring}      colour={data?.docsExpiring    > 0 ? '#dc2626' : undefined} />
      <StatRow label="Open applications"    value={data?.openApplications} />
    </DataPanel>
  );
}

// ─── Panel 4 — Finance ───────────────────────────────────────────────────────
function FinancePanel() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get('/api/invoices').catch(() => ({ data: { invoices: [] } })),
      api.get('/api/payroll').catch(() => ({ data: { payroll: [] } })),
      api.get('/api/finance/summary').catch(() => ({ data: {} })),
    ]).then(([invoices, payroll, summary]) => {
      const allInv     = invoices.data.invoices ?? invoices.data.data ?? [];
      const outstanding = allInv.filter((i) => i.status !== 'PAID').reduce((s, i) => s + (i.amount ?? i.total ?? 0), 0);
      const pendingPay  = (payroll.data.payroll ?? payroll.data.data ?? []).filter((p) => p.status === 'PENDING').length;
      setData({
        outstanding,
        overdueInvoices: allInv.filter((i) => i.status === 'OVERDUE').length,
        payrollPending:  pendingPay,
        monthBalance:    summary.data.balance ?? summary.data.net_balance ?? null,
      });
    }).finally(() => setLoading(false));
  }, []);

  return (
    <DataPanel title="FINANCE" icon="🟢" borderColour="#16a34a" loading={loading}>
      <StatRow label="Outstanding"     value={fmtCurrency(data?.outstanding)}  colour={data?.outstanding > 5000 ? '#dc2626' : undefined} />
      <StatRow label="Overdue invoices" value={data?.overdueInvoices}           colour={data?.overdueInvoices > 0 ? '#dc2626' : undefined} />
      <StatRow label="Payroll pending"  value={data?.payrollPending}            colour={data?.payrollPending  > 0 ? '#d97706' : undefined} />
      {data?.monthBalance !== null && (
        <StatRow label="Month balance"  value={fmtCurrency(data?.monthBalance)} colour={data?.monthBalance >= 0 ? '#166534' : '#dc2626'} />
      )}
    </DataPanel>
  );
}

// ─── Panel 5 — Compliance ────────────────────────────────────────────────────
function CompliancePanel() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/api/compliance').catch(() => ({ data: { items: [] } }))
      .then((res) => {
        const items = res.data.items ?? res.data.data ?? [];
        const next  = [...items]
          .filter((i) => i.next_check_date ?? i.due_date)
          .sort((a, b) => new Date(a.next_check_date ?? a.due_date) - new Date(b.next_check_date ?? b.due_date))[0];
        setData({
          compliant: items.filter((i) => i.status === 'COMPLIANT').length,
          action:    items.filter((i) => i.status === 'ACTION_REQUIRED').length,
          upcoming:  items.filter((i) => i.status === 'UPCOMING').length,
          nextCheck: next?.next_check_date ?? next?.due_date ?? null,
        });
      }).finally(() => setLoading(false));
  }, []);

  return (
    <DataPanel title="COMPLIANCE" icon="🟠" borderColour="#d97706" loading={loading}>
      <StatRow label="Compliant"       value={data?.compliant} colour="#166534" />
      <StatRow label="Action required" value={data?.action}    colour={data?.action > 0 ? '#dc2626' : undefined} />
      <StatRow label="Upcoming"        value={data?.upcoming}  colour={data?.upcoming > 0 ? '#d97706' : undefined} />
      {data?.nextCheck && (
        <StatRow label="Next check" value={new Date(data.nextCheck).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })} />
      )}
    </DataPanel>
  );
}

// ─── Panel 6 — Digital Office ────────────────────────────────────────────────
const NOISE_PATTERNS = ['no-reply', 'noreply', 'newsletter', 'unsubscribe', 'donotreply', 'notification'];
const PRIORITY_SENDERS = ['cqc', 'nhs', 'local authority', 'council', 'ofsted', 'hmrc', 'family', 'parent', 'guardian'];

function DigitalOfficePanel() {
  const [calEvents, setCalEvents] = useState([]);
  const [emails, setEmails]       = useState([]);
  const [calConn, setCalConn]     = useState(true);
  const [gmailConn, setGmailConn] = useState(true);
  const [loading, setLoading]     = useState(true);

  useEffect(() => {
    Promise.all([
      api.get('/api/calendar/today')
        .then((r) => { setCalEvents(r.data.events ?? []); setCalConn(true); })
        .catch((e) => { if (e.response?.status !== 404) setCalConn(false); }),
      api.get('/api/gmail/messages')
        .then((r) => {
          const msgs = (r.data.messages ?? [])
            .filter((m) => {
              const text = `${m.from ?? ''} ${m.subject ?? ''}`.toLowerCase();
              return !NOISE_PATTERNS.some((n) => text.includes(n));
            })
            .slice(0, 6);
          setEmails(msgs);
          setGmailConn(true);
        })
        .catch((e) => { if (e.response?.status !== 404) setGmailConn(false); }),
    ]).finally(() => setLoading(false));
  }, []);

  function isPriority(msg) {
    const text = `${msg.from ?? ''} ${msg.subject ?? ''}`.toLowerCase();
    return PRIORITY_SENDERS.some((s) => text.includes(s));
  }

  async function connectGoogle(service) {
    try {
      const res = await api.get(`/api/${service}/auth`);
      if (res.data.url) window.location.href = res.data.url;
    } catch { alert('Connection unavailable.'); }
  }

  return (
    <DataPanel title="DIGITAL OFFICE" icon="💼" borderColour="#b45309" loading={loading}>
      <div style={p.subSection}>
        <div style={p.subLabel}>Today's Meetings</div>
        {!calConn
          ? <button style={p.connectBtn} onClick={() => connectGoogle('calendar')}>🔗 Connect Calendar</button>
          : calEvents.length === 0
            ? <div style={p.emptyNote}>No meetings today</div>
            : calEvents.slice(0, 3).map((ev, i) => (
                <div key={i} style={p.eventRow}>
                  <span style={p.eventTime}>{ev.time ?? ev.start ?? '—'}</span>
                  <span style={p.eventTitle}>{ev.title ?? ev.summary}</span>
                </div>
              ))
        }
      </div>
      <div style={p.subSection}>
        <div style={p.subLabel}>Priority Emails</div>
        {!gmailConn
          ? <button style={p.connectBtn} onClick={() => connectGoogle('gmail')}>🔗 Connect Gmail</button>
          : emails.length === 0
            ? <div style={p.emptyNote}>Inbox clear</div>
            : emails.slice(0, 4).map((msg, i) => (
                <div key={i} style={{ ...p.emailRow, ...(isPriority(msg) ? p.emailHighlight : {}) }}>
                  <span style={p.emailFrom}>{(msg.from ?? '').split('<')[0].trim() || 'Unknown'}</span>
                  <span style={p.emailSubject}>{msg.subject ?? '(no subject)'}</span>
                </div>
              ))
        }
      </div>
    </DataPanel>
  );
}

// ─── AI Narrative Panel ──────────────────────────────────────────────────────
function AnimDots() {
  return (
    <>
      {[0, 0.2, 0.4].map((delay, i) => (
        <span key={i} style={{ animation: 'pulse 1.2s ease-in-out infinite', animationDelay: `${delay}s` }}>.</span>
      ))}
    </>
  );
}

function AINarrativePanel({ briefing, loading, timestamp }) {
  if (loading) {
    return (
      <div style={n.wrap}>
        <div style={n.header}>
          <div style={n.title}>AI Executive Summary</div>
          <div style={n.sub}>Generating your briefing<AnimDots /></div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '0.5rem' }}>
          {[100, 88, 94, 72, 96, 80, 91, 65].map((w, i) => (
            <div key={i} style={{ height: 13, width: `${w}%`, borderRadius: 4, background: 'rgba(255,255,255,0.12)', animation: 'pulse 1.4s ease-in-out infinite', animationDelay: `${i * 0.1}s` }} />
          ))}
        </div>
      </div>
    );
  }

  if (!briefing) return null;

  const lines = briefing.split('\n');
  return (
    <div style={n.wrap}>
      <div style={n.header}>
        <div>
          <div style={n.title}>AI Executive Summary</div>
          <div style={n.sub}>Generated by Claude · {timestamp ? fmtTime(timestamp) : '—'}</div>
        </div>
        <button style={n.printBtn} onClick={() => window.print()}>🖨️ Print Briefing</button>
      </div>
      <div style={n.content}>
        {lines.map((line, i) => {
          const parts = line.split(/\*\*(.*?)\*\*/g);
          return (
            <span key={i}>
              {parts.map((part, j) => j % 2 === 1 ? <strong key={j}>{part}</strong> : part)}
              {i < lines.length - 1 && <br />}
            </span>
          );
        })}
      </div>
    </div>
  );
}

// ─── Quick Actions ────────────────────────────────────────────────────────────
function QuickActions({ onRefresh }) {
  const navigate = useNavigate();
  const [busy, setBusy] = useState({});

  async function run(key, fn) {
    setBusy((b) => ({ ...b, [key]: true }));
    try { await fn(); } catch { /* best effort */ }
    finally { setBusy((b) => ({ ...b, [key]: false })); }
  }

  const actions = [
    { key: 'invoices',  label: '💰 Chase Invoices',   fn: () => api.post('/api/automation/chase-invoice') },
    { key: 'report',    label: '📧 Weekly Report',     fn: () => api.post('/api/automation/send-report') },
    { key: 'tasks',     label: '📋 Critical Tasks',    fn: () => navigate('/') },
    { key: 'hr',        label: '👥 HR Summary',        fn: () => api.post('/api/ceo/command', { command: 'HR summary' }) },
    { key: 'calendar',  label: '📅 My Calendar',       fn: () => navigate('/ceo-office') },
    { key: 'refresh',   label: '🔄 Refresh Briefing',  fn: onRefresh },
  ];

  return (
    <div style={q.row}>
      {actions.map((a) => (
        <button
          key={a.key}
          style={{ ...q.btn, opacity: busy[a.key] ? 0.6 : 1 }}
          onClick={() => run(a.key, a.fn)}
          disabled={!!busy[a.key]}
        >
          {busy[a.key] ? <Spinner size={12} colour="#374151" /> : a.label}
        </button>
      ))}
    </div>
  );
}

// ─── Briefing History ────────────────────────────────────────────────────────
function BriefingHistory() {
  const [open, setOpen]       = useState(false);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState(null);

  async function load() {
    setLoading(true);
    try {
      const res = await api.get('/api/ceo/briefings');
      setHistory(res.data.briefings ?? res.data.data ?? []);
    } catch { setHistory([]); }
    finally { setLoading(false); }
  }

  function toggle() { if (!open) load(); setOpen((v) => !v); setSelected(null); }

  return (
    <div style={h.wrap}>
      <button style={h.toggle} onClick={toggle}>
        {open ? '▲' : '▼'} View Previous Briefings
      </button>
      {open && (
        <div style={h.panel}>
          {loading && <div style={h.msg}>Loading history…</div>}
          {!loading && history.length === 0 && <div style={h.msg}>No previous briefings found.</div>}
          {!loading && history.length > 0 && (
            <div style={{ display: 'flex', gap: '1rem' }}>
              <div style={h.list}>
                {history.map((b, i) => (
                  <button
                    key={i}
                    style={{ ...h.histItem, ...(selected === i ? h.histActive : {}) }}
                    onClick={() => setSelected(i)}
                  >
                    <div style={h.histDate}>{new Date(b.created_at).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}</div>
                    <div style={h.histTime}>{fmtTime(b.created_at)}</div>
                  </button>
                ))}
              </div>
              {selected !== null && history[selected] && (
                <div style={h.histContent}>
                  <div style={{ fontSize: '0.78rem', color: '#6b7280', marginBottom: '0.75rem' }}>
                    {new Date(history[selected].created_at).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                  </div>
                  <div style={{ fontSize: '0.87rem', color: '#374151', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
                    {history[selected].briefing ?? history[selected].content ?? '—'}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Overall Status ───────────────────────────────────────────────────────────
function deriveStatus(text) {
  if (!text) return null;
  const t = text.toLowerCase();
  if (t.includes('critical') || t.includes('overdue') || t.includes('urgent')) return 'RED';
  if (t.includes('action required') || t.includes('pending') || t.includes('warning')) return 'AMBER';
  return 'GREEN';
}
const STATUS_DEF = {
  GREEN: { label: '🟢 GREEN', bg: '#dcfce7', color: '#166534' },
  AMBER: { label: '🟡 AMBER', bg: '#fef3c7', color: '#92400e' },
  RED:   { label: '🔴 RED',   bg: '#fee2e2', color: '#991b1b' },
};

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function CeoBriefing() {
  if (getUserRole() !== 'ADMIN') return <Navigate to="/" replace />;

  const [briefing, setBriefing]     = useState('');
  const [bLoading, setBLoading]     = useState(true);
  const [bTime, setBTime]           = useState(null);
  const autoRan                     = useRef(false);

  const generate = useCallback(async () => {
    setBLoading(true);
    try {
      const res = await api.post('/api/ceo/briefing');
      setBriefing(res.data.briefing ?? res.data.answer ?? '');
      setBTime(new Date());
    } catch {
      setBriefing('⚠️ AI briefing unavailable. Please check the backend connection and try again.');
    } finally {
      setBLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!autoRan.current) { autoRan.current = true; generate(); }
  }, [generate]);

  const statusKey = deriveStatus(briefing);
  const statusDef = STATUS_DEF[statusKey];

  return (
    <div style={styles.page}>
      <style>{`
        @keyframes spin  { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%, 100% { opacity: 0.4; } 50% { opacity: 1; } }
        @media print { aside, button, .no-print { display: none !important; } }
      `}</style>

      {/* Hero */}
      <div style={styles.hero}>
        <div style={styles.heroLeft}>
          <h1 style={styles.heroTitle}>📊 CEO Morning Briefing</h1>
          <p style={styles.heroDate}>{TODAY}</p>
          <p style={styles.heroOrg}>Envico Supported Living LTD</p>
        </div>
        <div style={styles.heroRight}>
          {bTime && <div style={styles.lastGen}>Last generated: {fmtTime(bTime)}</div>}
          {statusDef && (
            <span style={{ ...styles.statusBadge, background: statusDef.bg, color: statusDef.color }}>
              {statusDef.label}
            </span>
          )}
          <button style={styles.generateBtn} onClick={generate} disabled={bLoading}>
            {bLoading ? <><Spinner size={14} colour="#fcd34d" /> &nbsp;Generating…</> : '✨ Generate Briefing'}
          </button>
        </div>
      </div>

      {/* Six panels */}
      <div style={styles.panelGrid}>
        <UrgentPanel />
        <OperationsPanel />
        <PeoplePanel />
        <FinancePanel />
        <CompliancePanel />
        <DigitalOfficePanel />
      </div>

      {/* AI Narrative */}
      <AINarrativePanel briefing={briefing} loading={bLoading} timestamp={bTime} />

      {/* Quick Actions */}
      <div style={styles.section}>
        <div style={styles.sectionLabel}>Quick Actions</div>
        <QuickActions onRefresh={generate} />
      </div>

      {/* History */}
      <BriefingHistory />
    </div>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = {
  page: { display: 'flex', flexDirection: 'column', gap: '1.25rem' },
  hero: {
    background: 'linear-gradient(135deg, #0f0f1e 0%, #1a1a2e 60%, #2d2d4e 100%)',
    borderRadius: '14px', padding: '1.75rem 2rem',
    display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
    flexWrap: 'wrap', gap: '1.25rem', boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
  },
  heroLeft:  { display: 'flex', flexDirection: 'column', gap: '0.3rem' },
  heroTitle: { margin: 0, fontSize: '1.5rem', fontWeight: 800, color: '#fff', letterSpacing: '-0.3px' },
  heroDate:  { margin: 0, fontSize: '0.88rem', color: '#8888bb' },
  heroOrg:   { margin: 0, fontSize: '0.78rem', color: '#5555aa', letterSpacing: '0.5px' },
  heroRight: { display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.6rem' },
  lastGen:   { fontSize: '0.75rem', color: '#6666aa' },
  statusBadge: { padding: '4px 14px', borderRadius: '20px', fontSize: '0.82rem', fontWeight: 700 },
  generateBtn: {
    padding: '0.6rem 1.4rem',
    background: 'rgba(217,119,6,0.2)', color: '#fcd34d',
    border: '1px solid rgba(217,119,6,0.5)', borderRadius: '8px',
    fontSize: '0.9rem', fontWeight: 700, cursor: 'pointer',
    display: 'flex', alignItems: 'center', gap: '0.4rem',
  },
  panelGrid: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' },
  section:   {
    background: '#fff', border: '1px solid #e5e7eb', borderRadius: '12px',
    padding: '1.25rem', boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
  },
  sectionLabel: {
    fontSize: '0.75rem', fontWeight: 700, color: '#6b7280',
    textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '0.75rem',
  },
};

const p = {
  card: {
    background: '#fff', borderRadius: '10px', padding: '1rem 1.1rem',
    boxShadow: '0 1px 4px rgba(0,0,0,0.06)', border: '1px solid #e5e7eb',
    display: 'flex', flexDirection: 'column', gap: '0.45rem',
  },
  panelHeader: { display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' },
  panelIcon:   { fontSize: '1rem', lineHeight: 1 },
  panelTitle:  { fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.8px' },
  statRow:     { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  statLabel:   { fontSize: '0.78rem', color: '#6b7280' },
  statValue:   { fontSize: '0.88rem', fontWeight: 700, color: '#1a1a2e' },
  allClear:    { fontSize: '0.85rem', color: '#166534', fontWeight: 600 },
  subSection:  { display: 'flex', flexDirection: 'column', gap: '0.25rem' },
  subLabel:    { fontSize: '0.68rem', fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.5px', marginTop: '0.3rem' },
  eventRow:    { display: 'flex', gap: '0.4rem', alignItems: 'baseline' },
  eventTime:   { fontSize: '0.7rem', color: '#d97706', fontWeight: 700, minWidth: '38px', whiteSpace: 'nowrap' },
  eventTitle:  { fontSize: '0.76rem', color: '#374151', lineHeight: 1.3 },
  emailRow:    { display: 'flex', flexDirection: 'column', padding: '3px 4px', borderRadius: '4px' },
  emailHighlight: { background: '#fef3c7', borderLeft: '3px solid #fbbf24', paddingLeft: '6px' },
  emailFrom:   { fontSize: '0.7rem', fontWeight: 700, color: '#1a1a2e', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  emailSubject:{ fontSize: '0.68rem', color: '#6b7280', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  connectBtn:  { padding: '4px 10px', background: '#4285f4', color: '#fff', border: 'none', borderRadius: '5px', fontSize: '0.75rem', cursor: 'pointer', fontWeight: 600, alignSelf: 'flex-start' },
  emptyNote:   { fontSize: '0.75rem', color: '#9ca3af', fontStyle: 'italic' },
};

const n = {
  wrap: {
    background: 'linear-gradient(135deg, #0f0f1e 0%, #1a1a2e 100%)',
    borderRadius: '12px', padding: '1.5rem 2rem',
    boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
  },
  header: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' },
  title:  { margin: 0, fontSize: '1rem', fontWeight: 800, color: '#fff' },
  sub:    { fontSize: '0.75rem', color: '#6666aa', marginTop: '3px' },
  printBtn: {
    padding: '5px 12px', background: 'rgba(255,255,255,0.08)',
    border: '1px solid rgba(255,255,255,0.15)', borderRadius: '6px',
    color: '#8888bb', fontSize: '0.8rem', cursor: 'pointer',
  },
  content: { fontSize: '0.9rem', lineHeight: 1.8, color: 'rgba(255,255,255,0.88)', whiteSpace: 'pre-wrap' },
};

const q = {
  row: { display: 'flex', gap: '0.6rem', flexWrap: 'wrap' },
  btn: {
    padding: '0.5rem 1rem', background: '#f9fafb', border: '1px solid #e5e7eb',
    borderRadius: '8px', fontSize: '0.85rem', cursor: 'pointer', color: '#374151',
    fontWeight: 500, display: 'flex', alignItems: 'center', gap: '0.3rem',
  },
};

const h = {
  wrap: {
    background: '#fff', border: '1px solid #e5e7eb', borderRadius: '12px',
    overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
  },
  toggle: {
    width: '100%', padding: '0.9rem 1.25rem', background: '#f9fafb',
    border: 'none', textAlign: 'left', fontSize: '0.88rem',
    fontWeight: 600, color: '#374151', cursor: 'pointer',
  },
  panel:   { padding: '1rem 1.25rem' },
  msg:     { fontSize: '0.85rem', color: '#9ca3af' },
  list:    { display: 'flex', flexDirection: 'column', gap: '0.4rem', minWidth: '150px' },
  histItem: {
    padding: '0.5rem 0.75rem', border: '1px solid #e5e7eb',
    borderRadius: '7px', background: '#f9fafb', cursor: 'pointer', textAlign: 'left',
  },
  histActive:  { background: '#eff6ff', border: '1px solid #93c5fd' },
  histDate:    { fontSize: '0.85rem', fontWeight: 600, color: '#1a1a2e' },
  histTime:    { fontSize: '0.72rem', color: '#9ca3af' },
  histContent: {
    flex: 1, padding: '0.75rem 1rem', background: '#f9fafb',
    borderRadius: '8px', border: '1px solid #e5e7eb',
    maxHeight: '300px', overflowY: 'auto',
  },
};
