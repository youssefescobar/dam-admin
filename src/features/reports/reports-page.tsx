import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { ClipboardList, MessageSquare } from 'lucide-react'
import { api } from '@/lib/api'
import type { Report, ReportStatus } from '@/lib/types'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
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
import { StatusChip, REPORT_TYPE_LABEL } from '@/components/ui/status-chip'

const STATUSES: ReportStatus[] = ['new', 'in_progress', 'resolved']

function formatDate(value?: string) {
  if (!value) return '—'
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })
}

/** True when the SLA window has passed and the report is still open. */
function isOverdue(report: Report) {
  if (report.status === 'resolved' || !report.slaHours || !report.createdAt) return false
  const due = new Date(report.createdAt).getTime() + report.slaHours * 3600 * 1000
  return Date.now() > due
}

export function ReportsPage() {
  const queryClient = useQueryClient()
  const [type, setType] = useState('all')
  const [status, setStatus] = useState('all')
  const [detail, setDetail] = useState<Report | null>(null)

  const query = useQuery({
    queryKey: ['reports', type, status],
    queryFn: () => {
      const qs = new URLSearchParams()
      if (type !== 'all') qs.set('type', type)
      if (status !== 'all') qs.set('status', status)
      const q = qs.toString()
      return api<{ reports: Report[] }>(`/reports${q ? `?${q}` : ''}`)
    },
  })

  const patch = useMutation({
    mutationFn: (payload: { id: string; status: ReportStatus }) =>
      api<{ report: Report }>(`/reports/${payload.id}`, {
        method: 'PATCH',
        body: { status: payload.status },
      }),
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: ['reports'] })
      setDetail((current) => (current ? { ...current, ...data.report } : current))
      toast.success('Report updated')
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const reports = useMemo(() => query.data?.reports ?? [], [query.data])
  const open = reports.filter((r) => r.status !== 'resolved').length

  return (
    <div className="flex-1 space-y-5 overflow-auto p-4 sm:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight">
            <ClipboardList className="size-5" /> Reports
          </h1>
          <p className="text-sm text-muted-foreground">
            Complaints and lost items logged by Durri. {open} open.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Select value={type} onValueChange={setType}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              <SelectItem value="complaint">Complaints</SelectItem>
              <SelectItem value="lost_found">Lost items</SelectItem>
            </SelectContent>
          </Select>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {s === 'in_progress' ? 'In progress' : s[0].toUpperCase() + s.slice(1)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Reference</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead className="hidden md:table-cell">Trip</TableHead>
              <TableHead className="hidden lg:table-cell">Logged</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {query.isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                  Loading…
                </TableCell>
              </TableRow>
            ) : reports.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                  No reports yet.
                </TableCell>
              </TableRow>
            ) : (
              reports.map((r) => (
                <TableRow
                  key={r._id}
                  className="cursor-pointer"
                  onClick={() => setDetail(r)}
                >
                  <TableCell className="font-mono text-xs">{r.refNumber}</TableCell>
                  <TableCell>{REPORT_TYPE_LABEL[r.type] || r.type}</TableCell>
                  <TableCell>
                    <div className="font-medium">{r.name || '—'}</div>
                    <div className="text-xs text-muted-foreground" dir="ltr">
                      {r.phone}
                    </div>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    <div>{r.tripNumber || '—'}</div>
                    <div className="text-xs text-muted-foreground">{r.incidentDate}</div>
                  </TableCell>
                  <TableCell className="hidden text-sm lg:table-cell">
                    {formatDate(r.createdAt)}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col items-start gap-1 sm:flex-row sm:items-center sm:gap-2">
                      <StatusChip kind="report" status={r.status} />
                      {isOverdue(r) ? (
                        <span className="text-xs font-medium text-destructive">Overdue</span>
                      ) : null}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={Boolean(detail)} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent className="max-w-lg">
          {detail ? (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <span className="font-mono text-base">{detail.refNumber}</span>
                  <StatusChip kind="report" status={detail.status} />
                </DialogTitle>
                <DialogDescription>
                  {REPORT_TYPE_LABEL[detail.type] || detail.type} · logged {formatDate(detail.createdAt)}
                  {detail.slaHours ? ` · reply within ${detail.slaHours}h` : ''}
                </DialogDescription>
              </DialogHeader>

              <dl className="grid grid-cols-[7rem_1fr] gap-x-3 gap-y-2 text-sm">
                <dt className="text-muted-foreground">Customer</dt>
                <dd>{detail.name || '—'}</dd>
                <dt className="text-muted-foreground">Phone</dt>
                <dd dir="ltr" className="text-left">
                  {detail.phone || '—'}
                </dd>
                <dt className="text-muted-foreground">Trip / bus</dt>
                <dd>{detail.tripNumber || '—'}</dd>
                <dt className="text-muted-foreground">Date</dt>
                <dd>{[detail.incidentDate, detail.incidentTime].filter(Boolean).join(' · ') || '—'}</dd>
                {detail.type === 'lost_found' ? (
                  <>
                    <dt className="text-muted-foreground">Seat</dt>
                    <dd>{detail.seat || '—'}</dd>
                  </>
                ) : null}
                <dt className="text-muted-foreground">Details</dt>
                <dd className="whitespace-pre-wrap" dir="auto">
                  {detail.description || '—'}
                </dd>
              </dl>

              <DialogFooter className="flex-wrap gap-2 sm:justify-between">
                {detail.conversationId ? (
                  <Button variant="outline" asChild>
                    <Link to={`/inbox?c=${detail.conversationId}`}>
                      <MessageSquare className="mr-1.5 size-4" /> Open chat
                    </Link>
                  </Button>
                ) : (
                  <span />
                )}
                <div className="flex gap-2">
                  {STATUSES.filter((s) => s !== detail.status).map((s) => (
                    <Button
                      key={s}
                      variant={s === 'resolved' ? 'default' : 'secondary'}
                      disabled={patch.isPending}
                      onClick={() => patch.mutate({ id: detail._id, status: s })}
                    >
                      {s === 'in_progress' ? 'Mark in progress' : s === 'resolved' ? 'Mark resolved' : 'Reopen'}
                    </Button>
                  ))}
                </div>
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  )
}
