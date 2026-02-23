import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import Statistics from '@/pages/Statistics'
import type { HbA1cResponse, PatternsResponse, StatsResponse } from '@/lib/api'

const mockStats: StatsResponse = {
  windows: [
    {
      window_days: 30,
      reading_count: 100,
      avg_glucose: 140,
      sd: 30,
      cv_pct: 21.4,
      tir_pct: 65.0,
      tbr_pct: 5.0,
      tar_pct: 30.0,
      eag: 140,
      hba1c: 6.5,
    },
    {
      window_days: 60,
      reading_count: 200,
      avg_glucose: 145,
      sd: 32,
      cv_pct: 22.1,
      tir_pct: 62.0,
      tbr_pct: 4.0,
      tar_pct: 34.0,
      eag: 145,
      hba1c: 6.8,
    },
    {
      window_days: 90,
      reading_count: 0,
      avg_glucose: null,
      sd: null,
      cv_pct: null,
      tir_pct: null,
      tbr_pct: null,
      tar_pct: null,
      eag: null,
      hba1c: null,
    },
  ],
}

const mockHba1c: HbA1cResponse = {
  eag_30d: 140,
  eag_60d: 145,
  eag_90d: null,
  hba1c_30d: 6.5,
  hba1c_60d: 6.8,
  hba1c_90d: null,
}

const mockPatterns: PatternsResponse = { patterns: [] }

vi.mock('@/hooks/useAnalytics', () => ({
  useAnalytics: () => ({
    stats: mockStats,
    hba1c: mockHba1c,
    patterns: mockPatterns,
    loading: false,
    error: null,
    refresh: vi.fn(),
  }),
}))

describe('Statistics', () => {
  it('renders page heading', () => {
    render(<Statistics />)
    expect(screen.getByText('Statistics')).toBeInTheDocument()
  })

  it('renders HbA1c cards', () => {
    render(<Statistics />)
    expect(screen.getByText('HbA1c (30d)')).toBeInTheDocument()
    expect(screen.getByText('HbA1c (60d)')).toBeInTheDocument()
    expect(screen.getByText('HbA1c (90d)')).toBeInTheDocument()
  })

  it('shows hba1c values', () => {
    render(<Statistics />)
    expect(screen.getByText('6.5%')).toBeInTheDocument()
    expect(screen.getByText('6.8%')).toBeInTheDocument()
  })

  it('shows window comparison table', () => {
    render(<Statistics />)
    expect(screen.getByText('Window Comparison')).toBeInTheDocument()
    expect(screen.getAllByText('30d').length).toBeGreaterThan(0)
    expect(screen.getAllByText('60d').length).toBeGreaterThan(0)
  })

  it('shows reading counts in table', () => {
    render(<Statistics />)
    expect(screen.getByText('100')).toBeInTheDocument()
    expect(screen.getByText('200')).toBeInTheDocument()
  })
})
