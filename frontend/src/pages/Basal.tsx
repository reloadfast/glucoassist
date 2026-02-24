import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useBasalWindows } from '@/hooks/useBasalWindows'
import type { BasalWindowBlock } from '@/lib/api'

function fmt(val: number | null): string {
  return val != null ? val.toFixed(0) : '—'
}

interface ChartEntry {
  name: string
  base: number | undefined
  lower_band: number | undefined
  iqr: number | undefined
  upper_band: number | undefined
  median: number | undefined
  _p10: number | null
  _p25: number | null
  _median: number | null
  _p75: number | null
  _p90: number | null
  _nights: number
  _n: number
}

function toChartEntry(b: BasalWindowBlock): ChartEntry {
  const { p10, p25, median, p75, p90 } = b
  const hasData = p10 !== null && p25 !== null && median !== null && p75 !== null && p90 !== null
  return {
    name: b.block_label,
    base: hasData ? p10! : undefined,
    lower_band: hasData ? p25! - p10! : undefined,
    iqr: hasData ? p75! - p25! : undefined,
    upper_band: hasData ? p90! - p75! : undefined,
    median: hasData ? median! : undefined,
    _p10: p10,
    _p25: p25,
    _median: median,
    _p75: p75,
    _p90: p90,
    _nights: b.nights,
    _n: b.n,
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  const d: ChartEntry = payload[0]?.payload
  if (!d) return null

  return (
    <div className="rounded-lg border bg-background p-3 shadow text-sm space-y-1 min-w-[160px]">
      <p className="font-medium">{label}</p>
      {d._median !== null ? (
        <>
          <p className="text-muted-foreground">
            Median: <span className="text-foreground font-medium">{fmt(d._median)} mg/dL</span>
          </p>
          <p className="text-muted-foreground">
            IQR: {fmt(d._p25)}–{fmt(d._p75)} mg/dL
          </p>
          <p className="text-muted-foreground">
            Range: {fmt(d._p10)}–{fmt(d._p90)} mg/dL
          </p>
          <p className="text-muted-foreground">Nights: {d._nights}</p>
        </>
      ) : (
        <p className="text-muted-foreground">
          Insufficient data ({d._nights} night{d._nights === 1 ? '' : 's'})
        </p>
      )}
    </div>
  )
}

export default function Basal() {
  const { data, loading, error } = useBasalWindows()

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-80 w-full" />
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-lg" />
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <Card>
        <CardContent className="py-6 text-sm text-destructive">{error}</CardContent>
      </Card>
    )
  }

  const chartData = data?.blocks.map(toChartEntry) ?? []
  const nightsAnalyzed = data?.nights_analyzed ?? 0

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Basal Window Analysis</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Overnight glucose distribution by 2-hour block — last 30 days
          {nightsAnalyzed > 0 && ` (${nightsAnalyzed} nights)`}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Overnight Glucose Distribution</CardTitle>
          <CardDescription>
            Band shows 10th–90th percentile range; dark band is IQR (25th–75th); line is median.
            At least 3 nights of data required per block.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div role="img" aria-label="Overnight glucose distribution chart by 2-hour block">
            <ResponsiveContainer width="100%" height={320}>
              <ComposedChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis
                  domain={[50, 250]}
                  tickCount={8}
                  tick={{ fontSize: 12 }}
                  unit=" mg/dL"
                  width={80}
                />
                <Tooltip content={<CustomTooltip />} />

                {/* Target range 70–140 */}
                <ReferenceArea y1={70} y2={140} fill="hsl(142.1 76.2% 36.3%)" fillOpacity={0.07} />
                <ReferenceLine
                  y={70}
                  stroke="hsl(0 84.2% 60.2%)"
                  strokeDasharray="4 2"
                  strokeWidth={1}
                />
                <ReferenceLine
                  y={140}
                  stroke="hsl(24.6 95% 53.1%)"
                  strokeDasharray="4 2"
                  strokeWidth={1}
                />

                {/* Stacked areas: transparent base → lower band → IQR → upper band */}
                <Area
                  type="monotone"
                  dataKey="base"
                  stackId="pct"
                  fill="transparent"
                  stroke="none"
                  isAnimationActive={false}
                />
                <Area
                  type="monotone"
                  dataKey="lower_band"
                  stackId="pct"
                  fill="hsl(217.2 91.2% 59.8%)"
                  fillOpacity={0.18}
                  stroke="none"
                  isAnimationActive={false}
                />
                <Area
                  type="monotone"
                  dataKey="iqr"
                  stackId="pct"
                  fill="hsl(217.2 91.2% 59.8%)"
                  fillOpacity={0.45}
                  stroke="none"
                  isAnimationActive={false}
                />
                <Area
                  type="monotone"
                  dataKey="upper_band"
                  stackId="pct"
                  fill="hsl(217.2 91.2% 59.8%)"
                  fillOpacity={0.18}
                  stroke="none"
                  isAnimationActive={false}
                />

                {/* Median line */}
                <Line
                  type="monotone"
                  dataKey="median"
                  stroke="hsl(217.2 91.2% 59.8%)"
                  strokeWidth={2.5}
                  dot={{ r: 4, fill: 'hsl(217.2 91.2% 59.8%)' }}
                  activeDot={{ r: 6 }}
                  isAnimationActive={false}
                  connectNulls={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Per-block summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {data?.blocks.map((b) => (
          <Card key={b.block_label}>
            <CardHeader className="pb-1 pt-4 px-4">
              <CardDescription className="text-xs">{b.block_label}</CardDescription>
              <CardTitle className="text-xl">{fmt(b.median)}</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4 text-xs text-muted-foreground space-y-0.5">
              {b.median !== null ? (
                <>
                  <p>
                    IQR: {fmt(b.p25)}–{fmt(b.p75)}
                  </p>
                  <p>
                    {b.nights} night{b.nights === 1 ? '' : 's'}
                  </p>
                </>
              ) : (
                <p>
                  {b.nights < 3
                    ? `${b.nights}/3 nights`
                    : 'No data'}
                </p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
