import { useMemo, useState } from 'react'
import { ChevronDown, ChevronRight, Trash2 } from 'lucide-react'
import { Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useTimezone } from '@/components/TimezoneProvider'
import { useHealthLog } from '@/hooks/useHealthLog'
import { useInsulinLog } from '@/hooks/useInsulinLog'
import { useMealLog } from '@/hooks/useMealLog'
import { deleteHealth, deleteInsulin, deleteMeal, getMealResponse } from '@/lib/api'
import type { GlucoseReading, HealthMetricOut, InsulinDoseOut, MealOut, MealResponseData } from '@/lib/api'
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

function MealResponseChart({ readings, mealTs }: { readings: GlucoseReading[]; mealTs: string }) {
  if (readings.length === 0) {
    return (
      <p className="text-xs text-muted-foreground py-2">
        No glucose readings found in the 150-minute window after this meal.
      </p>
    )
  }
  const mealTime = new Date(mealTs).getTime()
  const data = readings.map((r) => ({
    min: Math.round((new Date(r.timestamp).getTime() - mealTime) / 60000),
    glucose: r.glucose_mg_dl,
  }))
  return (
    <ResponsiveContainer width="100%" height={120}>
      <LineChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: -16 }}>
        <XAxis
          dataKey="min"
          tick={{ fontSize: 10 }}
          tickFormatter={(v: number) => `+${v}m`}
          type="number"
          domain={[0, 150]}
          ticks={[0, 30, 60, 90, 120, 150]}
        />
        <YAxis tick={{ fontSize: 10 }} domain={['auto', 'auto']} width={36} />
        <Tooltip
          formatter={(v) => [`${v} mg/dL`, 'Glucose']}
          labelFormatter={(v) => `+${String(v)} min`}
        />
        <ReferenceLine y={70} stroke="#ef4444" strokeDasharray="3 3" />
        <ReferenceLine y={180} stroke="#f97316" strokeDasharray="3 3" />
        <Line type="monotone" dataKey="glucose" dot={false} stroke="#22c55e" strokeWidth={2} />
      </LineChart>
    </ResponsiveContainer>
  )
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
  const [expandedMeal, setExpandedMeal] = useState<number | null>(null)
  const [mealResponses, setMealResponses] = useState<Record<number, MealResponseData>>({})

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

  async function toggleMealExpand(mealId: number) {
    if (expandedMeal === mealId) {
      setExpandedMeal(null)
      return
    }
    setExpandedMeal(mealId)
    if (!mealResponses[mealId]) {
      try {
        const data = await getMealResponse(mealId)
        setMealResponses((prev) => ({ ...prev, [mealId]: data }))
      } catch {
        // non-critical: leave expandedMeal set, chart will show empty state
      }
    }
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
                    {events.map((ev) => {
                      const isMeal = ev.kind === 'meal'
                      const isExpanded = isMeal && expandedMeal === ev.entry.id
                      const responseData = isMeal ? mealResponses[ev.entry.id] : undefined
                      return (
                        <>
                          <tr
                            key={`${ev.kind}-${ev.entry.id}`}
                            className={`border-b align-middle ${isExpanded ? '' : 'last:border-0'}`}
                          >
                            <td className="py-2 pr-4 text-muted-foreground whitespace-nowrap">
                              {formatTs(ev.entry.timestamp, tz)}
                            </td>
                            <td className="py-2 pr-4">
                              <TypeBadge kind={ev.kind} />
                            </td>
                            <td className="py-2 pr-4">{eventDetails(ev)}</td>
                            <td className="py-2">
                              <div className="flex items-center gap-1">
                                {isMeal && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 text-muted-foreground hover:text-foreground"
                                    aria-label={isExpanded ? 'Collapse glucose response' : 'Show glucose response'}
                                    aria-expanded={isExpanded}
                                    onClick={() => void toggleMealExpand(ev.entry.id)}
                                  >
                                    {isExpanded ? (
                                      <ChevronDown className="h-3.5 w-3.5" />
                                    ) : (
                                      <ChevronRight className="h-3.5 w-3.5" />
                                    )}
                                  </Button>
                                )}
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 text-muted-foreground hover:text-destructive"
                                  aria-label={`Delete ${ev.kind} entry`}
                                  onClick={() => void handleDelete(ev)}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            </td>
                          </tr>
                          {isExpanded && (
                            <tr key={`${ev.kind}-${ev.entry.id}-response`} className="border-b last:border-0">
                              <td colSpan={4} className="py-3 px-2">
                                {responseData ? (
                                  <MealResponseChart
                                    readings={responseData.actual_readings}
                                    mealTs={ev.entry.timestamp}
                                  />
                                ) : (
                                  <Skeleton className="h-[120px] w-full" />
                                )}
                              </td>
                            </tr>
                          )}
                        </>
                      )
                    })}
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
