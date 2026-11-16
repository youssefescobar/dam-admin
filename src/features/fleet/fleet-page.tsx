import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Bus, ImageIcon, Loader2, Pencil, Plus, Trash2, Upload, X } from 'lucide-react'
import { toast } from 'sonner'
import { api, ApiError, uploadFile } from '@/lib/api'
import type { FleetBus, FleetText, QuoteClass } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { QueryError } from '@/components/ui/query-error'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { cn, siteAsset } from '@/lib/utils'

const QUOTE_CLASSES: { value: QuoteClass; label: string }[] = [
  { value: 'vip', label: 'VIP' },
  { value: 'premium_vip', label: 'Premium VIP' },
  { value: 'standard', label: 'Standard coach' },
  { value: 'coach', label: 'Coach' },
  { value: 'city_large', label: 'Large city bus' },
  { value: 'city', label: 'City / minibus' },
  { value: 'employee', label: 'Staff bus' },
]

const LANGS = [
  { lang: 'en', label: 'English' },
  { lang: 'ar', label: 'العربية' },
  { lang: 'fr', label: 'Français' },
  { lang: 'id', label: 'Bahasa Indonesia' },
] as const
type Lang = (typeof LANGS)[number]['lang']

const IMAGE_ACCEPT = 'image/*'
const MAX_IMAGES = 20

/** Amenities are edited as one-per-line text. */
type DraftText = Omit<FleetText, 'amenities'> & { amenities: string }

type Draft = {
  _id?: string
  slug: string
  quoteClass: QuoteClass
  published: boolean
  showInShowroom: boolean
  coverImage: string
  exteriorImages: string[]
  interiorImages: string[]
} & Record<Lang, DraftText>

const emptyText = (): DraftText => ({ name: '', seatsLabel: '', summary: '', amenities: '' })

const toDraftText = (t?: Partial<FleetText>): DraftText => ({
  name: t?.name || '',
  seatsLabel: t?.seatsLabel || '',
  summary: t?.summary || '',
  amenities: (t?.amenities || []).join('\n'),
})

const emptyDraft = (): Draft => ({
  slug: '',
  quoteClass: 'vip',
  published: true,
  showInShowroom: true,
  coverImage: '',
  exteriorImages: [],
  interiorImages: [],
  en: emptyText(),
  ar: emptyText(),
  fr: emptyText(),
  id: emptyText(),
})

const toDraft = (bus: FleetBus): Draft => ({
  _id: bus._id,
  slug: bus.slug,
  quoteClass: bus.quoteClass || 'vip',
  published: bus.published,
  showInShowroom: bus.showInShowroom,
  coverImage: bus.coverImage || '',
  exteriorImages: bus.exteriorImages || [],
  interiorImages: bus.interiorImages || [],
  en: toDraftText(bus.en),
  ar: toDraftText(bus.ar),
  fr: toDraftText(bus.fr),
  id: toDraftText(bus.id),
})

const toText = (t: DraftText): FleetText => ({
  name: t.name.trim(),
  seatsLabel: t.seatsLabel.trim(),
  summary: t.summary.trim(),
  amenities: t.amenities
    .split('\n')
    .map((a) => a.trim())
    .filter(Boolean),
})

const toBody = (d: Draft) => ({
  slug: d.slug.trim(),
  quoteClass: d.quoteClass,
  published: d.published,
  showInShowroom: d.showInShowroom,
  coverImage: d.coverImage.trim(),
  exteriorImages: d.exteriorImages,
  interiorImages: d.interiorImages,
  en: toText(d.en),
  ar: toText(d.ar),
  fr: toText(d.fr),
  id: toText(d.id),
})

/** Single image: upload/replace, remove, or type a path. */
function CoverField({
  value,
  onChange,
  onUploading,
  error,
}: {
  value: string
  onChange: (url: string) => void
  onUploading: (delta: number) => void
  error?: string
}) {
  const [uploading, setUploading] = useState(false)

  const pick = async (file: File | undefined) => {
    if (!file) return
    setUploading(true)
    onUploading(1)
    try {
      onChange(await uploadFile(file))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setUploading(false)
      onUploading(-1)
    }
  }

  return (
    <div className="space-y-1.5 sm:col-span-2">
      <Label htmlFor="fleet-cover">Cover image</Label>
      <div className="flex items-start gap-3">
        {value ? (
          <img src={siteAsset(value)} alt="" className="aspect-[4/3] w-28 shrink-0 rounded-lg border bg-muted object-cover" />
        ) : (
          <div className="flex aspect-[4/3] w-28 shrink-0 items-center justify-center rounded-lg border border-dashed text-muted-foreground">
            <ImageIcon className="size-6 opacity-50" />
          </div>
        )}
        <div className="grid min-w-0 flex-1 gap-2">
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" disabled={uploading} asChild>
              <label className="cursor-pointer">
                {uploading ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
                {uploading ? 'Uploading…' : value ? 'Replace' : 'Upload image'}
                <input
                  type="file"
                  accept={IMAGE_ACCEPT}
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
          <Input id="fleet-cover" value={value} placeholder="…or a link (https://…)" onChange={(e) => onChange(e.target.value)} />
          <p className={cn('text-xs', error ? 'text-destructive' : 'text-muted-foreground')}>
            {error || 'Empty = the first exterior photo is used.'}
          </p>
        </div>
      </div>
    </div>
  )
}

/** Ordered photo list: upload several, reorder, remove. */
function ImageList({
  label,
  value,
  onChange,
  onAdd,
  onUploading,
  error,
}: {
  label: string
  value: string[]
  onChange: (urls: string[]) => void
  /** Appends to the latest list, so removing or reordering during an upload sticks. */
  onAdd: (url: string) => void
  onUploading: (delta: number) => void
  error?: string
}) {
  const [uploading, setUploading] = useState(0)

  const pick = async (files: File[]) => {
    const room = MAX_IMAGES - value.length - uploading
    if (files.length > room) toast.error(`Up to ${MAX_IMAGES} photos per list`)
    for (const file of files.slice(0, Math.max(room, 0))) {
      setUploading((n) => n + 1)
      onUploading(1)
      try {
        onAdd(await uploadFile(file))
      } catch (err) {
        toast.error(`${file.name}: ${err instanceof Error ? err.message : 'Upload failed'}`)
      } finally {
        setUploading((n) => n - 1)
        onUploading(-1)
      }
    }
  }

  const move = (from: number, to: number) => {
    const next = [...value]
    next.splice(to, 0, ...next.splice(from, 1))
    onChange(next)
  }

  return (
    <div className="space-y-2 sm:col-span-2">
      <Label>{label}</Label>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
        {value.map((url, i) => (
          <div key={url + i} className="relative aspect-[4/3] overflow-hidden rounded-lg border bg-muted">
            <img src={siteAsset(url)} alt="" className="size-full object-cover" />
            <button
              type="button"
              aria-label="Remove"
              onClick={() => onChange(value.filter((_, j) => j !== i))}
              className="absolute end-1 top-1 rounded-full bg-background/90 p-1"
            >
              <X className="size-3.5" />
            </button>
            <div className="absolute inset-x-1 bottom-1 flex justify-between">
              <button
                type="button"
                aria-label="Move earlier"
                disabled={i === 0}
                onClick={() => move(i, i - 1)}
                className="rounded-full bg-background/90 p-1 disabled:invisible"
              >
                <ArrowLeft className="size-3.5" />
              </button>
              <button
                type="button"
                aria-label="Move later"
                disabled={i === value.length - 1}
                onClick={() => move(i, i + 1)}
                className="rounded-full bg-background/90 p-1 disabled:invisible"
              >
                <ArrowRight className="size-3.5" />
              </button>
            </div>
          </div>
        ))}
        {Array.from({ length: uploading }).map((_, i) => (
          <div key={`up-${i}`} className="flex aspect-[4/3] animate-pulse items-center justify-center rounded-lg border bg-muted">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        ))}
        {value.length + uploading < MAX_IMAGES ? (
          <label className="flex aspect-[4/3] cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border border-dashed text-xs text-muted-foreground hover:bg-muted/50">
            <Upload className="size-5" />
            Add
            <input
              type="file"
              multiple
              accept={IMAGE_ACCEPT}
              className="sr-only"
              onChange={(e) => {
                void pick(Array.from(e.target.files ?? []))
                e.target.value = ''
              }}
            />
          </label>
        ) : null}
      </div>
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  )
}

const TEXT_FIELDS: { key: keyof DraftText; label: string; rows?: number; hint?: string }[] = [
  { key: 'name', label: 'Name' },
  { key: 'seatsLabel', label: 'Seats label' },
  { key: 'summary', label: 'Summary', rows: 3 },
  { key: 'amenities', label: 'Amenities', rows: 5, hint: 'One per line' },
]

export function FleetPage() {
  const queryClient = useQueryClient()
  const [draft, setDraft] = useState<Draft | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [deleting, setDeleting] = useState<FleetBus | null>(null)
  // Photos still uploading in the open editor; saving now would drop them.
  const [uploads, setUploads] = useState(0)
  const onUploading = (delta: number) => setUploads((n) => n + delta)

  const query = useQuery({
    queryKey: ['fleet'],
    queryFn: () => api<{ items: FleetBus[] }>('/fleet/all'),
  })
  const items = query.data?.items ?? []

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['fleet'] })

  const save = useMutation({
    mutationFn: (d: Draft) =>
      d._id
        ? api<{ item: FleetBus }>(`/fleet/${d._id}`, { method: 'PUT', body: toBody(d) })
        : api<{ item: FleetBus }>('/fleet', { method: 'POST', body: toBody(d) }),
    onSuccess: () => {
      toast.success('Saved — the website updates within a minute')
      setDraft(null)
      setErrors({})
      void invalidate()
    },
    onError: (err: Error) => {
      setErrors(err instanceof ApiError ? err.fields || {} : {})
      toast.error(err.message)
    },
  })

  const reorder = useMutation({
    mutationFn: (ids: string[]) => api('/fleet/order', { method: 'PUT', body: { ids } }),
    onSettled: invalidate,
    onError: (err: Error) => toast.error(err.message),
  })

  const remove = useMutation({
    mutationFn: (bus: FleetBus) => api(`/fleet/${bus._id}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast.success('Deleted')
      setDeleting(null)
      void invalidate()
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const move = (from: number, to: number) => {
    const ids = items.map((b) => b._id)
    ids.splice(to, 0, ...ids.splice(from, 1))
    reorder.mutate(ids)
  }

  const setText = (lang: Lang, key: keyof DraftText, value: string) =>
    setDraft((d) => (d ? { ...d, [lang]: { ...d[lang], [key]: value } } : d))

  const langFields = (lang: Lang, label: string) => (
    <fieldset key={lang} className="grid content-start gap-3" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      <legend className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</legend>
      {draft &&
        TEXT_FIELDS.map((f) => {
          const id = `fleet-${lang}-${f.key}`
          const error = errors[`${lang}.${f.key}`]
          return (
            <div key={f.key} className="space-y-1.5">
              <Label htmlFor={id}>
                {f.label}
                {f.hint ? <span className="font-normal text-muted-foreground"> · {f.hint}</span> : null}
              </Label>
              {f.rows ? (
                <Textarea id={id} rows={f.rows} value={draft[lang][f.key]} onChange={(e) => setText(lang, f.key, e.target.value)} />
              ) : (
                <Input id={id} value={draft[lang][f.key]} onChange={(e) => setText(lang, f.key, e.target.value)} />
              )}
              {error ? <p className="text-xs text-destructive">{error}</p> : null}
            </div>
          )
        })}
    </fieldset>
  )

  return (
    <div className="flex flex-1 flex-col gap-4 overflow-auto p-4 sm:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Fleet</h1>
          <p className="text-sm text-muted-foreground">The buses shown on the website, in this order.</p>
        </div>
        <Button
          type="button"
          onClick={() => {
            setErrors({})
            setDraft(emptyDraft())
          }}
        >
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
          return (
            <div key={bus._id} className="animate-fade-in flex items-center gap-3 p-3 sm:p-4">
              {cover ? (
                <img src={siteAsset(cover)} alt="" className="aspect-[4/3] w-16 shrink-0 rounded-md border bg-muted object-cover" />
              ) : (
                <div className="flex aspect-[4/3] w-16 shrink-0 items-center justify-center rounded-md border border-dashed text-muted-foreground">
                  <Bus className="size-5 opacity-50" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">{bus.en?.name || bus.ar?.name || bus.slug}</div>
                {bus.ar?.name ? (
                  <div className="truncate text-sm text-muted-foreground" dir="rtl">
                    {bus.ar.name}
                  </div>
                ) : null}
                <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                  {bus.en?.seatsLabel || bus.ar?.seatsLabel ? <span>{bus.en?.seatsLabel || bus.ar?.seatsLabel}</span> : null}
                  {!bus.published ? <span className="rounded-full bg-muted px-2 py-0.5 font-medium">Hidden</span> : null}
                  {bus.published && !bus.showInShowroom ? (
                    <span className="rounded-full bg-muted px-2 py-0.5 font-medium">Not in showroom</span>
                  ) : null}
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
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label="Edit"
                  onClick={() => {
                    setErrors({})
                    setDraft(toDraft(bus))
                  }}
                >
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

      <Dialog open={Boolean(draft)} onOpenChange={(open) => !open && setDraft(null)}>
        <DialogContent className="max-h-[90dvh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{draft?._id ? 'Edit bus' : 'New bus'}</DialogTitle>
            <DialogDescription>Fill in English and Arabic. A missing language falls back to the other one.</DialogDescription>
          </DialogHeader>
          {draft && (
            <div className="grid gap-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="fleet-slug">ID</Label>
                  <Input
                    id="fleet-slug"
                    value={draft.slug}
                    disabled={Boolean(draft._id)}
                    placeholder="vip-2026"
                    onChange={(e) => setDraft({ ...draft, slug: e.target.value })}
                  />
                  <p className={cn('text-xs', errors.slug ? 'text-destructive' : 'text-muted-foreground')}>
                    {errors.slug || (draft._id ? "Can't be changed after creating." : 'Lowercase letters, numbers and dashes.')}
                  </p>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="fleet-class">Quote class</Label>
                  <Select
                    value={draft.quoteClass}
                    onValueChange={(v) => setDraft((d) => (d ? { ...d, quoteClass: v as QuoteClass } : d))}
                  >
                    <SelectTrigger id="fleet-class">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {QUOTE_CLASSES.map((c) => (
                        <SelectItem key={c.value} value={c.value}>
                          {c.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">Used when a visitor requests a quote for this bus.</p>
                </div>
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox checked={draft.published} onCheckedChange={(v) => setDraft({ ...draft, published: v === true })} />
                  Show on website
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={draft.showInShowroom}
                    onCheckedChange={(v) => setDraft({ ...draft, showInShowroom: v === true })}
                  />
                  Show in fleet showroom
                </label>
              </div>

              <div className="grid gap-4 md:grid-cols-2">{LANGS.slice(0, 2).map((l) => langFields(l.lang, l.label))}</div>

              <details className="rounded-lg border p-3">
                <summary className="cursor-pointer text-sm font-medium">More languages (optional — falls back to English)</summary>
                <div className="mt-3 grid gap-4 md:grid-cols-2">{LANGS.slice(2).map((l) => langFields(l.lang, l.label))}</div>
              </details>

              <div className="grid gap-4 sm:grid-cols-2">
                <CoverField
                  value={draft.coverImage}
                  onChange={(coverImage) => setDraft((d) => (d ? { ...d, coverImage } : d))}
                  onUploading={onUploading}
                  error={errors.coverImage}
                />
                {(['exteriorImages', 'interiorImages'] as const).map((key) => (
                  <ImageList
                    key={key}
                    label={key === 'exteriorImages' ? 'Exterior photos' : 'Interior photos'}
                    value={draft[key]}
                    onChange={(urls) => setDraft((d) => (d ? { ...d, [key]: urls } : d))}
                    onAdd={(url) => setDraft((d) => (d ? { ...d, [key]: [...d[key], url] } : d))}
                    onUploading={onUploading}
                    error={errors[key]}
                  />
                ))}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDraft(null)}>
              Cancel
            </Button>
            <Button type="button" disabled={save.isPending || uploads > 0} onClick={() => draft && save.mutate(draft)}>
              {uploads > 0 ? 'Uploading…' : save.isPending ? 'Saving…' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={Boolean(deleting)}
        title="Delete this bus?"
        description="It disappears from the website within a minute. This can't be undone."
        confirmLabel="Delete"
        onConfirm={() => deleting && remove.mutate(deleting)}
        onCancel={() => setDeleting(null)}
      />
    </div>
  )
}
