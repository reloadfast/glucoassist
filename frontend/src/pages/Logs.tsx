import { useMemo } from 'react'
import { Trash2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useTimezone } from '@/components/TimezoneProvider'
import { useHealthLog } from '@/hooks/useHealthLog'
import { useInsulinLog } from '@/hooks/useInsulinLog'
import { useMealLog } from '@/hooks/useMealLog'
import { deleteHealth, deleteInsulin, deleteMeal } from '@/lib/api'
import type { HealthMetricOut, InsulinDoseOut, MealOut } from '@/lib/api'
import { formatTs } from '@/lib/formatters'

type LogEvent =
  | { kind: 'insulin'; entry: InsulinDoseOut }
  | { kind: 'meal'; entry: MealOut }
  | { kind: 'health'; entry: HealthMetricOut }

function TypeBadge({ kind }: { kind: LogEvent['kind'] }) {
  const styles = {
    insulin: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',
    meal: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
    health: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  }
  const labels = { insulin: 'Insulin', meal: 'Meal', health: 'Health' }
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${styles[kind]}`}
    >
      {labels[kind]}
    </span>
  )
}

function eventDetails(ev: LogEvent): string {
  if (ev.kind === 'insulin') {
    const { units, type, notes } = ev.entry
    return [`${units}u ${type}`, notes].filter(Boolean).join(' · ')
  }
  if (ev.kind === 'meal') {
    const { carbs_g, label, notes } = ev.entry
    return [`${carbs_g}g carbs`, label, notes].filter(Boolean).join(' · ')
  }
  // health
  const { heart_rate_bpm, weight_kg, sleep_hours, stress_level, activity_type, activity_minutes } =
    ev.entry
  const parts: string[] = []
  if (heart_rate_bpm != null) parts.push(`HR ${heart_rate_bpm} bpm`)
  if (weight_kg != null) parts.push(`${weight_kg} kg`)
  if (sleep_hours != null) parts.push(`${sleep_hours}h sleep`)
  if (stress_level != null) parts.push(`stress ${stress_level}`)
  if (activity_type) {
    parts.push(activity_minutes != null ? `${activity_type} ${activity_minutes}min` : activity_type)
  }
  return parts.join(' · ') || '—'
}

function LoadingSkeleton() {
  return (
    <div className="space-y-2">
      <Skeleton className="h-8 w-full" />
      <Skeleton className="h-8 w-full" />
      <Skeleton className="h-8 w-full" />
    </div>
  )
}

export default function Logs() {
  const { tz } = useTimezone()
  const insulin = useInsulinLog()
  const meals = useMealLog()
  const health = useHealthLog()

  const events = useMemo<LogEvent[]>(() => {
    const all: LogEvent[] = [
      ...insulin.entries.map((e): LogEvent => ({ kind: 'insulin', entry: e })),
      ...meals.entries.map((e): LogEvent => ({ kind: 'meal', entry: e })),
      ...health.entries.map((e): LogEvent => ({ kind: 'health', entry: e })),
    ]
    return all.sort((a, b) => b.entry.timestamp.localeCompare(a.entry.timestamp))
  }, [insulin.entries, meals.entries, health.entries])

  const anyLoading =
    (insulin.loading && insulin.entries.length === 0) ||
    (meals.loading && meals.entries.length === 0) ||
    (health.loading && health.entries.length === 0)

  const anyError = insulin.error ?? meals.error ?? health.error
  const hasMore = insulin.hasMore || meals.hasMore || health.hasMore
  const loadingMore =
    (insulin.loading && insulin.entries.length > 0) ||
    (meals.loading && meals.entries.length > 0) ||
    (health.loading && health.entries.length > 0)

  async function handleDelete(ev: LogEvent) {
    const labels = { insulin: 'insulin entry', meal: 'meal entry', health: 'health entry' }
    if (!window.confirm(`Delete this ${labels[ev.kind]}?`)) return
    if (ev.kind === 'insulin') {
      await deleteInsulin(ev.entry.id)
      insulin.refresh()
    } else if (ev.kind === 'meal') {
      await deleteMeal(ev.entry.id)
      meals.refresh()
    } else {
      await deleteHealth(ev.entry.id)
      health.refresh()
    }
  }

  function handleLoadMore() {
    if (insulin.hasMore) void insulin.loadMore()
    if (meals.hasMore) void meals.loadMore()
    if (health.hasMore) void health.loadMore()
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold tracking-tight">Logs</h1>

      <Card>
        <CardHeader>
          <CardTitle>Event Log</CardTitle>
        </CardHeader>
        <CardContent>
          {anyLoading ? (
            <LoadingSkeleton />
          ) : anyError ? (
            <div className="rounded-md bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive">
              {anyError}
            </div>
          ) : events.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">No log entries yet.</p>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="py-2 pr-4 text-left text-muted-foreground font-medium">
                        Time
                      </th>
                      <th className="py-2 pr-4 text-left text-muted-foreground font-medium">
                        Type
                      </th>
                      <th className="py-2 pr-4 text-left text-muted-foreground font-medium">
                        Details
                      </th>
                      <th className="py-2 text-left text-muted-foreground font-medium"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {events.map((ev) => (
                      <tr
                        key={`${ev.kind}-${ev.entry.id}`}
                        className="border-b last:border-0 align-middle"
                      >
                        <td className="py-2 pr-4 text-muted-foreground whitespace-nowrap">
                          {formatTs(ev.entry.timestamp, tz)}
                        </td>
                        <td className="py-2 pr-4">
                          <TypeBadge kind={ev.kind} />
                        </td>
                        <td className="py-2 pr-4">{eventDetails(ev)}</td>
                        <td className="py-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-destructive"
                            aria-label={`Delete ${ev.kind} entry`}
                            onClick={() => void handleDelete(ev)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {loadingMore && <LoadingSkeleton />}
              {hasMore && !loadingMore && (
                <div className="mt-3">
                  <Button variant="outline" size="sm" onClick={handleLoadMore}>
                    Load more
                  </Button>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
