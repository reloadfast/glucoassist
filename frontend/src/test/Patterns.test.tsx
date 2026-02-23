import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import Patterns from '@/pages/Patterns'
import type { PatternsResponse } from '@/lib/api'

const mockPatterns: PatternsResponse = {
  patterns: [
    {
      name: 'Dawn Phenomenon',
      detected: true,
      description: 'Pre-dawn avg 80 → early-morning avg 110 mg/dL (+30 mg/dL). Detected.',
      confidence: 1.0,
    },
    {
      name: 'Basal Drift',
      detected: false,
      description: 'Slope within normal variability.',
      confidence: 0.2,
    },
    {
      name: 'Exercise Sensitivity',
      detected: false,
      description: 'No activity logs found.',
      confidence: null,
    },
    {
      name: 'Delayed Carb Absorption',
      detected: false,
      description: 'No meal logs found.',
      confidence: null,
    },
  ],
}

vi.mock('@/hooks/useAnalytics', () => ({
  useAnalytics: () => ({
    stats: null,
    hba1c: null,
    patterns: mockPatterns,
    loading: false,
    error: null,
    refresh: vi.fn(),
  }),
}))

describe('Patterns', () => {
  it('renders page heading', () => {
    render(<Patterns />)
    expect(screen.getByText('Patterns')).toBeInTheDocument()
  })

  it('renders all four pattern cards', () => {
    render(<Patterns />)
    expect(screen.getByText('Dawn Phenomenon')).toBeInTheDocument()
    expect(screen.getByText('Basal Drift')).toBeInTheDocument()
    expect(screen.getByText('Exercise Sensitivity')).toBeInTheDocument()
    expect(screen.getByText('Delayed Carb Absorption')).toBeInTheDocument()
  })

  it('shows Detected badge for active pattern', () => {
    render(<Patterns />)
    const detected = screen.getAllByText('Detected')
    expect(detected.length).toBeGreaterThan(0)
  })

  it('shows Not detected badges', () => {
    render(<Patterns />)
    const notDetected = screen.getAllByText('Not detected')
    expect(notDetected.length).toBe(3)
  })

  it('shows pattern description', () => {
    render(<Patterns />)
    expect(screen.getByText(/Pre-dawn avg/i)).toBeInTheDocument()
  })

  it('shows detected count summary badge', () => {
    render(<Patterns />)
    expect(screen.getByText(/1 of 4 detected/i)).toBeInTheDocument()
  })
})
