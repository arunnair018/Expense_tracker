import { useState } from 'react';

const fmt = (n) => Number(n).toLocaleString('en-IN');

export default function EntryRow({ entry, onUpdate, onDelete, showDate = false }) {
  const [editing, setEditing]   = useState(false);
  const [name,    setName]      = useState(entry.name);
  const [amount,  setAmount]    = useState(entry.amount);
  const [saving,  setSaving]    = useState(false);

  const handleSave = async () => {
    if (!name.trim() || !amount) return;
    setSaving(true);
    await onUpdate(entry._id, { name: name.trim(), amount: parseFloat(amount) });
    setSaving(false);
    setEditing(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter')  handleSave();
    if (e.key === 'Escape') { setEditing(false); setName(entry.name); setAmount(entry.amount); }
  };

  if (editing) {
    return (
      <div className="flex items-center gap-2 py-1.5">
        <input
          autoFocus
          value={name}
          onChange={e => setName(e.target.value)}
          onKeyDown={handleKeyDown}
          className="flex-1 px-2.5 py-1 rounded-lg text-sm outline-none"
          style={{ background: '#0d1529', border: '1px solid rgba(79,142,247,0.5)', color: '#f0f4ff' }}
        />
        <input
          type="number"
          value={amount}
          onChange={e => setAmount(e.target.value)}
          onKeyDown={handleKeyDown}
          className="w-28 px-2.5 py-1 rounded-lg text-sm text-right outline-none"
          style={{ background: '#0d1529', border: '1px solid rgba(79,142,247,0.5)', color: '#f0f4ff' }}
        />
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-3 py-1 rounded-lg text-xs font-medium"
          style={{ background: '#2563eb', color: '#fff' }}
        >
          {saving ? '…' : '✓'}
        </button>
        <button
          onClick={() => { setEditing(false); setName(entry.name); setAmount(entry.amount); }}
          className="px-2 py-1 rounded-lg text-xs"
          style={{ color: '#4a6090' }}
        >
          ✕
        </button>
      </div>
    );
  }

  return (
    <div className="group flex items-center gap-2 py-1.5">
      <div className="flex-1 min-w-0">
        <span className="text-sm" style={{ color: '#c8d6f0' }}>{entry.name}</span>
        {showDate && entry.date && (
          <span className="ml-2 text-xs" style={{ color: '#4a6090' }}>{entry.date}</span>
        )}
        {entry.source === 'gpay' && (
          <span className="ml-1.5 text-xs px-1.5 py-0.5 rounded" style={{ background: 'rgba(37,99,235,0.15)', color: '#4f8ef7' }}>GPay</span>
        )}
      </div>
      <span className="text-sm font-medium tabular-nums" style={{ color: '#f0f4ff' }}>
        ₹ {fmt(entry.amount)}
      </span>
      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={() => setEditing(true)}
          className="p-1 rounded"
          style={{ color: '#4a6090' }}
          title="Edit"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536M9 13l6.586-6.586a2 2 0 112.828 2.828L11.828 15.828a4 4 0 01-1.414.828l-3 1 1-3a4 4 0 01.828-1.414z" />
          </svg>
        </button>
        <button
          onClick={() => onDelete(entry._id)}
          className="p-1 rounded"
          style={{ color: '#4a6090' }}
          title="Delete"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}
