import * as React from 'react'
import { HelpCircle } from 'lucide-react'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { cn } from '@/lib/utils'

interface HelpSheetProps {
  title: string
  children: React.ReactNode
  /** "icon" renders a HelpCircle button; "link" renders an underlined text trigger. */
  variant?: 'icon' | 'link'
  triggerLabel?: string
  className?: string
}

export function HelpSheet({
  title,
  children,
  variant = 'icon',
  triggerLabel = 'How does this work?',
  className,
}: HelpSheetProps) {
  return (
    <Sheet>
      <SheetTrigger asChild>
        {variant === 'link' ? (
          <button
            type="button"
            className={cn(
              'text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground transition-colors cursor-help',
              'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1 rounded-sm',
              className,
            )}
          >
            {triggerLabel}
          </button>
        ) : (
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
        )}
      </SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>{title}</SheetTitle>
        </SheetHeader>
        <div className="overflow-y-auto flex-1 px-6 py-4 space-y-2 text-sm text-muted-foreground">
          {children}
        </div>
      </SheetContent>
    </Sheet>
  )
}

interface HelpSectionProps {
  title: string
  children: React.ReactNode
  className?: string
}

export function HelpSection({ title, children, className }: HelpSectionProps) {
  return (
    <div className={className}>
      <h3 className="font-semibold text-sm text-foreground mt-4 mb-1 first:mt-0">{title}</h3>
      <div className="space-y-1">{children}</div>
    </div>
  )
}
