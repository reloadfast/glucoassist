import { render, screen, waitFor, within } from '@testing-library/react'
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
const mockPostMeal = vi.fn()
const mockPostInsulin = vi.fn()

vi.mock('@/lib/api', () => ({
  getFoodItems: (...args: unknown[]) => mockGetFoodItems(...args),
  getFoodSuggestions: (...args: unknown[]) => mockGetFoodSuggestions(...args),
  createFoodItem: (...args: unknown[]) => mockCreateFoodItem(...args),
  postMeal: (...args: unknown[]) => mockPostMeal(...args),
  postInsulin: (...args: unknown[]) => mockPostInsulin(...args),
}))

vi.mock('@/components/ThemeProvider', () => ({
  useTheme: () => ({ theme: 'system', resolvedTheme: 'light', setTheme: vi.fn() }),
}))

// ─── import after mocks ───────────────────────────────────────────────────────

import LogMealDialog from '@/components/LogMealDialog'

// ─── helpers ──────────────────────────────────────────────────────────────────

function setupMocks() {
  mockGetFoodItems.mockResolvedValue({ items: mockItems, count: mockItems.length })
  mockGetFoodSuggestions.mockResolvedValue({ items: [], count: 0 })
  mockCreateFoodItem.mockResolvedValue({ ...mockItems[0], id: 99, name: 'NewFood' })
  mockPostMeal.mockResolvedValue({ id: 42 })
  mockPostInsulin.mockResolvedValue({ id: 10 })
}

async function openDialog() {
  const user = userEvent.setup()
  render(<LogMealDialog onSuccess={vi.fn()} />)
  await user.click(screen.getByRole('button', { name: /log meal/i }))
  // Wait for dialog to open
  await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument())
  return user
}

// ─── tests ────────────────────────────────────────────────────────────────────

describe('LogMealDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setupMocks()
  })

  it('renders trigger button', () => {
    render(<LogMealDialog onSuccess={vi.fn()} />)
    expect(screen.getByRole('button', { name: /log meal/i })).toBeInTheDocument()
  })

  it('opens dialog on trigger click', async () => {
    await openDialog()
    expect(screen.getByRole('heading', { name: /log meal/i })).toBeInTheDocument()
  })

  it('shows search input in dialog', async () => {
    await openDialog()
    expect(screen.getByLabelText(/search food items/i)).toBeInTheDocument()
  })

  it('shows search results when typing', async () => {
    const user = await openDialog()
    await waitFor(() => expect(mockGetFoodItems).toHaveBeenCalled())
    await user.type(screen.getByLabelText(/search food items/i), 'apple')
    await waitFor(() => expect(screen.getByText('14g carbs/100g')).toBeInTheDocument())
  })

  it('matches on food alias in search', async () => {
    const user = await openDialog()
    await waitFor(() => expect(mockGetFoodItems).toHaveBeenCalled())
    await user.type(screen.getByLabelText(/search food items/i), 'porridge')
    await waitFor(() => {
      const dialog = screen.getByRole('dialog')
      expect(within(dialog).getByText('Rolled oats')).toBeInTheDocument()
    })
  })

  it('shows portion picker after selecting a food', async () => {
    const user = await openDialog()
    await waitFor(() => expect(mockGetFoodItems).toHaveBeenCalled())
    await user.type(screen.getByLabelText(/search food items/i), 'apple')
    await waitFor(() => screen.getByText('14g carbs/100g'))
    const appleBtn = screen.getByRole('button', { name: /apple/i })
    await user.click(appleBtn)
    expect(screen.getByLabelText(/portion in grams/i)).toBeInTheDocument()
  })

  it('adds food to cart', async () => {
    const user = await openDialog()
    await waitFor(() => expect(mockGetFoodItems).toHaveBeenCalled())
    await user.type(screen.getByLabelText(/search food items/i), 'apple')
    await waitFor(() => screen.getByText('14g carbs/100g'))
    await user.click(screen.getByRole('button', { name: /apple/i }))
    await user.click(screen.getByRole('button', { name: /^add$/i }))
    await waitFor(() => expect(screen.getByText(/total:/i)).toBeInTheDocument())
  })

  it('shows Create row when no search results', async () => {
    const user = await openDialog()
    await waitFor(() => expect(mockGetFoodItems).toHaveBeenCalled())
    await user.type(screen.getByLabelText(/search food items/i), 'unknownfoodxyz')
    await waitFor(() => expect(screen.getByTestId('create-food-row')).toBeInTheDocument())
  })

  it('shows inline create form when Create row clicked', async () => {
    const user = await openDialog()
    await waitFor(() => expect(mockGetFoodItems).toHaveBeenCalled())
    await user.type(screen.getByLabelText(/search food items/i), 'unknownfoodxyz')
    await waitFor(() => screen.getByTestId('create-food-row'))
    await user.click(screen.getByTestId('create-food-row'))
    expect(screen.getByLabelText(/carbs per 100g/i)).toBeInTheDocument()
  })

  it('creates food item and moves to portion picker', async () => {
    const user = await openDialog()
    await waitFor(() => expect(mockGetFoodItems).toHaveBeenCalled())
    await user.type(screen.getByLabelText(/search food items/i), 'NewFood')
    await waitFor(() => screen.getByTestId('create-food-row'))
    await user.click(screen.getByTestId('create-food-row'))

    await user.clear(screen.getByLabelText(/carbs per 100g/i))
    await user.type(screen.getByLabelText(/carbs per 100g/i), '25')
    await user.click(screen.getByRole('button', { name: /create & add/i }))

    await waitFor(() =>
      expect(mockCreateFoodItem).toHaveBeenCalledWith(
        expect.objectContaining({ carbs_per_100g: 25 }),
      ),
    )
    // Portion picker should appear after creation
    await waitFor(() => expect(screen.getByLabelText(/portion in grams/i)).toBeInTheDocument())
  })

  it('shows manual carbs input when cart is empty', async () => {
    await openDialog()
    expect(screen.getByLabelText(/carbs \(g\)/i)).toBeInTheDocument()
  })

  it('hides manual carbs input when cart has items', async () => {
    const user = await openDialog()
    await waitFor(() => expect(mockGetFoodItems).toHaveBeenCalled())
    await user.type(screen.getByLabelText(/search food items/i), 'apple')
    await waitFor(() => screen.getByText('14g carbs/100g'))
    await user.click(screen.getByRole('button', { name: /apple/i }))
    await user.click(screen.getByRole('button', { name: /^add$/i }))
    await waitFor(() => expect(screen.getByText(/total:/i)).toBeInTheDocument())
    expect(screen.queryByLabelText(/carbs \(g\)/i)).not.toBeInTheDocument()
  })

  it('submits meal with food_item_ids when cart non-empty', async () => {
    const user = await openDialog()
    await waitFor(() => expect(mockGetFoodItems).toHaveBeenCalled())
    await user.type(screen.getByLabelText(/search food items/i), 'apple')
    await waitFor(() => screen.getByText('14g carbs/100g'))
    await user.click(screen.getByRole('button', { name: /apple/i }))
    await user.click(screen.getByRole('button', { name: /^add$/i }))
    await waitFor(() => screen.getByText(/total:/i))
    await user.click(screen.getByRole('button', { name: /^save$/i }))
    await waitFor(() =>
      expect(mockPostMeal).toHaveBeenCalledWith(
        expect.objectContaining({ food_item_ids: [1], label: 'Apple' }),
      ),
    )
  })

  it('submits meal with manual carbs when cart is empty', async () => {
    const user = await openDialog()
    const carbsInput = screen.getByLabelText(/carbs \(g\)/i)
    await user.type(carbsInput, '30')
    await user.click(screen.getByRole('button', { name: /^save$/i }))
    await waitFor(() =>
      expect(mockPostMeal).toHaveBeenCalledWith(expect.objectContaining({ carbs_g: 30 })),
    )
    expect(mockPostMeal.mock.calls[0][0].food_item_ids).toBeUndefined()
  })

  it('also posts insulin when units entered', async () => {
    const user = await openDialog()
    await user.type(screen.getByLabelText(/carbs \(g\)/i), '40')
    await user.type(screen.getByLabelText(/rapid insulin/i), '4')
    await user.click(screen.getByRole('button', { name: /^save$/i }))
    await waitFor(() => expect(mockPostMeal).toHaveBeenCalled())
    await waitFor(() =>
      expect(mockPostInsulin).toHaveBeenCalledWith(
        expect.objectContaining({ units: 4, type: 'rapid' }),
      ),
    )
  })

  it('does not post insulin when units not entered', async () => {
    const user = await openDialog()
    await user.type(screen.getByLabelText(/carbs \(g\)/i), '40')
    await user.click(screen.getByRole('button', { name: /^save$/i }))
    await waitFor(() => expect(mockPostMeal).toHaveBeenCalled())
    expect(mockPostInsulin).not.toHaveBeenCalled()
  })

  it('save button is disabled when no carbs provided', async () => {
    await openDialog()
    const saveBtn = screen.getByRole('button', { name: /^save$/i })
    expect(saveBtn).toBeDisabled()
  })

  it('shows time-of-day suggestions when available', async () => {
    mockGetFoodSuggestions.mockResolvedValue({ items: [mockItems[0]], count: 1 })
    await openDialog()
    await waitFor(() => expect(screen.getByText(/suggested for this time/i)).toBeInTheDocument())
  })

  it('accepts custom trigger element', () => {
    render(<LogMealDialog onSuccess={vi.fn()} trigger={<button>Custom Trigger</button>} />)
    expect(screen.getByRole('button', { name: /custom trigger/i })).toBeInTheDocument()
  })
})
