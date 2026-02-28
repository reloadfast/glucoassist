import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

// Controllable mock so each describe block can set different return values
let mockRatiosReturn = {
  ratios: null as null | object,
  loading: true,
  error: null,
  refresh: vi.fn(),
}

vi.mock('@/hooks/useRatios', () => ({
  useRatios: () => mockRatiosReturn,
}))

import Intelligence from '@/pages/Intelligence'

// ─── Loading state ────────────────────────────────────────────────────────────

describe('Intelligence — loading state', () => {
  beforeEach(() => {
    mockRatiosReturn = { ratios: null, loading: true, error: null, refresh: vi.fn() }
  })

  it('renders heading', () => {
    render(<Intelligence />)
    expect(screen.getByText('Intelligence')).toBeInTheDocument()
  })

  it('shows loading state', () => {
    render(<Intelligence />)
    expect(screen.getByText(/calculating/i)).toBeInTheDocument()
  })
})

// ─── Empty state (#76) ────────────────────────────────────────────────────────

describe('Intelligence — empty state (#76)', () => {
  beforeEach(() => {
    mockRatiosReturn = { ratios: null, loading: false, error: null, refresh: vi.fn() }
  })

  it('shows actionable empty state message', () => {
    render(<Intelligence />)
    expect(screen.getByText(/not enough paired insulin and meal logs/i)).toBeInTheDocument()
  })

  it('shows "How to populate estimates" guidance', () => {
    render(<Intelligence />)
    expect(screen.getByText(/how to populate estimates/i)).toBeInTheDocument()
  })

  it('shows ICR logging instruction', () => {
    render(<Intelligence />)
    expect(screen.getByText(/ICR/)).toBeInTheDocument()
  })

  it('shows CF logging instruction', () => {
    render(<Intelligence />)
    expect(screen.getByText(/CF/)).toBeInTheDocument()
  })
})

// ─── Help sheet — data requirements (#76) ────────────────────────────────────

describe('Intelligence — help sheet data requirements (#76)', () => {
  beforeEach(() => {
    mockRatiosReturn = { ratios: null, loading: true, error: null, refresh: vi.fn() }
  })

  it('opens sheet and shows "What to log" section', async () => {
    const user = userEvent.setup()
    render(<Intelligence />)
    await user.click(screen.getByRole('button', { name: /how are these calculated\?/i }))
    expect(screen.getByText('What to log to populate estimates')).toBeInTheDocument()
  })

  it('explains ICR logging requirement in sheet', async () => {
    const user = userEvent.setup()
    render(<Intelligence />)
    await user.click(screen.getByRole('button', { name: /how are these calculated\?/i }))
    expect(screen.getByText(/log a meal/i)).toBeInTheDocument()
  })

  it('explains CF logging requirement in sheet', async () => {
    const user = userEvent.setup()
    render(<Intelligence />)
    await user.click(screen.getByRole('button', { name: /how are these calculated\?/i }))
    const matches = screen.getAllByText(/correction bolus/i)
    expect(matches.length).toBeGreaterThanOrEqual(1)
  })
})
