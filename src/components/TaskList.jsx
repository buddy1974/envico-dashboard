import api from '../services/api';

const STATUS_LABELS = {
  OPEN: 'Open',
  IN_PROGRESS: 'In Progress',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
};

const STATUS_COLORS = {
  OPEN: '#e67e22',
  IN_PROGRESS: '#2980b9',
  COMPLETED: '#27ae60',
  CANCELLED: '#95a5a6',
};

export default function TaskList({ tasks, onTaskUpdated, onSelectTask }) {
  async function updateStatus(taskId, newStatus, e) {
    e.stopPropagation();
    try {
      await api.patch(`/api/tasks/${taskId}/status`, { status: newStatus });
      onTaskUpdated(taskId, newStatus);
    } catch (err) {
      console.error('Task status update failed:', err.response?.data ?? err.message);
      alert(err.response?.data?.message ?? 'Update failed');
    }
  }

  if (tasks.length === 0) {
    return <p style={{ color: '#888' }}>No tasks found.</p>;
  }

  return (
    <table style={styles.table}>
      <thead>
        <tr>
          <th style={styles.th}>ID</th>
          <th style={styles.th}>Priority</th>
          <th style={styles.th}>Title</th>
          <th style={styles.th}>Referral</th>
          <th style={styles.th}>Status</th>
          <th style={styles.th}>Actions</th>
        </tr>
      </thead>
      <tbody>
        {tasks.map((task) => (
          <tr key={task.id} style={{ ...styles.tr, cursor: 'pointer' }} onClick={() => onSelectTask?.(task)}>
            <td style={styles.td}>{task.id}</td>
            <td style={styles.td}>
              <span
                style={{
                  padding: '4px 8px',
                  borderRadius: '6px',
                  fontWeight: 600,
                  backgroundColor:
                    task.priority === 'CRITICAL' ? '#dc2626'
                    : task.priority === 'HIGH' ? '#f87171'
                    : task.priority === 'MEDIUM' ? '#fb923c'
                    : '#4ade80',
                  color: 'white',
                  whiteSpace: 'nowrap',
                }}
              >
                {task.priority === 'CRITICAL' ? '🚨 Critical'
                  : task.priority === 'HIGH' ? '⚠️ High'
                  : task.priority === 'MEDIUM' ? '⏳ Medium'
                  : '✔ Low'}
              </span>
            </td>
            <td style={styles.td}>{task.title}</td>
            <td style={styles.td}>{task.referral_id}</td>
            <td style={styles.td}>
              <span
                style={{
                  ...styles.badge,
                  background: STATUS_COLORS[task.status] ?? '#888',
                }}
              >
                {STATUS_LABELS[task.status] ?? task.status}
              </span>
            </td>
            <td style={styles.td}>
              {task.status === 'OPEN' && (
                <button style={styles.btn} onClick={(e) => updateStatus(task.id, 'IN_PROGRESS', e)}>
                  Start
                </button>
              )}
              {task.status === 'IN_PROGRESS' && (
                <button
                  style={{ ...styles.btn, background: '#27ae60' }}
                  onClick={(e) => updateStatus(task.id, 'COMPLETED', e)}
                >
                  Complete
                </button>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

const styles = {
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: '0.9rem',
  },
  th: {
    textAlign: 'left',
    padding: '0.6rem 0.75rem',
    background: '#f4f4f4',
    borderBottom: '2px solid #ddd',
    fontWeight: 600,
    color: '#333',
  },
  tr: {
    borderBottom: '1px solid #eee',
  },
  td: {
    padding: '0.6rem 0.75rem',
    verticalAlign: 'middle',
  },
  badge: {
    display: 'inline-block',
    padding: '2px 10px',
    borderRadius: '12px',
    color: '#fff',
    fontSize: '0.8rem',
    fontWeight: 500,
  },
  btn: {
    padding: '4px 14px',
    background: '#2980b9',
    color: '#fff',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '0.85rem',
  },
};
