import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi, beforeEach } from 'vitest'

// ─── mocks ───────────────────────────────────────────────────────────────────

const mockItems = [
  {
    id: 1,
    name: 'Apple',
    carbs_per_100g: 14,
    default_portion_g: 150,
    aliases: ['apples'],
    created_at: '2026-01-01T00:00:00Z',
    last_used_at: null,
    use_count: 3,
  },
  {
    id: 2,
    name: 'Rolled oats',
    carbs_per_100g: 66,
    default_portion_g: 80,
    aliases: ['oats', 'porridge'],
    created_at: '2026-01-01T00:00:00Z',
    last_used_at: '2026-02-28T08:00:00Z',
    use_count: 1,
  },
]

const mockGetFoodItems = vi.fn()
const mockGetFoodSuggestions = vi.fn()
const mockCreateFoodItem = vi.fn()
const mockUpdateFoodItem = vi.fn()
const mockDeleteFoodItem = vi.fn()
const mockPostMeal = vi.fn()
const mockPostInsulin = vi.fn()

vi.mock('@/lib/api', () => ({
  getFoodItems: (...args: unknown[]) => mockGetFoodItems(...args),
  getFoodSuggestions: (...args: unknown[]) => mockGetFoodSuggestions(...args),
  createFoodItem: (...args: unknown[]) => mockCreateFoodItem(...args),
  updateFoodItem: (...args: unknown[]) => mockUpdateFoodItem(...args),
  deleteFoodItem: (...args: unknown[]) => mockDeleteFoodItem(...args),
  postMeal: (...args: unknown[]) => mockPostMeal(...args),
  postInsulin: (...args: unknown[]) => mockPostInsulin(...args),
}))

vi.mock('react-router-dom', () => ({
  NavLink: ({ children, to }: { children: React.ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
  Outlet: () => <div />,
}))

vi.mock('@/components/ThemeProvider', () => ({
  useTheme: () => ({ theme: 'system', resolvedTheme: 'light', setTheme: vi.fn() }),
}))

// ─── imports after mocks ─────────────────────────────────────────────────────

import Food from '@/pages/Food'

// ─── helpers ─────────────────────────────────────────────────────────────────

function setupMocks() {
  mockGetFoodItems.mockResolvedValue({ items: mockItems, count: mockItems.length })
  mockGetFoodSuggestions.mockResolvedValue({ items: [], count: 0 })
  mockCreateFoodItem.mockResolvedValue({ ...mockItems[0], id: 99 })
  mockUpdateFoodItem.mockResolvedValue(mockItems[0])
  mockDeleteFoodItem.mockResolvedValue(undefined)
  mockPostMeal.mockResolvedValue({ id: 42, carbs_g: 21, food_item_ids: [1] })
  mockPostInsulin.mockResolvedValue({ id: 10 })
}

// Wait until Library section is fully loaded (edit buttons are unique to Library)
async function waitForLibraryLoaded() {
  await waitFor(() =>
    expect(screen.getByRole('button', { name: /edit apple/i })).toBeInTheDocument(),
  )
}

// ─── Library section ─────────────────────────────────────────────────────────

describe('Food Library page — Library section', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setupMocks()
  })

  it('renders page heading', () => {
    render(<Food />)
    expect(screen.getByRole('heading', { name: /food library/i })).toBeInTheDocument()
  })

  it('shows food items after loading', async () => {
    render(<Food />)
    await waitForLibraryLoaded()
    // Library panel renders each item with "Xg carbs/100g · default Yg" pattern
    expect(screen.getByText(/14g carbs\/100g · default 150g/)).toBeInTheDocument()
    expect(screen.getByText(/66g carbs\/100g · default 80g/)).toBeInTheDocument()
  })

  it('shows use count badges in library', async () => {
    render(<Food />)
    await waitForLibraryLoaded()
    // Library rows show ×N use count badges; Apple has 3, Oats has 1
    const useCountBadges = screen.getAllByText(/×\d+/)
    const values = useCountBadges.map((el) => el.textContent)
    expect(values).toContain('×3')
  })

  it('opens add form on "Add food" click', async () => {
    const user = userEvent.setup()
    render(<Food />)
    await waitFor(() => screen.getByText('Add food'))
    await user.click(screen.getByText('Add food'))
    expect(screen.getByLabelText('Name')).toBeInTheDocument()
  })

  it('submits create form', async () => {
    const user = userEvent.setup()
    render(<Food />)
    await waitFor(() => screen.getByText('Add food'))
    await user.click(screen.getByText('Add food'))

    await user.type(screen.getByLabelText('Name'), 'Banana')
    await user.clear(screen.getByLabelText('Carbs per 100g'))
    await user.type(screen.getByLabelText('Carbs per 100g'), '22')
    await user.click(screen.getByRole('button', { name: /^save$/i }))

    await waitFor(() =>
      expect(mockCreateFoodItem).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Banana', carbs_per_100g: 22 }),
      ),
    )
  })

  it('opens edit form on pencil click', async () => {
    const user = userEvent.setup()
    render(<Food />)
    await waitForLibraryLoaded()
    await user.click(screen.getByRole('button', { name: /edit apple/i }))
    expect(screen.getByDisplayValue('Apple')).toBeInTheDocument()
  })

  it('calls deleteFoodItem with confirm', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    const user = userEvent.setup()
    render(<Food />)
    await waitForLibraryLoaded()
    await user.click(screen.getByRole('button', { name: /delete apple/i }))
    await waitFor(() => expect(mockDeleteFoodItem).toHaveBeenCalledWith(1))
  })

  it('does not delete when confirm is cancelled', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    const user = userEvent.setup()
    render(<Food />)
    await waitForLibraryLoaded()
    await user.click(screen.getByRole('button', { name: /delete apple/i }))
    expect(mockDeleteFoodItem).not.toHaveBeenCalled()
  })
})

// ─── Log Meal card section ────────────────────────────────────────────────────

describe('Food Library page — Log Meal card', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setupMocks()
  })

  it('shows Log Meal card content on page', async () => {
    render(<Food />)
    // Card description text is always present on page load
    await waitFor(() =>
      expect(screen.getByText(/log a meal using your food library/i)).toBeInTheDocument(),
    )
  })

  it('shows "Log Meal" trigger button on the page', async () => {
    render(<Food />)
    // The dialog trigger button text is exactly "Log Meal";
    // HelpPopover has aria-label "Help: Log meal" — use exact-start match to distinguish.
    await waitFor(() => {
      const btns = screen.getAllByRole('button', { name: /^log meal$/i })
      expect(btns.length).toBeGreaterThan(0)
    })
  })

  it('opens LogMealDialog when trigger clicked', async () => {
    const user = userEvent.setup()
    render(<Food />)
    await waitFor(() => screen.getAllByRole('button', { name: /^log meal$/i }))
    const triggerBtn = screen.getAllByRole('button', { name: /^log meal$/i })[0]
    await user.click(triggerBtn)
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument())
  })
})
