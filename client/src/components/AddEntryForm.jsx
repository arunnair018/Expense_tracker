import { useState } from 'react';

const inputStyle = {
  background: 'var(--bg-input)',
  border: '1px solid var(--border-input)',
  color: 'var(--text-primary)',
};

export default function AddEntryForm({ onAdd, loading, placeholder = 'Name', showDate = false }) {
  const [name,   setName]   = useState('');
  const [amount, setAmount] = useState('');
  const [date,   setDate]   = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name.trim() || !amount) return;
    const entry = { name: name.trim(), amount: parseFloat(amount) };
    if (showDate && date) entry.date = date;
    onAdd(entry);
    setName(''); setAmount(''); setDate('');
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      <input
        value={name}
        onChange={e => setName(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3 py-2 rounded-lg text-sm outline-none"
        style={inputStyle}
      />
      {showDate && (
        <input
          value={date}
          onChange={e => setDate(e.target.value)}
          placeholder="Date (optional, e.g. 01 Apr 2026)"
          className="w-full px-3 py-2 rounded-lg text-sm outline-none"
          style={inputStyle}
        />
      )}
      <div className="flex gap-2">
        <input
          type="text"
          inputMode="decimal"
          value={amount}
          onChange={e => setAmount(e.target.value.replace(/[^0-9.]/g, ''))}
          placeholder="Amount"
          className="min-w-0 px-3 py-2 rounded-lg text-sm outline-none"
          style={{ ...inputStyle, flex: '1 1 0' }}
        />
        <button
          type="submit"
          disabled={loading || !name.trim() || !amount}
          className="py-2 rounded-lg text-sm font-medium disabled:opacity-40 whitespace-nowrap"
          style={{ background: 'rgba(37,99,235,0.2)', color: '#4f8ef7', border: '1px solid rgba(37,99,235,0.3)', flex: '0 0 72px' }}
        >
          {loading ? '…' : '+ Add'}
        </button>
      </div>
    </form>
  );
}
