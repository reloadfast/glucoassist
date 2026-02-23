import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useAnalytics } from '@/hooks/useAnalytics'
import type { PatternItem } from '@/lib/api'

function PatternCard({ pattern }: { pattern: PatternItem }) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-base">{pattern.name}</CardTitle>
          <Badge variant={pattern.detected ? 'destructive' : 'secondary'}>
            {pattern.detected ? 'Detected' : 'Not detected'}
          </Badge>
        </div>
        {pattern.confidence != null && (
          <CardDescription>Confidence: {Math.round(pattern.confidence * 100)}%</CardDescription>
        )}
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">{pattern.description}</p>
      </CardContent>
    </Card>
  )
}

export default function Patterns() {
  const { patterns, loading, error } = useAnalytics()

  if (loading) {
    return <p className="text-muted-foreground">Loading patterns…</p>
  }

  if (error) {
    return (
      <div className="rounded-md bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive">
        {error}
      </div>
    )
  }

  const items = patterns?.patterns ?? []
  const detected = items.filter((p) => p.detected)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <h1 className="text-3xl font-bold tracking-tight">Patterns</h1>
        {items.length > 0 && (
          <Badge variant={detected.length > 0 ? 'destructive' : 'secondary'}>
            {detected.length} of {items.length} detected
          </Badge>
        )}
      </div>

      <p className="text-sm text-muted-foreground max-w-2xl">
        Patterns are detected from your CGM history. Some patterns (exercise sensitivity, delayed
        carb absorption) require meal and activity logs to be evaluated.
      </p>

      <div className="grid gap-4 md:grid-cols-2">
        {items.map((p) => (
          <PatternCard key={p.name} pattern={p} />
        ))}
        {items.length === 0 && (
          <p className="text-sm text-muted-foreground col-span-2">No pattern data available.</p>
        )}
      </div>
    </div>
  )
}
