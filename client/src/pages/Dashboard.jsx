import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast, getErrorMessage } from '../context/ToastContext';
import api from '../services/api';
import MonthSection from '../components/MonthSection';
import TemplateManager from '../components/TemplateManager';
import SalaryManager from '../components/SalaryManager';
import GPayImport from '../components/GPayImport';

/* ── helpers ─────────────────────────────────────────────────── */
const fmt     = (n) => Number(n ?? 0).toLocaleString('en-IN');
const today   = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; };
const prevMo  = (m) => { const [y, mo] = m.split('-').map(Number); return mo === 1 ? `${y-1}-12` : `${y}-${String(mo-1).padStart(2,'0')}`; };
const nextMo  = (m) => { const [y, mo] = m.split('-').map(Number); return mo === 12 ? `${y+1}-01` : `${y}-${String(mo+1).padStart(2,'0')}`; };
const fmtMonth = (m) => {
  const [y, mo] = m.split('-');
  return new Date(+y, +mo - 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
};

const SECTIONS = ['credits', 'savings', 'investments', 'subscriptions', 'expenses'];

export default function Dashboard() {
  const { user, logout } = useAuth();
  const { showToast }    = useToast();

  const [month,           setMonth]           = useState(today);
  const [record,          setRecord]          = useState(null);
  const [totals,          setTotals]          = useState({});
  const [loading,         setLoading]         = useState(true);
  const [addLoading,      setAddLoading]      = useState({});
  const [applyLoading,    setApplyLoading]    = useState({});
  const [showTemplates,   setShowTemplates]   = useState(false);
  const [showSalary,      setShowSalary]      = useState(false);

  /* ── Load month ─────────────────────────────────────────────── */
  const loadMonth = useCallback(async (m) => {
    setLoading(true);
    try {
      const { data } = await api.get(`/months/${m}`);
      setRecord(data.record);
      setTotals(data.totals);
    } catch (err) {
      showToast(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => { loadMonth(month); }, [month]);

  /* ── Entry CRUD ──────────────────────────────────────────────── */
  const updateState = (data) => {
    setRecord(data.record);
    setTotals(data.totals);
  };

  const handleAdd = async (section, entry) => {
    setAddLoading(prev => ({ ...prev, [section]: true }));
    try {
      const { data } = await api.post(`/months/${month}/${section}`, entry);
      updateState(data);
    } catch (err) {
      showToast(getErrorMessage(err));
    } finally {
      setAddLoading(prev => ({ ...prev, [section]: false }));
    }
  };

  const handleUpdate = async (section, entryId, payload) => {
    try {
      const { data } = await api.put(`/months/${month}/${section}/${entryId}`, payload);
      updateState(data);
    } catch (err) {
      showToast(getErrorMessage(err));
    }
  };

  const handleDelete = async (section, entryId) => {
    try {
      const { data } = await api.delete(`/months/${month}/${section}/${entryId}`);
      updateState(data);
    } catch (err) {
      showToast(getErrorMessage(err));
    }
  };

  const handleApplyTemplates = async (section) => {
    setApplyLoading(prev => ({ ...prev, [section]: true }));
    try {
      const { data } = await api.post(`/months/${month}/${section}/apply-templates`);
      updateState(data);
      if (data.added === 0) showToast('All templates already applied', 'info');
      else showToast(`${data.added} template(s) applied`, 'success');
    } catch (err) {
      showToast(getErrorMessage(err));
    } finally {
      setApplyLoading(prev => ({ ...prev, [section]: false }));
    }
  };

  /* ── Summary bar ─────────────────────────────────────────────── */
  const balance      = totals.balance ?? 0;
  const balanceColor = balance >= 0 ? '#1D9E75' : '#D85A30';

  return (
    <div className="min-h-screen" style={{ background: '#080d1c' }}>
      <div className="max-w-2xl mx-auto px-4 py-6 sm:px-6 sm:py-8">

        {/* ── Top bar ─────────────────────────────────────────── */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-semibold" style={{ color: '#f0f4ff' }}>Expense Tracker</h1>
            <p className="text-xs mt-0.5" style={{ color: '#4a6090' }}>{user?.name}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowSalary(true)}
              className="px-3 py-1.5 rounded-xl text-xs font-medium"
              style={{ background: 'rgba(29,158,117,0.08)', border: '1px solid rgba(29,158,117,0.2)', color: '#1D9E75' }}
              title="Manage salary"
            >
              💰 Salary
            </button>
            <button
              onClick={() => setShowTemplates(true)}
              className="px-3 py-1.5 rounded-xl text-xs font-medium"
              style={{ background: 'rgba(99,130,220,0.08)', border: '1px solid rgba(99,130,220,0.15)', color: '#c8d6f0' }}
            >
              ⚙ Templates
            </button>
            <button
              onClick={logout}
              className="px-3 py-1.5 rounded-xl text-xs font-medium"
              style={{ background: 'rgba(99,130,220,0.08)', border: '1px solid rgba(99,130,220,0.15)', color: '#4a6090' }}
            >
              Sign out
            </button>
          </div>
        </div>

        {/* ── Month switcher ───────────────────────────────────── */}
        <div className="flex items-center justify-center gap-4 mb-6">
          <button
            onClick={() => setMonth(prevMo)}
            className="w-8 h-8 rounded-full flex items-center justify-center transition-all"
            style={{ background: 'rgba(99,130,220,0.08)', color: '#4a6090' }}
          >
            ‹
          </button>
          <h2 className="text-base font-semibold w-44 text-center" style={{ color: '#f0f4ff' }}>
            {fmtMonth(month)}
          </h2>
          <button
            onClick={() => setMonth(nextMo)}
            className="w-8 h-8 rounded-full flex items-center justify-center transition-all"
            style={{ background: 'rgba(99,130,220,0.08)', color: '#4a6090' }}
          >
            ›
          </button>
        </div>

        {/* ── Loading ──────────────────────────────────────────── */}
        {loading ? (
          <div className="flex justify-center py-16">
            <span className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : record ? (
          <>
            {/* ── Sections ─────────────────────────────────────── */}
            <div className="space-y-3">
              {SECTIONS.map(section => (
                <MonthSection
                  key={section}
                  section={section}
                  entries={record[section] || []}
                  total={totals[`total${section.charAt(0).toUpperCase() + section.slice(1)}`] ?? 0}
                  onAdd={(entry) => handleAdd(section, entry)}
                  onUpdate={(id, payload) => handleUpdate(section, id, payload)}
                  onDelete={(id) => handleDelete(section, id)}
                  onApplyTemplates={() => handleApplyTemplates(section)}
                  addLoading={addLoading[section]}
                  applyLoading={applyLoading[section]}
                  extraActions={
                    section === 'expenses' ? (
                      <GPayImport
                        month={month}
                        onImported={() => loadMonth(month)}
                      />
                    ) : null
                  }
                />
              ))}
            </div>

            {/* ── Summary ──────────────────────────────────────── */}
            <div
              className="mt-4 rounded-2xl px-5 py-4"
              style={{ background: '#111827', border: '1px solid rgba(99,130,220,0.12)' }}
            >
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span style={{ color: '#4a6090' }}>Total credits</span>
                  <span style={{ color: '#1D9E75' }}>₹ {fmt(totals.totalCredits)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span style={{ color: '#4a6090' }}>Total outgoing</span>
                  <span style={{ color: '#D85A30' }}>₹ {fmt(totals.totalOutgoing)}</span>
                </div>
                <div className="h-px my-1" style={{ background: 'rgba(99,130,220,0.1)' }} />
                <div className="flex justify-between text-sm font-semibold">
                  <span style={{ color: '#c8d6f0' }}>Balance</span>
                  <span style={{ color: balanceColor }}>₹ {fmt(balance)}</span>
                </div>
              </div>

              {/* Breakdown */}
              <div className="mt-3 pt-3 border-t grid grid-cols-2 gap-x-6 gap-y-1" style={{ borderColor: 'rgba(99,130,220,0.08)' }}>
                {[
                  ['Savings',       totals.totalSavings,       '#378ADD'],
                  ['Investments',   totals.totalInvestments,   '#378ADD'],
                  ['Subscriptions', totals.totalSubscriptions, '#BA7517'],
                  ['Expenses',      totals.totalExpenses,      '#D85A30'],
                ].map(([label, val, color]) => (
                  <div key={label} className="flex justify-between text-xs">
                    <span style={{ color: '#4a6090' }}>{label}</span>
                    <span style={{ color }}>₹ {fmt(val)}</span>
                  </div>
                ))}
              </div>
            </div>
          </>
        ) : null}
      </div>

      {/* ── Modals ───────────────────────────────────────────────── */}
      {showTemplates && <TemplateManager onClose={() => setShowTemplates(false)} />}
      {showSalary && (
        <SalaryManager
          currentMonth={month}
          onClose={() => setShowSalary(false)}
          onSalaryAdded={() => loadMonth(month)}
        />
      )}
    </div>
  );
}
