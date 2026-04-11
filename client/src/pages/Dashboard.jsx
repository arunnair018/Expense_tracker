import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth }   from '../context/AuthContext';
import { useToast, getErrorMessage } from '../context/ToastContext';
import api from '../services/api';
import MonthSection    from '../components/MonthSection';
import TemplateManager from '../components/TemplateManager';
import SalaryManager   from '../components/SalaryManager';
import ImportStatement from '../components/ImportStatement';
import Sidebar         from '../components/Sidebar';
import Analytics       from '../components/Analytics';

/* ── helpers ─────────────────────────────────────────────────── */
const fmt      = (n) => Number(n ?? 0).toLocaleString('en-IN');
const today    = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`; };
const prevMo   = (m) => { const [y,mo]=m.split('-').map(Number); return mo===1?`${y-1}-12`:`${y}-${String(mo-1).padStart(2,'0')}`; };
const nextMo   = (m) => { const [y,mo]=m.split('-').map(Number); return mo===12?`${y+1}-01`:`${y}-${String(mo+1).padStart(2,'0')}`; };
const fmtMonth = (m) => {
  const [y,mo] = m.split('-');
  return new Date(+y,+mo-1).toLocaleDateString('en-IN',{month:'long',year:'numeric'});
};

const getInitials = (name) => {
  if (!name) return '?';
  return name.trim().split(/\s+/).map(w => w[0]).join('').toUpperCase().slice(0, 2);
};

const TEMPLATE_SECTIONS = ['savings','investments','subscriptions'];
const ALL_SECTIONS      = ['credits','savings','investments','subscriptions','plannedExpenses','expenses'];

export default function Dashboard() {
  const { user, logout }  = useAuth();
  const { showToast }     = useToast();

  const [month,         setMonth]         = useState(today);
  const [record,        setRecord]        = useState(null);
  const [totals,        setTotals]        = useState({});
  const [loading,       setLoading]       = useState(true);
  const [addLoading,    setAddLoading]    = useState({});
  const [applyLoading,  setApplyLoading]  = useState({});
  const [showTemplates, setShowTemplates] = useState(false);
  const [showSalary,    setShowSalary]    = useState(false);
  const [showImport,    setShowImport]    = useState(false);
  const [showSidebar,   setShowSidebar]   = useState(false);
  const [activeView,    setActiveView]    = useState('dashboard'); // 'dashboard' | 'analytics'

  /* ── Load month ───────────────────────────────────────────── */
  const loadMonth = useCallback(async (m) => {
    setLoading(true);
    try {
      const { data } = await api.get(`/months/${m}`);
      if (data?.record) setRecord(data.record);
      if (data?.totals) setTotals(data.totals);
    } catch (err) {
      showToast(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => { loadMonth(month); }, [month]);

  /* ── State updater ────────────────────────────────────────── */
  const updateState = (data) => {
    if (data?.record) setRecord(data.record);
    if (data?.totals) setTotals(data.totals);
  };

  /* ── Salary ───────────────────────────────────────────────── */
  const handleSalaryAdded = useCallback(async (m, amount, currentRecord) => {
    if (!amount) { loadMonth(m); return; }
    try {
      const existing = currentRecord?.credits?.find(c => c.name === 'Salary');
      if (existing) {
        const { data } = await api.put(`/months/${m}/credits/${existing._id}`, { amount });
        updateState(data);
      } else {
        const { data } = await api.post(`/months/${m}/credits`, { name: 'Salary', amount });
        updateState(data);
      }
    } catch (err) {
      console.error('salary credit:', err);
      loadMonth(m);
    }
  }, [loadMonth]);

  /* ── Entry CRUD ───────────────────────────────────────────── */
  const handleAdd = async (section, entry) => {
    setAddLoading(prev => ({ ...prev, [section]: true }));
    const payload = section === 'plannedExpenses' ? { ...entry, completed: false } : entry;
    try {
      const { data } = await api.post(`/months/${month}/${section}`, payload);
      updateState(data);
    } catch (err) { showToast(getErrorMessage(err)); }
    finally { setAddLoading(prev => ({ ...prev, [section]: false })); }
  };

  const handleUpdate = async (section, entryId, payload) => {
    try {
      const { data } = await api.put(`/months/${month}/${section}/${entryId}`, payload);
      updateState(data);
    } catch (err) { showToast(getErrorMessage(err)); }
  };

  const handleDelete = async (section, entryId) => {
    try {
      const { data } = await api.delete(`/months/${month}/${section}/${entryId}`);
      updateState(data);
    } catch (err) { showToast(getErrorMessage(err)); }
  };

  /* ── Apply templates ──────────────────────────────────────── */
  const handleApplyTemplates = async (section) => {
    setApplyLoading(prev => ({ ...prev, [section]: true }));
    try {
      const { data } = await api.post(`/months/${month}/${section}/apply-templates`);
      updateState(data);
      if ((data.added ?? 0) === 0) showToast('All templates already applied', 'info');
      else showToast(`${data.added} template(s) applied`, 'success');
    } catch (err) {
      console.error('apply-templates:', err);
      showToast(getErrorMessage(err));
    } finally { setApplyLoading(prev => ({ ...prev, [section]: false })); }
  };

  /* ── Computed ─────────────────────────────────────────────── */
  const balance      = totals.balance ?? 0;
  const balanceColor = balance >= 0 ? 'var(--clr-positive)' : 'var(--clr-negative)';

  /* ── Swipe to change month ────────────────────────────────── */
  const touchStartX = useRef(null);
  const touchStartY = useRef(null);

  const onTouchStart = (e) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  };

  const onTouchEnd = (e) => {
    if (touchStartX.current === null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    const dy = e.changedTouches[0].clientY - touchStartY.current;
    touchStartX.current = null;
    touchStartY.current = null;
    // Only trigger if horizontal movement dominates (not a vertical scroll)
    if (Math.abs(dx) < 48 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
    if (dx < 0) setMonth(nextMo);   // swipe left  → next month
    else         setMonth(prevMo);  // swipe right → prev month
  };

  /* ── Shared max-width wrapper style ──────────────────────── */
  const inner = { maxWidth: '40rem', margin: '0 auto', width: '100%' };

  return (
    <div
      style={{
        height: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        background: 'var(--bg-main)',
      }}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >

      {/* ── Fixed app header ──────────────────────────────────── */}
      <div
        style={{
          flexShrink: 0,
          background: 'var(--bg-main)',
          borderBottom: '1px solid var(--divider)',
          paddingTop: 'max(0.75rem, env(safe-area-inset-top))',
          paddingLeft:  'max(1rem, env(safe-area-inset-left))',
          paddingRight: 'max(1rem, env(safe-area-inset-right))',
          paddingBottom: '0.75rem',
        }}
      >
        <div style={inner}>
          {/* Top row: avatar + toggle */}
          <div className="flex items-center justify-between mb-3">
            <button
              onClick={() => setShowSidebar(true)}
              className="rounded-full flex items-center justify-center text-xs font-bold shrink-0 self-center active:opacity-70"
              style={{ width: '2.25rem', height: '2.25rem', background: 'rgba(37,99,235,0.18)', border: '1px solid rgba(37,99,235,0.35)', color: '#4f8ef7' }}
              title={user?.name}
            >
              {getInitials(user?.name)}
            </button>

            <div
              className="flex items-center gap-0.5 rounded-xl p-1 self-center"
              style={{ background: 'var(--bg-card)', border: '1px solid var(--border-card)', height: '2.25rem' }}
            >
              {['dashboard', 'analytics'].map(view => (
                <button
                  key={view}
                  onClick={() => setActiveView(view)}
                  className="h-full px-3 rounded-lg text-xs font-semibold transition-all"
                  style={
                    activeView === view
                      ? { background: 'var(--bg-hover)', color: 'var(--text-primary)', boxShadow: '0 1px 3px rgba(0,0,0,0.15)' }
                      : { color: 'var(--text-muted)' }
                  }
                >
                  {view === 'dashboard' ? 'Dashboard' : 'Analytics'}
                </button>
              ))}
            </div>
          </div>

          {/* Month switcher */}
          <div className="flex items-center justify-between">
            <button
              onClick={() => setMonth(prevMo)}
              className="w-9 h-9 rounded-full flex items-center justify-center"
              style={{ background: 'var(--bg-hover)', border: '1px solid var(--border-card)', color: 'var(--text-secondary)' }}
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>

            <div className="text-center">
              <h2 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
                {fmtMonth(month)}
              </h2>
              {!loading && (
                <p className="text-xs font-medium tabular-nums mt-0.5" style={{ color: balanceColor }}>
                  ₹ {fmt(balance)} remaining
                </p>
              )}
            </div>

            <button
              onClick={() => setMonth(nextMo)}
              className="w-9 h-9 rounded-full flex items-center justify-center"
              style={{ background: 'var(--bg-hover)', border: '1px solid var(--border-card)', color: 'var(--text-secondary)' }}
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* ── Scrollable content area ───────────────────────────── */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          WebkitOverflowScrolling: 'touch',
          paddingLeft:  'max(1rem, env(safe-area-inset-left))',
          paddingRight: 'max(1rem, env(safe-area-inset-right))',
          paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))',
          paddingTop: '1rem',
        }}
      >
        <div style={inner}>

          {loading ? (
            <div className="flex justify-center py-16">
              <span className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : activeView === 'analytics' ? (
            <Analytics totals={totals} />
          ) : record ? (
            <>
              {/* Summary card */}
              <div
                className="mb-4 rounded-2xl px-5 py-4"
                style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)' }}
              >
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                    Remaining this month
                  </span>
                  <span className="text-lg font-bold tabular-nums" style={{ color: balanceColor }}>
                    ₹ {fmt(balance)}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-x-6 gap-y-1.5">
                  {[
                    ['Income',        totals.totalCredits,         'var(--clr-credit)'],
                    ['Savings',       totals.totalSavings,         'var(--clr-savings)'],
                    ['Investments',   totals.totalInvestments,     'var(--clr-savings)'],
                    ['Subscriptions', totals.totalSubscriptions,   'var(--clr-subscription)'],
                    ['Planned',       totals.totalPlannedExpenses, 'var(--clr-planned)'],
                    ['Expenses',      totals.totalExpenses,        'var(--clr-expense)'],
                  ].map(([label, val, color]) => (
                    <div key={label} className="flex justify-between text-xs">
                      <span style={{ color: 'var(--text-muted)' }}>{label}</span>
                      <span style={{ color }} className="tabular-nums font-medium">₹ {fmt(val)}</span>
                    </div>
                  ))}
                </div>
                <p className="text-xs mt-2" style={{ color: 'var(--text-faint)' }}>Pending items are not counted in the balance</p>
              </div>

              {/* Sections */}
              <div className="space-y-3">
                {ALL_SECTIONS.map(section => (
                  <MonthSection
                    key={section}
                    section={section}
                    entries={record[section] || []}
                    onAdd={(entry) => handleAdd(section, entry)}
                    onUpdate={(id, payload) => handleUpdate(section, id, payload)}
                    onDelete={(id) => handleDelete(section, id)}
                    onApplyTemplates={() => handleApplyTemplates(section)}
                    addLoading={addLoading[section]}
                    applyLoading={applyLoading[section]}
                  />
                ))}
              </div>
            </>
          ) : null}

        </div>
      </div>

      {/* ── Sidebar ───────────────────────────────────────────── */}
      {showSidebar && (
        <Sidebar
          user={user}
          onSalary={() => setShowSalary(true)}
          onTemplates={() => setShowTemplates(true)}
          onImport={() => setShowImport(true)}
          onClose={() => setShowSidebar(false)}
        />
      )}

      {/* ── Modals ────────────────────────────────────────────── */}
      {showTemplates && <TemplateManager onClose={() => setShowTemplates(false)} />}
      {showSalary && (
        <SalaryManager
          currentMonth={month}
          onClose={() => setShowSalary(false)}
          onSalaryAdded={(amount) => handleSalaryAdded(month, amount, record)}
        />
      )}
      {showImport && (
        <ImportStatement
          month={month}
          onImported={() => loadMonth(month)}
          onClose={() => setShowImport(false)}
        />
      )}
    </div>
  );
}
