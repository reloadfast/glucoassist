import { Pencil, Plus, Search, Trash2, X } from 'lucide-react'
import { useMemo, useRef, useState } from 'react'

import { HelpPopover } from '@/components/HelpPopover'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { useFoodLibrary } from '@/hooks/useFoodLibrary'
import { createFoodItem, deleteFoodItem, postMeal, updateFoodItem } from '@/lib/api'
import type { FoodItem, FoodItemCreate } from '@/lib/api'

// ─── helpers ─────────────────────────────────────────────────────────────────

function computeCarbs(item: FoodItem, portionG: number): number {
  return Math.round((portionG / 100) * item.carbs_per_100g * 10) / 10
}

function fuzzyMatch(item: FoodItem, q: string): boolean {
  const lower = q.toLowerCase()
  return (
    item.name.toLowerCase().includes(lower) ||
    item.aliases.some((a) => a.toLowerCase().includes(lower))
  )
}

// ─── Cart item ───────────────────────────────────────────────────────────────

interface CartEntry {
  food: FoodItem
  portionG: number
  carbsG: number
}

// ─── Food item form (create / edit) ──────────────────────────────────────────

interface FoodFormState {
  name: string
  carbs_per_100g: string
  default_portion_g: string
  aliases: string // comma-separated
}

function emptyForm(): FoodFormState {
  return { name: '', carbs_per_100g: '', default_portion_g: '100', aliases: '' }
}

function itemToForm(item: FoodItem): FoodFormState {
  return {
    name: item.name,
    carbs_per_100g: String(item.carbs_per_100g),
    default_portion_g: String(item.default_portion_g),
    aliases: item.aliases.join(', '),
  }
}

function formToPayload(form: FoodFormState): FoodItemCreate {
  return {
    name: form.name.trim(),
    carbs_per_100g: parseFloat(form.carbs_per_100g) || 0,
    default_portion_g: parseFloat(form.default_portion_g) || 100,
    aliases: form.aliases
      .split(',')
      .map((a) => a.trim())
      .filter(Boolean),
  }
}

interface FoodFormProps {
  initial: FoodFormState
  onSave: (payload: FoodItemCreate) => Promise<void>
  onCancel: () => void
  saving: boolean
}

function FoodForm({ initial, onSave, onCancel, saving }: FoodFormProps) {
  const [form, setForm] = useState<FoodFormState>(initial)

  function set(key: keyof FoodFormState, value: string) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  function valid() {
    return (
      form.name.trim().length > 0 &&
      !isNaN(parseFloat(form.carbs_per_100g)) &&
      !isNaN(parseFloat(form.default_portion_g))
    )
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <Label htmlFor="food-name">Name</Label>
          <Input
            id="food-name"
            value={form.name}
            onChange={(e) => set('name', e.target.value)}
            placeholder="e.g. Rolled oats"
          />
        </div>
        <div>
          <Label htmlFor="food-carbs">Carbs per 100g</Label>
          <Input
            id="food-carbs"
            type="number"
            min={0}
            max={100}
            step={0.1}
            value={form.carbs_per_100g}
            onChange={(e) => set('carbs_per_100g', e.target.value)}
            placeholder="e.g. 66"
          />
        </div>
        <div>
          <Label htmlFor="food-portion">Default portion (g)</Label>
          <Input
            id="food-portion"
            type="number"
            min={1}
            max={2000}
            step={1}
            value={form.default_portion_g}
            onChange={(e) => set('default_portion_g', e.target.value)}
            placeholder="e.g. 80"
          />
        </div>
        <div className="col-span-2">
          <Label htmlFor="food-aliases">
            Aliases <span className="text-muted-foreground font-normal">(comma-separated)</span>
          </Label>
          <Input
            id="food-aliases"
            value={form.aliases}
            onChange={(e) => set('aliases', e.target.value)}
            placeholder="e.g. oats, porridge"
          />
        </div>
      </div>
      <div className="flex gap-2">
        <Button
          size="sm"
          disabled={!valid() || saving}
          onClick={() => void onSave(formToPayload(form))}
        >
          {saving ? 'Saving…' : 'Save'}
        </Button>
        <Button size="sm" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  )
}

// ─── Portion entry dialog (inline) ───────────────────────────────────────────

interface PortionPickerProps {
  food: FoodItem
  onAdd: (entry: CartEntry) => void
  onCancel: () => void
}

function PortionPicker({ food, onAdd, onCancel }: PortionPickerProps) {
  const [portionG, setPortionG] = useState(food.default_portion_g)
  const carbs = computeCarbs(food, portionG)

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-sm font-medium">{food.name}</span>
      <Input
        type="number"
        min={1}
        max={2000}
        step={1}
        value={portionG}
        onChange={(e) => setPortionG(parseFloat(e.target.value) || 0)}
        className="w-20 h-7 text-sm"
        aria-label="Portion in grams"
      />
      <span className="text-sm text-muted-foreground">g → {carbs}g carbs</span>
      <Button size="sm" className="h-7" onClick={() => onAdd({ food, portionG, carbsG: carbs })}>
        Add
      </Button>
      <Button size="sm" variant="ghost" className="h-7" onClick={onCancel}>
        <X className="h-3 w-3" />
      </Button>
    </div>
  )
}

// ─── Quick log panel ─────────────────────────────────────────────────────────

interface QuickLogPanelProps {
  items: FoodItem[]
  onMealLogged: () => void
}

function QuickLogPanel({ items, onMealLogged }: QuickLogPanelProps) {
  const [query, setQuery] = useState('')
  const [picking, setPicking] = useState<FoodItem | null>(null)
  const [cart, setCart] = useState<CartEntry[]>([])
  const [logging, setLogging] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  const totalCarbs = cart.reduce((s, e) => s + e.carbsG, 0)

  const frequent = useMemo(() => items.filter((i) => i.use_count > 0).slice(0, 5), [items])
  const recent = useMemo(() => {
    return [...items]
      .filter((i) => i.last_used_at != null)
      .sort((a, b) => (b.last_used_at ?? '').localeCompare(a.last_used_at ?? ''))
      .slice(0, 5)
  }, [items])

  const searchResults = useMemo(() => {
    if (!query.trim()) return []
    return items.filter((i) => fuzzyMatch(i, query)).slice(0, 10)
  }, [items, query])

  function selectFood(food: FoodItem) {
    setQuery('')
    setPicking(food)
  }

  function addToCart(entry: CartEntry) {
    setCart((c) => [...c, entry])
    setPicking(null)
    searchRef.current?.focus()
  }

  function removeFromCart(idx: number) {
    setCart((c) => c.filter((_, i) => i !== idx))
  }

  async function confirmMeal() {
    if (cart.length === 0) return
    setLogging(true)
    setMsg(null)
    try {
      const label = cart.map((e) => e.food.name).join(', ')
      await postMeal({
        timestamp: new Date().toISOString(),
        carbs_g: Math.round(totalCarbs * 10) / 10,
        label,
        food_item_ids: cart.map((e) => e.food.id),
      })
      setCart([])
      setMsg(`Logged: ${label} (${Math.round(totalCarbs * 10) / 10}g carbs)`)
      onMealLogged()
    } catch {
      setMsg('Failed to log meal — check that the backend is reachable.')
    } finally {
      setLogging(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
        <Input
          ref={searchRef}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setPicking(null)
          }}
          placeholder="Search foods by name or alias…"
          className="pl-8"
          aria-label="Search food items"
        />
      </div>

      {/* Portion picker */}
      {picking && (
        <div className="rounded-md border p-3 bg-muted/40">
          <PortionPicker food={picking} onAdd={addToCart} onCancel={() => setPicking(null)} />
        </div>
      )}

      {/* Search results */}
      {query.trim() && !picking && (
        <div className="rounded-md border divide-y">
          {searchResults.length === 0 ? (
            <p className="text-sm text-muted-foreground px-3 py-2">No matches.</p>
          ) : (
            searchResults.map((item) => (
              <button
                key={item.id}
                className="w-full text-left px-3 py-2 text-sm hover:bg-accent transition-colors flex items-center justify-between"
                onClick={() => selectFood(item)}
              >
                <span>{item.name}</span>
                <span className="text-muted-foreground">{item.carbs_per_100g}g carbs/100g</span>
              </button>
            ))
          )}
        </div>
      )}

      {/* Frequent / Recent panels */}
      {!query.trim() && !picking && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {frequent.length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1 uppercase tracking-wide">
                Frequent
              </p>
              <div className="rounded-md border divide-y">
                {frequent.map((item) => (
                  <button
                    key={item.id}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-accent transition-colors flex items-center justify-between"
                    onClick={() => selectFood(item)}
                  >
                    <span>{item.name}</span>
                    <span className="text-muted-foreground text-xs">×{item.use_count}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
          {recent.length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1 uppercase tracking-wide">
                Recent
              </p>
              <div className="rounded-md border divide-y">
                {recent.map((item) => (
                  <button
                    key={item.id}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-accent transition-colors flex items-center justify-between"
                    onClick={() => selectFood(item)}
                  >
                    <span>{item.name}</span>
                    <span className="text-muted-foreground">{item.carbs_per_100g}g/100g</span>
                  </button>
                ))}
              </div>
            </div>
          )}
          {frequent.length === 0 && recent.length === 0 && items.length > 0 && (
            <p className="text-sm text-muted-foreground col-span-2">
              Search above or add foods to your library to get started.
            </p>
          )}
          {items.length === 0 && (
            <p className="text-sm text-muted-foreground col-span-2">
              No foods saved yet. Add some in the Library section below.
            </p>
          )}
        </div>
      )}

      {/* Cart */}
      {cart.length > 0 && (
        <div className="rounded-md border divide-y">
          {cart.map((entry, idx) => (
            <div key={idx} className="flex items-center justify-between px-3 py-2 text-sm">
              <span>
                {entry.food.name}{' '}
                <span className="text-muted-foreground">
                  {entry.portionG}g → {entry.carbsG}g carbs
                </span>
              </span>
              <button
                aria-label={`Remove ${entry.food.name}`}
                onClick={() => removeFromCart(idx)}
                className="text-muted-foreground hover:text-destructive"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
          <div className="px-3 py-2 flex items-center justify-between bg-muted/30">
            <span className="text-sm font-semibold">
              Total: {Math.round(totalCarbs * 10) / 10}g carbs
            </span>
            <Button size="sm" disabled={logging} onClick={() => void confirmMeal()}>
              {logging ? 'Logging…' : 'Confirm meal'}
            </Button>
          </div>
        </div>
      )}

      {msg && <p className="text-sm text-muted-foreground">{msg}</p>}
    </div>
  )
}

// ─── Library management ───────────────────────────────────────────────────────

interface LibraryPanelProps {
  items: FoodItem[]
  loading: boolean
  error: string | null
  onRefresh: () => void
}

function LibraryPanel({ items, loading, error, onRefresh }: LibraryPanelProps) {
  const [adding, setAdding] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)

  async function handleCreate(payload: FoodItemCreate) {
    setSaving(true)
    try {
      await createFoodItem(payload)
      setAdding(false)
      onRefresh()
    } catch {
      // leave form open
    } finally {
      setSaving(false)
    }
  }

  async function handleUpdate(id: number, payload: FoodItemCreate) {
    setSaving(true)
    try {
      await updateFoodItem(id, payload)
      setEditingId(null)
      onRefresh()
    } catch {
      // leave form open
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(item: FoodItem) {
    if (!window.confirm(`Delete "${item.name}"? This cannot be undone.`)) return
    try {
      await deleteFoodItem(item.id)
      onRefresh()
    } catch {
      // silent — item still visible until next refresh
    }
  }

  return (
    <div className="space-y-3">
      {/* Add new */}
      {adding ? (
        <div className="rounded-md border p-4">
          <p className="text-sm font-medium mb-3">New food item</p>
          <FoodForm
            initial={emptyForm()}
            onSave={handleCreate}
            onCancel={() => setAdding(false)}
            saving={saving}
          />
        </div>
      ) : (
        <Button size="sm" variant="outline" onClick={() => setAdding(true)}>
          <Plus className="h-3.5 w-3.5 mr-1" />
          Add food
        </Button>
      )}

      {/* List */}
      {loading ? (
        <div className="space-y-2">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
        </div>
      ) : error ? (
        <p className="text-sm text-destructive">{error}</p>
      ) : items.length === 0 && !adding ? (
        <p className="text-sm text-muted-foreground">
          No foods saved yet. Click "Add food" to build your library.
        </p>
      ) : (
        <div className="rounded-md border divide-y">
          {items.map((item) => (
            <div key={item.id}>
              {editingId === item.id ? (
                <div className="p-4">
                  <FoodForm
                    initial={itemToForm(item)}
                    onSave={(payload) => handleUpdate(item.id, payload)}
                    onCancel={() => setEditingId(null)}
                    saving={saving}
                  />
                </div>
              ) : (
                <div className="flex items-center justify-between px-3 py-2 text-sm">
                  <div>
                    <span className="font-medium">{item.name}</span>
                    <span className="text-muted-foreground ml-2">
                      {item.carbs_per_100g}g carbs/100g · default {item.default_portion_g}g
                    </span>
                    {item.aliases.length > 0 && (
                      <span className="text-muted-foreground ml-1">
                        ({item.aliases.join(', ')})
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-muted-foreground mr-1">×{item.use_count}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      aria-label={`Edit ${item.name}`}
                      onClick={() => setEditingId(item.id)}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-destructive"
                      aria-label={`Delete ${item.name}`}
                      onClick={() => void handleDelete(item)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Food() {
  const { items, loading, error, refresh } = useFoodLibrary()

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold tracking-tight">Food Library</h1>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-1">
            Quick Log
            <HelpPopover title="Quick log">
              <p>
                Search your saved foods by name or alias, enter the portion in grams, and add
                multiple items to a single meal. The carb total is calculated automatically from
                your carbs-per-100g values. Confirm to log the meal.
              </p>
            </HelpPopover>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <QuickLogPanel items={items} onMealLogged={refresh} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-1">
            Library
            <HelpPopover title="Food library">
              <p>
                Your personal collection of foods with carb values. Sorted by how often you use
                them. Each confirmed quick-log entry automatically updates the use count and last
                used date.
              </p>
            </HelpPopover>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <LibraryPanel items={items} loading={loading} error={error} onRefresh={refresh} />
        </CardContent>
      </Card>
    </div>
  )
}
