import { useState, useEffect, useRef } from 'react';
import api from '../services/api';
import { useToast, getErrorMessage } from '../context/ToastContext';

const fmt  = (n) => Number(n).toLocaleString('en-IN');
const CATS = ['savings', 'investments', 'subscriptions'];
const CLRS = {
  savings:       { color: 'var(--clr-savings)',      bg: 'rgba(55,138,221,0.12)'  },
  investments:   { color: 'var(--clr-savings)',      bg: 'rgba(55,138,221,0.12)'  },
  subscriptions: { color: 'var(--clr-subscription)', bg: 'rgba(186,117,23,0.12)' },
};

const inputStyle = {
  background: 'var(--bg-input)',
  border: '1px solid var(--border-input)',
  color: 'var(--text-primary)',
};

/* ── Inline editable template row ─────────────────────────────── */
function TemplateRow({ t, clr, onToggleActive, onSave, onDelete }) {
  const [editing,  setEditing]  = useState(false);
  const [name,     setName]     = useState(t.name);
  const [amount,   setAmount]   = useState(String(t.amount));
  const [saving,   setSaving]   = useState(false);
  const [deleting, setDeleting] = useState(false);
  const nameRef = useRef(null);

  const startEdit = () => {
    setName(t.name); setAmount(String(t.amount));
    setEditing(true);
    setTimeout(() => nameRef.current?.focus(), 50);
  };

  const handleSave = async () => {
    if (!name.trim() || !amount) return;
    setSaving(true);
    try {
      await onSave(t._id, { name: name.trim(), amount: parseFloat(amount) });
      setEditing(false);
    } finally { setSaving(false); }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try { await onDelete(t._id); }
    finally { setDeleting(false); }
  };

  const handleKey = (e) => {
    if (e.key === 'Enter')  handleSave();
    if (e.key === 'Escape') setEditing(false);
  };

  if (editing) {
    return (
      <div className="py-2 space-y-1.5">
        <input
          ref={nameRef}
          value={name}
          onChange={e => setName(e.target.value)}
          onKeyDown={handleKey}
          className="w-full px-2.5 py-1.5 rounded-lg text-sm outline-none"
          style={inputStyle}
        />
        <div className="flex gap-2">
          <input
            type="text"
            inputMode="decimal"
            value={amount}
            onChange={e => setAmount(e.target.value.replace(/[^0-9.]/g, ''))}
            onKeyDown={handleKey}
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
    <div className="flex items-center gap-2 py-1.5">
      {/* Active toggle */}
      <button
        onClick={() => onToggleActive(t)}
        className="w-4 h-4 rounded shrink-0 flex items-center justify-center"
        style={{
          background: t.isActive ? clr.bg : 'transparent',
          border: t.isActive ? `1.5px solid ${clr.color}` : '1.5px solid var(--border-input)',
        }}
      >
        {t.isActive && (
          <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3} style={{ color: clr.color }}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        )}
      </button>

      {/* Name — click to edit */}
      <button onClick={startEdit} className="flex-1 min-w-0 text-left">
        <span className="text-sm" style={{ color: t.isActive ? 'var(--text-secondary)' : 'var(--text-muted)' }}>{t.name}</span>
      </button>

      {/* Amount — click to edit */}
      <button onClick={startEdit} className="text-sm tabular-nums shrink-0" style={{ color: t.isActive ? 'var(--text-primary)' : 'var(--text-muted)' }}>
        ₹ {fmt(t.amount)}
      </button>

      {/* Delete — always visible */}
      <button
        onClick={handleDelete}
        disabled={deleting}
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

/* ── Main component ────────────────────────────────────────────── */
export default function TemplateManager({ onClose }) {
  const { showToast } = useToast();
  const [templates, setTemplates] = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [adding,    setAdding]    = useState(false);
  const [form,      setForm]      = useState({ name: '', amount: '', category: 'savings' });

  useEffect(() => { load(); }, []);

  const load = async () => {
    try {
      const { data } = await api.get('/templates');
      setTemplates(data);
    } catch (err) {
      showToast(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.amount) return;
    setAdding(true);
    try {
      const { data } = await api.post('/templates', {
        name: form.name.trim(),
        amount: parseFloat(form.amount),
        category: form.category,
      });
      setTemplates(prev => [...prev, data]);
      setForm(f => ({ ...f, name: '', amount: '' }));
    } catch (err) {
      showToast(getErrorMessage(err));
    } finally {
      setAdding(false);
    }
  };

  const handleToggleActive = async (t) => {
    try {
      const { data } = await api.put(`/templates/${t._id}`, { isActive: !t.isActive });
      setTemplates(prev => prev.map(x => x._id === data._id ? data : x));
    } catch (err) {
      showToast(getErrorMessage(err));
    }
  };

  const handleSave = async (id, payload) => {
    const { data } = await api.put(`/templates/${id}`, payload);
    setTemplates(prev => prev.map(x => x._id === data._id ? data : x));
  };

  const handleDelete = async (id) => {
    await api.delete(`/templates/${id}`);
    setTemplates(prev => prev.filter(x => x._id !== id));
  };

  const grouped = CATS.reduce((acc, cat) => {
    acc[cat] = templates.filter(t => t.category === cat);
    return acc;
  }, {});

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
    >
      <div
        className="w-full max-w-lg rounded-2xl flex flex-col"
        style={{ background: 'var(--bg-card)', border: '1px solid var(--border-card)', maxHeight: '85vh' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: 'var(--divider)' }}>
          <div>
            <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Recurring Items</h3>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>Tap name or amount to edit · tick means it will be applied</p>
          </div>
          <button onClick={onClose} style={{ color: 'var(--text-muted)' }}>✕</button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {loading ? (
            <p className="text-sm text-center py-4" style={{ color: 'var(--text-muted)' }}>Loading…</p>
          ) : (
            CATS.map(cat => {
              const clr = CLRS[cat];
              return (
                <div key={cat}>
                  <p className="text-xs font-semibold uppercase tracking-wider mb-2 capitalize" style={{ color: clr.color }}>
                    {cat}
                  </p>
                  {grouped[cat].length === 0 ? (
                    <p className="text-xs" style={{ color: 'var(--text-faint)' }}>No items added yet</p>
                  ) : (
                    <div className="divide-y" style={{ borderColor: 'var(--divider)' }}>
                      {grouped[cat].map(t => (
                        <TemplateRow
                          key={t._id}
                          t={t}
                          clr={clr}
                          onToggleActive={handleToggleActive}
                          onSave={handleSave}
                          onDelete={handleDelete}
                        />
                      ))}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Add new template */}
        <div className="px-5 pb-5 pt-4 border-t" style={{ borderColor: 'var(--divider)' }}>
          <p className="text-xs font-medium mb-2" style={{ color: 'var(--text-muted)' }}>Add a new recurring item</p>
          <form onSubmit={handleAdd} className="space-y-2">
            <select
              value={form.category}
              onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
              className="w-full px-3 py-2 rounded-lg text-sm outline-none capitalize"
              style={inputStyle}
            >
              {CATS.map(c => <option key={c} value={c} style={{ background: 'var(--bg-input)' }} className="capitalize">{c}</option>)}
            </select>
            <input
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="Name (e.g. RD, SIP, Netflix)"
              className="w-full px-3 py-2 rounded-lg text-sm outline-none"
              style={inputStyle}
            />
            <div className="flex gap-2">
              <input
                type="text"
                inputMode="decimal"
                value={form.amount}
                onChange={e => setForm(f => ({ ...f, amount: e.target.value.replace(/[^0-9.]/g, '') }))}
                placeholder="Monthly amount"
                className="min-w-0 px-3 py-2 rounded-lg text-sm outline-none"
                style={{ ...inputStyle, flex: '1 1 0' }}
              />
              <button
                type="submit"
                disabled={adding || !form.name.trim() || !form.amount}
                className="py-2 rounded-lg text-sm font-medium disabled:opacity-40 whitespace-nowrap"
                style={{ background: '#2563eb', color: '#fff', flex: '0 0 72px' }}
              >
                {adding ? '…' : '+ Add'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
