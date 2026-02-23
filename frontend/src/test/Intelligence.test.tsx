import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('@/hooks/useRatios', () => ({
  useRatios: () => ({
    ratios: null,
    loading: true,
    error: null,
    refresh: vi.fn(),
  }),
}))

import Intelligence from '@/pages/Intelligence'

describe('Intelligence', () => {
  it('renders heading', () => {
    render(<Intelligence />)
    expect(screen.getByText('Intelligence')).toBeInTheDocument()
  })

  it('shows loading state', () => {
    render(<Intelligence />)
    expect(screen.getByText(/calculating/i)).toBeInTheDocument()
  })
})
