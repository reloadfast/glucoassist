import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import DoseProposalBadge from '@/components/DoseProposalBadge'
import type { DoseProposalResponse } from '@/lib/api'

// ── mock api module ───────────────────────────────────────────────────────────

vi.mock('@/lib/api', () => ({
  getDoseProposal: vi.fn(),
}))

import { getDoseProposal } from '@/lib/api'
const mockGetDoseProposal = vi.mocked(getDoseProposal)

// ── fixtures ──────────────────────────────────────────────────────────────────

function sufficientResponse(overrides?: Partial<DoseProposalResponse>): DoseProposalResponse {
  return {
    block: 'lunch',
    icr: { mean: 15.0, ci_lower: 13.0, ci_upper: 17.0, n: 8 },
    suggested_units: 4.0,
    suggested_units_low: 3.5,
    suggested_units_high: 4.6,
    sufficient_data: true,
    days_analyzed: 90,
    disclaimer: 'Decision-support only — always follow guidance from your healthcare team.',
    ...overrides,
  }
}

function insufficientResponse(): DoseProposalResponse {
  return {
    block: 'lunch',
    icr: null,
    suggested_units: null,
    suggested_units_low: null,
    suggested_units_high: null,
    sufficient_data: false,
    days_analyzed: 90,
    disclaimer: 'Decision-support only — always follow guidance from your healthcare team.',
  }
}

// ── tests ─────────────────────────────────────────────────────────────────────

describe('DoseProposalBadge', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders nothing when carbsG is 0', () => {
    const { container } = render(<DoseProposalBadge carbsG={0} hour={12} onUse={vi.fn()} />)
    expect(container.firstChild).toBeNull()
  })

  it('shows suggested dose when sufficient_data is true', async () => {
    mockGetDoseProposal.mockResolvedValue(sufficientResponse())
    render(<DoseProposalBadge carbsG={60} hour={12} onUse={vi.fn()} />)

    await waitFor(
      () => {
        expect(screen.getByTestId('dose-proposal-value')).toHaveTextContent('4.0')
      },
      { timeout: 2000 },
    )
    expect(screen.getByText('(3.5–4.6 u range)')).toBeInTheDocument()
    expect(screen.getByText('Lunch')).toBeInTheDocument()
  })

  it('shows "Not enough data" message when sufficient_data is false', async () => {
    mockGetDoseProposal.mockResolvedValue(insufficientResponse())
    render(<DoseProposalBadge carbsG={45} hour={12} onUse={vi.fn()} />)

    await waitFor(
      () => {
        expect(screen.getByText(/not enough data yet/i)).toBeInTheDocument()
      },
      { timeout: 2000 },
    )
    expect(screen.queryByText('Use this')).not.toBeInTheDocument()
  })

  it('"Use this" button calls onUse with value rounded to nearest 0.5', async () => {
    // suggested_units=4.3 → rounds to 4.5
    mockGetDoseProposal.mockResolvedValue(sufficientResponse({ suggested_units: 4.3 }))
    const onUse = vi.fn()
    render(<DoseProposalBadge carbsG={60} hour={12} onUse={onUse} />)

    await waitFor(() => screen.getByText('Use this'), { timeout: 2000 })
    await userEvent.click(screen.getByText('Use this'))

    expect(onUse).toHaveBeenCalledOnce()
    expect(onUse).toHaveBeenCalledWith(4.5)
  })

  it('"Use this" rounds 4.0 to 4.0', async () => {
    mockGetDoseProposal.mockResolvedValue(sufficientResponse({ suggested_units: 4.0 }))
    const onUse = vi.fn()
    render(<DoseProposalBadge carbsG={60} hour={12} onUse={onUse} />)

    await waitFor(() => screen.getByText('Use this'), { timeout: 2000 })
    await userEvent.click(screen.getByText('Use this'))

    expect(onUse).toHaveBeenCalledWith(4.0)
  })

  it('shows disclaimer text when sufficient_data is true', async () => {
    mockGetDoseProposal.mockResolvedValue(sufficientResponse())
    render(<DoseProposalBadge carbsG={60} hour={12} onUse={vi.fn()} />)

    await waitFor(
      () => {
        expect(screen.getByText(/decision-support only/i)).toBeInTheDocument()
      },
      { timeout: 2000 },
    )
  })

  it('displays correct block label for overnight', async () => {
    mockGetDoseProposal.mockResolvedValue(sufficientResponse({ block: 'overnight' }))
    render(<DoseProposalBadge carbsG={30} hour={2} onUse={vi.fn()} />)

    await waitFor(
      () => {
        expect(screen.getByText('Overnight')).toBeInTheDocument()
      },
      { timeout: 2000 },
    )
  })

  it('does not render when carbsG transitions from positive to 0', async () => {
    mockGetDoseProposal.mockResolvedValue(sufficientResponse())
    const { rerender, container } = render(
      <DoseProposalBadge carbsG={60} hour={12} onUse={vi.fn()} />,
    )
    rerender(<DoseProposalBadge carbsG={0} hour={12} onUse={vi.fn()} />)
    expect(container.firstChild).toBeNull()
  })
})
