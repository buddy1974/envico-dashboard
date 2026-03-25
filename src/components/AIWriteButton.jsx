import { useState } from 'react';
import api from '../services/api';

export default function AIWriteButton({ value, field, onResult, disabled }) {
  const [status, setStatus] = useState('idle'); // idle | loading | error

  async function expand() {
    if (!value?.trim() || disabled) return;
    setStatus('loading');
    try {
      const res = await api.post('/api/ai/care-writer', { input: value, field });
      const text =
        typeof res.data === 'string'
          ? res.data
          : (res.data?.result ?? res.data?.text ?? res.data?.output ?? '');
      onResult?.(text);
      setStatus('idle');
    } catch {
      setStatus('error');
      setTimeout(() => setStatus('idle'), 3000);
    }
  }

  const isError = status === 'error';
  const btnStyle = {
    background: 'transparent',
    border: `1px solid ${isError ? '#dc2626' : '#7c3aed'}`,
    color: isError ? '#dc2626' : '#7c3aed',
    borderRadius: '5px',
    padding: '2px 8px',
    fontSize: '0.75rem',
    fontWeight: 600,
    cursor: disabled ? 'not-allowed' : 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '3px',
    opacity: disabled ? 0.5 : 1,
  };

  return (
    <button
      type="button"
      style={btnStyle}
      onClick={expand}
      disabled={disabled || status === 'loading'}
      title="Type bullet points — AI writes the full professional text"
    >
      <span style={{ fontSize: '0.7rem', color: isError ? '#dc2626' : '#a855f7' }}>✦</span>
      {status === 'loading' ? 'Writing...' : isError ? 'Try again' : 'Expand with AI'}
    </button>
  );
}
