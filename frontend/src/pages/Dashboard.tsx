import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

export default function Dashboard() {
  return (
    <main className="min-h-screen bg-background p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold tracking-tight">GlucoSense</h1>
          <Badge variant="secondary">Phase 1 — Scaffold</Badge>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader>
              <CardDescription>Latest Reading</CardDescription>
              <CardTitle className="text-4xl">— mg/dL</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">No data yet</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardDescription>Trend</CardDescription>
              <CardTitle className="text-4xl">→</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">Awaiting CGM data</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardDescription>Time in Range (24h)</CardDescription>
              <CardTitle className="text-4xl">— %</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">70–180 mg/dL target</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Glucose Chart</CardTitle>
            <CardDescription>Last 24 hours — chart will appear here (issue #9)</CardDescription>
          </CardHeader>
          <CardContent className="flex h-48 items-center justify-center rounded-md border-2 border-dashed border-muted">
            <p className="text-sm text-muted-foreground">Chart placeholder</p>
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
