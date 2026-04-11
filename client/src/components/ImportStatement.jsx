import { useState, useRef } from 'react';
import api from '../services/api';
import { useToast, getErrorMessage } from '../context/ToastContext';

const fmt = (n) => Number(n).toLocaleString('en-IN');

const inputStyle = {
  background: 'var(--bg-input)',
  border: '1px solid var(--border-input)',
  color: 'var(--text-primary)',
};

// phases: upload | parsing | needPassword | selecting | importing
export default function ImportStatement({ month, onImported, onClose }) {
  const { showToast } = useToast();
  const fileRef = useRef(null);

  const [phase,        setPhase]        = useState('upload');
  const [pendingFile,  setPendingFile]  = useState(null);
  const [password,     setPassword]     = useState('');
  const [pwdError,     setPwdError]     = useState('');
  const [transactions, setTransactions] = useState([]);
  const [selected,     setSelected]     = useState(new Set());
  const [filter,       setFilter]       = useState('debit');

  /* ── Parse ───────────────────────────────────────────────────────── */
  const parse = async (file, pwd) => {
    setPhase('parsing');
    const form = new FormData();
    form.append('file', file);
    form.append('password', pwd || '');
    try {
      const { data } = await api.post('/gpay/parse', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setTransactions(data.transactions);
      setSelected(new Set(data.transactions.filter(t => t.type === 'debit').map((_, i) => i)));
      setPhase('selecting');
    } catch (err) {
      const code = err?.response?.data?.code;
      if (code === 'PASSWORD_REQUIRED') {
        setPwdError('This PDF is password protected. Enter the password to continue.');
        setPendingFile(file);
        setPhase('needPassword');
      } else if (code === 'WRONG_PASSWORD') {
        setPwdError('Incorrect password. Try again.');
        setPhase('needPassword');
      } else {
        showToast(getErrorMessage(err));
        setPhase('upload');
      }
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.type !== 'application/pdf') { showToast('Please select a PDF file'); return; }
    setPendingFile(file);
    parse(file, password);
  };

  const handlePasswordSubmit = (e) => {
    e.preventDefault();
    if (!password.trim()) return;
    setPwdError('');
    parse(pendingFile, password);
  };

  /* ── Select / import ─────────────────────────────────────────────── */
  const toggleSelect = (idx) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(idx) ? next.delete(idx) : next.add(idx);
      return next;
    });
  };

  const filtered = transactions.map((t, i) => [t, i]).filter(([t]) => filter === 'all' || t.type === filter);
  const visibleAll = filtered.length > 0 && filtered.every(([_, i]) => selected.has(i));

  const toggleAll = () => {
    const visible = filtered.map(([_, i]) => i);
    const allSel  = visible.every(i => selected.has(i));
    setSelected(prev => {
      const next = new Set(prev);
      visible.forEach(i => allSel ? next.delete(i) : next.add(i));
      return next;
    });
  };

  const handleImport = async () => {
    const toImport = transactions
      .filter((_, i) => selected.has(i))
      .map(t => ({ name: t.merchant, amount: t.amount, date: t.date, source: 'gpay' }));
    if (!toImport.length) { showToast('Select at least one transaction', 'info'); return; }
    setPhase('importing');
    try {
      await api.post(`/months/${month}/expenses/bulk`, { entries: toImport });
      showToast(`${toImport.length} transactions added to expenses`, 'success');
      onImported();
      onClose();
    } catch (err) {
      showToast(getErrorMessage(err));
      setPhase('selecting');
    }
  };

  /* ── Shared modal shell ───────────────────────────────────────────── */
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
    >
      <div
        className="w-full max-w-lg rounded-2xl flex flex-col"
        style={{ background: 'var(--bg-card)', border: '1px solid var(--border-card)', maxHeight: '88vh' }}
      >
        {/* ── Upload phase ──────────────────────────────────────────── */}
        {phase === 'upload' && (
          <>
            <div className="flex items-start justify-between px-5 py-4 border-b" style={{ borderColor: 'var(--divider)' }}>
              <div>
                <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Import GPay Statement</h3>
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>Quickly add your expenses from a Google Pay PDF</p>
              </div>
              <button onClick={onClose} style={{ color: 'var(--text-muted)' }}>✕</button>
            </div>

            <div className="px-5 py-5 space-y-4">
              {/* Warning banner */}
              <div className="flex gap-2.5 px-3.5 py-3 rounded-xl" style={{ background: 'rgba(186,117,23,0.1)', border: '1px solid rgba(186,117,23,0.25)' }}>
                <svg className="w-4 h-4 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="#BA7517" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                </svg>
                <p className="text-xs" style={{ color: '#d4a24a' }}>
                  Built for <strong>Google Pay</strong> statements. Other bank or UPI app PDFs may not work correctly.
                </p>
              </div>

              {/* File drop zone */}
              <input ref={fileRef} type="file" accept="application/pdf" className="hidden" onChange={handleFileChange} />
              <button
                onClick={() => fileRef.current?.click()}
                className="w-full flex flex-col items-center gap-3 py-8 rounded-xl border-2 border-dashed transition-colors"
                style={{ borderColor: 'var(--border-input)', background: 'var(--bg-hover)' }}
              >
                <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="var(--text-faint)" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                <div className="text-center">
                  <p className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Tap to choose your PDF</p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>Download from Google Pay → Statement</p>
                </div>
              </button>

              {/* Optional password */}
              <div>
                <p className="text-xs mb-1.5" style={{ color: 'var(--text-muted)' }}>PDF password (only if the file is locked)</p>
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Leave empty if not password-protected"
                  className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                  style={inputStyle}
                />
              </div>
            </div>
          </>
        )}

        {/* ── Password required phase ────────────────────────────────── */}
        {phase === 'needPassword' && (
          <>
            <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: 'var(--divider)' }}>
              <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Password Required</h3>
              <button onClick={onClose} style={{ color: 'var(--text-muted)' }}>✕</button>
            </div>
            <form onSubmit={handlePasswordSubmit} className="px-5 py-5 space-y-4">
              <div className="flex gap-2.5 px-3.5 py-3 rounded-xl" style={{ background: 'rgba(216,90,48,0.08)', border: '1px solid rgba(216,90,48,0.2)' }}>
                <svg className="w-4 h-4 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="#D85A30" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                <p className="text-xs" style={{ color: '#e8906a' }}>{pwdError}</p>
              </div>
              <input
                autoFocus
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Enter PDF password"
                className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                style={inputStyle}
              />
              <button
                type="submit"
                disabled={!password.trim()}
                className="w-full py-2 rounded-lg text-sm font-semibold disabled:opacity-40"
                style={{ background: '#2563eb', color: '#fff' }}
              >
                Retry with password
              </button>
            </form>
          </>
        )}

        {/* ── Parsing phase ─────────────────────────────────────────── */}
        {phase === 'parsing' && (
          <div className="flex flex-col items-center justify-center gap-3 px-5 py-16">
            <span className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Parsing statement…</p>
          </div>
        )}

        {/* ── Selecting phase ───────────────────────────────────────── */}
        {phase === 'selecting' && (
          <>
            <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: 'var(--divider)' }}>
              <div>
                <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Select transactions</h3>
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                  {transactions.length} found · {selected.size} selected
                </p>
              </div>
              <button onClick={onClose} style={{ color: 'var(--text-muted)' }}>✕</button>
            </div>

            {/* Filter tabs */}
            <div className="flex gap-1 px-5 pt-3 pb-2">
              {[['debit','Payments'], ['credit','Received'], ['all','All']].map(([f, label]) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className="px-3 py-1 rounded-lg text-xs font-medium"
                  style={{
                    background: filter === f ? 'rgba(37,99,235,0.2)' : 'transparent',
                    color:      filter === f ? '#4f8ef7' : 'var(--text-muted)',

                    border:     filter === f ? '1px solid rgba(37,99,235,0.3)' : '1px solid transparent',
                  }}
                >
                  {label}
                </button>
              ))}
              <button onClick={toggleAll} className="ml-auto px-3 py-1 rounded-lg text-xs" style={{ color: 'var(--text-muted)' }}>
                {visibleAll ? 'Deselect all' : 'Select all'}
              </button>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto px-5 pb-2">
              {filtered.length === 0 ? (
                <p className="text-sm py-4 text-center" style={{ color: 'var(--text-faint)' }}>No transactions found</p>
              ) : filtered.map(([txn, idx]) => (
                <button
                  key={idx}
                  onClick={() => toggleSelect(idx)}
                  className="w-full flex items-center gap-3 py-2.5 border-b text-left"
                  style={{ borderColor: 'var(--divider)' }}
                >
                  <span
                    className="w-4 h-4 rounded shrink-0 flex items-center justify-center"
                    style={{
                      background: selected.has(idx) ? '#2563eb' : 'transparent',
                      border: `1.5px solid ${selected.has(idx) ? '#2563eb' : 'var(--border-input)'}`,
                    }}
                  >
                    {selected.has(idx) && (
                      <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm truncate" style={{ color: 'var(--text-secondary)' }}>{txn.merchant}</p>
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{txn.date}{txn.time ? ' · ' + txn.time : ''}</p>
                  </div>
                  <span className="text-sm font-medium tabular-nums shrink-0" style={{ color: txn.type === 'credit' ? '#1D9E75' : '#D85A30' }}>
                    {txn.type === 'credit' ? '+' : '-'}₹{fmt(txn.amount)}
                  </span>
                </button>
              ))}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between px-5 py-4 border-t" style={{ borderColor: 'var(--divider)' }}>
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                {selected.size} · ₹{fmt([...selected].reduce((s, i) => s + (transactions[i]?.amount ?? 0), 0))}
              </span>
              <div className="flex gap-2">
                <button onClick={onClose} className="px-4 py-2 rounded-xl text-sm" style={{ color: 'var(--text-muted)' }}>Cancel</button>
                <button
                  onClick={handleImport}
                  disabled={!selected.size}
                  className="px-4 py-2 rounded-xl text-sm font-semibold disabled:opacity-40"
                  style={{ background: '#2563eb', color: '#fff' }}
                >
                  Add {selected.size || ''} to Expenses
                </button>
              </div>
            </div>
          </>
        )}

        {/* ── Importing phase ───────────────────────────────────────── */}
        {phase === 'importing' && (
          <div className="flex flex-col items-center justify-center gap-3 px-5 py-16">
            <span className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Importing…</p>
          </div>
        )}
      </div>
    </div>
  );
}
