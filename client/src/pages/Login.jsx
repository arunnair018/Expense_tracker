import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const navigate = useNavigate();
  const { login, register } = useAuth();

  const [mode, setMode] = useState('login'); // 'login' | 'register'
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const isRegister = mode === 'register';

  const handleChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (isRegister) {
        await register(form.name, form.email, form.password);
      } else {
        await login(form.email, form.password);
      }
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const toggleMode = () => {
    setMode((m) => (m === 'login' ? 'register' : 'login'));
    setForm({ name: '', email: '', password: '' });
    setError('');
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: '#080d1c' }}>
      {/* Background glow */}
      <div
        className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 rounded-full opacity-10 blur-3xl pointer-events-none"
        style={{ background: 'radial-gradient(circle, #2563eb, transparent)' }}
      />

      <div className="relative w-full max-w-md">
        {/* Logo / heading */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-4" style={{ background: 'rgba(37,99,235,0.15)', border: '1px solid rgba(79,142,247,0.3)' }}>
            <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="#4f8ef7" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 11h.01M12 11h.01M15 11h.01M4 19h16a2 2 0 002-2V7a2 2 0 00-2-2H4a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight" style={{ color: '#f0f4ff' }}>
            Bank Statement Tally
          </h1>
          <p className="mt-1 text-sm" style={{ color: '#4a6090' }}>
            {isRegister ? 'Create your account' : 'Sign in to your account'}
          </p>
        </div>

        {/* Card */}
        <div
          className="rounded-2xl p-8"
          style={{ background: '#111827', border: '1px solid rgba(99,130,220,0.12)' }}
        >
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Name field (register only) */}
            {isRegister && (
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: '#c8d6f0' }}>
                  Full name
                </label>
                <input
                  type="text"
                  name="name"
                  value={form.name}
                  onChange={handleChange}
                  placeholder="Jane Doe"
                  required
                  className="w-full px-4 py-2.5 rounded-xl text-sm outline-none transition-all"
                  style={{
                    background: '#0d1529',
                    border: '1px solid rgba(99,130,220,0.2)',
                    color: '#f0f4ff',
                  }}
                  onFocus={(e) => (e.target.style.borderColor = 'rgba(79,142,247,0.6)')}
                  onBlur={(e) => (e.target.style.borderColor = 'rgba(99,130,220,0.2)')}
                />
              </div>
            )}

            {/* Email */}
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: '#c8d6f0' }}>
                Email
              </label>
              <input
                type="email"
                name="email"
                value={form.email}
                onChange={handleChange}
                placeholder="you@example.com"
                required
                className="w-full px-4 py-2.5 rounded-xl text-sm outline-none transition-all"
                style={{
                  background: '#0d1529',
                  border: '1px solid rgba(99,130,220,0.2)',
                  color: '#f0f4ff',
                }}
                onFocus={(e) => (e.target.style.borderColor = 'rgba(79,142,247,0.6)')}
                onBlur={(e) => (e.target.style.borderColor = 'rgba(99,130,220,0.2)')}
              />
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: '#c8d6f0' }}>
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  value={form.password}
                  onChange={handleChange}
                  placeholder={isRegister ? 'Min 6 characters' : '••••••••'}
                  required
                  minLength={6}
                  className="w-full px-4 py-2.5 pr-11 rounded-xl text-sm outline-none transition-all"
                  style={{
                    background: '#0d1529',
                    border: '1px solid rgba(99,130,220,0.2)',
                    color: '#f0f4ff',
                  }}
                  onFocus={(e) => (e.target.style.borderColor = 'rgba(79,142,247,0.6)')}
                  onBlur={(e) => (e.target.style.borderColor = 'rgba(99,130,220,0.2)')}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5"
                  style={{ color: '#4a6090' }}
                >
                  {showPassword ? (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {/* Error message */}
            {error && (
              <div
                className="px-4 py-3 rounded-xl text-sm"
                style={{ background: 'rgba(216,90,48,0.1)', border: '1px solid rgba(216,90,48,0.25)', color: '#f87171' }}
              >
                {error}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-xl text-sm font-semibold transition-all disabled:opacity-60 disabled:cursor-not-allowed"
              style={{ background: '#2563eb', color: '#fff' }}
              onMouseEnter={(e) => !loading && (e.target.style.background = '#1d4ed8')}
              onMouseLeave={(e) => (e.target.style.background = '#2563eb')}
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  {isRegister ? 'Creating account…' : 'Signing in…'}
                </span>
              ) : (
                isRegister ? 'Create account' : 'Sign in'
              )}
            </button>
          </form>
        </div>

        {/* Toggle login / register */}
        <p className="text-center mt-5 text-sm" style={{ color: '#4a6090' }}>
          {isRegister ? 'Already have an account?' : "Don't have an account?"}{' '}
          <button
            onClick={toggleMode}
            className="font-medium transition-colors"
            style={{ color: '#4f8ef7' }}
            onMouseEnter={(e) => (e.target.style.color = '#93c5fd')}
            onMouseLeave={(e) => (e.target.style.color = '#4f8ef7')}
          >
            {isRegister ? 'Sign in' : 'Create one'}
          </button>
        </p>
      </div>
    </div>
  );
}
