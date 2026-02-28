/**
 * Tests for in-app contextual help elements added across pages/components.
 * Covers issues #85, #86, #87, #88.
 */
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

// ─── mock hooks ─────────────────────────────────────────────────────────────

vi.mock('@/hooks/useGlucoseData', () => ({
  useGlucoseData: () => ({
    summary: {
      latest_reading: { glucose_mg_dl: 120, trend_arrow: 'Flat', source: 'librelink' },
      time_in_range_pct: 72,
      reading_count: 288,
      avg_glucose: 125,
      min_glucose: 68,
      max_glucose: 195,
      iob_units: 1.5,
    },
    readings: [],
    loading: false,
    error: null,
    refresh: vi.fn(),
  }),
}))

vi.mock('@/hooks/useForecast', () => ({ useForecast: () => ({ forecast: null }) }))
vi.mock('@/hooks/useRecommendations', () => ({
  useRecommendations: () => ({ data: null, loading: false }),
}))
vi.mock('@/lib/api', () => ({
  getInsulinLog: () => Promise.resolve({ entries: [] }),
  getMealLog: () => Promise.resolve({ entries: [] }),
  postBackfill: vi.fn(),
}))

vi.mock('@/hooks/useAnalytics', () => ({
  useAnalytics: () => ({
    stats: {
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
      ],
    },
    hba1c: {
      eag_30d: 140,
      eag_60d: 145,
      eag_90d: null,
      hba1c_30d: 6.5,
      hba1c_60d: 6.8,
      hba1c_90d: null,
    },
    patterns: {
      patterns: [
        { name: 'Dawn Phenomenon', detected: true, description: 'Test', confidence: 0.85 },
      ],
    },
    loading: false,
    error: null,
    refresh: vi.fn(),
  }),
}))

vi.mock('@/hooks/usePatternHistory', () => ({
  usePatternHistory: () => ({ history: null }),
}))

vi.mock('@/hooks/useRatios', () => ({
  useRatios: () => ({ ratios: null, loading: true, error: null, refresh: vi.fn() }),
}))

vi.mock('@/hooks/useModelRegistry', () => ({
  useModelRegistry: () => ({
    meta: {
      last_trained: '2026-01-01T00:00:00Z',
      training_samples: 500,
      mae_per_horizon: { h30: 8, h60: 12, h120: 18 },
    },
    retrainLog: null,
    loading: false,
    refresh: vi.fn(),
  }),
}))

vi.mock('@/lib/api', () => ({
  getInsulinLog: () => Promise.resolve({ entries: [] }),
  getMealLog: () => Promise.resolve({ entries: [] }),
  postBackfill: vi.fn(),
  postRetrain: vi.fn(),
  getGarminStatus: () =>
    Promise.resolve({ enabled: false, username_configured: false, interval_seconds: 3600 }),
}))

// ─── imports (after mocks) ───────────────────────────────────────────────────

import Dashboard from '@/pages/Dashboard'
import Statistics from '@/pages/Statistics'
import Intelligence from '@/pages/Intelligence'
import Patterns from '@/pages/Patterns'
import Settings from '@/pages/Settings'
import RiskAlertCard from '@/components/RiskAlertCard'
import type { ForecastResponse } from '@/lib/api'

// ─── Dashboard help elements (#86) ──────────────────────────────────────────

describe('Dashboard — help elements (#86)', () => {
  it('renders Latest Reading help trigger', () => {
    render(<Dashboard />)
    expect(screen.getByRole('button', { name: /help: blood glucose/i })).toBeInTheDocument()
  })

  it('renders Trend help trigger', () => {
    render(<Dashboard />)
    expect(screen.getByRole('button', { name: /help: trend arrow/i })).toBeInTheDocument()
  })

  it('renders TIR help trigger', () => {
    render(<Dashboard />)
    expect(screen.getByRole('button', { name: /help: time in range/i })).toBeInTheDocument()
  })

  it('renders IOB help trigger', () => {
    render(<Dashboard />)
    expect(screen.getByRole('button', { name: /help: insulin on board/i })).toBeInTheDocument()
  })

  it('opens blood glucose popover on click', async () => {
    const user = userEvent.setup()
    render(<Dashboard />)
    await user.click(screen.getByRole('button', { name: /help: blood glucose/i }))
    expect(screen.getByText(/milligrams per deciliter/i)).toBeInTheDocument()
  })

  it('opens trend popover on click', async () => {
    const user = userEvent.setup()
    render(<Dashboard />)
    await user.click(screen.getByRole('button', { name: /help: trend arrow/i }))
    expect(screen.getByText(/rate of change/i)).toBeInTheDocument()
  })

  it('opens TIR popover on click', async () => {
    const user = userEvent.setup()
    render(<Dashboard />)
    await user.click(screen.getByRole('button', { name: /help: time in range/i }))
    expect(screen.getByText(/70 and 180 mg\/dL/i)).toBeInTheDocument()
  })
})

// ─── RiskAlertCard help elements (#85) ──────────────────────────────────────

function makeHighForecast(): ForecastResponse {
  return {
    model_trained: true,
    overall_risk: 'high',
    forecasts: [
      {
        horizon_min: 30,
        predicted_mg_dl: 55,
        ci_lower: 40,
        ci_upper: 70,
        p_hypo: 0.4,
        p_hyper: 0.0,
        risk_level: 'high',
      },
      {
        horizon_min: 60,
        predicted_mg_dl: 270,
        ci_lower: 255,
        ci_upper: 285,
        p_hypo: 0.0,
        p_hyper: 0.3,
        risk_level: 'high',
      },
    ],
    meta: { last_trained: null, training_samples: null, mae_per_horizon: null },
  }
}

describe('RiskAlertCard — help elements (#85)', () => {
  it('renders risk level help trigger', () => {
    render(<RiskAlertCard forecast={makeHighForecast()} />)
    expect(screen.getByRole('button', { name: /help: risk levels/i })).toBeInTheDocument()
  })

  it('renders horizon help triggers', () => {
    render(<RiskAlertCard forecast={makeHighForecast()} />)
    expect(screen.getByRole('button', { name: /help: 30-minute forecast/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /help: 60-minute forecast/i })).toBeInTheDocument()
  })

  it('renders hypo/hyper help triggers', () => {
    render(<RiskAlertCard forecast={makeHighForecast()} />)
    expect(screen.getByRole('button', { name: /help: hypoglycaemia risk/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /help: hyperglycaemia risk/i })).toBeInTheDocument()
  })

  it('renders "How does this work?" sheet trigger', () => {
    render(<RiskAlertCard forecast={makeHighForecast()} />)
    expect(screen.getByRole('button', { name: /how does this work\?/i })).toBeInTheDocument()
  })

  it('opens forecast sheet with content', async () => {
    const user = userEvent.setup()
    render(<RiskAlertCard forecast={makeHighForecast()} />)
    await user.click(screen.getByRole('button', { name: /how does this work\?/i }))
    expect(screen.getByRole('heading', { name: 'How the Forecast Works' })).toBeInTheDocument()
    expect(screen.getByText('What the forecast does')).toBeInTheDocument()
  })
})

// ─── Statistics help elements (#87) ─────────────────────────────────────────

describe('Statistics — help elements (#87)', () => {
  it('renders HbA1c section heading', () => {
    render(<Statistics />)
    expect(screen.getByText('HbA1c Estimates')).toBeInTheDocument()
  })

  it('renders HbA1c sheet trigger', () => {
    render(<Statistics />)
    expect(screen.getByRole('button', { name: /how is this calculated\?/i })).toBeInTheDocument()
  })

  it('opens HbA1c sheet with formula', async () => {
    const user = userEvent.setup()
    render(<Statistics />)
    await user.click(screen.getByRole('button', { name: /how is this calculated\?/i }))
    expect(screen.getByRole('heading', { name: 'HbA1c Estimates' })).toBeInTheDocument()
    expect(screen.getByText(/What HbA1c is/i)).toBeInTheDocument()
  })

  it('renders column HelpPopover triggers for key columns', () => {
    render(<Statistics />)
    expect(screen.getByRole('button', { name: /help: average glucose/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /help: time in range/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /help: time below range/i })).toBeInTheDocument()
  })

  it('opens CV% popover with formula', async () => {
    const user = userEvent.setup()
    render(<Statistics />)
    await user.click(screen.getByRole('button', { name: /help: coefficient of variation/i }))
    expect(screen.getByText(/CV% = SD ÷ Avg × 100/i)).toBeInTheDocument()
  })

  it('renders window comparison help trigger', () => {
    render(<Statistics />)
    expect(screen.getByRole('button', { name: /help: analysis windows/i })).toBeInTheDocument()
  })
})

// ─── Intelligence help elements (#88) ────────────────────────────────────────

describe('Intelligence — help elements (#88)', () => {
  it('renders "How are these calculated?" sheet trigger', () => {
    render(<Intelligence />)
    expect(screen.getByRole('button', { name: /how are these calculated\?/i })).toBeInTheDocument()
  })

  it('opens intelligence sheet with ICR section', async () => {
    const user = userEvent.setup()
    render(<Intelligence />)
    await user.click(screen.getByRole('button', { name: /how are these calculated\?/i }))
    expect(screen.getByRole('heading', { name: 'How are these calculated?' })).toBeInTheDocument()
    expect(screen.getByText('Insulin-to-Carb Ratio (ICR)')).toBeInTheDocument()
  })
})

// ─── Patterns help elements (#88) ────────────────────────────────────────────

describe('Patterns — help elements (#88)', () => {
  it('renders "What are patterns?" sheet trigger', () => {
    render(<Patterns />)
    expect(screen.getByRole('button', { name: /what are patterns\?/i })).toBeInTheDocument()
  })

  it('opens patterns sheet', async () => {
    const user = userEvent.setup()
    render(<Patterns />)
    await user.click(screen.getByRole('button', { name: /what are patterns\?/i }))
    expect(screen.getByRole('heading', { name: 'What are patterns?' })).toBeInTheDocument()
    expect(screen.getByText('Pattern types')).toBeInTheDocument()
  })

  it('renders confidence help trigger on detected pattern', () => {
    render(<Patterns />)
    expect(screen.getByRole('button', { name: /help: confidence score/i })).toBeInTheDocument()
  })

  it('opens confidence popover', async () => {
    const user = userEvent.setup()
    render(<Patterns />)
    await user.click(screen.getByRole('button', { name: /help: confidence score/i }))
    expect(screen.getByText(/proportion of qualifying days/i)).toBeInTheDocument()
  })
})

// ─── Settings help elements (#85) ────────────────────────────────────────────

describe('Settings — help elements (#85)', () => {
  it('renders "About this model" sheet trigger', () => {
    render(<Settings />)
    expect(screen.getByRole('button', { name: /about this model/i })).toBeInTheDocument()
  })

  it('renders Last trained help trigger', () => {
    render(<Settings />)
    expect(screen.getByRole('button', { name: /help: last trained/i })).toBeInTheDocument()
  })

  it('renders Training samples help trigger', () => {
    render(<Settings />)
    expect(screen.getByRole('button', { name: /help: training samples/i })).toBeInTheDocument()
  })

  it('renders MAE help trigger', () => {
    render(<Settings />)
    expect(screen.getByRole('button', { name: /help: mean absolute error/i })).toBeInTheDocument()
  })

  it('opens MAE popover with explanation', async () => {
    const user = userEvent.setup()
    render(<Settings />)
    await user.click(screen.getByRole('button', { name: /help: mean absolute error/i }))
    expect(screen.getByText(/average difference in mg\/dL/i)).toBeInTheDocument()
  })

  it('opens "About this model" sheet with promotion logic', async () => {
    const user = userEvent.setup()
    render(<Settings />)
    await user.click(screen.getByRole('button', { name: /about this model/i }))
    expect(screen.getByRole('heading', { name: 'About this model' })).toBeInTheDocument()
    expect(screen.getByText('Model promotion logic')).toBeInTheDocument()
  })
})
