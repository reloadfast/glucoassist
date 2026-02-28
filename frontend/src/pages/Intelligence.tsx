import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { HelpPopover, HelpFormula } from '@/components/HelpPopover'
import { HelpSheet, HelpSection } from '@/components/HelpSheet'
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
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge variant="secondary" className="text-xs cursor-help">
                {block.icr_samples} ICR / {block.cf_samples} CF obs.
              </Badge>
            </TooltipTrigger>
            <TooltipContent className="max-w-xs text-xs">
              <p>
                <strong>{block.icr_samples}</strong> ICR observations — meal + bolus pairs logged in
                this time block.
              </p>
              <p className="mt-1">
                <strong>{block.cf_samples}</strong> CF observations — correction bolus events
                (insulin without a concurrent meal).
              </p>
              <p className="mt-1 text-muted-foreground">
                At least 5 of each are needed before an estimate appears.
              </p>
            </TooltipContent>
          </Tooltip>
        )}
      </td>
    </tr>
  )
}

export default function Intelligence() {
  const { ratios, loading, error } = useRatios(90)

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <h1 className="text-3xl font-bold tracking-tight">Intelligence</h1>
        <HelpSheet
          title="How are these calculated?"
          variant="link"
          triggerLabel="How are these calculated?"
        >
          <HelpSection title="Insulin-to-Carb Ratio (ICR)">
            <p>
              The ICR tells you how many grams of carbohydrates one unit of rapid-acting insulin
              covers. A ratio of 1:10 means 1 unit covers 10 g of carbs.
            </p>
            <p>
              GlucoAssist estimates your ICR per time block by analysing logged meal + insulin
              events and the glucose response that followed.
            </p>
            <p className="text-xs mt-1">
              This is an analytical estimate, not a prescription. ICR varies by time of day, meal
              composition, activity, and individual physiology. Always validate with your diabetes
              care team.
            </p>
          </HelpSection>
          <HelpSection title="Correction Factor (CF / ISF)">
            <p>
              The Correction Factor (also called Insulin Sensitivity Factor) tells you how many
              mg/dL one unit of rapid-acting insulin will lower your glucose.
            </p>
            <p>
              GlucoAssist estimates CF per time block by analysing correction bolus events (insulin
              logged without a meal) and the glucose drop that followed over 3–4 hours.
            </p>
            <p>Standard cross-check:</p>
            <HelpFormula>CF ≈ 1800 ÷ Total Daily Dose</HelpFormula>
          </HelpSection>
          <HelpSection title="Time blocks">
            <p>
              Both ICR and CF are estimated per 4-hour block because insulin sensitivity varies
              significantly across the day. Blocks with fewer than 5 logged events show "—"
              (insufficient data).
            </p>
          </HelpSection>
          <HelpSection title="Confidence">
            <p>
              The number of events used per block is shown. More events means a more reliable
              estimate. Treat blocks with fewer than 10 events as preliminary.
            </p>
            <p>
              Decision-support only — always discuss ratio adjustments with your healthcare team.
            </p>
          </HelpSection>
          <HelpSection title="What to log to populate estimates">
            <p>
              <strong>For ICR</strong> — log a meal (carb amount) and a bolus insulin dose within
              the same time block. GlucoAssist pairs them when the insulin is logged within 30
              minutes of the meal and the glucose returns to near-baseline within 4 hours.
            </p>
            <p>
              <strong>For CF</strong> — log a correction bolus (insulin without a concurrent meal)
              and let GlucoAssist observe the glucose drop over the following 3–4 hours.
            </p>
            <p>
              Each time block (e.g. Morning 06:00–10:00) needs at least 5 qualifying paired events
              before an estimate appears. Logging consistently for 2–4 weeks across different times
              of day gives the most complete picture.
            </p>
          </HelpSection>
        </HelpSheet>
      </div>

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
                            Shows how many qualifying events have been logged for each estimate in
                            this time block. The badge format is <strong>ICR obs. / CF obs.</strong>
                          </p>
                          <p>
                            <strong>ICR observations</strong> — meal + bolus insulin pairs where
                            both were logged within the same time block.
                          </p>
                          <p>
                            <strong>CF observations</strong> — correction bolus events (insulin
                            logged without a concurrent meal).
                          </p>
                          <p>
                            At least 5 of each are required before an estimate appears. Fewer than
                            10 should be treated as preliminary.
                          </p>
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
            <div className="space-y-3 text-sm">
              <p className="text-muted-foreground">
                No ratio estimates yet — not enough paired insulin and meal logs.
              </p>
              <div className="rounded-md border bg-muted/40 p-4 space-y-2 text-sm">
                <p className="font-medium">How to populate estimates</p>
                <ul className="space-y-1.5 list-disc list-inside text-muted-foreground">
                  <li>
                    <strong className="text-foreground">ICR:</strong> log a meal with a carb amount,
                    then log a bolus insulin dose within the same time block. Repeat across
                    different times of day.
                  </li>
                  <li>
                    <strong className="text-foreground">CF:</strong> log a correction bolus (insulin
                    without a meal) and allow 3–4 hours for the glucose drop to be recorded.
                  </li>
                  <li>
                    Each time block needs at least 5 qualifying paired events before an estimate
                    appears. Logging consistently for 2–4 weeks gives the most complete picture.
                  </li>
                </ul>
                <p className="text-xs text-muted-foreground pt-1">
                  Use the <strong>Logs</strong> page to add meal and insulin entries. Open{' '}
                  <em>How are these calculated?</em> above for a full explanation.
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
