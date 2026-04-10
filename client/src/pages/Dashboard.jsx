import { useAuth } from '../context/AuthContext';

export default function Dashboard() {
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen p-8" style={{ background: '#080d1c' }}>
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-semibold" style={{ color: '#f0f4ff' }}>Dashboard</h1>
            <p className="text-sm mt-0.5" style={{ color: '#4a6090' }}>Welcome back, {user?.name}</p>
          </div>
          <button
            onClick={logout}
            className="px-4 py-2 rounded-xl text-sm font-medium transition-all"
            style={{ background: 'rgba(99,130,220,0.08)', border: '1px solid rgba(99,130,220,0.15)', color: '#c8d6f0' }}
          >
            Sign out
          </button>
        </div>

        {/* Placeholder content */}
        <div
          className="rounded-2xl p-12 text-center"
          style={{ background: '#111827', border: '1px solid rgba(99,130,220,0.12)' }}
        >
          <svg className="w-12 h-12 mx-auto mb-4 opacity-30" fill="none" viewBox="0 0 24 24" stroke="#4f8ef7" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 11h.01M12 11h.01M15 11h.01M4 19h16a2 2 0 002-2V7a2 2 0 00-2-2H4a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
          <p className="text-sm" style={{ color: '#4a6090' }}>
            Upload a bank statement to get started
          </p>
        </div>
      </div>
    </div>
  );
}
