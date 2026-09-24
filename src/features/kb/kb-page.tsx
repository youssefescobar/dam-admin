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
import { cn } from '@/lib/utils'
import { DetailPanelSkeleton, ListPanelSkeleton } from '@/components/loading/skeletons'

type EditorState = {
  open: boolean
  mode: 'create' | 'edit'
  id?: string
  title: string
  content: string
}

const emptyEditor = (): EditorState => ({
  open: false,
  mode: 'create',
  title: '',
  content: '',
})

export function KbPage() {
  const queryClient = useQueryClient()
  const fileRef = useRef<HTMLInputElement>(null)
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [editor, setEditor] = useState<EditorState>(emptyEditor)
  const [importOpen, setImportOpen] = useState(false)
  const [importMode, setImportMode] = useState<'upsert' | 'append'>('upsert')
  const [replaceAll, setReplaceAll] = useState(false)
  const [csvText, setCsvText] = useState('')

  const listQuery = useQuery({
    queryKey: ['kb'],
    queryFn: () => api<{ entries: KbEntry[] }>('/kb'),
  })

  const entries = listQuery.data?.entries ?? []
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return entries
    return entries.filter(
      (e) =>
        e.title.toLowerCase().includes(q) || e.content.toLowerCase().includes(q)
    )
  }, [entries, search])

  const selected = entries.find((e) => e._id === selectedId) ?? null

  const saveMutation = useMutation({
    mutationFn: async () => {
      const body = { title: editor.title.trim(), content: editor.content.trim() }
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
          'flex w-full flex-col border-r md:w-96 md:shrink-0',
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
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              onClick={() =>
                setEditor({ open: true, mode: 'create', title: '', content: '' })
              }
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
                  onClick={() => {
                    if (window.confirm('Delete this KB entry?')) {
                      deleteMutation.mutate(selected._id)
                    }
                  }}
                >
                  <Trash2 className="size-3.5" />
                  <span className="hidden sm:inline">Delete</span>
                </Button>
              </div>
            </div>
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
              Use columns title and content (or question and answer). Matching titles are
              updated; new titles are added.
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
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={replaceAll}
                onChange={(e) => setReplaceAll(e.target.checked)}
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
    </div>
  )
}
