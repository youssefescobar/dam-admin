import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Eye, EyeOff, Globe, ImageIcon, Loader2, Pencil, Plus, Trash2, Upload, X } from 'lucide-react'
import { toast } from 'sonner'
import { api, ApiError, uploadFile } from '@/lib/api'
import type { ContentKind, ContentText, SiteContentItem } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

const isVideo = (url: string) => /\.(mp4|webm)(\?|#|$)/i.test(url)

type FieldDef = { key: keyof ContentText; label: string; multiline?: boolean; rows?: number }

const KINDS: {
  kind: ContentKind
  label: string
  singular: string
  hint: string
  fields: FieldDef[]
  image?: string
}[] = [
  {
    kind: 'news',
    label: 'News',
    singular: 'news post',
    hint: 'Shown on the News page and the home page teaser.',
    fields: [
      { key: 'title', label: 'Title' },
      { key: 'excerpt', label: 'Short summary', multiline: true, rows: 2 },
      { key: 'body', label: 'Article', multiline: true, rows: 8 },
    ],
    image: 'Cover image or video',
  },
  {
    kind: 'testimonial',
    label: 'Testimonials',
    singular: 'testimonial',
    hint: 'Only publish quotes the client has approved to be shown with their name.',
    fields: [
      { key: 'quote', label: 'Quote', multiline: true, rows: 4 },
      { key: 'name', label: 'Name' },
      { key: 'role', label: 'Role / organisation' },
    ],
    image: 'Photo or video (optional)',
  },
]

type Draft = {
  id?: string
  published: boolean
  slug: string
  image: string
  sortOrder: number
  en: ContentText
  ar: ContentText
}

const emptyDraft = (): Draft => ({
  published: false,
  slug: '',
  image: '',
  sortOrder: 0,
  en: {},
  ar: {},
})

const toDraft = (item: SiteContentItem): Draft => ({
  id: item._id,
  published: item.published,
  slug: item.slug || '',
  image: item.image || '',
  sortOrder: item.sortOrder || 0,
  en: { ...item.en },
  ar: { ...item.ar },
})

const slugify = (text: string) =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)

/** Headline for a list row: first filled field in English, then Arabic. */
const headline = (kind: ContentKind, item: SiteContentItem) => {
  const key = kind === 'testimonial' ? 'quote' : 'title'
  return item.en?.[key] || item.ar?.[key] || 'Untitled'
}

/** Upload an image or video from the computer, or paste a link. Shows a preview once set. */
function MediaField({ label, value, onChange }: { label: string; value: string; onChange: (url: string) => void }) {
  const [uploading, setUploading] = useState(false)

  const pick = async (file: File | undefined) => {
    if (!file) return
    setUploading(true)
    try {
      onChange(await uploadFile(file))
      toast.success('Uploaded')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="space-y-1.5 sm:col-span-2">
      <Label htmlFor="content-image">{label}</Label>
      <div className="flex items-start gap-3">
        {value && isVideo(value) ? (
          <video src={value} muted playsInline preload="metadata" className="size-20 shrink-0 rounded-lg border bg-muted object-cover" />
        ) : value ? (
          <img src={value} alt="" className="size-20 shrink-0 rounded-lg border bg-muted object-cover" />
        ) : (
          <div className="flex size-20 shrink-0 items-center justify-center rounded-lg border border-dashed text-muted-foreground">
            <ImageIcon className="size-6 opacity-50" />
          </div>
        )}
        <div className="grid min-w-0 flex-1 gap-2">
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" disabled={uploading} asChild>
              <label className="cursor-pointer">
                {uploading ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
                {uploading ? 'Uploading…' : value ? 'Replace' : 'Upload image or video'}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif,image/avif,video/mp4,video/webm"
                  className="sr-only"
                  disabled={uploading}
                  onChange={(e) => {
                    void pick(e.target.files?.[0])
                    e.target.value = ''
                  }}
                />
              </label>
            </Button>
            {value ? (
              <Button type="button" variant="ghost" size="sm" disabled={uploading} onClick={() => onChange('')}>
                <X className="size-4" />
                Remove
              </Button>
            ) : null}
          </div>
          <Input
            id="content-image"
            value={value}
            placeholder="…or paste a link (https://…)"
            onChange={(e) => onChange(e.target.value)}
          />
        </div>
      </div>
    </div>
  )
}

export function ContentPage() {
  const queryClient = useQueryClient()
  const [kind, setKind] = useState<ContentKind>('news')
  const [draft, setDraft] = useState<Draft | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [deleting, setDeleting] = useState<SiteContentItem | null>(null)
  const meta = KINDS.find((k) => k.kind === kind)!

  const query = useQuery({
    queryKey: ['content', kind],
    queryFn: () => api<{ items: SiteContentItem[] }>(`/content/${kind}/all`),
  })

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['content', kind] })

  const save = useMutation({
    mutationFn: (d: Draft) => {
      const body = {
        published: d.published,
        slug: kind === 'news' ? d.slug : '',
        image: d.image,
        sortOrder: d.sortOrder,
        en: d.en,
        ar: d.ar,
      }
      return d.id
        ? api<{ item: SiteContentItem }>(`/content/${kind}/${d.id}`, { method: 'PUT', body })
        : api<{ item: SiteContentItem }>(`/content/${kind}`, { method: 'POST', body })
    },
    onSuccess: (_data, d) => {
      toast.success(d.published ? 'Saved and live on the website' : 'Saved as draft')
      setDraft(null)
      setErrors({})
      invalidate()
    },
    onError: (err: Error) => {
      setErrors(err instanceof ApiError ? err.fields || {} : {})
      toast.error(err.message)
    },
  })

  const togglePublish = useMutation({
    mutationFn: (item: SiteContentItem) =>
      api(`/content/${kind}/${item._id}`, {
        method: 'PUT',
        body: { ...toDraft(item), published: !item.published },
      }),
    onSuccess: invalidate,
    onError: (err: Error) => toast.error(err.message),
  })

  const remove = useMutation({
    mutationFn: (item: SiteContentItem) => api(`/content/${kind}/${item._id}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast.success('Deleted')
      setDeleting(null)
      invalidate()
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const setText = (lang: 'en' | 'ar', key: keyof ContentText, value: string) =>
    setDraft((d) => {
      if (!d) return d
      const next = { ...d, [lang]: { ...d[lang], [key]: value } }
      // Suggest a slug from the English title until staff type their own.
      if (kind === 'news' && lang === 'en' && key === 'title' && !d.id && d.slug === slugify(d.en.title || '')) {
        next.slug = slugify(value)
      }
      return next
    })

  const items = query.data?.items ?? []

  return (
    <div className="flex flex-1 flex-col gap-4 overflow-auto p-4 sm:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Website content</h1>
          <p className="text-sm text-muted-foreground">{meta.hint}</p>
        </div>
        <Button
          type="button"
          onClick={() => {
            setErrors({})
            setDraft(emptyDraft())
          }}
        >
          <Plus className="size-4" />
          New {meta.singular}
        </Button>
      </div>

      <div className="inline-flex w-full rounded-lg border p-0.5 sm:w-auto" role="tablist">
        {KINDS.map((k) => (
          <button
            key={k.kind}
            type="button"
            role="tab"
            aria-selected={kind === k.kind}
            onClick={() => setKind(k.kind)}
            className={cn(
              'h-9 flex-1 rounded-md px-3 text-sm font-medium text-muted-foreground transition-colors sm:flex-none',
              kind === k.kind && 'bg-muted text-foreground'
            )}
          >
            {k.label}
          </button>
        ))}
      </div>

      <div className="divide-y rounded-xl border bg-card">
        {query.isLoading &&
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="m-3 h-12 animate-pulse rounded-lg" />
          ))}
        {!query.isLoading && !items.length && (
          <div className="flex flex-col items-center gap-2 px-4 py-12 text-center text-muted-foreground">
            <Globe className="size-8 opacity-50" />
            <p className="text-sm font-medium text-foreground">Nothing yet</p>
            <p className="text-xs">Add a {meta.singular}; it stays a draft until you publish it.</p>
          </div>
        )}
        {items.map((item) => (
          <div key={item._id} className="animate-fade-in flex items-center gap-3 p-3 sm:p-4">
            <div className="min-w-0 flex-1">
              <div className="truncate font-medium">{headline(kind, item)}</div>
              <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                <span
                  className={cn(
                    'rounded-full px-2 py-0.5 font-medium',
                    item.published
                      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200'
                      : 'bg-muted'
                  )}
                >
                  {item.published ? 'Live' : 'Draft'}
                </span>
                {kind === 'news' && item.slug ? <span className="font-mono">/news/{item.slug}</span> : null}
                {kind === 'testimonial' && (item.en?.name || item.ar?.name) ? (
                  <span>{item.en?.name || item.ar?.name}</span>
                ) : null}
                {!item.ar?.[meta.fields[0].key] ? <span>No Arabic yet</span> : null}
              </div>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={item.published ? 'Unpublish' : 'Publish'}
              title={item.published ? 'Unpublish' : 'Publish'}
              disabled={togglePublish.isPending}
              onClick={() => togglePublish.mutate(item)}
            >
              {item.published ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Edit"
              onClick={() => {
                setErrors({})
                setDraft(toDraft(item))
              }}
            >
              <Pencil className="size-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Delete"
              onClick={() => setDeleting(item)}
            >
              <Trash2 className="size-4" />
            </Button>
          </div>
        ))}
      </div>

      <Dialog open={Boolean(draft)} onOpenChange={(open) => !open && setDraft(null)}>
        <DialogContent className="max-h-[90dvh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {draft?.id ? 'Edit' : 'New'} {meta.singular}
            </DialogTitle>
            <DialogDescription>
              Fill in English, Arabic or both. A missing language falls back to the other one on the site.
            </DialogDescription>
          </DialogHeader>
          {draft && (
            <div className="grid gap-4">
              <div className="grid gap-4 md:grid-cols-2">
                {(['en', 'ar'] as const).map((lang) => (
                  <fieldset key={lang} className="grid content-start gap-3" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
                    <legend className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {lang === 'en' ? 'English' : 'العربية'}
                    </legend>
                    {meta.fields.map((f) => {
                      const id = `content-${lang}-${f.key}`
                      const error = errors[`${lang}.${f.key}`]
                      return (
                        <div key={f.key} className="space-y-1.5">
                          <Label htmlFor={id}>{f.label}</Label>
                          {f.multiline ? (
                            <Textarea
                              id={id}
                              rows={f.rows}
                              value={draft[lang][f.key] ?? ''}
                              onChange={(e) => setText(lang, f.key, e.target.value)}
                            />
                          ) : (
                            <Input
                              id={id}
                              value={draft[lang][f.key] ?? ''}
                              onChange={(e) => setText(lang, f.key, e.target.value)}
                            />
                          )}
                          {error ? <p className="text-xs text-destructive">{error}</p> : null}
                        </div>
                      )
                    })}
                  </fieldset>
                ))}
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                {kind === 'news' ? (
                  <div className="space-y-1.5">
                    <Label htmlFor="content-slug">Link (web address)</Label>
                    <Input
                      id="content-slug"
                      value={draft.slug}
                      placeholder="new-fleet-2026"
                      onChange={(e) => setDraft({ ...draft, slug: e.target.value })}
                    />
                    <p className={cn('text-xs', errors.slug ? 'text-destructive' : 'text-muted-foreground')}>
                      {errors.slug || `/news/${draft.slug || '…'}`}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    <Label htmlFor="content-order">Order (lower shows first)</Label>
                    <Input
                      id="content-order"
                      type="number"
                      value={draft.sortOrder}
                      onChange={(e) => setDraft({ ...draft, sortOrder: Number(e.target.value) || 0 })}
                    />
                  </div>
                )}
                {meta.image ? (
                  <MediaField
                    label={meta.image}
                    value={draft.image}
                    onChange={(image) => setDraft((d) => (d ? { ...d, image } : d))}
                  />
                ) : null}
              </div>

              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={draft.published}
                  onCheckedChange={(v) => setDraft({ ...draft, published: v === true })}
                />
                Live on the website
              </label>
            </div>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDraft(null)}>
              Cancel
            </Button>
            <Button type="button" disabled={save.isPending} onClick={() => draft && save.mutate(draft)}>
              {draft?.published ? 'Save and publish' : 'Save draft'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={Boolean(deleting)}
        title={`Delete this ${meta.singular}?`}
        description="It disappears from the website straight away. This can't be undone."
        confirmLabel="Delete"
        onConfirm={() => deleting && remove.mutate(deleting)}
        onCancel={() => setDeleting(null)}
      />
    </div>
  )
}
