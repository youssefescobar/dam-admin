import { useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { api, ApiError } from '@/lib/api'
import { useAuth } from '@/features/auth/auth-context'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

const MIN_LENGTH = 8

export function ChangePasswordDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { replaceToken } = useAuth()
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [repeat, setRepeat] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)

  const close = (value: boolean) => {
    if (!value) {
      setCurrent('')
      setNext('')
      setRepeat('')
      setErrors({})
    }
    onOpenChange(value)
  }

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (next.length < MIN_LENGTH) return setErrors({ newPassword: `Use at least ${MIN_LENGTH} characters` })
    if (next !== repeat) return setErrors({ repeat: 'The two new passwords don’t match' })
    setSaving(true)
    try {
      const { token } = await api<{ token: string }>('/auth/password', {
        method: 'POST',
        body: { currentPassword: current, newPassword: next },
      })
      // The server signs out every older login; this device carries on with the new token.
      replaceToken(token)
      toast.success('Password changed. Other devices are signed out.')
      close(false)
    } catch (err) {
      setErrors(err instanceof ApiError && err.fields ? err.fields : {})
      toast.error(err instanceof Error ? err.message : 'Couldn’t change the password')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Change password</DialogTitle>
          <DialogDescription>You’ll stay signed in here. Your other devices will need the new password.</DialogDescription>
        </DialogHeader>
        <form id="change-password" className="grid gap-3" onSubmit={onSubmit}>
          <Field id="current-password" label="Current password" error={errors.currentPassword}>
            <Input
              id="current-password"
              type="password"
              autoComplete="current-password"
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
              required
            />
          </Field>
          <Field id="new-password" label="New password" error={errors.newPassword}>
            <Input
              id="new-password"
              type="password"
              autoComplete="new-password"
              minLength={MIN_LENGTH}
              value={next}
              onChange={(e) => setNext(e.target.value)}
              required
            />
          </Field>
          <Field id="repeat-password" label="New password again" error={errors.repeat}>
            <Input
              id="repeat-password"
              type="password"
              autoComplete="new-password"
              value={repeat}
              onChange={(e) => setRepeat(e.target.value)}
              required
            />
          </Field>
        </form>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => close(false)}>
            Cancel
          </Button>
          <Button type="submit" form="change-password" disabled={saving}>
            {saving ? 'Saving…' : 'Change password'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function Field({ id, label, error, children }: { id: string; label: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  )
}
