/**
 * Tests for the Garmin ingest audit log UI:
 * - Settings page: collapsible ingest run table with outcome badges
 * - Logs page: outcome indicator on Garmin health entries
 */
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

// ─── Shared hook mocks ────────────────────────────────────────────────────────

vi.mock('@/hooks/useModelRegistry', () => ({
  useModelRegistry: () => ({
    meta: null,
    retrainLog: null,
    loading: false,
    refresh: vi.fn(),
  }),
}))

vi.mock('@/hooks/useGlucoseData', () => ({
  useGlucoseData: () => ({
    summary: null,
    readings: [],
    loading: false,
    error: null,
    refresh: vi.fn(),
  }),
}))

const mockIngestLog = [
  {
    id: 1,
    run_at: '2026-01-10T08:00:00Z',
    target_date: '2026-01-10',
    outcome: 'success',
    fields_populated: 'rhr,weight,sleep,stress',
    error_detail: null,
    retry_count: 0,
    created_at: '2026-01-10T08:00:00Z',
  },
  {
    id: 2,
    run_at: '2026-01-11T08:00:00Z',
    target_date: '2026-01-11',
    outcome: 'partial',
    fields_populated: 'rhr',
    error_detail: null,
    retry_count: 0,
    created_at: '2026-01-11T08:00:00Z',
  },
  {
    id: 3,
    run_at: '2026-01-12T08:00:00Z',
    target_date: '2026-01-12',
    outcome: 'auth_error',
    fields_populated: null,
    error_detail: 'Authentication failed',
    retry_count: 0,
    created_at: '2026-01-12T08:00:00Z',
  },
]

vi.mock('@/lib/api', () => ({
  postRetrain: vi.fn(),
  getGarminStatus: () =>
    Promise.resolve({ enabled: true, username_configured: true, interval_seconds: 3600 }),
  getGarminIngestLog: () => Promise.resolve({ entries: mockIngestLog, count: 3 }),
  getAppVersion: () => Promise.resolve({ status: 'ok', version: '0.2.0', environment: 'test' }),
  getInsulinLog: () => Promise.resolve({ entries: [], count: 0 }),
  getMealLog: () => Promise.resolve({ entries: [], count: 0 }),
  getHealthLog: () =>
    Promise.resolve({
      entries: [
        {
          id: 10,
          timestamp: '2026-01-11T00:00:00Z',
          heart_rate_bpm: 58,
          weight_kg: null,
          activity_type: null,
          activity_minutes: null,
          sleep_hours: null,
          stress_level: null,
          source: 'garmin',
          notes: null,
          created_at: '2026-01-11T00:00:00Z',
        },
        {
          id: 11,
          timestamp: '2026-01-12T00:00:00Z',
          heart_rate_bpm: null,
          weight_kg: null,
          activity_type: null,
          activity_minutes: null,
          sleep_hours: null,
          stress_level: null,
          source: 'garmin',
          notes: null,
          created_at: '2026-01-12T00:00:00Z',
        },
      ],
      count: 2,
    }),
  deleteHealth: vi.fn(),
  deleteInsulin: vi.fn(),
  deleteMeal: vi.fn(),
  getMealResponse: vi.fn(),
}))

vi.mock('@/hooks/useInsulinLog', () => ({
  useInsulinLog: () => ({
    entries: [],
    loading: false,
    error: null,
    hasMore: false,
    loadMore: vi.fn(),
    refresh: vi.fn(),
  }),
}))

vi.mock('@/hooks/useMealLog', () => ({
  useMealLog: () => ({
    entries: [],
    loading: false,
    error: null,
    hasMore: false,
    loadMore: vi.fn(),
    refresh: vi.fn(),
  }),
}))

vi.mock('@/hooks/useHealthLog', () => ({
  useHealthLog: () => ({
    entries: [
      {
        id: 10,
        timestamp: '2026-01-11T00:00:00Z',
        heart_rate_bpm: 58,
        weight_kg: null,
        activity_type: null,
        activity_minutes: null,
        sleep_hours: null,
        stress_level: null,
        source: 'garmin',
        notes: null,
        created_at: '2026-01-11T00:00:00Z',
      },
      {
        id: 11,
        timestamp: '2026-01-12T00:00:00Z',
        heart_rate_bpm: null,
        weight_kg: null,
        activity_type: null,
        activity_minutes: null,
        sleep_hours: null,
        stress_level: null,
        source: 'garmin',
        notes: null,
        created_at: '2026-01-12T00:00:00Z',
      },
    ],
    loading: false,
    error: null,
    hasMore: false,
    loadMore: vi.fn(),
    refresh: vi.fn(),
  }),
}))

import Settings from '@/pages/Settings'
import Logs from '@/pages/Logs'

// ─── Settings: ingest log table ───────────────────────────────────────────────

describe('Settings — Garmin ingest log table', () => {
  it('renders "Show recent ingest runs" trigger by default', () => {
    render(<Settings />)
    expect(screen.getByRole('button', { name: /show recent ingest runs/i })).toBeInTheDocument()
  })

  it('expands on click and shows table heading', async () => {
    const user = userEvent.setup()
    render(<Settings />)
    await user.click(screen.getByRole('button', { name: /show recent ingest runs/i }))
    expect(screen.getByText('Recent ingest runs')).toBeInTheDocument()
  })

  it('shows success badge', async () => {
    const user = userEvent.setup()
    render(<Settings />)
    await user.click(screen.getByRole('button', { name: /show recent ingest runs/i }))
    await waitFor(() => expect(screen.getByText('success')).toBeInTheDocument())
  })

  it('shows partial badge', async () => {
    const user = userEvent.setup()
    render(<Settings />)
    await user.click(screen.getByRole('button', { name: /show recent ingest runs/i }))
    await waitFor(() => expect(screen.getByText('partial')).toBeInTheDocument())
  })

  it('shows auth error badge', async () => {
    const user = userEvent.setup()
    render(<Settings />)
    await user.click(screen.getByRole('button', { name: /show recent ingest runs/i }))
    await waitFor(() => expect(screen.getByText('auth error')).toBeInTheDocument())
  })

  it('collapses on Hide click', async () => {
    const user = userEvent.setup()
    render(<Settings />)
    await user.click(screen.getByRole('button', { name: /show recent ingest runs/i }))
    await user.click(screen.getByRole('button', { name: /hide/i }))
    expect(screen.queryByText('Recent ingest runs')).not.toBeInTheDocument()
  })
})

// ─── Logs: outcome indicator on Garmin health entries ────────────────────────

describe('Logs — Garmin ingest outcome indicator', () => {
  it('renders health entries from Garmin', () => {
    render(<Logs />)
    // Health entries should appear (HR 58 bpm for id=10, "—" for id=11)
    expect(screen.getByText(/HR 58 bpm/i)).toBeInTheDocument()
  })

  it('shows partial badge on a health entry with partial ingest outcome', async () => {
    render(<Logs />)
    // Entry for 2026-01-11 has partial outcome
    await waitFor(() => {
      expect(screen.getByText('partial')).toBeInTheDocument()
    })
  })

  it('shows auth error badge on a health entry with auth_error ingest outcome', async () => {
    render(<Logs />)
    // Entry for 2026-01-12 has auth_error outcome
    await waitFor(() => {
      expect(screen.getByText('auth error')).toBeInTheDocument()
    })
  })
})
