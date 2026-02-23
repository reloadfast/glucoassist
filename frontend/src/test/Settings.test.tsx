import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('@/hooks/useModelRegistry', () => ({
  useModelRegistry: () => ({
    meta: null,
    registry: null,
    retrainLog: null,
    loading: true,
    refresh: vi.fn(),
  }),
}))

import Settings from '@/pages/Settings'

describe('Settings', () => {
  it('renders heading', () => {
    render(<Settings />)
    expect(screen.getByText('Settings')).toBeInTheDocument()
  })

  it('renders forecast model card', () => {
    render(<Settings />)
    expect(screen.getByText('Forecast Model')).toBeInTheDocument()
  })

  it('renders retrain log card', () => {
    render(<Settings />)
    expect(screen.getByText('Retrain Log')).toBeInTheDocument()
  })
})
