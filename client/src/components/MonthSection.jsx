import { useState } from 'react';
import EntryRow from './EntryRow';
import AddEntryForm from './AddEntryForm';

const fmt = (n) => Number(n).toLocaleString('en-IN');

const SECTION_COLORS = {
  credits:         { accent: 'var(--clr-credit)',       bg: 'rgba(29,158,117,0.08)',  border: 'rgba(29,158,117,0.2)'  },
  savings:         { accent: 'var(--clr-savings)',      bg: 'rgba(55,138,221,0.08)',  border: 'rgba(55,138,221,0.2)'  },
  investments:     { accent: 'var(--clr-savings)',      bg: 'rgba(55,138,221,0.08)',  border: 'rgba(55,138,221,0.2)'  },
  subscriptions:   { accent: 'var(--clr-subscription)', bg: 'rgba(186,117,23,0.08)', border: 'rgba(186,117,23,0.2)'  },
  plannedExpenses: { accent: 'var(--clr-planned)',      bg: 'rgba(155,110,204,0.08)', border: 'rgba(155,110,204,0.2)' },
  expenses:        { accent: 'var(--clr-expense)',      bg: 'rgba(216,90,48,0.08)',  border: 'rgba(216,90,48,0.2)'   },
};

const SECTION_LABELS = {
  credits:         'Credits',
  savings:         'Savings',
  investments:     'Investments',
  subscriptions:   'Subscriptions',
  plannedExpenses: 'Planned Expenses',
  expenses:        'Expenses',
};

export default function MonthSection({
  section, entries = [], total = 0,
  onAdd, onUpdate, onDelete, onApplyTemplates,
  addLoading, applyLoading,
  extraActions,
}) {
  const [expanded, setExpanded] = useState(false);
  const [showForm, setShowForm] = useState(false);

  const colors          = SECTION_COLORS[section] || SECTION_COLORS.expenses;
  const label           = SECTION_LABELS[section] || section;
  const isExpenses      = section === 'expenses';
  const isPlanned       = section === 'plannedExpenses';
  const hasTemplates    = ['savings', 'investments', 'subscriptions'].includes(section);
  const hasCompletion   = hasTemplates || isPlanned;

  const completedEntries = entries.filter(e => e.completed !== false);
  const pendingEntries   = entries.filter(e => e.completed === false);
  const completedSum     = completedEntries.reduce((s, e) => s + (e.amount || 0), 0);
  const fullSum          = entries.reduce((s, e) => s + (e.amount || 0), 0);
  const hasPending       = pendingEntries.length > 0;
  const done             = completedEntries.length;

  const handleAdd = async (entry) => {
    await onAdd(entry);
    setShowForm(false);
  };

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{ background: 'var(--bg-card)', border: `1px solid ${colors.border}` }}
    >
      {/* Header row */}
      <div className="flex items-center" style={{ background: colors.bg }}>
        {/* Clickable expand area */}
        <button
          onClick={() => setExpanded(v => !v)}
          className="flex-1 flex items-center gap-2.5 px-4 py-3.5 min-w-0"
        >
          <span className="text-sm font-semibold shrink-0" style={{ color: colors.accent }}>{label}</span>
          <span className="text-xs px-1.5 py-0.5 rounded-full shrink-0" style={{ background: 'rgba(0,0,0,0.2)', color: 'var(--text-muted)' }}>
            {entries.length}
          </span>
          {hasPending && (
            <span className="text-xs px-1.5 py-0.5 rounded-full shrink-0 hidden sm:inline" style={{ background: 'rgba(186,117,23,0.15)', color: '#BA7517' }}>
              {pendingEntries.length} pending
            </span>
          )}
        </button>

        {/* Right controls */}
        <div className="flex items-center gap-2 pr-4">
          {/* Apply templates — icon button in header */}
          {hasTemplates && (
            <button
              onClick={(e) => { e.stopPropagation(); onApplyTemplates(); }}
              disabled={applyLoading}
              className="flex items-center justify-center w-7 h-7 rounded-lg disabled:opacity-50"
              style={{ background: 'rgba(55,138,221,0.12)', border: '1px solid rgba(55,138,221,0.25)' }}
              title="Add your recurring items to this month"
            >
              {applyLoading ? (
                <span className="w-3 h-3 border border-[#378ADD] border-t-transparent rounded-full animate-spin" />
              ) : (
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} style={{ color: 'var(--clr-savings)' }}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                </svg>
              )}
            </button>
          )}

          <button
            onClick={() => setExpanded(v => !v)}
            className="flex items-center gap-2"
          >
            <span className="text-sm font-semibold tabular-nums" style={{ color: 'var(--text-primary)' }}>
              ₹ {fmt(hasCompletion ? completedSum : fullSum)}
            </span>
            <svg
              className="w-4 h-4 transition-transform shrink-0"
              style={{ color: 'var(--text-muted)', transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)' }}
              fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>
      </div>

      {/* Body */}
      {expanded && (
        <div className="px-4 pb-4 pt-2">
          {extraActions && (
            <div className="flex flex-wrap items-center gap-2 mb-3">
              {extraActions}
            </div>
          )}

          {/* Progress bar for sections with completion */}
          {hasCompletion && entries.length > 0 && hasPending && (
            <div className="mb-3">
              <div className="flex justify-between text-xs mb-1" style={{ color: 'var(--text-muted)' }}>
                <span>{done}/{entries.length} marked done</span>
                <span style={{ color: '#BA7517' }}>{pendingEntries.length} still pending</span>
              </div>
              <div className="h-1 rounded-full overflow-hidden" style={{ background: 'var(--border-default)' }}>
                <div
                  className="h-full rounded-full transition-all"
                  style={{ width: `${entries.length ? (done / entries.length) * 100 : 0}%`, background: '#1D9E75' }}
                />
              </div>
            </div>
          )}

          {/* Entries */}
          {entries.length === 0 ? (
            <p className="text-sm py-2" style={{ color: 'var(--text-faint)' }}>Nothing added yet</p>
          ) : (
            <div className="divide-y" style={{ borderColor: 'var(--divider)' }}>
              {entries.map(entry => (
                <EntryRow
                  key={entry._id}
                  entry={entry}
                  onUpdate={(id, data) => onUpdate(id, data)}
                  onDelete={(id) => onDelete(id)}
                  showDate={isExpenses}
                />
              ))}
            </div>
          )}

          {/* Add form */}
          {showForm ? (
            <div className="mt-3">
              <AddEntryForm
                onAdd={handleAdd}
                loading={addLoading}
                placeholder={isExpenses ? 'Description' : 'Name'}
                showDate={isExpenses}
              />
            </div>
          ) : (
            <button
              onClick={() => setShowForm(true)}
              className="flex items-center gap-1.5 mt-3 text-xs"
              style={{ color: 'var(--text-muted)' }}
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              Add entry
            </button>
          )}
        </div>
      )}
    </div>
  );
}
