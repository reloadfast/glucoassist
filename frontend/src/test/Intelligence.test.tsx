import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { TooltipProvider } from '@/components/ui/tooltip'

function renderWithProviders(ui: React.ReactElement) {
  return render(<TooltipProvider>{ui}</TooltipProvider>)
}

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
    renderWithProviders(<Intelligence />)
    expect(screen.getByText('Intelligence')).toBeInTheDocument()
  })

  it('shows loading state', () => {
    renderWithProviders(<Intelligence />)
    expect(screen.getByText(/calculating/i)).toBeInTheDocument()
  })
})

// ─── Empty state (#76) ────────────────────────────────────────────────────────

describe('Intelligence — empty state (#76)', () => {
  beforeEach(() => {
    mockRatiosReturn = { ratios: null, loading: false, error: null, refresh: vi.fn() }
  })

  it('shows actionable empty state message', () => {
    renderWithProviders(<Intelligence />)
    expect(screen.getByText(/not enough paired insulin and meal logs/i)).toBeInTheDocument()
  })

  it('shows "How to populate estimates" guidance', () => {
    renderWithProviders(<Intelligence />)
    expect(screen.getByText(/how to populate estimates/i)).toBeInTheDocument()
  })

  it('shows ICR logging instruction', () => {
    renderWithProviders(<Intelligence />)
    expect(screen.getByText(/ICR/)).toBeInTheDocument()
  })

  it('shows CF logging instruction', () => {
    renderWithProviders(<Intelligence />)
    expect(screen.getByText(/CF/)).toBeInTheDocument()
  })
})

// ─── Status badge — observation count explanation (#75) ───────────────────────

const MOCK_RATIOS_WITH_INSUFFICIENT = {
  days_analyzed: 90,
  disclaimer: 'Decision-support only.',
  blocks: [
    {
      block: 'morning',
      icr: null,
      cf: null,
      icr_samples: 3,
      cf_samples: 1,
      insufficient_data: true,
    },
  ],
}

describe('Intelligence — status badge (#75)', () => {
  beforeEach(() => {
    mockRatiosReturn = {
      ratios: MOCK_RATIOS_WITH_INSUFFICIENT,
      loading: false,
      error: null,
      refresh: vi.fn(),
    }
  })

  it('shows ICR and CF counts separately in badge', () => {
    renderWithProviders(<Intelligence />)
    expect(screen.getByText(/3 ICR \/ 1 CF obs\./i)).toBeInTheDocument()
  })
})

// ─── Help sheet — data requirements (#76) ────────────────────────────────────

describe('Intelligence — help sheet data requirements (#76)', () => {
  beforeEach(() => {
    mockRatiosReturn = { ratios: null, loading: true, error: null, refresh: vi.fn() }
  })

  it('opens sheet and shows "What to log" section', async () => {
    const user = userEvent.setup()
    renderWithProviders(<Intelligence />)
    await user.click(screen.getByRole('button', { name: /how are these calculated\?/i }))
    expect(screen.getByText('What to log to populate estimates')).toBeInTheDocument()
  })

  it('explains ICR logging requirement in sheet', async () => {
    const user = userEvent.setup()
    renderWithProviders(<Intelligence />)
    await user.click(screen.getByRole('button', { name: /how are these calculated\?/i }))
    expect(screen.getByText(/log a meal/i)).toBeInTheDocument()
  })

  it('explains CF logging requirement in sheet', async () => {
    const user = userEvent.setup()
    renderWithProviders(<Intelligence />)
    await user.click(screen.getByRole('button', { name: /how are these calculated\?/i }))
    const matches = screen.getAllByText(/correction bolus/i)
    expect(matches.length).toBeGreaterThanOrEqual(1)
  })
})
