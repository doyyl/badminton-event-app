import { Outlet, NavLink, useNavigate } from 'react-router-dom'

const NAV = [
  { to: '/admin/dashboard', label: 'Attendees' },
  { to: '/admin/food',      label: 'Food' },
  { to: '/admin/results',   label: 'Results' },
  { to: '/admin/config',    label: 'Config' },
]

const NAV_SECONDARY = [
  { to: '/admin/import',   label: '📥 Import' },
  { to: '/admin/qrcodes',  label: '📷 QR Codes' },
]

export default function AdminLayout() {
  const nav = useNavigate()

  function logout() {
    sessionStorage.removeItem('badminton_admin')
    nav('/admin', { replace: true })
  }

  return (
    <div className="min-h-dvh bg-gray-50 flex flex-col">
      {/* Top bar */}
      <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-2">
          <button onClick={() => nav('/')} className="text-gray-400 text-sm">←</button>
          <span className="font-black text-gray-900">Staff admin</span>
        </div>
        <button onClick={logout} className="text-gray-400 hover:text-gray-700 text-sm">
          ↪ Logout
        </button>
      </header>

      {/* Tab nav */}
      <nav className="bg-white border-b border-gray-200 overflow-x-auto">
        <div className="flex min-w-max px-2">
          {NAV.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `px-4 py-3 text-sm font-semibold whitespace-nowrap border-b-2 transition-colors ${
                  isActive
                    ? 'text-primary border-primary'
                    : 'text-gray-400 border-transparent hover:text-gray-700'
                }`
              }
            >
              {item.label.toUpperCase()}
            </NavLink>
          ))}
          <div className="w-px bg-gray-200 my-2 mx-1" />
          {NAV_SECONDARY.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `px-4 py-3 text-sm font-semibold whitespace-nowrap border-b-2 transition-colors ${
                  isActive
                    ? 'text-primary border-primary'
                    : 'text-gray-400 border-transparent hover:text-gray-700'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
          {/* Full-screen bracket board — opens in a new tab for projecting at the event */}
          <a
            href="/bracket"
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-3 text-sm font-semibold whitespace-nowrap border-b-2 border-transparent text-gray-400 hover:text-gray-700"
          >
            🐟 Bracket ↗
          </a>
        </div>
      </nav>

      <main className="flex-1 p-4 max-w-3xl mx-auto w-full">
        <Outlet />
      </main>
    </div>
  )
}
