import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
} from '@tanstack/react-table'
import type { DateRange } from 'react-day-picker'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import type { Quote } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { DateRangePicker } from '@/components/ui/date-range-picker'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { ChevronDown, MoreHorizontal, Inbox, LayoutGrid, List } from 'lucide-react'
import { QuotesTableSkeleton } from '@/components/loading/skeletons'
import { QueryError } from '@/components/ui/query-error'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { StatusChip } from '@/components/ui/status-chip'
import { CUSTOMER_TYPES, DEPARTMENTS, QUOTE_STATUS_LABEL } from '@/lib/labels'
import { cn, formatSar } from '@/lib/utils'
import { QuotesBoard, ReminderBadge } from './quotes-board'

type View = 'table' | 'board'
/** The server returns at most this many quotes, newest first. */
const QUOTES_LIMIT = 1000
const VIEW_KEY = 'dam-quotes-view'

const loadView = (): View => {
  try {
    return localStorage.getItem(VIEW_KEY) === 'board' ? 'board' : 'table'
  } catch {
    return 'table'
  }
}

/** Saudi numbers typed any way (0501…, 966501…, +966 50 1…) compare as the same digits. */
const localDigits = (phone: string) => phone.replace(/\D/g, '').replace(/^(00)?966|^0+/, '')

const legCountLabel = (q: Quote) =>
  q.legs && q.legs.length > 1 ? `${q.legs.length} legs` : ''

export function QuotesPage() {
  const queryClient = useQueryClient()
  const [status, setStatus] = useState<string>('all')
  const [showFilters, setShowFilters] = useState(false)
  const [customerTypeFilter, setCustomerTypeFilter] = useState<string>('all')
  const [departmentFilter, setDepartmentFilter] = useState<string>('all')
  const [contactFilter, setContactFilter] = useState('')
  const [phoneFilter, setPhoneFilter] = useState('')
  const [dateRange, setDateRange] = useState<DateRange | undefined>()
  const [detail, setDetail] = useState<Quote | null>(null)
  const [priceDraft, setPriceDraft] = useState('')
  const [notesDraft, setNotesDraft] = useState('')
  const [toDelete, setToDelete] = useState<Quote | null>(null)
  const [view, setViewState] = useState<View>(loadView)

  const setView = (next: View) => {
    setViewState(next)
    try {
      localStorage.setItem(VIEW_KEY, next)
    } catch {
      /* private mode */
    }
  }

  const openDetail = useCallback((q: Quote) => {
    setDetail(q)
    setPriceDraft(q.quotedPrice != null ? String(q.quotedPrice) : '')
    setNotesDraft(q.staffNotes ?? '')
  }, [])

  const query = useQuery({
    queryKey: ['quotes', status, customerTypeFilter, departmentFilter],
    queryFn: async () => {
      const qs = new URLSearchParams()
      if (status !== 'all') qs.set('status', status)
      if (customerTypeFilter !== 'all') qs.set('customerType', customerTypeFilter)
      if (departmentFilter !== 'all') qs.set('assignedDepartment', departmentFilter)
      const q = qs.toString()
      return api<{ quotes: Quote[] }>(`/quotes${q ? `?${q}` : ''}`)
    },
  })

  // Reminder notifications link to /quotes?q=<id>: open that quote once it has loaded.
  const [searchParams, setSearchParams] = useSearchParams()
  const linkedId = searchParams.get('q')
  useEffect(() => {
    if (!linkedId || !query.data) return
    const linked = query.data.quotes.find((q) => q._id === linkedId)
    if (linked) openDetail(linked)
    setSearchParams((p) => {
      p.delete('q')
      return p
    }, { replace: true })
  }, [linkedId, query.data, openDetail, setSearchParams])

  const patchMutation = useMutation({
    mutationFn: async (payload: { id: string; body: Partial<Quote> }) =>
      api<{ quote: Quote }>(`/quotes/${payload.id}`, {
        method: 'PATCH',
        body: payload.body,
      }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['quotes'] })
      toast.success('Quote saved')
      // Refresh the open dialog only; board moves must not pop it open.
      setDetail((d) => (d && d._id === data.quote._id ? data.quote : d))
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api<void>(`/quotes/${id}`, { method: 'DELETE' }),
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: ['quotes'] })
      toast.success('Quote deleted')
      setDetail((d) => (d && d._id === id ? null : d))
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const filtered = useMemo(() => {
    let rows = query.data?.quotes ?? []
    const contact = contactFilter.trim().toLowerCase()
    const phone = localDigits(phoneFilter)
    if (contact) {
      rows = rows.filter(
        (q) =>
          q.customerContact.toLowerCase().includes(contact) ||
          q.customerName.toLowerCase().includes(contact)
      )
    }
    if (phone) {
      rows = rows.filter((q) => localDigits(q.customerContact).includes(phone))
    }
    if (dateRange?.from) {
      const from = dateRange.from.getTime()
      const to = (dateRange.to ?? dateRange.from).getTime() + 24 * 60 * 60 * 1000 - 1
      rows = rows.filter((q) => {
        const t = new Date(q.date).getTime()
        return t >= from && t <= to
      })
    }
    return rows
  }, [query.data, contactFilter, phoneFilter, dateRange])

  const columns = useMemo<ColumnDef<Quote>[]>(
    () => [
      {
        accessorKey: 'customerName',
        header: 'Customer',
        cell: ({ row }) => (
          <button
            type="button"
            className="text-left hover:underline"
            onClick={() => {
              openDetail(row.original)
            }}
          >
            <div className="font-medium">{row.original.customerName}</div>
            <div className="text-xs text-muted-foreground">{row.original.customerContact}</div>
          </button>
        ),
      },
      {
        accessorKey: 'leadId',
        header: 'Lead',
        cell: ({ row }) => (
          <span className="font-mono text-xs">
            {row.original.leadId || '—'}
            {row.original.editedAt ? (
              <span
                className="ms-1.5 rounded bg-amber-100 px-1.5 py-0.5 font-sans text-[10px] font-medium text-amber-800"
                title={`Edited by customer ${new Date(row.original.editedAt).toLocaleString()}`}
              >
                Edited
              </span>
            ) : null}
          </span>
        ),
      },
      {
        id: 'route',
        header: 'Route',
        cell: ({ row }) => (
          <span>
            {row.original.pickup} → {row.original.dropoff}
            {legCountLabel(row.original) ? (
              <span className="ml-2 text-xs text-muted-foreground">
                {legCountLabel(row.original)}
              </span>
            ) : null}
          </span>
        ),
      },
      {
        accessorKey: 'customerType',
        header: 'Type',
        cell: ({ row }) => row.original.customerType || row.original.tripType || '—',
      },
      {
        accessorKey: 'assignedDepartment',
        header: 'Dept',
        cell: ({ row }) => row.original.assignedDepartment || '—',
      },
      {
        accessorKey: 'date',
        header: 'Date',
        cell: ({ row }) => new Date(row.original.date).toLocaleString(),
      },
      {
        accessorKey: 'vehicleType',
        header: 'Vehicle',
      },
      {
        accessorKey: 'status',
        header: 'Status',
        cell: ({ row }) => (
          <div className="flex flex-wrap items-center gap-1.5">
            <StatusChip kind="quote" status={row.original.status} />
            <ReminderBadge quote={row.original} />
          </div>
        ),
      },
      {
        accessorKey: 'quotedPrice',
        header: 'Price',
        cell: ({ row }) =>
          row.original.quotedPrice != null ? formatSar(row.original.quotedPrice) : '—',
      },
      {
        id: 'actions',
        header: '',
        cell: ({ row }) => (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Actions">
                <MoreHorizontal />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={() => {
                  openDetail(row.original)
                }}
              >
                View details
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() =>
                  patchMutation.mutate({ id: row.original._id, body: { status: 'won' } })
                }
              >
                Mark won
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() =>
                  patchMutation.mutate({ id: row.original._id, body: { status: 'lost' } })
                }
              >
                Mark lost
              </DropdownMenuItem>
              {row.original.conversationId ? (
                <DropdownMenuItem asChild>
                  <Link to={`/inbox?c=${row.original.conversationId}`}>Open related chat</Link>
                </DropdownMenuItem>
              ) : null}
              <DropdownMenuItem className="text-destructive" onClick={() => setToDelete(row.original)}>
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ),
      },
    ],
    [patchMutation, openDetail]
  )

  const table = useReactTable({
    data: filtered,
    columns,
    getCoreRowModel: getCoreRowModel(),
  })

  return (
    <div className="flex flex-1 flex-col gap-4 overflow-auto p-4 sm:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Quotes</h1>
          <p className="text-sm text-muted-foreground">
            New transfer requests — review, price, and close the loop.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {!query.isLoading && (
            <p className="text-xs text-muted-foreground">
              {filtered.length} shown
              {(query.data?.quotes.length ?? 0) >= QUOTES_LIMIT ? ` (latest ${QUOTES_LIMIT} only)` : ''}
              {status !== 'all' ? ` · ${QUOTE_STATUS_LABEL[status] || status}` : ''}
            </p>
          )}
          <div className="inline-flex rounded-lg border p-0.5" role="group" aria-label="View">
            {(
              [
                ['table', List, 'Table'],
                ['board', LayoutGrid, 'Board'],
              ] as const
            ).map(([value, Icon, label]) => (
              <button
                key={value}
                type="button"
                aria-pressed={view === value}
                onClick={() => setView(value)}
                className={cn(
                  'inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium text-muted-foreground transition-colors',
                  view === value && 'bg-muted text-foreground'
                )}
              >
                <Icon className="size-3.5" />
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <Button
        variant="outline"
        type="button"
        className="h-11 justify-between md:hidden"
        aria-expanded={showFilters}
        onClick={() => setShowFilters((v) => !v)}
      >
        Filters
        <ChevronDown className={cn('size-4 transition-transform', showFilters && 'rotate-180')} />
      </Button>

      <div
        className={cn(
          'grid-cols-2 items-end gap-3 md:grid md:grid-cols-3 xl:grid-cols-4',
          showFilters ? 'grid' : 'hidden'
        )}
      >
        <div className="min-w-0 space-y-1">
          <div className="text-xs text-muted-foreground">Status</div>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="new">{QUOTE_STATUS_LABEL.new}</SelectItem>
              <SelectItem value="quoted">{QUOTE_STATUS_LABEL.quoted}</SelectItem>
              <SelectItem value="won">{QUOTE_STATUS_LABEL.won}</SelectItem>
              <SelectItem value="lost">{QUOTE_STATUS_LABEL.lost}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="min-w-0 space-y-1">
          <div className="text-xs text-muted-foreground">Customer type</div>
          <Select value={customerTypeFilter} onValueChange={setCustomerTypeFilter}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              {CUSTOMER_TYPES.map((t) => (
                <SelectItem key={t.value} value={t.value}>
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="col-span-2 min-w-0 space-y-1 md:col-span-1">
          <div className="text-xs text-muted-foreground">Department</div>
          <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Dept" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              {DEPARTMENTS.map((d) => (
                <SelectItem key={d.value} value={d.value}>
                  {d.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="col-span-2 min-w-0 space-y-1 md:col-span-1">
          <div className="text-xs text-muted-foreground">Name / email</div>
          <Input
            className="w-full"
            placeholder="Filter contact"
            value={contactFilter}
            onChange={(e) => setContactFilter(e.target.value)}
            inputMode="email"
            autoCapitalize="off"
            autoCorrect="off"
          />
        </div>
        <div className="col-span-2 min-w-0 space-y-1 md:col-span-1">
          <div className="text-xs text-muted-foreground">Phone</div>
          <Input
            className="w-full"
            type="tel"
            inputMode="tel"
            value={phoneFilter}
            onChange={(e) => setPhoneFilter(e.target.value)}
            placeholder="05… or +966…"
          />
        </div>
        <div className="col-span-2 min-w-0 space-y-1 md:col-span-1">
          <div className="text-xs text-muted-foreground">Trip date range</div>
          <DateRangePicker value={dateRange} onChange={setDateRange} />
        </div>
        <Button
          variant="outline"
          type="button"
          className="col-span-2 h-11 w-full md:col-span-1 md:h-9"
          onClick={() => {
            setStatus('all')
            setCustomerTypeFilter('all')
            setDepartmentFilter('all')
            setContactFilter('')
            setPhoneFilter('')
            setDateRange(undefined)
          }}
        >
          Reset
        </Button>
      </div>

      {query.isError ? (
        <QueryError className="rounded-xl border" error={query.error} onRetry={() => void query.refetch()} />
      ) : null}

      {view === 'board' && !query.isError ? (
        <QuotesBoard
          quotes={filtered}
          loading={query.isLoading}
          onOpen={openDetail}
          onMove={(q, next) => patchMutation.mutate({ id: q._id, body: { status: next } })}
        />
      ) : null}

      {/* Mobile: tappable cards */}
      <div
        className={cn(
          'space-y-2 md:hidden',
          (view === 'board' || query.isError) && 'hidden',
          query.isFetching && !query.isLoading && 'opacity-60'
        )}
      >
        {query.isLoading && (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-24 animate-pulse rounded-xl border" />
            ))}
          </div>
        )}
        {!query.isLoading &&
          filtered.map((q) => (
            <button
              key={q._id}
              type="button"
              className="animate-fade-in w-full rounded-xl border bg-card p-3.5 text-left active:bg-muted/50"
              onClick={() => {
                openDetail(q)
              }}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="truncate font-medium">{q.customerName}</div>
                  <div className="truncate text-xs text-muted-foreground">
                    {q.customerContact}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <ReminderBadge quote={q} />
                  <StatusChip kind="quote" status={q.status} />
                </div>
              </div>
              <div className="mt-2 text-sm">
                {q.pickup} → {q.dropoff}
                {legCountLabel(q) ? (
                  <span className="ml-2 text-xs text-muted-foreground">{legCountLabel(q)}</span>
                ) : null}
              </div>
              <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                <span>{new Date(q.date).toLocaleString()}</span>
                <span>{q.vehicleType}</span>
                <span>
                  {q.quotedPrice != null ? formatSar(q.quotedPrice) : 'No price yet'}
                </span>
              </div>
            </button>
          ))}
        {!query.isLoading && !filtered.length && (
          <div className="flex flex-col items-center gap-2 rounded-xl border px-4 py-10 text-center text-muted-foreground">
            <Inbox className="size-8 opacity-50" />
            <p className="text-sm font-medium text-foreground">No quotes here yet</p>
            <p className="text-xs">
              When customers request a transfer, they’ll show up in this list.
            </p>
          </div>
        )}
      </div>

      {/* Desktop: table */}
      <div
        className={cn(
          'hidden overflow-x-auto rounded-xl border bg-card transition-opacity duration-200',
          view === 'table' && !query.isError && 'md:block',
          query.isFetching && !query.isLoading && 'opacity-60'
        )}
      >
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((hg) => (
              <TableRow key={hg.id}>
                {hg.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {query.isLoading ? (
              <QuotesTableSkeleton columns={columns.length} />
            ) : table.getRowModel().rows.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id} className="animate-fade-in">
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-36 text-center">
                  <div className="mx-auto flex max-w-sm flex-col items-center gap-2 py-4 text-muted-foreground">
                    <Inbox className="size-8 opacity-50" />
                    <p className="text-sm font-medium text-foreground">No quotes here yet</p>
                    <p className="text-xs">
                      When customers request a transfer, they’ll show up in this list.
                    </p>
                  </div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={Boolean(detail)} onOpenChange={(open) => !open && setDetail(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{detail?.customerName}</DialogTitle>
            <DialogDescription>{detail?.customerContact}</DialogDescription>
          </DialogHeader>
          {detail && (
            <div className="grid gap-3 text-sm">
              <div className="grid grid-cols-2 gap-2">
                {detail.leadId ? (
                  <div className="col-span-2">
                    <div className="text-xs text-muted-foreground">Lead ID</div>
                    <div className="font-mono">{detail.leadId}</div>
                  </div>
                ) : null}
                <div>
                  <div className="text-xs text-muted-foreground">Pickup</div>
                  <div>{detail.pickup}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Dropoff</div>
                  <div>{detail.dropoff}</div>
                </div>
                {detail.legs && detail.legs.length > 1 ? (
                  <div className="col-span-2">
                    <div className="text-xs text-muted-foreground">Itinerary</div>
                    <ol className="mt-1 grid gap-1">
                      {detail.legs.map((leg, i) => (
                        <li key={i} className="flex flex-wrap gap-x-2">
                          <span className="text-muted-foreground tabular-nums">{i + 1}.</span>
                          <span>
                            {leg.from} → {leg.to}
                          </span>
                          {leg.date || leg.time ? (
                            <span className="text-muted-foreground">
                              {[leg.date, leg.time].filter(Boolean).join(' · ')}
                            </span>
                          ) : null}
                        </li>
                      ))}
                    </ol>
                  </div>
                ) : detail.stops ? (
                  <div className="col-span-2">
                    <div className="text-xs text-muted-foreground">Stops</div>
                    <div>{detail.stops}</div>
                  </div>
                ) : null}
                <div>
                  <div className="text-xs text-muted-foreground">Date</div>
                  <div>
                    {new Date(detail.date).toLocaleString()}
                    {detail.departureTime ? ` · ${detail.departureTime}` : ''}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Vehicle / class</div>
                  <div>
                    {detail.busCount ? `${detail.busCount}× ` : ''}
                    {detail.busClass || detail.vehicleType}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Passengers</div>
                  <div>{detail.passengers}</div>
                </div>
                {detail.waitingHours != null ? (
                  <div>
                    <div className="text-xs text-muted-foreground">Waiting hours</div>
                    <div>{detail.waitingHours}</div>
                  </div>
                ) : null}
                <div>
                  <div className="text-xs text-muted-foreground">Status</div>
                  <StatusChip kind="quote" status={detail.status} />
                </div>
                {detail.organization ? (
                  <div>
                    <div className="text-xs text-muted-foreground">Organization</div>
                    <div>{detail.organization}</div>
                  </div>
                ) : null}
                {detail.customerType || detail.tripType ? (
                  <div>
                    <div className="text-xs text-muted-foreground">Customer type</div>
                    <div>{detail.customerType || detail.tripType}</div>
                  </div>
                ) : null}
                {detail.serviceType ? (
                  <div>
                    <div className="text-xs text-muted-foreground">Service</div>
                    <div>{detail.serviceType}</div>
                  </div>
                ) : null}
                {detail.email ? (
                  <div>
                    <div className="text-xs text-muted-foreground">Email</div>
                    <div>{detail.email}</div>
                  </div>
                ) : null}
                {detail.accessibilityNeeds ? (
                  <div className="col-span-2">
                    <div className="text-xs text-muted-foreground">Accessibility</div>
                    <div>{detail.accessibilityNeeds}</div>
                  </div>
                ) : null}
                {detail.luggageNotes ? (
                  <div className="col-span-2">
                    <div className="text-xs text-muted-foreground">Luggage</div>
                    <div>{detail.luggageNotes}</div>
                  </div>
                ) : null}
                {(detail.needsSupervisors ||
                  detail.needsTracking ||
                  detail.needsBranding ||
                  detail.needsAirportReception) && (
                  <div className="col-span-2">
                    <div className="text-xs text-muted-foreground">Requirements</div>
                    <div>
                      {[
                        detail.needsSupervisors ? 'Supervisors' : '',
                        detail.needsTracking ? 'Tracking' : '',
                        detail.needsBranding ? 'Branding' : '',
                        detail.needsAirportReception ? 'Airport reception' : '',
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </div>
                  </div>
                )}
                {detail.specialRequirements ? (
                  <div className="col-span-2">
                    <div className="text-xs text-muted-foreground">Special requirements</div>
                    <div>{detail.specialRequirements}</div>
                  </div>
                ) : null}
                <div>
                  <div className="text-xs text-muted-foreground">Consent</div>
                  <div>{detail.consent ? 'Yes' : 'No'}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Department</div>
                  <Select
                    value={detail.assignedDepartment || ''}
                    onValueChange={(v) =>
                      patchMutation.mutate({
                        id: detail._id,
                        body: { assignedDepartment: v as Quote['assignedDepartment'] },
                      })
                    }
                  >
                    <SelectTrigger className="h-8">
                      <SelectValue placeholder="Assign" />
                    </SelectTrigger>
                    <SelectContent>
                      {DEPARTMENTS.map((d) => (
                        <SelectItem key={d.value} value={d.value}>
                          {d.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {detail.notes ? (
                <div>
                  <div className="text-xs text-muted-foreground">Customer notes</div>
                  <p className="whitespace-pre-wrap">{detail.notes}</p>
                </div>
              ) : null}
              <div className="space-y-1.5">
                <Label htmlFor="quote-staff-notes">Staff notes (internal)</Label>
                <Textarea
                  id="quote-staff-notes"
                  rows={3}
                  maxLength={4000}
                  placeholder="Calls, follow-ups, what the customer said… never shown to them."
                  value={notesDraft}
                  onChange={(e) => setNotesDraft(e.target.value)}
                />
                {notesDraft !== (detail.staffNotes ?? '') ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    disabled={patchMutation.isPending}
                    onClick={() =>
                      patchMutation.mutate({ id: detail._id, body: { staffNotes: notesDraft } })
                    }
                  >
                    Save notes
                  </Button>
                ) : null}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="quote-price">Quoted price (SAR)</Label>
                <div className="flex gap-2">
                  <Input
                    id="quote-price"
                    type="text"
                    inputMode="decimal"
                    min={0}
                    step="0.01"
                    value={priceDraft}
                    onChange={(e) => setPriceDraft(e.target.value)}
                  />
                  <Button
                    type="button"
                    disabled={patchMutation.isPending || !Number(priceDraft)}
                    onClick={() =>
                      patchMutation.mutate({
                        id: detail._id,
                        body: { status: 'quoted', quotedPrice: Number(priceDraft) },
                      })
                    }
                  >
                    Set price
                  </Button>
                </div>
              </div>
              {detail.conversationId ? (
                <Button asChild variant="outline" type="button">
                  <Link to={`/inbox?c=${detail.conversationId}`}>Open related chat</Link>
                </Button>
              ) : null}
            </div>
          )}
          <DialogFooter className="flex-col gap-2 sm:flex-row sm:items-center">
            {detail && (
              <div className="grid grid-cols-2 gap-2 sm:contents">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => patchMutation.mutate({ id: detail._id, body: { status: 'won' } })}
                >
                  Mark won
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => patchMutation.mutate({ id: detail._id, body: { status: 'lost' } })}
                >
                  Mark lost
                </Button>
              </div>
            )}
            {detail && (
              <Button
                type="button"
                variant="ghost"
                className="text-destructive hover:text-destructive"
                disabled={deleteMutation.isPending}
                onClick={() => setToDelete(detail)}
              >
                Delete
              </Button>
            )}
            <Button
              type="button"
              variant="outline"
              className="sm:ml-auto"
              onClick={() => setDetail(null)}
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={Boolean(toDelete)}
        title={`Delete ${toDelete?.leadId || 'this quote'}?`}
        description={`${toDelete?.customerName ?? ''}'s request will be removed for good. This can't be undone.`}
        confirmLabel="Delete quote"
        onConfirm={() => toDelete && deleteMutation.mutate(toDelete._id)}
        onCancel={() => setToDelete(null)}
      />
    </div>
  )
}
