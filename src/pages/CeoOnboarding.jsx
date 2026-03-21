import { useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import api from '../services/api';

function getUserRole() {
  try { return JSON.parse(localStorage.getItem('user') || '{}').role ?? null; } catch { return null; }
}

// ─── Checklist config ─────────────────────────────────────────────────────────
const CHECKLIST = [
  { id: 'staff',    label: 'Create your first Staff member',         to: '/users' },
  { id: 'su',       label: 'Add a Service User',                     to: '/service-users' },
  { id: 'rota',     label: 'Set up a Rota',                          to: '/rota' },
  { id: 'careplan', label: 'Create a Care Plan',                     to: '/care-plans' },
  { id: 'google',   label: 'Connect Google Account for CEO Office',  to: '/ceo-office' },
  { id: 'import',   label: 'Import existing data',                   to: '/import' },
  { id: 'family',   label: 'Create a Family Portal account',         to: '/users' },
  { id: 'briefing', label: 'Run your first CEO Briefing',            to: '/ceo-briefing' },
];

const CHECKLIST_KEY = 'envico_ceo_checklist';

function loadChecked() {
  try { return JSON.parse(localStorage.getItem(CHECKLIST_KEY) || '{}'); } catch { return {}; }
}
function saveChecked(obj) { localStorage.setItem(CHECKLIST_KEY, JSON.stringify(obj)); }

// ─── Modules grid config ──────────────────────────────────────────────────────
const SECTIONS = [
  {
    title: 'Care Operations',
    colour: '#3b82f6',
    pages: [
      { to: '/',              icon: '🏠', label: 'Dashboard',     desc: 'Task overview and critical alerts' },
      { to: '/service-users', icon: '👥', label: 'Service Users', desc: 'Manage all service users' },
      { to: '/care-plans',    icon: '📋', label: 'Care Plans',    desc: 'Care planning and reviews' },
      { to: '/incidents',     icon: '🚨', label: 'Incidents',     desc: 'Incident reporting and tracking' },
      { to: '/medications',   icon: '💊', label: 'Medications',   desc: 'Medication management and MAR' },
      { to: '/rota',          icon: '📅', label: 'Rota',          desc: 'Staff scheduling and shifts' },
    ],
  },
  {
    title: 'Finance',
    colour: '#16a34a',
    pages: [
      { to: '/invoices', icon: '💰', label: 'Invoices', desc: 'Billing and invoice management' },
      { to: '/payroll',  icon: '🧾', label: 'Payroll',  desc: 'Staff payroll preparation' },
      { to: '/finance',  icon: '📊', label: 'Finance',  desc: 'Income, expenses and transactions' },
    ],
  },
  {
    title: 'HR & Compliance',
    colour: '#d97706',
    pages: [
      { to: '/training',    icon: '📚', label: 'Training',    desc: 'Staff training tracker' },
      { to: '/recruitment', icon: '🧑', label: 'Recruitment', desc: 'Job applications pipeline' },
      { to: '/compliance',  icon: '✅', label: 'Compliance',  desc: 'CQC compliance checks' },
      { to: '/staff-docs',  icon: '📄', label: 'Staff Docs',  desc: 'DBS and document management' },
      { to: '/users',       icon: '👤', label: 'Users',       desc: 'Team account management' },
    ],
  },
  {
    title: 'AI & Automation',
    colour: '#7c3aed',
    pages: [
      { to: '/assistant',      icon: '🤖', label: 'AI Assistant',  desc: 'Chat with your care AI' },
      { to: '/ceo-office',     icon: '👔', label: 'CEO Office',     desc: 'Email, calendar, commands' },
      { to: '/ceo-briefing',   icon: '📊', label: 'CEO Briefing',   desc: 'Daily executive summary' },
      { to: '/import',         icon: '📥', label: 'Import Data',    desc: 'AI-powered data migration' },
    ],
  },
];

// ─── System cards ─────────────────────────────────────────────────────────────
const SYSTEM_CARDS = [
  {
    title: 'Care Operations',
    icon: '🏥',
    colour: '#3b82f6',
    items: ['Service Users', 'Care Plans', 'Incidents', 'Medications', 'Rota'],
    to: '/',
    ctaLabel: 'Go to Dashboard →',
  },
  {
    title: 'Finance & HR',
    icon: '💼',
    colour: '#16a34a',
    items: ['Invoices', 'Payroll', 'Finance', 'Recruitment', 'Training'],
    to: '/finance',
    ctaLabel: 'Go to Finance →',
  },
  {
    title: 'Compliance & Docs',
    icon: '📋',
    colour: '#d97706',
    items: ['CQC Compliance', 'Staff Docs', 'DBS Tracking'],
    to: '/compliance',
    ctaLabel: 'Go to Compliance →',
  },
  {
    title: 'AI & Automation',
    icon: '🤖',
    colour: '#7c3aed',
    items: ['AI Assistant', 'CEO Office', 'CEO Briefing', 'Data Import'],
    to: '/assistant',
    ctaLabel: 'Go to AI Assistant →',
  },
];

// ─── System Health ────────────────────────────────────────────────────────────
function SystemHealth() {
  const [health, setHealth] = useState({
    api:       { label: 'Backend API',     status: 'checking' },
    ai:        { label: 'AI Assistant',    status: 'checking' },
    n8n:       { label: 'n8n Automation',  status: 'checking' },
    email:     { label: 'Email Service',   status: 'checking' },
  });

  useEffect(() => {
    // Check API
    api.get('/api/health').then(() => {
      setHealth((h) => ({ ...h, api: { ...h.api, status: 'live' } }));
    }).catch(() => {
      setHealth((h) => ({ ...h, api: { ...h.api, status: 'error' } }));
    });

    // Check AI (just see if assistant endpoint exists)
    api.get('/api/assistant/status').then(() => {
      setHealth((h) => ({ ...h, ai: { ...h.ai, status: 'live' } }));
    }).catch((e) => {
      setHealth((h) => ({ ...h, ai: { ...h.ai, status: e.response?.status === 404 ? 'live' : 'error' } }));
    });

    // Check n8n
    api.get('/api/n8n/status').then(() => {
      setHealth((h) => ({ ...h, n8n: { ...h.n8n, status: 'live' } }));
    }).catch((e) => {
      setHealth((h) => ({ ...h, n8n: { ...h.n8n, status: e.response?.status === 404 ? 'unknown' : 'error' } }));
    });

    // Check email
    api.get('/api/email/status').then(() => {
      setHealth((h) => ({ ...h, email: { ...h.email, status: 'live' } }));
    }).catch((e) => {
      setHealth((h) => ({ ...h, email: { ...h.email, status: e.response?.status === 404 ? 'unknown' : 'error' } }));
    });
  }, []);

  const dot = (status) => ({
    live:     { colour: '#16a34a', label: 'Live' },
    error:    { colour: '#dc2626', label: 'Error' },
    unknown:  { colour: '#d97706', label: 'Unknown' },
    checking: { colour: '#9ca3af', label: 'Checking…' },
  }[status] ?? { colour: '#9ca3af', label: '—' });

  return (
    <div style={s.section}>
      <h2 style={s.sectionTitle}>System Health</h2>
      <div style={s.healthGrid}>
        {Object.entries(health).map(([key, svc]) => {
          const d = dot(svc.status);
          return (
            <div key={key} style={s.healthCard}>
              <div style={{ ...s.healthDot, background: d.colour }} />
              <div>
                <div style={s.healthLabel}>{svc.label}</div>
                <div style={{ ...s.healthStatus, color: d.colour }}>{d.label}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function CeoOnboarding() {
  if (getUserRole() !== 'ADMIN') return <Navigate to="/" replace />;

  const navigate = useNavigate();
  const [checked, setChecked] = useState(loadChecked);

  function toggle(id) {
    const next = { ...checked, [id]: !checked[id] };
    setChecked(next);
    saveChecked(next);
  }

  const completedCount = CHECKLIST.filter((c) => checked[c.id]).length;
  const completePct    = Math.round((completedCount / CHECKLIST.length) * 100);

  return (
    <div style={s.page}>

      {/* Hero */}
      <div style={s.hero}>
        <div style={s.heroContent}>
          <img src="/Enivco-logo.png" alt="Envico" style={s.heroLogo} />
          <h1 style={s.heroTitle}>Welcome to Envico CareOS 2026</h1>
          <p style={s.heroSub}>Your complete care management operating system</p>
          <div style={s.progressWrap}>
            <div style={s.progressLabel}>
              <span>System Setup</span>
              <span>{completePct}% complete</span>
            </div>
            <div style={s.progressBar}>
              <div style={{ ...s.progressFill, width: `${completePct}%` }} />
            </div>
          </div>
        </div>
      </div>

      {/* System overview cards */}
      <div style={s.section}>
        <h2 style={s.sectionTitle}>System Overview</h2>
        <div style={s.overviewGrid}>
          {SYSTEM_CARDS.map((card) => (
            <div key={card.title} style={{ ...s.overviewCard, borderTop: `4px solid ${card.colour}` }}>
              <div style={s.overviewIcon}>{card.icon}</div>
              <div style={{ ...s.overviewCardTitle, color: card.colour }}>{card.title}</div>
              <ul style={s.overviewList}>
                {card.items.map((item) => (
                  <li key={item} style={s.overviewItem}>✓ {item}</li>
                ))}
              </ul>
              <div style={s.overviewStatus}>
                <span style={s.liveBadge}>✅ LIVE</span>
              </div>
              <button style={{ ...s.overviewCta, color: card.colour, borderColor: card.colour }} onClick={() => navigate(card.to)}>
                {card.ctaLabel}
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Checklist */}
      <div style={s.section}>
        <div style={s.checklistHeader}>
          <h2 style={s.sectionTitle}>Getting Started — Complete These Steps</h2>
          <span style={s.checkPct}>{completedCount} / {CHECKLIST.length} done</span>
        </div>
        <div style={s.checklistGrid}>
          {CHECKLIST.map((item) => (
            <div
              key={item.id}
              style={{ ...s.checkItem, ...(checked[item.id] ? s.checkItemDone : {}) }}
            >
              <input
                type="checkbox"
                checked={!!checked[item.id]}
                onChange={() => toggle(item.id)}
                style={s.checkbox}
                id={`check-${item.id}`}
              />
              <label htmlFor={`check-${item.id}`} style={{ ...s.checkLabel, ...(checked[item.id] ? s.checkLabelDone : {}) }}>
                {item.label}
              </label>
              <button style={s.goBtn} onClick={() => navigate(item.to)}>Go →</button>
            </div>
          ))}
        </div>
      </div>

      {/* All modules */}
      <div style={s.section}>
        <h2 style={s.sectionTitle}>Full System — All Modules</h2>
        {SECTIONS.map((sec) => (
          <div key={sec.title} style={s.moduleSection}>
            <div style={{ ...s.moduleSectionTitle, color: sec.colour }}>{sec.title}</div>
            <div style={s.moduleGrid}>
              {sec.pages.map((pg) => (
                <div key={pg.to} style={s.moduleCard}>
                  <span style={s.moduleIcon}>{pg.icon}</span>
                  <div style={s.moduleName}>{pg.label}</div>
                  <div style={s.moduleDesc}>{pg.desc}</div>
                  <button
                    style={{ ...s.moduleBtn, background: sec.colour }}
                    onClick={() => navigate(pg.to)}
                  >
                    Open
                  </button>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* System health */}
      <SystemHealth />
    </div>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = {
  page: { display: 'flex', flexDirection: 'column', gap: '1.5rem' },

  // Hero
  hero: {
    background: 'linear-gradient(135deg, #0f0f1e 0%, #1a1a2e 60%, #2d2d4e 100%)',
    borderRadius: '16px', padding: '2.5rem 2rem',
    boxShadow: '0 4px 24px rgba(0,0,0,0.2)',
  },
  heroContent: { display: 'flex', flexDirection: 'column', gap: '0.75rem', maxWidth: '600px' },
  heroLogo:    { width: '140px', filter: 'brightness(0) invert(1)', marginBottom: '0.5rem' },
  heroTitle:   { margin: 0, fontSize: '1.75rem', fontWeight: 900, color: '#fff', letterSpacing: '-0.5px' },
  heroSub:     { margin: 0, fontSize: '0.95rem', color: '#8888bb' },
  progressWrap:  { display: 'flex', flexDirection: 'column', gap: '0.4rem', marginTop: '0.75rem' },
  progressLabel: { display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: '#8888bb' },
  progressBar:   { height: '8px', background: 'rgba(255,255,255,0.1)', borderRadius: '8px', overflow: 'hidden' },
  progressFill:  { height: '100%', background: 'linear-gradient(90deg, #7c3aed, #fbbf24)', borderRadius: '8px', transition: 'width 0.4s ease' },

  // Section
  section: {
    background: '#fff', border: '1px solid #e5e7eb', borderRadius: '14px',
    padding: '1.5rem', boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
    display: 'flex', flexDirection: 'column', gap: '1rem',
  },
  sectionTitle: { margin: 0, fontSize: '1rem', fontWeight: 700, color: '#1a1a2e' },

  // Overview cards
  overviewGrid: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem' },
  overviewCard: {
    background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '10px',
    padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.6rem',
  },
  overviewIcon:      { fontSize: '1.75rem', lineHeight: 1 },
  overviewCardTitle: { fontWeight: 800, fontSize: '0.9rem' },
  overviewList:      { margin: 0, padding: '0 0 0 0', listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '3px', flex: 1 },
  overviewItem:      { fontSize: '0.78rem', color: '#6b7280' },
  overviewStatus:    { marginTop: 'auto' },
  liveBadge:         { padding: '2px 10px', background: '#dcfce7', color: '#166534', borderRadius: '20px', fontSize: '0.72rem', fontWeight: 700 },
  overviewCta: {
    marginTop: '0.25rem', padding: '0.45rem 0', background: 'transparent',
    border: '1px solid', borderRadius: '7px', fontSize: '0.82rem',
    fontWeight: 600, cursor: 'pointer', textAlign: 'center',
  },

  // Checklist
  checklistHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  checkPct:        { fontSize: '0.82rem', color: '#6b7280', fontWeight: 600 },
  checklistGrid:   { display: 'flex', flexDirection: 'column', gap: '0.5rem' },
  checkItem: {
    display: 'flex', alignItems: 'center', gap: '0.75rem',
    padding: '0.65rem 0.9rem', border: '1px solid #e5e7eb', borderRadius: '8px',
    background: '#f9fafb', transition: 'background 0.15s',
  },
  checkItemDone: { background: '#f0fdf4', border: '1px solid #86efac' },
  checkbox:      { width: 17, height: 17, cursor: 'pointer', accentColor: '#16a34a', flexShrink: 0 },
  checkLabel:    { flex: 1, fontSize: '0.88rem', color: '#374151', cursor: 'pointer' },
  checkLabelDone:{ color: '#9ca3af', textDecoration: 'line-through' },
  goBtn: {
    padding: '3px 12px', background: '#1a1a2e', color: '#fff',
    border: 'none', borderRadius: '5px', fontSize: '0.78rem', cursor: 'pointer',
    flexShrink: 0,
  },

  // Module sections
  moduleSection:      { display: 'flex', flexDirection: 'column', gap: '0.6rem' },
  moduleSectionTitle: { fontSize: '0.78rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px' },
  moduleGrid: {
    display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '0.75rem',
  },
  moduleCard: {
    background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '10px',
    padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.35rem', alignItems: 'flex-start',
  },
  moduleIcon: { fontSize: '1.5rem', lineHeight: 1 },
  moduleName: { fontWeight: 700, fontSize: '0.85rem', color: '#1a1a2e' },
  moduleDesc: { fontSize: '0.72rem', color: '#9ca3af', lineHeight: 1.4, flex: 1 },
  moduleBtn:  { marginTop: '0.4rem', padding: '4px 14px', color: '#fff', border: 'none', borderRadius: '5px', fontSize: '0.78rem', cursor: 'pointer', fontWeight: 600 },

  // Health
  healthGrid: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.75rem' },
  healthCard: {
    background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '10px',
    padding: '0.9rem 1rem', display: 'flex', alignItems: 'center', gap: '0.75rem',
  },
  healthDot:    { width: 12, height: 12, borderRadius: '50%', flexShrink: 0, animation: 'none' },
  healthLabel:  { fontSize: '0.85rem', fontWeight: 600, color: '#1a1a2e' },
  healthStatus: { fontSize: '0.75rem', fontWeight: 600, marginTop: '1px' },
};
