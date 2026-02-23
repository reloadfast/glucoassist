import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useRatios } from '@/hooks/useRatios'
import type { TimeBlockRatio } from '@/lib/api'

function fmtEstimate(
  est: { mean: number; ci_lower: number; ci_upper: number; n: number } | null,
): string | null {
  if (!est) return null
  return `${est.mean.toFixed(1)} (90% CI: ${est.ci_lower.toFixed(1)}–${est.ci_upper.toFixed(1)}, n=${est.n})`
}

function RatioRow({ block }: { block: TimeBlockRatio }) {
  return (
    <tr className="border-b last:border-0">
      <td className="py-2 pr-4 font-medium capitalize">{block.block}</td>
      <td className="py-2 pr-4 text-right tabular-nums">
        {fmtEstimate(block.icr) ?? <span className="text-muted-foreground">—</span>}
      </td>
      <td className="py-2 pr-4 text-right tabular-nums">
        {fmtEstimate(block.cf) ?? <span className="text-muted-foreground">—</span>}
      </td>
      <td className="py-2 pl-2">
        {block.insufficient_data && (
          <Badge variant="secondary" className="text-xs">
            {block.icr_samples}/{block.cf_samples} obs.
          </Badge>
        )}
      </td>
    </tr>
  )
}

export default function Intelligence() {
  const { ratios, loading, error } = useRatios(90)

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold tracking-tight">Intelligence</h1>

      <Card>
        <CardHeader>
          <CardTitle>Insulin Ratio Estimates</CardTitle>
          <CardDescription>
            Based on {ratios?.days_analyzed ?? 90} days of paired insulin + meal logs. Requires ≥5
            paired observations per time block to surface an estimate.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading && <p className="text-sm text-muted-foreground">Calculating…</p>}
          {error && <p className="text-sm text-destructive">{error}</p>}
          {!loading && !error && ratios && (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="py-2 pr-4 text-left text-muted-foreground font-medium">
                        Time Block
                      </th>
                      <th className="py-2 pr-4 text-right text-muted-foreground font-medium">
                        ICR (g / unit)
                      </th>
                      <th className="py-2 pr-4 text-right text-muted-foreground font-medium">
                        CF (mg/dL / unit)
                      </th>
                      <th className="py-2 pl-2 text-left text-muted-foreground font-medium">
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {ratios.blocks.map((b) => (
                      <RatioRow key={b.block} block={b} />
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-muted-foreground border-t pt-3">{ratios.disclaimer}</p>
            </>
          )}
          {!loading && !error && !ratios && (
            <p className="text-sm text-muted-foreground">No ratio data available.</p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
