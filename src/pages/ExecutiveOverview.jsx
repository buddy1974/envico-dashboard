import { useEffect, useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';

// ─── Helpers ──────────────────────────────────────────────────────────────────
function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}
function formatDate() {
  return new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}
function formatTime() {
  return new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}
function getName() {
  try {
    const u = JSON.parse(localStorage.getItem('user') || '{}');
    return u.name?.split(' ')[0] || 'Engelbert';
  } catch { return 'Engelbert'; }
}
function daysUntil(dateStr) {
  const d = new Date(dateStr);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return Math.ceil((d - now) / 86400000);
}

// ─── Priority colour map ───────────────────────────────────────────────────────
const SEV = {
  URGENT: { bg: 'rgba(220,38,38,0.12)', border: '#dc2626', dot: '#dc2626', label: '● URGENT' },
  HIGH:   { bg: 'rgba(217,119,6,0.12)',  border: '#d97706', dot: '#d97706', label: '● HIGH'   },
  MEDIUM: { bg: 'rgba(59,130,246,0.10)', border: '#3b82f6', dot: '#3b82f6', label: '● WATCH'  },
  OK:     { bg: 'rgba(34,197,94,0.10)',  border: '#22c55e', dot: '#22c55e', label: '● OK'     },
};

// ─── Sub-components ────────────────────────────────────────────────────────────
function StatCard({ icon, value, label, sub, color = '#60a5fa', onClick }) {
  const [hover, setHover] = useState(false);
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        background: hover && onClick ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.04)',
        border: `1px solid ${hover && onClick ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.09)'}`,
        borderRadius: '10px',
        padding: '1.1rem 1.25rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '2px',
        cursor: onClick ? 'pointer' : 'default',
        transition: 'all 0.15s',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.3rem' }}>
        <span style={{ fontSize: '1.1rem' }}>{icon}</span>
        <span style={{ fontSize: '0.72rem', color: '#8888aa', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 600 }}>{label}</span>
      </div>
      <span style={{ fontSize: '2rem', fontWeight: 700, color, lineHeight: 1 }}>{value ?? '—'}</span>
      {sub && <span style={{ fontSize: '0.72rem', color: '#8888aa', marginTop: '4px' }}>{sub}</span>}
    </div>
  );
}

function PriorityItem({ sev = 'MEDIUM', tag, title, desc, action, actionLabel, status }) {
  const s = SEV[sev] || SEV.MEDIUM;
  return (
    <div style={{
      background: s.bg,
      borderLeft: `3px solid ${s.border}`,
      borderRadius: '0 8px 8px 0',
      padding: '0.75rem 1rem',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: '0.75rem',
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '2px', flexWrap: 'wrap' }}>
          {tag && (
            <span style={{ background: 'rgba(255,255,255,0.1)', borderRadius: '4px', padding: '1px 6px', fontSize: '0.68rem', fontWeight: 700, color: '#c4b5fd', letterSpacing: '0.3px' }}>
              {tag}
            </span>
          )}
          <span style={{ fontSize: '0.68rem', color: s.dot, fontWeight: 700 }}>{s.label}</span>
        </div>
        <p style={{ margin: 0, fontWeight: 600, color: '#f1f5f9', fontSize: '0.9rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{title}</p>
        {desc && <p style={{ margin: '2px 0 0', fontSize: '0.78rem', color: '#94a3b8' }}>{desc}</p>}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
        {status && <span style={{ fontSize: '0.72rem', color: '#64748b', whiteSpace: 'nowrap' }}>{status}</span>}
        {action && (
          <button onClick={action} style={{
            background: 'rgba(255,255,255,0.08)',
            border: '1px solid rgba(255,255,255,0.15)',
            borderRadius: '5px',
            color: '#e2e8f0',
            fontSize: '0.75rem',
            padding: '4px 10px',
            cursor: 'pointer',
            whiteSpace: 'nowrap',
          }}>{actionLabel || 'Review →'}</button>
        )}
      </div>
    </div>
  );
}

function Section({ title, badge, children }) {
  return (
    <div style={{ marginBottom: '1.5rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.75rem' }}>
        <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#8888aa', textTransform: 'uppercase', letterSpacing: '0.8px' }}>{title}</span>
        {badge != null && badge > 0 && (
          <span style={{ background: '#dc2626', color: '#fff', borderRadius: '999px', fontSize: '0.65rem', fontWeight: 700, padding: '1px 6px' }}>{badge}</span>
        )}
        <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.07)' }} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>{children}</div>
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────
export default function ExecutiveOverview() {
  const navigate  = useNavigate();
  const [time, setTime] = useState(formatTime());
  const [stats,     setStats]     = useState({});
  const [incidents, setIncidents] = useState([]);
  const [medications, setMedications] = useState([]);
  const [carePlans, setCarePlans] = useState([]);
  const [serviceUsers, setServiceUsers] = useState([]);
  const [briefing, setBriefing]   = useState('');
  const [briefingLoading, setBriefingLoading] = useState(false);
  const [briefingTs, setBriefingTs] = useState('');
  const [loaded, setLoaded] = useState(false);

  // Clock tick
  useEffect(() => {
    const t = setInterval(() => setTime(formatTime()), 10000);
    return () => clearInterval(t);
  }, []);

  // Load all data
  const loadAll = useCallback(async () => {
    const [incR, medR, cpR, suR] = await Promise.allSettled([
      api.get('/api/incidents'),
      api.get('/api/medications'),
      api.get('/api/care-plans'),
      api.get('/api/service-users'),
    ]);
    const incs = incR.status === 'fulfilled' ? (incR.value.data.incidents ?? incR.value.data.data ?? []) : [];
    const meds = medR.status === 'fulfilled' ? (medR.value.data.medications ?? medR.value.data.data ?? []) : [];
    const cps  = cpR.status  === 'fulfilled' ? (cpR.value.data.carePlans   ?? cpR.value.data.data  ?? []) : [];
    const sus  = suR.status  === 'fulfilled' ? (suR.value.data.serviceUsers ?? suR.value.data.data ?? []) : [];

    setIncidents(incs);
    setMedications(meds);
    setCarePlans(cps);
    setServiceUsers(sus);

    const openInc = incs.filter(i => !['RESOLVED','CLOSED'].includes(i.status));
    const highInc = openInc.filter(i => i.severity === 'HIGH' || i.severity === 'CRITICAL');
    const safeguarding = openInc.filter(i => i.type?.toLowerCase().includes('safeguard'));
    const activeMeds = meds.filter(m => m.status === 'ACTIVE');
    const activeSUs  = sus.filter(s => s.status !== 'DISCHARGED' && s.status !== 'INACTIVE');

    setStats({
      serviceUsers: activeSUs.length,
      openIncidents: openInc.length,
      highIncidents: highInc.length,
      safeguarding: safeguarding.length,
      activeMeds: activeMeds.length,
      carePlans: cps.length,
    });
    setLoaded(true);
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  // AI Briefing
  const fetchBriefing = useCallback(async () => {
    if (briefingLoading) return;
    setBriefingLoading(true);
    try {
      const prompt = `You are Envico CareOS's executive AI. Write a single concise paragraph (4-6 sentences) morning briefing for Engelbert, Envico's CEO. Today is ${formatDate()}.

Current live data:
- Active service users: ${stats.serviceUsers ?? '?'}
- Open incidents: ${stats.openIncidents ?? '?'} (${stats.highIncidents ?? '?'} high/critical)
- Active safeguarding cases: ${stats.safeguarding ?? '?'}
- Active medications being managed: ${stats.activeMeds ?? '?'}
- Care plans on file: ${stats.carePlans ?? '?'}

Write in a warm, professional, executive tone. Be specific about what needs attention today. End with one clear action priority.`;

      const res = await api.post('/api/assistant/ask', { message: prompt });
      const reply = res.data.reply ?? res.data.message ?? res.data.response ?? '';
      setBriefing(reply);
      setBriefingTs(formatTime());
    } catch {
      setBriefing('Live briefing unavailable — check the AI assistant connection. All operational data is shown in the sections below.');
      setBriefingTs(formatTime());
    } finally {
      setBriefingLoading(false);
    }
  }, [stats, briefingLoading]);

  // Auto-fetch briefing once stats load
  useEffect(() => {
    if (loaded && !briefing && !briefingLoading) fetchBriefing();
  }, [loaded]);

  // ─── Derive priority items ─────────────────────────────────────────────────
  const openInc    = incidents.filter(i => !['RESOLVED','CLOSED'].includes(i.status));
  const safeInc    = openInc.filter(i => i.type?.toLowerCase().includes('safeguard'));
  const highInc    = openInc.filter(i => ['HIGH','CRITICAL'].includes(i.severity) && !i.type?.toLowerCase().includes('safeguard'));

  // Medications due for review (check review_date field)
  const medReviews = medications.filter(m => {
    if (!m.review_date) return false;
    const d = daysUntil(m.review_date);
    return d <= 30 && d >= 0;
  });

  // Care plans — any without recent updates
  const staleCarePlans = carePlans.filter(cp => {
    if (!cp.updated_at && !cp.created_at) return false;
    const updated = new Date(cp.updated_at || cp.created_at);
    const daysSince = (Date.now() - updated.getTime()) / 86400000;
    return daysSince > 60;
  });

  const urgentCount = safeInc.length + highInc.length;

  // ─── Nav shortcuts ─────────────────────────────────────────────────────────
  const shortcuts = [
    { icon: '👥', label: 'Service Users', sub: `${stats.serviceUsers ?? '—'} active`, to: '/service-users' },
    { icon: '🚨', label: 'Incidents', sub: `${openInc.length} open`, to: '/incidents', alert: openInc.length > 0 },
    { icon: '💊', label: 'Medications', sub: `${stats.activeMeds ?? '—'} managed`, to: '/medications' },
    { icon: '📋', label: 'Care Plans', sub: `${stats.carePlans ?? '—'} plans`, to: '/care-plans' },
    { icon: '✅', label: 'Compliance', sub: 'Training & CQC', to: '/compliance' },
    { icon: '📅', label: 'Rota', sub: 'Staff schedules', to: '/rota' },
    { icon: '📊', label: 'Finance', sub: 'Invoices & payroll', to: '/finance' },
    { icon: '📥', label: 'Import Data', sub: 'Bulk upload', to: '/import' },
  ];

  return (
    <div style={s.page}>
      {/* ── Top bar ── */}
      <div style={s.topBar}>
        <div>
          <h1 style={s.greeting}>{getGreeting()}, {getName()}.</h1>
          <p style={s.date}>{formatDate()} · {time}</p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button onClick={loadAll} style={s.topBtn}>↺ Refresh</button>
          <button onClick={() => navigate('/ceo-briefing')} style={{ ...s.topBtn, background: 'rgba(217,119,6,0.2)', border: '1px solid rgba(217,119,6,0.4)', color: '#fcd34d' }}>
            📊 CEO Briefing
          </button>
          <button onClick={() => navigate('/assistant')} style={{ ...s.topBtn, background: 'rgba(124,58,237,0.2)', border: '1px solid rgba(124,58,237,0.4)', color: '#c4b5fd' }}>
            🤖 AI Assistant
          </button>
        </div>
      </div>

      {/* ── Stats row ── */}
      <div style={s.statsGrid}>
        <StatCard icon="👥" value={stats.serviceUsers} label="Active Service Users" sub="Under care today" color="#60a5fa" onClick={() => navigate('/service-users')} />
        <StatCard icon="🚨" value={openInc.length}     label="Open Incidents"       sub={`${stats.highIncidents ?? 0} high priority`} color={openInc.length > 0 ? '#f87171' : '#4ade80'} onClick={() => navigate('/incidents')} />
        <StatCard icon="🛡️" value={stats.safeguarding} label="Safeguarding Cases"   sub="Active investigations" color={stats.safeguarding > 0 ? '#f87171' : '#4ade80'} onClick={() => navigate('/incidents')} />
        <StatCard icon="💊" value={stats.activeMeds}   label="Medications Managed" sub="Active prescriptions" color="#a78bfa" onClick={() => navigate('/medications')} />
        <StatCard icon="📋" value={stats.carePlans}    label="Care Plans"          sub="Person-centred goals" color="#34d399" onClick={() => navigate('/care-plans')} />
        <StatCard icon="⏳" value={medReviews.length}  label="Med Reviews Due"     sub="Within 30 days" color={medReviews.length > 0 ? '#fbbf24' : '#4ade80'} onClick={() => navigate('/medications')} />
      </div>

      {/* ── Main two-column layout ── */}
      <div style={s.twoCol}>

        {/* ── LEFT: Priorities + Briefing ── */}
        <div style={{ flex: '1 1 0', minWidth: 0 }}>

          {/* AI Briefing */}
          <div style={s.briefingBox}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#22c55e', flexShrink: 0, boxShadow: '0 0 6px #22c55e' }} />
              <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#22c55e', textTransform: 'uppercase', letterSpacing: '0.6px' }}>AI Executive Briefing</span>
              <span style={{ fontSize: '0.68rem', color: '#64748b', marginLeft: 'auto' }}>claude-haiku · {briefingTs || '—'}</span>
              <button onClick={fetchBriefing} disabled={briefingLoading} style={s.rebriefBtn}>
                {briefingLoading ? '…' : '↺'}
              </button>
            </div>
            {briefingLoading && !briefing ? (
              <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                {[0, 1, 2].map(i => (
                  <span key={i} style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#60a5fa', animation: 'bounce 1.2s infinite', animationDelay: `${i * 0.2}s` }} />
                ))}
                <span style={{ fontSize: '0.8rem', color: '#64748b', marginLeft: '6px' }}>Generating briefing…</span>
              </div>
            ) : (
              <p style={{ margin: 0, fontSize: '0.88rem', color: '#cbd5e1', lineHeight: 1.7 }}>{briefing || 'Click ↺ to generate today\'s briefing.'}</p>
            )}
          </div>

          {/* Priority Tracker */}
          <Section title="Priority Tracker" badge={urgentCount}>
            {safeInc.length === 0 && highInc.length === 0 && openInc.length === 0 && (
              <PriorityItem sev="OK" title="No urgent incidents" desc="All incidents are resolved or low priority." />
            )}
            {safeInc.map(i => (
              <PriorityItem key={i.id} sev="URGENT" tag="SAFEGUARDING" title={`${i.title || i.description?.slice(0, 50) || 'Safeguarding case'}`} desc={`Service user: ${i.serviceUser?.firstName ?? ''} ${i.serviceUser?.lastName ?? ''} · Status: ${i.status}`} action={() => navigate('/incidents')} actionLabel="Review →" status="Open" />
            ))}
            {highInc.map(i => (
              <PriorityItem key={i.id} sev="HIGH" tag="INCIDENT" title={`${i.title || i.description?.slice(0, 60) || 'High severity incident'}`} desc={`${i.severity} · ${i.type || ''} · Status: ${i.status}`} action={() => navigate('/incidents')} actionLabel="View →" status="Open" />
            ))}
            {openInc.filter(i => !['HIGH','CRITICAL'].includes(i.severity) && !i.type?.toLowerCase().includes('safeguard')).slice(0, 3).map(i => (
              <PriorityItem key={i.id} sev="MEDIUM" tag="INCIDENT" title={i.title || i.description?.slice(0, 60) || 'Incident'} desc={`${i.severity ?? 'LOW'} severity · Status: ${i.status}`} action={() => navigate('/incidents')} actionLabel="View →" status="Watching" />
            ))}
            {medReviews.slice(0, 2).map(m => {
              const d = daysUntil(m.review_date);
              return (
                <PriorityItem key={m.id} sev={d <= 7 ? 'HIGH' : 'MEDIUM'} tag="MEDICATION" title={`${m.name} — review due`} desc={`${m.serviceUser?.firstName ?? ''} ${m.serviceUser?.lastName ?? ''} · ${d <= 0 ? 'OVERDUE' : `${d} days`}`} action={() => navigate('/medications')} actionLabel="View →" status={d <= 0 ? 'Overdue' : `${d}d`} />
              );
            })}
            {staleCarePlans.slice(0, 2).map(cp => (
              <PriorityItem key={cp.id} sev="MEDIUM" tag="CARE PLAN" title={`${cp.title || 'Care Plan'} — needs review`} desc={`${cp.serviceUser?.firstName ?? ''} ${cp.serviceUser?.lastName ?? ''} · Last updated >60 days ago`} action={() => navigate('/care-plans')} actionLabel="Review →" status="Watching" />
            ))}
          </Section>

          {/* Quick Actions */}
          <Section title="Upcoming Actions">
            <PriorityItem sev="HIGH" tag="COMPLIANCE" title="DBS renewal — Daniel Marsh" desc="Enhanced DBS expired Dec 2025 — submit application immediately" action={() => navigate('/compliance')} actionLabel="Go →" status="Overdue" />
            <PriorityItem sev="HIGH" tag="TRAINING" title="First Aid training — Emma Williams, Priya Kapoor" desc="Certificates expired — book immediately" action={() => navigate('/training')} actionLabel="Go →" status="Urgent" />
            <PriorityItem sev="MEDIUM" tag="SAFEGUARDING" title="Strategy meeting — Harold Fletcher" desc="Section 42 enquiry — Local Authority coordination required" action={() => navigate('/incidents')} actionLabel="View →" status="This week" />
            <PriorityItem sev="MEDIUM" tag="CLINICAL" title="Medication review — Albert Pennington" desc="Co-careldopa & Sertraline — GP review due June 2026" action={() => navigate('/medications')} actionLabel="View →" status="Next month" />
          </Section>
        </div>

        {/* ── RIGHT: Quick nav + Recent ── */}
        <div style={{ width: '280px', flexShrink: 0 }}>

          {/* Quick navigation */}
          <div style={{ marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.75rem' }}>
              <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#8888aa', textTransform: 'uppercase', letterSpacing: '0.8px' }}>Quick Access</span>
              <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.07)' }} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem' }}>
              {shortcuts.map(({ icon, label, sub, to, alert }) => (
                <button key={to} onClick={() => navigate(to)} style={{
                  background: 'rgba(255,255,255,0.04)',
                  border: `1px solid ${alert ? 'rgba(248,113,113,0.3)' : 'rgba(255,255,255,0.08)'}`,
                  borderRadius: '8px',
                  padding: '0.7rem 0.75rem',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.12s',
                  position: 'relative',
                }}>
                  <div style={{ fontSize: '1.1rem', marginBottom: '3px' }}>{icon}</div>
                  <div style={{ fontSize: '0.78rem', fontWeight: 600, color: '#e2e8f0', lineHeight: 1.2 }}>{label}</div>
                  <div style={{ fontSize: '0.68rem', color: alert ? '#f87171' : '#64748b', marginTop: '2px' }}>{sub}</div>
                  {alert && <span style={{ position: 'absolute', top: '6px', right: '6px', width: '7px', height: '7px', borderRadius: '50%', background: '#dc2626' }} />}
                </button>
              ))}
            </div>
          </div>

          {/* Recent incidents */}
          <div style={{ marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.75rem' }}>
              <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#8888aa', textTransform: 'uppercase', letterSpacing: '0.8px' }}>Recent Incidents</span>
              <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.07)' }} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              {incidents.slice(0, 5).map(i => {
                const sevColor = i.severity === 'HIGH' || i.severity === 'CRITICAL' ? '#f87171' : i.severity === 'MEDIUM' ? '#fbbf24' : '#4ade80';
                const isOpen = !['RESOLVED','CLOSED'].includes(i.status);
                return (
                  <div key={i.id} onClick={() => navigate('/incidents')} style={{
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(255,255,255,0.07)',
                    borderRadius: '7px',
                    padding: '0.6rem 0.75rem',
                    cursor: 'pointer',
                    display: 'flex',
                    gap: '0.6rem',
                    alignItems: 'flex-start',
                  }}>
                    <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: sevColor, flexShrink: 0, marginTop: '5px' }} />
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <p style={{ margin: 0, fontSize: '0.78rem', color: '#cbd5e1', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {i.title || i.description?.slice(0, 45) || 'Incident'}
                      </p>
                      <p style={{ margin: '2px 0 0', fontSize: '0.68rem', color: '#64748b' }}>
                        {i.serviceUser ? `${i.serviceUser.firstName} ${i.serviceUser.lastName}` : 'Unknown'} · {isOpen ? 'Open' : 'Closed'}
                      </p>
                    </div>
                  </div>
                );
              })}
              {incidents.length === 0 && (
                <p style={{ fontSize: '0.8rem', color: '#64748b', margin: 0, padding: '0.5rem 0' }}>No incidents on record.</p>
              )}
              <button onClick={() => navigate('/incidents')} style={{ ...s.viewAllBtn, marginTop: '0.2rem' }}>View all incidents →</button>
            </div>
          </div>

          {/* Service users */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.75rem' }}>
              <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#8888aa', textTransform: 'uppercase', letterSpacing: '0.8px' }}>Service Users</span>
              <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.07)' }} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              {serviceUsers.slice(0, 4).map(u => (
                <div key={u.id} onClick={() => navigate('/service-users')} style={{
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.07)',
                  borderRadius: '7px',
                  padding: '0.6rem 0.75rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                }}>
                  <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'rgba(96,165,250,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#60a5fa', fontWeight: 700, fontSize: '0.85rem', flexShrink: 0 }}>
                    {(u.firstName?.[0] || '?')}{(u.lastName?.[0] || '')}
                  </div>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <p style={{ margin: 0, fontSize: '0.8rem', color: '#e2e8f0', fontWeight: 600 }}>{u.firstName} {u.lastName}</p>
                    <p style={{ margin: '1px 0 0', fontSize: '0.68rem', color: '#64748b' }}>{u.careLevel || u.care_level || 'Standard'} · {u.status || 'Active'}</p>
                  </div>
                </div>
              ))}
              <button onClick={() => navigate('/service-users')} style={{ ...s.viewAllBtn, marginTop: '0.2rem' }}>View all service users →</button>
            </div>
          </div>
        </div>
      </div>

      {/* Bounce animation keyframes */}
      <style>{`@keyframes bounce { 0%,80%,100%{transform:scale(0)} 40%{transform:scale(1)} }`}</style>
    </div>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────────
const s = {
  page: {
    minHeight: '100vh',
    background: 'linear-gradient(135deg, #0f172a 0%, #1a1a2e 60%, #0f172a 100%)',
    color: '#f1f5f9',
    padding: '1.75rem 2rem',
    fontFamily: 'system-ui, -apple-system, sans-serif',
  },
  topBar: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: '1.75rem',
    flexWrap: 'wrap',
    gap: '0.75rem',
  },
  greeting: {
    margin: 0,
    fontSize: '1.75rem',
    fontWeight: 700,
    color: '#f1f5f9',
    letterSpacing: '-0.3px',
  },
  date: {
    margin: '4px 0 0',
    fontSize: '0.85rem',
    color: '#64748b',
  },
  topBtn: {
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: '7px',
    color: '#94a3b8',
    fontSize: '0.82rem',
    padding: '0.45rem 0.9rem',
    cursor: 'pointer',
    fontWeight: 500,
    transition: 'all 0.12s',
  },
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))',
    gap: '0.75rem',
    marginBottom: '2rem',
  },
  twoCol: {
    display: 'flex',
    gap: '1.5rem',
    alignItems: 'flex-start',
    flexWrap: 'wrap',
  },
  briefingBox: {
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(34,197,94,0.25)',
    borderRadius: '10px',
    padding: '1rem 1.25rem',
    marginBottom: '1.5rem',
  },
  rebriefBtn: {
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '5px',
    color: '#94a3b8',
    fontSize: '0.75rem',
    padding: '2px 8px',
    cursor: 'pointer',
  },
  viewAllBtn: {
    background: 'transparent',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '6px',
    color: '#60a5fa',
    fontSize: '0.75rem',
    padding: '0.4rem 0.75rem',
    cursor: 'pointer',
    width: '100%',
    textAlign: 'center',
  },
};
