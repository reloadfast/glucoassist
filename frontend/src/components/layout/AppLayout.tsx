import { Moon, Sun } from 'lucide-react'
import { NavLink, Outlet } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { useTheme } from '@/components/ThemeProvider'

const navItems = [
  { to: '/', label: 'Dashboard' },
  { to: '/statistics', label: 'Statistics' },
  { to: '/patterns', label: 'Patterns' },
  { to: '/intelligence', label: 'Intelligence' },
  { to: '/settings', label: 'Settings' },
]

export default function AppLayout() {
  const { theme, toggle } = useTheme()

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="mx-auto max-w-7xl flex items-center gap-6 px-6 py-3">
          <span className="text-lg font-bold tracking-tight">GlucoSense</span>
          <nav className="flex gap-4 flex-1">
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
          <Button
            variant="ghost"
            size="icon"
            onClick={toggle}
            aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
        </div>
      </header>
      <main className="mx-auto max-w-7xl p-6">
        <Outlet />
      </main>
    </div>
  )
}
