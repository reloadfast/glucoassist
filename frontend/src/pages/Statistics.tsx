import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Tooltip as UITooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { useAnalytics } from '@/hooks/useAnalytics'
import type { WindowStats } from '@/lib/api'

function fmt(val: number | null, decimals = 1): string {
  return val != null ? val.toFixed(decimals) : '—'
}

function HbA1cCard({
  label,
  eag,
  hba1c,
}: {
  label: string
  eag: number | null
  hba1c: number | null
}) {
  return (
    <Card>
      <CardHeader>
        <CardDescription>{label}</CardDescription>
        <CardTitle className="text-3xl">{hba1c != null ? `${fmt(hba1c)}%` : '—'}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">eAG {fmt(eag)} mg/dL</p>
      </CardContent>
    </Card>
  )
}

function tirChartData(windows: WindowStats[]) {
  return windows.map((w) => ({
    name: `${w.window_days}d`,
    'In Range': w.tir_pct ?? 0,
    'Above Range': w.tar_pct ?? 0,
    'Below Range': w.tbr_pct ?? 0,
  }))
}

const COLUMN_DESCRIPTIONS: Record<string, string> = {
  Avg: 'Average glucose — the mean glucose level over the window. A useful baseline but can mask dangerous highs and lows if variability is high. Target depends on individual goals; a common range is 80–154 mg/dL (eAG equivalent of HbA1c 5–7%).',
  SD: 'Standard deviation — how widely glucose values are spread around the average. A high SD means frequent swings, which increases both hypo and hyper risk regardless of a good average. Target SD <36% of your mean (see CV%).',
  'CV%':
    'Glucose variability — measures how much glucose fluctuates relative to your average. High variability increases hypoglycaemia risk even when the average looks healthy. Calculated as SD ÷ Avg × 100. Target <36%.',
  'TIR%':
    'Time in range — the percentage of readings between 70 and 180 mg/dL. The single most actionable metric for daily management; directly linked to reduced risk of complications. Target ≥70% (≥50% for older adults or those with high hypo risk).',
  'TBR%':
    'Time below range — the percentage of readings under 70 mg/dL. Even brief hypoglycaemia carries immediate safety risks and impairs awareness over time. Every 1% TBR reduction is clinically meaningful. Target <4% (<1% below 54 mg/dL).',
  'TAR%':
    'Time above range — the percentage of readings over 180 mg/dL. Sustained hyperglycaemia drives long-term complications (neuropathy, retinopathy, nephropathy). Target <25% (<5% above 250 mg/dL).',
}

function ColHeader({ label, align = 'right' }: { label: string; align?: 'left' | 'right' }) {
  const desc = COLUMN_DESCRIPTIONS[label]
  if (!desc) {
    return (
      <th className={`py-2 pr-4 font-medium text-muted-foreground text-${align} last:pr-0`}>
        {label}
      </th>
    )
  }
  return (
    <th className={`py-2 pr-4 font-medium text-muted-foreground text-${align} last:pr-0`}>
      <UITooltip>
        <TooltipTrigger asChild>
          <span className="cursor-help underline decoration-dotted underline-offset-2">
            {label}
          </span>
        </TooltipTrigger>
        <TooltipContent side="top">
          <p className="max-w-sm text-xs">{desc}</p>
        </TooltipContent>
      </UITooltip>
    </th>
  )
}

function WindowTable({ windows }: { windows: WindowStats[] }) {
  return (
    <TooltipProvider>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b">
              <ColHeader label="Window" align="left" />
              <ColHeader label="Readings" />
              <ColHeader label="Avg" />
              <ColHeader label="SD" />
              <ColHeader label="CV%" />
              <ColHeader label="TIR%" />
              <ColHeader label="TBR%" />
              <ColHeader label="TAR%" />
            </tr>
          </thead>
          <tbody>
            {windows.map((w) => (
              <tr key={w.window_days} className="border-b last:border-0">
                <td className="py-2 pr-4 font-medium">{w.window_days}d</td>
                <td className="py-2 pr-4 text-right">{w.reading_count}</td>
                <td className="py-2 pr-4 text-right">{fmt(w.avg_glucose)}</td>
                <td className="py-2 pr-4 text-right">{fmt(w.sd)}</td>
                <td className="py-2 pr-4 text-right">{fmt(w.cv_pct)}</td>
                <td className="py-2 pr-4 text-right">{fmt(w.tir_pct)}</td>
                <td className="py-2 pr-4 text-right">{fmt(w.tbr_pct)}</td>
                <td className="py-2 text-right">{fmt(w.tar_pct)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </TooltipProvider>
  )
}

export default function Statistics() {
  const { stats, hba1c, loading, error } = useAnalytics()

  if (loading) {
    return <p className="text-muted-foreground">Loading analytics…</p>
  }

  if (error) {
    return (
      <div className="rounded-md bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive">
        {error}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold tracking-tight">Statistics</h1>

      {/* HbA1c projection cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <HbA1cCard
          label="HbA1c (30d)"
          eag={hba1c?.eag_30d ?? null}
          hba1c={hba1c?.hba1c_30d ?? null}
        />
        <HbA1cCard
          label="HbA1c (60d)"
          eag={hba1c?.eag_60d ?? null}
          hba1c={hba1c?.hba1c_60d ?? null}
        />
        <HbA1cCard
          label="HbA1c (90d)"
          eag={hba1c?.eag_90d ?? null}
          hba1c={hba1c?.hba1c_90d ?? null}
        />
      </div>

      {/* TIR stacked bar chart */}
      <Card>
        <CardHeader>
          <CardTitle>Time in Range</CardTitle>
          <CardDescription>30 / 60 / 90 day windows — target: TIR ≥70%, TBR &lt;4%</CardDescription>
        </CardHeader>
        <CardContent>
          {stats && stats.windows.every((w) => w.reading_count === 0) ? (
            <p className="text-sm text-muted-foreground">No data yet.</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={tirChartData(stats?.windows ?? [])} barSize={40}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" />
                <YAxis unit="%" domain={[0, 100]} />
                <Tooltip
                  formatter={(v) => (typeof v === 'number' ? `${v.toFixed(1)}%` : String(v ?? ''))}
                />
                <Legend />
                <Bar dataKey="Below Range" stackId="tir" fill="#ef4444" />
                <Bar dataKey="In Range" stackId="tir" fill="#22c55e">
                  {(stats?.windows ?? []).map((w) => (
                    <Cell key={w.window_days} fill="#22c55e" />
                  ))}
                </Bar>
                <Bar dataKey="Above Range" stackId="tir" fill="#f97316" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Window comparison table */}
      <Card>
        <CardHeader>
          <CardTitle>Window Comparison</CardTitle>
          <CardDescription>Key glycaemic metrics across time windows</CardDescription>
        </CardHeader>
        <CardContent>
          <WindowTable windows={stats?.windows ?? []} />
        </CardContent>
      </Card>
    </div>
  )
}
