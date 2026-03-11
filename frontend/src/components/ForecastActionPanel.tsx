import { Activity, AlertTriangle, CheckCircle2, ShieldAlert, TrendingUp } from 'lucide-react'

import { HelpPopover } from '@/components/HelpPopover'
import { HelpSection, HelpSheet } from '@/components/HelpSheet'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import type { ActionSuggestion, ForecastResponse, HorizonForecast } from '@/lib/api'

// ── Risk badge config ─────────────────────────────────────────────────────────

const RISK_BADGE: Record<HorizonForecast['risk_level'], { label: string; className: string }> = {
  low: {
    label: 'Low',
    className: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  },
  moderate: {
    label: 'Moderate',
    className: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  },
  high: {
    label: 'High',
    className: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  },
  critical: {
    label: 'Critical',
    className: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  },
}

// ── Suggestion urgency config ─────────────────────────────────────────────────

const URGENCY_CONFIG: Record<
  ActionSuggestion['urgency'],
  { border: string; icon: React.ElementType; iconClass: string }
> = {
  low: {
    border: 'border-emerald-200 dark:border-emerald-800/50',
    icon: CheckCircle2,
    iconClass: 'text-emerald-500 dark:text-emerald-400',
  },
  moderate: {
    border: 'border-amber-200 dark:border-amber-800/50',
    icon: AlertTriangle,
    iconClass: 'text-amber-500 dark:text-amber-400',
  },
  high: {
    border: 'border-orange-200 dark:border-orange-800/50',
    icon: AlertTriangle,
    iconClass: 'text-orange-500 dark:text-orange-400',
  },
  critical: {
    border: 'border-red-200 dark:border-red-800/50',
    icon: ShieldAlert,
    iconClass: 'text-red-500 dark:text-red-400',
  },
}

// ── HorizonChip ───────────────────────────────────────────────────────────────

function HorizonChip({ forecast }: { forecast: HorizonForecast }) {
  const badge = RISK_BADGE[forecast.risk_level]
  return (
    <div className="flex flex-col items-center gap-1 rounded-lg border bg-card p-3 flex-1 min-w-0">
      <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {forecast.horizon_min} min
      </span>
      <span
        className="text-2xl font-bold tabular-nums"
        data-testid={`horizon-${forecast.horizon_min}`}
      >
        {Math.round(forecast.predicted_mg_dl)}
      </span>
      <span className="text-xs text-muted-foreground">mg/dL</span>
      <span className={`text-xs font-medium px-1.5 py-0.5 rounded-full ${badge.className}`}>
        {badge.label}
      </span>
      <span className="text-xs text-muted-foreground">
        {Math.round(forecast.ci_lower)}–{Math.round(forecast.ci_upper)}
      </span>
    </div>
  )
}

// ── SuggestionBanner ──────────────────────────────────────────────────────────

function SuggestionBanner({ suggestion }: { suggestion: ActionSuggestion }) {
  const cfg = URGENCY_CONFIG[suggestion.urgency]
  const { icon: Icon } = cfg

  return (
    <div className={`rounded-lg border p-3 ${cfg.border}`}>
      <div className="flex items-start gap-2">
        <Icon className={`h-4 w-4 mt-0.5 shrink-0 ${cfg.iconClass}`} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium">{suggestion.message}</p>
          {suggestion.detail && (
            <p className="text-xs text-muted-foreground mt-0.5">{suggestion.detail}</p>
          )}
        </div>
        <HelpPopover title="About this suggestion">
          <p>{suggestion.disclaimer}</p>
        </HelpPopover>
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

interface Props {
  forecast: ForecastResponse | null
  loading?: boolean
}

export default function ForecastActionPanel({ forecast, loading = false }: Props) {
  if (loading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <Skeleton className="h-5 w-48" />
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            {[30, 60, 90, 120].map((h) => (
              <Skeleton key={h} className="flex-1 h-24 rounded-lg" />
            ))}
          </div>
          <Skeleton className="h-14 rounded-lg" />
        </CardContent>
      </Card>
    )
  }

  if (!forecast) return null

  const { forecasts, suggestions, model_trained } = forecast

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base flex-wrap">
          <TrendingUp className="h-4 w-4 text-primary shrink-0" />
          <span className="inline-flex items-center gap-1">
            Active Glucose Forecast
            <HelpPopover title="Horizon Chips">
              <p>
                Each chip shows the predicted glucose and 80% confidence interval at that future
                time. Risk badges reflect the probability of going below 70 or above 250 mg/dL.
              </p>
            </HelpPopover>
          </span>
          <HelpSheet
            title="Forecast & Action Suggestions"
            variant="link"
            triggerLabel="How does this work?"
          >
            <HelpSection title="What the forecast does">
              <p>
                A Ridge regression model predicts your glucose at 30, 60, 90, and 120 minutes from
                now. It uses your own historical data and runs entirely on-device — no cloud
                required.
              </p>
            </HelpSection>
            <HelpSection title="What feeds it">
              <ul className="space-y-1 list-disc list-inside">
                <li>
                  <strong>Last 6 glucose readings</strong> — recent trend and momentum
                </li>
                <li>
                  <strong>Rate of change</strong> — 5-min, 10-min, 25-min deltas
                </li>
                <li>
                  <strong>Time of day &amp; day of week</strong> — your daily patterns
                </li>
                <li>
                  <strong>Insulin on Board (IOB)</strong> — active rapid insulin (4-hour bilinear
                  decay)
                </li>
                <li>
                  <strong>Carbs on Board (COB)</strong> — active carbs from logged meals (2-hour
                  linear absorption)
                </li>
              </ul>
            </HelpSection>
            <HelpSection title="Action suggestions">
              <p>
                Suggestions are rule-based and use your personal Insulin-to-Carb Ratio (ICR) and
                Correction Factor (CF) from the Intelligence page.
              </p>
              <table className="w-full text-xs mt-2 border-collapse">
                <thead>
                  <tr className="border-b">
                    <th className="text-left pb-1 font-medium text-foreground">Condition</th>
                    <th className="text-left pb-1 font-medium text-foreground">Suggestion</th>
                  </tr>
                </thead>
                <tbody className="text-muted-foreground">
                  <tr className="border-b border-muted">
                    <td className="py-1 pr-3">Any forecast &lt; 70 mg/dL</td>
                    <td className="py-1">Fast carbs: gap ÷ (CF ÷ ICR)</td>
                  </tr>
                  <tr className="border-b border-muted">
                    <td className="py-1 pr-3">IOB driving glucose below range</td>
                    <td className="py-1">Protective carbs</td>
                  </tr>
                  <tr className="border-b border-muted">
                    <td className="py-1 pr-3">Forecast &gt; 180, low COB</td>
                    <td className="py-1">Correction: (peak − 120) ÷ CF − IOB</td>
                  </tr>
                  <tr>
                    <td className="py-1 pr-3">All horizons 70–180</td>
                    <td className="py-1">On track</td>
                  </tr>
                </tbody>
              </table>
              <p className="mt-2 text-muted-foreground">
                Corrections are always net of active IOB to prevent dangerous stacking.
              </p>
            </HelpSection>
            <HelpSection title="Confidence interval">
              <p>
                The range shown below each predicted value is an 80% confidence interval. In 4 out
                of 5 predictions, the actual glucose will fall within this band.
              </p>
            </HelpSection>
            <HelpSection title="Limitations">
              <p>
                Decision-support only — not a medical alert system. The model cannot account for
                unlogged meals, sensor lag, or unusual physiological events. Always apply clinical
                judgement and follow guidance from your healthcare team.
              </p>
            </HelpSection>
          </HelpSheet>
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-3">
        {!model_trained || forecasts.length === 0 ? (
          <div className="flex items-center gap-2 rounded-lg border bg-muted/40 p-3">
            <Activity className="h-4 w-4 text-muted-foreground shrink-0" />
            <p className="text-sm text-muted-foreground">
              Forecast model not yet trained — log more glucose readings and insulin/meal events,
              then trigger a retrain in Settings.
            </p>
          </div>
        ) : (
          <>
            {/* Horizon chips */}
            <div className="flex gap-2 overflow-x-auto pb-1" data-testid="horizon-chips">
              {[...forecasts]
                .sort((a, b) => a.horizon_min - b.horizon_min)
                .map((f) => (
                  <HorizonChip key={f.horizon_min} forecast={f} />
                ))}
            </div>

            {/* Action suggestion */}
            {suggestions.length > 0 && <SuggestionBanner suggestion={suggestions[0]} />}
          </>
        )}
      </CardContent>
    </Card>
  )
}
