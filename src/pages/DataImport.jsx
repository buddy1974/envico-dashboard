import { useRef, useState } from 'react';
import api from '../services/api';

// ─── Constants ────────────────────────────────────────────────────────────────
const MODULES = [
  { id: 'service_users', label: 'Service Users', icon: '📋', desc: 'Import client/patient records' },
  { id: 'staff',         label: 'Staff',          icon: '👥', desc: 'Import employee records' },
  { id: 'medications',   label: 'Medications',    icon: '💊', desc: 'Import medication/MAR records' },
  { id: 'incidents',     label: 'Incidents',      icon: '🚨', desc: 'Import incident history' },
  { id: 'training',      label: 'Training Records',icon: '📚', desc: 'Import staff training data' },
];

const MODULE_FIELDS = {
  service_users: ['first_name','last_name','date_of_birth','nhs_number','address','care_type','status','key_worker'],
  staff:         ['first_name','last_name','email','phone','role','start_date','position','dbs_number'],
  medications:   ['service_user','medication_name','dosage','frequency','prescribed_by','start_date','route'],
  incidents:     ['service_user','incident_type','date','time','description','reported_by','severity'],
  training:      ['staff_name','training_name','provider','completed_date','expiry_date','certificate_number'],
};

const ANALYSE_MESSAGES = [
  'Reading your file…',
  'AI is analysing column headers…',
  'Mapping your data to CareOS fields…',
  'Checking for issues…',
];

// ─── Spinner ──────────────────────────────────────────────────────────────────
function Spinner({ size = 18 }) {
  return (
    <span style={{
      display: 'inline-block', width: size, height: size,
      border: '2px solid #e5e7eb', borderTopColor: '#1a1a2e',
      borderRadius: '50%', animation: 'spin 0.7s linear infinite',
    }} />
  );
}

// ─── Section 1 — Module Selector ─────────────────────────────────────────────
function ModuleSelector({ selected, onSelect }) {
  async function downloadTemplate(moduleId, e) {
    e.stopPropagation();
    try {
      const res = await api.get(`/api/import/template/${moduleId}`, { responseType: 'blob' });
      const url = URL.createObjectURL(res.data);
      const a   = document.createElement('a');
      a.href     = url;
      a.download = `${moduleId}_template.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      alert('Template download unavailable. Contact support.');
    }
  }

  return (
    <div style={s.section}>
      <h2 style={s.sectionTitle}>1. Select Module to Import</h2>
      <div style={s.moduleGrid}>
        {MODULES.map((m) => (
          <div
            key={m.id}
            style={{ ...s.moduleCard, ...(selected === m.id ? s.moduleCardActive : {}) }}
            onClick={() => onSelect(m.id)}
          >
            <span style={s.moduleIcon}>{m.icon}</span>
            <div style={s.moduleLabel}>{m.label}</div>
            <div style={s.moduleDesc}>{m.desc}</div>
            <button
              style={s.templateBtn}
              onClick={(e) => downloadTemplate(m.id, e)}
            >
              ⬇ Download Template
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── File Upload Tab ──────────────────────────────────────────────────────────
function FileUploadTab({ onFileSelect, file }) {
  const inputRef  = useRef(null);
  const [dragging, setDragging] = useState(false);

  function handleDrop(e) {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) onFileSelect(f);
  }

  function handleChange(e) {
    const f = e.target.files[0];
    if (f) onFileSelect(f);
  }

  function fmtSize(bytes) {
    if (bytes < 1024)       return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  return (
    <div>
      <div
        style={{ ...s.dropZone, ...(dragging ? s.dropZoneActive : {}), ...(file ? s.dropZoneHasFile : {}) }}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,.xls,.csv"
          style={{ display: 'none' }}
          onChange={handleChange}
        />
        {file ? (
          <div style={s.fileInfo}>
            <span style={s.fileIcon}>📄</span>
            <div>
              <div style={s.fileName}>{file.name}</div>
              <div style={s.fileSize}>{fmtSize(file.size)}</div>
            </div>
            <button style={s.removeFile} onClick={(e) => { e.stopPropagation(); onFileSelect(null); }}>✕</button>
          </div>
        ) : (
          <>
            <div style={s.dropIcon}>📂</div>
            <div style={s.dropPrimary}>Drag your Excel or CSV file here, or click to browse</div>
            <div style={s.dropSub}>Accepted: .xlsx, .xls, .csv · Max 10 MB</div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Google Sheets Tab ────────────────────────────────────────────────────────
function GoogleSheetsTab({ url, setUrl, hasHeaders, setHasHeaders }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      <label style={s.label}>Google Sheets URL</label>
      <input
        style={s.input}
        type="url"
        placeholder="https://docs.google.com/spreadsheets/d/…"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
      />
      <label style={s.checkRow}>
        <input
          type="checkbox"
          checked={hasHeaders}
          onChange={(e) => setHasHeaders(e.target.checked)}
          style={{ width: 16, height: 16, cursor: 'pointer' }}
        />
        <span style={{ fontSize: '0.88rem', color: '#374151' }}>First row contains headers</span>
      </label>
      <div style={s.sheetsNote}>
        ℹ️ Make sure your sheet is shared publicly or with view access before analysing.
      </div>
    </div>
  );
}

// ─── Analyse Loading ──────────────────────────────────────────────────────────
function AnalysingPanel({ message }) {
  return (
    <div style={s.analysingPanel}>
      <Spinner size={28} />
      <div style={s.analysingMsg}>{message}</div>
    </div>
  );
}

// ─── Analysis Results ─────────────────────────────────────────────────────────
function AnalysisResults({ result, module: mod, onMappingChange }) {
  const { total_rows, success_rate, issues = [], mappings = [], preview = [] } = result;
  const successPct = Math.round(success_rate ?? 0);

  const rateColour = successPct >= 85 ? '#166534' : successPct >= 60 ? '#92400e' : '#991b1b';
  const rateBg     = successPct >= 85 ? '#dcfce7'  : successPct >= 60 ? '#fef3c7'  : '#fee2e2';

  const fields = MODULE_FIELDS[mod] ?? [];

  return (
    <div style={s.section}>
      <h2 style={s.sectionTitle}>AI Analysis Results</h2>

      {/* Summary bar */}
      <div style={s.summaryBar}>
        <div style={s.summaryItem}>
          <div style={s.summaryNum}>{total_rows ?? 0}</div>
          <div style={s.summaryLabel}>Rows Found</div>
        </div>
        <div style={s.summaryDivider} />
        <div style={s.summaryItem}>
          <div style={{ ...s.summaryNum, color: rateColour }}>{successPct}%</div>
          <div style={s.summaryLabel}>Est. Success Rate</div>
        </div>
        <div style={s.summaryDivider} />
        <div style={s.summaryItem}>
          <div style={{ ...s.summaryNum, color: issues.length > 0 ? '#92400e' : '#166534' }}>
            {issues.length}
          </div>
          <div style={s.summaryLabel}>Issues Found</div>
        </div>
      </div>

      {/* Column mapping */}
      <h3 style={s.subTitle}>Column Mapping</h3>
      <div style={s.tableWrap}>
        <table style={s.table}>
          <thead>
            <tr>
              {['Your Column', 'CareOS Field', 'Status'].map((h) => (
                <th key={h} style={s.th}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {mappings.map((row, i) => (
              <tr key={i} style={s.tr}>
                <td style={s.td}><code style={s.colCode}>{row.source_column}</code></td>
                <td style={s.td}>
                  <select
                    style={s.mapSelect}
                    value={row.target_field ?? ''}
                    onChange={(e) => onMappingChange(i, e.target.value)}
                  >
                    <option value="">— skip —</option>
                    {fields.map((f) => (
                      <option key={f} value={f}>{f}</option>
                    ))}
                  </select>
                </td>
                <td style={s.td}>
                  {row.status === 'matched'  && <span style={s.badgeGreen}>✅ Matched</span>}
                  {row.status === 'partial'  && <span style={s.badgeAmber}>⚠️ Partial</span>}
                  {row.status === 'missing'  && <span style={s.badgeRed}>❌ Missing</span>}
                  {!row.status               && <span style={s.badgeGrey}>— Unknown</span>}
                </td>
              </tr>
            ))}
            {mappings.length === 0 && (
              <tr><td colSpan={3} style={{ ...s.td, textAlign: 'center', color: '#9ca3af' }}>No column data available.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Issues */}
      {issues.length > 0 && (
        <>
          <h3 style={s.subTitle}>Issues to Review</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            {issues.map((issue, i) => (
              <div key={i} style={s.issueCard}>
                <div style={s.issueField}>{issue.field ?? `Row ${issue.row ?? i + 1}`}</div>
                <div style={s.issueDesc}>{issue.description ?? issue.message}</div>
                {issue.suggestion && (
                  <div style={s.issueSuggestion}>💡 {issue.suggestion}</div>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      {/* Preview */}
      {preview.length > 0 && (
        <>
          <h3 style={s.subTitle}>Data Preview (first 5 rows)</h3>
          <div style={s.tableWrap}>
            <table style={s.table}>
              <thead>
                <tr>
                  <th style={s.th}>#</th>
                  {Object.keys(preview[0]).map((k) => (
                    <th key={k} style={s.th}>{k}</th>
                  ))}
                  <th style={s.th}>Status</th>
                </tr>
              </thead>
              <tbody>
                {preview.map((row, i) => {
                  const rowStatus = row._status ?? 'ok';
                  const rowBg =
                    rowStatus === 'skip'    ? '#fff1f2' :
                    rowStatus === 'warning' ? '#fffbeb' : '#f0fdf4';
                  return (
                    <tr key={i} style={{ ...s.tr, background: rowBg }}>
                      <td style={s.td}>{i + 1}</td>
                      {Object.entries(row).filter(([k]) => k !== '_status').map(([k, v]) => (
                        <td key={k} style={s.td}>{String(v ?? '—')}</td>
                      ))}
                      <td style={s.td}>
                        {rowStatus === 'skip'    && <span style={s.badgeRed}>Skip</span>}
                        {rowStatus === 'warning' && <span style={s.badgeAmber}>Warning</span>}
                        {rowStatus === 'ok'      && <span style={s.badgeGreen}>Import</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Confirm Modal ────────────────────────────────────────────────────────────
function ConfirmModal({ moduleLabel, toImport, toSkip, onConfirm, onCancel, importing }) {
  return (
    <div style={s.modalOverlay}>
      <div style={s.modal}>
        <h2 style={s.modalTitle}>Confirm Import</h2>
        <p style={s.modalBody}>
          You are about to import <strong>{toImport} records</strong> into <strong>{moduleLabel}</strong>.
        </p>
        {toSkip > 0 && (
          <p style={{ ...s.modalBody, color: '#92400e' }}>
            ⚠️ {toSkip} records will be skipped due to errors.
          </p>
        )}
        <p style={{ ...s.modalBody, color: '#dc2626', fontWeight: 600 }}>
          This action cannot be undone. Continue?
        </p>
        <div style={s.modalActions}>
          <button style={s.cancelBtn} onClick={onCancel} disabled={importing}>Cancel</button>
          <button style={s.importBtn} onClick={onConfirm} disabled={importing}>
            {importing ? <><Spinner size={14} /> &nbsp;Importing…</> : `Import ${toImport} Records`}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Import Results ───────────────────────────────────────────────────────────
function ImportResults({ result, onReset }) {
  const { total, imported, skipped, errors = [] } = result;
  const success = imported === total || skipped === 0;

  function downloadErrors() {
    const rows = [['Row', 'Reason'], ...errors.map((e) => [e.row, e.reason])];
    const csv  = rows.map((r) => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = 'import_errors.csv'; a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div style={s.section}>
      <div style={{ ...s.resultBanner, background: success ? '#dcfce7' : '#fff7ed', border: `1px solid ${success ? '#86efac' : '#fdba74'}` }}>
        <div style={{ fontSize: '2rem' }}>{success ? '✅' : '⚠️'}</div>
        <div>
          <div style={{ fontWeight: 700, fontSize: '1.1rem', color: success ? '#166534' : '#92400e' }}>
            {success ? 'Import Successful!' : 'Import Completed with Warnings'}
          </div>
          <div style={{ fontSize: '0.88rem', color: '#374151', marginTop: '4px' }}>
            {imported} records imported · {skipped} skipped
          </div>
        </div>
      </div>

      <div style={s.statsRow}>
        <div style={s.statCard}>
          <div style={s.statNum}>{total}</div>
          <div style={s.statLabel}>Total Rows</div>
        </div>
        <div style={s.statCard}>
          <div style={{ ...s.statNum, color: '#166534' }}>{imported}</div>
          <div style={s.statLabel}>Imported</div>
        </div>
        <div style={s.statCard}>
          <div style={{ ...s.statNum, color: skipped > 0 ? '#92400e' : '#9ca3af' }}>{skipped}</div>
          <div style={s.statLabel}>Skipped</div>
        </div>
      </div>

      {errors.length > 0 && (
        <>
          <h3 style={s.subTitle}>Skipped Rows</h3>
          <div style={s.tableWrap}>
            <table style={s.table}>
              <thead>
                <tr>
                  <th style={s.th}>Row</th>
                  <th style={s.th}>Reason</th>
                </tr>
              </thead>
              <tbody>
                {errors.map((e, i) => (
                  <tr key={i} style={s.tr}>
                    <td style={s.td}>{e.row}</td>
                    <td style={s.td}>{e.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button style={s.dlErrorsBtn} onClick={downloadErrors}>
            ⬇ Download Error Report (CSV)
          </button>
        </>
      )}

      <button style={s.importMoreBtn} onClick={onReset}>
        ↩ Import More Data
      </button>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function DataImport() {
  const [selectedModule, setSelectedModule] = useState(null);
  const [activeTab, setActiveTab]           = useState('file');
  const [file, setFile]                     = useState(null);
  const [sheetsUrl, setSheetsUrl]           = useState('');
  const [hasHeaders, setHasHeaders]         = useState(true);

  const [step, setStep] = useState('idle'); // idle | analysing | analysed | confirming | importing | done
  const [analyseMsg, setAnalyseMsg]   = useState('');
  const [analysisResult, setAnalysis] = useState(null);
  const [mappings, setMappings]       = useState([]);
  const [importResult, setImportResult] = useState(null);
  const [error, setError]             = useState('');

  const msgIntervalRef = useRef(null);

  function startAnalyseMessages() {
    let i = 0;
    setAnalyseMsg(ANALYSE_MESSAGES[0]);
    msgIntervalRef.current = setInterval(() => {
      i = (i + 1) % ANALYSE_MESSAGES.length;
      setAnalyseMsg(ANALYSE_MESSAGES[i]);
    }, 1800);
  }

  function stopAnalyseMessages() {
    if (msgIntervalRef.current) {
      clearInterval(msgIntervalRef.current);
      msgIntervalRef.current = null;
    }
  }

  async function analyse() {
    if (!selectedModule) { setError('Please select a module first.'); return; }
    if (activeTab === 'file' && !file) { setError('Please upload a file first.'); return; }
    if (activeTab === 'sheets' && !sheetsUrl.trim()) { setError('Please enter a Google Sheets URL.'); return; }

    setError('');
    setStep('analysing');
    startAnalyseMessages();

    try {
      let res;
      if (activeTab === 'file') {
        const fd = new FormData();
        fd.append('file', file);
        fd.append('module', selectedModule);
        res = await api.post('/api/import/analyse', fd, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
      } else {
        res = await api.post('/api/import/google-sheet', {
          url: sheetsUrl,
          module: selectedModule,
          has_headers: hasHeaders,
        });
      }
      stopAnalyseMessages();
      const data = res.data;
      setAnalysis(data);
      setMappings(data.mappings ?? []);
      setStep('analysed');
    } catch (err) {
      stopAnalyseMessages();
      setError(err.response?.data?.error ?? 'Analysis failed. Check your file and try again.');
      setStep('idle');
    }
  }

  async function executeImport() {
    setStep('importing');
    setError('');
    try {
      const res = await api.post('/api/import/execute', {
        module: selectedModule,
        mappings,
        source_type: activeTab,
        ...(activeTab === 'file' ? { filename: file?.name } : { url: sheetsUrl }),
      });
      setImportResult(res.data);
      setStep('done');
    } catch (err) {
      setError(err.response?.data?.error ?? 'Import failed.');
      setStep('analysed');
    }
  }

  function reset() {
    setSelectedModule(null);
    setFile(null);
    setSheetsUrl('');
    setHasHeaders(true);
    setStep('idle');
    setAnalysis(null);
    setMappings([]);
    setImportResult(null);
    setError('');
    setActiveTab('file');
  }

  function updateMapping(index, value) {
    setMappings((prev) => prev.map((m, i) => i === index ? { ...m, target_field: value } : m));
  }

  const selectedModuleObj = MODULES.find((m) => m.id === selectedModule);
  const toImport = analysisResult ? Math.round((analysisResult.total_rows ?? 0) * (analysisResult.success_rate ?? 1) / 100) : 0;
  const toSkip   = (analysisResult?.total_rows ?? 0) - toImport;

  return (
    <div style={s.page}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      {/* Header */}
      <div style={s.headerWrap}>
        <div>
          <h1 style={s.title}>📥 Data Import Center</h1>
          <p style={s.subtitle}>Import your existing care records into CareOS. AI will guide you through the process.</p>
        </div>
      </div>

      {/* Warning banner */}
      <div style={s.warningBanner}>
        ⚠️ <strong>Always backup your data before importing.</strong> Test with a small file first before importing your full dataset.
      </div>

      {/* Done state */}
      {step === 'done' && importResult && (
        <ImportResults result={importResult} onReset={reset} />
      )}

      {step !== 'done' && (
        <>
          {/* Section 1 — Module */}
          <ModuleSelector selected={selectedModule} onSelect={(id) => { setSelectedModule(id); setStep('idle'); setAnalysis(null); setError(''); }} />

          {/* Section 2 — Import method */}
          {selectedModule && (
            <div style={s.section}>
              <h2 style={s.sectionTitle}>2. Choose Import Method</h2>

              {/* Tabs */}
              <div style={s.tabs}>
                <button style={{ ...s.tab, ...(activeTab === 'file' ? s.tabActive : {}) }} onClick={() => setActiveTab('file')}>
                  📁 Upload File (Excel/CSV)
                </button>
                <button style={{ ...s.tab, ...(activeTab === 'sheets' ? s.tabActive : {}) }} onClick={() => setActiveTab('sheets')}>
                  🔗 Google Sheets URL
                </button>
              </div>

              <div style={s.tabContent}>
                {activeTab === 'file' && (
                  <FileUploadTab file={file} onFileSelect={setFile} />
                )}
                {activeTab === 'sheets' && (
                  <GoogleSheetsTab
                    url={sheetsUrl} setUrl={setSheetsUrl}
                    hasHeaders={hasHeaders} setHasHeaders={setHasHeaders}
                  />
                )}
              </div>

              {error && <div style={s.errorBanner}>{error}</div>}

              {step !== 'analysing' && (
                <button
                  style={{ ...s.analyseBtn, opacity: step === 'analysing' ? 0.6 : 1 }}
                  onClick={analyse}
                  disabled={step === 'analysing'}
                >
                  🔍 Analyse {activeTab === 'file' ? 'File' : 'Sheet'}
                </button>
              )}
            </div>
          )}

          {/* Analysing loader */}
          {step === 'analysing' && <AnalysingPanel message={analyseMsg} />}

          {/* Analysis results */}
          {step === 'analysed' && analysisResult && (
            <>
              <AnalysisResults
                result={analysisResult}
                module={selectedModule}
                onMappingChange={updateMapping}
              />

              {/* Import action */}
              <div style={s.importActionBar}>
                <div style={s.importStats}>
                  <span style={s.importStatGreen}>✅ {toImport} records will be imported</span>
                  {toSkip > 0 && <span style={s.importStatRed}>❌ {toSkip} will be skipped</span>}
                </div>
                <button
                  style={s.bigImportBtn}
                  onClick={() => setStep('confirming')}
                  disabled={toImport === 0}
                >
                  Import {toImport} Records →
                </button>
              </div>
            </>
          )}
        </>
      )}

      {/* Confirm modal */}
      {step === 'confirming' && (
        <ConfirmModal
          moduleLabel={selectedModuleObj?.label ?? selectedModule}
          toImport={toImport}
          toSkip={toSkip}
          importing={false}
          onConfirm={executeImport}
          onCancel={() => setStep('analysed')}
        />
      )}
      {step === 'importing' && (
        <ConfirmModal
          moduleLabel={selectedModuleObj?.label ?? selectedModule}
          toImport={toImport}
          toSkip={toSkip}
          importing={true}
          onConfirm={() => {}}
          onCancel={() => {}}
        />
      )}
    </div>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = {
  page: { display: 'flex', flexDirection: 'column', gap: '1.25rem' },

  headerWrap: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' },
  title:    { margin: 0, fontSize: '1.5rem', fontWeight: 800, color: '#1a1a2e' },
  subtitle: { margin: '4px 0 0', fontSize: '0.88rem', color: '#6b7280' },

  warningBanner: {
    background: '#fef3c7', border: '1px solid #fcd34d', borderRadius: '10px',
    padding: '0.75rem 1.25rem', fontSize: '0.88rem', color: '#92400e',
  },

  section: {
    background: '#fff', border: '1px solid #e5e7eb', borderRadius: '12px',
    padding: '1.5rem', boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
    display: 'flex', flexDirection: 'column', gap: '1rem',
  },
  sectionTitle: { margin: 0, fontSize: '1rem', fontWeight: 700, color: '#1a1a2e' },
  subTitle: { margin: '0.5rem 0 0', fontSize: '0.9rem', fontWeight: 700, color: '#374151' },

  // Module grid
  moduleGrid: { display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '0.75rem' },
  moduleCard: {
    display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center',
    padding: '1rem 0.75rem', border: '2px solid #e5e7eb', borderRadius: '10px',
    cursor: 'pointer', gap: '0.4rem', background: '#f9fafb',
    transition: 'border-color 0.15s, background 0.15s',
  },
  moduleCardActive: { border: '2px solid #3b82f6', background: '#eff6ff' },
  moduleIcon:  { fontSize: '1.75rem', lineHeight: 1 },
  moduleLabel: { fontWeight: 700, fontSize: '0.85rem', color: '#1a1a2e' },
  moduleDesc:  { fontSize: '0.75rem', color: '#9ca3af', lineHeight: 1.4 },
  templateBtn: {
    marginTop: '0.4rem', padding: '3px 10px', background: 'transparent',
    border: '1px solid #d1d5db', borderRadius: '5px', fontSize: '0.72rem',
    color: '#6b7280', cursor: 'pointer',
  },

  // Tabs
  tabs: { display: 'flex', gap: '0.5rem', borderBottom: '1px solid #e5e7eb', paddingBottom: '0.75rem' },
  tab: {
    padding: '0.5rem 1.25rem', border: '1px solid #e5e7eb', borderRadius: '8px',
    background: '#f9fafb', color: '#6b7280', cursor: 'pointer', fontSize: '0.88rem', fontWeight: 500,
  },
  tabActive: { background: '#1a1a2e', color: '#fff', border: '1px solid #1a1a2e' },
  tabContent: { paddingTop: '0.25rem' },

  // Drop zone
  dropZone: {
    border: '2px dashed #d1d5db', borderRadius: '10px', padding: '2.5rem 2rem',
    textAlign: 'center', cursor: 'pointer', background: '#f9fafb',
    transition: 'border-color 0.15s, background 0.15s',
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem',
  },
  dropZoneActive:  { border: '2px dashed #3b82f6', background: '#eff6ff' },
  dropZoneHasFile: { border: '2px solid #86efac', background: '#f0fdf4' },
  dropIcon:    { fontSize: '2.5rem' },
  dropPrimary: { fontWeight: 600, color: '#374151', fontSize: '0.95rem' },
  dropSub:     { fontSize: '0.8rem', color: '#9ca3af' },
  fileInfo:    { display: 'flex', alignItems: 'center', gap: '0.75rem' },
  fileIcon:    { fontSize: '1.75rem' },
  fileName:    { fontWeight: 600, color: '#1a1a2e', fontSize: '0.9rem' },
  fileSize:    { fontSize: '0.78rem', color: '#9ca3af' },
  removeFile:  { background: 'transparent', border: 'none', color: '#dc2626', cursor: 'pointer', fontSize: '1rem', marginLeft: '0.5rem' },

  // Google sheets
  label: { fontSize: '0.82rem', fontWeight: 600, color: '#374151' },
  input: {
    padding: '0.6rem 0.8rem', border: '1px solid #d1d5db', borderRadius: '7px',
    fontSize: '0.9rem', background: '#f9fafb', outline: 'none', width: '100%', boxSizing: 'border-box',
  },
  checkRow: { display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' },
  sheetsNote: {
    padding: '0.6rem 0.9rem', background: '#eff6ff', border: '1px solid #bfdbfe',
    borderRadius: '7px', fontSize: '0.82rem', color: '#1e40af',
  },

  analyseBtn: {
    alignSelf: 'flex-start', padding: '0.65rem 1.75rem', background: '#1a1a2e', color: '#fff',
    border: 'none', borderRadius: '8px', fontSize: '0.9rem', fontWeight: 700, cursor: 'pointer',
  },
  errorBanner: {
    padding: '0.65rem 1rem', background: '#fee2e2', border: '1px solid #fca5a5',
    borderRadius: '7px', color: '#991b1b', fontSize: '0.88rem',
  },

  // Analysing
  analysingPanel: {
    background: '#fff', border: '1px solid #e5e7eb', borderRadius: '12px',
    padding: '3rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem',
    boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
  },
  analysingMsg: { fontSize: '1rem', color: '#374151', fontWeight: 500 },

  // Analysis results
  summaryBar: {
    display: 'flex', background: '#f9fafb', border: '1px solid #e5e7eb',
    borderRadius: '10px', padding: '1rem',
  },
  summaryItem:    { flex: 1, textAlign: 'center' },
  summaryNum:     { fontSize: '2rem', fontWeight: 800, color: '#1a1a2e', lineHeight: 1 },
  summaryLabel:   { fontSize: '0.75rem', color: '#6b7280', marginTop: '4px', textTransform: 'uppercase' },
  summaryDivider: { width: '1px', background: '#e5e7eb', margin: '0 0.5rem' },

  // Table
  tableWrap: { border: '1px solid #e5e7eb', borderRadius: '8px', overflow: 'auto' },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: {
    padding: '0.6rem 0.75rem', background: '#f9fafb', textAlign: 'left',
    fontSize: '0.75rem', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase',
    borderBottom: '1px solid #e5e7eb', whiteSpace: 'nowrap',
  },
  tr: { borderBottom: '1px solid #f3f4f6' },
  td: { padding: '0.65rem 0.75rem', fontSize: '0.85rem', color: '#374151', verticalAlign: 'middle' },
  colCode: { background: '#f3f4f6', padding: '2px 6px', borderRadius: '4px', fontSize: '0.8rem', fontFamily: 'monospace' },
  mapSelect: {
    padding: '0.3rem 0.6rem', border: '1px solid #d1d5db', borderRadius: '5px',
    fontSize: '0.82rem', background: '#fff', width: '100%',
  },
  badgeGreen: { padding: '2px 8px', background: '#dcfce7', color: '#166534', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 600 },
  badgeAmber: { padding: '2px 8px', background: '#fef3c7', color: '#92400e', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 600 },
  badgeRed:   { padding: '2px 8px', background: '#fee2e2', color: '#991b1b', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 600 },
  badgeGrey:  { padding: '2px 8px', background: '#f3f4f6', color: '#6b7280', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 600 },

  // Issues
  issueCard: {
    padding: '0.75rem 1rem', background: '#fffbeb', border: '1px solid #fde68a',
    borderRadius: '8px', display: 'flex', flexDirection: 'column', gap: '3px',
  },
  issueField:      { fontWeight: 700, fontSize: '0.85rem', color: '#92400e' },
  issueDesc:       { fontSize: '0.85rem', color: '#374151' },
  issueSuggestion: { fontSize: '0.82rem', color: '#6b7280', fontStyle: 'italic' },

  // Import action bar
  importActionBar: {
    background: '#fff', border: '1px solid #e5e7eb', borderRadius: '12px',
    padding: '1.25rem 1.5rem', display: 'flex', alignItems: 'center',
    justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem',
    boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
  },
  importStats:    { display: 'flex', gap: '1.25rem', flexWrap: 'wrap' },
  importStatGreen: { fontSize: '0.9rem', fontWeight: 600, color: '#166534' },
  importStatRed:   { fontSize: '0.9rem', fontWeight: 600, color: '#dc2626' },
  bigImportBtn: {
    padding: '0.75rem 2rem', background: '#16a34a', color: '#fff',
    border: 'none', borderRadius: '10px', fontSize: '1rem', fontWeight: 800,
    cursor: 'pointer', whiteSpace: 'nowrap',
  },

  // Modal
  modalOverlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
  },
  modal: {
    background: '#fff', borderRadius: '14px', padding: '2rem', maxWidth: '460px', width: '100%',
    boxShadow: '0 24px 60px rgba(0,0,0,0.2)',
  },
  modalTitle:   { margin: '0 0 1rem', fontSize: '1.2rem', fontWeight: 700, color: '#1a1a2e' },
  modalBody:    { fontSize: '0.95rem', color: '#374151', margin: '0 0 0.75rem', lineHeight: 1.6 },
  modalActions: { display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '1.5rem' },
  cancelBtn: {
    padding: '0.6rem 1.25rem', background: 'transparent', border: '1px solid #d1d5db',
    borderRadius: '8px', fontSize: '0.9rem', cursor: 'pointer', color: '#374151',
  },
  importBtn: {
    padding: '0.6rem 1.5rem', background: '#16a34a', color: '#fff',
    border: 'none', borderRadius: '8px', fontSize: '0.9rem', fontWeight: 700,
    cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem',
  },

  // Results
  resultBanner: {
    display: 'flex', alignItems: 'center', gap: '1rem', padding: '1.25rem 1.5rem',
    borderRadius: '10px', marginBottom: '0.5rem',
  },
  statsRow: { display: 'flex', gap: '1rem' },
  statCard: {
    flex: 1, background: '#fff', border: '1px solid #e5e7eb', borderRadius: '10px',
    padding: '1rem', textAlign: 'center', boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
  },
  statNum:   { fontSize: '1.8rem', fontWeight: 800, color: '#1a1a2e' },
  statLabel: { fontSize: '0.75rem', color: '#6b7280', textTransform: 'uppercase', marginTop: '4px' },
  dlErrorsBtn: {
    alignSelf: 'flex-start', padding: '0.5rem 1.25rem', background: '#fff',
    border: '1px solid #d1d5db', borderRadius: '7px', fontSize: '0.85rem',
    cursor: 'pointer', color: '#374151', marginTop: '0.25rem',
  },
  importMoreBtn: {
    alignSelf: 'flex-start', padding: '0.65rem 1.5rem', background: '#1a1a2e', color: '#fff',
    border: 'none', borderRadius: '8px', fontSize: '0.9rem', fontWeight: 700, cursor: 'pointer',
    marginTop: '0.5rem',
  },
};
