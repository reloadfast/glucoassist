import { Menu, Monitor, Moon, Sun, X } from 'lucide-react'
import { useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { useTheme, type ThemeMode } from '@/components/ThemeProvider'
import { useAppVersion } from '@/hooks/useAppVersion'

const navItems = [
  { to: '/', label: 'Dashboard' },
  { to: '/statistics', label: 'Statistics' },
  { to: '/patterns', label: 'Patterns' },
  { to: '/intelligence', label: 'Intelligence' },
  { to: '/basal', label: 'Basal' },
  { to: '/food', label: 'Food' },
  { to: '/logs', label: 'Logs' },
  { to: '/research', label: 'Research' },
  { to: '/settings', label: 'Settings' },
]

function navLinkClass({ isActive }: { isActive: boolean }) {
  return `text-sm font-medium transition-colors ${
    isActive ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'
  }`
}

function VersionChip({ version }: { version: string }) {
  const [copied, setCopied] = useState(false)

  function handleCopy() {
    const text = `v${version}`
    if (navigator.clipboard) {
      void navigator.clipboard.writeText(text).then(() => {
        setCopied(true)
        setTimeout(() => setCopied(false), 1500)
      })
    } else {
      // Fallback for non-HTTPS (self-hosted HTTP)
      const ta = document.createElement('textarea')
      ta.value = text
      ta.style.cssText = 'position:fixed;opacity:0'
      document.body.appendChild(ta)
      ta.focus()
      ta.select()
      try {
        document.execCommand('copy')
      } finally {
        document.body.removeChild(ta)
      }
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    }
  }

  return (
    <button
      onClick={handleCopy}
      aria-label={`App version v${version} — click to copy`}
      className="text-xs text-muted-foreground font-mono hover:text-foreground transition-colors flex items-center gap-0.5 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1 rounded-sm"
    >
      {copied ? <span className="text-green-500">✓</span> : `v${version}`}
    </button>
  )
}

const THEME_CYCLE: ThemeMode[] = ['system', 'light', 'dark']

const THEME_LABELS: Record<ThemeMode, string> = {
  system: 'Theme: System — click for Light',
  light: 'Theme: Light — click for Dark',
  dark: 'Theme: Dark — click for System',
}

export default function AppLayout() {
  const { theme, setTheme } = useTheme()
  const [mobileOpen, setMobileOpen] = useState(false)
  const version = useAppVersion()

  function cycleTheme() {
    const next = THEME_CYCLE[(THEME_CYCLE.indexOf(theme) + 1) % THEME_CYCLE.length]
    setTheme(next)
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="mx-auto max-w-7xl flex items-center gap-6 px-6 py-3">
          <span className="text-lg font-bold tracking-tight">GlucoAssist</span>
          <nav aria-label="Main navigation" className="hidden md:flex gap-4 flex-1">
            {navItems.map(({ to, label }) => (
              <NavLink key={to} to={to} end={to === '/'} className={navLinkClass}>
                {label}
              </NavLink>
            ))}
          </nav>
          <div className="flex items-center gap-2 ml-auto md:ml-0">
            <VersionChip version={version} />
            <Button
              variant="ghost"
              size="icon"
              onClick={cycleTheme}
              aria-label={THEME_LABELS[theme]}
            >
              {theme === 'system' ? (
                <Monitor className="h-4 w-4" />
              ) : theme === 'dark' ? (
                <Sun className="h-4 w-4" />
              ) : (
                <Moon className="h-4 w-4" />
              )}
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
          <nav
            aria-label="Main navigation"
            className="md:hidden border-t px-6 py-2 flex flex-col gap-1"
          >
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
