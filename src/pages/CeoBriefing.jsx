import { useEffect, useState, useCallback } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import api from '../services/api';

function getUserRole() {
  try { return JSON.parse(localStorage.getItem('user') || '{}').role ?? null; } catch { return null; }
}

const TODAY_LABEL = new Date().toLocaleDateString('en-GB', {
  weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
});

// ─── Spinner ──────────────────────────────────────────────────────────────────
function Spinner({ size = 16, colour = '#d97706' }) {
  return (
    <span style={{
      display: 'inline-block', width: size, height: size,
      border: '2px solid rgba(255,255,255,0.2)', borderTopColor: colour,
      borderRadius: '50%', animation: 'spin 0.7s linear infinite', flexShrink: 0,
    }} />
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────
function Skeleton({ lines = 5 }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
      {Array.from({ length: lines }).map((_, i) => (
        <div key={i} style={{
          height: '14px', borderRadius: '6px',
          background: 'linear-gradient(90deg, #1e2a3a 25%, #2a3a4e 50%, #1e2a3a 75%)',
          backgroundSize: '200% 100%',
          animation: 'shimmer 1.5s infinite',
          width: i % 3 === 2 ? '65%' : '100%',
        }} />
      ))}
    </div>
  );
}

// ─── AI text renderer (bold + line breaks) ───────────────────────────────────
function RenderAI({ text }) {
  if (!text) return null;
  return (
    <div style={{ lineHeight: 1.7, color: '#cbd5e1', fontSize: '0.93rem' }}>
      {text.split('\n').map((line, i, arr) => {
        const parts = line.split(/\*\*(.*?)\*\*/g);
        return (
          <span key={i}>
            {parts.map((p, j) => j % 2 === 1
              ? <strong key={j} style={{ color: '#f1f5f9' }}>{p}</strong>
              : p
            )}
            {i < arr.length - 1 && <br />}
          </span>
        );
      })}
    </div>
  );
}

// ─── Status badge ─────────────────────────────────────────────────────────────
function StatusBadge({ urgent, amber }) {
  if (urgent > 0) return <span style={badge('🔴', '#dc2626', '#450a0a')}>🔴 RED — Action Required</span>;
  if (amber  > 0) return <span style={badge('🟡', '#d97706', '#451a03')}>🟡 AMBER — Review Needed</span>;
  return                  <span style={badge('🟢', '#16a34a', '#052e16')}>🟢 GREEN — All Clear</span>;
}
function badge(_, text, bg) {
  return {
    padding: '0.3rem 0.85rem', borderRadius: '20px', fontSize: '0.78rem',
    fontWeight: 700, background: bg, color: text, border: `1px solid ${text}40`,
  };
}

// ─── Panel wrapper ────────────────────────────────────────────────────────────
function Panel({ title, colour, children, loading }) {
  return (
    <div style={{ ...styles.panel, borderLeftColor: colour }}>
      <div style={{ ...styles.panelTitle, color: colour }}>{title}</div>
      {loading ? (
        <div style={{ padding: '0.5rem 0' }}>
          {[80, 60, 70].map((w, i) => (
            <div key={i} style={{
              height: '12px', borderRadius: '4px', marginBottom: '0.5rem',
              background: '#e5e7eb', width: `${w}%`, animation: 'shimmer 1.5s infinite',
            }} />
          ))}
        </div>
      ) : children}
    </div>
  );
}

// ─── Stat row ─────────────────────────────────────────────────────────────────
function Stat({ label, value, colour = '#1e293b', warn = false }) {
  return (
    <div style={styles.statRow}>
      <span style={styles.statLabel}>{label}</span>
      <span style={{ ...styles.statValue, color: warn ? '#dc2626' : colour }}>{value}</span>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function CeoBriefing() {
  const role     = getUserRole();
  const navigate = useNavigate();
  if (role !== 'ADMIN') return <Navigate to="/" replace />;

  // panel data
  const [urgent,     setUrgent]     = useState(null);
  const [ops,        setOps]        = useState(null);
  const [people,     setPeople]     = useState(null);
  const [finance,    setFinance]    = useState(null);
  const [compliance, setCompliance] = useState(null);
  const [digital,    setDigital]    = useState(null);

  // AI briefing
  const [briefing,      setBriefing]      = useState('');
  const [briefingTime,  setBriefingTime]  = useState('');
  const [briefingLoading, setBriefingLoading] = useState(false);
  const [briefingError,   setBriefingError]   = useState('');

  // history
  const [historyOpen,    setHistoryOpen]    = useState(false);
  const [briefingHistory, setBriefingHistory] = useState([]);

  // ── fetch panel data ──────────────────────────────────────────────────────
  async function safe(fn) {
    try { return await fn(); } catch { return null; }
  }

  const loadPanels = useCallback(async () => {
    // URGENT
    safe(async () => {
      const [tasks, incidents] = await Promise.allSettled([
        api.get('/api/tasks?priority=CRITICAL&status=PENDING'),
        api.get('/api/incidents?severity=CRITICAL&status=OPEN'),
      ]);
      const critTasks     = tasks.status     === 'fulfilled' ? (tasks.value.data.tasks     ?? []).length : 0;
      const critIncidents = incidents.status === 'fulfilled' ? (incidents.value.data.data  ?? []).length : 0;
      setUrgent({ critTasks, critIncidents, total: critTasks + critIncidents });
    });

    // OPERATIONS
    safe(async () => {
      const [su, taskSum] = await Promise.allSettled([
        api.get('/api/service-users'),
        api.get('/api/tasks?limit=1'),
      ]);
      const serviceUsers  = su.status      === 'fulfilled' ? (su.value.data.data          ?? su.value.data.serviceUsers ?? []).length : '—';
      const tasksPending  = taskSum.status === 'fulfilled' ? (taskSum.value.data.pending  ?? taskSum.value.data.total    ?? '—') : '—';
      setOps({ serviceUsers, tasksPending });
    });

    // PEOPLE
    safe(async () => {
      const [training, docs, rota] = await Promise.allSettled([
        api.get('/api/training?status=OVERDUE'),
        api.get('/api/staff-documents?status=EXPIRING_SOON'),
        api.get('/api/rotas/current'),
      ]);
      const overdueTraining = training.status === 'fulfilled' ? (training.value.data.data ?? []).length : '—';
      const expiringDocs    = docs.status     === 'fulfilled' ? (docs.value.data.data     ?? []).length : '—';
      const staffOnDuty     = rota.status     === 'fulfilled' ? (rota.value.data.data?.shifts ?? []).filter(s => s.status === 'IN_PROGRESS').length : '—';
      setPeople({ overdueTraining, expiringDocs, staffOnDuty });
    });

    // FINANCE
    safe(async () => {
      const [inv, payroll] = await Promise.allSettled([
        api.get('/api/invoices?status=OVERDUE'),
        api.get('/api/payroll?status=PENDING'),
      ]);
      const overdueInvoices  = inv.status    === 'fulfilled' ? (inv.value.data.data    ?? []) : [];
      const payrollPending   = payroll.status === 'fulfilled' ? (payroll.value.data.data ?? []).length : '—';
      const outstanding = overdueInvoices.reduce((sum, inv) => sum + (Number(inv.amount) || 0), 0);
      setFinance({ outstanding, overdueCount: overdueInvoices.length, payrollPending });
    });

    // COMPLIANCE
    safe(async () => {
      const res = await api.get('/api/compliance');
      const items        = res.data.data ?? [];
      const actionNeeded = items.filter(i => i.status === 'ACTION_REQUIRED').length;
      const compliant    = items.filter(i => i.status === 'COMPLIANT').length;
      const nextCheck    = items.find(i => i.next_review_date)?.next_review_date;
      setCompliance({ actionNeeded, compliant, total: items.length, nextCheck });
    });

    // DIGITAL OFFICE
    safe(async () => {
      const [cal, gmail] = await Promise.allSettled([
        api.get('/api/calendar/today'),
        api.get('/api/gmail/messages?maxResults=20'),
      ]);
      const events   = cal.status   === 'fulfilled' ? (cal.value.data.events   ?? []) : null;
      const messages = gmail.status === 'fulfilled' ? (gmail.value.data.messages ?? []) : null;

      const NOISE = ['noreply', 'no-reply', 'mailer-daemon', 'newsletter', 'unsubscribe', 'donotreply'];
      const PRIORITY_SENDERS = ['cqc', 'nhs', 'local authority', 'council', 'ofsted', 'hmrc', 'envicosl'];

      const filteredEmails = (messages ?? []).filter(m => {
        const from    = (m.from ?? '').toLowerCase();
        const subject = (m.subject ?? '').toLowerCase();
        const isNoise = NOISE.some(n => from.includes(n) || subject.includes(n));
        return !isNoise;
      }).slice(0, 5);

      const priorityEmails = filteredEmails.filter(m => {
        const from    = (m.from ?? '').toLowerCase();
        const subject = (m.subject ?? '').toLowerCase();
        return PRIORITY_SENDERS.some(p => from.includes(p) || subject.includes(p));
      });

      setDigital({
        connected:     events !== null,
        events:        (events ?? []).slice(0, 4),
        emails:        filteredEmails,
        priorityCount: priorityEmails.length,
      });
    });
  }, []);

  // ── AI briefing ───────────────────────────────────────────────────────────
  const generateBriefing = useCallback(async () => {
    setBriefingLoading(true);
    setBriefingError('');
    try {
      const res = await api.post('/api/ceo/briefing');
      const text = res.data.briefing ?? res.data.answer ?? '';
      setBriefing(text);
      const ts = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
      setBriefingTime(ts);
      // store in history
      setBriefingHistory(prev => [{ text, time: ts, date: new Date().toLocaleDateString('en-GB') }, ...prev].slice(0, 7));
    } catch (err) {
      setBriefingError(err.response?.data?.error ?? 'Briefing unavailable — check API connection');
    } finally {
      setBriefingLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPanels();
    generateBriefing();
  }, []);

  // ── derived status ────────────────────────────────────────────────────────
  const urgentCount = urgent?.total ?? 0;
  const amberCount  = (people?.overdueTraining > 0 ? 1 : 0) + (finance?.overdueCount > 0 ? 1 : 0) + (compliance?.actionNeeded > 0 ? 1 : 0);

  return (
    <div style={styles.page}>
      <style>{`
        @keyframes spin    { to { transform: rotate(360deg); } }
        @keyframes shimmer { 0%,100% { opacity: 1; } 50% { opacity: 0.4; } }
        @media print {
          .no-print { display: none !important; }
          .print-full { width: 100% !important; }
        }
        @media (max-width: 900px) {
          .grid-panels { grid-template-columns: 1fr 1fr !important; }
        }
        @media (max-width: 600px) {
          .grid-panels { grid-template-columns: 1fr !important; }
          .actions-row { flex-wrap: wrap !important; }
        }
      `}</style>

      {/* ── SECTION 1: Hero Header ─────────────────────────────────────── */}
      <div style={styles.hero}>
        <div style={styles.heroLeft}>
          <div style={styles.heroTitle}>📊 CEO Morning Briefing</div>
          <div style={styles.heroDate}>{TODAY_LABEL}</div>
          <div style={styles.heroCompany}>Envico Supported Living Ltd</div>
        </div>
        <div style={styles.heroRight}>
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            <StatusBadge urgent={urgentCount} amber={amberCount} />
            <button
              className="no-print"
              style={styles.generateBtn}
              onClick={() => { loadPanels(); generateBriefing(); }}
              disabled={briefingLoading}
            >
              {briefingLoading ? <><Spinner size={13} colour="#92400e" />&nbsp;Generating...</> : '✨ Generate Briefing'}
            </button>
            <button
              className="no-print"
              style={styles.printBtn}
              onClick={() => window.print()}
            >
              🖨️ Print
            </button>
          </div>
          {briefingTime && (
            <div style={styles.lastGen}>Last generated: {briefingTime}</div>
          )}
        </div>
      </div>

      {/* ── SECTION 2: Six Data Panels ────────────────────────────────── */}
      <div className="grid-panels" style={styles.panelGrid}>

        {/* PANEL 1 — URGENT */}
        <Panel title="🔴 URGENT" colour="#dc2626" loading={urgent === null}>
          {urgent && urgent.total === 0 ? (
            <div style={styles.allClear}>✅ All clear — no urgent items</div>
          ) : urgent && (
            <>
              {urgent.critTasks > 0    && <Stat label="Critical tasks"     value={urgent.critTasks}    warn />}
              {urgent.critIncidents > 0 && <Stat label="Critical incidents" value={urgent.critIncidents} warn />}
            </>
          )}
        </Panel>

        {/* PANEL 2 — OPERATIONS */}
        <Panel title="🔵 OPERATIONS" colour="#2563eb" loading={ops === null}>
          {ops && (
            <>
              <Stat label="Active service users" value={ops.serviceUsers} colour="#2563eb" />
              <Stat label="Tasks pending"         value={ops.tasksPending}  colour="#2563eb" />
            </>
          )}
        </Panel>

        {/* PANEL 3 — PEOPLE & HR */}
        <Panel title="🟣 PEOPLE & HR" colour="#7c3aed" loading={people === null}>
          {people && (
            <>
              <Stat label="Staff on duty now"   value={people.staffOnDuty}     colour="#7c3aed" />
              <Stat label="Training overdue"    value={people.overdueTraining}  warn={people.overdueTraining > 0} />
              <Stat label="Docs expiring soon"  value={people.expiringDocs}     warn={people.expiringDocs > 0} />
            </>
          )}
        </Panel>

        {/* PANEL 4 — FINANCE */}
        <Panel title="🟢 FINANCE" colour="#16a34a" loading={finance === null}>
          {finance && (
            <>
              <Stat label="Outstanding invoices" value={`£${Number(finance.outstanding).toLocaleString('en-GB', { minimumFractionDigits: 2 })}`} warn={finance.overdueCount > 0} colour="#16a34a" />
              <Stat label="Invoices overdue"      value={finance.overdueCount}   warn={finance.overdueCount > 0} />
              <Stat label="Payroll pending"       value={finance.payrollPending}  colour="#16a34a" />
            </>
          )}
        </Panel>

        {/* PANEL 5 — COMPLIANCE */}
        <Panel title="🟠 COMPLIANCE" colour="#ea580c" loading={compliance === null}>
          {compliance && (
            <>
              <Stat label="Compliant items"    value={compliance.compliant}     colour="#16a34a" />
              <Stat label="Action required"    value={compliance.actionNeeded}  warn={compliance.actionNeeded > 0} />
              {compliance.nextCheck && (
                <Stat label="Next check" value={new Date(compliance.nextCheck).toLocaleDateString('en-GB')} colour="#ea580c" />
              )}
            </>
          )}
        </Panel>

        {/* PANEL 6 — DIGITAL OFFICE */}
        <Panel title="💼 DIGITAL OFFICE" colour="#d97706" loading={digital === null}>
          {digital && !digital.connected && (
            <div>
              <div style={{ color: '#6b7280', fontSize: '0.82rem', marginBottom: '0.75rem' }}>
                Google Account not connected
              </div>
              <button style={styles.connectBtn} onClick={() => navigate('/ceo-office')}>
                🔗 Connect Google Account
              </button>
            </div>
          )}
          {digital && digital.connected && (
            <>
              {digital.events.length > 0 ? (
                <div style={{ marginBottom: '0.6rem' }}>
                  <div style={styles.subLabel}>Today's meetings</div>
                  {digital.events.map((ev, i) => (
                    <div key={i} style={styles.eventRow}>
                      <span style={styles.eventTime}>
                        {ev.start?.dateTime
                          ? new Date(ev.start.dateTime).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
                          : 'All day'}
                      </span>
                      <span style={styles.eventTitle}>{ev.summary ?? 'Untitled'}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ color: '#6b7280', fontSize: '0.82rem', marginBottom: '0.5rem' }}>No meetings today</div>
              )}
              {digital.priorityCount > 0 && (
                <div style={{ ...styles.subLabel, color: '#dc2626' }}>
                  ⚡ {digital.priorityCount} priority email{digital.priorityCount !== 1 ? 's' : ''}
                </div>
              )}
              {digital.emails.slice(0, 3).map((em, i) => (
                <div key={i} style={styles.emailRow}>
                  <div style={styles.emailFrom}>{(em.from ?? '').replace(/<.*>/, '').trim() || 'Unknown'}</div>
                  <div style={styles.emailSubject}>{em.subject ?? '(no subject)'}</div>
                </div>
              ))}
            </>
          )}
        </Panel>
      </div>

      {/* ── SECTION 3: AI Narrative ───────────────────────────────────── */}
      <div style={styles.aiPanel}>
        <div style={styles.aiHeader}>
          <div>
            <div style={styles.aiTitle}>AI Executive Summary</div>
            <div style={styles.aiSubtitle}>
              Generated by Claude{briefingTime ? ` · ${briefingTime}` : ''}
            </div>
          </div>
          {briefingLoading && (
            <div style={styles.aiGenerating}>
              <Spinner size={14} colour="#d97706" />
              <span style={{ color: '#94a3b8', fontSize: '0.85rem' }}>Generating your briefing...</span>
            </div>
          )}
        </div>

        <div style={styles.aiBody}>
          {briefingLoading && !briefing && <Skeleton lines={8} />}
          {briefingError && <div style={{ color: '#f87171', fontSize: '0.88rem' }}>{briefingError}</div>}
          {!briefingLoading && !briefingError && !briefing && (
            <div style={{ color: '#64748b', fontSize: '0.88rem' }}>Click "Generate Briefing" to create your morning summary.</div>
          )}
          {briefing && <RenderAI text={briefing} />}
        </div>
      </div>

      {/* ── SECTION 4: Quick Actions ──────────────────────────────────── */}
      <div className="actions-row no-print" style={styles.actionsRow}>
        {[
          {
            label: '💰 Chase Invoices',
            action: async () => { await api.post('/api/automation/chase-invoice'); alert('Chase emails sent ✓'); },
          },
          {
            label: '📧 Weekly Report',
            action: async () => { await api.post('/api/automation/send-report'); alert('Report sent ✓'); },
          },
          {
            label: '📋 Critical Tasks',
            action: () => navigate('/'),
          },
          {
            label: '👥 HR Summary',
            action: async () => {
              setBriefingLoading(true);
              try {
                const res = await api.post('/api/ceo/command', { command: 'HR summary' });
                setBriefing(res.data.result ?? res.data.answer ?? '');
                setBriefingTime(new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }));
              } catch { setBriefingError('HR summary unavailable'); }
              finally { setBriefingLoading(false); }
            },
          },
          {
            label: '📅 My Calendar',
            action: () => navigate('/ceo-office'),
          },
          {
            label: '🔄 Refresh',
            action: () => { loadPanels(); generateBriefing(); },
          },
        ].map((btn, i) => (
          <button key={i} style={styles.actionBtn} onClick={btn.action}>
            {btn.label}
          </button>
        ))}
      </div>

      {/* ── SECTION 5: Briefing History ───────────────────────────────── */}
      {briefingHistory.length > 0 && (
        <div className="no-print" style={styles.historyWrap}>
          <button style={styles.historyToggle} onClick={() => setHistoryOpen(o => !o)}>
            {historyOpen ? '▲' : '▼'} Briefing History ({briefingHistory.length})
          </button>
          {historyOpen && (
            <div style={styles.historyList}>
              {briefingHistory.map((h, i) => (
                <div key={i} style={styles.historyItem}>
                  <div style={styles.historyMeta}>
                    <span style={{ fontWeight: 600, color: '#d97706' }}>{h.date}</span>
                    <span style={{ color: '#6b7280' }}>{h.time}</span>
                    <button style={styles.historyViewBtn} onClick={() => setBriefing(h.text)}>
                      View
                    </button>
                  </div>
                  <div style={{ color: '#6b7280', fontSize: '0.8rem', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                    {h.text.slice(0, 120)}…
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = {
  page: {
    maxWidth: '1200px',
    margin: '0 auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '1.5rem',
  },
  hero: {
    background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f2744 100%)',
    borderRadius: '12px',
    padding: '1.75rem 2rem',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: '1rem',
    flexWrap: 'wrap',
    boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
  },
  heroLeft: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.3rem',
  },
  heroTitle: {
    fontSize: '1.65rem',
    fontWeight: 800,
    color: '#f1f5f9',
    letterSpacing: '-0.02em',
  },
  heroDate: {
    fontSize: '0.92rem',
    color: '#94a3b8',
  },
  heroCompany: {
    fontSize: '0.78rem',
    color: '#475569',
    textTransform: 'uppercase',
    letterSpacing: '1.2px',
    marginTop: '0.1rem',
  },
  heroRight: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-end',
    gap: '0.6rem',
  },
  generateBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.4rem',
    padding: '0.6rem 1.25rem',
    background: 'linear-gradient(135deg, #d97706, #b45309)',
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    fontWeight: 700,
    fontSize: '0.88rem',
    boxShadow: '0 2px 8px rgba(217,119,6,0.35)',
  },
  printBtn: {
    padding: '0.6rem 1rem',
    background: 'rgba(255,255,255,0.08)',
    color: '#94a3b8',
    border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: '8px',
    cursor: 'pointer',
    fontWeight: 600,
    fontSize: '0.85rem',
  },
  lastGen: {
    fontSize: '0.75rem',
    color: '#475569',
  },
  panelGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '1rem',
  },
  panel: {
    background: '#fff',
    borderRadius: '10px',
    borderLeft: '4px solid #e5e7eb',
    padding: '1.1rem 1.25rem',
    boxShadow: '0 1px 6px rgba(0,0,0,0.07)',
  },
  panelTitle: {
    fontSize: '0.78rem',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.8px',
    marginBottom: '0.75rem',
  },
  statRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '0.3rem 0',
    borderBottom: '1px solid #f1f5f9',
  },
  statLabel: {
    fontSize: '0.82rem',
    color: '#6b7280',
  },
  statValue: {
    fontSize: '1rem',
    fontWeight: 700,
    color: '#1e293b',
  },
  allClear: {
    color: '#16a34a',
    fontWeight: 600,
    fontSize: '0.88rem',
    padding: '0.25rem 0',
  },
  subLabel: {
    fontSize: '0.72rem',
    fontWeight: 700,
    textTransform: 'uppercase',
    color: '#9ca3af',
    letterSpacing: '0.6px',
    marginBottom: '0.35rem',
  },
  eventRow: {
    display: 'flex',
    gap: '0.5rem',
    marginBottom: '0.3rem',
    alignItems: 'flex-start',
  },
  eventTime: {
    fontSize: '0.75rem',
    color: '#d97706',
    fontWeight: 700,
    whiteSpace: 'nowrap',
    flexShrink: 0,
    paddingTop: '1px',
  },
  eventTitle: {
    fontSize: '0.8rem',
    color: '#374151',
    lineHeight: 1.3,
  },
  emailRow: {
    marginBottom: '0.35rem',
    paddingBottom: '0.35rem',
    borderBottom: '1px solid #f9fafb',
  },
  emailFrom: {
    fontSize: '0.75rem',
    fontWeight: 600,
    color: '#374151',
    overflow: 'hidden',
    whiteSpace: 'nowrap',
    textOverflow: 'ellipsis',
  },
  emailSubject: {
    fontSize: '0.73rem',
    color: '#9ca3af',
    overflow: 'hidden',
    whiteSpace: 'nowrap',
    textOverflow: 'ellipsis',
  },
  connectBtn: {
    padding: '0.45rem 0.9rem',
    background: 'rgba(217,119,6,0.1)',
    border: '1px solid rgba(217,119,6,0.3)',
    borderRadius: '6px',
    color: '#d97706',
    cursor: 'pointer',
    fontSize: '0.82rem',
    fontWeight: 600,
  },
  aiPanel: {
    background: 'linear-gradient(135deg, #0f172a 0%, #1a2744 100%)',
    borderRadius: '12px',
    padding: '1.75rem 2rem',
    boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
  },
  aiHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '1.25rem',
  },
  aiTitle: {
    fontSize: '1.05rem',
    fontWeight: 700,
    color: '#f1f5f9',
  },
  aiSubtitle: {
    fontSize: '0.78rem',
    color: '#475569',
    marginTop: '0.15rem',
  },
  aiGenerating: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
  },
  aiBody: {
    minHeight: '80px',
  },
  actionsRow: {
    display: 'flex',
    gap: '0.75rem',
    flexWrap: 'wrap',
  },
  actionBtn: {
    flex: '1 1 auto',
    minWidth: '140px',
    padding: '0.7rem 1rem',
    background: '#fff',
    border: '1px solid #e5e7eb',
    borderRadius: '8px',
    cursor: 'pointer',
    fontWeight: 600,
    fontSize: '0.85rem',
    color: '#374151',
    boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
    transition: 'background 0.15s, border-color 0.15s',
  },
  historyWrap: {
    background: '#fff',
    borderRadius: '10px',
    border: '1px solid #e5e7eb',
    overflow: 'hidden',
  },
  historyToggle: {
    width: '100%',
    padding: '0.9rem 1.25rem',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    fontWeight: 600,
    fontSize: '0.88rem',
    color: '#374151',
    textAlign: 'left',
    borderBottom: '1px solid #e5e7eb',
  },
  historyList: {
    padding: '0.75rem 1.25rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem',
  },
  historyItem: {
    paddingBottom: '0.75rem',
    borderBottom: '1px solid #f1f5f9',
  },
  historyMeta: {
    display: 'flex',
    gap: '0.75rem',
    alignItems: 'center',
    marginBottom: '0.25rem',
    fontSize: '0.82rem',
  },
  historyViewBtn: {
    padding: '0.2rem 0.6rem',
    background: 'rgba(217,119,6,0.1)',
    border: '1px solid rgba(217,119,6,0.3)',
    borderRadius: '4px',
    cursor: 'pointer',
    color: '#d97706',
    fontSize: '0.78rem',
    fontWeight: 600,
  },
};
