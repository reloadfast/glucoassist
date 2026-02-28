import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

vi.mock('@/components/ThemeProvider', () => ({
  useTheme: () => ({ theme: 'system', resolvedTheme: 'light', setTheme: vi.fn() }),
}))

vi.mock('@/hooks/useModelRegistry', () => ({
  useModelRegistry: () => ({
    meta: null,
    registry: null,
    retrainLog: null,
    loading: true,
    refresh: vi.fn(),
  }),
}))

vi.mock('@/lib/api', () => ({
  postRetrain: vi.fn(),
  getGarminStatus: () =>
    Promise.resolve({ enabled: true, username_configured: true, interval_seconds: 3600 }),
  getGarminIngestLog: () =>
    Promise.resolve({
      entries: [
        {
          id: 1,
          run_at: '2026-01-01T08:00:00Z',
          target_date: '2026-01-01',
          outcome: 'success',
          fields_populated: 'rhr,weight,sleep,stress',
          error_detail: null,
          retry_count: 0,
          created_at: '2026-01-01T08:00:00Z',
        },
        {
          id: 2,
          run_at: '2026-01-02T08:00:00Z',
          target_date: '2026-01-02',
          outcome: 'partial',
          fields_populated: 'rhr',
          error_detail: null,
          retry_count: 0,
          created_at: '2026-01-02T08:00:00Z',
        },
        {
          id: 3,
          run_at: '2026-01-03T08:00:00Z',
          target_date: '2026-01-03',
          outcome: 'auth_error',
          fields_populated: null,
          error_detail: 'bad credentials',
          retry_count: 0,
          created_at: '2026-01-03T08:00:00Z',
        },
      ],
      count: 3,
    }),
  getAppVersion: () => Promise.resolve({ status: 'ok', version: '0.2.0', environment: 'test' }),
}))

import Settings from '@/pages/Settings'

describe('Settings', () => {
  it('renders heading', () => {
    render(<Settings />)
    expect(screen.getByText('Settings')).toBeInTheDocument()
  })

  it('renders forecast model card', () => {
    render(<Settings />)
    expect(screen.getByText('Forecast Model')).toBeInTheDocument()
  })

  it('renders retrain log card', () => {
    render(<Settings />)
    expect(screen.getByText('Retrain Log')).toBeInTheDocument()
  })

  it('renders Garmin Integration card', () => {
    render(<Settings />)
    expect(screen.getByText('Garmin Integration')).toBeInTheDocument()
  })

  it('renders show recent ingest runs trigger', () => {
    render(<Settings />)
    expect(screen.getByRole('button', { name: /show recent ingest runs/i })).toBeInTheDocument()
  })

  it('expands ingest log table on click', async () => {
    const user = userEvent.setup()
    render(<Settings />)
    await user.click(screen.getByRole('button', { name: /show recent ingest runs/i }))
    expect(screen.getByText('Recent ingest runs')).toBeInTheDocument()
  })

  it('shows outcome badges after expanding', async () => {
    const user = userEvent.setup()
    render(<Settings />)
    await user.click(screen.getByRole('button', { name: /show recent ingest runs/i }))
    await waitFor(() => {
      expect(screen.getByText('success')).toBeInTheDocument()
      expect(screen.getByText('partial')).toBeInTheDocument()
      expect(screen.getByText('auth error')).toBeInTheDocument()
    })
  })

  it('renders hide button after expanding', async () => {
    const user = userEvent.setup()
    render(<Settings />)
    await user.click(screen.getByRole('button', { name: /show recent ingest runs/i }))
    expect(screen.getByRole('button', { name: /hide/i })).toBeInTheDocument()
  })
})
