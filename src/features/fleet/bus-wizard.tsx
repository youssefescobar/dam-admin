import { useState, type ReactNode } from 'react'
import { useMutation } from '@tanstack/react-query'
import { AlertTriangle, Check, ChevronLeft, ChevronRight } from 'lucide-react'
import { toast } from 'sonner'
import { api, ApiError } from '@/lib/api'
import type { FleetBus, QuoteClass } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { MediaField, MediaList, MediaThumb } from '@/components/media/media-upload'
import { cn, slugify } from '@/lib/utils'
import {
  amenityList,
  EXTRA_LANGS,
  LANGS,
  MAIN_LANGS,
  MAX_PHOTOS,
  photoCount,
  QUOTE_CLASSES,
  SLUG_PATTERN,
  toBody,
  type Draft,
  type DraftText,
  type Lang,
  type PhotoKey,
} from './draft'

type Errors = Record<string, string>

const STEPS = [
  { title: 'Basics', hint: 'Name, ID and the quote type this bus books as.' },
  { title: 'Details', hint: 'Seats, a short summary and amenities, in English and Arabic.' },
  { title: 'Photos', hint: 'The cover photo, then photos of the outside and inside.' },
  { title: 'Translations', hint: 'Optional. Any field left empty shows the English text.' },
  { title: 'Review', hint: 'Check everything, choose where the bus shows, then save.' },
] as const
const LAST = STEPS.length - 1

/** Which step holds a field, so a server error can jump straight to it. */
function stepOf(field: string): number {
  if (field === 'slug' || field === 'quoteClass' || /^(en|ar)\.name$/.test(field)) return 0
  if (/^(en|ar)\./.test(field)) return 1
  if (/Image/.test(field)) return 2
  if (/^(fr|id)\./.test(field)) return 3
  return LAST
}

/** What must be filled before leaving a step. Only Basics has required fields. */
function validate(step: number, d: Draft): Errors {
  if (step !== 0) return {}
  const errors: Errors = {}
  if (!d.en.name.trim() && !d.ar.name.trim()) errors['en.name'] = 'Add a name in English or Arabic.'
  if (!SLUG_PATTERN.test(d.slug.trim())) errors.slug = 'Use lowercase letters, numbers and dashes, e.g. vip-2026.'
  return errors
}

const firstErrorStep = (errors: Errors) => Math.min(...Object.keys(errors).map(stepOf))

/** Error for a field, including one on a list item (`en.amenities.3` shows under `en.amenities`). */
const errorFor = (errors: Errors, field: string) =>
  errors[field] ?? Object.entries(errors).find(([key]) => key.startsWith(`${field}.`))?.[1]

export function BusWizard({ initial, onClose, onSaved }: { initial: Draft; onClose: () => void; onSaved: () => void }) {
  const isNew = !initial._id
  const [draft, setDraft] = useState(initial)
  const [step, setStep] = useState(0)
  // New buses unlock steps one at a time; an existing bus can jump anywhere.
  const [reached, setReached] = useState(isNew ? 0 : LAST)
  const [errors, setErrors] = useState<Errors>({})
  // Until staff edit the ID by hand, a new bus's ID follows its English name.
  const [slugEdited, setSlugEdited] = useState(!isNew)
  // Photos still uploading; saving now would drop them.
  const [uploads, setUploads] = useState(0)
  const onUploading = (delta: number) => setUploads((n) => n + delta)
  const [confirmingClose, setConfirmingClose] = useState(false)

  // Closing must not silently throw away several steps of typing.
  const requestClose = () => (JSON.stringify(draft) === JSON.stringify(initial) ? onClose() : setConfirmingClose(true))

  const update = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }))
  const setText = (lang: Lang, key: keyof DraftText, value: string) =>
    setDraft((d) => {
      const next = { ...d, [lang]: { ...d[lang], [key]: value } }
      if (lang === 'en' && key === 'name' && !slugEdited) next.slug = slugify(value)
      return next
    })

  const goTo = (target: number) => {
    // Moving forward checks the steps being left; going back never blocks.
    for (let s = step; s < target; s++) {
      const found = validate(s, draft)
      if (Object.keys(found).length) {
        setErrors(found)
        setStep(s)
        return
      }
    }
    setErrors({})
    setStep(target)
    setReached((r) => Math.max(r, target))
  }

  const save = useMutation({
    mutationFn: (d: Draft) =>
      isNew
        ? api<{ item: FleetBus }>('/fleet', { method: 'POST', body: toBody(d) })
        : api<{ item: FleetBus }>(`/fleet/${d._id}`, { method: 'PUT', body: toBody(d) }),
    onSuccess: () => {
      toast.success(isNew ? 'Bus added. The website updates within a minute.' : 'Saved. The website updates within a minute.')
      onSaved()
    },
    onError: (err: Error) => {
      const fields = err instanceof ApiError ? err.fields || {} : {}
      setErrors(fields)
      if (Object.keys(fields).length) setStep(firstErrorStep(fields))
      toast.error(err.message)
    },
  })

  const submit = () => {
    const found = validate(0, draft)
    if (Object.keys(found).length) {
      setErrors(found)
      setStep(0)
      return
    }
    save.mutate(draft)
  }

  const stepWithError = new Set(Object.keys(errors).map(stepOf))
  const saveLabel = uploads > 0 ? 'Uploading…' : save.isPending ? 'Saving…' : isNew ? 'Add bus' : 'Save changes'

  return (
    <Dialog open onOpenChange={(open) => !open && requestClose()}>
      {/* A stray click outside is ignored; Cancel, × and Esc ask first if anything changed. */}
      <DialogContent className="max-h-[90dvh] max-w-3xl overflow-y-auto" onInteractOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>{isNew ? 'New bus' : `Edit ${initial.en.name || initial.ar.name || initial.slug}`}</DialogTitle>
          <DialogDescription>
            Step {step + 1} of {STEPS.length}: {STEPS[step].hint}
          </DialogDescription>
        </DialogHeader>

        <Stepper step={step} reached={reached} withErrors={stepWithError} onSelect={goTo} />

        <div className="min-h-64">
          {step === 0 && (
            <BasicsStep
              draft={draft}
              isNew={isNew}
              errors={errors}
              setText={setText}
              update={update}
              onSlugEdit={(slug) => {
                setSlugEdited(true)
                update({ slug })
              }}
            />
          )}
          {step === 1 && (
            <TextColumns langs={MAIN_LANGS} fields={DETAIL_FIELDS} draft={draft} errors={errors} setText={setText} />
          )}
          {step === 2 && <PhotosStep draft={draft} errors={errors} setDraft={setDraft} onUploading={onUploading} />}
          {step === 3 && (
            <TextColumns langs={EXTRA_LANGS} fields={ALL_TEXT_FIELDS} draft={draft} errors={errors} setText={setText} />
          )}
          {step === 4 && <ReviewStep draft={draft} update={update} onEdit={goTo} />}
        </div>

        <DialogFooter className="flex-row items-center justify-between gap-2 sm:justify-between">
          <Button type="button" variant="ghost" onClick={() => (step === 0 ? requestClose() : goTo(step - 1))}>
            {step === 0 ? (
              'Cancel'
            ) : (
              <>
                <ChevronLeft className="size-4 rtl:rotate-180" />
                Back
              </>
            )}
          </Button>
          <div className="flex gap-2">
            {/* An existing bus can be saved from any step. */}
            {!isNew && step < LAST ? (
              <Button type="button" variant="outline" disabled={save.isPending || uploads > 0} onClick={submit}>
                {saveLabel}
              </Button>
            ) : null}
            {step < LAST ? (
              <Button type="button" onClick={() => goTo(step + 1)}>
                Next
                <ChevronRight className="size-4 rtl:rotate-180" />
              </Button>
            ) : (
              <Button type="button" disabled={save.isPending || uploads > 0} onClick={submit}>
                {saveLabel}
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
      <ConfirmDialog
        open={confirmingClose}
        title="Discard your changes?"
        description="Everything you entered in this bus will be lost."
        confirmLabel="Discard"
        onConfirm={onClose}
        onCancel={() => setConfirmingClose(false)}
      />
    </Dialog>
  )
}

function Stepper({
  step,
  reached,
  withErrors,
  onSelect,
}: {
  step: number
  reached: number
  withErrors: Set<number>
  onSelect: (step: number) => void
}) {
  return (
    <ol className="grid grid-cols-5 gap-1.5" aria-label="Steps">
      {STEPS.map((s, i) => {
        const done = i < step
        return (
          <li key={s.title}>
            <button
              type="button"
              disabled={i > reached}
              aria-current={i === step ? 'step' : undefined}
              onClick={() => onSelect(i)}
              className="group flex w-full flex-col gap-1.5 text-start disabled:cursor-not-allowed disabled:opacity-50"
            >
              <span
                className={cn(
                  'h-1 rounded-full bg-muted transition-colors',
                  (done || i === step) && 'bg-primary',
                  withErrors.has(i) && 'bg-destructive'
                )}
              />
              <span
                className={cn(
                  'flex items-center gap-1 text-[11px] font-medium text-muted-foreground sm:text-xs',
                  i === step && 'text-foreground'
                )}
              >
                {done && !withErrors.has(i) ? <Check className="size-3 shrink-0" /> : null}
                <span className="truncate">{s.title}</span>
              </span>
            </button>
          </li>
        )
      })}
    </ol>
  )
}

/** Label, input and its error or hint. */
function Field({ id, label, hint, error, children }: { id?: string; label: string; hint?: string; error?: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {error || hint ? <p className={cn('text-xs', error ? 'text-destructive' : 'text-muted-foreground')}>{error || hint}</p> : null}
    </div>
  )
}

type TextField = { key: keyof DraftText; label: string; rows?: number; hint?: string }

const DETAIL_FIELDS: TextField[] = [
  { key: 'seatsLabel', label: 'Seats', hint: 'As shown on the site, e.g. 49 + 1 + 1' },
  { key: 'summary', label: 'Summary', rows: 3 },
  { key: 'amenities', label: 'Amenities', rows: 7, hint: 'One per line' },
]
const ALL_TEXT_FIELDS: TextField[] = [{ key: 'name', label: 'Name' }, ...DETAIL_FIELDS]

function BasicsStep({
  draft,
  isNew,
  errors,
  setText,
  update,
  onSlugEdit,
}: {
  draft: Draft
  isNew: boolean
  errors: Errors
  setText: (lang: Lang, key: keyof DraftText, value: string) => void
  update: (patch: Partial<Draft>) => void
  onSlugEdit: (slug: string) => void
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {MAIN_LANGS.map(({ lang, label }) => (
        <div key={lang} dir={lang === 'ar' ? 'rtl' : 'ltr'}>
          <Field id={`bus-${lang}-name`} label={`Name · ${label}`} error={errors[`${lang}.name`]}>
            <Input
              id={`bus-${lang}-name`}
              value={draft[lang].name}
              placeholder={lang === 'en' ? 'e.g. VIP Bus' : 'مثال: باص VIP'}
              onChange={(e) => setText(lang, 'name', e.target.value)}
            />
          </Field>
        </div>
      ))}
      <Field
        id="bus-slug"
        label="ID"
        error={errors.slug}
        hint={isNew ? 'Filled from the English name. Used in links; it can’t be changed later.' : 'Fixed once a bus is created.'}
      >
        <Input
          id="bus-slug"
          value={draft.slug}
          disabled={!isNew}
          placeholder="e.g. vip-2026"
          onChange={(e) => onSlugEdit(e.target.value.toLowerCase())}
        />
      </Field>
      <Field id="bus-class" label="Books as" hint="Pre-selected when a visitor taps “Request this bus”.">
        <Select value={draft.quoteClass} onValueChange={(v) => update({ quoteClass: v as QuoteClass })}>
          <SelectTrigger id="bus-class">
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
      </Field>
    </div>
  )
}

/** One column per language, the same fields in each. */
function TextColumns({
  langs,
  fields,
  draft,
  errors,
  setText,
}: {
  langs: readonly { lang: Lang; label: string }[]
  fields: TextField[]
  draft: Draft
  errors: Errors
  setText: (lang: Lang, key: keyof DraftText, value: string) => void
}) {
  return (
    <div className="grid gap-6 md:grid-cols-2">
      {langs.map(({ lang, label }) => (
        <fieldset key={lang} className="grid content-start gap-3" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
          <legend className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</legend>
          {fields.map((f) => {
            const id = `bus-${lang}-${f.key}`
            const value = draft[lang][f.key]
            const onChange = (v: string) => setText(lang, f.key, v)
            return (
              <Field key={f.key} id={id} label={f.label} hint={f.hint} error={errorFor(errors, `${lang}.${f.key}`)}>
                {f.rows ? (
                  <Textarea id={id} rows={f.rows} value={value} onChange={(e) => onChange(e.target.value)} />
                ) : (
                  <Input id={id} value={value} onChange={(e) => onChange(e.target.value)} />
                )}
              </Field>
            )
          })}
        </fieldset>
      ))}
    </div>
  )
}

const PHOTO_LISTS: { key: PhotoKey; label: string }[] = [
  { key: 'exteriorImages', label: 'Outside photos' },
  { key: 'interiorImages', label: 'Inside photos' },
]

function PhotosStep({
  draft,
  errors,
  setDraft,
  onUploading,
}: {
  draft: Draft
  errors: Errors
  setDraft: (fn: (d: Draft) => Draft) => void
  onUploading: (delta: number) => void
}) {
  return (
    <div className="grid gap-5">
      <MediaField
        id="bus-cover"
        label="Cover photo"
        hint="Shown first in the fleet showroom. Left empty, the first outside photo is used."
        value={draft.coverImage}
        onChange={(coverImage) => setDraft((d) => ({ ...d, coverImage }))}
        onUploading={onUploading}
        error={errors.coverImage}
      />
      {PHOTO_LISTS.map(({ key, label }) => (
        <MediaList
          key={key}
          label={label}
          value={draft[key]}
          onChange={(urls) => setDraft((d) => ({ ...d, [key]: urls }))}
          onAdd={(url) => setDraft((d) => ({ ...d, [key]: [...d[key], url] }))}
          onUploading={onUploading}
          max={MAX_PHOTOS}
          error={errorFor(errors, key)}
        />
      ))}
      {photoCount(draft) === 0 ? <NoPhotosWarning /> : null}
    </div>
  )
}

const NoPhotosWarning = () => (
  <p className="flex items-start gap-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
    <AlertTriangle className="mt-0.5 size-4 shrink-0" />
    Without photos this bus won’t appear in the fleet showroom.
  </p>
)

function ReviewStep({ draft, update, onEdit }: { draft: Draft; update: (patch: Partial<Draft>) => void; onEdit: (step: number) => void }) {
  const cover = draft.coverImage || draft.exteriorImages[0]
  const quoteClass = QUOTE_CLASSES.find((c) => c.value === draft.quoteClass)?.label
  const filled = (lang: Lang) => Object.values(draft[lang]).some((v) => v.trim())

  return (
    <div className="grid gap-4">
      <div className="flex gap-4 rounded-xl border p-4">
        {cover ? <MediaThumb url={cover} className="aspect-[4/3] w-32 shrink-0 rounded-lg border bg-muted" /> : null}
        <div className="min-w-0 space-y-1">
          <div className="font-semibold">{draft.en.name || '—'}</div>
          <div className="text-sm text-muted-foreground" dir="rtl">
            {draft.ar.name || '—'}
          </div>
          <div className="text-xs text-muted-foreground">
            <span className="font-mono">{draft.slug}</span> · books as {quoteClass}
          </div>
        </div>
      </div>

      <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
        <ReviewRow label="Seats" value={draft.en.seatsLabel || draft.ar.seatsLabel || '—'} onEdit={() => onEdit(1)} />
        <ReviewRow
          label="Amenities"
          value={`${amenityList(draft.en.amenities).length} English · ${amenityList(draft.ar.amenities).length} Arabic`}
          onEdit={() => onEdit(1)}
        />
        <ReviewRow
          label="Photos"
          value={`${draft.exteriorImages.length} outside · ${draft.interiorImages.length} inside${draft.coverImage ? ' · cover' : ''}`}
          onEdit={() => onEdit(2)}
        />
        <ReviewRow
          label="Languages"
          value={LANGS.filter((l) => filled(l.lang)).map((l) => l.label).join(', ') || '—'}
          onEdit={() => onEdit(3)}
        />
      </dl>

      {photoCount(draft) === 0 ? <NoPhotosWarning /> : null}

      <div className="grid gap-3 rounded-xl border p-4">
        <Toggle
          checked={draft.published}
          onChange={(published) => update({ published })}
          label="Show on the website"
          hint="Off hides the bus everywhere on the site."
        />
        <Toggle
          checked={draft.showInShowroom}
          disabled={!draft.published}
          onChange={(showInShowroom) => update({ showInShowroom })}
          label="Show in the fleet showroom"
          hint="The tabs on the Fleet page. Turn off for a bus that only appears elsewhere."
        />
      </div>
    </div>
  )
}

function ReviewRow({ label, value, onEdit }: { label: string; value: string; onEdit: () => void }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b py-1.5">
      <dt className="shrink-0 text-muted-foreground">{label}</dt>
      <dd className="flex min-w-0 items-baseline gap-2 text-end">
        <span className="truncate [overflow-wrap:normal]">{value}</span>
        <button type="button" onClick={onEdit} className="shrink-0 text-xs font-medium text-primary hover:underline">
          Edit
        </button>
      </dd>
    </div>
  )
}

function Toggle({
  checked,
  onChange,
  label,
  hint,
  disabled,
}: {
  checked: boolean
  onChange: (value: boolean) => void
  label: string
  hint: string
  disabled?: boolean
}) {
  return (
    <label className={cn('flex items-start gap-3', disabled && 'opacity-50')}>
      <Checkbox className="mt-0.5" checked={checked} disabled={disabled} onCheckedChange={(v) => onChange(v === true)} />
      <span>
        <span className="block text-sm font-medium">{label}</span>
        <span className="block text-xs text-muted-foreground">{hint}</span>
      </span>
    </label>
  )
}
