import { useEffect, useRef, useState } from 'react'
import { Syringe } from 'lucide-react'

import { HelpFormula, HelpPopover } from '@/components/HelpPopover'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { getDoseProposal, type DoseProposalResponse } from '@/lib/api'

// ── helpers ──────────────────────────────────────────────────────────────────

/** Round to nearest 0.5 — matches common pen/pump dose step. */
function roundToHalfUnit(value: number): number {
  return Math.round(value * 2) / 2
}

const BLOCK_LABELS: Record<string, string> = {
  overnight: 'Overnight',
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
}

// ── types ─────────────────────────────────────────────────────────────────────

interface Props {
  carbsG: number
  hour: number
  /** Called when the user clicks "Use this" — value is rounded to 0.5 u. */
  onUse: (units: number) => void
}

// ── component ────────────────────────────────────────────────────────────────

export default function DoseProposalBadge({ carbsG, hour, onUse }: Props) {
  const [proposal, setProposal] = useState<DoseProposalResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (carbsG <= 0) return

    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      setLoading(true)
      getDoseProposal(carbsG, hour)
        .then(setProposal)
        .catch(() => setProposal(null))
        .finally(() => setLoading(false))
    }, 400)

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [carbsG, hour])

  if (carbsG <= 0) return null

  return (
    <div className="rounded-md border bg-muted/30 dark:bg-muted/20 px-3 py-2.5 space-y-1.5">
      {/* header row */}
      <div className="flex items-center gap-1.5">
        <Syringe className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Dose proposal
        </span>
        <HelpPopover title="How is the dose proposal calculated?">
          <p>
            Based on your personal Insulin-to-Carb Ratio (ICR) for this time of day, estimated from
            your past meal and bolus logs.
          </p>
          <HelpFormula>
            Suggested units = Carbs (g) ÷ ICR
            <br />
            ICR = grams of carbs covered by 1 unit of insulin
          </HelpFormula>
          <p>
            The range shown is a 90% confidence interval — your actual need may fall outside it
            depending on current glucose, activity, or stress.
          </p>
          <p className="text-xs italic">
            Decision-support only — always follow guidance from your healthcare team.
          </p>
        </HelpPopover>
      </div>

      {/* body */}
      {loading && (
        <div className="flex items-center gap-2">
          <Skeleton className="h-5 w-16" />
          <Skeleton className="h-4 w-24" />
        </div>
      )}

      {!loading && proposal && !proposal.sufficient_data && (
        <p className="text-xs text-muted-foreground">
          Not enough data yet — log more meals with bolus doses to unlock proposals.
        </p>
      )}

      {!loading && proposal?.sufficient_data && proposal.suggested_units !== null && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xl font-bold tabular-nums leading-none">
            <span data-testid="dose-proposal-value">{proposal.suggested_units.toFixed(1)}</span>
            <span className="text-sm font-normal text-muted-foreground ml-0.5">u</span>
          </span>

          {proposal.suggested_units_low !== null && proposal.suggested_units_high !== null && (
            <span className="text-xs text-muted-foreground tabular-nums">
              ({proposal.suggested_units_low.toFixed(1)}–{proposal.suggested_units_high.toFixed(1)}{' '}
              u range)
            </span>
          )}

          <Badge variant="secondary" className="text-xs capitalize">
            {BLOCK_LABELS[proposal.block] ?? proposal.block}
          </Badge>

          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-6 px-2 text-xs ml-auto"
            onClick={() => onUse(roundToHalfUnit(proposal.suggested_units!))}
          >
            Use this
          </Button>
        </div>
      )}

      {!loading && proposal?.sufficient_data && (
        <p className="text-[10px] text-muted-foreground leading-tight">{proposal.disclaimer}</p>
      )}
    </div>
  )
}
