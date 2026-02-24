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
import { postInsulin, postMeal } from '@/lib/api'

function localNow(): string {
  const now = new Date()
  return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
}

interface Props {
  onSuccess: () => void
}

export default function LogMealInsulinDialog({ onSuccess }: Props) {
  const [open, setOpen] = useState(false)
  const [carbs, setCarbs] = useState('')
  const [label, setLabel] = useState('')
  const [notes, setNotes] = useState('')
  const [timestamp, setTimestamp] = useState(localNow)
  const [insulinUnits, setInsulinUnits] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    try {
      const ts = new Date(timestamp).toISOString()
      await postMeal({
        timestamp: ts,
        carbs_g: parseFloat(carbs),
        label: label || undefined,
        notes: notes || undefined,
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
      onSuccess()
      setCarbs('')
      setLabel('')
      setNotes('')
      setInsulinUnits('')
      setTimestamp(localNow())
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
          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting ? 'Saving…' : 'Save'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
