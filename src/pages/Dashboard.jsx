import { useEffect, useRef, useState } from 'react';
import api from '../services/api';
import { connectSocket, subscribe } from '../services/socket';
import TaskList from '../components/TaskList';
import TaskDetail from '../components/TaskDetail';

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

function getCurrentUserName() {
  try {
    const u = JSON.parse(localStorage.getItem('user') || '{}');
    return u.name?.split(' ')[0] || u.email?.split('@')[0] || 'there';
  } catch { return 'there'; }
}

function formatDate() {
  return new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

const PRIORITY_ORDER = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };

const PRIORITY_COLORS = {
  CRITICAL: '#dc2626',
  HIGH: '#fb923c',
  MEDIUM: '#facc15',
  LOW: '#4ade80',
};

const PRIORITY_LABELS = {
  CRITICAL: '🚨 Critical',
  HIGH: '⚠️ High',
  MEDIUM: '⏳ Medium',
  LOW: '✔ Low',
};

function computePriority(task) {
  if (task.status === 'COMPLETED') return 'LOW';
  const ageHours = (Date.now() - new Date(task.created_at).getTime()) / 3600000;
  if (ageHours > 72) return 'CRITICAL';
  if (ageHours > 48) return 'HIGH';
  if (ageHours > 24) return 'MEDIUM';
  return 'LOW';
}

function loadAlertedIds() {
  try {
    return new Set(JSON.parse(localStorage.getItem('criticalAlerted') || '[]'));
  } catch {
    return new Set();
  }
}

function saveAlertedIds(set) {
  try {
    localStorage.setItem('criticalAlerted', JSON.stringify([...set]));
  } catch {}
}

function playCriticalSound() {
  const audio = new Audio('/alert.mp3');
  audio.play().catch(() => {});
}

async function sendEscalation(task) {
  try {
    await api.post('/api/escalations', { task_id: task.id, priority: task.priority });
  } catch (err) {
    console.error('Escalation API failed', err);
  }

  try {
    await fetch('http://localhost:5678/webhook/envico-escalation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event: 'TASK_ESCALATED',
        priority: task.priority,
        task,
        timestamp: new Date().toISOString(),
      }),
    });
    console.log('ESCALATION SENT', { taskId: task.id, priority: task.priority });
  } catch (err) {
    console.error('n8n webhook failed (is n8n running?)', err);
  }
}

function FocusPanel({ tasks }) {
  const active = tasks.filter((t) => t.status !== 'COMPLETED');
  if (active.length === 0) return null;

  const topLevel = active.reduce((best, t) =>
    (PRIORITY_ORDER[t.priority] || 0) > (PRIORITY_ORDER[best] || 0) ? t.priority : best,
    active[0].priority
  );
  const focused = active.filter((t) => t.priority === topLevel);

  return (
    <div style={{
      marginBottom: '1.25rem',
      padding: '0.875rem 1rem',
      borderRadius: '6px',
      background: topLevel === 'CRITICAL' ? '#fef2f2' : topLevel === 'HIGH' ? '#fff7ed' : '#f0fdf4',
      borderLeft: `4px solid ${PRIORITY_COLORS[topLevel]}`,
    }}>
      <p style={{ margin: '0 0 0.5rem', fontWeight: 700, color: PRIORITY_COLORS[topLevel], fontSize: '0.85rem' }}>
        {PRIORITY_LABELS[topLevel]} — {focused.length} task{focused.length > 1 ? 's' : ''} need attention
      </p>
      {focused.map((t) => (
        <p key={t.id} style={{ margin: '0.2rem 0', fontSize: '0.85rem', color: '#374151' }}>
          #{t.id} — {t.title} <span style={{ color: '#9ca3af' }}>({t.referral_id})</span>
        </p>
      ))}
    </div>
  );
}

function NotificationToasts({ notifications, onDismiss }) {
  if (notifications.length === 0) return null;
  return (
    <div style={{ position: 'fixed', top: 20, right: 20, zIndex: 9999, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
      {notifications.map((n) => (
        <div key={n.id} style={{
          padding: '0.75rem 1rem',
          borderRadius: '8px',
          color: 'white',
          minWidth: '250px',
          maxWidth: '340px',
          backgroundColor: PRIORITY_COLORS[n.type] ?? '#6b7280',
          boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
          display: 'flex',
          alignItems: 'flex-start',
          gap: '0.75rem',
        }}>
          <div style={{ flex: 1 }}>
            <strong style={{ display: 'block', marginBottom: '2px' }}>{n.title}</strong>
            <span style={{ fontSize: '0.85rem', opacity: 0.9 }}>{n.message}</span>
          </div>
          <button
            onClick={() => onDismiss(n.id)}
            style={{ background: 'transparent', border: 'none', color: 'white', cursor: 'pointer', fontSize: '1.1rem', padding: 0, lineHeight: 1, opacity: 0.8 }}
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}

const FILTERS = ['All', 'Critical', 'High', 'Normal'];

function SummaryCards({ summary }) {
  const cards = [
    { label: 'Total Tasks', value: summary.total ?? '—', color: '#1a1a2e' },
    { label: 'Critical', value: summary.critical ?? '—', color: '#dc2626' },
    { label: 'Pending', value: summary.pending ?? '—', color: '#e67e22' },
    { label: 'In Progress', value: summary.inProgress ?? summary.in_progress ?? '—', color: '#2980b9' },
  ];
  return (
    <div style={cardStyles.grid}>
      {cards.map((c) => (
        <div key={c.label} style={cardStyles.card}>
          <span style={{ ...cardStyles.value, color: c.color }}>{c.value}</span>
          <span style={cardStyles.label}>{c.label}</span>
        </div>
      ))}
    </div>
  );
}

const cardStyles = {
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: '0.75rem',
    marginBottom: '1.25rem',
  },
  card: {
    background: '#f8f9fa',
    border: '1px solid #e5e7eb',
    borderRadius: '8px',
    padding: '0.875rem 1rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  value: {
    fontSize: '1.6rem',
    fontWeight: 700,
    lineHeight: 1,
  },
  label: {
    fontSize: '0.75rem',
    color: '#6b7280',
    fontWeight: 500,
    textTransform: 'uppercase',
    letterSpacing: '0.4px',
  },
};

export default function Dashboard({ onLogout = () => {} }) {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notifications, setNotifications] = useState([]);
  const [summary, setSummary] = useState({});
  const [activeFilter, setActiveFilter] = useState('All');
  const [selectedTask, setSelectedTask] = useState(null);
  const alertedRef = useRef(loadAlertedIds());
  const [quickStats, setQuickStats] = useState({ serviceUsers: null, staffCount: null, openIncidents: null });
  const [search, setSearch] = useState('');
  const [searchResult, setSearchResult] = useState('');
  const [searching, setSearching] = useState(false);

  function pushNotification(type, title, message) {
    const id = Date.now() + Math.random();
    setNotifications((prev) => [{ id, type, title, message }, ...prev.slice(0, 4)]);
    setTimeout(() => {
      setNotifications((prev) => prev.filter((n) => n.id !== id));
    }, 5000);
  }

  function dismissNotification(id) {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }

  function triggerNotification(task) {
    if (task.priority !== 'CRITICAL' && task.priority !== 'HIGH') return;
    if (alertedRef.current.has(task.id)) return;
    alertedRef.current.add(task.id);
    saveAlertedIds(alertedRef.current);

    if (task.priority === 'CRITICAL') {
      pushNotification('CRITICAL', '🚨 Critical Task', task.title);
      playCriticalSound();
      sendEscalation(task);
    } else {
      pushNotification('HIGH', '⚠️ High Priority', task.title);
    }
  }

  async function fetchSummary() {
    try {
      const res = await api.get('/api/tasks/summary');
      setSummary(res.data.summary ?? res.data);
    } catch (err) {
      console.error('[fetchSummary] error:', err.response?.status, err.response?.data);
    }
  }

  async function fetchQuickStats() {
    try {
      const [suRes, incRes] = await Promise.allSettled([
        api.get('/api/service-users'),
        api.get('/api/incidents'),
      ]);
      setQuickStats({
        serviceUsers: suRes.status === 'fulfilled' ? (suRes.value.data.serviceUsers ?? suRes.value.data.data ?? []).length : null,
        openIncidents: incRes.status === 'fulfilled' ? (incRes.value.data.incidents ?? incRes.value.data.data ?? []).filter((i) => i.status !== 'RESOLVED' && i.status !== 'CLOSED').length : null,
      });
    } catch { /* non-critical */ }
  }

  async function handleSearch(e) {
    e.preventDefault();
    if (!search.trim()) return;
    setSearching(true);
    setSearchResult('');
    try {
      const res = await api.post('/api/assistant/ask', { message: search });
      setSearchResult(res.data.reply ?? res.data.message ?? res.data.response ?? 'No response');
    } catch {
      setSearchResult('Search unavailable — assistant is offline.');
    } finally {
      setSearching(false);
    }
  }

  useEffect(() => {
    if (!localStorage.getItem('token')) {
      onLogout();
      return;
    }
    fetchTasks();
    fetchSummary();
    fetchQuickStats();
    connectSocket();

    const summaryInterval = setInterval(fetchSummary, 30000);

    const unsub = subscribe((msg) => {
      if (msg.event === 'TASK_CREATED') {
        setTasks((prev) => {
          if (prev.find((t) => t.id === msg.data.id)) return prev;
          const task = { id: msg.data.id, title: msg.data.title, referral_id: msg.data.referral_id, status: 'OPEN', created_at: new Date().toISOString() };
          const withPriority = { ...task, priority: computePriority(task) };
          triggerNotification(withPriority);
          return [withPriority, ...prev];
        });
      }
      if (msg.event === 'TASK_STATUS_CHANGED') {
        setTasks((prev) =>
          prev.map((t) => {
            if (t.id !== msg.data.taskId) return t;
            const updated = { ...t, status: msg.data.to, priority: computePriority({ ...t, status: msg.data.to }) };
            triggerNotification(updated);
            return updated;
          })
        );
      }
    });

    return () => {
      unsub();
      clearInterval(summaryInterval);
    };
  }, []);

  async function fetchTasks() {
    try {
      const res = await api.get('/api/tasks');
      const withPriority = (res.data.tasks ?? res.data).map((task) => ({ ...task, priority: task.priority || computePriority(task) }));
      withPriority.forEach(triggerNotification);
      setTasks(withPriority);
    } catch (err) {
      if (err.response?.status === 401) {
        localStorage.removeItem('token');
        onLogout();
        return;
      }
      setError(err.response?.data?.message ?? 'Failed to load tasks');
    } finally {
      setLoading(false);
    }
  }

  function handleTaskUpdated(taskId, newStatus) {
    setTasks((prev) =>
      prev.map((t) => {
        if (t.id !== taskId) return t;
        const updated = { ...t, status: newStatus, priority: computePriority({ ...t, status: newStatus }) };
        triggerNotification(updated);
        return updated;
      })
    );
  }

  const sortedTasks = [...tasks].sort((a, b) => (PRIORITY_ORDER[b.priority] || 0) - (PRIORITY_ORDER[a.priority] || 0));

  const filteredTasks = sortedTasks.filter((t) => {
    if (activeFilter === 'All') return true;
    if (activeFilter === 'Critical') return t.priority === 'CRITICAL';
    if (activeFilter === 'High') return t.priority === 'HIGH';
    if (activeFilter === 'Normal') return t.priority === 'MEDIUM' || t.priority === 'LOW';
    return true;
  });

  const criticalCount = summary.critical ?? 0;

  return (
    <div>
      <NotificationToasts notifications={notifications} onDismiss={dismissNotification} />
      <TaskDetail task={selectedTask} onClose={() => setSelectedTask(null)} />

      {/* Greeting + Quick Stats */}
      <div style={styles.greetingBlock}>
        <div>
          <h1 style={styles.greetingText}>{getGreeting()}, {getCurrentUserName()} 👋</h1>
          <p style={styles.greetingDate}>{formatDate()}</p>
        </div>
      </div>

      <div style={styles.quickStatsRow}>
        <div style={styles.qCard}>
          <span style={{ ...styles.qValue, color: '#2563eb' }}>{quickStats.serviceUsers ?? '—'}</span>
          <span style={styles.qLabel}>Total Service Users</span>
        </div>
        <div style={styles.qCard}>
          <span style={{ ...styles.qValue, color: '#16a34a' }}>{summary.inProgress ?? summary.in_progress ?? '—'}</span>
          <span style={styles.qLabel}>Tasks In Progress</span>
        </div>
        <div style={styles.qCard}>
          <span style={{ ...styles.qValue, color: criticalCount > 0 ? '#dc2626' : '#6b7280' }}>{criticalCount || '—'}</span>
          <span style={styles.qLabel}>Critical Tasks</span>
        </div>
        <div style={styles.qCard}>
          <span style={{ ...styles.qValue, color: (quickStats.openIncidents ?? 0) > 0 ? '#ea580c' : '#6b7280' }}>{quickStats.openIncidents ?? '—'}</span>
          <span style={styles.qLabel}>Open Incidents</span>
        </div>
      </div>

      {/* Global Search */}
      <div style={styles.searchWrap}>
        <form onSubmit={handleSearch} style={styles.searchForm}>
          <input
            style={styles.searchInput}
            placeholder="Ask AI anything — e.g. 'Show overdue tasks' or 'Which staff are on duty?'"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <button style={styles.searchBtn} type="submit" disabled={searching}>
            {searching ? '...' : '🔍 Ask'}
          </button>
        </form>
        {searchResult && (
          <div style={styles.searchResult}>
            <strong style={{ fontSize: '0.8rem', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px' }}>AI Response</strong>
            <p style={{ margin: '0.5rem 0 0', fontSize: '0.9rem', color: '#1f2937', lineHeight: 1.6 }}>{searchResult}</p>
          </div>
        )}
      </div>

      <div style={styles.main}>
        <h2 style={styles.heading}>Tasks</h2>
        <SummaryCards summary={summary} />
        {loading && <p>Loading...</p>}
        {error && <p style={{ color: '#c0392b' }}>{error}</p>}
        {!loading && !error && (
          <>
            <FocusPanel tasks={tasks} />
            <div style={styles.filterBar}>
              {FILTERS.map((f) => (
                <button
                  key={f}
                  style={{
                    ...styles.filterBtn,
                    ...(activeFilter === f ? styles.filterBtnActive : {}),
                  }}
                  onClick={() => setActiveFilter(f)}
                >
                  {f}
                </button>
              ))}
            </div>
            <TaskList
              tasks={filteredTasks}
              onTaskUpdated={handleTaskUpdated}
              onSelectTask={setSelectedTask}
            />
          </>
        )}
      </div>
    </div>
  );
}

const styles = {
  greetingBlock: {
    marginBottom: '1.25rem',
  },
  greetingText: {
    margin: '0 0 0.2rem',
    fontSize: '1.5rem',
    fontWeight: 700,
    color: '#1a1a2e',
  },
  greetingDate: {
    margin: 0,
    fontSize: '0.875rem',
    color: '#6b7280',
  },
  quickStatsRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: '0.75rem',
    marginBottom: '1.25rem',
  },
  qCard: {
    background: '#fff',
    border: '1px solid #e5e7eb',
    borderRadius: '8px',
    padding: '1rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
  },
  qValue: {
    fontSize: '1.75rem',
    fontWeight: 700,
    lineHeight: 1,
  },
  qLabel: {
    fontSize: '0.75rem',
    color: '#6b7280',
    fontWeight: 500,
    textTransform: 'uppercase',
    letterSpacing: '0.4px',
  },
  searchWrap: {
    marginBottom: '1.25rem',
  },
  searchForm: {
    display: 'flex',
    gap: '0.5rem',
  },
  searchInput: {
    flex: 1,
    padding: '0.6rem 0.875rem',
    border: '1px solid #d1d5db',
    borderRadius: '8px',
    fontSize: '0.9rem',
    background: '#fff',
    boxSizing: 'border-box',
  },
  searchBtn: {
    padding: '0.6rem 1.1rem',
    background: '#1a1a2e',
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    fontSize: '0.9rem',
    cursor: 'pointer',
    fontWeight: 600,
    whiteSpace: 'nowrap',
  },
  searchResult: {
    marginTop: '0.625rem',
    background: '#fff',
    border: '1px solid #e5e7eb',
    borderRadius: '8px',
    padding: '1rem',
    boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
  },
  main: {
    background: '#fff',
    borderRadius: '8px',
    padding: '1.5rem',
    boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
  },
  heading: {
    margin: '0 0 1.25rem',
    fontSize: '1.2rem',
    color: '#1a1a2e',
  },
  filterBar: {
    display: 'flex',
    gap: '0.5rem',
    marginBottom: '1rem',
  },
  filterBtn: {
    padding: '5px 14px',
    borderRadius: '20px',
    border: '1px solid #d1d5db',
    background: '#f9fafb',
    color: '#374151',
    fontSize: '0.85rem',
    cursor: 'pointer',
    fontWeight: 500,
  },
  filterBtnActive: {
    background: '#1a1a2e',
    color: '#fff',
    border: '1px solid #1a1a2e',
  },
};
