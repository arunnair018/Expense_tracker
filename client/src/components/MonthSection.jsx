import { useState } from 'react';
import EntryRow from './EntryRow';
import AddEntryForm from './AddEntryForm';

const fmt = (n) => Number(n).toLocaleString('en-IN');

const SECTION_COLORS = {
  credits:       { accent: '#1D9E75', bg: 'rgba(29,158,117,0.08)',  border: 'rgba(29,158,117,0.2)'  },
  savings:       { accent: '#378ADD', bg: 'rgba(55,138,221,0.08)',  border: 'rgba(55,138,221,0.2)'  },
  investments:   { accent: '#378ADD', bg: 'rgba(55,138,221,0.08)',  border: 'rgba(55,138,221,0.2)'  },
  subscriptions: { accent: '#BA7517', bg: 'rgba(186,117,23,0.08)', border: 'rgba(186,117,23,0.2)'  },
  expenses:      { accent: '#D85A30', bg: 'rgba(216,90,48,0.08)',  border: 'rgba(216,90,48,0.2)'   },
};

const SECTION_LABELS = {
  credits:       'Credits',
  savings:       'Savings',
  investments:   'Investments',
  subscriptions: 'Subscriptions',
  expenses:      'Expenses',
};

export default function MonthSection({
  section, entries = [], total = 0,
  onAdd, onUpdate, onDelete, onApplyTemplates,
  addLoading, applyLoading,
  extraActions,   // e.g. GPay import button
}) {
  const [expanded, setExpanded] = useState(true);
  const [showForm, setShowForm] = useState(false);

  const colors     = SECTION_COLORS[section] || SECTION_COLORS.expenses;
  const label      = SECTION_LABELS[section] || section;
  const isExpenses = section === 'expenses';
  const hasTemplates = ['savings', 'investments', 'subscriptions'].includes(section);

  const handleAdd = async (entry) => {
    await onAdd(entry);
    setShowForm(false);
  };

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{ background: '#111827', border: `1px solid ${colors.border}` }}
    >
      {/* Header */}
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center justify-between px-5 py-4"
        style={{ background: colors.bg }}
      >
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold" style={{ color: colors.accent }}>{label}</span>
          <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'rgba(0,0,0,0.3)', color: '#4a6090' }}>
            {entries.length}
          </span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm font-semibold tabular-nums" style={{ color: '#f0f4ff' }}>
            ₹ {fmt(total)}
          </span>
          <svg
            className="w-4 h-4 transition-transform"
            style={{ color: '#4a6090', transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)' }}
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {/* Body */}
      {expanded && (
        <div className="px-5 pb-4 pt-2">
          {/* Action bar */}
          {(hasTemplates || extraActions) && (
            <div className="flex flex-wrap items-center gap-2 mb-3">
              {hasTemplates && (
                <button
                  onClick={onApplyTemplates}
                  disabled={applyLoading}
                  className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium transition-all disabled:opacity-50"
                  style={{ background: 'rgba(55,138,221,0.12)', color: '#378ADD', border: '1px solid rgba(55,138,221,0.25)' }}
                >
                  {applyLoading ? (
                    <span className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                  )}
                  Apply templates
                </button>
              )}
              {extraActions}
            </div>
          )}

          {/* Entries */}
          {entries.length === 0 ? (
            <p className="text-sm py-2" style={{ color: '#3a4d70' }}>No entries yet</p>
          ) : (
            <div className="divide-y" style={{ borderColor: 'rgba(99,130,220,0.08)' }}>
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
            <AddEntryForm
              onAdd={handleAdd}
              loading={addLoading}
              placeholder={isExpenses ? 'Description' : 'Name'}
              showDate={isExpenses}
            />
          ) : (
            <button
              onClick={() => setShowForm(true)}
              className="flex items-center gap-1.5 mt-3 text-xs transition-colors"
              style={{ color: '#4a6090' }}
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              Add manually
            </button>
          )}
        </div>
      )}
    </div>
  );
}
