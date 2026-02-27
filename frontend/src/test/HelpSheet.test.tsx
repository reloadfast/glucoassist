import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { HelpSheet, HelpSection } from '@/components/HelpSheet'

describe('HelpSheet (icon variant)', () => {
  it('renders icon trigger button', () => {
    render(
      <HelpSheet title="Forecast Model">
        <HelpSection title="What it predicts">
          <p>Predicts glucose 30–120 min ahead.</p>
        </HelpSection>
      </HelpSheet>,
    )
    expect(screen.getByRole('button', { name: /help: forecast model/i })).toBeInTheDocument()
  })

  it('does not show content before clicking', () => {
    render(
      <HelpSheet title="Forecast Model">
        <HelpSection title="What it predicts">
          <p>Hidden sheet content</p>
        </HelpSection>
      </HelpSheet>,
    )
    expect(screen.queryByText('Forecast Model')).not.toBeInTheDocument()
    expect(screen.queryByText('Hidden sheet content')).not.toBeInTheDocument()
  })

  it('shows title and content on click', async () => {
    const user = userEvent.setup()
    render(
      <HelpSheet title="Forecast Model">
        <HelpSection title="What it predicts">
          <p>Predicts glucose 30–120 min ahead.</p>
        </HelpSection>
      </HelpSheet>,
    )
    await user.click(screen.getByRole('button', { name: /help: forecast model/i }))
    expect(screen.getByText('Forecast Model')).toBeInTheDocument()
    expect(screen.getByText('What it predicts')).toBeInTheDocument()
    expect(screen.getByText('Predicts glucose 30–120 min ahead.')).toBeInTheDocument()
  })

  it('closes on Escape', async () => {
    const user = userEvent.setup()
    render(
      <HelpSheet title="My Sheet">
        <p>Content here</p>
      </HelpSheet>,
    )
    await user.click(screen.getByRole('button', { name: /help: my sheet/i }))
    expect(screen.getByText('My Sheet')).toBeInTheDocument()
    await user.keyboard('{Escape}')
    expect(screen.queryByText('My Sheet')).not.toBeInTheDocument()
  })

  it('closes via the close button', async () => {
    const user = userEvent.setup()
    render(
      <HelpSheet title="Closeable Sheet">
        <p>Body</p>
      </HelpSheet>,
    )
    await user.click(screen.getByRole('button', { name: /help: closeable sheet/i }))
    expect(screen.getByText('Closeable Sheet')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /close/i }))
    expect(screen.queryByText('Closeable Sheet')).not.toBeInTheDocument()
  })
})

describe('HelpSheet (link variant)', () => {
  it('renders text link trigger', () => {
    render(
      <HelpSheet title="ICR Methodology" variant="link" triggerLabel="How is this calculated?">
        <p>Method details</p>
      </HelpSheet>,
    )
    expect(screen.getByRole('button', { name: /how is this calculated\?/i })).toBeInTheDocument()
  })

  it('opens on click', async () => {
    const user = userEvent.setup()
    render(
      <HelpSheet title="ICR Methodology" variant="link" triggerLabel="How is this calculated?">
        <p>Method details</p>
      </HelpSheet>,
    )
    await user.click(screen.getByRole('button', { name: /how is this calculated\?/i }))
    expect(screen.getByText('ICR Methodology')).toBeInTheDocument()
  })
})

describe('HelpSection', () => {
  it('renders section heading and children', () => {
    render(
      <HelpSection title="Limitations">
        <p>Limited to CGM data only.</p>
      </HelpSection>,
    )
    expect(screen.getByText('Limitations')).toBeInTheDocument()
    expect(screen.getByText('Limited to CGM data only.')).toBeInTheDocument()
  })
})
