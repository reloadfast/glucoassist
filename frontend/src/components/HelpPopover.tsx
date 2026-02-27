/**
 * HelpPopover — click-to-open contextual help popover.
 *
 * Content authoring guide:
 * ┌─────────────┬──────────────────┬──────────────────────────────┬────────────┐
 * │ Tier        │ Component        │ When to use                  │ Max length │
 * ├─────────────┼──────────────────┼──────────────────────────────┼────────────┤
 * │ Hover       │ Tooltip          │ ≤15-word definition          │ 1 line     │
 * │ Click       │ HelpPopover      │ 1–3 paragraphs, 1 formula    │ ~120 words │
 * │ Click       │ HelpSheet        │ Multi-section, tables, refs  │ Unlimited  │
 * └─────────────┴──────────────────┴──────────────────────────────┴────────────┘
 *
 * Writing guidelines:
 * - Plain language first; formulas in a secondary section via <HelpFormula>.
 * - End any section with clinical values with a disclaimer.
 * - Keep body under ~120 words; move longer content to HelpSheet.
 */
import * as React from 'react'
import { HelpCircle } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'

interface HelpPopoverProps {
  title: string
  children: React.ReactNode
  className?: string
}

export function HelpPopover({ title, children, className }: HelpPopoverProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`Help: ${title}`}
          className={cn(
            'inline-flex items-center justify-center rounded-sm text-muted-foreground cursor-help',
            'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1',
            'hover:text-foreground transition-colors',
            className,
          )}
        >
          <HelpCircle className="h-3.5 w-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-4">
        <p className="font-semibold text-sm mb-2">{title}</p>
        <div className="text-sm text-muted-foreground space-y-2">{children}</div>
      </PopoverContent>
    </Popover>
  )
}

interface HelpFormulaProps {
  children: React.ReactNode
  className?: string
}

export function HelpFormula({ children, className }: HelpFormulaProps) {
  return (
    <code
      className={cn(
        'block font-mono bg-muted rounded px-2 py-1 text-xs mt-2 text-foreground',
        className,
      )}
    >
      {children}
    </code>
  )
}
