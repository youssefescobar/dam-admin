import { useState } from 'react'
import { StickyNote } from 'lucide-react'
import { toast } from 'sonner'
import type { Quote } from '@/lib/types'
import { QUOTE_STATUS_LABEL } from '@/components/ui/status-chip'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn, formatSar } from '@/lib/utils'

type Status = Quote['status']

const COLUMNS: Status[] = ['new', 'quoted', 'won', 'lost']

const COLUMN_ACCENT: Record<Status, string> = {
  new: 'bg-sky-500',
  quoted: 'bg-amber-500',
  won: 'bg-emerald-500',
  lost: 'bg-muted-foreground/50',
}

const DRAG_TYPE = 'application/x-quote-id'

/** Reminder the backend already sent for this quote, if it still applies. */
function reminderBadge(q: Quote): { label: string; className: string } | null {
  if (q.status === 'new' && q.overdueRemindedAt) {
    return { label: 'Overdue', className: 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200' }
  }
  if (q.status === 'quoted' && q.followUpRemindedAt) {
    return {
      label: 'Follow up',
      className: 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200',
    }
  }
  return null
}

export function ReminderBadge({ quote }: { quote: Quote }) {
  const badge = reminderBadge(quote)
  if (!badge) return null
  return (
    <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-medium', badge.className)}>
      {badge.label}
    </span>
  )
}

type Props = {
  quotes: Quote[]
  loading?: boolean
  /** Card click, or a drop onto "Quoted" without a price (staff must enter one first). */
  onOpen: (quote: Quote) => void
  onMove: (quote: Quote, status: Status) => void
}

/** Pipeline view: one column per status; drag a card (or use its menu) to move it. */
export function QuotesBoard({ quotes, loading, onOpen, onMove }: Props) {
  const [dragOver, setDragOver] = useState<Status | null>(null)

  const move = (quote: Quote, status: Status) => {
    if (quote.status === status) return
    if (status === 'quoted' && quote.quotedPrice == null) {
      toast.info('Enter a price to mark it as quoted')
      onOpen(quote)
      return
    }
    onMove(quote, status)
  }

  return (
    <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 sm:-mx-6 sm:px-6 lg:grid lg:grid-cols-4 lg:overflow-visible">
      {COLUMNS.map((status) => {
        const items = quotes.filter((q) => q.status === status)
        const total = items.reduce((sum, q) => sum + (q.quotedPrice ?? 0), 0)
        return (
          <section
            key={status}
            aria-label={QUOTE_STATUS_LABEL[status]}
            className={cn(
              'flex w-[80vw] max-w-xs shrink-0 snap-start flex-col rounded-xl border bg-muted/30 transition-colors lg:w-auto lg:max-w-none',
              dragOver === status && 'border-primary bg-primary/5'
            )}
            onDragOver={(e) => {
              if (!e.dataTransfer.types.includes(DRAG_TYPE)) return
              e.preventDefault()
              e.dataTransfer.dropEffect = 'move'
              setDragOver(status)
            }}
            onDragLeave={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDragOver(null)
            }}
            onDrop={(e) => {
              e.preventDefault()
              setDragOver(null)
              const quote = quotes.find((q) => q._id === e.dataTransfer.getData(DRAG_TYPE))
              if (quote) move(quote, status)
            }}
          >
            <header className="flex items-center justify-between gap-2 border-b px-3 py-2.5">
              <div className="flex items-center gap-2 text-sm font-medium">
                <span className={cn('size-2 rounded-full', COLUMN_ACCENT[status])} />
                {QUOTE_STATUS_LABEL[status]}
                <span className="text-xs font-normal text-muted-foreground tabular-nums">
                  {items.length}
                </span>
              </div>
              {total > 0 ? (
                <span className="text-xs text-muted-foreground tabular-nums">
                  {formatSar(total)}
                </span>
              ) : null}
            </header>

            <div className="flex min-h-32 flex-col gap-2 p-2">
              {loading &&
                Array.from({ length: 2 }).map((_, i) => (
                  <div key={i} className="h-20 animate-pulse rounded-lg border bg-card" />
                ))}
              {!loading &&
                items.map((q) => (
                  <BoardCard key={q._id} quote={q} onOpen={onOpen} onMove={move} />
                ))}
              {!loading && !items.length ? (
                <p className="px-2 py-6 text-center text-xs text-muted-foreground">
                  Nothing here
                </p>
              ) : null}
            </div>
          </section>
        )
      })}
    </div>
  )
}

function BoardCard({
  quote: q,
  onOpen,
  onMove,
}: {
  quote: Quote
  onOpen: (quote: Quote) => void
  onMove: (quote: Quote, status: Status) => void
}) {
  const [dragging, setDragging] = useState(false)
  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData(DRAG_TYPE, q._id)
        e.dataTransfer.effectAllowed = 'move'
        setDragging(true)
      }}
      onDragEnd={() => setDragging(false)}
      className={cn(
        'group animate-fade-in cursor-grab rounded-lg border bg-card p-3 text-sm shadow-xs transition-[opacity,box-shadow] hover:shadow-sm active:cursor-grabbing',
        dragging && 'opacity-40',
        q.priority === 'urgent' && 'border-l-4 border-l-red-500',
        q.priority === 'high' && 'border-l-4 border-l-amber-500'
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <button
          type="button"
          className="min-w-0 text-left"
          onClick={() => onOpen(q)}
        >
          <div className="truncate font-medium hover:underline">{q.customerName}</div>
          <div className="truncate text-xs text-muted-foreground">
            {q.organization || q.customerContact}
          </div>
        </button>
        <DropdownMenu>
          <DropdownMenuTrigger
            className="-me-1 -mt-1 rounded px-1.5 py-0.5 text-xs text-muted-foreground hover:bg-muted"
            aria-label="Move to"
          >
            Move
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {COLUMNS.filter((s) => s !== q.status).map((s) => (
              <DropdownMenuItem key={s} onClick={() => onMove(q, s)}>
                {QUOTE_STATUS_LABEL[s]}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <div className="mt-2 truncate">
        {q.pickup} → {q.dropoff}
      </div>
      <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
        <span>{new Date(q.date).toLocaleDateString()}</span>
        <span>{q.passengers} pax</span>
        {q.quotedPrice != null ? (
          <span className="font-medium text-foreground">{formatSar(q.quotedPrice)}</span>
        ) : null}
        <ReminderBadge quote={q} />
        {q.staffNotes ? (
          <StickyNote className="size-3.5" aria-label="Has staff notes" />
        ) : null}
        {q.leadId ? <span className="ms-auto font-mono">{q.leadId}</span> : null}
      </div>
    </div>
  )
}
