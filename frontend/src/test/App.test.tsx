import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import App from '@/App'

describe('App', () => {
  it('renders the dashboard heading', () => {
    render(<App />)
    expect(screen.getByText('GlucoSense')).toBeInTheDocument()
  })

  it('renders the three stat cards', () => {
    render(<App />)
    expect(screen.getByText('Latest Reading')).toBeInTheDocument()
    expect(screen.getByText('Trend')).toBeInTheDocument()
    expect(screen.getByText('Time in Range (24h)')).toBeInTheDocument()
  })
})
