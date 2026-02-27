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
import { Skeleton } from '@/components/ui/skeleton'
import { HelpPopover, HelpFormula } from '@/components/HelpPopover'
import { HelpSheet, HelpSection } from '@/components/HelpSheet'
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

// Expanded column descriptions for HelpPopover (click-persistent, ~120 words each)
const COLUMN_HELP: Record<string, { title: string; content: React.ReactNode }> = {
  Avg: {
    title: 'Average glucose',
    content: (
      <>
        <p>
          The mean glucose level over the window. A useful baseline, but can mask dangerous highs
          and lows if variability is high.
        </p>
        <p>
          Consider alongside SD and CV% for a full picture. A common target range is 80–154 mg/dL
          (eAG equivalent of HbA1c 5–7%).
        </p>
      </>
    ),
  },
  SD: {
    title: 'Standard Deviation (SD)',
    content: (
      <>
        <p>
          How widely glucose values are spread around the average. A high SD means frequent swings,
          which increases both hypo and hyper risk even when the average looks healthy.
        </p>
        <p>
          A SD above 50 mg/dL generally indicates high variability. Lower is better, but very low SD
          may indicate limited range of activity.
        </p>
      </>
    ),
  },
  'CV%': {
    title: 'Coefficient of Variation (CV%)',
    content: (
      <>
        <p>
          Measures how much glucose fluctuates relative to your average. High variability increases
          hypoglycaemia risk even when the average looks healthy.
        </p>
        <HelpFormula>CV% = SD ÷ Avg × 100</HelpFormula>
        <p className="mt-2">
          The international consensus target for acceptable variability is CV% ≤ 36%.
        </p>
      </>
    ),
  },
  'TIR%': {
    title: 'Time in Range (TIR%)',
    content: (
      <>
        <p>
          The percentage of readings between 70 and 180 mg/dL. The single most actionable metric for
          daily management; directly linked to reduced risk of complications.
        </p>
        <p>
          Target ≥ 70% for most adults with T1D (international consensus). Each 5% improvement in
          TIR correlates with meaningful clinical benefit.
        </p>
      </>
    ),
  },
  'TBR%': {
    title: 'Time Below Range (TBR%)',
    content: (
      <>
        <p>
          The percentage of readings under 70 mg/dL. Even brief hypoglycaemia carries immediate
          safety risks and impairs awareness over time. Every 1% TBR reduction is clinically
          meaningful.
        </p>
        <p>
          Target &lt; 4% overall (&lt; 1% below 54 mg/dL). TBR reduction takes priority over all
          other metrics.
        </p>
      </>
    ),
  },
  'TAR%': {
    title: 'Time Above Range (TAR%)',
    content: (
      <>
        <p>
          The percentage of readings over 180 mg/dL. Sustained hyperglycaemia drives long-term
          complications (neuropathy, retinopathy, nephropathy).
        </p>
        <p>Target &lt; 25% overall (&lt; 5% above 250 mg/dL).</p>
      </>
    ),
  },
}

function ColHeader({ label, align = 'right' }: { label: string; align?: 'left' | 'right' }) {
  const help = COLUMN_HELP[label]
  if (!help) {
    return (
      <th className={`py-2 pr-4 font-medium text-muted-foreground text-${align} last:pr-0`}>
        {label}
      </th>
    )
  }
  return (
    <th className={`py-2 pr-4 font-medium text-muted-foreground text-${align} last:pr-0`}>
      <span className="inline-flex items-center gap-1">
        {label}
        <HelpPopover title={help.title}>{help.content}</HelpPopover>
      </span>
    </th>
  )
}

function WindowTable({ windows }: { windows: WindowStats[] }) {
  return (
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
  )
}

export default function Statistics() {
  const { stats, hba1c, loading, error } = useAnalytics()

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-4 md:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-lg" />
          ))}
        </div>
      </div>
    )
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
      <div>
        <div className="flex items-center gap-2 mb-3">
          <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
            HbA1c Estimates
          </h2>
          <HelpSheet title="HbA1c Estimates" variant="link" triggerLabel="How is this calculated?">
            <HelpSection title="What HbA1c is">
              <p>
                HbA1c (glycated haemoglobin) measures your average blood glucose over the past 2–3
                months. It reflects the percentage of haemoglobin in your red blood cells that has
                glucose attached. It is the primary long-term diabetes management metric used in
                clinical practice.
              </p>
            </HelpSection>
            <HelpSection title="How GlucoAssist estimates it">
              <p>Uses the internationally validated ADA formula:</p>
              <HelpFormula>eAG (mg/dL) = average glucose over window</HelpFormula>
              <HelpFormula>HbA1c (%) = (eAG + 46.7) ÷ 28.7</HelpFormula>
            </HelpSection>
            <HelpSection title="The three windows (30d / 60d / 90d)">
              <p>
                Three rolling windows are shown because glucose patterns shift over time. The 90-day
                window is the closest equivalent to a lab HbA1c test. The 30-day window is more
                sensitive to recent changes.
              </p>
            </HelpSection>
            <HelpSection title="Common reference targets">
              <table className="w-full text-xs border-collapse mt-1">
                <thead>
                  <tr className="border-b">
                    <th className="text-left pb-1 font-medium text-foreground">HbA1c</th>
                    <th className="text-left pb-1 font-medium text-foreground">Interpretation</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="py-0.5 pr-3">&lt; 7% (&lt; 53 mmol/mol)</td>
                    <td>Target for most adults with T1D (ADA)</td>
                  </tr>
                  <tr>
                    <td className="py-0.5 pr-3">7–8%</td>
                    <td>Individualised targets (older adults, hypo unawareness)</td>
                  </tr>
                  <tr>
                    <td className="py-0.5 pr-3">&gt; 8%</td>
                    <td>Above target — discuss with care team</td>
                  </tr>
                </tbody>
              </table>
            </HelpSection>
            <HelpSection title="Limitations">
              <p>
                This is an <strong>estimate</strong>, not a lab result. CGM readings have a ±10–15%
                accuracy margin vs. venous blood samples. The formula assumes a stable relationship
                between average glucose and HbA1c — this varies between individuals.
              </p>
              <p>
                Do not use this estimate to make medication decisions without consulting your
                healthcare team.
              </p>
            </HelpSection>
          </HelpSheet>
        </div>
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
          <CardTitle className="flex items-center gap-1.5">
            Window Comparison
            <HelpPopover title="Analysis windows (30d / 60d / 90d)">
              <p>All metrics are calculated from CGM readings within the selected time window.</p>
              <ul className="mt-1 space-y-1">
                <li>
                  <strong>30 days</strong> — most sensitive to recent treatment adjustments
                </li>
                <li>
                  <strong>60 days</strong> — balanced view with less noise
                </li>
                <li>
                  <strong>90 days</strong> — closest equivalent to a lab HbA1c test period
                </li>
              </ul>
            </HelpPopover>
          </CardTitle>
          <CardDescription>Key glycaemic metrics across time windows</CardDescription>
        </CardHeader>
        <CardContent>
          <WindowTable windows={stats?.windows ?? []} />
        </CardContent>
      </Card>
    </div>
  )
}
