import { Component, type ReactNode } from 'react'
import { Button } from '@/components/ui/button'

/** A page whose code was replaced by a deploy while this tab stayed open (its file is gone). */
const isStaleChunk = (error: Error) =>
  /dynamically imported module|Importing a module script failed|Failed to fetch dynamically/i.test(error.message)

/** Catches a crash in a page so staff see a way out instead of a white screen. */
export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  componentDidCatch(error: Error) {
    console.error(error)
  }

  render() {
    const { error } = this.state
    if (!error) return this.props.children
    const stale = isStaleChunk(error)
    return (
      <div role="alert" className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
        <p className="text-base font-semibold">
          {stale ? 'A new version of DAMAC is ready' : 'Something went wrong on this page'}
        </p>
        <p className="max-w-sm text-sm text-muted-foreground">
          {stale ? 'Reload to open it.' : 'Reload to try again. Your other pages are fine.'}
        </p>
        <Button type="button" onClick={() => window.location.reload()}>
          Reload
        </Button>
      </div>
    )
  }
}
