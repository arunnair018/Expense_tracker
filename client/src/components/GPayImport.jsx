import { useState, useRef } from 'react';
import api from '../services/api';
import { useToast, getErrorMessage } from '../context/ToastContext';

const fmt = (n) => Number(n).toLocaleString('en-IN');

export default function GPayImport({ month, onImported }) {
  const { showToast } = useToast();
  const fileRef = useRef(null);

  const [phase,        setPhase]        = useState('idle');  // idle|parsing|selecting|importing
  const [transactions, setTransactions] = useState([]);
  const [selected,     setSelected]     = useState(new Set());
  const [password,     setPassword]     = useState('');
  const [showPwd,      setShowPwd]      = useState(false);
  const [filter,       setFilter]       = useState('debit'); // debit|credit|all

  const handleFile = async (file) => {
    if (!file || file.type !== 'application/pdf') {
      showToast('Please select a PDF file');
      return;
    }
    setPhase('parsing');
    const form = new FormData();
    form.append('file', file);
    form.append('password', password);
    try {
      const { data } = await api.post('/gpay/parse', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setTransactions(data.transactions);
      // Pre-select all debit transactions
      setSelected(new Set(data.transactions.filter(t => t.type === 'debit').map((_, i) => i)));
      setPhase('selecting');
    } catch (err) {
      showToast(getErrorMessage(err));
      setPhase('idle');
    }
  };

  const toggleSelect = (idx) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(idx) ? next.delete(idx) : next.add(idx);
      return next;
    });
  };

  const toggleAll = () => {
    const visible = filtered.map(([_, idx]) => idx);
    const allSel  = visible.every(i => selected.has(i));
    setSelected(prev => {
      const next = new Set(prev);
      visible.forEach(i => allSel ? next.delete(i) : next.add(i));
      return next;
    });
  };

  const filtered = transactions
    .map((t, i) => [t, i])
    .filter(([t]) => filter === 'all' || t.type === filter);

  const handleImport = async () => {
    const toImport = transactions
      .filter((_, i) => selected.has(i))
      .map(t => ({
        name:   t.merchant,
        amount: t.amount,
        date:   t.date,
        source: 'gpay',
      }));

    if (!toImport.length) { showToast('Select at least one transaction', 'info'); return; }

    setPhase('importing');
    try {
      await api.post(`/months/${month}/expenses/bulk`, { entries: toImport });
      showToast(`${toImport.length} transactions imported`, 'success');
      onImported();
      setPhase('idle');
      setTransactions([]);
      setSelected(new Set());
    } catch (err) {
      showToast(getErrorMessage(err));
      setPhase('selecting');
    }
  };

  const reset = () => {
    setPhase('idle');
    setTransactions([]);
    setSelected(new Set());
    setPassword('');
  };

  /* ── Idle: show upload button ──────────────────────────────────────── */
  if (phase === 'idle') {
    return (
      <div className="flex items-center gap-2">
        <input
          ref={fileRef}
          type="file"
          accept="application/pdf"
          className="hidden"
          onChange={e => handleFile(e.target.files[0])}
        />
        {/* Optional password for encrypted GPay PDFs */}
        <button
          onClick={() => fileRef.current?.click()}
          className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium"
          style={{ background: 'rgba(216,90,48,0.12)', color: '#D85A30', border: '1px solid rgba(216,90,48,0.25)' }}
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
          </svg>
          Import GPay PDF
        </button>
      </div>
    );
  }

  /* ── Parsing ─────────────────────────────────────────────────────── */
  if (phase === 'parsing') {
    return (
      <div className="flex items-center gap-2 text-xs" style={{ color: '#4a6090' }}>
        <span className="w-3.5 h-3.5 border border-current border-t-transparent rounded-full animate-spin" />
        Parsing GPay statement…
      </div>
    );
  }

  /* ── Selecting ────────────────────────────────────────────────────── */
  if (phase === 'selecting') {
    const visibleAll = filtered.every(([_, i]) => selected.has(i));

    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        style={{ background: 'rgba(8,13,28,0.85)', backdropFilter: 'blur(4px)' }}
      >
        <div
          className="w-full max-w-lg rounded-2xl flex flex-col"
          style={{ background: '#111827', border: '1px solid rgba(99,130,220,0.15)', maxHeight: '85vh' }}
        >
          {/* Modal header */}
          <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: 'rgba(99,130,220,0.1)' }}>
            <div>
              <h3 className="text-sm font-semibold" style={{ color: '#f0f4ff' }}>Select transactions</h3>
              <p className="text-xs mt-0.5" style={{ color: '#4a6090' }}>
                {transactions.length} found · {selected.size} selected
              </p>
            </div>
            <button onClick={reset} style={{ color: '#4a6090' }}>✕</button>
          </div>

          {/* Filter tabs */}
          <div className="flex gap-1 px-5 pt-3 pb-2">
            {['debit', 'credit', 'all'].map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className="px-3 py-1 rounded-lg text-xs font-medium capitalize"
                style={{
                  background: filter === f ? 'rgba(37,99,235,0.2)' : 'transparent',
                  color: filter === f ? '#4f8ef7' : '#4a6090',
                  border: filter === f ? '1px solid rgba(37,99,235,0.3)' : '1px solid transparent',
                }}
              >
                {f}
              </button>
            ))}
            <button
              onClick={toggleAll}
              className="ml-auto px-3 py-1 rounded-lg text-xs"
              style={{ color: '#4a6090' }}
            >
              {visibleAll ? 'Deselect all' : 'Select all'}
            </button>
          </div>

          {/* Transaction list */}
          <div className="flex-1 overflow-y-auto px-5 pb-2">
            {filtered.length === 0 ? (
              <p className="text-sm py-4 text-center" style={{ color: '#3a4d70' }}>No transactions</p>
            ) : (
              filtered.map(([txn, idx]) => (
                <button
                  key={idx}
                  onClick={() => toggleSelect(idx)}
                  className="w-full flex items-center gap-3 py-2.5 border-b text-left"
                  style={{ borderColor: 'rgba(99,130,220,0.08)' }}
                >
                  {/* Checkbox */}
                  <span
                    className="w-4 h-4 rounded shrink-0 flex items-center justify-center"
                    style={{
                      background: selected.has(idx) ? '#2563eb' : 'transparent',
                      border: `1.5px solid ${selected.has(idx) ? '#2563eb' : 'rgba(99,130,220,0.3)'}`,
                    }}
                  >
                    {selected.has(idx) && (
                      <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm truncate" style={{ color: '#c8d6f0' }}>{txn.merchant}</p>
                    <p className="text-xs" style={{ color: '#4a6090' }}>{txn.date}{txn.time ? ' · ' + txn.time : ''}</p>
                  </div>
                  <span
                    className="text-sm font-medium tabular-nums shrink-0"
                    style={{ color: txn.type === 'credit' ? '#1D9E75' : '#D85A30' }}
                  >
                    {txn.type === 'credit' ? '+' : '-'}₹{fmt(txn.amount)}
                  </span>
                </button>
              ))
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-5 py-4 border-t" style={{ borderColor: 'rgba(99,130,220,0.1)' }}>
            <span className="text-xs" style={{ color: '#4a6090' }}>
              {selected.size} transactions · ₹{fmt(
                [...selected].reduce((s, i) => s + (transactions[i]?.amount ?? 0), 0)
              )}
            </span>
            <div className="flex gap-2">
              <button onClick={reset} className="px-4 py-2 rounded-xl text-sm" style={{ color: '#4a6090' }}>Cancel</button>
              <button
                onClick={handleImport}
                disabled={!selected.size}
                className="px-4 py-2 rounded-xl text-sm font-semibold disabled:opacity-40"
                style={{ background: '#2563eb', color: '#fff' }}
              >
                Import {selected.size > 0 ? selected.size : ''} to expenses
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* ── Importing ───────────────────────────────────────────────────── */
  return (
    <div className="flex items-center gap-2 text-xs" style={{ color: '#4a6090' }}>
      <span className="w-3.5 h-3.5 border border-current border-t-transparent rounded-full animate-spin" />
      Importing…
    </div>
  );
}
