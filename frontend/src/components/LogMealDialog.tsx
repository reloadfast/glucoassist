import { Search, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useFoodLibrary } from '@/hooks/useFoodLibrary'
import { createFoodItem, getFoodSuggestions, postInsulin, postMeal } from '@/lib/api'
import type { FoodItem, FoodItemCreate } from '@/lib/api'

// ─── helpers ─────────────────────────────────────────────────────────────────

function localNow(): string {
  const now = new Date()
  return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
}

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

// ─── Types ────────────────────────────────────────────────────────────────────

interface CartEntry {
  food: FoodItem
  portionG: number
  carbsG: number
}

// ─── PortionPicker ────────────────────────────────────────────────────────────

interface PortionPickerProps {
  food: FoodItem
  onAdd: (entry: CartEntry) => void
  onCancel: () => void
}

function PortionPicker({ food, onAdd, onCancel }: PortionPickerProps) {
  const [portionG, setPortionG] = useState(food.default_portion_g)
  const carbs = computeCarbs(food, portionG)

  return (
    <div className="flex items-center gap-2 flex-wrap rounded-md border p-3 bg-muted/40">
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

// ─── Inline food creation mini-form ──────────────────────────────────────────

interface InlineCreateFormProps {
  initialName: string
  onCreated: (food: FoodItem) => void
  onCancel: () => void
}

function InlineCreateForm({ initialName, onCreated, onCancel }: InlineCreateFormProps) {
  const [name, setName] = useState(initialName)
  const [carbsPer100g, setCarbsPer100g] = useState('')
  const [defaultPortion, setDefaultPortion] = useState('100')
  const [saving, setSaving] = useState(false)

  const valid =
    name.trim().length > 0 && !isNaN(parseFloat(carbsPer100g)) && !isNaN(parseFloat(defaultPortion))

  async function handleSave() {
    if (!valid) return
    setSaving(true)
    try {
      const payload: FoodItemCreate = {
        name: name.trim(),
        carbs_per_100g: parseFloat(carbsPer100g),
        default_portion_g: parseFloat(defaultPortion) || 100,
        aliases: [],
      }
      const created = await createFoodItem(payload)
      onCreated(created)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="rounded-md border p-3 space-y-2 bg-muted/40">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
        New food item
      </p>
      <div className="grid grid-cols-2 gap-2">
        <div className="col-span-2">
          <Label htmlFor="new-food-name" className="text-xs">
            Name
          </Label>
          <Input
            id="new-food-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="h-7 text-sm"
          />
        </div>
        <div>
          <Label htmlFor="new-food-carbs" className="text-xs">
            Carbs per 100g
          </Label>
          <Input
            id="new-food-carbs"
            type="number"
            min={0}
            max={100}
            step={0.1}
            value={carbsPer100g}
            onChange={(e) => setCarbsPer100g(e.target.value)}
            placeholder="e.g. 45"
            className="h-7 text-sm"
          />
        </div>
        <div>
          <Label htmlFor="new-food-portion" className="text-xs">
            Default portion (g)
          </Label>
          <Input
            id="new-food-portion"
            type="number"
            min={1}
            max={2000}
            step={1}
            value={defaultPortion}
            onChange={(e) => setDefaultPortion(e.target.value)}
            className="h-7 text-sm"
          />
        </div>
      </div>
      <div className="flex gap-2">
        <Button size="sm" disabled={!valid || saving} onClick={() => void handleSave()}>
          {saving ? 'Saving…' : 'Create & add'}
        </Button>
        <Button size="sm" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  )
}

// ─── LogMealDialog ────────────────────────────────────────────────────────────

interface Props {
  onSuccess: () => void
  trigger?: React.ReactNode
}

export default function LogMealDialog({ onSuccess, trigger }: Props) {
  const [open, setOpen] = useState(false)

  // Cart
  const [cart, setCart] = useState<CartEntry[]>([])
  const [picking, setPicking] = useState<FoodItem | null>(null)

  // Search + create
  const [query, setQuery] = useState('')
  const [showCreateForm, setShowCreateForm] = useState(false)

  // Suggestions (time-of-day)
  const [suggestions, setSuggestions] = useState<FoodItem[]>([])

  // Manual carbs (fallback when cart is empty)
  const [manualCarbs, setManualCarbs] = useState('')

  // Meal metadata
  const [timestamp, setTimestamp] = useState(localNow)
  const [notes, setNotes] = useState('')
  const [insulinUnits, setInsulinUnits] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const { items: allFoods, refresh: refreshLibrary } = useFoodLibrary()
  const searchRef = useRef<HTMLInputElement>(null)

  // Load suggestions when dialog opens
  useEffect(() => {
    if (!open) return
    const hour = new Date().getHours()
    getFoodSuggestions(hour)
      .then((res) => setSuggestions(res.items))
      .catch(() => setSuggestions([]))
  }, [open])

  const searchResults = useMemo(() => {
    if (!query.trim()) return []
    return allFoods.filter((i) => fuzzyMatch(i, query)).slice(0, 10)
  }, [allFoods, query])

  const totalCarbs = cart.reduce((s, e) => s + e.carbsG, 0)

  function selectFood(food: FoodItem) {
    setQuery('')
    setShowCreateForm(false)
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

  function handleCreated(food: FoodItem) {
    setShowCreateForm(false)
    setQuery('')
    refreshLibrary()
    setPicking(food)
  }

  function resetState() {
    setCart([])
    setPicking(null)
    setQuery('')
    setShowCreateForm(false)
    setSuggestions([])
    setManualCarbs('')
    setTimestamp(localNow())
    setNotes('')
    setInsulinUnits('')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const carbsG = cart.length > 0 ? Math.round(totalCarbs * 10) / 10 : parseFloat(manualCarbs)

    if (!carbsG || isNaN(carbsG) || carbsG <= 0) return

    setSubmitting(true)
    try {
      const ts = new Date(timestamp).toISOString()
      const label = cart.length > 0 ? cart.map((e) => e.food.name).join(', ') : undefined
      await postMeal({
        timestamp: ts,
        carbs_g: carbsG,
        label,
        notes: notes || undefined,
        food_item_ids: cart.length > 0 ? cart.map((e) => e.food.id) : undefined,
      })
      if (insulinUnits) {
        await postInsulin({
          timestamp: ts,
          units: parseFloat(insulinUnits),
          type: 'rapid',
          notes: label ? `bolus for ${label}` : 'meal bolus',
        })
      }
      setOpen(false)
      resetState()
      onSuccess()
    } finally {
      setSubmitting(false)
    }
  }

  const showNoResults = query.trim() && !picking && searchResults.length === 0 && !showCreateForm
  const showSearchResults = query.trim() && !picking && searchResults.length > 0 && !showCreateForm
  const showSuggestions = !query.trim() && !picking && !showCreateForm && suggestions.length > 0
  const carbsValid = cart.length > 0 || (manualCarbs.trim() !== '' && parseFloat(manualCarbs) > 0)

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v)
        if (!v) resetState()
      }}
    >
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="outline" size="sm">
            Log Meal
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Log Meal</DialogTitle>
        </DialogHeader>

        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
          {/* ── Search ── */}
          <div className="space-y-1">
            <Label>Search food library</Label>
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
              <Input
                ref={searchRef}
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value)
                  setPicking(null)
                  setShowCreateForm(false)
                }}
                placeholder="Search foods by name or alias…"
                className="pl-8"
                aria-label="Search food items"
              />
            </div>
          </div>

          {/* ── Portion picker ── */}
          {picking && (
            <PortionPicker food={picking} onAdd={addToCart} onCancel={() => setPicking(null)} />
          )}

          {/* ── Search results ── */}
          {showSearchResults && (
            <div className="rounded-md border divide-y">
              {searchResults.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className="w-full text-left px-3 py-2 text-sm hover:bg-accent transition-colors flex items-center justify-between"
                  onClick={() => selectFood(item)}
                >
                  <span>{item.name}</span>
                  <span className="text-muted-foreground">{item.carbs_per_100g}g carbs/100g</span>
                </button>
              ))}
            </div>
          )}

          {/* ── No results: offer to create ── */}
          {showNoResults && (
            <div className="rounded-md border divide-y">
              <button
                type="button"
                className="w-full text-left px-3 py-2 text-sm hover:bg-accent transition-colors text-primary"
                onClick={() => setShowCreateForm(true)}
                data-testid="create-food-row"
              >
                + Create &quot;{query}&quot;
              </button>
            </div>
          )}

          {/* ── Inline create form ── */}
          {showCreateForm && (
            <InlineCreateForm
              initialName={query}
              onCreated={handleCreated}
              onCancel={() => setShowCreateForm(false)}
            />
          )}

          {/* ── Time-of-day suggestions ── */}
          {showSuggestions && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1 uppercase tracking-wide">
                Suggested for this time
              </p>
              <div className="rounded-md border divide-y">
                {suggestions.map((item) => (
                  <button
                    key={item.id}
                    type="button"
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

          {/* ── Cart ── */}
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
                    type="button"
                    aria-label={`Remove ${entry.food.name}`}
                    onClick={() => removeFromCart(idx)}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
              <div className="px-3 py-2 bg-muted/30 text-sm font-semibold">
                Total: {Math.round(totalCarbs * 10) / 10}g carbs
              </div>
            </div>
          )}

          {/* ── Manual carbs (only when cart is empty) ── */}
          {cart.length === 0 && (
            <div className="space-y-1">
              <Label htmlFor="manual-carbs">
                Carbs (g){' '}
                <span className="text-muted-foreground font-normal text-xs">
                  — or use library above
                </span>
              </Label>
              <Input
                id="manual-carbs"
                type="number"
                step="1"
                min="0"
                max="500"
                value={manualCarbs}
                onChange={(e) => setManualCarbs(e.target.value)}
                placeholder="e.g. 45"
              />
            </div>
          )}

          {/* ── Time + Notes ── */}
          <div className="space-y-1">
            <Label htmlFor="meal-time">Time</Label>
            <Input
              id="meal-time"
              type="datetime-local"
              required
              value={timestamp}
              onChange={(e) => setTimestamp(e.target.value)}
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="meal-notes">Notes (optional)</Label>
            <Input
              id="meal-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. pasta with salad"
            />
          </div>

          {/* ── Insulin ── */}
          <div className="border-t pt-3 space-y-1">
            <Label htmlFor="bolus-units">Rapid insulin taken (units, optional)</Label>
            <Input
              id="bolus-units"
              type="number"
              step="0.5"
              min="0.5"
              max="100"
              value={insulinUnits}
              onChange={(e) => setInsulinUnits(e.target.value)}
              placeholder="e.g. 4"
            />
          </div>

          <Button type="submit" className="w-full" disabled={submitting || !carbsValid}>
            {submitting ? 'Saving…' : 'Save'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
