import { Skeleton } from '@/components/ui/skeleton'
import { TableCell, TableRow } from '@/components/ui/table'
import { cn } from '@/lib/utils'

/** Soft fade when real content replaces a skeleton. */
export function FadeIn({
  className,
  children,
}: {
  className?: string
  children: React.ReactNode
}) {
  return <div className={cn('animate-fade-in', className)}>{children}</div>
}

export function QuotesTableSkeleton({
  columns,
  rows = 8,
}: {
  columns: number
  rows?: number
}) {
  return (
    <>
      {Array.from({ length: rows }).map((_, i) => (
        <TableRow key={i} className="hover:bg-transparent">
          {Array.from({ length: columns }).map((_, j) => (
            <TableCell key={j}>
              <Skeleton
                className={cn('h-4', j === 0 ? 'w-24' : j === columns - 1 ? 'w-8' : 'w-full max-w-[9rem]')}
              />
            </TableCell>
          ))}
        </TableRow>
      ))}
    </>
  )
}

export function ListPanelSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="space-y-2 p-2" aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="rounded-lg border px-3 py-2.5">
          <Skeleton className="mb-2 h-4 w-[60%]" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="mt-1.5 h-3 w-[80%]" />
        </div>
      ))}
    </div>
  )
}

export function ThreadSkeleton() {
  return (
    <div className="flex flex-col gap-3 p-4" aria-busy="true" aria-label="Loading thread">
      <div className="flex justify-start">
        <Skeleton className="h-16 w-[70%] max-w-sm rounded-2xl rounded-bl-md" />
      </div>
      <div className="flex justify-end">
        <Skeleton className="h-10 w-[55%] max-w-xs rounded-2xl rounded-br-md" />
      </div>
      <div className="flex justify-start">
        <Skeleton className="h-20 w-[75%] max-w-md rounded-2xl rounded-bl-md" />
      </div>
      <div className="flex justify-end">
        <Skeleton className="h-12 w-[40%] max-w-[12rem] rounded-2xl rounded-br-md" />
      </div>
    </div>
  )
}

export function DetailPanelSkeleton() {
  return (
    <div className="space-y-4 p-4" aria-busy="true">
      <Skeleton className="h-7 w-[40%]" />
      <Skeleton className="h-3 w-[25%]" />
      <Skeleton className="h-32 w-full" />
      <Skeleton className="h-24 w-full" />
    </div>
  )
}
