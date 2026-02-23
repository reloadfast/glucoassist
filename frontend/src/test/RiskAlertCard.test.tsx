import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import RiskAlertCard from '@/components/RiskAlertCard'
import type { ForecastResponse } from '@/lib/api'

function makeForecast(overallRisk: ForecastResponse['overall_risk']): ForecastResponse {
  return {
    model_trained: true,
    overall_risk: overallRisk,
    forecasts: [
      {
        horizon_min: 30,
        predicted_mg_dl: 135,
        ci_lower: 120,
        ci_upper: 150,
        p_hypo: 0.02,
        p_hyper: 0.05,
        risk_level: 'low',
      },
      {
        horizon_min: 60,
        predicted_mg_dl: 58,
        ci_lower: 45,
        ci_upper: 71,
        p_hypo: 0.35,
        p_hyper: 0.0,
        risk_level: 'high',
      },
    ],
    meta: { last_trained: null, training_samples: null, mae_per_horizon: null },
  }
}

describe('RiskAlertCard', () => {
  it('renders nothing for low risk', () => {
    const { container } = render(<RiskAlertCard forecast={makeForecast('low')} />)
    expect(container.firstChild).toBeNull()
  })

  it('renders nothing for unknown risk', () => {
    const { container } = render(<RiskAlertCard forecast={makeForecast('unknown')} />)
    expect(container.firstChild).toBeNull()
  })

  it('renders card for moderate risk', () => {
    render(<RiskAlertCard forecast={makeForecast('moderate')} />)
    expect(screen.getByText(/moderate risk/i)).toBeInTheDocument()
  })

  it('renders card for high risk', () => {
    render(<RiskAlertCard forecast={makeForecast('high')} />)
    expect(screen.getByText(/high risk/i)).toBeInTheDocument()
  })

  it('renders card for critical risk', () => {
    render(<RiskAlertCard forecast={makeForecast('critical')} />)
    expect(screen.getByText(/critical risk/i)).toBeInTheDocument()
  })

  it('shows hypo percentage for non-low horizons', () => {
    render(<RiskAlertCard forecast={makeForecast('high')} />)
    // 60-min horizon has p_hypo=0.35 → "35% hypo risk"
    expect(screen.getByText(/35% hypo risk/i)).toBeInTheDocument()
  })

  it('shows disclaimer text', () => {
    render(<RiskAlertCard forecast={makeForecast('moderate')} />)
    expect(screen.getByText(/decision-support only/i)).toBeInTheDocument()
  })
})
