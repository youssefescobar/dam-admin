import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import type { CompanySettings } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { useEffect, useState } from 'react'

const empty: CompanySettings = {
  legalNameAr: '',
  legalNameEn: '',
  email: '',
  phones: [],
  whatsappNumber: '',
  addressAr: '',
  addressEn: '',
  workingHoursAr: '',
  workingHoursEn: '',
  fleetSizeNote: '',
  baggagePolicy: '',
  cancellationPolicy: '',
  childFareNote: '',
  quoteSlaHours: 24,
  complaintSlaHours: 48,
  botGreetingEn: '',
  botGreetingAr: '',
  botClosingEn: '',
  botClosingAr: '',
}

export function SettingsPage() {
  const queryClient = useQueryClient()
  const [form, setForm] = useState<CompanySettings>(empty)

  const query = useQuery({
    queryKey: ['settings'],
    queryFn: () => api<{ settings: CompanySettings }>('/settings'),
  })

  useEffect(() => {
    if (query.data?.settings) {
      setForm({ ...empty, ...query.data.settings, phones: query.data.settings.phones ?? [] })
    }
  }, [query.data])

  const saveMutation = useMutation({
    mutationFn: (body: Partial<CompanySettings>) =>
      api<{ settings: CompanySettings }>('/settings', { method: 'PATCH', body }),
    onSuccess: (data) => {
      toast.success('Settings saved')
      setForm({ ...empty, ...data.settings, phones: data.settings.phones ?? [] })
      queryClient.invalidateQueries({ queryKey: ['settings'] })
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const set = <K extends keyof CompanySettings>(key: K, value: CompanySettings[K]) => {
    setForm((s) => ({ ...s, [key]: value }))
  }

  const onSave = () => {
    saveMutation.mutate({
      legalNameAr: form.legalNameAr,
      legalNameEn: form.legalNameEn,
      email: form.email,
      phones: form.phones,
      whatsappNumber: form.whatsappNumber,
      addressAr: form.addressAr,
      addressEn: form.addressEn,
      workingHoursAr: form.workingHoursAr,
      workingHoursEn: form.workingHoursEn,
      fleetSizeNote: form.fleetSizeNote,
      baggagePolicy: form.baggagePolicy,
      cancellationPolicy: form.cancellationPolicy,
      childFareNote: form.childFareNote,
      quoteSlaHours: Number(form.quoteSlaHours) || 24,
      complaintSlaHours: Number(form.complaintSlaHours) || 48,
      botGreetingEn: form.botGreetingEn,
      botGreetingAr: form.botGreetingAr,
      botClosingEn: form.botClosingEn,
      botClosingAr: form.botClosingAr,
    })
  }

  if (query.isLoading) {
    return <p className="text-sm text-muted-foreground">Loading settings…</p>
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Company settings</h1>
        <p className="text-sm text-muted-foreground">
          Contact, hours, policies, and bot templates used by the assistant. Confirm WhatsApp and
          hours before launch.
        </p>
      </div>

      <section className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Identity & contact
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Legal name (EN)">
            <Input value={form.legalNameEn} onChange={(e) => set('legalNameEn', e.target.value)} />
          </Field>
          <Field label="Legal name (AR)">
            <Input value={form.legalNameAr} onChange={(e) => set('legalNameAr', e.target.value)} dir="rtl" />
          </Field>
          <Field label="Email">
            <Input type="email" value={form.email} onChange={(e) => set('email', e.target.value)} />
          </Field>
          <Field label="WhatsApp (digits, e.g. 966556616713)">
            <Input
              value={form.whatsappNumber}
              onChange={(e) => set('whatsappNumber', e.target.value)}
            />
          </Field>
          <Field label="Phones (comma-separated)" className="sm:col-span-2">
            <Input
              value={form.phones.join(', ')}
              onChange={(e) =>
                set(
                  'phones',
                  e.target.value
                    .split(',')
                    .map((p) => p.trim())
                    .filter(Boolean)
                )
              }
            />
          </Field>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Address & hours
        </h2>
        <Field label="Address (EN)">
          <Textarea value={form.addressEn} onChange={(e) => set('addressEn', e.target.value)} rows={2} />
        </Field>
        <Field label="Address (AR)">
          <Textarea
            value={form.addressAr}
            onChange={(e) => set('addressAr', e.target.value)}
            rows={2}
            dir="rtl"
          />
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Working hours (EN)">
            <Input
              value={form.workingHoursEn}
              onChange={(e) => set('workingHoursEn', e.target.value)}
            />
          </Field>
          <Field label="Working hours (AR)">
            <Input
              value={form.workingHoursAr}
              onChange={(e) => set('workingHoursAr', e.target.value)}
              dir="rtl"
            />
          </Field>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Policies & SLA
        </h2>
        <Field label="Fleet size note">
          <Textarea
            value={form.fleetSizeNote}
            onChange={(e) => set('fleetSizeNote', e.target.value)}
            rows={2}
          />
        </Field>
        <Field label="Baggage policy">
          <Textarea
            value={form.baggagePolicy}
            onChange={(e) => set('baggagePolicy', e.target.value)}
            rows={3}
          />
        </Field>
        <Field label="Cancellation / refund policy">
          <Textarea
            value={form.cancellationPolicy}
            onChange={(e) => set('cancellationPolicy', e.target.value)}
            rows={3}
          />
        </Field>
        <Field label="Child fare note">
          <Textarea
            value={form.childFareNote}
            onChange={(e) => set('childFareNote', e.target.value)}
            rows={2}
          />
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Quote SLA (hours)">
            <Input
              type="number"
              min={1}
              value={form.quoteSlaHours}
              onChange={(e) => set('quoteSlaHours', Number(e.target.value))}
            />
          </Field>
          <Field label="Complaint SLA (hours)">
            <Input
              type="number"
              min={1}
              value={form.complaintSlaHours}
              onChange={(e) => set('complaintSlaHours', Number(e.target.value))}
            />
          </Field>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Bot templates
        </h2>
        <Field label="Greeting (EN)">
          <Textarea
            value={form.botGreetingEn}
            onChange={(e) => set('botGreetingEn', e.target.value)}
            rows={3}
          />
        </Field>
        <Field label="Greeting (AR)">
          <Textarea
            value={form.botGreetingAr}
            onChange={(e) => set('botGreetingAr', e.target.value)}
            rows={3}
            dir="rtl"
          />
        </Field>
        <Field label="Closing (EN)">
          <Textarea
            value={form.botClosingEn}
            onChange={(e) => set('botClosingEn', e.target.value)}
            rows={2}
          />
        </Field>
        <Field label="Closing (AR)">
          <Textarea
            value={form.botClosingAr}
            onChange={(e) => set('botClosingAr', e.target.value)}
            rows={2}
            dir="rtl"
          />
        </Field>
      </section>

      <Button onClick={onSave} disabled={saveMutation.isPending}>
        {saveMutation.isPending ? 'Saving…' : 'Save settings'}
      </Button>
    </div>
  )
}

function Field({
  label,
  children,
  className,
}: {
  label: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={className}>
      <Label className="mb-1.5 block text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  )
}
