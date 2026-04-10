import { useState } from 'react';

const inputStyle = {
  background: '#0d1529',
  border: '1px solid rgba(99,130,220,0.2)',
  color: '#f0f4ff',
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
    <form onSubmit={handleSubmit} className="flex items-center gap-2 mt-2">
      <input
        value={name}
        onChange={e => setName(e.target.value)}
        placeholder={placeholder}
        className="flex-1 px-3 py-1.5 rounded-lg text-sm outline-none"
        style={inputStyle}
      />
      {showDate && (
        <input
          value={date}
          onChange={e => setDate(e.target.value)}
          placeholder="Date (optional)"
          className="w-32 px-3 py-1.5 rounded-lg text-sm outline-none"
          style={inputStyle}
        />
      )}
      <input
        type="number"
        value={amount}
        onChange={e => setAmount(e.target.value)}
        placeholder="Amount"
        className="w-28 px-3 py-1.5 rounded-lg text-sm text-right outline-none"
        style={inputStyle}
        min="0"
        step="0.01"
      />
      <button
        type="submit"
        disabled={loading || !name.trim() || !amount}
        className="px-3 py-1.5 rounded-lg text-sm font-medium disabled:opacity-40"
        style={{ background: 'rgba(37,99,235,0.2)', color: '#4f8ef7', border: '1px solid rgba(37,99,235,0.3)' }}
      >
        {loading ? '…' : '+ Add'}
      </button>
    </form>
  );
}
