import { cn } from '@/lib/utils'
import { CONVERSATION_STATUS_LABEL, QUOTE_STATUS_LABEL, REPORT_STATUS_LABEL } from '@/lib/labels'

const QUOTE_STATUS_CLASS: Record<string, string> = {
  new: 'bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-200',
  quoted: 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200',
  won: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200',
  lost: 'bg-muted text-muted-foreground',
}

const CONVERSATION_STATUS_CLASS: Record<string, string> = {
  needs_human: 'bg-orange-100 text-orange-900 dark:bg-orange-950 dark:text-orange-200',
  claimed: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200',
  ai_handling: 'bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-200',
  closed: 'bg-muted text-muted-foreground',
}

const REPORT_STATUS_CLASS: Record<string, string> = {
  new: 'bg-orange-100 text-orange-900 dark:bg-orange-950 dark:text-orange-200',
  in_progress: 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200',
  resolved: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200',
}

const LABELS = {
  quote: QUOTE_STATUS_LABEL,
  conversation: CONVERSATION_STATUS_LABEL,
  report: REPORT_STATUS_LABEL,
} as const

const TONES = {
  quote: QUOTE_STATUS_CLASS,
  conversation: CONVERSATION_STATUS_CLASS,
  report: REPORT_STATUS_CLASS,
} as const

export function StatusChip({
  kind,
  status,
  className,
}: {
  kind: 'quote' | 'conversation' | 'report'
  status: string
  className?: string
}) {
  const label = LABELS[kind][status] || status
  const tone = TONES[kind][status] || 'bg-muted text-muted-foreground'

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
        tone,
        className
      )}
    >
      {label}
    </span>
  )
}
