import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import ReadingsTable from '@/components/ReadingsTable'
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
    timestamp: '2026-02-23T11:00:00',
    glucose_mg_dl: 65,
    trend_arrow: 'DoubleDown',
    source: 'nightscout',
    device_id: 'device-x',
    created_at: '2026-02-23T11:00:00',
  },
]

describe('ReadingsTable', () => {
  it('renders rows from mock data', () => {
    render(<ReadingsTable readings={mockReadings} />)
    expect(screen.getByText('120 mg/dL')).toBeInTheDocument()
    expect(screen.getByText('65 mg/dL')).toBeInTheDocument()
    expect(screen.getByText('→')).toBeInTheDocument()
    expect(screen.getByText('↓↓')).toBeInTheDocument()
  })

  it('shows no readings message when empty', () => {
    render(<ReadingsTable readings={[]} />)
    expect(screen.getByText(/no readings yet/i)).toBeInTheDocument()
  })

  it('renders table headers', () => {
    render(<ReadingsTable readings={mockReadings} />)
    expect(screen.getByText('Time')).toBeInTheDocument()
    expect(screen.getByText('Glucose')).toBeInTheDocument()
    expect(screen.getByText('Trend')).toBeInTheDocument()
    expect(screen.getByText('Source')).toBeInTheDocument()
  })
})
