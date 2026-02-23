import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import GlucoseChart from '@/components/GlucoseChart'
import type { GlucoseReading } from '@/lib/api'

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

describe('GlucoseChart', () => {
  it('renders without crash with data', () => {
    render(<GlucoseChart readings={mockReadings} />)
  })

  it('shows no-data message when empty', () => {
    render(<GlucoseChart readings={[]} />)
    expect(screen.getByText(/no glucose data/i)).toBeInTheDocument()
  })
})
