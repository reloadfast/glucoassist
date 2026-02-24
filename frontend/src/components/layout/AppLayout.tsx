import { Menu, Moon, Sun, X } from 'lucide-react'
import { useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { useTheme } from '@/components/ThemeProvider'

const navItems = [
  { to: '/', label: 'Dashboard' },
  { to: '/statistics', label: 'Statistics' },
  { to: '/patterns', label: 'Patterns' },
  { to: '/intelligence', label: 'Intelligence' },
  { to: '/logs', label: 'Logs' },
  { to: '/settings', label: 'Settings' },
]

function navLinkClass({ isActive }: { isActive: boolean }) {
  return `text-sm font-medium transition-colors ${
    isActive ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'
  }`
}

export default function AppLayout() {
  const { theme, toggle } = useTheme()
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="mx-auto max-w-7xl flex items-center gap-6 px-6 py-3">
          <span className="text-lg font-bold tracking-tight">GlucoSense</span>
          <nav aria-label="Main navigation" className="hidden md:flex gap-4 flex-1">
            {navItems.map(({ to, label }) => (
              <NavLink key={to} to={to} end={to === '/'} className={navLinkClass}>
                {label}
              </NavLink>
            ))}
          </nav>
          <div className="flex items-center gap-2 ml-auto md:ml-0">
            <Button
              variant="ghost"
              size="icon"
              onClick={toggle}
              aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden"
              aria-label="Open navigation menu"
              aria-expanded={mobileOpen}
              onClick={() => setMobileOpen((o) => !o)}
            >
              {mobileOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </Button>
          </div>
        </div>
        {mobileOpen && (
          <nav aria-label="Main navigation" className="md:hidden border-t px-6 py-2 flex flex-col gap-1">
            {navItems.map(({ to, label }) => (
              <NavLink
                key={to}
                to={to}
                end={to === '/'}
                className={({ isActive }) =>
                  `py-2 text-sm font-medium transition-colors ${
                    isActive ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'
                  }`
                }
                onClick={() => setMobileOpen(false)}
              >
                {label}
              </NavLink>
            ))}
          </nav>
        )}
      </header>
      <main className="mx-auto max-w-7xl p-6">
        <Outlet />
      </main>
    </div>
  )
}
