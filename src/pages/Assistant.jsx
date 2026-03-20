import { useEffect, useRef, useState } from 'react';
import api from '../services/api';

const CONTEXTS = [
  { value: 'GENERAL',      label: '🌐 General',        desc: 'System overview & general questions' },
  { value: 'TASK',         label: '✅ Tasks',           desc: 'Open tasks, priorities, assignments' },
  { value: 'SERVICE_USER', label: '👥 Service Users',  desc: 'Care data, medications, incidents' },
  { value: 'COMPLIANCE',   label: '📋 Compliance',      desc: 'CQC checks, action items' },
  { value: 'MEDICATION',   label: '💊 Medications',     desc: 'Active medications & alerts' },
];

const QUICK_QUESTIONS = [
  { label: 'Critical tasks today?',     question: 'Which tasks are currently critical or overdue and need immediate attention?', context: 'TASK' },
  { label: 'Overdue compliance?',       question: 'Are there any overdue or action-required compliance checks?',                  context: 'COMPLIANCE' },
  { label: 'Medication alerts',         question: 'Are there any active medication concerns or alerts I should be aware of?',     context: 'MEDICATION' },
  { label: 'Draft safeguarding note',   question: 'Draft a professional safeguarding concern note template I can use for recording an incident.', context: 'GENERAL' },
];

function TypingIndicator() {
  return (
    <div style={bubbleStyles.aiWrap}>
      <div style={bubbleStyles.avatar}>AI</div>
      <div style={{ ...bubbleStyles.aiBubble, padding: '0.75rem 1rem' }}>
        <span style={bubbleStyles.typingDot} />
        <span style={{ ...bubbleStyles.typingDot, animationDelay: '0.2s' }} />
        <span style={{ ...bubbleStyles.typingDot, animationDelay: '0.4s' }} />
      </div>
    </div>
  );
}

function MessageBubble({ msg }) {
  const isUser = msg.role === 'user';
  // Render newlines as line breaks
  const lines = msg.content.split('\n');

  if (isUser) {
    return (
      <div style={bubbleStyles.userWrap}>
        <div style={bubbleStyles.userBubble}>
          {msg.content}
        </div>
      </div>
    );
  }

  return (
    <div style={bubbleStyles.aiWrap}>
      <div style={bubbleStyles.avatar}>AI</div>
      <div style={bubbleStyles.aiBubble}>
        {lines.map((line, i) => {
          // Bold: **text**
          const parts = line.split(/\*\*(.*?)\*\*/g);
          return (
            <span key={i}>
              {parts.map((part, j) =>
                j % 2 === 1 ? <strong key={j}>{part}</strong> : part
              )}
              {i < lines.length - 1 && <br />}
            </span>
          );
        })}
        {msg.model && (
          <div style={bubbleStyles.modelTag}>{msg.model}</div>
        )}
      </div>
    </div>
  );
}

export default function Assistant() {
  const [messages, setMessages] = useState([
    {
      id: 0,
      role: 'ai',
      content: "Hello! I'm your Envico CareOS AI Assistant, powered by Claude.\n\nI can help you with tasks, service user queries, compliance checks, medications, and more. Select a context above and ask me anything.",
    },
  ]);
  const [input, setInput] = useState('');
  const [context, setContext] = useState('GENERAL');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  async function send(question, overrideContext) {
    const q = (question ?? input).trim();
    if (!q || loading) return;
    const ctx = overrideContext ?? context;

    setInput('');
    setError('');
    setMessages((prev) => [...prev, { id: Date.now(), role: 'user', content: q }]);
    setLoading(true);

    try {
      const res = await api.post('/api/assistant/ask', {
        question: q,
        context_type: ctx,
      });
      setMessages((prev) => [
        ...prev,
        { id: Date.now() + 1, role: 'ai', content: res.data.answer, model: res.data.model },
      ]);
    } catch (err) {
      const msg = err.response?.data?.error ?? err.response?.data?.message ?? 'The AI assistant is unavailable. Please try again.';
      setError(msg);
      setMessages((prev) => [
        ...prev,
        { id: Date.now() + 1, role: 'ai', content: `⚠️ ${msg}`, isError: true },
      ]);
    } finally {
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }

  function handleKey(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  function useQuickQuestion(q) {
    setContext(q.context);
    send(q.question, q.context);
  }

  const activeCtx = CONTEXTS.find((c) => c.value === context);

  return (
    <div style={styles.page}>
      {/* Header */}
      <div style={styles.header}>
        <div style={styles.headerLeft}>
          <div style={styles.headerIcon}>🤖</div>
          <div>
            <h1 style={styles.headerTitle}>Envico AI Assistant</h1>
            <p style={styles.headerSub}>Powered by Claude · Envico CareOS 2026</p>
          </div>
        </div>
        <div style={styles.contextWrap}>
          <label style={styles.contextLabel}>Context</label>
          <select
            style={styles.contextSelect}
            value={context}
            onChange={(e) => setContext(e.target.value)}
          >
            {CONTEXTS.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
          <span style={styles.contextDesc}>{activeCtx?.desc}</span>
        </div>
      </div>

      {/* Chat area */}
      <div style={styles.chatArea}>
        {messages.map((msg) => (
          <MessageBubble key={msg.id} msg={msg} />
        ))}
        {loading && <TypingIndicator />}
        <div ref={bottomRef} />
      </div>

      {/* Quick questions */}
      <div style={styles.quickBar}>
        {QUICK_QUESTIONS.map((q) => (
          <button
            key={q.label}
            style={styles.quickBtn}
            onClick={() => useQuickQuestion(q)}
            disabled={loading}
          >
            {q.label}
          </button>
        ))}
      </div>

      {/* Input bar */}
      <div style={styles.inputBar}>
        <textarea
          ref={inputRef}
          style={styles.input}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKey}
          placeholder="Ask anything about your care service... (Enter to send, Shift+Enter for new line)"
          rows={2}
          disabled={loading}
        />
        <button
          style={{ ...styles.sendBtn, opacity: (!input.trim() || loading) ? 0.5 : 1 }}
          onClick={() => send()}
          disabled={!input.trim() || loading}
        >
          {loading ? <Spinner /> : '↑ Send'}
        </button>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 80%, 100% { opacity: 0.2; transform: scale(0.8); }
          40% { opacity: 1; transform: scale(1); }
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

function Spinner() {
  return (
    <span style={{ display: 'inline-block', width: '16px', height: '16px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
  );
}

const styles = {
  page: {
    display: 'flex',
    flexDirection: 'column',
    height: 'calc(100vh - 4rem)',
    background: '#f8f9fb',
    borderRadius: '10px',
    overflow: 'hidden',
    boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
  },
  header: {
    background: '#1a1a2e',
    color: '#fff',
    padding: '1rem 1.5rem',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexShrink: 0,
    gap: '1rem',
    flexWrap: 'wrap',
  },
  headerLeft: { display: 'flex', alignItems: 'center', gap: '0.75rem' },
  headerIcon: { fontSize: '1.8rem', lineHeight: 1 },
  headerTitle: { margin: 0, fontSize: '1.1rem', fontWeight: 700, letterSpacing: '0.3px' },
  headerSub: { margin: '2px 0 0', fontSize: '0.75rem', color: '#8888bb', letterSpacing: '0.3px' },
  contextWrap: { display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' },
  contextLabel: { fontSize: '0.78rem', color: '#8888bb', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' },
  contextSelect: {
    background: '#2d2d4e', color: '#fff', border: '1px solid #4a4a6e',
    borderRadius: '6px', padding: '0.4rem 0.75rem', fontSize: '0.88rem', cursor: 'pointer',
  },
  contextDesc: { fontSize: '0.75rem', color: '#6666aa' },
  chatArea: {
    flex: 1,
    overflowY: 'auto',
    padding: '1.5rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
  },
  quickBar: {
    display: 'flex',
    gap: '0.5rem',
    padding: '0.75rem 1.5rem 0.5rem',
    flexWrap: 'wrap',
    borderTop: '1px solid #e5e7eb',
    background: '#fff',
    flexShrink: 0,
  },
  quickBtn: {
    padding: '5px 14px', borderRadius: '20px', border: '1px solid #c4b5fd',
    background: '#f5f3ff', color: '#7c3aed', fontSize: '0.82rem',
    cursor: 'pointer', fontWeight: 500, whiteSpace: 'nowrap',
    transition: 'background 0.15s',
  },
  inputBar: {
    display: 'flex',
    gap: '0.75rem',
    padding: '0.75rem 1.5rem 1rem',
    background: '#fff',
    borderTop: '1px solid #e5e7eb',
    alignItems: 'flex-end',
    flexShrink: 0,
  },
  input: {
    flex: 1,
    padding: '0.65rem 0.9rem',
    border: '1px solid #d1d5db',
    borderRadius: '8px',
    fontSize: '0.92rem',
    resize: 'none',
    fontFamily: 'system-ui, sans-serif',
    lineHeight: 1.5,
    outline: 'none',
    background: '#f9fafb',
  },
  sendBtn: {
    padding: '0.65rem 1.25rem',
    background: '#7c3aed',
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    fontSize: '0.9rem',
    fontWeight: 700,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    display: 'flex',
    alignItems: 'center',
    gap: '0.4rem',
    minWidth: '80px',
    justifyContent: 'center',
  },
};

const bubbleStyles = {
  userWrap: { display: 'flex', justifyContent: 'flex-end' },
  userBubble: {
    background: '#7c3aed',
    color: '#fff',
    borderRadius: '18px 18px 4px 18px',
    padding: '0.7rem 1rem',
    maxWidth: '70%',
    fontSize: '0.92rem',
    lineHeight: 1.5,
    whiteSpace: 'pre-wrap',
  },
  aiWrap: { display: 'flex', gap: '0.6rem', alignItems: 'flex-start' },
  avatar: {
    width: '32px', height: '32px', borderRadius: '50%',
    background: '#1a1a2e', color: '#8888bb', display: 'flex',
    alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem',
    fontWeight: 700, flexShrink: 0, marginTop: '2px', letterSpacing: '0.5px',
  },
  aiBubble: {
    background: '#fff',
    border: '1px solid #e5e7eb',
    borderRadius: '4px 18px 18px 18px',
    padding: '0.75rem 1rem',
    maxWidth: '72%',
    fontSize: '0.92rem',
    lineHeight: 1.6,
    color: '#1f2937',
    boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
    whiteSpace: 'pre-wrap',
  },
  modelTag: {
    marginTop: '0.6rem',
    fontSize: '0.7rem',
    color: '#9ca3af',
    fontFamily: 'monospace',
    borderTop: '1px solid #f3f4f6',
    paddingTop: '0.4rem',
  },
  typingDot: {
    display: 'inline-block',
    width: '7px', height: '7px',
    borderRadius: '50%', background: '#9ca3af',
    margin: '0 2px',
    animation: 'pulse 1.2s ease-in-out infinite',
  },
};
