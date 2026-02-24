import { useEffect, useMemo, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import GlucoseChart, { type EventMarker } from '@/components/GlucoseChart'
import InsightsCard from '@/components/InsightsCard'
import LogButtons from '@/components/LogButtons'
import ReadingsTable from '@/components/ReadingsTable'
import RiskAlertCard from '@/components/RiskAlertCard'
import { useForecast } from '@/hooks/useForecast'
import { useGlucoseData } from '@/hooks/useGlucoseData'
import { getInsulinLog, getMealLog, postBackfill } from '@/lib/api'
import { formatTrend } from '@/lib/formatters'

const BACKFILL_OPTIONS = [30, 60, 90] as const

export default function Dashboard() {
  const { summary, readings, loading, error, refresh } = useGlucoseData()
  const { forecast } = useForecast()
  const [backfilling, setBackfilling] = useState(false)
  const [backfillMsg, setBackfillMsg] = useState<string | null>(null)
  const [eventMarkers, setEventMarkers] = useState<EventMarker[]>([])

  // Fetch insulin + meal events for the last 24h to overlay on the chart
  useEffect(() => {
    const from = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    Promise.all([getInsulinLog({ from, limit: 100 }), getMealLog({ from, limit: 100 })])
      .then(([insulinData, mealData]) => {
        const markers: EventMarker[] = [
          ...insulinData.entries.map((e) => ({
            id: e.id,
            timestamp: e.timestamp,
            type: 'insulin' as const,
          })),
          ...mealData.entries.map((e) => ({
            id: e.id,
            timestamp: e.timestamp,
            type: 'meal' as const,
          })),
        ]
        setEventMarkers(markers)
      })
      .catch(() => {
        // non-critical: silently ignore
      })
  }, [])

  const stableMarkers = useMemo(() => eventMarkers, [eventMarkers])

  const latest = summary?.latest_reading
  const trendArrow = formatTrend(latest?.trend_arrow)
  const glucoseDisplay = latest ? `${latest.glucose_mg_dl} mg/dL` : '— mg/dL'
  const tirDisplay = summary?.time_in_range_pct != null ? `${summary.time_in_range_pct}%` : '— %'
  const isEmpty = !loading && summary?.reading_count === 0 && !latest

  async function handleBackfill(days: number) {
    setBackfilling(true)
    setBackfillMsg(null)
    try {
      const result = await postBackfill(days)
      setBackfillMsg(`Imported ${result.inserted} readings from the past ${days} days.`)
      refresh()
    } catch {
      setBackfillMsg('Backfill failed — check that your CGM source URL is reachable.')
    } finally {
      setBackfilling(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <LogButtons onSuccess={refresh} />
      </div>

      {error && (
        <div className="rounded-md bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Historical backfill banner — shown when DB is empty */}
      {isEmpty && (
        <div className="rounded-md border bg-muted/40 px-4 py-4 space-y-3">
          <p className="text-sm font-medium">No glucose history yet.</p>
          <p className="text-sm text-muted-foreground">
            Import historical readings from your CGM source to populate the dashboard and enable
            analytics. The app will continue polling for new readings automatically.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-muted-foreground">Import last:</span>
            {BACKFILL_OPTIONS.map((days) => (
              <Button
                key={days}
                variant="outline"
                size="sm"
                disabled={backfilling}
                onClick={() => void handleBackfill(days)}
              >
                {backfilling ? '…' : `${days} days`}
              </Button>
            ))}
          </div>
          {backfillMsg && <p className="text-sm text-muted-foreground">{backfillMsg}</p>}
        </div>
      )}

      {/* Backfill result message when DB already had data */}
      {!isEmpty && backfillMsg && <p className="text-sm text-muted-foreground">{backfillMsg}</p>}

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardDescription>Latest Reading</CardDescription>
            <CardTitle className="text-4xl">{loading ? '…' : glucoseDisplay}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              {latest ? `Source: ${latest.source}` : 'No data yet'}
            </p>
            {summary?.iob_units != null && (
              <p className="text-sm text-muted-foreground mt-1">
                {summary.iob_units}u active insulin
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardDescription>Trend</CardDescription>
            <CardTitle className="text-4xl">{loading ? '…' : trendArrow}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              {summary?.reading_count != null
                ? `${summary.reading_count} readings (24h)`
                : 'Awaiting CGM data'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardDescription>Time in Range (24h)</CardDescription>
            <CardTitle className="text-4xl">{loading ? '…' : tirDisplay}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              {summary?.avg_glucose != null
                ? `Avg ${summary.avg_glucose} mg/dL · Min ${summary.min_glucose} · Max ${summary.max_glucose}`
                : '70–180 mg/dL target'}
            </p>
          </CardContent>
        </Card>
      </div>

      <InsightsCard />

      {forecast && <RiskAlertCard forecast={forecast} />}

      <Card>
        <CardHeader>
          <CardTitle>Glucose Chart</CardTitle>
          <CardDescription>Last 24 hours</CardDescription>
        </CardHeader>
        <CardContent>
          <GlucoseChart
            readings={readings}
            forecasts={forecast?.forecasts ?? []}
            eventMarkers={stableMarkers}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent Readings</CardTitle>
          <CardDescription>Last 20 entries</CardDescription>
        </CardHeader>
        <CardContent>
          <ReadingsTable readings={readings} />
        </CardContent>
      </Card>
    </div>
  )
}
