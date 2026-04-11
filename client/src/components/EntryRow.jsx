import { useState, useRef } from 'react';

const fmt = (n) => Number(n).toLocaleString('en-IN');

export default function EntryRow({ entry, onUpdate, onDelete, showDate = false }) {
  const [editing,  setEditing]  = useState(false);
  const [name,     setName]     = useState(entry.name);
  const [amount,   setAmount]   = useState(String(entry.amount));
  const [toggling, setToggling] = useState(false);
  const [saving,   setSaving]   = useState(false);
  const nameRef = useRef(null);

  const isTemplate  = !!entry.templateId;
  const isCompleted = entry.completed !== false;

  const startEdit = () => {
    setName(entry.name);
    setAmount(String(entry.amount));
    setEditing(true);
    setTimeout(() => nameRef.current?.focus(), 50);
  };

  const handleSave = async () => {
    if (!name.trim() || !amount) return;
    setSaving(true);
    try {
      await onUpdate(entry._id, { name: name.trim(), amount: parseFloat(amount) });
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter')  handleSave();
    if (e.key === 'Escape') { setEditing(false); }
  };

  const handleToggleComplete = async () => {
    if (!isTemplate) return;
    setToggling(true);
    try { await onUpdate(entry._id, { completed: !isCompleted }); }
    finally { setToggling(false); }
  };

  const inputStyle = {
    background: 'var(--bg-input)',
    border: '1px solid rgba(79,142,247,0.5)',
    color: 'var(--text-primary)',
  };

  if (editing) {
    return (
      <div className="py-2 space-y-1.5">
        <input
          ref={nameRef}
          value={name}
          onChange={e => setName(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Name"
          className="w-full px-2.5 py-1.5 rounded-lg text-sm outline-none"
          style={inputStyle}
        />
        <div className="flex gap-2">
          <input
            type="text"
            inputMode="decimal"
            value={amount}
            onChange={e => setAmount(e.target.value.replace(/[^0-9.]/g, ''))}
            onKeyDown={handleKeyDown}
            placeholder="Amount"
            className="min-w-0 px-2.5 py-1.5 rounded-lg text-sm outline-none"
            style={{ ...inputStyle, flex: '1 1 0' }}
          />
          <button
            onClick={handleSave}
            disabled={saving}
            className="py-1.5 rounded-lg text-sm font-medium whitespace-nowrap"
            style={{ background: '#2563eb', color: '#fff', flex: '0 0 72px' }}
          >
            {saving ? '…' : '✓ Save'}
          </button>
          <button
            onClick={() => setEditing(false)}
            className="py-1.5 px-2.5 rounded-lg text-xs"
            style={{ color: 'var(--text-muted)', background: 'var(--bg-hover)', flex: '0 0 auto' }}
          >
            ✕
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-2.5 py-2 ${!isCompleted ? 'opacity-60' : ''}`}>
      {/* Completion toggle (template entries only) */}
      {isTemplate && (
        <button
          onClick={handleToggleComplete}
          disabled={toggling}
          className="shrink-0 w-4 h-4 rounded flex items-center justify-center transition-all"
          style={{
            background: isCompleted ? 'rgba(29,158,117,0.2)' : 'transparent',
            border: `1.5px solid ${isCompleted ? '#1D9E75' : 'var(--border-input)'}`,
          }}
          title={isCompleted ? 'Mark pending' : 'Mark done'}
        >
          {isCompleted && (
            <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="#1D9E75" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          )}
        </button>
      )}

      {/* Name + badges — click to edit */}
      <button onClick={startEdit} className="flex-1 min-w-0 text-left">
        <span className="text-sm" style={{ color: isCompleted ? 'var(--text-secondary)' : 'var(--text-muted)' }}>
          {entry.name}
        </span>
        {!isCompleted && isTemplate && (
          <span className="ml-1.5 text-xs px-1.5 py-0.5 rounded" style={{ background: 'rgba(186,117,23,0.12)', color: '#BA7517' }}>
            pending
          </span>
        )}
        {showDate && entry.date && (
          <span className="ml-2 text-xs" style={{ color: 'var(--text-muted)' }}>{entry.date}</span>
        )}
        {entry.source === 'gpay' && (
          <span className="ml-1.5 text-xs px-1.5 py-0.5 rounded" style={{ background: 'rgba(37,99,235,0.15)', color: '#4f8ef7' }}>GPay</span>
        )}
      </button>

      {/* Amount — click to edit */}
      <button onClick={startEdit} className="text-sm font-medium tabular-nums shrink-0" style={{ color: isCompleted ? 'var(--text-primary)' : 'var(--text-muted)' }}>
        ₹ {fmt(entry.amount)}
      </button>

      {/* Delete — always visible */}
      <button
        onClick={() => onDelete(entry._id)}
        className="shrink-0 w-6 h-6 flex items-center justify-center rounded"
        style={{ color: 'var(--text-muted)' }}
        title="Delete"
      >
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}
