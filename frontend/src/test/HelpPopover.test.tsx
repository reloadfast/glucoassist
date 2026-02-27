import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { HelpPopover, HelpFormula } from '@/components/HelpPopover'

describe('HelpPopover', () => {
  it('renders the trigger button', () => {
    render(
      <HelpPopover title="Test Title">
        <p>Content</p>
      </HelpPopover>,
    )
    expect(screen.getByRole('button', { name: /help: test title/i })).toBeInTheDocument()
  })

  it('does not show content before clicking', () => {
    render(
      <HelpPopover title="Test Title">
        <p>Hidden content</p>
      </HelpPopover>,
    )
    expect(screen.queryByText('Test Title')).not.toBeInTheDocument()
    expect(screen.queryByText('Hidden content')).not.toBeInTheDocument()
  })

  it('shows title and content on click', async () => {
    const user = userEvent.setup()
    render(
      <HelpPopover title="Insulin on Board">
        <p>IOB explanation here.</p>
      </HelpPopover>,
    )
    await user.click(screen.getByRole('button', { name: /help: insulin on board/i }))
    expect(screen.getByText('Insulin on Board')).toBeInTheDocument()
    expect(screen.getByText('IOB explanation here.')).toBeInTheDocument()
  })

  it('closes on Escape', async () => {
    const user = userEvent.setup()
    render(
      <HelpPopover title="Test Title">
        <p>Some content</p>
      </HelpPopover>,
    )
    await user.click(screen.getByRole('button', { name: /help: test title/i }))
    expect(screen.getByText('Test Title')).toBeInTheDocument()
    await user.keyboard('{Escape}')
    expect(screen.queryByText('Test Title')).not.toBeInTheDocument()
  })

  it('trigger is keyboard accessible via Enter', async () => {
    const user = userEvent.setup()
    render(
      <HelpPopover title="KB Title">
        <p>KB content</p>
      </HelpPopover>,
    )
    await user.tab()
    await user.keyboard('{Enter}')
    expect(screen.getByText('KB Title')).toBeInTheDocument()
  })
})

describe('HelpFormula', () => {
  it('renders formula in a code element', () => {
    render(<HelpFormula>eAG = avg(glucose)</HelpFormula>)
    expect(screen.getByText('eAG = avg(glucose)')).toBeInTheDocument()
  })
})
