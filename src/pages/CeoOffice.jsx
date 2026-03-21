import { useEffect, useRef, useState } from 'react';
import { Navigate } from 'react-router-dom';
import api from '../services/api';

function getUserRole() {
  try { return JSON.parse(localStorage.getItem('user') || '{}').role ?? null; } catch { return null; }
}

const TODAY = new Date().toLocaleDateString('en-GB', {
  weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
});

const QUICK_COMMANDS = [
  'Chase overdue invoices',
  'Generate weekly report',
  'Draft LA funding email',
  'HR summary',
  'What is on my calendar today?',
];

// ─── Markdown renderer (bold + line breaks) ─────────────────────────────────
function RenderAI({ text }) {
  if (!text) return null;
  return (
    <div style={styles.aiText}>
      {text.split('\n').map((line, i, arr) => {
        const parts = line.split(/\*\*(.*?)\*\*/g);
        return (
          <span key={i}>
            {parts.map((p, j) => j % 2 === 1 ? <strong key={j}>{p}</strong> : p)}
            {i < arr.length - 1 && <br />}
          </span>
        );
      })}
    </div>
  );
}

// ─── Spinner ─────────────────────────────────────────────────────────────────
function Spinner({ size = 16, colour = '#92400e' }) {
  return (
    <span style={{
      display: 'inline-block', width: size, height: size,
      border: `2px solid rgba(0,0,0,0.15)`, borderTopColor: colour,
      borderRadius: '50%', animation: 'spin 0.7s linear infinite',
    }} />
  );
}

// ─── SECTION 1 — Header + Morning Briefing ───────────────────────────────────
function BriefingHeader() {
  const [loading, setBriefingLoading]   = useState(false);
  const [briefing, setBriefing]         = useState('');
  const [expanded, setExpanded]         = useState(false);
  const [error, setError]               = useState('');

  async function generate() {
    setBriefingLoading(true);
    setError('');
    try {
      const res = await api.post('/api/ceo/briefing');
      setBriefing(res.data.briefing ?? res.data.answer ?? '');
      setExpanded(true);
    } catch (err) {
      setError(err.response?.data?.error ?? 'Briefing unavailable');
      setExpanded(true);
    } finally {
      setBriefingLoading(false);
    }
  }

  return (
    <div style={styles.headerWrap}>
      <div style={styles.header}>
        <div>
          <h1 style={styles.headerTitle}>👔 CEO Digital Office</h1>
          <p style={styles.headerDate}>{TODAY}</p>
        </div>
        <button style={styles.briefingBtn} onClick={generate} disabled={loading}>
          {loading ? <><Spinner size={14} colour="#92400e" /> &nbsp;Generating...</> : '✨ Morning Briefing'}
        </button>
      </div>

      {expanded && (
        <div style={styles.briefingPanel}>
          <div style={styles.briefingBar}>
            <span style={styles.briefingTitle}>Morning Briefing</span>
            <button style={styles.collapseBtn} onClick={() => setExpanded(false)}>✕</button>
          </div>
          {error
            ? <p style={styles.briefingError}>{error}</p>
            : <RenderAI text={briefing} />}
        </div>
      )}
    </div>
  );
}

// ─── SECTION 2 — Command Bar ─────────────────────────────────────────────────
function CommandBar() {
  const [input, setInput]     = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult]   = useState(null);
  const [error, setError]     = useState('');
  const inputRef              = useRef(null);

  async function send(cmd) {
    const q = (cmd ?? input).trim();
    if (!q || loading) return;
    setLoading(true);
    setResult(null);
    setError('');
    setInput('');
    try {
      const res = await api.post('/api/ceo/command', { command: q });
      setResult(res.data.result ?? res.data.answer ?? '');
    } catch (err) {
      setError(err.response?.data?.error ?? 'Command failed. Please try again.');
    } finally {
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }

  function handleKey(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  }

  return (
    <div style={styles.commandSection}>
      <div style={styles.commandInputRow}>
        <textarea
          ref={inputRef}
          style={styles.commandInput}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKey}
          placeholder="Type a command… e.g. chase invoices, draft email, weekly report"
          rows={2}
          disabled={loading}
        />
        <button
          style={{ ...styles.commandSendBtn, opacity: (!input.trim() || loading) ? 0.5 : 1 }}
          onClick={() => send()}
          disabled={!input.trim() || loading}
        >
          {loading ? <Spinner size={16} colour="#fff" /> : '↑ Send'}
        </button>
      </div>

      {/* Quick chips */}
      <div style={styles.chipsRow}>
        {QUICK_COMMANDS.map((c) => (
          <button key={c} style={styles.chip} onClick={() => send(c)} disabled={loading}>
            {c}
          </button>
        ))}
      </div>

      {/* Result */}
      {(result !== null || error) && (
        <div style={styles.commandResult}>
          {error
            ? <p style={styles.resultError}>{error}</p>
            : <RenderAI text={result} />}
        </div>
      )}
    </div>
  );
}

// ─── SECTION 3 LEFT — Calendar ───────────────────────────────────────────────
function CalendarPanel() {
  const [events, setEvents]     = useState([]);
  const [loading, setLoading]   = useState(true);
  const [connected, setConnected] = useState(true);
  const [prepNotes, setPrepNotes] = useState({});
  const [prepLoading, setPrepLoading] = useState({});
  const [showAddForm, setShowAddForm] = useState(false);

  useEffect(() => {
    api.get('/api/calendar/today')
      .then((res) => { setEvents(res.data.events ?? []); setConnected(true); })
      .catch((err) => {
        if (err.response?.status === 403 || err.response?.status === 401 || err.response?.data?.error?.includes('not connected')) {
          setConnected(false);
        }
        setEvents([]);
      })
      .finally(() => setLoading(false));
  }, []);

  async function connectCalendar() {
    try {
      const res = await api.get('/api/calendar/auth');
      if (res.data.url) window.location.href = res.data.url;
    } catch {
      alert('Calendar connection unavailable.');
    }
  }

  async function getPrep(event) {
    setPrepLoading((p) => ({ ...p, [event.id]: true }));
    try {
      const res = await api.post('/api/calendar/prep', { event_id: event.id, title: event.title });
      setPrepNotes((p) => ({ ...p, [event.id]: res.data.notes ?? res.data.answer ?? '' }));
    } catch (err) {
      setPrepNotes((p) => ({ ...p, [event.id]: `⚠️ ${err.response?.data?.error ?? 'Unavailable'}` }));
    } finally {
      setPrepLoading((p) => ({ ...p, [event.id]: false }));
    }
  }

  return (
    <div style={styles.panel}>
      <div style={styles.panelHeader}>
        <span style={styles.panelTitle}>📅 Today's Calendar</span>
        <button style={styles.panelActionBtn} onClick={() => setShowAddForm(!showAddForm)}>
          + Add Event
        </button>
      </div>

      {loading && <div style={styles.panelMsg}><Spinner /> &nbsp;Loading...</div>}

      {!loading && !connected && (
        <div style={styles.connectWrap}>
          <p style={styles.connectMsg}>Google Calendar not connected.</p>
          <button style={styles.connectBtn} onClick={connectCalendar}>
            🔗 Connect Google Account
          </button>
        </div>
      )}

      {!loading && connected && events.length === 0 && (
        <p style={styles.panelMsg}>No events today.</p>
      )}

      {!loading && connected && events.length > 0 && (
        <div style={styles.timeline}>
          {events.map((ev) => (
            <div key={ev.id} style={styles.eventItem}>
              <div style={styles.eventTime}>{ev.time ?? ev.start ?? '—'}</div>
              <div style={styles.eventBody}>
                <div style={styles.eventTitle}>{ev.title ?? ev.summary}</div>
                {ev.location && <div style={styles.eventMeta}>{ev.location}</div>}
                <button
                  style={styles.prepBtn}
                  onClick={() => getPrep(ev)}
                  disabled={prepLoading[ev.id]}
                >
                  {prepLoading[ev.id] ? <Spinner size={12} /> : '✨ Prep Notes'}
                </button>
                {prepNotes[ev.id] && (
                  <div style={styles.prepResult}>
                    <RenderAI text={prepNotes[ev.id]} />
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {showAddForm && (
        <AddEventForm onClose={() => setShowAddForm(false)} onAdded={() => {
          setShowAddForm(false);
          setLoading(true);
          api.get('/api/calendar/today')
            .then((r) => setEvents(r.data.events ?? []))
            .catch(() => {})
            .finally(() => setLoading(false));
        }} />
      )}
    </div>
  );
}

function AddEventForm({ onClose, onAdded }) {
  const [form, setForm]     = useState({ title: '', date: '', time: '', duration: '60' });
  const [saving, setSaving] = useState(false);
  const [err, setErr]       = useState('');

  async function submit(e) {
    e.preventDefault();
    setSaving(true);
    setErr('');
    try {
      await api.post('/api/calendar/events', form);
      onAdded();
    } catch (error) {
      setErr(error.response?.data?.error ?? 'Failed to add event');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={styles.inlineForm}>
      <div style={styles.inlineFormTitle}>New Event</div>
      {err && <div style={styles.inlineErr}>{err}</div>}
      <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
        <input style={styles.miniInput} placeholder="Title *" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
        <input style={styles.miniInput} type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} required />
        <input style={styles.miniInput} type="time" value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} />
        <input style={styles.miniInput} type="number" placeholder="Duration (min)" value={form.duration} onChange={(e) => setForm({ ...form, duration: e.target.value })} min={5} />
        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
          <button type="button" style={styles.cancelMini} onClick={onClose}>Cancel</button>
          <button type="submit" style={styles.saveMini} disabled={saving}>{saving ? '...' : 'Add'}</button>
        </div>
      </form>
    </div>
  );
}

// ─── SECTION 3 RIGHT — Gmail ──────────────────────────────────────────────────
function GmailPanel({ onCompose, onReply }) {
  const [messages, setMessages]   = useState([]);
  const [loading, setLoading]     = useState(true);
  const [connected, setConnected] = useState(true);
  const [expanded, setExpanded]   = useState(null);

  useEffect(() => {
    api.get('/api/gmail/messages')
      .then((res) => { setMessages((res.data.messages ?? []).slice(0, 10)); setConnected(true); })
      .catch((err) => {
        if (err.response?.status === 403 || err.response?.data?.error?.includes('not connected')) {
          setConnected(false);
        }
        setMessages([]);
      })
      .finally(() => setLoading(false));
  }, []);

  async function connectGmail() {
    try {
      const res = await api.get('/api/gmail/auth');
      if (res.data.url) window.location.href = res.data.url;
    } catch {
      alert('Gmail connection unavailable.');
    }
  }

  function formatTime(ts) {
    if (!ts) return '';
    const d = new Date(ts);
    const now = new Date();
    if (d.toDateString() === now.toDateString()) {
      return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    }
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
  }

  return (
    <div style={styles.panel}>
      <div style={styles.panelHeader}>
        <span style={styles.panelTitle}>📧 Gmail Inbox</span>
        <button style={styles.panelActionBtn} onClick={onCompose}>
          + Compose
        </button>
      </div>

      {loading && <div style={styles.panelMsg}><Spinner /> &nbsp;Loading...</div>}

      {!loading && !connected && (
        <div style={styles.connectWrap}>
          <p style={styles.connectMsg}>Gmail not connected.</p>
          <button style={styles.connectBtn} onClick={connectGmail}>
            🔗 Connect Google Account
          </button>
        </div>
      )}

      {!loading && connected && messages.length === 0 && (
        <p style={styles.panelMsg}>No messages found.</p>
      )}

      {!loading && connected && messages.length > 0 && (
        <div style={styles.messageList}>
          {messages.map((msg) => (
            <div key={msg.id} style={styles.messageItem}>
              <div style={styles.messageRow} onClick={() => setExpanded(expanded === msg.id ? null : msg.id)}>
                <div style={styles.messageLeft}>
                  <div style={styles.messageFrom}>{msg.from ?? msg.sender ?? 'Unknown'}</div>
                  <div style={styles.messageSubject}>{msg.subject ?? '(no subject)'}</div>
                </div>
                <div style={styles.messageTime}>{formatTime(msg.date ?? msg.timestamp)}</div>
              </div>
              {expanded === msg.id && (
                <div style={styles.messageExpanded}>
                  <div style={styles.messageBody}>{msg.snippet ?? msg.body ?? '—'}</div>
                  <button
                    style={styles.replyBtn}
                    onClick={() => onReply(msg)}
                  >
                    ✨ Reply with AI
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Compose Modal ────────────────────────────────────────────────────────────
function ComposeModal({ prefill, onClose }) {
  const [form, setForm]       = useState({ to: prefill?.to ?? '', subject: prefill?.subject ?? '', body: prefill?.body ?? '' });
  const [drafting, setDrafting] = useState(false);
  const [sending, setSending] = useState(false);
  const [err, setErr]         = useState('');

  async function aiDraft() {
    setDrafting(true);
    setErr('');
    try {
      const prompt = `Draft a professional email reply to: ${form.subject || 'this email'}. ${form.body ? 'Context: ' + form.body : ''}`;
      const res = await api.post('/api/ceo/command', { command: prompt });
      setForm((f) => ({ ...f, body: res.data.result ?? res.data.answer ?? f.body }));
    } catch (error) {
      setErr(error.response?.data?.error ?? 'AI draft failed');
    } finally {
      setDrafting(false);
    }
  }

  async function send(e) {
    e.preventDefault();
    setSending(true);
    setErr('');
    try {
      await api.post('/api/gmail/send', { to: form.to, subject: form.subject, body: form.body });
      onClose();
    } catch (error) {
      setErr(error.response?.data?.error ?? 'Send failed');
    } finally {
      setSending(false);
    }
  }

  return (
    <div style={styles.modalOverlay}>
      <div style={styles.modal}>
        <div style={styles.modalHeader}>
          <h2 style={styles.modalTitle}>Compose Email</h2>
          <button style={styles.modalClose} onClick={onClose}>✕</button>
        </div>
        {err && <div style={styles.modalErr}>{err}</div>}
        <form onSubmit={send} style={styles.composeForm}>
          <label style={styles.composeLabel}>To</label>
          <input style={styles.composeInput} type="email" value={form.to} onChange={(e) => setForm({ ...form, to: e.target.value })} placeholder="recipient@example.com" required />
          <label style={styles.composeLabel}>Subject</label>
          <input style={styles.composeInput} value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} placeholder="Subject" required />
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '0.5rem' }}>
            <label style={styles.composeLabel}>Body</label>
            <button type="button" style={styles.aiDraftBtn} onClick={aiDraft} disabled={drafting}>
              {drafting ? <><Spinner size={12} colour="#92400e" /> &nbsp;Drafting...</> : '✨ AI Draft'}
            </button>
          </div>
          <textarea
            style={styles.composeTextarea}
            value={form.body}
            onChange={(e) => setForm({ ...form, body: e.target.value })}
            placeholder="Email body..."
            rows={8}
            required
          />
          <div style={styles.composeActions}>
            <button type="button" style={styles.cancelBtn} onClick={onClose}>Cancel</button>
            <button type="submit" style={styles.sendEmailBtn} disabled={sending}>
              {sending ? 'Sending...' : '📤 Send'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function CeoOffice() {
  if (getUserRole() !== 'ADMIN') return <Navigate to="/" replace />;

  const [compose, setCompose] = useState(null); // null | { to, subject, body }

  function handleReply(msg) {
    setCompose({
      to: msg.replyTo ?? msg.from ?? '',
      subject: `Re: ${msg.subject ?? ''}`,
      body: '',
    });
  }

  return (
    <div style={styles.page}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>

      {/* Section 1 — Header + Briefing */}
      <BriefingHeader />

      {/* Section 2 — Command Bar */}
      <CommandBar />

      {/* Section 3 — Two column */}
      <div style={styles.twoCol}>
        <CalendarPanel />
        <GmailPanel onCompose={() => setCompose({})} onReply={handleReply} />
      </div>

      {/* Compose Modal */}
      {compose !== null && (
        <ComposeModal prefill={compose} onClose={() => setCompose(null)} />
      )}
    </div>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = {
  page: { display: 'flex', flexDirection: 'column', gap: '1.25rem' },

  // Header
  headerWrap: {
    background: 'linear-gradient(135deg, #92400e 0%, #b45309 50%, #d97706 100%)',
    borderRadius: '12px', overflow: 'hidden',
    boxShadow: '0 4px 16px rgba(146,64,14,0.25)',
  },
  header: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '1.25rem 1.5rem', flexWrap: 'wrap', gap: '1rem',
  },
  headerTitle: { margin: 0, fontSize: '1.4rem', fontWeight: 800, color: '#fff', letterSpacing: '-0.3px' },
  headerDate:  { margin: '4px 0 0', fontSize: '0.82rem', color: 'rgba(255,255,255,0.75)' },
  briefingBtn: {
    padding: '0.6rem 1.25rem', background: 'rgba(255,255,255,0.15)',
    border: '1px solid rgba(255,255,255,0.4)', borderRadius: '8px',
    color: '#fff', fontSize: '0.9rem', fontWeight: 700, cursor: 'pointer',
    display: 'flex', alignItems: 'center', gap: '0.4rem', whiteSpace: 'nowrap',
    backdropFilter: 'blur(4px)',
  },
  briefingPanel: {
    background: 'rgba(0,0,0,0.25)', borderTop: '1px solid rgba(255,255,255,0.15)',
    padding: '1rem 1.5rem',
  },
  briefingBar: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' },
  briefingTitle: { fontSize: '0.8rem', fontWeight: 700, color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase', letterSpacing: '1px' },
  collapseBtn: { background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.6)', cursor: 'pointer', fontSize: '1rem', padding: '0 0.25rem' },
  briefingError: { color: '#fca5a5', fontSize: '0.88rem' },
  aiText: { fontSize: '0.9rem', lineHeight: 1.7, color: 'rgba(255,255,255,0.9)' },

  // Command Bar
  commandSection: {
    background: '#fff', borderRadius: '12px', padding: '1.25rem',
    border: '1px solid #e5e7eb', boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
  },
  commandInputRow: { display: 'flex', gap: '0.75rem', alignItems: 'flex-end' },
  commandInput: {
    flex: 1, padding: '0.75rem 1rem', border: '2px solid #fbbf24',
    borderRadius: '10px', fontSize: '0.95rem', resize: 'none',
    fontFamily: 'system-ui, sans-serif', lineHeight: 1.5, outline: 'none',
    background: '#fffbeb',
  },
  commandSendBtn: {
    padding: '0.75rem 1.5rem', background: '#b45309', color: '#fff',
    border: 'none', borderRadius: '10px', fontSize: '0.9rem', fontWeight: 700,
    cursor: 'pointer', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center',
    gap: '0.4rem', minWidth: '90px', justifyContent: 'center',
  },
  chipsRow: { display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.75rem' },
  chip: {
    padding: '5px 14px', borderRadius: '20px', border: '1px solid #fbbf24',
    background: '#fef3c7', color: '#92400e', fontSize: '0.82rem',
    cursor: 'pointer', fontWeight: 500, whiteSpace: 'nowrap',
  },
  commandResult: {
    marginTop: '1rem', padding: '1rem', background: '#fffbeb',
    border: '1px solid #fde68a', borderRadius: '8px',
  },
  resultError: { color: '#dc2626', fontSize: '0.88rem', margin: 0 },

  // Two column
  twoCol: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' },

  // Panel shared
  panel: {
    background: '#fff', borderRadius: '12px', border: '1px solid #e5e7eb',
    boxShadow: '0 1px 4px rgba(0,0,0,0.05)', overflow: 'hidden',
    display: 'flex', flexDirection: 'column',
  },
  panelHeader: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '0.9rem 1rem', borderBottom: '1px solid #f3f4f6',
    background: '#f9fafb',
  },
  panelTitle: { fontWeight: 700, fontSize: '0.95rem', color: '#1a1a2e' },
  panelActionBtn: {
    padding: '4px 12px', background: '#1a1a2e', color: '#fff',
    border: 'none', borderRadius: '6px', fontSize: '0.8rem', cursor: 'pointer',
  },
  panelMsg: { padding: '1.5rem', textAlign: 'center', color: '#9ca3af', fontSize: '0.88rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' },

  // Connect state
  connectWrap: { padding: '2rem', textAlign: 'center' },
  connectMsg: { color: '#6b7280', fontSize: '0.88rem', marginBottom: '0.75rem' },
  connectBtn: {
    padding: '0.6rem 1.25rem', background: '#4285f4', color: '#fff',
    border: 'none', borderRadius: '8px', fontSize: '0.88rem', cursor: 'pointer', fontWeight: 600,
  },

  // Calendar
  timeline: { display: 'flex', flexDirection: 'column', padding: '0.5rem 0', overflowY: 'auto', maxHeight: '420px' },
  eventItem: { display: 'flex', gap: '0.75rem', padding: '0.75rem 1rem', borderBottom: '1px solid #f3f4f6' },
  eventTime: { fontSize: '0.78rem', color: '#d97706', fontWeight: 700, minWidth: '50px', paddingTop: '2px' },
  eventBody: { flex: 1 },
  eventTitle: { fontWeight: 600, fontSize: '0.88rem', color: '#1a1a2e' },
  eventMeta: { fontSize: '0.78rem', color: '#9ca3af', marginTop: '2px' },
  prepBtn: {
    marginTop: '0.4rem', padding: '3px 10px', background: '#fffbeb',
    border: '1px solid #fbbf24', borderRadius: '5px', color: '#92400e',
    fontSize: '0.75rem', cursor: 'pointer', fontWeight: 500,
    display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
  },
  prepResult: {
    marginTop: '0.5rem', padding: '0.6rem 0.75rem', background: '#f9fafb',
    border: '1px solid #e5e7eb', borderRadius: '6px', fontSize: '0.82rem', color: '#374151',
  },

  // Add event inline form
  inlineForm: {
    margin: '0.75rem 1rem', padding: '0.9rem', background: '#fffbeb',
    border: '1px solid #fde68a', borderRadius: '8px',
  },
  inlineFormTitle: { fontWeight: 700, fontSize: '0.85rem', color: '#92400e', marginBottom: '0.6rem' },
  inlineErr: { color: '#dc2626', fontSize: '0.8rem', marginBottom: '0.5rem' },
  miniInput: {
    padding: '0.45rem 0.65rem', border: '1px solid #d1d5db', borderRadius: '6px',
    fontSize: '0.85rem', width: '100%', boxSizing: 'border-box', background: '#fff',
  },
  cancelMini: {
    padding: '4px 12px', background: 'transparent', border: '1px solid #d1d5db',
    borderRadius: '5px', fontSize: '0.82rem', cursor: 'pointer', color: '#374151',
  },
  saveMini: {
    padding: '4px 14px', background: '#b45309', color: '#fff',
    border: 'none', borderRadius: '5px', fontSize: '0.82rem', cursor: 'pointer', fontWeight: 600,
  },

  // Gmail
  messageList: { display: 'flex', flexDirection: 'column', overflowY: 'auto', maxHeight: '420px' },
  messageItem: { borderBottom: '1px solid #f3f4f6' },
  messageRow: {
    display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
    padding: '0.75rem 1rem', cursor: 'pointer', gap: '0.5rem',
  },
  messageLeft: { flex: 1, minWidth: 0 },
  messageFrom: { fontWeight: 600, fontSize: '0.82rem', color: '#1a1a2e', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  messageSubject: { fontSize: '0.8rem', color: '#6b7280', marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  messageTime: { fontSize: '0.75rem', color: '#9ca3af', whiteSpace: 'nowrap', flexShrink: 0 },
  messageExpanded: { padding: '0.5rem 1rem 0.75rem', background: '#f9fafb', borderTop: '1px solid #f3f4f6' },
  messageBody: { fontSize: '0.82rem', color: '#374151', lineHeight: 1.6, marginBottom: '0.5rem' },
  replyBtn: {
    padding: '4px 12px', background: '#fffbeb', border: '1px solid #fbbf24',
    borderRadius: '5px', color: '#92400e', fontSize: '0.78rem', cursor: 'pointer', fontWeight: 600,
  },

  // Modal
  modalOverlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
  },
  modal: {
    background: '#fff', borderRadius: '14px', width: '100%', maxWidth: '560px',
    boxShadow: '0 24px 60px rgba(0,0,0,0.2)', overflow: 'hidden',
  },
  modalHeader: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '1.1rem 1.5rem', background: '#92400e',
  },
  modalTitle: { margin: 0, fontSize: '1.05rem', fontWeight: 700, color: '#fff' },
  modalClose: { background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.8)', cursor: 'pointer', fontSize: '1.1rem', padding: 0 },
  modalErr: { margin: '0.75rem 1.5rem 0', padding: '0.5rem 0.75rem', background: '#fee2e2', color: '#991b1b', borderRadius: '6px', fontSize: '0.85rem' },
  composeForm: { display: 'flex', flexDirection: 'column', gap: '0.5rem', padding: '1.25rem 1.5rem' },
  composeLabel: { fontSize: '0.8rem', fontWeight: 600, color: '#374151' },
  composeInput: { padding: '0.55rem 0.75rem', border: '1px solid #d1d5db', borderRadius: '7px', fontSize: '0.9rem', background: '#f9fafb', outline: 'none' },
  composeTextarea: {
    padding: '0.65rem 0.75rem', border: '1px solid #d1d5db', borderRadius: '7px',
    fontSize: '0.9rem', background: '#f9fafb', resize: 'vertical',
    fontFamily: 'system-ui, sans-serif', lineHeight: 1.5, outline: 'none',
  },
  aiDraftBtn: {
    padding: '4px 12px', background: '#fffbeb', border: '1px solid #fbbf24',
    borderRadius: '5px', color: '#92400e', fontSize: '0.8rem', cursor: 'pointer',
    fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
  },
  composeActions: { display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' },
  cancelBtn: {
    padding: '0.55rem 1.25rem', background: 'transparent', border: '1px solid #d1d5db',
    borderRadius: '7px', fontSize: '0.9rem', cursor: 'pointer', color: '#374151',
  },
  sendEmailBtn: {
    padding: '0.55rem 1.5rem', background: '#b45309', color: '#fff',
    border: 'none', borderRadius: '7px', fontSize: '0.9rem', fontWeight: 700, cursor: 'pointer',
  },
};
