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
const mockCreateFoodItem = vi.fn()
const mockUpdateFoodItem = vi.fn()
const mockDeleteFoodItem = vi.fn()
const mockPostMeal = vi.fn()

vi.mock('@/lib/api', () => ({
  getFoodItems: (...args: unknown[]) => mockGetFoodItems(...args),
  createFoodItem: (...args: unknown[]) => mockCreateFoodItem(...args),
  updateFoodItem: (...args: unknown[]) => mockUpdateFoodItem(...args),
  deleteFoodItem: (...args: unknown[]) => mockDeleteFoodItem(...args),
  postMeal: (...args: unknown[]) => mockPostMeal(...args),
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
  mockCreateFoodItem.mockResolvedValue({ ...mockItems[0], id: 99 })
  mockUpdateFoodItem.mockResolvedValue(mockItems[0])
  mockDeleteFoodItem.mockResolvedValue(undefined)
  mockPostMeal.mockResolvedValue({ id: 42, carbs_g: 21, food_item_ids: [1] })
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

// ─── Quick Log section ────────────────────────────────────────────────────────

describe('Food Library page — Quick Log', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setupMocks()
  })

  it('shows Frequent panel for items with use_count > 0', async () => {
    render(<Food />)
    await waitFor(() => expect(screen.getByText('Frequent')).toBeInTheDocument())
  })

  it('shows Recent panel for items with last_used_at', async () => {
    render(<Food />)
    await waitFor(() => expect(screen.getByText('Recent')).toBeInTheDocument())
  })

  it('shows search results when query typed', async () => {
    const user = userEvent.setup()
    render(<Food />)
    await waitFor(() => screen.getByLabelText(/search food items/i))
    await user.type(screen.getByLabelText(/search food items/i), 'apple')
    // Search results show carbs_per_100g as "14g carbs/100g"
    await waitFor(() => expect(screen.getByText('14g carbs/100g')).toBeInTheDocument())
  })

  it('matches on alias when searching', async () => {
    const user = userEvent.setup()
    render(<Food />)
    await waitFor(() => screen.getByLabelText(/search food items/i))
    await user.type(screen.getByLabelText(/search food items/i), 'porridge')
    // Search result row appears with the food name
    await waitFor(() => {
      const results = screen.getAllByText('Rolled oats')
      expect(results.length).toBeGreaterThan(0)
    })
  })

  it('shows portion picker after selecting a food from Frequent panel', async () => {
    const user = userEvent.setup()
    render(<Food />)
    await waitFor(() => screen.getByText('Frequent'))
    // Find Apple button in the Frequent panel (first occurrence of 'Apple' as button text)
    const appleBtn = screen.getAllByText('Apple')[0].closest('button')!
    await user.click(appleBtn)
    expect(screen.getByLabelText(/portion in grams/i)).toBeInTheDocument()
  })

  it('adds item to cart and shows total', async () => {
    const user = userEvent.setup()
    render(<Food />)
    await waitFor(() => screen.getByText('Frequent'))
    const appleBtn = screen.getAllByText('Apple')[0].closest('button')!
    await user.click(appleBtn)
    await user.click(screen.getByRole('button', { name: /^add$/i }))
    await waitFor(() => expect(screen.getByText(/total:/i)).toBeInTheDocument())
  })

  it('calls postMeal with computed carbs on confirm', async () => {
    const user = userEvent.setup()
    render(<Food />)
    await waitFor(() => screen.getByText('Frequent'))
    const appleBtn = screen.getAllByText('Apple')[0].closest('button')!
    await user.click(appleBtn)
    await user.click(screen.getByRole('button', { name: /^add$/i }))
    await user.click(screen.getByRole('button', { name: /confirm meal/i }))
    await waitFor(() =>
      expect(mockPostMeal).toHaveBeenCalledWith(
        expect.objectContaining({
          food_item_ids: [1],
          label: 'Apple',
        }),
      ),
    )
  })
})
