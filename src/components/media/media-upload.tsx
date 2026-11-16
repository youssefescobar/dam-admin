import { useState } from 'react'
import { ArrowLeft, ArrowRight, ImageIcon, Loader2, Upload, X } from 'lucide-react'
import { toast } from 'sonner'
import { uploadFile } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn, isVideo, siteAsset } from '@/lib/utils'

/** File types the backend accepts for site content (see dam-backend storage.js). */
export const IMAGE_ACCEPT = 'image/jpeg,image/png,image/webp,image/gif,image/avif'
export const MEDIA_ACCEPT = `${IMAGE_ACCEPT},video/mp4,video/webm`

/** Tells the editor how many uploads are running, so Save can wait for them. */
type OnUploading = (delta: number) => void

/** Upload one file. Returns its URL, or null after showing the error. */
async function upload(file: File, onUploading: OnUploading, errorPrefix = ''): Promise<string | null> {
  onUploading(1)
  try {
    return await uploadFile(file)
  } catch (err) {
    toast.error(`${errorPrefix}${err instanceof Error ? err.message : 'Upload failed'}`)
    return null
  } finally {
    onUploading(-1)
  }
}

/** Preview of an uploaded image or video. Site paths (`/fleet/…`) load from the public website. */
export function MediaThumb({ url, className }: { url: string; className?: string }) {
  const src = siteAsset(url)
  return isVideo(url) ? (
    <video src={`${src}#t=0.1`} muted playsInline preload="metadata" className={cn('object-cover', className)} />
  ) : (
    <img src={src} alt="" className={cn('object-cover', className)} />
  )
}

function FieldMessage({ error, hint }: { error?: string; hint?: string }) {
  if (!error && !hint) return null
  return <p className={cn('text-xs', error ? 'text-destructive' : 'text-muted-foreground')}>{error || hint}</p>
}

/** One file: upload or replace from the computer, remove, or paste a link. */
export function MediaField({
  id,
  label,
  value,
  onChange,
  onUploading,
  accept = IMAGE_ACCEPT,
  hint,
  error,
}: {
  id: string
  label: string
  value: string
  onChange: (url: string) => void
  onUploading: OnUploading
  accept?: string
  hint?: string
  error?: string
}) {
  const [uploading, setUploading] = useState(false)

  const pick = async (file: File | undefined) => {
    if (!file) return
    setUploading(true)
    const url = await upload(file, onUploading)
    setUploading(false)
    if (url) onChange(url)
  }

  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <div className="flex items-start gap-3">
        {value ? (
          <MediaThumb url={value} className="aspect-[4/3] w-28 shrink-0 rounded-lg border bg-muted" />
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
                {uploading ? 'Uploading…' : value ? 'Replace' : 'Upload'}
                <input
                  type="file"
                  accept={accept}
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
          <Input id={id} value={value} placeholder="…or paste a link (https://…)" onChange={(e) => onChange(e.target.value)} />
          <FieldMessage error={error} hint={hint} />
        </div>
      </div>
    </div>
  )
}

const tileButton = 'rounded-full bg-background/90 p-1 shadow-sm'

/** Ordered files: upload several at once, reorder, remove, optionally paste links. */
export function MediaList({
  label,
  value,
  onChange,
  onAdd,
  onUploading,
  max,
  accept = IMAGE_ACCEPT,
  firstIsCover = false,
  allowLinks = false,
  hint,
  error,
}: {
  label: string
  value: string[]
  onChange: (urls: string[]) => void
  /** Appends to the latest list, so removing or reordering during an upload sticks. */
  onAdd: (url: string) => void
  onUploading: OnUploading
  max: number
  accept?: string
  /** Label the first file "Cover" and offer "Make cover" on the others. */
  firstIsCover?: boolean
  allowLinks?: boolean
  hint?: string
  error?: string
}) {
  const [uploading, setUploading] = useState(0)
  const [link, setLink] = useState('')
  const full = value.length + uploading >= max

  const pick = async (files: File[]) => {
    const room = max - value.length - uploading
    if (files.length > room) toast.error(`Up to ${max} files here`)
    for (const file of files.slice(0, Math.max(room, 0))) {
      setUploading((n) => n + 1)
      const url = await upload(file, onUploading, `${file.name}: `)
      setUploading((n) => n - 1)
      if (url) onAdd(url)
    }
  }

  const move = (from: number, to: number) => {
    const next = [...value]
    next.splice(to, 0, ...next.splice(from, 1))
    onChange(next)
  }

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <FieldMessage hint={hint} />
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {value.map((url, i) => (
          <div key={url + i} className="relative aspect-[4/3] overflow-hidden rounded-lg border bg-muted">
            <MediaThumb url={url} className="size-full" />
            {firstIsCover ? (
              i === 0 ? (
                <span className="absolute start-1 top-1 rounded bg-background/90 px-1.5 py-0.5 text-[10px] font-semibold">Cover</span>
              ) : (
                <button
                  type="button"
                  onClick={() => move(i, 0)}
                  className="absolute start-1 top-1 rounded bg-background/90 px-1.5 py-0.5 text-[10px] font-medium"
                >
                  Make cover
                </button>
              )
            ) : null}
            <button
              type="button"
              aria-label="Remove"
              onClick={() => onChange(value.filter((_, j) => j !== i))}
              className={cn(tileButton, 'absolute end-1 top-1')}
            >
              <X className="size-3.5" />
            </button>
            <div className="absolute inset-x-1 bottom-1 flex justify-between">
              <button
                type="button"
                aria-label="Move earlier"
                disabled={i === 0}
                onClick={() => move(i, i - 1)}
                className={cn(tileButton, 'disabled:invisible')}
              >
                <ArrowLeft className="size-3.5 rtl:rotate-180" />
              </button>
              <button
                type="button"
                aria-label="Move later"
                disabled={i === value.length - 1}
                onClick={() => move(i, i + 1)}
                className={cn(tileButton, 'disabled:invisible')}
              >
                <ArrowRight className="size-3.5 rtl:rotate-180" />
              </button>
            </div>
          </div>
        ))}
        {Array.from({ length: uploading }).map((_, i) => (
          <div key={`up-${i}`} className="flex aspect-[4/3] animate-pulse items-center justify-center rounded-lg border bg-muted">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        ))}
        {!full ? (
          <label className="flex aspect-[4/3] cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border border-dashed text-xs text-muted-foreground hover:bg-muted/50">
            <Upload className="size-5" />
            Add
            <input
              type="file"
              multiple
              accept={accept}
              className="sr-only"
              onChange={(e) => {
                void pick(Array.from(e.target.files ?? []))
                e.target.value = ''
              }}
            />
          </label>
        ) : null}
      </div>
      {allowLinks ? (
        <div className="flex gap-2">
          <Input value={link} placeholder="…or paste a link (https://…)" onChange={(e) => setLink(e.target.value)} />
          <Button
            type="button"
            variant="outline"
            disabled={!/^https?:\/\//.test(link.trim()) || full}
            onClick={() => {
              onAdd(link.trim())
              setLink('')
            }}
          >
            Add link
          </Button>
        </div>
      ) : null}
      <FieldMessage error={error} />
    </div>
  )
}
