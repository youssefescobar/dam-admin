import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowDown, ArrowUp, Bus, Pencil, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import type { FleetBus } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { QueryError } from '@/components/ui/query-error'
import { MediaThumb } from '@/components/media/media-upload'
import { BusWizard } from './bus-wizard'
import { busName, emptyDraft, toDraft, type Draft } from './draft'

const Chip = ({ children }: { children: string }) => (
  <span className="rounded-full bg-muted px-2 py-0.5 font-medium">{children}</span>
)

export function FleetPage() {
  const queryClient = useQueryClient()
  const [editing, setEditing] = useState<Draft | null>(null)
  const [deleting, setDeleting] = useState<FleetBus | null>(null)

  const query = useQuery({
    queryKey: ['fleet'],
    queryFn: () => api<{ items: FleetBus[] }>('/fleet/all'),
  })
  const items = query.data?.items ?? []
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['fleet'] })

  const reorder = useMutation({
    mutationFn: (ids: string[]) => api('/fleet/order', { method: 'PUT', body: { ids } }),
    onSettled: refresh,
    onError: (err: Error) => toast.error(err.message),
  })

  const remove = useMutation({
    mutationFn: (bus: FleetBus) => api(`/fleet/${bus._id}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast.success('Deleted')
      setDeleting(null)
      void refresh()
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const move = (from: number, to: number) => {
    const ids = items.map((b) => b._id)
    ids.splice(to, 0, ...ids.splice(from, 1))
    reorder.mutate(ids)
  }

  return (
    <div className="flex flex-1 flex-col gap-4 overflow-auto p-4 sm:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Fleet</h1>
          <p className="text-sm text-muted-foreground">The buses shown on the website, in this order.</p>
        </div>
        <Button type="button" onClick={() => setEditing(emptyDraft())}>
          <Plus className="size-4" />
          New bus
        </Button>
      </div>

      <div className="divide-y rounded-xl border bg-card">
        {query.isLoading &&
          Array.from({ length: 3 }).map((_, i) => <div key={i} className="m-3 h-14 animate-pulse rounded-lg bg-muted" />)}
        {query.isError && <QueryError error={query.error} onRetry={() => void query.refetch()} />}
        {query.isSuccess && !items.length && (
          <div className="flex flex-col items-center gap-2 px-4 py-12 text-center text-muted-foreground">
            <Bus className="size-8 opacity-50" />
            <p className="text-sm font-medium text-foreground">No buses yet</p>
          </div>
        )}
        {items.map((bus, i) => {
          const cover = bus.coverImage || bus.exteriorImages?.[0]
          const seats = bus.en?.seatsLabel || bus.ar?.seatsLabel
          return (
            <div key={bus._id} className="animate-fade-in flex items-center gap-3 p-3 sm:p-4">
              {cover ? (
                <MediaThumb url={cover} className="aspect-[4/3] w-16 shrink-0 rounded-md border bg-muted" />
              ) : (
                <div className="flex aspect-[4/3] w-16 shrink-0 items-center justify-center rounded-md border border-dashed text-muted-foreground">
                  <Bus className="size-5 opacity-50" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">{busName(bus)}</div>
                {bus.ar?.name ? (
                  <div className="truncate text-sm text-muted-foreground" dir="rtl">
                    {bus.ar.name}
                  </div>
                ) : null}
                <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                  {seats ? <span>{seats}</span> : null}
                  {!bus.published ? <Chip>Hidden</Chip> : !bus.showInShowroom ? <Chip>Not in showroom</Chip> : null}
                </div>
              </div>
              <div className="flex flex-col sm:flex-row">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label="Move up"
                  disabled={i === 0 || reorder.isPending}
                  onClick={() => move(i, i - 1)}
                >
                  <ArrowUp className="size-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label="Move down"
                  disabled={i === items.length - 1 || reorder.isPending}
                  onClick={() => move(i, i + 1)}
                >
                  <ArrowDown className="size-4" />
                </Button>
              </div>
              <div className="flex flex-col sm:flex-row">
                <Button type="button" variant="ghost" size="icon" aria-label="Edit" onClick={() => setEditing(toDraft(bus))}>
                  <Pencil className="size-4" />
                </Button>
                <Button type="button" variant="ghost" size="icon" aria-label="Delete" onClick={() => setDeleting(bus)}>
                  <Trash2 className="size-4" />
                </Button>
              </div>
            </div>
          )
        })}
      </div>

      {editing ? (
        <BusWizard
          initial={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null)
            void refresh()
          }}
        />
      ) : null}

      <ConfirmDialog
        open={Boolean(deleting)}
        title={`Delete ${deleting ? busName(deleting) : 'this bus'}?`}
        description="It disappears from the website within a minute. This can't be undone."
        confirmLabel="Delete"
        onConfirm={() => deleting && remove.mutate(deleting)}
        onCancel={() => setDeleting(null)}
      />
    </div>
  )
}
