import { AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

/**
 * Shown when a list or page failed to load. Without it a failed request looks like
 * "nothing here", and staff assume there is no work.
 */
export function QueryError({
  error,
  onRetry,
  className,
}: {
  error: unknown
  onRetry: () => void
  className?: string
}) {
  return (
    <div
      role="alert"
      className={cn('flex flex-col items-center gap-2 px-4 py-10 text-center text-muted-foreground', className)}
    >
      <AlertTriangle className="size-8 text-destructive opacity-80" />
      <p className="text-sm font-medium text-foreground">Couldn’t load this</p>
      <p className="max-w-xs text-xs">{error instanceof Error ? error.message : 'Something went wrong.'}</p>
      <Button type="button" size="sm" variant="outline" onClick={onRetry}>
        Try again
      </Button>
    </div>
  )
}
