import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { BarChart3 } from 'lucide-react'
import { api } from '@/lib/api'
import type { ChatAnalytics, UnansweredQuestion } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

const isoDay = (d: Date) => d.toISOString().slice(0, 10)
const pct = (n: number) => `${Math.round(n * 1000) / 10}%`

function Breakdown({ title, data }: { title: string; data: Record<string, number> }) {
  const rows = Object.entries(data).sort((a, b) => b[1] - a[1])
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-1 text-sm">
        {rows.length === 0 ? <p className="text-muted-foreground">No data</p> : null}
        {rows.map(([k, n]) => (
          <div key={k} className="flex justify-between">
            <span>{k}</span>
            <span className="font-medium">{n}</span>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

export function InsightsPage() {
  const queryClient = useQueryClient()
  const [from, setFrom] = useState(() => isoDay(new Date(Date.now() - 30 * 864e5)))
  const [to, setTo] = useState(() => isoDay(new Date()))

  const stats = useQuery({
    queryKey: ['insights', 'analytics', from, to],
    // `to` is a day: include all of it.
    queryFn: () => api<ChatAnalytics>(`/insights/analytics?from=${from}&to=${to}T23:59:59.999Z`),
  })
  const unanswered = useQuery({
    queryKey: ['insights', 'unanswered'],
    queryFn: () => api<{ items: UnansweredQuestion[] }>('/insights/unanswered?status=open'),
  })

  const mark = useMutation({
    mutationFn: (p: { id: string; status: 'resolved' | 'dismissed' }) =>
      api(`/insights/unanswered/${p.id}`, { method: 'PATCH', body: { status: p.status } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['insights', 'unanswered'] }),
    onError: (err: Error) => toast.error(err.message),
  })

  const s = stats.data
  const items = unanswered.data?.items ?? []

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight">
            <BarChart3 className="size-5" /> Durri insights
          </h1>
          <p className="text-sm text-muted-foreground">How often Durri hands over or cannot answer.</p>
        </div>
        <div className="flex items-center gap-2">
          <Input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} className="w-40" />
          <span className="text-muted-foreground">–</span>
          <Input type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} className="w-40" />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Card>
          <CardHeader><CardTitle className="text-sm">Chats</CardTitle></CardHeader>
          <CardContent className="text-2xl font-semibold">{s?.conversations ?? '—'}</CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-sm">Handover rate</CardTitle></CardHeader>
          <CardContent className="text-2xl font-semibold">{s ? pct(s.handoverRate) : '—'}</CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-sm">Miss rate</CardTitle></CardHeader>
          <CardContent className="text-2xl font-semibold">{s ? pct(s.missRate) : '—'}</CardContent>
        </Card>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Breakdown title="Handovers by reason" data={s?.handovers ?? {}} />
        <Breakdown title="Menu topics used" data={s?.topics ?? {}} />
      </div>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Unanswered questions ({items.length} open)
        </h2>
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Question</TableHead>
                <TableHead>Lang</TableHead>
                <TableHead>Asked</TableHead>
                <TableHead className="hidden md:table-cell">Last</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                    {unanswered.isLoading ? 'Loading…' : 'Nothing unanswered.'}
                  </TableCell>
                </TableRow>
              ) : (
                items.map((q) => (
                  <TableRow key={q._id}>
                    <TableCell dir="auto" className="max-w-md whitespace-pre-wrap">
                      {q.question}
                      <div className="text-xs text-muted-foreground">{q.reason}</div>
                    </TableCell>
                    <TableCell className="uppercase">{q.language}</TableCell>
                    <TableCell>{q.count}×</TableCell>
                    <TableCell className="hidden text-sm md:table-cell">
                      {new Date(q.lastAskedAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
                    </TableCell>
                    <TableCell className="space-x-1 whitespace-nowrap text-right">
                      {q.conversationId ? (
                        <Button size="sm" variant="ghost" asChild>
                          <Link to={`/inbox?c=${q.conversationId}`}>Chat</Link>
                        </Button>
                      ) : null}
                      <Button size="sm" disabled={mark.isPending} onClick={() => mark.mutate({ id: q._id, status: 'resolved' })}>
                        Resolved
                      </Button>
                      <Button size="sm" variant="secondary" disabled={mark.isPending} onClick={() => mark.mutate({ id: q._id, status: 'dismissed' })}>
                        Dismiss
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
        <p className="text-xs text-muted-foreground">
          Mark “Resolved” after adding the answer in Knowledge; “Dismiss” for off-topic questions.
        </p>
      </section>
    </div>
  )
}
