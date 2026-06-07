import { Outlet, NavLink, useNavigate } from 'react-router-dom'

const NAV = [
  { to: '/admin/dashboard', label: '📊 Dashboard' },
  { to: '/admin/attendees', label: '👥 Attendees' },
  { to: '/admin/import',    label: '📥 Import' },
  { to: '/admin/food',      label: '🍽️ Food' },
  { to: '/admin/results',   label: '🏆 Results' },
  { to: '/admin/qrcodes',   label: '📷 QR Codes' },
  { to: '/admin/config',    label: '⚙️ Config' },
]

export default function AdminLayout() {
  const nav = useNavigate()

  function logout() {
    sessionStorage.removeItem('badminton_admin')
    nav('/admin', { replace: true })
  }

  return (
    <div className="min-h-dvh bg-dark-bg flex flex-col">
      {/* Top bar */}
      <header className="bg-dark-card border-b border-dark-border px-4 py-3 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-2">
          <span className="text-xl">🏸</span>
          <span className="font-black text-lg">SMASH Admin</span>
        </div>
        <button onClick={logout} className="text-xs text-gray-500 hover:text-white border border-dark-border rounded-lg px-3 py-1.5">
          Logout
        </button>
      </header>

      {/* Mobile nav (horizontal scroll) */}
      <nav className="bg-dark-card border-b border-dark-border overflow-x-auto">
        <div className="flex min-w-max">
          {NAV.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `px-4 py-3 text-sm font-semibold whitespace-nowrap border-b-2 transition-colors ${
                  isActive
                    ? 'text-court border-court'
                    : 'text-gray-400 border-transparent hover:text-white'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </div>
      </nav>

      {/* Page content */}
      <main className="flex-1 p-4 max-w-4xl mx-auto w-full">
        <Outlet />
      </main>
    </div>
  )
}
