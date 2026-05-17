import { useRef, useState } from 'react';
import api from '../services/api';

// Envico brand colours
const BLUE   = '#00B6FF';
const YELLOW = '#F5BA21';

const CONTEXT_LABELS = {
  referral:  'REFERRAL',
  incident:  'INCIDENT',
  care_note: 'CARE NOTE',
  document:  'DOCUMENT',
};

// Context → smart-input section mapping
const CONTEXT_SECTION = {
  referral:   'referral',
  incident:   'incident',
  care_note:  'care-plan',
  document:   'referral',
};

// File types that can be OCR'd via AI vision
const IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];

// File types that can be read as text and sent to smart-input AI
const TEXT_TYPES = ['text/csv', 'text/plain', 'text/tsv'];

// All accepted file types
const ACCEPT_ALL = [
  'image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/csv',
  'text/plain',
].join(',');

function getFileIcon(mimeType = '') {
  if (mimeType.startsWith('image/')) return '🖼️';
  if (mimeType === 'application/pdf') return '📄';
  if (mimeType.includes('word')) return '📝';
  if (mimeType.includes('excel') || mimeType.includes('spreadsheet') || mimeType === 'text/csv') return '📊';
  return '📎';
}

// Normalise smart-input fields → keys the parent onImport handlers expect
function normaliseSmartFields(fields) {
  return {
    ...fields,
    full_name:     fields.service_user_name ?? fields.full_name ?? null,
    date_of_birth: fields.date_of_birth ?? null,
    phone:         fields.phone ?? fields.phone_number ?? null,
    address:       fields.address ?? fields.address_line1 ?? null,
    nhs_number:    fields.nhs_number ?? null,
    type:          fields.type ?? null,
    severity:      fields.severity ?? null,
    description:   fields.description ?? null,
    reported_by:   fields.reported_by ?? null,
    title:         fields.title ?? null,
    support_needs: fields.support_needs ?? fields.observation ?? null,
  };
}

export default function OCRDocumentScanner({ context, onImport, label }) {
  const [status, setStatus]   = useState('idle'); // idle | loading | success | error | attached
  const [preview, setPreview] = useState(null);
  const [fileName, setFileName] = useState('');
  const [fileType, setFileType] = useState('');
  const [result, setResult]   = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  const fileRef   = useRef();
  const cameraRef = useRef();

  async function processFile(file) {
    setErrorMsg('');
    setFileName(file.name);
    setFileType(file.type);

    const isImage = IMAGE_TYPES.includes(file.type);
    const isText  = TEXT_TYPES.includes(file.type);

    if (isImage) {
      // ── AI Vision OCR path ──────────────────────────────────────────────
      setStatus('loading');
      setPreview(URL.createObjectURL(file));
      const reader = new FileReader();
      reader.onload = async (e) => {
        const base64 = e.target.result.split(',')[1];
        try {
          const res = await api.post('/api/ai/ocr', { imageBase64: base64, mediaType: file.type, context });
          setResult(res.data);
          setStatus('success');
        } catch (err) {
          setErrorMsg(err.response?.data?.message ?? 'Failed to read image');
          setStatus('error');
        }
      };
      reader.readAsDataURL(file);

    } else if (isText) {
      // ── CSV / Text → smart-input AI → auto-fill form ────────────────────
      setStatus('loading');
      const reader = new FileReader();
      reader.onload = async (e) => {
        const rawText = String(e.target.result);
        const section = CONTEXT_SECTION[context] ?? 'referral';
        try {
          const res = await api.post('/api/smart-input/process', {
            rawText: rawText.slice(0, 4000),
            section,
          });
          if (res.data?.fields) {
            const normalised = normaliseSmartFields(res.data.fields);
            const clean = Object.fromEntries(
              Object.entries(normalised).filter(([, v]) => v !== null && v !== undefined && v !== '')
            );
            clean.confidence = res.data.confidence ?? 'MEDIUM';
            setResult(clean);
            setStatus('success');
          } else {
            throw new Error('No fields extracted');
          }
        } catch {
          // Fallback: attach without auto-fill
          setStatus('attached');
          onImport?.({ attached_file_name: file.name, attached_file_type: file.type, confidence: 'LOW' });
        }
      };
      reader.readAsText(file);

    } else {
      // ── PDF / Word / Excel → attach directly ────────────────────────────
      setStatus('attached');
      const reader = new FileReader();
      reader.onload = (e) => {
        const base64 = e.target.result.split(',')[1];
        onImport?.({
          attached_file_name:   file.name,
          attached_file_type:   file.type,
          attached_file_size:   `${(file.size / 1024).toFixed(1)} KB`,
          attached_file_base64: base64,
          confidence: 'HIGH',
        });
      };
      reader.readAsDataURL(file);
    }
  }

  function handleFile(e) {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  }

  function reset() {
    setStatus('idle');
    setPreview(null);
    setFileName('');
    setFileType('');
    setResult(null);
    setErrorMsg('');
    if (fileRef.current) fileRef.current.value = '';
    if (cameraRef.current) cameraRef.current.value = '';
  }

  const SKIP_KEYS = new Set(['confidence', 'attached_file_name', 'attached_file_type', 'attached_file_size', 'attached_file_base64']);
  const fields     = result ? Object.entries(result).filter(([k]) => !SKIP_KEYS.has(k) && result[k]) : [];
  const confidence = result?.confidence ?? null;
  const confColor  = confidence === 'HIGH' ? '#16a34a' : confidence === 'MEDIUM' ? '#ca8a04' : '#dc2626';

  return (
    <div style={s.card}>
      <div style={s.header}>
        <div style={s.headerLeft}>
          <span style={s.sparkles}>✦</span>
          <span style={s.headerText}>{label ?? 'Attach or Scan Document'}</span>
        </div>
        <span style={s.badge}>{CONTEXT_LABELS[context] ?? context?.toUpperCase()}</span>
      </div>

      {status === 'idle' && (
        <>
          <div style={s.buttons}>
            <button type="button" style={s.btnBlue} onClick={() => cameraRef.current?.click()}>
              📷 Take Photo
            </button>
            <button type="button" style={s.btnGray} onClick={() => fileRef.current?.click()}>
              ⬆ Attach File
            </button>
            <input ref={cameraRef} type="file" accept="image/*" capture="environment"
              style={{ display: 'none' }} onChange={handleFile} />
            <input ref={fileRef} type="file" accept={ACCEPT_ALL}
              style={{ display: 'none' }} onChange={handleFile} />
          </div>
          <p style={s.hint}>
            CSV / Text → AI extracts &amp; auto-fills form &nbsp;·&nbsp; Images → AI reads &amp; extracts &nbsp;·&nbsp; PDF · Word · Excel → attached to record
          </p>
        </>
      )}

      {/* Non-parseable file attached */}
      {status === 'attached' && (
        <div style={s.attachedRow}>
          <span style={{ fontSize: '1.5rem' }}>{getFileIcon(fileType)}</span>
          <div style={s.attachedInfo}>
            <span style={s.attachedName}>{fileName}</span>
            <span style={s.attachedMeta}>Attached · ready to save with record</span>
          </div>
          <span style={{ color: '#4ade80', fontSize: '1.1rem' }}>✓</span>
          <button type="button" style={s.resetLink} onClick={reset}>Remove</button>
        </div>
      )}

      {/* Image OCR + CSV smart-input results */}
      {(status === 'loading' || status === 'success' || status === 'error') && (
        <div style={s.resultRow}>
          {preview && <img src={preview} alt="scan preview" style={s.thumb} />}
          <div style={s.resultRight}>
            {status === 'loading' && (
              <div style={s.loading}>
                <span style={s.spinner}>⟳</span>
                {IMAGE_TYPES.includes(fileType) ? ' AI is reading document…' : ' AI is extracting fields from file…'}
              </div>
            )}
            {status === 'success' && result && (
              <>
                {fields.slice(0, 6).map(([key, val]) => (
                  <div key={key} style={s.field}>
                    <span style={s.check}>✓</span>
                    <span style={s.fieldText}>
                      {formatKey(key)}: <strong>{String(val).slice(0, 60)}</strong>
                    </span>
                  </div>
                ))}
                {confidence && (
                  <span style={{ ...s.confBadge, background: `${confColor}22`, color: confColor }}>
                    {confidence} CONFIDENCE
                  </span>
                )}
                <button type="button" style={s.importBtn} onClick={() => onImport(result)}>
                  Import to Form
                </button>
              </>
            )}
            {status === 'error' && (
              <span style={s.errText}>{errorMsg || 'Could not read document'}</span>
            )}
            <button type="button" style={s.resetLink} onClick={reset}>
              Scan Again
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function formatKey(key) {
  return key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

const s = {
  card: {
    background: '#0a1628',
    border: `1px solid ${BLUE}44`,
    borderRadius: '8px',
    padding: '0.85rem 1rem',
    marginBottom: '1rem',
  },
  hint: {
    margin: '0.4rem 0 0',
    fontSize: '0.68rem',
    color: '#6b7280',
  },
  attachedRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.65rem',
    background: `${BLUE}10`,
    border: `1px solid ${BLUE}33`,
    borderRadius: '6px',
    padding: '0.55rem 0.75rem',
  },
  attachedInfo: { flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 },
  attachedName: { fontSize: '0.82rem', fontWeight: 600, color: '#d1d5db', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  attachedMeta: { fontSize: '0.68rem', color: '#6b7280', marginTop: '1px' },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '0.65rem',
  },
  headerLeft: { display: 'flex', alignItems: 'center', gap: '0.4rem' },
  sparkles: { color: BLUE, fontSize: '1rem' },
  headerText: { color: '#e0f5ff', fontSize: '0.85rem', fontWeight: 600 },
  badge: {
    background: `${BLUE}22`,
    color: BLUE,
    fontSize: '0.7rem',
    fontWeight: 700,
    padding: '2px 8px',
    borderRadius: '10px',
    letterSpacing: '0.5px',
  },
  buttons: { display: 'flex', gap: '0.5rem' },
  btnBlue: {
    background: BLUE,
    color: '#fff',
    border: 'none',
    borderRadius: '6px',
    padding: '0.45rem 0.85rem',
    fontSize: '0.82rem',
    fontWeight: 600,
    cursor: 'pointer',
  },
  btnGray: {
    background: '#1e2a3a',
    color: '#d1d5db',
    border: `1px solid ${BLUE}33`,
    borderRadius: '6px',
    padding: '0.45rem 0.85rem',
    fontSize: '0.82rem',
    fontWeight: 600,
    cursor: 'pointer',
  },
  resultRow: { display: 'flex', gap: '0.75rem', alignItems: 'flex-start' },
  thumb: {
    width: '72px',
    height: '72px',
    objectFit: 'cover',
    borderRadius: '6px',
    flexShrink: 0,
    border: `1px solid ${BLUE}44`,
  },
  resultRight: { flex: 1, display: 'flex', flexDirection: 'column', gap: '0.3rem' },
  loading: { color: BLUE, fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.4rem' },
  spinner: { display: 'inline-block', fontSize: '1.1rem' },
  field: { display: 'flex', alignItems: 'center', gap: '0.4rem' },
  check: { color: '#4ade80', fontSize: '0.85rem' },
  fieldText: { color: '#d1d5db', fontSize: '0.8rem' },
  confBadge: {
    display: 'inline-block',
    padding: '2px 8px',
    borderRadius: '10px',
    fontSize: '0.7rem',
    fontWeight: 700,
    marginTop: '0.15rem',
    alignSelf: 'flex-start',
  },
  importBtn: {
    background: YELLOW,
    color: '#0a1628',
    border: 'none',
    borderRadius: '6px',
    padding: '0.4rem 0.9rem',
    fontSize: '0.82rem',
    fontWeight: 700,
    cursor: 'pointer',
    marginTop: '0.2rem',
    alignSelf: 'flex-start',
  },
  resetLink: {
    background: 'none',
    border: 'none',
    color: BLUE,
    fontSize: '0.78rem',
    cursor: 'pointer',
    padding: 0,
    textDecoration: 'underline',
    alignSelf: 'flex-start',
  },
  errText: { color: '#f87171', fontSize: '0.82rem' },
};
