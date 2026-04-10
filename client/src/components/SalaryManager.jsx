import { useState, useEffect } from 'react';
import api from '../services/api';
import { useToast, getErrorMessage } from '../context/ToastContext';

const fmt = (n) => Number(n).toLocaleString('en-IN');

const inputStyle = {
  background: '#0d1529',
  border: '1px solid rgba(99,130,220,0.2)',
  color: '#f0f4ff',
};

export default function SalaryManager({ currentMonth, onClose, onSalaryAdded }) {
  const { showToast } = useToast();
  const [entries,  setEntries]  = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [amount,   setAmount]   = useState('');
  const [fromMonth, setFromMonth] = useState(currentMonth);
  const [saving,   setSaving]   = useState(false);

  useEffect(() => { load(); }, []);

  const load = async () => {
    try {
      const { data } = await api.get('/salary');
      const sorted = [...(data.entries || [])].sort((a, b) =>
        b.effectiveFrom.localeCompare(a.effectiveFrom)
      );
      setEntries(sorted);
    } catch (err) {
      showToast(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!amount || !fromMonth) return;
    setSaving(true);
    try {
      const { data } = await api.post('/salary', { amount: parseFloat(amount), effectiveFrom: fromMonth });
      const sorted = [...(data.entries || [])].sort((a, b) =>
        b.effectiveFrom.localeCompare(a.effectiveFrom)
      );
      setEntries(sorted);
      setAmount('');
      showToast('Salary updated', 'success');
      onSalaryAdded?.();
    } catch (err) {
      showToast(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (effectiveFrom) => {
    try {
      const { data } = await api.delete(`/salary/${effectiveFrom}`);
      const sorted = [...(data.entries || [])].sort((a, b) =>
        b.effectiveFrom.localeCompare(a.effectiveFrom)
      );
      setEntries(sorted);
    } catch (err) {
      showToast(getErrorMessage(err));
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(8,13,28,0.85)', backdropFilter: 'blur(4px)' }}
    >
      <div
        className="w-full max-w-md rounded-2xl flex flex-col"
        style={{ background: '#111827', border: '1px solid rgba(99,130,220,0.15)', maxHeight: '80vh' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: 'rgba(99,130,220,0.1)' }}>
          <div>
            <h3 className="text-sm font-semibold" style={{ color: '#f0f4ff' }}>Salary History</h3>
            <p className="text-xs mt-0.5" style={{ color: '#4a6090' }}>Each entry applies from that month onward</p>
          </div>
          <button onClick={onClose} style={{ color: '#4a6090' }}>✕</button>
        </div>

        {/* History */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {loading ? (
            <p className="text-sm text-center py-4" style={{ color: '#4a6090' }}>Loading…</p>
          ) : entries.length === 0 ? (
            <p className="text-sm text-center py-4" style={{ color: '#3a4d70' }}>No salary configured yet</p>
          ) : (
            <div className="space-y-2">
              {entries.map((e, i) => (
                <div key={e.effectiveFrom}
                  className="flex items-center justify-between py-2 border-b"
                  style={{ borderColor: 'rgba(99,130,220,0.08)' }}
                >
                  <div>
                    <span className="text-sm" style={{ color: '#c8d6f0' }}>₹ {fmt(e.amount)}</span>
                    {i === 0 && (
                      <span className="ml-2 text-xs px-1.5 py-0.5 rounded" style={{ background: 'rgba(29,158,117,0.12)', color: '#1D9E75' }}>
                        current
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs" style={{ color: '#4a6090' }}>from {e.effectiveFrom}</span>
                    <button
                      onClick={() => handleDelete(e.effectiveFrom)}
                      className="text-xs"
                      style={{ color: '#4a6090' }}
                    >✕</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Add / update salary */}
        <div className="px-5 pb-5 pt-4 border-t" style={{ borderColor: 'rgba(99,130,220,0.1)' }}>
          <p className="text-xs font-medium mb-2" style={{ color: '#4a6090' }}>Set salary from month</p>
          <form onSubmit={handleSave} className="flex items-center gap-2">
            <input
              type="month"
              value={fromMonth}
              onChange={e => setFromMonth(e.target.value)}
              required
              className="px-3 py-1.5 rounded-lg text-sm outline-none"
              style={inputStyle}
            />
            <input
              type="number"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              placeholder="Amount"
              min="0"
              required
              className="flex-1 px-3 py-1.5 rounded-lg text-sm text-right outline-none"
              style={inputStyle}
            />
            <button
              type="submit"
              disabled={saving || !amount}
              className="px-3 py-1.5 rounded-lg text-sm font-medium disabled:opacity-40"
              style={{ background: '#2563eb', color: '#fff' }}
            >
              {saving ? '…' : 'Save'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
