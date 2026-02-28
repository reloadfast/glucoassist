import { Pencil, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'

import { HelpPopover } from '@/components/HelpPopover'
import LogMealDialog from '@/components/LogMealDialog'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { useFoodLibrary } from '@/hooks/useFoodLibrary'
import { createFoodItem, deleteFoodItem, updateFoodItem } from '@/lib/api'
import type { FoodItem, FoodItemCreate } from '@/lib/api'

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
            Log Meal
            <HelpPopover title="Log meal">
              <p>
                Search your saved foods by name or alias, pick a portion, and add multiple items to
                a single meal. The carb total is calculated automatically. You can also enter carbs
                manually or add insulin taken. New foods can be created inline.
              </p>
            </HelpPopover>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3">
            <LogMealDialog onSuccess={refresh} />
            <p className="text-sm text-muted-foreground">
              Log a meal using your food library or enter carbs manually.
            </p>
          </div>
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
