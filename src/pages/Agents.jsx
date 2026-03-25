import AgentTerminal from '../components/AgentTerminal';

export default function Agents() {
  return (
    <div>
      <div style={styles.header}>
        <h1 style={styles.title}>SYS.AGENTS</h1>
        <p style={styles.sub}>Real-time monitor — Envico CareOS automation layer</p>
      </div>
      <AgentTerminal />
    </div>
  );
}

const styles = {
  header: {
    marginBottom: '1.5rem',
  },
  title: {
    fontFamily: 'monospace',
    fontSize: '1.1rem',
    fontWeight: 700,
    color: '#3ab54a',
    margin: '0 0 0.25rem',
    letterSpacing: '0.1em',
  },
  sub: {
    fontFamily: 'monospace',
    fontSize: '0.78rem',
    color: '#6b7280',
    margin: 0,
    letterSpacing: '0.04em',
  },
};
