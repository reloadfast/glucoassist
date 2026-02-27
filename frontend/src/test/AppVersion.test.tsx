import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

// ─── mock useAppVersion ──────────────────────────────────────────────────────

vi.mock('@/hooks/useAppVersion', () => ({
  useAppVersion: () => '0.2.0',
}))

vi.mock('@/hooks/useTheme', () => ({
  useTheme: () => ({ theme: 'light', toggle: vi.fn() }),
}))

// AppLayout uses react-router — mock Outlet and NavLink
vi.mock('react-router-dom', () => ({
  NavLink: ({ children, to }: { children: React.ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
  Outlet: () => <div data-testid="outlet" />,
}))

vi.mock('@/components/ThemeProvider', () => ({
  useTheme: () => ({ theme: 'light', toggle: vi.fn() }),
}))

vi.mock('@/hooks/useModelRegistry', () => ({
  useModelRegistry: () => ({
    meta: { last_trained: null, training_samples: null, mae_per_horizon: null },
    retrainLog: null,
    loading: false,
    refresh: vi.fn(),
  }),
}))

vi.mock('@/lib/api', () => ({
  getGarminStatus: () =>
    Promise.resolve({ enabled: false, username_configured: false, interval_seconds: 3600 }),
  postRetrain: vi.fn(),
}))

// ─── imports (after mocks) ───────────────────────────────────────────────────

import AppLayout from '@/components/layout/AppLayout'
import Settings from '@/pages/Settings'

// ─── VersionChip in AppLayout ────────────────────────────────────────────────

describe('VersionChip in AppLayout', () => {
  it('shows the version string', () => {
    render(<AppLayout />)
    expect(screen.getByText('v0.2.0')).toBeInTheDocument()
  })

  it('has accessible aria-label', () => {
    render(<AppLayout />)
    expect(screen.getByRole('button', { name: /app version v0\.2\.0/i })).toBeInTheDocument()
  })

  it('copies version on click', async () => {
    // userEvent.setup() installs its own navigator.clipboard — apply our spy after it
    const user = userEvent.setup()
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    })
    render(<AppLayout />)
    await user.click(screen.getByRole('button', { name: /app version/i }))
    await waitFor(() => expect(writeText).toHaveBeenCalledWith('v0.2.0'))
  })

  it('shows ✓ after copy', async () => {
    const user = userEvent.setup()
    render(<AppLayout />)
    await user.click(screen.getByRole('button', { name: /app version/i }))
    await waitFor(() => expect(screen.getByText('✓')).toBeInTheDocument())
  })
})

// ─── System section in Settings ──────────────────────────────────────────────

describe('System section in Settings', () => {
  it('renders System card heading', () => {
    render(<Settings />)
    expect(screen.getByText('System')).toBeInTheDocument()
  })

  it('shows version string', () => {
    render(<Settings />)
    expect(screen.getByText('v0.2.0')).toBeInTheDocument()
  })
})
