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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { postInsulin } from '@/lib/api'
import { useTimezone } from '@/components/TimezoneProvider'
import { localNow, toUtcISO } from '@/lib/tz-utils'

interface Props {
  onSuccess: () => void
}

export default function LogInsulinDialog({ onSuccess }: Props) {
  const { tz } = useTimezone()
  const [open, setOpen] = useState(false)
  const [units, setUnits] = useState('')
  const [type, setType] = useState<'rapid' | 'long'>('rapid')
  const [notes, setNotes] = useState('')
  const [timestamp, setTimestamp] = useState(() => localNow(tz))
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    try {
      await postInsulin({
        timestamp: toUtcISO(timestamp, tz),
        units: parseFloat(units),
        type,
        notes: notes || undefined,
      })
      setOpen(false)
      onSuccess()
      setUnits('')
      setNotes('')
      setTimestamp(localNow(tz))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          Log Insulin
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Log Insulin Dose</DialogTitle>
        </DialogHeader>
        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="units">Units</Label>
            <Input
              id="units"
              type="number"
              step="0.5"
              min="0.5"
              max="100"
              required
              value={units}
              onChange={(e) => setUnits(e.target.value)}
              placeholder="e.g. 4"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="type">Type</Label>
            <Select value={type} onValueChange={(v) => setType(v as 'rapid' | 'long')}>
              <SelectTrigger id="type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="rapid">Rapid</SelectItem>
                <SelectItem value="long">Long-acting</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="insulin-time">Time</Label>
            <Input
              id="insulin-time"
              type="datetime-local"
              required
              value={timestamp}
              onChange={(e) => setTimestamp(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="insulin-notes">Notes (optional)</Label>
            <Input
              id="insulin-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. before lunch"
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
