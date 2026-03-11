import { differenceInMinutes, format } from 'date-fns'
import { useEffect, useMemo, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import GlucoseChart, { type EventMarker } from '@/components/GlucoseChart'
import { HelpPopover } from '@/components/HelpPopover'
import InsightsCard from '@/components/InsightsCard'
import LogButtons from '@/components/LogButtons'
import ReadingsTable from '@/components/ReadingsTable'
import ForecastActionPanel from '@/components/ForecastActionPanel'
import { useForecast } from '@/hooks/useForecast'
import { useGlucoseData } from '@/hooks/useGlucoseData'
import { getInsulinLog, getMealLog, postBackfill } from '@/lib/api'
import { formatTrend } from '@/lib/formatters'

const BACKFILL_OPTIONS = [30, 60, 90] as const

export default function Dashboard() {
  const { summary, readings, loading, error, refresh } = useGlucoseData()
  const { forecast, loading: forecastLoading } = useForecast()
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

  const latestTs = latest?.timestamp ? new Date(latest.timestamp) : null
  const readingAgeMin = latestTs ? differenceInMinutes(new Date(), latestTs) : null
  const readingTimeLabel = latestTs ? format(latestTs, 'HH:mm') + ' CET' : null
  const isStale = readingAgeMin != null && readingAgeMin > 15

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
            <CardDescription className="flex items-center gap-1">
              Latest Reading
              <HelpPopover title="Blood glucose (mg/dL)">
                <p>
                  Glucose concentration in your blood, measured in milligrams per deciliter. Your
                  CGM sensor updates this approximately every 5 minutes.
                </p>
                <table className="w-full text-xs mt-2 border-collapse">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left pb-1 font-medium text-foreground">Range</th>
                      <th className="text-left pb-1 font-medium text-foreground">Value</th>
                    </tr>
                  </thead>
                  <tbody className="text-muted-foreground">
                    <tr>
                      <td className="py-0.5 pr-3">Hypo (low)</td>
                      <td>&lt; 70 mg/dL</td>
                    </tr>
                    <tr>
                      <td className="py-0.5 pr-3">Normal target</td>
                      <td>70–180 mg/dL</td>
                    </tr>
                    <tr>
                      <td className="py-0.5 pr-3">High</td>
                      <td>&gt; 180 mg/dL</td>
                    </tr>
                    <tr>
                      <td className="py-0.5 pr-3">Very high</td>
                      <td>&gt; 250 mg/dL</td>
                    </tr>
                  </tbody>
                </table>
                <p className="mt-2 text-xs">
                  These are general reference values. Your personal targets may differ — always
                  follow guidance from your healthcare team.
                </p>
              </HelpPopover>
            </CardDescription>
            <CardTitle className="text-4xl">{loading ? '…' : glucoseDisplay}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              {latest ? `Source: ${latest.source}` : 'No data yet'}
            </p>
            {readingTimeLabel && (
              <p
                className={`text-sm mt-1 ${isStale ? 'text-amber-500 font-medium' : 'text-muted-foreground'}`}
              >
                {readingTimeLabel}
                {isStale && ` · Reading ${readingAgeMin}m old — sensor may be delayed`}
              </p>
            )}
            {summary?.iob_units != null && (
              <p className="text-sm text-muted-foreground mt-1 inline-flex items-center gap-1">
                {summary.iob_units}u active insulin
                <HelpPopover title="Insulin on Board (IOB)">
                  <p>
                    An estimate of how much rapid-acting insulin from your recent doses is still
                    active in your body.
                  </p>
                  <p>
                    Calculated using a bilinear (trapezoid) decay model with a 4-hour Duration of
                    Insulin Action and peak activity at 75 minutes — the standard approximation used
                    by open-loop systems. This is an approximation — actual activity depends on
                    insulin type, injection site, and individual physiology.
                  </p>
                  <p>Only doses you have logged in GlucoAssist are included.</p>
                </HelpPopover>
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardDescription className="flex items-center gap-1">
              Trend
              <HelpPopover title="Trend arrow">
                <p>
                  Shows the direction and rate of change of your glucose over the last 15 minutes.
                </p>
                <table className="w-full text-xs mt-2 border-collapse">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left pb-1 font-medium text-foreground">Arrow</th>
                      <th className="text-left pb-1 font-medium text-foreground">Rate</th>
                    </tr>
                  </thead>
                  <tbody className="text-muted-foreground">
                    <tr>
                      <td className="py-0.5 pr-3">↑↑ Rising rapidly</td>
                      <td>&gt; +3 mg/dL/min</td>
                    </tr>
                    <tr>
                      <td className="py-0.5 pr-3">↑ Rising</td>
                      <td>+2 to +3</td>
                    </tr>
                    <tr>
                      <td className="py-0.5 pr-3">↗ Rising slowly</td>
                      <td>+1 to +2</td>
                    </tr>
                    <tr>
                      <td className="py-0.5 pr-3">→ Flat</td>
                      <td>±1 mg/dL/min</td>
                    </tr>
                    <tr>
                      <td className="py-0.5 pr-3">↘ Falling slowly</td>
                      <td>−1 to −2</td>
                    </tr>
                    <tr>
                      <td className="py-0.5 pr-3">↓ Falling</td>
                      <td>−2 to −3</td>
                    </tr>
                    <tr>
                      <td className="py-0.5 pr-3">↓↓ Falling rapidly</td>
                      <td>&lt; −3 mg/dL/min</td>
                    </tr>
                  </tbody>
                </table>
                <p className="mt-2 text-xs">
                  A rapidly falling arrow near the low range is a prompt to act sooner than the
                  number alone suggests.
                </p>
              </HelpPopover>
            </CardDescription>
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
            <CardDescription className="flex items-center gap-1">
              Time in Range (24h)
              <HelpPopover title="Time in Range (TIR)">
                <p>
                  The percentage of your CGM readings over the last 24 hours that fell between 70
                  and 180 mg/dL — your target glucose range.
                </p>
                <p>
                  The international consensus target for most people with type 1 diabetes is ≥ 70%
                  TIR. Your personal target may differ.
                </p>
                <p>
                  Minimising time below range (TBR, &lt; 70 mg/dL) takes priority over all other
                  metrics.
                </p>
                <p className="text-xs mt-2">
                  Decision-support only — always follow guidance from your healthcare team.
                </p>
              </HelpPopover>
            </CardDescription>
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

      <ForecastActionPanel forecast={forecast} loading={forecastLoading} />

      <Card>
        <CardHeader>
          <CardTitle>Glucose Chart</CardTitle>
          <CardDescription>Last 3 hours + 2-hour forecast</CardDescription>
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
