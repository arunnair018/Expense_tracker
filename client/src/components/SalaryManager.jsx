import { useState, useEffect } from 'react';
import api from '../services/api';
import { useToast, getErrorMessage } from '../context/ToastContext';

const fmt = (n) => Number(n).toLocaleString('en-IN');

const fmtMonth = (m) => {
  const [y, mo] = m.split('-');
  return new Date(+y, +mo - 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
};

const inputStyle = {
  background: 'var(--bg-input)',
  border: '1px solid var(--border-input)',
  color: 'var(--text-primary)',
};

export default function SalaryManager({ currentMonth, onClose, onSalaryAdded }) {
  const { showToast } = useToast();
  const [entries,   setEntries]   = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [amount,    setAmount]    = useState('');
  const [fromMonth, setFromMonth] = useState(currentMonth);
  const [saving,    setSaving]    = useState(false);

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
      showToast('Salary updated', 'success');
      onSalaryAdded?.(parseFloat(amount));
      setAmount('');
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
      style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
    >
      <div
        className="w-full max-w-md rounded-2xl flex flex-col"
        style={{ background: 'var(--bg-card)', border: '1px solid var(--border-card)', maxHeight: '80vh' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: 'var(--divider)' }}>
          <div>
            <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>My Salary</h3>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>Changes take effect from the selected month onwards</p>
          </div>
          <button onClick={onClose} style={{ color: 'var(--text-muted)' }}>✕</button>
        </div>

        {/* History */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {loading ? (
            <p className="text-sm text-center py-4" style={{ color: 'var(--text-muted)' }}>Loading…</p>
          ) : entries.length === 0 ? (
            <p className="text-sm text-center py-4" style={{ color: 'var(--text-faint)' }}>No salary added yet</p>
          ) : (
            <div className="space-y-2">
              {entries.map((e, i) => (
                <div key={e.effectiveFrom}
                  className="flex items-center justify-between py-2 border-b"
                  style={{ borderColor: 'var(--divider)' }}
                >
                  <div>
                    <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>₹ {fmt(e.amount)}</span>
                    {i === 0 && (
                      <span className="ml-2 text-xs px-1.5 py-0.5 rounded" style={{ background: 'rgba(29,158,117,0.12)', color: '#1D9E75' }}>
                        Active
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs" style={{ color: 'var(--text-muted)' }}>from {fmtMonth(e.effectiveFrom)}</span>
                    <button
                      onClick={() => handleDelete(e.effectiveFrom)}
                      className="text-xs"
                      style={{ color: 'var(--text-muted)' }}
                    >✕</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Add / update salary */}
        <div className="px-5 pb-5 pt-4 border-t" style={{ borderColor: 'var(--divider)' }}>
          <p className="text-xs font-medium mb-2" style={{ color: 'var(--text-muted)' }}>Add a salary change</p>
          <form onSubmit={handleSave} className="space-y-2">
            <input
              type="month"
              value={fromMonth}
              onChange={e => setFromMonth(e.target.value)}
              required
              className="w-full px-3 py-2 rounded-lg text-sm outline-none"
              style={inputStyle}
            />
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              value={amount}
              onChange={e => setAmount(e.target.value.replace(/[^0-9]/g, ''))}
              placeholder="Amount"
              required
              className="w-full px-3 py-2 rounded-lg text-sm outline-none"
              style={inputStyle}
            />
            <button
              type="submit"
              disabled={saving || !amount}
              className="w-full py-2 rounded-lg text-sm font-medium disabled:opacity-40"
              style={{ background: '#2563eb', color: '#fff' }}
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
