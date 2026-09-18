import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
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
import { PhoneInputField } from '@/components/ui/phone-input'
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
import { MoreHorizontal } from 'lucide-react'
import { QuotesTableSkeleton } from '@/components/loading/skeletons'
import { cn } from '@/lib/utils'

export function QuotesPage() {
  const queryClient = useQueryClient()
  const [status, setStatus] = useState<string>('all')
  const [contactFilter, setContactFilter] = useState('')
  const [phoneFilter, setPhoneFilter] = useState('')
  const [dateRange, setDateRange] = useState<DateRange | undefined>()
  const [detail, setDetail] = useState<Quote | null>(null)
  const [priceDraft, setPriceDraft] = useState('')

  const query = useQuery({
    queryKey: ['quotes', status],
    queryFn: async () => {
      const qs = status !== 'all' ? `?status=${status}` : ''
      return api<{ quotes: Quote[] }>(`/quotes${qs}`)
    },
  })

  const patchMutation = useMutation({
    mutationFn: async (payload: { id: string; body: Partial<Quote> }) =>
      api<{ quote: Quote }>(`/quotes/${payload.id}`, {
        method: 'PATCH',
        body: payload.body,
      }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['quotes'] })
      toast.success('Quote updated')
      setDetail(data.quote)
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const filtered = useMemo(() => {
    let rows = query.data?.quotes ?? []
    const contact = contactFilter.trim().toLowerCase()
    const phone = phoneFilter.replace(/\D/g, '')
    if (contact) {
      rows = rows.filter(
        (q) =>
          q.customerContact.toLowerCase().includes(contact) ||
          q.customerName.toLowerCase().includes(contact)
      )
    }
    if (phone) {
      rows = rows.filter((q) => q.customerContact.replace(/\D/g, '').includes(phone))
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
              setDetail(row.original)
              setPriceDraft(
                row.original.quotedPrice != null ? String(row.original.quotedPrice) : ''
              )
            }}
          >
            <div className="font-medium">{row.original.customerName}</div>
            <div className="text-xs text-muted-foreground">{row.original.customerContact}</div>
          </button>
        ),
      },
      {
        id: 'route',
        header: 'Route',
        cell: ({ row }) => (
          <span>
            {row.original.pickup} → {row.original.dropoff}
          </span>
        ),
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
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs capitalize">
            {row.original.status}
          </span>
        ),
      },
      {
        accessorKey: 'quotedPrice',
        header: 'Price',
        cell: ({ row }) =>
          row.original.quotedPrice != null ? `$${row.original.quotedPrice}` : '—',
      },
      {
        id: 'actions',
        header: '',
        cell: ({ row }) => (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon">
                <MoreHorizontal />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={() => {
                  setDetail(row.original)
                  setPriceDraft(
                    row.original.quotedPrice != null ? String(row.original.quotedPrice) : ''
                  )
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
            </DropdownMenuContent>
          </DropdownMenu>
        ),
      },
    ],
    [patchMutation]
  )

  const table = useReactTable({
    data: filtered,
    columns,
    getCoreRowModel: getCoreRowModel(),
  })

  return (
    <div className="flex flex-1 flex-col gap-4 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Quotes</h1>
        <p className="text-sm text-muted-foreground">Queue and lifecycle for transfer requests.</p>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <div className="text-xs text-muted-foreground">Status</div>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="new">New</SelectItem>
              <SelectItem value="quoted">Quoted</SelectItem>
              <SelectItem value="won">Won</SelectItem>
              <SelectItem value="lost">Lost</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <div className="text-xs text-muted-foreground">Name / email</div>
          <Input
            className="w-[200px]"
            placeholder="Filter contact"
            value={contactFilter}
            onChange={(e) => setContactFilter(e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <div className="text-xs text-muted-foreground">Phone</div>
          <PhoneInputField
            className="w-[220px]"
            value={phoneFilter}
            onChange={setPhoneFilter}
            placeholder="Filter by phone"
          />
        </div>
        <div className="space-y-1">
          <div className="text-xs text-muted-foreground">Trip date range</div>
          <DateRangePicker value={dateRange} onChange={setDateRange} />
        </div>
        <Button
          variant="outline"
          type="button"
          onClick={() => {
            setStatus('all')
            setContactFilter('')
            setPhoneFilter('')
            setDateRange(undefined)
          }}
        >
          Reset
        </Button>
      </div>

      <div
        className={cn(
          'rounded-xl border bg-card transition-opacity duration-200',
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
                <TableCell colSpan={columns.length} className="h-24 text-center text-muted-foreground">
                  No quotes match these filters.
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
                <div>
                  <div className="text-xs text-muted-foreground">Pickup</div>
                  <div>{detail.pickup}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Dropoff</div>
                  <div>{detail.dropoff}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Date</div>
                  <div>{new Date(detail.date).toLocaleString()}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Vehicle</div>
                  <div>{detail.vehicleType}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Passengers</div>
                  <div>{detail.passengers}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Status</div>
                  <div className="capitalize">{detail.status}</div>
                </div>
              </div>
              {detail.notes ? (
                <div>
                  <div className="text-xs text-muted-foreground">Notes</div>
                  <p className="whitespace-pre-wrap">{detail.notes}</p>
                </div>
              ) : null}
              <div className="space-y-1.5">
                <Label htmlFor="quote-price">Quoted price</Label>
                <div className="flex gap-2">
                  <Input
                    id="quote-price"
                    type="number"
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
                    Set quoted
                  </Button>
                </div>
              </div>
              {detail.conversationId ? (
                <Button asChild variant="outline" type="button">
                  <Link to="/inbox">Open inbox (related chat)</Link>
                </Button>
              ) : null}
            </div>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDetail(null)}>
              Close
            </Button>
            {detail && (
              <>
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
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
