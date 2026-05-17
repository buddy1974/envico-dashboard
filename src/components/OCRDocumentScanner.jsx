import { useRef, useState } from 'react';
import api from '../services/api';

const CONTEXT_LABELS = {
  referral: 'REFERRAL',
  incident: 'INCIDENT',
  care_note: 'CARE NOTE',
  document: 'DOCUMENT',
};

// File types that can be OCR'd via AI vision
const IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];

// All accepted file types for attachments
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

export default function OCRDocumentScanner({ context, onImport, label }) {
  const [status, setStatus] = useState('idle'); // idle | loading | success | error | attached
  const [preview, setPreview] = useState(null);
  const [fileName, setFileName] = useState('');
  const [fileType, setFileType] = useState('');
  const [result, setResult] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  const fileRef = useRef();
  const cameraRef = useRef();

  async function processFile(file) {
    setErrorMsg('');
    setFileName(file.name);
    setFileType(file.type);

    const isImage = IMAGE_TYPES.includes(file.type);

    if (isImage) {
      // AI OCR path for images
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
    } else {
      // Non-image: attach directly — notify parent with file metadata
      setStatus('attached');
      const reader = new FileReader();
      reader.onload = (e) => {
        const base64 = e.target.result.split(',')[1];
        onImport?.({
          attached_file_name: file.name,
          attached_file_type: file.type,
          attached_file_size: `${(file.size / 1024).toFixed(1)} KB`,
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

  const fields = result ? Object.entries(result).filter(([k]) => k !== 'confidence' && result[k]) : [];
  const confidence = result?.confidence ?? null;
  const confColor = confidence === 'HIGH' ? '#16a34a' : confidence === 'MEDIUM' ? '#ca8a04' : '#dc2626';

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
            <button type="button" style={s.btnPurple} onClick={() => cameraRef.current?.click()}>
              📷 Take Photo
            </button>
            <button type="button" style={s.btnGray} onClick={() => fileRef.current?.click()}>
              ⬆ Attach File
            </button>
            <input
              ref={cameraRef}
              type="file"
              accept="image/*"
              capture="environment"
              style={{ display: 'none' }}
              onChange={handleFile}
            />
            <input
              ref={fileRef}
              type="file"
              accept={ACCEPT_ALL}
              style={{ display: 'none' }}
              onChange={handleFile}
            />
          </div>
          <p style={s.hint}>
            Images · PDF · Word (.docx) · Excel (.xlsx) · CSV · Text
          </p>
        </>
      )}

      {/* Non-image attachment success */}
      {status === 'attached' && (
        <div style={s.attachedRow}>
          <span style={{ fontSize: '1.5rem' }}>{getFileIcon(fileType)}</span>
          <div style={s.attachedInfo}>
            <span style={s.attachedName}>{fileName}</span>
            <span style={s.attachedMeta}>Attached · ready to save with incident</span>
          </div>
          <span style={{ color: '#4ade80', fontSize: '1.1rem' }}>✓</span>
          <button type="button" style={s.resetLink} onClick={reset}>Remove</button>
        </div>
      )}

      {/* Image OCR flow */}
      {(status === 'loading' || status === 'success' || status === 'error') && (
        <div style={s.resultRow}>
          {preview && <img src={preview} alt="scan preview" style={s.thumb} />}
          <div style={s.resultRight}>
            {status === 'loading' && (
              <div style={s.loading}>
                <span style={s.spinner}>⟳</span> AI is reading...
              </div>
            )}
            {status === 'success' && result && (
              <>
                {fields.map(([key, val]) => (
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
    background: '#1e1030',
    border: '1px solid #5b21b6',
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
    background: 'rgba(34,197,94,0.08)',
    border: '1px solid rgba(34,197,94,0.25)',
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
  sparkles: { color: '#a855f7', fontSize: '1rem' },
  headerText: { color: '#e9d5ff', fontSize: '0.85rem', fontWeight: 600 },
  badge: {
    background: 'rgba(91,33,182,0.3)',
    color: '#c084fc',
    fontSize: '0.7rem',
    fontWeight: 700,
    padding: '2px 8px',
    borderRadius: '10px',
    letterSpacing: '0.5px',
  },
  buttons: { display: 'flex', gap: '0.5rem' },
  btnPurple: {
    background: '#7c3aed',
    color: '#fff',
    border: 'none',
    borderRadius: '6px',
    padding: '0.45rem 0.85rem',
    fontSize: '0.82rem',
    fontWeight: 600,
    cursor: 'pointer',
  },
  btnGray: {
    background: '#374151',
    color: '#d1d5db',
    border: 'none',
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
    border: '1px solid #4c1d95',
  },
  resultRight: { flex: 1, display: 'flex', flexDirection: 'column', gap: '0.3rem' },
  loading: { color: '#c084fc', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.4rem' },
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
    background: '#7c3aed',
    color: '#fff',
    border: 'none',
    borderRadius: '6px',
    padding: '0.4rem 0.9rem',
    fontSize: '0.82rem',
    fontWeight: 600,
    cursor: 'pointer',
    marginTop: '0.2rem',
    alignSelf: 'flex-start',
  },
  resetLink: {
    background: 'none',
    border: 'none',
    color: '#a78bfa',
    fontSize: '0.78rem',
    cursor: 'pointer',
    padding: 0,
    textDecoration: 'underline',
    alignSelf: 'flex-start',
  },
  errText: { color: '#f87171', fontSize: '0.82rem' },
};
