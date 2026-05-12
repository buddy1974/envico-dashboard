/**
 * SmartInputPanel — Universal raw-data-to-structured-form component
 *
 * Usage:
 *   <SmartInputPanel
 *     section="incident"           // matches backend section schema
 *     triggerLabel="+ Voice / AI Input"
 *     onConfirm={(fields) => { ... }}   // called with extracted fields on confirm
 *     context="Service User: John Smith" // optional extra context
 *   />
 *
 * Supports:
 *   - Web Speech API live dictation (no server cost)
 *   - Raw text / notes paste
 *   - AI field extraction via /api/smart-input/process
 *   - Inline field editing before confirm
 *   - AI report generation via /api/smart-input/generate-report
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import api from '../services/api';

// ─── Icon atoms ───────────────────────────────────────────────────────────────
const Mic      = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>;
const Stop     = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><rect x="4" y="4" width="16" height="16" rx="2"/></svg>;
const Wand     = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 4-9 9 2 2 9-9z"/><path d="m17 2 3 3"/><path d="M2 17l1 4 4-1"/></svg>;
const Check    = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>;
const Refresh  = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>;
const FileText = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>;
const X        = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>;
const Edit2    = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>;

// ─── Speech support detection ─────────────────────────────────────────────────
const hasSpeech = typeof window !== 'undefined' && ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);
const SR = hasSpeech ? (window.SpeechRecognition || window.webkitSpeechRecognition) : null;

// ─── Label formatter ──────────────────────────────────────────────────────────
function fmtLabel(key) {
  return key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

// ─── Confidence badge ─────────────────────────────────────────────────────────
function ConfidenceBadge({ level }) {
  const map = {
    HIGH:   { bg: '#dcfce7', color: '#15803d', label: '✓ High confidence' },
    MEDIUM: { bg: '#fef9c3', color: '#854d0e', label: '~ Medium confidence' },
    LOW:    { bg: '#fee2e2', color: '#b91c1c', label: '⚠ Low confidence' },
  };
  const style = map[level] ?? map.MEDIUM;
  return (
    <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 20, background: style.bg, color: style.color }}>
      {style.label}
    </span>
  );
}

// ─── Spinner ──────────────────────────────────────────────────────────────────
function Spinner({ size = 14, color = '#fff' }) {
  return (
    <span style={{
      display: 'inline-block', width: size, height: size, flexShrink: 0,
      border: `2px solid rgba(255,255,255,0.25)`, borderTopColor: color,
      borderRadius: '50%', animation: 'si-spin 0.7s linear infinite',
    }} />
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function SmartInputPanel({
  section = 'incident',
  triggerLabel = '🎙️ Smart Input',
  triggerStyle = {},
  onConfirm,            // (fields: Record<string, string>) => void
  context = '',         // extra context string passed to AI
  reportMode = false,   // true = show "Generate Report" tab
  reportType = 'incident', // for report generation
  serviceUserName = '',
  staffName = '',
}) {
  const [open, setOpen]               = useState(false);
  const [tab, setTab]                 = useState('input'); // 'input' | 'preview' | 'report'
  const [rawText, setRawText]         = useState('');
  const [listening, setListening]     = useState(false);
  const [transcript, setTranscript]   = useState('');
  const [processing, setProcessing]   = useState(false);
  const [fields, setFields]           = useState(null);
  const [summary, setSummary]         = useState('');
  const [confidence, setConfidence]   = useState('');
  const [missing, setMissing]         = useState([]);
  const [error, setError]             = useState('');
  const [editKey, setEditKey]         = useState(null);
  const [editVal, setEditVal]         = useState('');
  const [refineText, setRefineText]   = useState('');
  const [refining, setRefining]       = useState(false);
  const [report, setReport]           = useState('');
  const [genReport, setGenReport]     = useState(false);

  const srRef      = useRef(null);
  const textareaRef = useRef(null);

  // Combine typed + dictated text
  const combinedText = [rawText, transcript].filter(Boolean).join(' ');

  // ── Speech recognition ────────────────────────────────────────────────────
  const startListening = useCallback(() => {
    if (!SR) return;
    const sr = new SR();
    sr.lang = 'en-GB';
    sr.continuous = true;
    sr.interimResults = true;

    let interim = '';

    sr.onresult = (e) => {
      let final = '';
      interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) {
          final += e.results[i][0].transcript + ' ';
        } else {
          interim += e.results[i][0].transcript;
        }
      }
      if (final) setTranscript((t) => (t + ' ' + final).trim());
    };

    sr.onerror = (e) => {
      if (e.error !== 'aborted') setError(`Microphone error: ${e.error}`);
      setListening(false);
    };

    sr.onend = () => setListening(false);

    srRef.current = sr;
    sr.start();
    setListening(true);
    setError('');
  }, []);

  const stopListening = useCallback(() => {
    srRef.current?.stop();
    setListening(false);
  }, []);

  // ── Process with AI ───────────────────────────────────────────────────────
  const processWithAI = useCallback(async () => {
    const text = combinedText.trim();
    if (!text) { setError('Please type or dictate some content first.'); return; }
    setProcessing(true);
    setError('');
    setFields(null);
    try {
      const res = await api.post('/api/smart-input/process', {
        rawText: text,
        section,
        context: context || undefined,
      });
      const d = res.data;
      setFields(d.fields ?? {});
      setSummary(d.summary ?? '');
      setConfidence(d.confidence ?? 'MEDIUM');
      setMissing(d.missing ?? []);
      setTab('preview');
    } catch (err) {
      setError(err.response?.data?.error ?? 'AI processing failed. Check your connection.');
    } finally {
      setProcessing(false);
    }
  }, [combinedText, section, context]);

  // ── Refine fields ──────────────────────────────────────────────────────────
  const refineFields = useCallback(async () => {
    if (!refineText.trim() || !fields) return;
    setRefining(true);
    setError('');
    try {
      const res = await api.post('/api/smart-input/refine', {
        currentFields: fields,
        correction: refineText.trim(),
        section,
      });
      setFields(res.data.fields ?? fields);
      setSummary(res.data.summary ?? summary);
      setRefineText('');
    } catch (err) {
      setError(err.response?.data?.error ?? 'Refinement failed.');
    } finally {
      setRefining(false);
    }
  }, [refineText, fields, section, summary]);

  // ── Generate report ───────────────────────────────────────────────────────
  const generateReport = useCallback(async () => {
    const text = combinedText.trim();
    if (!text) { setError('No content to generate report from.'); return; }
    setGenReport(true);
    setError('');
    try {
      const res = await api.post('/api/smart-input/generate-report', {
        rawText: text,
        reportType,
        serviceUserName: serviceUserName || undefined,
        staffName: staffName || undefined,
      });
      setReport(res.data.report ?? '');
      setTab('report');
    } catch (err) {
      setError(err.response?.data?.error ?? 'Report generation failed.');
    } finally {
      setGenReport(false);
    }
  }, [combinedText, reportType, serviceUserName, staffName]);

  // ── Field inline edit ──────────────────────────────────────────────────────
  function startEdit(key, val) { setEditKey(key); setEditVal(val ?? ''); }
  function saveEdit() {
    if (editKey) setFields((f) => ({ ...f, [editKey]: editVal }));
    setEditKey(null);
  }

  // ── Confirm & pass up ─────────────────────────────────────────────────────
  function handleConfirm() {
    if (onConfirm && fields) {
      onConfirm(fields);
    }
    handleClose();
  }

  // ── Reset & close ─────────────────────────────────────────────────────────
  function handleClose() {
    stopListening();
    setOpen(false);
    setTab('input');
    setRawText('');
    setTranscript('');
    setFields(null);
    setSummary('');
    setConfidence('');
    setMissing([]);
    setError('');
    setEditKey(null);
    setReport('');
    setRefineText('');
  }

  // Prevent body scroll when open
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <>
      {/* CSS keyframes */}
      <style>{`
        @keyframes si-spin { to { transform: rotate(360deg); } }
        @keyframes si-slide-up { from { opacity: 0; transform: translateY(20px) scale(0.97); } to { opacity: 1; transform: translateY(0) scale(1); } }
        @keyframes si-pulse-ring { 0%,100% { box-shadow: 0 0 0 0 rgba(220,38,38,0.4); } 50% { box-shadow: 0 0 0 8px rgba(220,38,38,0); } }
        .si-field-row:hover .si-edit-btn { opacity: 1 !important; }
      `}</style>

      {/* Trigger button */}
      <button
        onClick={() => setOpen(true)}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 7,
          background: 'linear-gradient(135deg, #1d4ed8 0%, #7c3aed 100%)',
          color: '#fff', border: 'none', borderRadius: 10, padding: '9px 16px',
          fontSize: 13, fontWeight: 700, cursor: 'pointer', letterSpacing: 0.3,
          boxShadow: '0 2px 8px rgba(124,58,237,0.35)',
          transition: 'opacity 0.15s, transform 0.15s',
          ...triggerStyle,
        }}
        onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.9'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
        onMouseLeave={(e) => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.transform = 'translateY(0)'; }}
      >
        <Mic /> {triggerLabel}
      </button>

      {/* Overlay */}
      {open && (
        <div
          onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)',
            zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 16, backdropFilter: 'blur(3px)',
          }}
        >
          <div style={{
            background: '#fff', borderRadius: 18, width: '100%', maxWidth: 620,
            maxHeight: '90vh', display: 'flex', flexDirection: 'column',
            boxShadow: '0 24px 60px rgba(0,0,0,0.3)',
            animation: 'si-slide-up 0.22s ease-out',
          }}>

            {/* Header */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '18px 22px 14px',
              borderBottom: '1px solid #f0f0f0',
            }}>
              <div>
                <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: '#111' }}>
                  🎙️ Smart Input
                </h2>
                <p style={{ margin: '3px 0 0', fontSize: 12, color: '#6b7280' }}>
                  Speak, paste notes — AI structures everything for you
                </p>
              </div>
              <button
                onClick={handleClose}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', padding: 4, borderRadius: 6, display: 'flex' }}
              >
                <X />
              </button>
            </div>

            {/* Tab bar */}
            <div style={{ display: 'flex', borderBottom: '1px solid #f0f0f0', padding: '0 22px' }}>
              {[
                ['input',   '✏️ Input'],
                ['preview', '👁️ Preview', !fields],
                ...(reportMode ? [['report', '📄 Report', !report]] : []),
              ].map(([key, label, disabled]) => (
                <button
                  key={key}
                  onClick={() => !disabled && setTab(key)}
                  style={{
                    background: 'none', border: 'none', cursor: disabled ? 'default' : 'pointer',
                    padding: '10px 14px', fontSize: 13, fontWeight: tab === key ? 700 : 500,
                    color: disabled ? '#d1d5db' : tab === key ? '#1d4ed8' : '#6b7280',
                    borderBottom: tab === key ? '2px solid #1d4ed8' : '2px solid transparent',
                    transition: 'color 0.15s',
                    marginBottom: -1,
                  }}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Body — scrollable */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '20px 22px' }}>

              {/* ── INPUT TAB ── */}
              {tab === 'input' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

                  {/* Voice dictation */}
                  <div style={{ background: '#f8faff', borderRadius: 12, padding: '14px 16px', border: '1px solid #e0e7ff' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: '#1e40af' }}>🎙️ Voice Dictation</span>
                      {!hasSpeech && (
                        <span style={{ fontSize: 11, color: '#9ca3af' }}>Not supported in this browser</span>
                      )}
                    </div>

                    <button
                      onClick={listening ? stopListening : startListening}
                      disabled={!hasSpeech}
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                        width: '100%', padding: '12px',
                        background: listening
                          ? 'linear-gradient(135deg, #dc2626, #b91c1c)'
                          : hasSpeech
                            ? 'linear-gradient(135deg, #1d4ed8, #4f46e5)'
                            : '#e5e7eb',
                        color: hasSpeech ? '#fff' : '#9ca3af',
                        border: 'none', borderRadius: 10, cursor: hasSpeech ? 'pointer' : 'not-allowed',
                        fontSize: 14, fontWeight: 700,
                        animation: listening ? 'si-pulse-ring 1.5s ease-in-out infinite' : 'none',
                        transition: 'background 0.2s',
                      }}
                    >
                      {listening ? <><Stop /> Stop Listening</> : <><Mic /> {hasSpeech ? 'Tap to Speak' : 'Voice Not Available'}</>}
                    </button>

                    {listening && (
                      <div style={{ marginTop: 10, fontSize: 12, color: '#dc2626', fontWeight: 600, textAlign: 'center' }}>
                        🔴 Listening… speak clearly in English
                      </div>
                    )}

                    {transcript && (
                      <div style={{ marginTop: 10, background: '#fff', border: '1px solid #c7d2fe', borderRadius: 8, padding: '10px 12px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                          <span style={{ fontSize: 11, fontWeight: 700, color: '#4f46e5', textTransform: 'uppercase', letterSpacing: 0.5 }}>Transcribed</span>
                          <button
                            onClick={() => setTranscript('')}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: '#9ca3af' }}
                          >
                            Clear
                          </button>
                        </div>
                        <p style={{ margin: 0, fontSize: 13, color: '#1f2937', lineHeight: 1.6 }}>{transcript}</p>
                      </div>
                    )}
                  </div>

                  {/* Raw text area */}
                  <div>
                    <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#374151', marginBottom: 6 }}>
                      📝 Type or Paste Raw Notes
                    </label>
                    <textarea
                      ref={textareaRef}
                      value={rawText}
                      onChange={(e) => setRawText(e.target.value)}
                      rows={6}
                      placeholder="Paste notes, emails, handwritten observations — anything. The AI will extract and structure the data.

Example: 'John fell in the hallway at 3pm Tuesday. No injuries. He was confused. Staff member Sarah was present. Medium severity. Cleaned area and informed manager.'"
                      style={{
                        width: '100%', boxSizing: 'border-box', padding: '12px 14px',
                        border: '1px solid #d1d5db', borderRadius: 10, fontSize: 13,
                        lineHeight: 1.6, resize: 'vertical', outline: 'none',
                        fontFamily: 'inherit', color: '#1f2937',
                        transition: 'border-color 0.15s',
                      }}
                      onFocus={(e) => { e.target.style.borderColor = '#6366f1'; }}
                      onBlur={(e) => { e.target.style.borderColor = '#d1d5db'; }}
                    />
                  </div>

                  {/* Combined text preview */}
                  {combinedText && (
                    <div style={{ fontSize: 12, color: '#6b7280', background: '#f9fafb', borderRadius: 8, padding: '8px 12px' }}>
                      <strong style={{ color: '#374151' }}>Total input:</strong> {combinedText.length} characters
                    </div>
                  )}

                  {error && (
                    <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#dc2626' }}>
                      {error}
                    </div>
                  )}
                </div>
              )}

              {/* ── PREVIEW TAB ── */}
              {tab === 'preview' && fields && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

                  {/* Summary row */}
                  <div style={{ background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 10, padding: '12px 14px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                      <p style={{ margin: 0, fontSize: 13, color: '#0369a1', fontWeight: 600 }}>{summary}</p>
                      <ConfidenceBadge level={confidence} />
                    </div>
                    {missing.length > 0 && (
                      <p style={{ margin: '8px 0 0', fontSize: 12, color: '#b45309' }}>
                        ⚠ Missing: {missing.join(', ')}
                      </p>
                    )}
                  </div>

                  {/* Fields */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <p style={{ margin: '0 0 4px', fontSize: 12, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                      Extracted Fields — click any to edit
                    </p>
                    {Object.entries(fields).map(([key, val]) => {
                      if (!val || val === 'null') return null;
                      return (
                        <div
                          key={key}
                          className="si-field-row"
                          style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '8px 12px', background: '#f9fafb', borderRadius: 8, border: '1px solid #f0f0f0' }}
                        >
                          <span style={{ fontSize: 12, fontWeight: 700, color: '#6b7280', minWidth: 140, flexShrink: 0, paddingTop: 1 }}>
                            {fmtLabel(key)}
                          </span>
                          {editKey === key ? (
                            <div style={{ flex: 1, display: 'flex', gap: 6 }}>
                              <input
                                value={editVal}
                                onChange={(e) => setEditVal(e.target.value)}
                                autoFocus
                                onKeyDown={(e) => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') setEditKey(null); }}
                                style={{ flex: 1, border: '1px solid #6366f1', borderRadius: 6, padding: '4px 8px', fontSize: 13, outline: 'none' }}
                              />
                              <button onClick={saveEdit} style={{ background: '#6366f1', color: '#fff', border: 'none', borderRadius: 6, padding: '4px 8px', cursor: 'pointer', fontSize: 12 }}>Save</button>
                              <button onClick={() => setEditKey(null)} style={{ background: '#f0f0f0', border: 'none', borderRadius: 6, padding: '4px 8px', cursor: 'pointer', fontSize: 12 }}>Cancel</button>
                            </div>
                          ) : (
                            <span
                              style={{ flex: 1, fontSize: 13, color: '#1f2937', lineHeight: 1.5 }}
                              onDoubleClick={() => startEdit(key, String(val))}
                            >
                              {String(val)}
                            </span>
                          )}
                          <button
                            className="si-edit-btn"
                            onClick={() => startEdit(key, String(val))}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', padding: 3, opacity: 0, transition: 'opacity 0.15s', flexShrink: 0 }}
                            title="Edit"
                          >
                            <Edit2 />
                          </button>
                        </div>
                      );
                    })}
                  </div>

                  {/* Refine box */}
                  <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 10, padding: '12px 14px' }}>
                    <p style={{ margin: '0 0 8px', fontSize: 12, fontWeight: 700, color: '#92400e' }}>🔧 Correction or addition?</p>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <input
                        value={refineText}
                        onChange={(e) => setRefineText(e.target.value)}
                        placeholder="e.g. Change severity to HIGH, add staff name: Maria"
                        style={{ flex: 1, border: '1px solid #fcd34d', borderRadius: 8, padding: '8px 12px', fontSize: 13, outline: 'none', fontFamily: 'inherit' }}
                        onKeyDown={(e) => { if (e.key === 'Enter') refineFields(); }}
                      />
                      <button
                        onClick={refineFields}
                        disabled={refining || !refineText.trim()}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 5,
                          background: refining ? '#d1d5db' : '#f59e0b', color: '#fff',
                          border: 'none', borderRadius: 8, padding: '8px 14px',
                          fontSize: 13, fontWeight: 700, cursor: refining ? 'default' : 'pointer',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {refining ? <><Spinner color="#fff" /> Refining…</> : <><Refresh /> Refine</>}
                      </button>
                    </div>
                  </div>

                  {error && (
                    <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#dc2626' }}>
                      {error}
                    </div>
                  )}
                </div>
              )}

              {/* ── REPORT TAB ── */}
              {tab === 'report' && (
                <div>
                  {report ? (
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 10 }}>
                        <button
                          onClick={() => {
                            navigator.clipboard?.writeText(report);
                          }}
                          style={{ background: '#f3f4f6', border: '1px solid #e5e7eb', borderRadius: 7, padding: '5px 12px', fontSize: 12, cursor: 'pointer', color: '#374151', fontWeight: 600 }}
                        >
                          Copy to Clipboard
                        </button>
                      </div>
                      <div style={{
                        background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 10, padding: '16px 18px',
                        fontSize: 13, lineHeight: 1.8, color: '#1f2937', whiteSpace: 'pre-wrap', fontFamily: 'inherit',
                      }}>
                        {report}
                      </div>
                    </div>
                  ) : (
                    <div style={{ textAlign: 'center', padding: '40px 20px', color: '#6b7280' }}>
                      <FileText />
                      <p style={{ marginTop: 10, fontSize: 14 }}>Generate a full formatted report from your input.</p>
                    </div>
                  )}
                </div>
              )}

            </div>

            {/* Footer actions */}
            <div style={{
              borderTop: '1px solid #f0f0f0', padding: '14px 22px',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap',
            }}>
              <button
                onClick={handleClose}
                style={{ background: '#f3f4f6', border: 'none', borderRadius: 9, padding: '9px 16px', fontSize: 13, fontWeight: 600, color: '#374151', cursor: 'pointer' }}
              >
                Cancel
              </button>

              <div style={{ display: 'flex', gap: 8 }}>
                {tab === 'input' && (
                  <>
                    {reportMode && (
                      <button
                        onClick={generateReport}
                        disabled={genReport || !combinedText.trim()}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 6,
                          background: genReport || !combinedText.trim() ? '#e5e7eb' : '#0f766e',
                          color: genReport || !combinedText.trim() ? '#9ca3af' : '#fff',
                          border: 'none', borderRadius: 9, padding: '9px 16px',
                          fontSize: 13, fontWeight: 700, cursor: genReport || !combinedText.trim() ? 'default' : 'pointer',
                        }}
                      >
                        {genReport ? <><Spinner /> Generating…</> : <><FileText /> Generate Report</>}
                      </button>
                    )}
                    <button
                      onClick={processWithAI}
                      disabled={processing || !combinedText.trim()}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 6,
                        background: processing || !combinedText.trim()
                          ? '#e5e7eb'
                          : 'linear-gradient(135deg, #1d4ed8, #7c3aed)',
                        color: processing || !combinedText.trim() ? '#9ca3af' : '#fff',
                        border: 'none', borderRadius: 9, padding: '9px 18px',
                        fontSize: 13, fontWeight: 700, cursor: processing || !combinedText.trim() ? 'default' : 'pointer',
                        boxShadow: processing || !combinedText.trim() ? 'none' : '0 2px 8px rgba(124,58,237,0.3)',
                      }}
                    >
                      {processing ? <><Spinner /> Processing…</> : <><Wand /> Process with AI</>}
                    </button>
                  </>
                )}

                {tab === 'preview' && fields && (
                  <>
                    <button
                      onClick={() => setTab('input')}
                      style={{ background: '#f3f4f6', border: 'none', borderRadius: 9, padding: '9px 16px', fontSize: 13, fontWeight: 600, color: '#374151', cursor: 'pointer' }}
                    >
                      ← Edit Input
                    </button>
                    <button
                      onClick={handleConfirm}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 6,
                        background: 'linear-gradient(135deg, #16a34a, #15803d)',
                        color: '#fff', border: 'none', borderRadius: 9, padding: '9px 18px',
                        fontSize: 13, fontWeight: 700, cursor: 'pointer',
                        boxShadow: '0 2px 8px rgba(21,128,61,0.3)',
                      }}
                    >
                      <Check /> Confirm & Submit
                    </button>
                  </>
                )}

                {tab === 'report' && (
                  <button
                    onClick={() => setTab('input')}
                    style={{ background: '#f3f4f6', border: 'none', borderRadius: 9, padding: '9px 16px', fontSize: 13, fontWeight: 600, color: '#374151', cursor: 'pointer' }}
                  >
                    ← Edit Input
                  </button>
                )}
              </div>
            </div>

          </div>
        </div>
      )}
    </>
  );
}
