import { useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { BookOpen, Pencil, Plus, Trash2, Upload, ArrowLeft } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import type { KbEntry } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
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
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Checkbox } from '@/components/ui/checkbox'
import { cn } from '@/lib/utils'
import { DetailPanelSkeleton, ListPanelSkeleton } from '@/components/loading/skeletons'


type EditorState = {
  open: boolean
  mode: 'create' | 'edit'
  id?: string
  title: string
  content: string
  intent: string
  category: string
  locale: 'en' | 'ar'
  escalate: boolean
  requiresLiveData: boolean
  sourceId: string
}

const emptyEditor = (): EditorState => ({
  open: false,
  mode: 'create',
  title: '',
  content: '',
  intent: '',
  category: '',
  locale: 'en',
  escalate: false,
  requiresLiveData: false,
  sourceId: '',
})

export function KbPage() {
  const queryClient = useQueryClient()
  const fileRef = useRef<HTMLInputElement>(null)
  const [search, setSearch] = useState('')
  const [localeFilter, setLocaleFilter] = useState<string>('all')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [editor, setEditor] = useState<EditorState>(emptyEditor)
  const [importOpen, setImportOpen] = useState(false)
  const [importMode, setImportMode] = useState<'upsert' | 'append'>('upsert')
  const [replaceAll, setReplaceAll] = useState(false)
  const [csvText, setCsvText] = useState('')
  // Stores the KB entry pending deletion; null = dialog closed.
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; title: string } | null>(null)

  const listQuery = useQuery({
    queryKey: ['kb', localeFilter, categoryFilter],
    queryFn: () => {
      const qs = new URLSearchParams()
      if (localeFilter !== 'all') qs.set('locale', localeFilter)
      if (categoryFilter !== 'all') qs.set('category', categoryFilter)
      const q = qs.toString()
      return api<{ entries: KbEntry[] }>(`/kb${q ? `?${q}` : ''}`)
    },
  })

  const entries = listQuery.data?.entries ?? []

  // Entries sharing a sourceId are EN/AR twins; flag the ones missing a counterpart.
  const allQuery = useQuery({ queryKey: ['kb', 'all'], queryFn: () => api<{ entries: KbEntry[] }>('/kb') })
  const missingTwin = (e: KbEntry) => {
    if (!e.sourceId || (e.locale !== 'en' && e.locale !== 'ar')) return null
    const other = e.locale === 'en' ? 'ar' : 'en'
    const all = allQuery.data?.entries
    if (!all || all.some((x) => x.sourceId === e.sourceId && x.locale === other)) return null
    return other === 'ar' ? 'Arabic' : 'English'
  }
  const categories = useMemo(() => {
    const set = new Set<string>()
    for (const e of entries) {
      if (e.category) set.add(e.category)
    }
    return [...set].sort()
  }, [entries])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return entries
    return entries.filter(
      (e) =>
        e.title.toLowerCase().includes(q) ||
        e.content.toLowerCase().includes(q) ||
        (e.intent || '').toLowerCase().includes(q) ||
        (e.sourceId || '').toLowerCase().includes(q)
    )
  }, [entries, search])

  const selected = entries.find((e) => e._id === selectedId) ?? null

  const saveMutation = useMutation({
    mutationFn: async () => {
      const body = {
        title: editor.title.trim(),
        content: editor.content.trim(),
        intent: editor.intent.trim(),
        category: editor.category.trim(),
        locale: editor.locale,
        escalate: editor.escalate,
        requiresLiveData: editor.requiresLiveData,
        sourceId: editor.sourceId.trim() || null,
      }
      if (!body.title || !body.content) throw new Error('Title and content are required')
      if (editor.mode === 'edit' && editor.id) {
        return api<{ entry: KbEntry }>(`/kb/${editor.id}`, { method: 'PUT', body })
      }
      return api<{ entry: KbEntry }>('/kb', { method: 'POST', body })
    },
    onSuccess: (data) => {
      toast.success(editor.mode === 'edit' ? 'Saved' : 'Added to knowledge')
      setEditor(emptyEditor())
      setSelectedId(data.entry._id)
      queryClient.invalidateQueries({ queryKey: ['kb'] })
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api(`/kb/${id}`, { method: 'DELETE' }),
    onSuccess: (_, id) => {
      toast.message('Removed from knowledge')
      if (selectedId === id) setSelectedId(null)
      queryClient.invalidateQueries({ queryKey: ['kb'] })
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const importMutation = useMutation({
    mutationFn: () =>
      api<{
        ok: boolean
        created: number
        updated: number
        skipped: number
        errors: { title: string; error: string }[]
      }>('/kb/import', {
        method: 'POST',
        body: {
          csv: csvText,
          mode: importMode,
          replaceAll,
        },
      }),
    onSuccess: (data) => {
      toast.success(
        `Import finished · ${data.created} new, ${data.updated} updated${
          data.skipped ? `, ${data.skipped} skipped` : ''
        }`
      )
      if (data.errors?.length) {
        toast.message(`${data.errors.length} row(s) couldn’t be imported`)
        console.warn(data.errors)
      }
      setImportOpen(false)
      setCsvText('')
      setReplaceAll(false)
      queryClient.invalidateQueries({ queryKey: ['kb'] })
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const onPickFile = async (file: File | null) => {
    if (!file) return
    const text = await file.text()
    setCsvText(text)
    setImportOpen(true)
  }

  return (
    <div className="flex h-full min-h-0 flex-1 overflow-hidden">
      <div
        className={cn(
          'flex w-full flex-col overflow-hidden border-r md:w-96 md:shrink-0',
          selectedId ? 'hidden md:flex' : 'flex'
        )}
      >
        <div className="space-y-3 border-b p-4">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h1 className="text-xl font-semibold">Knowledge</h1>
              <p className="text-xs text-muted-foreground">
                Answers the assistant uses when customers ask questions.
              </p>
            </div>
            <BookOpen className="size-5 text-muted-foreground" />
          </div>
          <Input
            placeholder="Search…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div className="grid grid-cols-2 gap-2">
            <Select value={localeFilter} onValueChange={setLocaleFilter}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Locale" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All locales</SelectItem>
                <SelectItem value="en">English</SelectItem>
                <SelectItem value="ar">Arabic</SelectItem>
              </SelectContent>
            </Select>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All categories</SelectItem>
                {categories.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              onClick={() => setEditor({ ...emptyEditor(), open: true, mode: 'create' })}
            >
              <Plus className="size-3.5" />
              New
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => fileRef.current?.click()}
            >
              <Upload className="size-3.5" />
              Import CSV
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => void onPickFile(e.target.files?.[0] ?? null)}
            />
          </div>
        </div>
        <ScrollArea className="flex-1">
          <div className="space-y-1 p-2">
            {listQuery.isLoading && <ListPanelSkeleton rows={7} />}
            {!listQuery.isLoading &&
              filtered.map((e) => (
                <button
                  key={e._id}
                  type="button"
                  onClick={() => setSelectedId(e._id)}
                  className={cn(
                    'animate-fade-in w-full rounded-lg border px-3 py-2 text-left text-sm transition-colors',
                    selectedId === e._id ? 'border-primary bg-accent' : 'hover:bg-muted/60'
                  )}
                >
                  <div className="font-medium line-clamp-2">{e.title}</div>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {e.sourceId ? (
                      <span className="rounded bg-muted px-1.5 py-0.5 text-[10px]">{e.sourceId}</span>
                    ) : null}
                    {e.locale ? (
                      <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase">
                        {e.locale}
                      </span>
                    ) : null}
                    {e.category ? (
                      <span className="rounded bg-muted px-1.5 py-0.5 text-[10px]">{e.category}</span>
                    ) : null}
                    {e.escalate ? (
                      <span className="rounded bg-destructive/15 px-1.5 py-0.5 text-[10px] text-destructive">
                        escalate
                      </span>
                    ) : null}
                    {missingTwin(e) ? (
                      <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] text-amber-800 dark:bg-amber-950 dark:text-amber-200">
                        no {missingTwin(e)} version
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                    {e.content}
                  </div>
                </button>
              ))}
            {!listQuery.isLoading && !filtered.length && (
              <div className="flex flex-col items-center gap-2 px-4 py-10 text-center text-muted-foreground">
                <BookOpen className="size-8 opacity-50" />
                <p className="text-sm font-medium text-foreground">
                  {search.trim() ? 'No matches' : 'No knowledge yet'}
                </p>
                <p className="text-xs">
                  {search.trim()
                    ? 'Try a different search, or clear the filter.'
                    : 'Add an entry or import a CSV so the assistant can answer customers.'}
                </p>
              </div>
            )}
          </div>
        </ScrollArea>
      </div>

      <div
        className={cn(
          'min-w-0 flex-1 flex-col',
          selectedId ? 'flex' : 'hidden md:flex'
        )}
      >
        {selected ? (
          <>
            <div className="flex items-start justify-between gap-3 border-b px-3 py-3 sm:px-4">
              <div className="flex min-w-0 items-start gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="mt-0.5 shrink-0 md:hidden"
                  aria-label="Back to list"
                  onClick={() => setSelectedId(null)}
                >
                  <ArrowLeft className="size-4" />
                </Button>
                <div className="min-w-0">
                  <h2 className="text-lg font-semibold">{selected.title}</h2>
                  <p className="text-xs text-muted-foreground">
                    {[selected.sourceId, selected.intent, selected.category, selected.locale]
                      .filter(Boolean)
                      .join(' · ') || '—'}
                    {selected.escalate ? ' · escalate' : ''}
                    {' · '}
                    Updated{' '}
                    {selected.updatedAt
                      ? new Date(selected.updatedAt).toLocaleString()
                      : '—'}
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setEditor({
                      open: true,
                      mode: 'edit',
                      id: selected._id,
                      title: selected.title,
                      content: selected.content,
                      intent: selected.intent || '',
                      category: selected.category || '',
                      locale: selected.locale === 'ar' ? 'ar' : 'en',
                      escalate: Boolean(selected.escalate),
                      requiresLiveData: Boolean(selected.requiresLiveData),
                      sourceId: selected.sourceId || '',
                    })
                  }
                >
                  <Pencil className="size-3.5" />
                  <span className="hidden sm:inline">Edit</span>
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setDeleteConfirm({ id: selected._id, title: selected.title })
                  }
                >
                  <Trash2 className="size-3.5" />
                  <span className="hidden sm:inline">Delete</span>
                </Button>
              </div>
            </div>
            {missingTwin(selected) ? (
              <p className="border-b bg-amber-50 px-4 py-2 text-xs text-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
                No {missingTwin(selected)} version of this entry (same source ID). Durri may answer less well
                in that language.
              </p>
            ) : null}
            <ScrollArea className="flex-1 p-4 sm:p-6">
              <pre className="animate-fade-in whitespace-pre-wrap font-sans text-sm leading-relaxed">
                {selected.content}
              </pre>
            </ScrollArea>
          </>
        ) : listQuery.isLoading ? (
          <DetailPanelSkeleton />
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 p-6 text-center text-muted-foreground">
            <BookOpen className="size-10 opacity-40" />
            <p className="text-sm font-medium text-foreground">Pick an entry</p>
            <p className="max-w-xs text-xs">
              Select something on the left, create a new one, or import a CSV with title and
              content columns.
            </p>
          </div>
        )}
      </div>

      <Dialog
        open={editor.open}
        onOpenChange={(open) => !open && setEditor(emptyEditor())}
      >
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>
              {editor.mode === 'edit' ? 'Edit entry' : 'New entry'}
            </DialogTitle>
            <DialogDescription>
              Title is the question or topic. Content is the answer customers should get.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="kb-title">Title / question</Label>
              <Input
                id="kb-title"
                value={editor.title}
                onChange={(e) => setEditor((s) => ({ ...s, title: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="kb-content">Answer / content</Label>
              <Textarea
                id="kb-content"
                className="min-h-40"
                value={editor.content}
                onChange={(e) => setEditor((s) => ({ ...s, content: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Source ID</Label>
                <Input
                  value={editor.sourceId}
                  onChange={(e) => setEditor((s) => ({ ...s, sourceId: e.target.value }))}
                  placeholder="Q001"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Locale</Label>
                <Select
                  value={editor.locale}
                  onValueChange={(v) =>
                    setEditor((s) => ({ ...s, locale: v as 'en' | 'ar' }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="en">English</SelectItem>
                    <SelectItem value="ar">Arabic</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Intent</Label>
                <Input
                  value={editor.intent}
                  onChange={(e) => setEditor((s) => ({ ...s, intent: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Category</Label>
                <Input
                  value={editor.category}
                  onChange={(e) => setEditor((s) => ({ ...s, category: e.target.value }))}
                />
              </div>
            </div>
            <div className="flex flex-wrap gap-4">
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={editor.escalate}
                  onCheckedChange={(v) =>
                    setEditor((s) => ({ ...s, escalate: Boolean(v) }))
                  }
                />
                Escalate
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={editor.requiresLiveData}
                  onCheckedChange={(v) =>
                    setEditor((s) => ({ ...s, requiresLiveData: Boolean(v) }))
                  }
                />
                Requires live data
              </label>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setEditor(emptyEditor())}>
              Cancel
            </Button>
            <Button
              type="button"
              disabled={saveMutation.isPending}
              onClick={() => saveMutation.mutate()}
            >
              {saveMutation.isPending ? 'Saving…' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Import CSV</DialogTitle>
            <DialogDescription>
              Columns: id, intent, category, locale, question/title, answer/content, escalate,
              requires_live_data. Upsert matches source id + locale when present.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Mode</Label>
              <Select
                value={importMode}
                onValueChange={(v) => setImportMode(v as 'upsert' | 'append')}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="upsert">Upsert by title</SelectItem>
                  <SelectItem value="append">Always create new</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <label className="flex cursor-pointer items-center gap-2.5 text-sm select-none">
              <Checkbox
                checked={replaceAll}
                onCheckedChange={(checked) => setReplaceAll(Boolean(checked))}
              />
              Delete all existing entries first (replace all)
            </label>
            <Textarea
              className="min-h-48 font-mono text-base"
              value={csvText}
              onChange={(e) => setCsvText(e.target.value)}
              placeholder={'title,content\n"Hours","We open 9-5"'}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setImportOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              disabled={importMutation.isPending || !csvText.trim()}
              onClick={() => importMutation.mutate()}
            >
              {importMutation.isPending ? 'Importing…' : 'Import'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={Boolean(deleteConfirm)}
        title="Delete KB entry?"
        description={deleteConfirm ? `"${deleteConfirm.title}" will be permanently removed.` : undefined}
        confirmLabel="Delete"
        onConfirm={() => {
          if (deleteConfirm) deleteMutation.mutate(deleteConfirm.id)
        }}
        onCancel={() => setDeleteConfirm(null)}
      />
    </div>
  )
}
