import { cn } from '@/lib/utils'

export const QUOTE_STATUS_LABEL: Record<string, string> = {
  new: 'New',
  quoted: 'Quoted',
  won: 'Won',
  lost: 'Lost',
}

export const CONVERSATION_STATUS_LABEL: Record<string, string> = {
  needs_human: 'Needs you',
  mine: 'Mine',
  claimed: 'Claimed',
  ai_handling: 'With AI',
  closed: 'Closed',
}

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

export function StatusChip({
  kind,
  status,
  className,
}: {
  kind: 'quote' | 'conversation'
  status: string
  className?: string
}) {
  const label =
    kind === 'quote'
      ? QUOTE_STATUS_LABEL[status] || status
      : CONVERSATION_STATUS_LABEL[status] || status
  const tone =
    kind === 'quote'
      ? QUOTE_STATUS_CLASS[status] || 'bg-muted text-muted-foreground'
      : CONVERSATION_STATUS_CLASS[status] || 'bg-muted text-muted-foreground'

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
