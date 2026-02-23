import { NavLink, Outlet } from 'react-router-dom'

const navItems = [
  { to: '/', label: 'Dashboard' },
  { to: '/statistics', label: 'Statistics' },
  { to: '/patterns', label: 'Patterns' },
  { to: '/intelligence', label: 'Intelligence' },
  { to: '/settings', label: 'Settings' },
]

export default function AppLayout() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="mx-auto max-w-7xl flex items-center gap-6 px-6 py-3">
          <span className="text-lg font-bold tracking-tight">GlucoSense</span>
          <nav className="flex gap-4">
            {navItems.map(({ to, label }) => (
              <NavLink
                key={to}
                to={to}
                end={to === '/'}
                className={({ isActive }) =>
                  `text-sm font-medium transition-colors ${
                    isActive ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'
                  }`
                }
              >
                {label}
              </NavLink>
            ))}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-7xl p-6">
        <Outlet />
      </main>
    </div>
  )
}
