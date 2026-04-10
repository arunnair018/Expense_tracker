import { useState, useEffect } from 'react';
import api from '../services/api';
import { useToast, getErrorMessage } from '../context/ToastContext';

const fmt   = (n) => Number(n).toLocaleString('en-IN');
const CATS  = ['savings', 'investments', 'subscriptions'];
const CLRS  = {
  savings:       { color: '#378ADD', bg: 'rgba(55,138,221,0.12)'  },
  investments:   { color: '#378ADD', bg: 'rgba(55,138,221,0.12)'  },
  subscriptions: { color: '#BA7517', bg: 'rgba(186,117,23,0.12)' },
};

const inputStyle = {
  background: '#0d1529',
  border: '1px solid rgba(99,130,220,0.2)',
  color: '#f0f4ff',
};

export default function TemplateManager({ onClose }) {
  const { showToast } = useToast();
  const [templates, setTemplates] = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [adding,    setAdding]    = useState(false);
  const [form,      setForm]      = useState({ name: '', amount: '', category: 'savings' });
  const [savingId,  setSavingId]  = useState(null);
  const [editId,    setEditId]    = useState(null);
  const [editForm,  setEditForm]  = useState({});

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
      setForm({ name: '', amount: '', category: form.category });
    } catch (err) {
      showToast(getErrorMessage(err));
    } finally {
      setAdding(false);
    }
  };

  const handleToggleActive = async (t) => {
    setSavingId(t._id);
    try {
      const { data } = await api.put(`/templates/${t._id}`, { isActive: !t.isActive });
      setTemplates(prev => prev.map(x => x._id === data._id ? data : x));
    } catch (err) {
      showToast(getErrorMessage(err));
    } finally {
      setSavingId(null);
    }
  };

  const handleDelete = async (id) => {
    setSavingId(id);
    try {
      await api.delete(`/templates/${id}`);
      setTemplates(prev => prev.filter(x => x._id !== id));
    } catch (err) {
      showToast(getErrorMessage(err));
    } finally {
      setSavingId(null);
    }
  };

  const startEdit = (t) => {
    setEditId(t._id);
    setEditForm({ name: t.name, amount: t.amount, category: t.category });
  };

  const handleEditSave = async (id) => {
    setSavingId(id);
    try {
      const { data } = await api.put(`/templates/${id}`, {
        name: editForm.name.trim(),
        amount: parseFloat(editForm.amount),
        category: editForm.category,
      });
      setTemplates(prev => prev.map(x => x._id === data._id ? data : x));
      setEditId(null);
    } catch (err) {
      showToast(getErrorMessage(err));
    } finally {
      setSavingId(null);
    }
  };

  const grouped = CATS.reduce((acc, cat) => {
    acc[cat] = templates.filter(t => t.category === cat);
    return acc;
  }, {});

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(8,13,28,0.85)', backdropFilter: 'blur(4px)' }}
    >
      <div
        className="w-full max-w-lg rounded-2xl flex flex-col"
        style={{ background: '#111827', border: '1px solid rgba(99,130,220,0.15)', maxHeight: '85vh' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: 'rgba(99,130,220,0.1)' }}>
          <h3 className="text-sm font-semibold" style={{ color: '#f0f4ff' }}>Recurring Templates</h3>
          <button onClick={onClose} style={{ color: '#4a6090' }}>✕</button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {loading ? (
            <p className="text-sm text-center py-4" style={{ color: '#4a6090' }}>Loading…</p>
          ) : (
            CATS.map(cat => {
              const clr = CLRS[cat];
              return (
                <div key={cat}>
                  <p className="text-xs font-semibold uppercase tracking-wider mb-2 capitalize" style={{ color: clr.color }}>
                    {cat}
                  </p>
                  {grouped[cat].length === 0 ? (
                    <p className="text-xs" style={{ color: '#3a4d70' }}>No templates yet</p>
                  ) : (
                    <div className="space-y-1">
                      {grouped[cat].map(t => {
                        const isEditing = editId === t._id;
                        const isSaving  = savingId === t._id;
                        if (isEditing) {
                          return (
                            <div key={t._id} className="flex items-center gap-2">
                              <input
                                autoFocus
                                value={editForm.name}
                                onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
                                className="flex-1 px-2.5 py-1 rounded-lg text-sm outline-none"
                                style={inputStyle}
                              />
                              <input
                                type="number"
                                value={editForm.amount}
                                onChange={e => setEditForm(f => ({ ...f, amount: e.target.value }))}
                                className="w-24 px-2.5 py-1 rounded-lg text-sm text-right outline-none"
                                style={inputStyle}
                              />
                              <button
                                onClick={() => handleEditSave(t._id)}
                                disabled={isSaving}
                                className="px-2.5 py-1 rounded-lg text-xs font-medium"
                                style={{ background: '#2563eb', color: '#fff' }}
                              >
                                {isSaving ? '…' : '✓'}
                              </button>
                              <button onClick={() => setEditId(null)} className="text-xs" style={{ color: '#4a6090' }}>✕</button>
                            </div>
                          );
                        }
                        return (
                          <div key={t._id} className="group flex items-center gap-2 py-1">
                            {/* Active toggle */}
                            <button
                              onClick={() => handleToggleActive(t)}
                              disabled={isSaving}
                              className="w-4 h-4 rounded shrink-0 flex items-center justify-center"
                              style={{
                                background: t.isActive ? clr.bg : 'transparent',
                                border: `1.5px solid ${t.isActive ? clr.color : 'rgba(99,130,220,0.25)'}`,
                              }}
                            >
                              {t.isActive && (
                                <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke={clr.color} strokeWidth={3}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                </svg>
                              )}
                            </button>
                            <span className="flex-1 text-sm" style={{ color: t.isActive ? '#c8d6f0' : '#4a6090' }}>
                              {t.name}
                            </span>
                            <span className="text-sm tabular-nums" style={{ color: t.isActive ? '#f0f4ff' : '#4a6090' }}>
                              ₹ {fmt(t.amount)}
                            </span>
                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button onClick={() => startEdit(t)} className="p-0.5" style={{ color: '#4a6090' }}>
                                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536M9 13l6.586-6.586a2 2 0 112.828 2.828L11.828 15.828a4 4 0 01-1.414.828l-3 1 1-3a4 4 0 01.828-1.414z" />
                                </svg>
                              </button>
                              <button onClick={() => handleDelete(t._id)} disabled={isSaving} className="p-0.5" style={{ color: '#4a6090' }}>
                                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Add new template */}
        <div className="px-5 pb-5 border-t pt-4" style={{ borderColor: 'rgba(99,130,220,0.1)' }}>
          <p className="text-xs font-medium mb-2" style={{ color: '#4a6090' }}>Add template</p>
          <form onSubmit={handleAdd} className="flex items-center gap-2">
            <select
              value={form.category}
              onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
              className="px-2 py-1.5 rounded-lg text-xs outline-none"
              style={inputStyle}
            >
              {CATS.map(c => <option key={c} value={c} className="bg-[#0d1529] capitalize">{c}</option>)}
            </select>
            <input
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="Name"
              className="flex-1 px-2.5 py-1.5 rounded-lg text-sm outline-none"
              style={inputStyle}
            />
            <input
              type="number"
              value={form.amount}
              onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
              placeholder="Amount"
              className="w-24 px-2.5 py-1.5 rounded-lg text-sm text-right outline-none"
              style={inputStyle}
              min="0" step="0.01"
            />
            <button
              type="submit"
              disabled={adding || !form.name.trim() || !form.amount}
              className="px-3 py-1.5 rounded-lg text-sm font-medium disabled:opacity-40"
              style={{ background: '#2563eb', color: '#fff' }}
            >
              {adding ? '…' : '+ Add'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
