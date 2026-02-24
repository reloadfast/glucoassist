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
import { postHealth } from '@/lib/api'

function localNow(): string {
  const now = new Date()
  return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
}

interface Props {
  onSuccess: () => void
}

export default function LogHealthDialog({ onSuccess }: Props) {
  const [open, setOpen] = useState(false)
  const [heartRate, setHeartRate] = useState('')
  const [weight, setWeight] = useState('')
  const [activityType, setActivityType] = useState('')
  const [activityMinutes, setActivityMinutes] = useState('')
  const [notes, setNotes] = useState('')
  const [timestamp, setTimestamp] = useState(localNow)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    try {
      await postHealth({
        timestamp: new Date(timestamp).toISOString(),
        heart_rate_bpm: heartRate ? parseInt(heartRate) : undefined,
        weight_kg: weight ? parseFloat(weight) : undefined,
        activity_type: activityType || undefined,
        activity_minutes: activityMinutes ? parseInt(activityMinutes) : undefined,
        notes: notes || undefined,
      })
      setOpen(false)
      onSuccess()
      setHeartRate('')
      setWeight('')
      setActivityType('')
      setActivityMinutes('')
      setNotes('')
      setTimestamp(localNow())
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          Log Health
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Log Health Metric</DialogTitle>
        </DialogHeader>
        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="health-time">Time</Label>
            <Input
              id="health-time"
              type="datetime-local"
              required
              value={timestamp}
              onChange={(e) => setTimestamp(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="hr">Heart Rate (bpm)</Label>
            <Input
              id="hr"
              type="number"
              min="20"
              max="300"
              value={heartRate}
              onChange={(e) => setHeartRate(e.target.value)}
              placeholder="e.g. 72"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="weight">Weight (kg)</Label>
            <Input
              id="weight"
              type="number"
              step="0.1"
              min="10"
              max="500"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              placeholder="e.g. 75.5"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="activity-type">Activity</Label>
            <Input
              id="activity-type"
              value={activityType}
              onChange={(e) => setActivityType(e.target.value)}
              placeholder="e.g. walking"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="activity-min">Duration (min)</Label>
            <Input
              id="activity-min"
              type="number"
              min="0"
              max="1440"
              value={activityMinutes}
              onChange={(e) => setActivityMinutes(e.target.value)}
              placeholder="e.g. 30"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="health-notes">Notes (optional)</Label>
            <Input id="health-notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting ? 'Saving…' : 'Save'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
