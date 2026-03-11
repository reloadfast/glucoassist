import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import ForecastActionPanel from '@/components/ForecastActionPanel'
import type { ActionSuggestion, ForecastResponse } from '@/lib/api'

const SUGGESTION_OK: ActionSuggestion = {
  type: 'ok',
  urgency: 'low',
  message: 'On track — no action needed',
  detail: 'Glucose stays in range through 120 min.',
  disclaimer: 'Decision-support only — always follow guidance from your healthcare team.',
}

const SUGGESTION_HYPO: ActionSuggestion = {
  type: 'hypo_treat',
  urgency: 'critical',
  message: 'Take 15 g fast carbs now',
  detail: 'Forecast drops to 62 mg/dL at 60 min.',
  disclaimer: 'Decision-support only — always follow guidance from your healthcare team.',
}

function makeForecast(
  overrides: Partial<ForecastResponse> = {},
  suggestions: ActionSuggestion[] = [SUGGESTION_OK],
): ForecastResponse {
  return {
    model_trained: true,
    overall_risk: 'low',
    forecasts: [
      {
        horizon_min: 30,
        predicted_mg_dl: 120,
        ci_lower: 105,
        ci_upper: 135,
        p_hypo: 0.01,
        p_hyper: 0.02,
        risk_level: 'low',
      },
      {
        horizon_min: 60,
        predicted_mg_dl: 125,
        ci_lower: 108,
        ci_upper: 142,
        p_hypo: 0.02,
        p_hyper: 0.03,
        risk_level: 'low',
      },
      {
        horizon_min: 90,
        predicted_mg_dl: 128,
        ci_lower: 109,
        ci_upper: 147,
        p_hypo: 0.02,
        p_hyper: 0.04,
        risk_level: 'low',
      },
      {
        horizon_min: 120,
        predicted_mg_dl: 130,
        ci_lower: 110,
        ci_upper: 150,
        p_hypo: 0.03,
        p_hyper: 0.05,
        risk_level: 'low',
      },
    ],
    meta: { last_trained: null, training_samples: null, mae_per_horizon: null },
    suggestions,
    ...overrides,
  }
}

describe('ForecastActionPanel', () => {
  it('renders loading skeleton when loading=true', () => {
    render(<ForecastActionPanel forecast={null} loading={true} />)
    // Skeletons are rendered, no horizon chips
    expect(screen.queryByTestId('horizon-chips')).toBeNull()
  })

  it('renders nothing when forecast is null and not loading', () => {
    const { container } = render(<ForecastActionPanel forecast={null} loading={false} />)
    expect(container.firstChild).toBeNull()
  })

  it('renders all 4 horizon chips', () => {
    render(<ForecastActionPanel forecast={makeForecast()} />)
    expect(screen.getByTestId('horizon-30')).toBeInTheDocument()
    expect(screen.getByTestId('horizon-60')).toBeInTheDocument()
    expect(screen.getByTestId('horizon-90')).toBeInTheDocument()
    expect(screen.getByTestId('horizon-120')).toBeInTheDocument()
  })

  it('shows predicted value for each horizon', () => {
    render(<ForecastActionPanel forecast={makeForecast()} />)
    expect(screen.getByTestId('horizon-30').textContent).toContain('120')
    expect(screen.getByTestId('horizon-60').textContent).toContain('125')
    expect(screen.getByTestId('horizon-90').textContent).toContain('128')
    expect(screen.getByTestId('horizon-120').textContent).toContain('130')
  })

  it('shows on-track suggestion banner', () => {
    render(<ForecastActionPanel forecast={makeForecast()} />)
    expect(screen.getByText(/on track/i)).toBeInTheDocument()
  })

  it('shows hypo suggestion banner', () => {
    render(<ForecastActionPanel forecast={makeForecast({}, [SUGGESTION_HYPO])} />)
    expect(screen.getByText(/take 15 g fast carbs/i)).toBeInTheDocument()
  })

  it('shows suggestion detail text', () => {
    render(<ForecastActionPanel forecast={makeForecast({}, [SUGGESTION_HYPO])} />)
    expect(screen.getByText(/forecast drops to 62/i)).toBeInTheDocument()
  })

  it('shows empty state when model_trained=false', () => {
    render(<ForecastActionPanel forecast={makeForecast({ model_trained: false, forecasts: [] })} />)
    expect(screen.getByText(/model not yet trained/i)).toBeInTheDocument()
    expect(screen.queryByTestId('horizon-chips')).toBeNull()
  })

  it('shows empty state when forecasts array is empty', () => {
    render(<ForecastActionPanel forecast={makeForecast({ forecasts: [] })} />)
    expect(screen.getByText(/model not yet trained/i)).toBeInTheDocument()
  })

  it('renders gracefully with no suggestions', () => {
    render(<ForecastActionPanel forecast={makeForecast({}, [])} />)
    expect(screen.getByTestId('horizon-chips')).toBeInTheDocument()
    // No banner — just chips
    expect(screen.queryByText(/on track/i)).toBeNull()
  })

  it('shows "Active Glucose Forecast" title', () => {
    render(<ForecastActionPanel forecast={makeForecast()} />)
    expect(screen.getByText(/active glucose forecast/i)).toBeInTheDocument()
  })
})
