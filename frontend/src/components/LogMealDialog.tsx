import { useState } from 'react'
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
import { postMeal } from '@/lib/api'

interface Props {
  onSuccess: () => void
}

export default function LogMealDialog({ onSuccess }: Props) {
  const [open, setOpen] = useState(false)
  const [carbs, setCarbs] = useState('')
  const [label, setLabel] = useState('')
  const [notes, setNotes] = useState('')
  const [timestamp, setTimestamp] = useState(() => new Date().toISOString().slice(0, 16))
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    try {
      await postMeal({
        timestamp: new Date(timestamp).toISOString(),
        carbs_g: parseFloat(carbs),
        label: label || undefined,
        notes: notes || undefined,
      })
      setOpen(false)
      onSuccess()
      setCarbs('')
      setLabel('')
      setNotes('')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          Log Meal
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Log Meal</DialogTitle>
        </DialogHeader>
        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="carbs">Carbs (g)</Label>
            <Input
              id="carbs"
              type="number"
              step="1"
              min="0"
              max="500"
              required
              value={carbs}
              onChange={(e) => setCarbs(e.target.value)}
              placeholder="e.g. 45"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="meal-label">Label (optional)</Label>
            <Input
              id="meal-label"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. Lunch"
            />
          </div>
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
          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting ? 'Saving…' : 'Save'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
