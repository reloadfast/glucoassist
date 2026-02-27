import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { HelpPopover } from '@/components/HelpPopover'
import { useRatios } from '@/hooks/useRatios'
import type { TimeBlockRatio } from '@/lib/api'

function fmtEstimate(
  est: { mean: number; ci_lower: number; ci_upper: number; n: number } | null,
): string | null {
  if (!est) return null
  return `${est.mean.toFixed(1)} (90% CI: ${est.ci_lower.toFixed(1)}–${est.ci_upper.toFixed(1)}, n=${est.n})`
}

function HeaderWithHelp({
  label,
  title,
  children,
}: {
  label: string
  title: string
  children: React.ReactNode
}) {
  return (
    <span className="inline-flex items-center gap-1">
      {label}
      <HelpPopover title={title}>{children}</HelpPopover>
    </span>
  )
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
                        <HeaderWithHelp label="ICR (g / unit)" title="Insulin-to-Carb Ratio (ICR)">
                          <p>
                            Grams of carbohydrate covered by 1 unit of rapid-acting insulin.
                            Calculated from paired meal + rapid-insulin logs: carbs ÷ units.
                          </p>
                          <p>A higher ICR means you need less insulin per gram of carbs.</p>
                        </HeaderWithHelp>
                      </th>
                      <th className="py-2 pr-4 text-right text-muted-foreground font-medium">
                        <HeaderWithHelp label="CF (mg/dL / unit)" title="Correction Factor (CF)">
                          <p>
                            How much 1 unit of rapid-acting insulin lowers blood glucose (mg/dL).
                            Also called Insulin Sensitivity Factor (ISF).
                          </p>
                          <p>
                            Estimated using the 1800 rule: 1800 ÷ total daily dose. A higher CF
                            means you are more sensitive to insulin.
                          </p>
                        </HeaderWithHelp>
                      </th>
                      <th className="py-2 pl-2 text-left text-muted-foreground font-medium">
                        <HeaderWithHelp label="Status" title="Observation Count">
                          <p>
                            Shows the number of paired observations used for each estimate. At least
                            5 paired records are required before an estimate is shown.
                          </p>
                          <p>Fewer observations are displayed as a count only.</p>
                        </HeaderWithHelp>
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
