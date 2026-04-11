import { useTheme } from '../context/ThemeContext';
import { useAuth }  from '../context/AuthContext';

const getInitials = (name) => {
  if (!name) return '?';
  return name.trim().split(/\s+/).map(w => w[0]).join('').toUpperCase().slice(0, 2);
};

function MenuItem({ icon, label, sublabel, onClick, danger, color }) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-4 px-5 py-4 text-left transition-colors"
      style={{ borderBottom: '1px solid var(--divider)' }}
      onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
    >
      <span
        className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0"
        style={{ background: color?.bg ?? 'var(--bg-hover)', border: `1px solid ${color?.border ?? 'var(--border-card)'}` }}
      >
        {icon}
      </span>
      <span className="flex-1 min-w-0">
        <p className="text-sm font-semibold" style={{ color: danger ? 'var(--clr-expense)' : 'var(--text-primary)' }}>
          {label}
        </p>
        {sublabel && (
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{sublabel}</p>
        )}
      </span>
      <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} style={{ color: 'var(--text-faint)' }}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
      </svg>
    </button>
  );
}

export default function Sidebar({ user, onSalary, onTemplates, onImport, onClose }) {
  const { isDark, toggleTheme } = useTheme();
  const { logout } = useAuth();

  const clrSalary = { bg: 'rgba(29,158,117,0.1)', border: 'rgba(29,158,117,0.25)' };
  const clrTmpl   = { bg: 'rgba(55,138,221,0.1)', border: 'rgba(55,138,221,0.25)' };
  const clrImport = { bg: 'rgba(155,110,204,0.1)', border: 'rgba(155,110,204,0.25)' };
  const clrTheme  = { bg: 'rgba(186,117,23,0.1)', border: 'rgba(186,117,23,0.25)' };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40"
        style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(2px)' }}
        onClick={onClose}
      />

      {/* Drawer */}
      <div
        className="sidebar-panel fixed left-0 top-0 bottom-0 z-50 flex flex-col"
        style={{
          width: '300px',
          background: 'var(--bg-card)',
          borderRight: '1px solid var(--border-card)',
          boxShadow: '4px 0 24px rgba(0,0,0,0.35)',
        }}
      >
        {/* User header */}
        <div className="px-5 pt-8 pb-6" style={{ borderBottom: '1px solid var(--divider)' }}>
          <div
            className="w-14 h-14 rounded-full flex items-center justify-center text-base font-bold mb-3"
            style={{ background: 'rgba(37,99,235,0.18)', border: '2px solid rgba(37,99,235,0.35)', color: '#4f8ef7' }}
          >
            {getInitials(user?.name)}
          </div>
          <p className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>{user?.name ?? 'User'}</p>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>{user?.email ?? ''}</p>
        </div>

        {/* Menu */}
        <div className="flex-1 overflow-y-auto py-2">
          <MenuItem
            icon={
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} style={{ color: 'var(--clr-credit)' }}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            }
            label="My Salary"
            sublabel="Update your monthly income"
            onClick={() => { onSalary(); onClose(); }}
            color={clrSalary}
          />

          <MenuItem
            icon={
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} style={{ color: 'var(--clr-savings)' }}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            }
            label="Recurring Items"
            sublabel="Manage savings, investments & subscriptions"
            onClick={() => { onTemplates(); onClose(); }}
            color={clrTmpl}
          />

          <MenuItem
            icon={
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} style={{ color: 'var(--clr-planned)' }}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
            }
            label="Import Bank Statement"
            sublabel="Import expenses from Google Pay PDF"
            onClick={() => { onImport(); onClose(); }}
            color={clrImport}
          />

          <MenuItem
            icon={
              isDark
                ? <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} style={{ color: '#BA7517' }}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707M17.657 17.657l-.707-.707M6.343 6.343l-.707-.707M12 5a7 7 0 100 14A7 7 0 0012 5z" />
                  </svg>
                : <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} style={{ color: '#BA7517' }}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                  </svg>
            }
            label={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            sublabel={isDark ? 'Easier on the eyes outdoors' : 'Easier on the eyes at night'}
            onClick={toggleTheme}
            color={clrTheme}
          />
        </div>

        {/* Sign out — pinned to bottom */}
        <div style={{ borderTop: '1px solid var(--divider)' }}>
          <MenuItem
            icon={
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} style={{ color: 'var(--clr-expense)' }}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            }
            label="Sign Out"
            sublabel="Log out of your account"
            onClick={logout}
            danger
          />
        </div>
      </div>
    </>
  );
}
