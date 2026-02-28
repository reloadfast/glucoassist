import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { HelpPopover } from '@/components/HelpPopover'
import { HelpSheet, HelpSection } from '@/components/HelpSheet'
import { useTimezone } from '@/components/TimezoneProvider'
import { useAnalytics } from '@/hooks/useAnalytics'
import { usePatternHistory } from '@/hooks/usePatternHistory'
import type { PatternHistoryEntry, PatternItem } from '@/lib/api'
import { formatTs } from '@/lib/formatters'

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
          <CardDescription className="flex items-center gap-1">
            Confidence: {Math.round(pattern.confidence * 100)}%
            <HelpPopover title="Confidence score">
              <p>
                The proportion of qualifying days on which this pattern was observed, weighted
                toward recent history.
              </p>
              <p>Above 70% is considered a well-established pattern.</p>
            </HelpPopover>
          </CardDescription>
        )}
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">{pattern.description}</p>
      </CardContent>
    </Card>
  )
}

function PatternHistoryRow({ entry }: { entry: PatternHistoryEntry }) {
  const { tz } = useTimezone()
  return (
    <tr className="border-b last:border-0 text-sm">
      <td className="py-2 pr-4 font-medium">{entry.pattern_name}</td>
      <td className="py-2 pr-4 text-muted-foreground">{formatTs(entry.first_detected_at, tz)}</td>
      <td className="py-2 pr-4 text-muted-foreground">{formatTs(entry.last_detected_at, tz)}</td>
      <td className="py-2 pr-4 tabular-nums">{entry.detection_count}</td>
      <td className="py-2 tabular-nums">
        {entry.last_confidence != null ? `${Math.round(entry.last_confidence * 100)}%` : '—'}
      </td>
    </tr>
  )
}

export default function Patterns() {
  const { patterns, loading, error } = useAnalytics()
  const { history } = usePatternHistory()

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
        <div className="flex items-center gap-2">
          <h1 className="text-3xl font-bold tracking-tight">Patterns</h1>
          <HelpSheet title="What are patterns?" variant="link" triggerLabel="What are patterns?">
            <HelpSection title="What pattern detection does">
              <p>
                GlucoAssist analyses your glucose history to find recurring behaviours — times of
                day or week when your glucose consistently follows a particular trajectory. Patterns
                are only surfaced when they occur with sufficient frequency and statistical
                confidence.
              </p>
            </HelpSection>
            <HelpSection title="Pattern types">
              <table className="w-full text-xs border-collapse mt-1">
                <thead>
                  <tr className="border-b">
                    <th className="text-left pb-1 font-medium text-foreground">Pattern</th>
                    <th className="text-left pb-1 font-medium text-foreground">What it means</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b">
                    <td className="py-1 pr-3 font-medium text-foreground">
                      Recurrent overnight low
                    </td>
                    <td className="py-1">
                      Glucose consistently drops below 70 mg/dL during a specific overnight window
                    </td>
                  </tr>
                  <tr className="border-b">
                    <td className="py-1 pr-3 font-medium text-foreground">Post-meal spike</td>
                    <td className="py-1">
                      Glucose rises above 180 mg/dL within 2 hours of logged meals at a consistent
                      time block
                    </td>
                  </tr>
                  <tr className="border-b">
                    <td className="py-1 pr-3 font-medium text-foreground">Dawn phenomenon</td>
                    <td className="py-1">
                      Glucose rises in early morning (3am–8am) without a corresponding meal or bolus
                    </td>
                  </tr>
                  <tr className="border-b">
                    <td className="py-1 pr-3 font-medium text-foreground">Afternoon dip</td>
                    <td className="py-1">
                      Consistent glucose falls in mid-afternoon, often correlating with activity or
                      insulin tail
                    </td>
                  </tr>
                  <tr>
                    <td className="py-1 pr-3 font-medium text-foreground">
                      High variability window
                    </td>
                    <td className="py-1">
                      CV% significantly exceeds your baseline in a particular time block
                    </td>
                  </tr>
                </tbody>
              </table>
            </HelpSection>
            <HelpSection title="Confidence score">
              <p>
                Each pattern shows a confidence score (0–100%). This reflects the fraction of
                qualifying days on which the pattern was observed, weighted by recency. Above 70%
                indicates a well-established pattern.
              </p>
            </HelpSection>
            <HelpSection title="What to do with patterns">
              <p>
                Patterns are decision-support signals. A pattern surfaced here does not mean your
                settings automatically need adjustment — discuss recurring patterns with your
                diabetes care team before making treatment changes.
              </p>
            </HelpSection>
          </HelpSheet>
        </div>
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

      {history && history.history.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Pattern History</CardTitle>
            <CardDescription>Patterns that have been detected at least once</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="py-2 pr-4 text-left text-muted-foreground font-medium">
                      Pattern
                    </th>
                    <th className="py-2 pr-4 text-left text-muted-foreground font-medium">
                      First seen
                    </th>
                    <th className="py-2 pr-4 text-left text-muted-foreground font-medium">
                      Last seen
                    </th>
                    <th className="py-2 pr-4 text-left text-muted-foreground font-medium">Count</th>
                    <th className="py-2 text-left text-muted-foreground font-medium">Confidence</th>
                  </tr>
                </thead>
                <tbody>
                  {history.history.map((e) => (
                    <PatternHistoryRow key={e.pattern_name} entry={e} />
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
