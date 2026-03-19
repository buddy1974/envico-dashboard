const PRIORITY_COLORS = {
  CRITICAL: '#dc2626',
  HIGH: '#fb923c',
  MEDIUM: '#facc15',
  LOW: '#4ade80',
};

const STATUS_COLORS = {
  OPEN: '#e67e22',
  IN_PROGRESS: '#2980b9',
  COMPLETED: '#27ae60',
  CANCELLED: '#95a5a6',
};

const STATUS_LABELS = {
  OPEN: 'Open',
  IN_PROGRESS: 'In Progress',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
};

export default function TaskDetail({ task, onClose }) {
  if (!task) return null;

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div style={styles.header}>
          <h2 style={styles.title}>Task #{task.id}</h2>
          <button style={styles.closeBtn} onClick={onClose}>×</button>
        </div>

        <div style={styles.body}>
          <Row label="Title" value={task.title} />
          {task.description && <Row label="Description" value={task.description} />}

          <div style={styles.row}>
            <span style={styles.label}>Priority</span>
            <span style={{
              ...styles.badge,
              background: PRIORITY_COLORS[task.priority] ?? '#888',
            }}>
              {task.priority}
            </span>
          </div>

          <div style={styles.row}>
            <span style={styles.label}>Status</span>
            <span style={{
              ...styles.badge,
              background: STATUS_COLORS[task.status] ?? '#888',
            }}>
              {STATUS_LABELS[task.status] ?? task.status}
            </span>
          </div>

          {task.referral_id && <Row label="Referral ID" value={task.referral_id} />}
          {task.assigned_to && <Row label="Assigned To" value={task.assigned_to} />}
          {task.deadline && <Row label="Deadline" value={new Date(task.deadline).toLocaleString()} />}
          <Row label="Created At" value={new Date(task.created_at).toLocaleString()} />
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div style={styles.row}>
      <span style={styles.label}>{label}</span>
      <span style={styles.value}>{value}</span>
    </div>
  );
}

const styles = {
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.45)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10000,
  },
  modal: {
    background: '#fff',
    borderRadius: '10px',
    width: '480px',
    maxWidth: '95vw',
    boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
    overflow: 'hidden',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    background: '#1a1a2e',
    color: '#fff',
    padding: '0.875rem 1.25rem',
  },
  title: {
    margin: 0,
    fontSize: '1rem',
    fontWeight: 700,
  },
  closeBtn: {
    background: 'transparent',
    border: 'none',
    color: '#fff',
    fontSize: '1.5rem',
    cursor: 'pointer',
    lineHeight: 1,
    padding: 0,
    opacity: 0.8,
  },
  body: {
    padding: '1.25rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem',
  },
  row: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '0.75rem',
  },
  label: {
    minWidth: '110px',
    fontSize: '0.8rem',
    fontWeight: 600,
    color: '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: '0.4px',
    paddingTop: '2px',
  },
  value: {
    fontSize: '0.9rem',
    color: '#111827',
    flex: 1,
  },
  badge: {
    display: 'inline-block',
    padding: '2px 12px',
    borderRadius: '12px',
    color: '#fff',
    fontSize: '0.8rem',
    fontWeight: 600,
  },
};
