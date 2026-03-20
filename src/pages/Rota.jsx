import { useCallback, useEffect, useState } from 'react';
import api from '../services/api';

// ─── Constants ────────────────────────────────────────────────────────────────
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const SHIFT_PRESETS = {
  Morning:   { start: '07:00', end: '15:00' },
  Afternoon: { start: '14:00', end: '22:00' },
  Evening:   { start: '18:00', end: '23:00' },
  Night:     { start: '22:00', end: '07:00' },
  'Full Day':{ start: '07:00', end: '19:00' },
};

const STATUS_STYLE = {
  SCHEDULED:   { background: '#f3f4f6', color: '#374151', border: '1px solid #d1d5db' },
  CONFIRMED:   { background: '#dbeafe', color: '#1e40af', border: '1px solid #93c5fd' },
  IN_PROGRESS: { background: '#d1fae5', color: '#065f46', border: '1px solid #6ee7b7' },
  COMPLETED:   { background: '#064e3b', color: '#a7f3d0', border: '1px solid #065f46' },
  NO_SHOW:     { background: '#fee2e2', color: '#991b1b', border: '1px solid #fca5a5' },
  CANCELLED:   { background: '#fff7ed', color: '#9a3412', border: '1px solid #fdba74' },
};

// ─── Week helpers ─────────────────────────────────────────────────────────────
function getWeekDates(offset = 0) {
  const now = new Date();
  const day = now.getDay(); // 0=Sun
  const monday = new Date(now);
  monday.setDate(now.getDate() - (day === 0 ? 6 : day - 1) + offset * 7);
  monday.setHours(0, 0, 0, 0);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
}

function isoDate(d) {
  return d.toISOString().slice(0, 10);
}

function fmtDate(d) {
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

function fmtWeekRange(dates) {
  return `${fmtDate(dates[0])} – ${fmtDate(dates[6])}`;
}

function calcHours(start, end) {
  if (!start || !end) return 0;
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  let mins = (eh * 60 + em) - (sh * 60 + sm);
  if (mins < 0) mins += 24 * 60; // overnight
  return Math.round((mins / 60) * 10) / 10;
}

// ─── Spinner ──────────────────────────────────────────────────────────────────
function Spinner() {
  return <span style={{ display: 'inline-block', width: 14, height: 14, border: '2px solid #e5e7eb', borderTopColor: '#1a1a2e', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />;
}

// ─── Shift Cell ───────────────────────────────────────────────────────────────
function ShiftCell({ shift, onAdd, onView }) {
  if (!shift) {
    return (
      <td style={cellStyles.empty} onClick={onAdd}>
        <span style={cellStyles.addPlus}>+</span>
      </td>
    );
  }
  const st = STATUS_STYLE[shift.status] ?? STATUS_STYLE.SCHEDULED;
  return (
    <td style={cellStyles.filled} onClick={() => onView(shift)}>
      <div style={{ ...cellStyles.shiftPill, ...st }}>
        <div style={cellStyles.shiftType}>{shift.shift_type ?? shift.type ?? '—'}</div>
        <div style={cellStyles.shiftTime}>{shift.start_time}–{shift.end_time}</div>
      </div>
    </td>
  );
}

// ─── Add Shift Modal ──────────────────────────────────────────────────────────
function AddShiftModal({ staff, prefillDate, onClose, onSaved }) {
  const [form, setForm] = useState({
    staff_id: staff[0]?.id ?? '',
    date: prefillDate ?? isoDate(new Date()),
    shift_type: 'Morning',
    start_time: '07:00',
    end_time: '15:00',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState('');

  function applyPreset(type) {
    const p = SHIFT_PRESETS[type] ?? {};
    setForm((f) => ({ ...f, shift_type: type, start_time: p.start ?? f.start_time, end_time: p.end ?? f.end_time }));
  }

  async function submit(e) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await api.post('/api/shifts', {
        staff_id: parseInt(form.staff_id, 10),
        date: form.date,
        shift_type: form.shift_type,
        start_time: form.start_time,
        end_time: form.end_time,
      });
      onSaved();
    } catch (err) {
      setError(err.response?.data?.error ?? 'Failed to create shift');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={modal.overlay}>
      <div style={modal.box}>
        <div style={modal.header}>
          <h2 style={modal.title}>Add Shift</h2>
          <button style={modal.close} onClick={onClose}>✕</button>
        </div>
        {error && <div style={modal.err}>{error}</div>}
        <form onSubmit={submit} style={modal.form}>
          <label style={modal.label}>Staff Member</label>
          <select style={modal.input} value={form.staff_id} onChange={(e) => setForm({ ...form, staff_id: e.target.value })} required>
            {staff.map((s) => (
              <option key={s.id} value={s.id}>{s.name ?? `${s.first_name} ${s.last_name}`}</option>
            ))}
          </select>

          <label style={modal.label}>Date</label>
          <input style={modal.input} type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} required />

          <label style={modal.label}>Shift Type</label>
          <div style={modal.chips}>
            {Object.keys(SHIFT_PRESETS).map((t) => (
              <button
                key={t} type="button"
                style={{ ...modal.chip, ...(form.shift_type === t ? modal.chipActive : {}) }}
                onClick={() => applyPreset(t)}
              >
                {t}
              </button>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div>
              <label style={modal.label}>Start Time</label>
              <input style={modal.input} type="time" value={form.start_time} onChange={(e) => setForm({ ...form, start_time: e.target.value })} required />
            </div>
            <div>
              <label style={modal.label}>End Time</label>
              <input style={modal.input} type="time" value={form.end_time} onChange={(e) => setForm({ ...form, end_time: e.target.value })} required />
            </div>
          </div>

          <div style={modal.actions}>
            <button type="button" style={modal.cancelBtn} onClick={onClose}>Cancel</button>
            <button type="submit" style={modal.saveBtn} disabled={saving}>
              {saving ? 'Creating...' : 'Create Shift'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Shift Detail Modal ───────────────────────────────────────────────────────
function ShiftDetailModal({ shift, staffName, onClose, onRefresh }) {
  const [notes, setNotes]         = useState(shift.notes ?? '');
  const [actionLoading, setAL]    = useState('');
  const [error, setError]         = useState('');
  const [savingNotes, setSavingNotes] = useState(false);

  async function doAction(type) {
    setAL(type);
    setError('');
    try {
      if (type === 'clock-in')  await api.post(`/api/shifts/${shift.id}/clock-in`);
      if (type === 'clock-out') await api.post(`/api/shifts/${shift.id}/clock-out`);
      if (type === 'cancel')    await api.patch(`/api/shifts/${shift.id}`, { status: 'CANCELLED' });
      onRefresh();
      onClose();
    } catch (err) {
      setError(err.response?.data?.error ?? `Action failed`);
    } finally {
      setAL('');
    }
  }

  async function saveNotes() {
    setSavingNotes(true);
    try {
      await api.patch(`/api/shifts/${shift.id}`, { notes });
    } catch (err) {
      setError(err.response?.data?.error ?? 'Failed to save notes');
    } finally {
      setSavingNotes(false);
    }
  }

  const st = STATUS_STYLE[shift.status] ?? STATUS_STYLE.SCHEDULED;
  const canClockIn  = ['SCHEDULED', 'CONFIRMED'].includes(shift.status);
  const canClockOut = shift.status === 'IN_PROGRESS';
  const canCancel   = !['COMPLETED', 'CANCELLED'].includes(shift.status);

  return (
    <div style={modal.overlay}>
      <div style={modal.box}>
        <div style={modal.header}>
          <h2 style={modal.title}>Shift Detail</h2>
          <button style={modal.close} onClick={onClose}>✕</button>
        </div>
        {error && <div style={modal.err}>{error}</div>}

        <div style={detail.grid}>
          <DetailRow label="Staff"      value={staffName} />
          <DetailRow label="Date"       value={shift.date} />
          <DetailRow label="Type"       value={shift.shift_type ?? shift.type} />
          <DetailRow label="Time"       value={`${shift.start_time} – ${shift.end_time}`} />
          <DetailRow label="Hours"      value={`${calcHours(shift.start_time, shift.end_time)}h`} />
          <DetailRow label="Status"     value={
            <span style={{ ...detail.badge, ...st }}>{shift.status}</span>
          } />
          {shift.clocked_in  && <DetailRow label="Clocked In"  value={shift.clocked_in} />}
          {shift.clocked_out && <DetailRow label="Clocked Out" value={shift.clocked_out} />}
        </div>

        <label style={{ ...modal.label, marginTop: '1rem' }}>Notes</label>
        <textarea
          style={{ ...modal.input, resize: 'vertical', minHeight: '70px' }}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Shift notes..."
        />
        <button style={detail.saveNotesBtn} onClick={saveNotes} disabled={savingNotes}>
          {savingNotes ? 'Saving...' : 'Save Notes'}
        </button>

        <div style={detail.actions}>
          {canClockIn && (
            <button style={detail.clockInBtn} onClick={() => doAction('clock-in')} disabled={!!actionLoading}>
              {actionLoading === 'clock-in' ? <Spinner /> : '⏱ Clock In'}
            </button>
          )}
          {canClockOut && (
            <button style={detail.clockOutBtn} onClick={() => doAction('clock-out')} disabled={!!actionLoading}>
              {actionLoading === 'clock-out' ? <Spinner /> : '⏹ Clock Out'}
            </button>
          )}
          {canCancel && (
            <button style={detail.cancelShiftBtn} onClick={() => doAction('cancel')} disabled={!!actionLoading}>
              {actionLoading === 'cancel' ? <Spinner /> : '✕ Cancel Shift'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function DetailRow({ label, value }) {
  return (
    <>
      <div style={detail.rowLabel}>{label}</div>
      <div style={detail.rowValue}>{value}</div>
    </>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function Rota() {
  const [weekOffset, setWeekOffset] = useState(0);
  const weekDates = getWeekDates(weekOffset);

  const [rota, setRota]         = useState(null);
  const [shifts, setShifts]     = useState([]);
  const [staffList, setStaff]   = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');
  const [publishing, setPublishing] = useState(false);

  // Modals
  const [addModal, setAddModal]       = useState(null); // { staffId, date } | null
  const [detailModal, setDetailModal] = useState(null); // shift | null

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [rotaRes, staffRes] = await Promise.all([
        api.get('/api/rotas/current', { params: { week_start: isoDate(weekDates[0]) } }).catch(() => ({ data: {} })),
        api.get('/api/staff').catch(() => ({ data: { staff: [] } })),
      ]);
      setRota(rotaRes.data.rota ?? null);
      setShifts(rotaRes.data.shifts ?? rotaRes.data.rota?.shifts ?? []);
      setStaff(staffRes.data.staff ?? staffRes.data.data ?? []);
    } catch (err) {
      setError(err.response?.data?.error ?? 'Failed to load rota');
    } finally {
      setLoading(false);
    }
  }, [weekOffset]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load(); }, [load]);

  async function publishRota() {
    if (!rota?.id) return;
    setPublishing(true);
    try {
      await api.post(`/api/rotas/${rota.id}/publish`);
      await load();
    } catch (err) {
      alert(err.response?.data?.error ?? 'Publish failed');
    } finally {
      setPublishing(false);
    }
  }

  // Build lookup: shiftsMap[staffId][dateStr] = shift
  const shiftsMap = {};
  for (const s of shifts) {
    const sid = s.staff_id;
    if (!shiftsMap[sid]) shiftsMap[sid] = {};
    shiftsMap[sid][s.date] = s;
  }

  // Summary stats
  const today = isoDate(new Date());
  const totalShifts  = shifts.length;
  const totalHours   = shifts.reduce((sum, s) => sum + calcHours(s.start_time, s.end_time), 0);
  const onDutyToday  = shifts.filter((s) => s.date === today && s.status === 'IN_PROGRESS').length;

  // Staff name lookup
  function staffName(shift) {
    const s = staffList.find((m) => m.id === shift.staff_id);
    if (!s) return `Staff #${shift.staff_id}`;
    return s.name ?? `${s.first_name ?? ''} ${s.last_name ?? ''}`.trim();
  }

  const canPublish = rota && !rota.is_published && !rota.published_at;

  return (
    <div style={styles.page}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      {/* Header */}
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>Rota & Shifts</h1>
          <p style={styles.sub}>Weekly shift schedule and staff management</p>
        </div>
        <div style={styles.headerActions}>
          <button style={styles.weekBtn} onClick={() => setWeekOffset((w) => w - 1)}>← Prev</button>
          <span style={styles.weekLabel}>{fmtWeekRange(weekDates)}</span>
          <button style={styles.weekBtn} onClick={() => setWeekOffset((w) => w + 1)}>Next →</button>
          {canPublish && (
            <button style={styles.publishBtn} onClick={publishRota} disabled={publishing}>
              {publishing ? 'Publishing...' : '📢 Publish Rota'}
            </button>
          )}
          {rota?.is_published && (
            <span style={styles.publishedBadge}>✓ Published</span>
          )}
        </div>
      </div>

      {/* Grid */}
      <div style={styles.tableWrap}>
        {loading && (
          <div style={styles.loadingMsg}><Spinner /> &nbsp;Loading rota...</div>
        )}
        {!loading && error && (
          <div style={styles.errorMsg}>{error}</div>
        )}
        {!loading && !error && (
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={{ ...styles.th, ...styles.staffTh }}>Staff</th>
                {weekDates.map((d, i) => {
                  const isToday = isoDate(d) === today;
                  return (
                    <th key={i} style={{ ...styles.th, ...(isToday ? styles.todayTh : {}) }}>
                      <div style={styles.dayName}>{DAYS[i]}</div>
                      <div style={styles.dayDate}>{fmtDate(d)}</div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {staffList.length === 0 && (
                <tr>
                  <td colSpan={8} style={styles.emptyRow}>No staff found. Shifts will appear once staff are loaded.</td>
                </tr>
              )}
              {staffList.map((member) => {
                const memberName = member.name ?? `${member.first_name ?? ''} ${member.last_name ?? ''}`.trim();
                return (
                  <tr key={member.id} style={styles.tr}>
                    <td style={styles.staffCell}>
                      <div style={styles.staffName}>{memberName}</div>
                      <div style={styles.staffRole}>{member.role ?? member.position ?? ''}</div>
                    </td>
                    {weekDates.map((d, i) => {
                      const dateStr = isoDate(d);
                      const shift   = shiftsMap[member.id]?.[dateStr] ?? null;
                      const isToday = dateStr === today;
                      return (
                        <ShiftCell
                          key={i}
                          shift={shift}
                          onAdd={() => setAddModal({ staffId: member.id, date: dateStr })}
                          onView={(s) => setDetailModal({ shift: s, staffName: memberName })}
                        />
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Summary bar */}
      <div style={styles.summaryBar}>
        <div style={styles.summaryCard}>
          <span style={styles.summaryNum}>{totalShifts}</span>
          <span style={styles.summaryLabel}>Total Shifts This Week</span>
        </div>
        <div style={styles.summaryDivider} />
        <div style={styles.summaryCard}>
          <span style={styles.summaryNum}>{totalHours.toFixed(1)}h</span>
          <span style={styles.summaryLabel}>Hours Scheduled</span>
        </div>
        <div style={styles.summaryDivider} />
        <div style={styles.summaryCard}>
          <span style={{ ...styles.summaryNum, color: '#065f46' }}>{onDutyToday}</span>
          <span style={styles.summaryLabel}>Staff On Duty Today</span>
        </div>
      </div>

      {/* Modals */}
      {addModal && (
        <AddShiftModal
          staff={staffList}
          prefillDate={addModal.date}
          prefillStaffId={addModal.staffId}
          onClose={() => setAddModal(null)}
          onSaved={() => { setAddModal(null); load(); }}
        />
      )}
      {detailModal && (
        <ShiftDetailModal
          shift={detailModal.shift}
          staffName={detailModal.staffName}
          onClose={() => setDetailModal(null)}
          onRefresh={load}
        />
      )}
    </div>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = {
  page: { display: 'flex', flexDirection: 'column', gap: '1.25rem' },
  header: {
    display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
    flexWrap: 'wrap', gap: '1rem',
  },
  title: { margin: 0, fontSize: '1.5rem', fontWeight: 700, color: '#1a1a2e' },
  sub:   { margin: '4px 0 0', fontSize: '0.85rem', color: '#6b7280' },
  headerActions: { display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' },
  weekBtn: {
    padding: '0.45rem 0.9rem', background: '#fff', border: '1px solid #d1d5db',
    borderRadius: '6px', fontSize: '0.85rem', cursor: 'pointer', color: '#374151', fontWeight: 500,
  },
  weekLabel: { fontSize: '0.9rem', fontWeight: 600, color: '#1a1a2e', padding: '0 0.25rem', whiteSpace: 'nowrap' },
  publishBtn: {
    padding: '0.45rem 1rem', background: '#1a1a2e', color: '#fff',
    border: 'none', borderRadius: '6px', fontSize: '0.85rem', cursor: 'pointer', fontWeight: 600,
  },
  publishedBadge: {
    padding: '0.4rem 0.9rem', background: '#d1fae5', color: '#065f46',
    borderRadius: '6px', fontSize: '0.82rem', fontWeight: 700,
  },
  tableWrap: {
    background: '#fff', border: '1px solid #e5e7eb', borderRadius: '12px',
    overflow: 'auto', boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
  },
  loadingMsg: {
    padding: '3rem', textAlign: 'center', color: '#9ca3af', fontSize: '0.9rem',
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
  },
  errorMsg: { padding: '2rem', textAlign: 'center', color: '#dc2626', fontSize: '0.9rem' },
  table: { width: '100%', borderCollapse: 'collapse', minWidth: '800px' },
  th: {
    padding: '0.6rem 0.5rem', background: '#f9fafb', textAlign: 'center',
    fontSize: '0.78rem', color: '#6b7280', fontWeight: 600,
    borderBottom: '2px solid #e5e7eb', borderRight: '1px solid #f3f4f6',
    whiteSpace: 'nowrap',
  },
  staffTh: { textAlign: 'left', paddingLeft: '1rem', width: '150px' },
  todayTh: { background: '#eff6ff', color: '#1e40af' },
  dayName: { fontWeight: 700, fontSize: '0.82rem' },
  dayDate: { fontSize: '0.72rem', color: '#9ca3af', marginTop: '2px' },
  tr: { borderBottom: '1px solid #f3f4f6' },
  staffCell: {
    padding: '0.5rem 0.5rem 0.5rem 1rem', verticalAlign: 'middle',
    borderRight: '1px solid #e5e7eb', minWidth: '130px',
  },
  staffName: { fontWeight: 600, fontSize: '0.85rem', color: '#1a1a2e' },
  staffRole: { fontSize: '0.72rem', color: '#9ca3af', marginTop: '2px' },
  emptyRow: { padding: '2rem', textAlign: 'center', color: '#9ca3af', fontSize: '0.88rem' },
  // Summary bar
  summaryBar: {
    background: '#fff', border: '1px solid #e5e7eb', borderRadius: '12px',
    padding: '1rem 1.5rem', display: 'flex', alignItems: 'center', gap: '0',
    boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
  },
  summaryCard: { flex: 1, textAlign: 'center', padding: '0 1rem' },
  summaryNum: { display: 'block', fontSize: '1.8rem', fontWeight: 800, color: '#1a1a2e', lineHeight: 1 },
  summaryLabel: { display: 'block', fontSize: '0.75rem', color: '#6b7280', marginTop: '4px', textTransform: 'uppercase', letterSpacing: '0.5px' },
  summaryDivider: { width: '1px', height: '40px', background: '#e5e7eb', flexShrink: 0 },
};

const cellStyles = {
  empty: {
    padding: '0.5rem', textAlign: 'center', verticalAlign: 'middle',
    cursor: 'pointer', borderRight: '1px solid #f3f4f6', minWidth: '100px',
    height: '56px',
  },
  addPlus: {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    width: '22px', height: '22px', borderRadius: '50%', background: '#f3f4f6',
    color: '#9ca3af', fontSize: '1rem', fontWeight: 700,
    transition: 'background 0.15s',
  },
  filled: {
    padding: '0.35rem 0.4rem', verticalAlign: 'middle', cursor: 'pointer',
    borderRight: '1px solid #f3f4f6', minWidth: '100px',
  },
  shiftPill: {
    padding: '4px 8px', borderRadius: '6px', textAlign: 'center',
    display: 'flex', flexDirection: 'column', gap: '1px',
  },
  shiftType: { fontSize: '0.75rem', fontWeight: 700 },
  shiftTime: { fontSize: '0.68rem', opacity: 0.85 },
};

const modal = {
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
  },
  box: {
    background: '#fff', borderRadius: '14px', width: '100%', maxWidth: '480px',
    boxShadow: '0 24px 60px rgba(0,0,0,0.2)', padding: '1.5rem',
    maxHeight: '90vh', overflowY: 'auto',
  },
  header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' },
  title: { margin: 0, fontSize: '1.1rem', fontWeight: 700, color: '#1a1a2e' },
  close: { background: 'transparent', border: 'none', fontSize: '1.1rem', cursor: 'pointer', color: '#9ca3af', padding: 0 },
  err: { background: '#fee2e2', color: '#991b1b', padding: '0.6rem 0.75rem', borderRadius: '6px', fontSize: '0.85rem', marginBottom: '1rem' },
  form: { display: 'flex', flexDirection: 'column', gap: '0.75rem' },
  label: { fontSize: '0.8rem', fontWeight: 600, color: '#374151', display: 'block', marginBottom: '3px' },
  input: {
    padding: '0.55rem 0.75rem', border: '1px solid #d1d5db', borderRadius: '7px',
    fontSize: '0.9rem', background: '#f9fafb', width: '100%', boxSizing: 'border-box', outline: 'none',
  },
  chips: { display: 'flex', gap: '0.4rem', flexWrap: 'wrap' },
  chip: {
    padding: '4px 12px', borderRadius: '20px', border: '1px solid #d1d5db',
    background: '#f9fafb', color: '#374151', fontSize: '0.82rem', cursor: 'pointer',
  },
  chipActive: { background: '#1a1a2e', color: '#fff', border: '1px solid #1a1a2e' },
  actions: { display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' },
  cancelBtn: {
    padding: '0.55rem 1.25rem', background: 'transparent', border: '1px solid #d1d5db',
    borderRadius: '7px', fontSize: '0.9rem', cursor: 'pointer', color: '#374151',
  },
  saveBtn: {
    padding: '0.55rem 1.5rem', background: '#1a1a2e', color: '#fff',
    border: 'none', borderRadius: '7px', fontSize: '0.9rem', fontWeight: 700, cursor: 'pointer',
  },
};

const detail = {
  grid: {
    display: 'grid', gridTemplateColumns: '120px 1fr',
    gap: '0.5rem 1rem', marginBottom: '1rem',
    padding: '0.75rem', background: '#f9fafb', borderRadius: '8px', border: '1px solid #e5e7eb',
  },
  rowLabel: { fontSize: '0.78rem', color: '#9ca3af', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.3px', display: 'flex', alignItems: 'center' },
  rowValue: { fontSize: '0.88rem', color: '#1a1a2e', fontWeight: 500, display: 'flex', alignItems: 'center' },
  badge: { padding: '2px 10px', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 700 },
  saveNotesBtn: {
    padding: '4px 14px', background: '#f3f4f6', border: '1px solid #d1d5db',
    borderRadius: '6px', fontSize: '0.8rem', cursor: 'pointer', color: '#374151',
    marginTop: '0.4rem', display: 'block',
  },
  actions: { display: 'flex', gap: '0.6rem', marginTop: '1.25rem', flexWrap: 'wrap' },
  clockInBtn: {
    flex: 1, padding: '0.55rem 1rem', background: '#d1fae5', color: '#065f46',
    border: '1px solid #6ee7b7', borderRadius: '7px', fontSize: '0.88rem',
    fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem',
  },
  clockOutBtn: {
    flex: 1, padding: '0.55rem 1rem', background: '#dbeafe', color: '#1e40af',
    border: '1px solid #93c5fd', borderRadius: '7px', fontSize: '0.88rem',
    fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem',
  },
  cancelShiftBtn: {
    padding: '0.55rem 1rem', background: 'transparent', color: '#dc2626',
    border: '1px solid #fca5a5', borderRadius: '7px', fontSize: '0.88rem',
    cursor: 'pointer', fontWeight: 600,
  },
};
