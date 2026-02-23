import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import GlucoseChart from '@/components/GlucoseChart'
import LogButtons from '@/components/LogButtons'
import ReadingsTable from '@/components/ReadingsTable'
import { useGlucoseData } from '@/hooks/useGlucoseData'

export default function Dashboard() {
  const { summary, readings, loading, error, refresh } = useGlucoseData()

  const latest = summary?.latest_reading
  const trendArrow = latest?.trend_arrow ?? '→'
  const glucoseDisplay = latest ? `${latest.glucose_mg_dl} mg/dL` : '— mg/dL'
  const tirDisplay = summary?.time_in_range_pct != null ? `${summary.time_in_range_pct}%` : '— %'

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

      <Card>
        <CardHeader>
          <CardTitle>Glucose Chart</CardTitle>
          <CardDescription>Last 24 hours</CardDescription>
        </CardHeader>
        <CardContent>
          <GlucoseChart readings={readings} />
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
