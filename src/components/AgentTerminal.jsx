import { useState, useEffect, useRef } from 'react';

// ─── Agent definitions — one per phase ───────────────────────────────────────
const AGENTS = [
  {
    id: 'referral-intake',
    name: 'REFERRAL.INTAKE',
    phase: 1,
    desc: 'Parses inbound referrals, validates fields, creates service-user record',
    color: '#3ab54a',
    logs: [
      'Referral #REF-0091 received — source: NHS Hackney',
      'Validating required fields: name, DoB, funding_type',
      'Funding: CHC confirmed — creating service user record',
      'Task CRITICAL generated: assign key worker within 24 h',
      'Notification dispatched to MANAGER role',
      'REF-0091 status → PENDING_ASSESSMENT',
    ],
  },
  {
    id: 'escalation-handler',
    name: 'ESCALATION.HANDLER',
    phase: 2,
    desc: 'Monitors task priority queue, fires n8n webhooks for CRITICAL items',
    color: '#ef4444',
    logs: [
      'Scanning task queue — 3 CRITICAL items found',
      'Task #247 overdue by 6 h — escalating to MANAGER',
      'n8n webhook triggered: envico-escalation-flow',
      'Email dispatched to ops@envicosl.co.uk',
      'Twilio SMS sent to on-call manager',
      'Escalation log entry written — audit trail complete',
    ],
  },
  {
    id: 'training-expiry',
    name: 'TRAINING.EXPIRY',
    phase: 3,
    desc: 'Scans staff training records, flags certificates expiring within 30 days',
    color: '#f59e0b',
    logs: [
      'Scanning 47 active staff training records',
      'Found: 3 certificates expire within 30 days',
      'STAFF-12 — Moving & Handling — expires in 18 days',
      'STAFF-29 — First Aid — expires in 4 days',
      'Compliance task created: renew First Aid cert',
      'Dashboard compliance score updated: 91 → 88',
    ],
  },
  {
    id: 'rota-scheduler',
    name: 'ROTA.SCHEDULER',
    phase: 4,
    desc: 'Detects shift gaps, matches available staff, flags double-booking conflicts',
    color: '#06b6d4',
    logs: [
      'Loading rota for week 2026-W13',
      'Gap detected: Friday 07:00–15:00 — no cover',
      'Querying available staff with required skills',
      'Match found: STAFF-08 (Moving & Handling certified)',
      'Conflict check passed — no double-booking',
      'Shift assigned — manager notified for approval',
    ],
  },
  {
    id: 'invoice-chaser',
    name: 'INVOICE.CHASER',
    phase: 5,
    desc: 'Identifies overdue invoices, drafts chase emails via Gmail, logs actions',
    color: '#8b5cf6',
    logs: [
      'Checking invoice ledger — 12 open invoices',
      'INV-0044 — £2,340 — 21 days overdue (NHS Hammersmith)',
      'INV-0051 — £890 — 14 days overdue (LA Ealing)',
      'Drafting chase email via Gmail API',
      'Email draft created — awaiting manager send',
      'Chase log updated — next reminder in 7 days',
    ],
  },
  {
    id: 'compliance-monitor',
    name: 'COMPLIANCE.MONITOR',
    phase: 6,
    desc: 'Monitors CQC compliance items, flags overdue actions, updates score',
    color: '#ec4899',
    logs: [
      'Loading 28 active compliance items',
      'COMP-07 — Risk Assessment review — due in 2 days',
      'COMP-14 — GDPR data audit — overdue by 3 days',
      'CQC rating cache refreshed: GOOD (last inspected 2025-11)',
      'Compliance score recalculated: 87%',
      'CEO briefing payload updated with compliance delta',
    ],
  },
  {
    id: 'ceo-briefing',
    name: 'CEO.BRIEFING',
    phase: 7,
    desc: 'Aggregates daily KPIs across all modules, generates morning briefing digest',
    color: '#fcd34d',
    logs: [
      'Collecting KPIs from 8 data sources',
      'Active service users: 24 | Pending referrals: 3',
      'Overdue tasks: 5 | Critical: 2',
      'Outstanding invoices: £9,840',
      'Compliance score: 87% | Training gaps: 3',
      'Morning briefing digest compiled — ready for CEO view',
    ],
  },
  {
    id: 'donna-ai',
    name: 'DONNA.AI',
    phase: 8,
    desc: 'Donna AI assistant — processes NLP commands, routes to correct API handler',
    color: '#a78bfa',
    logs: [
      'Query received: "show me overdue invoices"',
      'Intent classified: INVOICE_QUERY — confidence 0.97',
      'Fetching /api/invoices?status=overdue',
      'Returned 3 results — formatting response',
      'Query received: "draft rota reminder for next week"',
      'Automation route triggered: /api/automation/rota-reminder',
    ],
  },
];

// ─── Log message pool for live simulation ────────────────────────────────────
const LIVE_POOL = [
  (a) => `[${a.name}] heartbeat — status: ACTIVE`,
  (a) => `[${a.name}] cycle complete — next run in ${Math.floor(Math.random() * 55 + 5)}s`,
  (a) => `[${a.name}] DB query executed — ${Math.floor(Math.random() * 40 + 2)}ms`,
  (a) => `[${a.name}] 0 anomalies detected`,
  (a) => `[${a.name}] payload dispatched — ${Math.floor(Math.random() * 3 + 1)} record(s) updated`,
  (a) => `[${a.name}] cache refreshed`,
  (a) => `[${a.name}] webhook acknowledged — 200 OK`,
  (a) => `[${a.name}] rate-limit OK — ${Math.floor(Math.random() * 80 + 10)}/100 req used`,
];

function ts() {
  return new Date().toISOString().replace('T', ' ').substring(0, 19);
}

function randomAgent() {
  return AGENTS[Math.floor(Math.random() * AGENTS.length)];
}

// ─── Single agent card ────────────────────────────────────────────────────────
function AgentCard({ agent, onExecute }) {
  const [expanded, setExpanded] = useState(false);
  const [status, setStatus] = useState('ACTIVE');
  const [pulse, setPulse] = useState(false);

  useEffect(() => {
    const id = setInterval(() => {
      setPulse(true);
      setTimeout(() => setPulse(false), 600);
    }, Math.random() * 8000 + 4000);
    return () => clearInterval(id);
  }, []);

  return (
    <div style={{ ...card.root, borderColor: expanded ? agent.color : '#1e3320' }}>
      {/* Header row */}
      <div style={card.header} onClick={() => setExpanded((v) => !v)}>
        <div style={card.left}>
          <span
            style={{
              ...card.dot,
              background: agent.color,
              boxShadow: pulse ? `0 0 8px ${agent.color}` : 'none',
            }}
          />
          <span style={{ ...card.name, color: agent.color }}>
            {agent.name}
          </span>
          <span style={card.phase}>P{agent.phase}</span>
        </div>
        <div style={card.right}>
          <span style={{ ...card.badge, borderColor: agent.color, color: agent.color }}>
            {status}
          </span>
          <button
            style={{ ...card.execBtn, borderColor: agent.color, color: agent.color }}
            onClick={(e) => { e.stopPropagation(); onExecute(agent); setStatus('RUNNING'); setTimeout(() => setStatus('ACTIVE'), 3000); }}
          >
            ▶ EXEC
          </button>
          <span style={card.chevron}>{expanded ? '▲' : '▼'}</span>
        </div>
      </div>

      {/* Description */}
      <p style={card.desc}>{agent.desc}</p>

      {/* Expanded logs */}
      {expanded && (
        <div style={card.logBox}>
          {agent.logs.map((line, i) => (
            <div key={i} style={card.logLine}>
              <span style={card.logNum}>{String(i + 1).padStart(2, '0')}</span>
              <span style={{ color: '#6ee77a' }}>{line}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const card = {
  root: {
    background: '#0a160a',
    border: '1px solid #1e3320',
    borderRadius: '6px',
    marginBottom: '6px',
    overflow: 'hidden',
    transition: 'border-color 0.2s',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0.55rem 0.75rem',
    cursor: 'pointer',
    userSelect: 'none',
  },
  left: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
  },
  dot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    flexShrink: 0,
    transition: 'box-shadow 0.3s',
  },
  name: {
    fontFamily: 'monospace',
    fontSize: '0.82rem',
    fontWeight: 700,
    letterSpacing: '0.08em',
  },
  phase: {
    fontFamily: 'monospace',
    fontSize: '0.68rem',
    color: '#2d5e33',
    background: '#0d2210',
    border: '1px solid #1e3320',
    borderRadius: '3px',
    padding: '1px 5px',
  },
  right: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
  },
  badge: {
    fontFamily: 'monospace',
    fontSize: '0.68rem',
    letterSpacing: '0.1em',
    border: '1px solid',
    borderRadius: '3px',
    padding: '1px 6px',
  },
  execBtn: {
    fontFamily: 'monospace',
    fontSize: '0.68rem',
    letterSpacing: '0.08em',
    border: '1px solid',
    borderRadius: '3px',
    padding: '2px 8px',
    background: 'transparent',
    cursor: 'pointer',
    transition: 'background 0.15s',
  },
  chevron: {
    color: '#2d5e33',
    fontSize: '0.7rem',
    width: '12px',
  },
  desc: {
    margin: '0',
    padding: '0 0.75rem 0.55rem',
    fontSize: '0.75rem',
    color: '#4a7a50',
    fontFamily: 'monospace',
    lineHeight: 1.4,
  },
  logBox: {
    borderTop: '1px solid #1e3320',
    padding: '0.5rem 0.75rem',
    background: '#060e06',
  },
  logLine: {
    display: 'flex',
    gap: '0.75rem',
    fontFamily: 'monospace',
    fontSize: '0.75rem',
    lineHeight: 1.7,
  },
  logNum: {
    color: '#2d5e33',
    flexShrink: 0,
    userSelect: 'none',
  },
};

// ─── Main terminal component ──────────────────────────────────────────────────
export default function AgentTerminal() {
  const [feed, setFeed] = useState([
    { time: ts(), text: 'SYS.AGENTS terminal initialised', color: '#3ab54a' },
    { time: ts(), text: `${AGENTS.length} agents loaded — all systems nominal`, color: '#3ab54a' },
    { time: ts(), text: 'Live feed active — refreshing every 15 s', color: '#2d5e33' },
  ]);
  const [filter, setFilter] = useState('ALL');
  const [execFeedback, setExecFeedback] = useState(null);
  const feedRef = useRef(null);

  // Append a live log line every 15 s
  useEffect(() => {
    const id = setInterval(() => {
      const agent = randomAgent();
      const msg = LIVE_POOL[Math.floor(Math.random() * LIVE_POOL.length)](agent);
      setFeed((prev) => [
        ...prev.slice(-120),
        { time: ts(), text: msg, color: agent.color },
      ]);
    }, 15000);
    return () => clearInterval(id);
  }, []);

  // Auto-scroll feed
  useEffect(() => {
    if (feedRef.current) {
      feedRef.current.scrollTop = feedRef.current.scrollHeight;
    }
  }, [feed]);

  function handleExecute(agent) {
    const msg = `[MANUAL] ${agent.name} triggered by operator`;
    setFeed((prev) => [
      ...prev.slice(-120),
      { time: ts(), text: msg, color: agent.color },
      { time: ts(), text: `[${agent.name}] executing cycle…`, color: '#6ee77a' },
    ]);
    setExecFeedback(`${agent.name} triggered`);
    setTimeout(() => setExecFeedback(null), 3000);
  }

  const phases = ['ALL', ...AGENTS.map((a) => `P${a.phase}`)];
  const visible = filter === 'ALL'
    ? AGENTS
    : AGENTS.filter((a) => `P${a.phase}` === filter);

  return (
    <div style={t.root}>
      {/* Terminal chrome bar */}
      <div style={t.chrome}>
        <div style={t.dots}>
          <span style={{ ...t.dot, background: '#ef4444' }} />
          <span style={{ ...t.dot, background: '#f59e0b' }} />
          <span style={{ ...t.dot, background: '#3ab54a' }} />
        </div>
        <span style={t.chromeTitle}>envico@careos — sys.agents</span>
        <span style={t.chromeRight}>
          {execFeedback
            ? <span style={{ color: '#3ab54a' }}>✓ {execFeedback}</span>
            : <span style={{ color: '#2d5e33' }}>● LIVE</span>}
        </span>
      </div>

      {/* Phase filter tabs */}
      <div style={t.tabs}>
        {phases.map((p) => (
          <button
            key={p}
            style={{ ...t.tab, ...(filter === p ? t.tabActive : {}) }}
            onClick={() => setFilter(p)}
          >
            {p}
          </button>
        ))}
        <span style={t.tabCount}>{visible.length} agent{visible.length !== 1 ? 's' : ''}</span>
      </div>

      {/* Agent cards */}
      <div style={t.cards}>
        {visible.map((agent) => (
          <AgentCard key={agent.id} agent={agent} onExecute={handleExecute} />
        ))}
      </div>

      {/* Live feed */}
      <div style={t.feedHeader}>
        <span style={{ color: '#3ab54a', fontWeight: 700 }}>LIVE FEED</span>
        <span style={{ color: '#2d5e33' }}>{feed.length} entries</span>
      </div>
      <div ref={feedRef} style={t.feed}>
        {feed.map((entry, i) => (
          <div key={i} style={t.feedLine}>
            <span style={t.feedTime}>{entry.time}</span>
            <span style={{ color: entry.color }}>{entry.text}</span>
          </div>
        ))}
        <div style={{ ...t.feedLine, color: '#2d5e33' }}>
          <span style={t.feedTime}>{ts()}</span>
          <span>▌</span>
        </div>
      </div>
    </div>
  );
}

const t = {
  root: {
    background: '#050d05',
    border: '1px solid #1e3320',
    borderRadius: '8px',
    overflow: 'hidden',
    fontFamily: 'monospace',
    maxWidth: '900px',
  },
  chrome: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    padding: '0.55rem 0.75rem',
    background: '#0d1b0d',
    borderBottom: '1px solid #1e3320',
  },
  dots: {
    display: 'flex',
    gap: '6px',
    alignItems: 'center',
  },
  dot: {
    width: '10px',
    height: '10px',
    borderRadius: '50%',
  },
  chromeTitle: {
    flex: 1,
    fontSize: '0.78rem',
    color: '#4a7a50',
    letterSpacing: '0.06em',
  },
  chromeRight: {
    fontSize: '0.75rem',
    letterSpacing: '0.08em',
  },
  tabs: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.25rem',
    padding: '0.4rem 0.75rem',
    borderBottom: '1px solid #1e3320',
    background: '#080f08',
    flexWrap: 'wrap',
  },
  tab: {
    fontFamily: 'monospace',
    fontSize: '0.72rem',
    letterSpacing: '0.08em',
    padding: '2px 10px',
    background: 'transparent',
    border: '1px solid #1e3320',
    borderRadius: '3px',
    color: '#4a7a50',
    cursor: 'pointer',
    transition: 'all 0.15s',
  },
  tabActive: {
    background: '#0d2210',
    borderColor: '#3ab54a',
    color: '#3ab54a',
  },
  tabCount: {
    marginLeft: 'auto',
    fontSize: '0.72rem',
    color: '#2d5e33',
  },
  cards: {
    padding: '0.5rem 0.75rem',
    maxHeight: '480px',
    overflowY: 'auto',
  },
  feedHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '0.4rem 0.75rem',
    borderTop: '1px solid #1e3320',
    borderBottom: '1px solid #1e3320',
    background: '#080f08',
    fontSize: '0.72rem',
    letterSpacing: '0.08em',
  },
  feed: {
    padding: '0.5rem 0.75rem',
    maxHeight: '160px',
    overflowY: 'auto',
    background: '#030803',
  },
  feedLine: {
    display: 'flex',
    gap: '1rem',
    fontSize: '0.74rem',
    lineHeight: 1.65,
  },
  feedTime: {
    color: '#1e3320',
    flexShrink: 0,
    userSelect: 'none',
  },
};
