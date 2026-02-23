import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import GlucoseChart from '@/components/GlucoseChart'
import type { GlucoseReading, HorizonForecast } from '@/lib/api'

const mockReadings: GlucoseReading[] = [
  {
    id: 1,
    timestamp: '2026-02-23T10:00:00',
    glucose_mg_dl: 120,
    trend_arrow: 'Flat',
    source: 'librelink',
    device_id: null,
    created_at: '2026-02-23T10:00:00',
  },
  {
    id: 2,
    timestamp: '2026-02-23T10:05:00',
    glucose_mg_dl: 130,
    trend_arrow: 'SingleUp',
    source: 'librelink',
    device_id: null,
    created_at: '2026-02-23T10:05:00',
  },
]

const mockForecasts: HorizonForecast[] = [
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
    predicted_mg_dl: 140,
    ci_lower: 115,
    ci_upper: 165,
    p_hypo: 0.03,
    p_hyper: 0.12,
    risk_level: 'moderate',
  },
]

describe('GlucoseChart', () => {
  it('renders without crash with data', () => {
    render(<GlucoseChart readings={mockReadings} />)
  })

  it('shows no-data message when empty', () => {
    render(<GlucoseChart readings={[]} />)
    expect(screen.getByText(/no glucose data/i)).toBeInTheDocument()
  })

  it('renders without crash with forecast data', () => {
    render(<GlucoseChart readings={mockReadings} forecasts={mockForecasts} />)
  })

  it('renders with empty forecasts array', () => {
    render(<GlucoseChart readings={mockReadings} forecasts={[]} />)
  })
})
