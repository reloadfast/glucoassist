import { AlertTriangle, ShieldAlert } from 'lucide-react'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
    .map((f) => {
      const parts: string[] = []
      if (f.p_hypo >= 0.1) parts.push(`${Math.round(f.p_hypo * 100)}% hypo risk`)
      if (f.p_hyper >= 0.1) parts.push(`${Math.round(f.p_hyper * 100)}% hyper risk`)
      return `${f.horizon_min}-min: ${parts.join(', ')}`
    })

  return (
    <Card className={`border ${config.bg}`}>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Icon className={`h-5 w-5 ${config.iconClass}`} />
          {config.label} — Glucose Forecast
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-1">
        {riskLines.map((line) => (
          <p key={line} className="text-sm text-muted-foreground">
            {line}
          </p>
        ))}
        <p className="pt-1 text-xs text-muted-foreground">
          Based on Ridge regression forecast. Decision-support only — not a medical alert.
        </p>
      </CardContent>
    </Card>
  )
}
