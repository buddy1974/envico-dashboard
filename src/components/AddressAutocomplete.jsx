import { useEffect, useRef, useState } from 'react';
import api from '../services/api';

export default function AddressAutocomplete({ value, onChange, onSelect, placeholder, label }) {
  const [query, setQuery] = useState(value ?? '');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const debounceRef = useRef(null);
  const containerRef = useRef(null);

  useEffect(() => {
    setQuery(value ?? '');
  }, [value]);

  function handleChange(e) {
    const val = e.target.value;
    setQuery(val);
    onChange?.(val);
    setActiveIdx(-1);

    clearTimeout(debounceRef.current);
    if (val.length < 3) {
      setResults([]);
      setOpen(false);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await api.get(`/api/ai/address?q=${encodeURIComponent(val)}`);
        const list = res.data.results ?? res.data ?? [];
        setResults(list.slice(0, 5));
        setOpen(true);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 400);
  }

  function select(r) {
    const street = r.street ?? r.address ?? '';
    setQuery(street);
    onChange?.(street);
    onSelect?.(r);
    setOpen(false);
    setResults([]);
  }

  function handleKeyDown(e) {
    if (!open) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIdx((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && activeIdx >= 0) {
      e.preventDefault();
      select(results[activeIdx]);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  }

  useEffect(() => {
    function onClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  return (
    <div ref={containerRef} style={s.wrap}>
      {label && <label style={s.label}>{label}</label>}
      <div style={{ position: 'relative' }}>
        <input
          style={s.input}
          value={query}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder={placeholder ?? 'Start typing address...'}
          autoComplete="off"
        />
        {loading && <span style={s.spinner}>⟳</span>}
      </div>
      {open && results.length > 0 && (
        <div style={s.dropdown}>
          {results.map((r, i) => (
            <div
              key={i}
              style={{ ...s.item, background: i === activeIdx ? '#f3f4f6' : '#fff' }}
              onMouseDown={() => select(r)}
              onMouseEnter={() => setActiveIdx(i)}
            >
              <span style={s.pin}>📍</span>
              <div>
                <div style={s.street}>{r.street ?? r.address}</div>
                <div style={s.sub}>{[r.postcode, r.city].filter(Boolean).join(' · ')}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const s = {
  wrap: { position: 'relative', marginBottom: '1rem', flex: 1 },
  label: { display: 'block', fontSize: '0.83rem', fontWeight: 600, color: '#374151', marginBottom: '0.35rem' },
  input: {
    width: '100%',
    padding: '0.55rem 0.75rem',
    border: '1px solid #d1d5db',
    borderRadius: '6px',
    fontSize: '0.9rem',
    boxSizing: 'border-box',
  },
  spinner: {
    position: 'absolute',
    right: '0.6rem',
    top: '50%',
    transform: 'translateY(-50%)',
    color: '#9ca3af',
    fontSize: '1rem',
    pointerEvents: 'none',
  },
  dropdown: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    background: '#fff',
    border: '1px solid #e5e7eb',
    borderRadius: '6px',
    boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
    zIndex: 200,
    maxHeight: '220px',
    overflowY: 'auto',
  },
  item: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '0.5rem',
    padding: '0.5rem 0.75rem',
    cursor: 'pointer',
  },
  pin: { fontSize: '0.9rem', marginTop: '1px', flexShrink: 0 },
  street: { fontSize: '0.88rem', color: '#1f2937', fontWeight: 500 },
  sub: { fontSize: '0.78rem', color: '#9ca3af', marginTop: '1px' },
};
