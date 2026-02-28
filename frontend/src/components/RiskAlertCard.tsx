import { AlertTriangle, ShieldAlert } from 'lucide-react'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { HelpPopover } from '@/components/HelpPopover'
import { HelpSheet, HelpSection } from '@/components/HelpSheet'
import type { ForecastResponse } from '@/lib/api'

const RISK_CONFIG = {
  moderate: {
    bg: 'bg-amber-50 border-amber-200',
    Icon: AlertTriangle,
    iconClass: 'text-amber-500',
    label: 'Moderate Risk',
  },
  high: {
    bg: 'bg-orange-50 border-orange-200',
    Icon: AlertTriangle,
    iconClass: 'text-orange-500',
    label: 'High Risk',
  },
  critical: {
    bg: 'bg-red-50 border-red-200',
    Icon: ShieldAlert,
    iconClass: 'text-red-500',
    label: 'Critical Risk',
  },
} as const

interface Props {
  forecast: ForecastResponse
}

export default function RiskAlertCard({ forecast }: Props) {
  const { overall_risk, forecasts } = forecast

  if (overall_risk === 'low' || overall_risk === 'unknown') return null

  const config = RISK_CONFIG[overall_risk as keyof typeof RISK_CONFIG]
  if (!config) return null

  const { Icon } = config

  const riskLines = forecasts
    .filter((f) => f.risk_level !== 'low')
    .map((f) => ({
      horizon: f.horizon_min,
      hypo: f.p_hypo >= 0.1 ? Math.round(f.p_hypo * 100) : null,
      hyper: f.p_hyper >= 0.1 ? Math.round(f.p_hyper * 100) : null,
    }))

  return (
    <Card className={`border ${config.bg}`}>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 flex-wrap text-base">
          <Icon className={`h-5 w-5 ${config.iconClass}`} />
          <span className="inline-flex items-center gap-1">
            {config.label}
            <HelpPopover title="Risk Levels">
              <p>Overall risk is the highest single-horizon risk across all forecast windows.</p>
              <table className="w-full text-xs mt-2 border-collapse">
                <thead>
                  <tr className="border-b">
                    <th className="text-left pb-1 font-medium text-foreground">Level</th>
                    <th className="text-left pb-1 font-medium text-foreground">Probability</th>
                  </tr>
                </thead>
                <tbody className="text-muted-foreground">
                  <tr>
                    <td className="py-0.5 pr-3">Low</td>
                    <td>&lt; 10%</td>
                  </tr>
                  <tr>
                    <td className="py-0.5 pr-3">Moderate</td>
                    <td>10–25%</td>
                  </tr>
                  <tr>
                    <td className="py-0.5 pr-3">High</td>
                    <td>25–50%</td>
                  </tr>
                  <tr>
                    <td className="py-0.5 pr-3">Critical</td>
                    <td>≥ 50%</td>
                  </tr>
                </tbody>
              </table>
              <p className="mt-2">Thresholds: hypo &lt; 70 mg/dL, hyper &gt; 250 mg/dL.</p>
            </HelpPopover>
          </span>{' '}
          — Glucose Forecast
          <HelpSheet
            title="How the Forecast Works"
            variant="link"
            triggerLabel="How does this work?"
          >
            <HelpSection title="What the forecast does">
              <p>
                The model predicts your glucose level at 30, 60, and 120 minutes from now. It runs
                automatically every time the dashboard refreshes and uses only data already on your
                device.
              </p>
            </HelpSection>
            <HelpSection title="What feeds it">
              <ul className="space-y-1 list-disc list-inside">
                <li>
                  <strong>Last 6 glucose readings</strong> — recent trend and momentum
                </li>
                <li>
                  <strong>Rate of change</strong> — how fast glucose is rising or falling
                </li>
                <li>
                  <strong>Time of day</strong> — your personal daily glucose pattern
                </li>
                <li>
                  <strong>Day of week</strong> — weekday vs. weekend lifestyle differences
                </li>
                <li>
                  <strong>Insulin on Board (IOB)</strong> — active rapid insulin (65-min decay
                  curve)
                </li>
              </ul>
            </HelpSection>
            <HelpSection title="How it works">
              <p>
                A separate Ridge regression model is trained for each horizon (30, 60, 120 min). It
                learns the relationship between your feature values and future glucose from your own
                historical data. It does not guess — it extrapolates from patterns it has seen.
              </p>
            </HelpSection>
            <HelpSection title="Confidence interval">
              <p>
                The shaded band around the dashed forecast line is an 80% confidence interval. In 4
                out of 5 predictions, the actual glucose reading will fall within this band. A wider
                band means more uncertainty.
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
      <CardContent className="space-y-1">
        {riskLines.map((line) => (
          <p
            key={line.horizon}
            className="text-sm text-muted-foreground flex items-center gap-2 flex-wrap"
          >
            <span className="inline-flex items-center gap-1">
              <span>{line.horizon}-min</span>
              <HelpPopover title={`${line.horizon}-minute forecast`}>
                <p>
                  Predicted glucose level at {line.horizon} minutes from now, with an 80% confidence
                  interval. The actual reading is expected to land inside this band 4 out of 5
                  times.
                </p>
              </HelpPopover>
            </span>
            {line.hypo != null && (
              <span className="inline-flex items-center gap-1">
                <span>{line.hypo}% hypo risk</span>
                <HelpPopover title="Hypoglycaemia risk">
                  <p>
                    Probability that your glucose will drop below 70 mg/dL within this horizon,
                    estimated from the confidence interval of the prediction.
                  </p>
                </HelpPopover>
              </span>
            )}
            {line.hyper != null && (
              <span className="inline-flex items-center gap-1">
                <span>{line.hyper}% hyper risk</span>
                <HelpPopover title="Hyperglycaemia risk">
                  <p>
                    Probability that your glucose will rise above 250 mg/dL within this horizon,
                    estimated from the confidence interval of the prediction.
                  </p>
                </HelpPopover>
              </span>
            )}
          </p>
        ))}
        <p className="pt-1 text-xs text-muted-foreground">
          Based on Ridge regression forecast. Decision-support only — not a medical alert.
        </p>
      </CardContent>
    </Card>
  )
}
