import { AlertTriangle, ChevronDown, ChevronUp, Info, Lightbulb } from 'lucide-react'
import { useState } from 'react'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { HelpPopover } from '@/components/HelpPopover'
import { useRecommendations } from '@/hooks/useRecommendations'
import type { Recommendation } from '@/lib/api'

function priorityBadge(priority: string) {
  if (priority === 'high')
    return (
      <Badge variant="destructive" className="text-xs">
        High
      </Badge>
    )
  if (priority === 'medium')
    return (
      <Badge variant="outline" className="text-xs border-orange-400 text-orange-500">
        Medium
      </Badge>
    )
  return (
    <Badge variant="outline" className="text-xs text-muted-foreground">
      Low
    </Badge>
  )
}

function priorityIcon(priority: string) {
  if (priority === 'high') return <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />
  if (priority === 'medium') return <Info className="h-4 w-4 text-orange-500 shrink-0" />
  return <Lightbulb className="h-4 w-4 text-muted-foreground shrink-0" />
}

function RecommendationRow({ rec }: { rec: Recommendation }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="border rounded-lg p-4 space-y-2">
      <div className="flex items-start gap-3">
        {priorityIcon(rec.priority)}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-sm">{rec.title}</span>
            {priorityBadge(rec.priority)}
          </div>
          <p className="text-sm text-muted-foreground mt-1">{rec.reasoning}</p>
        </div>
        <button
          onClick={() => setExpanded((v) => !v)}
          className="text-muted-foreground hover:text-foreground transition-colors shrink-0"
          aria-label={expanded ? 'Collapse action' : 'Expand action'}
        >
          {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
      </div>

      {expanded && (
        <div className="ml-7 pl-0 pt-1 border-t">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
            Suggested action
          </p>
          <p className="text-sm">{rec.action}</p>
          {rec.linked_patterns.length > 1 && (
            <p className="text-xs text-muted-foreground mt-2">
              Based on: {rec.linked_patterns.join(', ')}
            </p>
          )}
        </div>
      )}
    </div>
  )
}

const InsightsHelp = (
  <HelpPopover title="Insights">
    <p>
      Pattern-based recommendations generated from your glucose history. Each insight is triggered
      by a detected pattern (e.g. recurrent overnight lows, post-meal spikes).
    </p>
    <p>
      Insights are informational only. They highlight trends in your data — they do not account for
      your treatment plan or medical history. Discuss any consistent patterns with your diabetes
      care team.
    </p>
  </HelpPopover>
)

export default function InsightsCard() {
  const { data, loading } = useRecommendations()

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-1">
            Insights
            {InsightsHelp}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </CardContent>
      </Card>
    )
  }

  const recs = data?.recommendations ?? []

  if (recs.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-1">
            Insights
            {InsightsHelp}
          </CardTitle>
          <CardDescription>Pattern-based recommendations</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            No patterns detected yet — recommendations will appear here as your data accumulates.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-1">
          Insights
          {InsightsHelp}
        </CardTitle>
        <CardDescription>
          {recs.length} recommendation{recs.length === 1 ? '' : 's'} based on {data?.detected_count}{' '}
          detected pattern{data?.detected_count === 1 ? '' : 's'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {recs.map((rec, i) => (
          <RecommendationRow key={i} rec={rec} />
        ))}
      </CardContent>
    </Card>
  )
}
