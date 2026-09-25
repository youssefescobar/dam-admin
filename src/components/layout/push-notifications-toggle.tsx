import { useCallback, useEffect, useState } from 'react'
import { Bell, BellOff, BellRing } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { DropdownMenuItem } from '@/components/ui/dropdown-menu'
import {
  disablePushNotifications,
  enablePushNotifications,
  getPushStatus,
  type PushStatus,
} from '@/lib/push'
import { cn } from '@/lib/utils'

export function PushNotificationsToggle({ compact = false, asMenuItem = false }: { compact?: boolean, asMenuItem?: boolean }) {
  const [status, setStatus] = useState<PushStatus>('default')
  const [busy, setBusy] = useState(false)

  const refresh = useCallback(async () => {
    setStatus(await getPushStatus())
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const onToggle = async () => {
    setBusy(true)
    try {
      if (status === 'subscribed') {
        await disablePushNotifications()
        toast.message('Alerts off on this device')
      } else {
        await enablePushNotifications()
        toast.success('Alerts on for quotes and chats')
      }
      await refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Couldn’t update notifications')
      await refresh()
    } finally {
      setBusy(false)
    }
  }

  const on = status === 'subscribed'
  const Icon = on ? BellRing : status === 'default' ? Bell : BellOff

  if (asMenuItem) {
    if (status === 'unsupported' || status === 'denied') {
      return (
        <DropdownMenuItem disabled>
          <BellOff className="mr-2 size-4 text-muted-foreground" />
          {status === 'unsupported' ? 'Alerts unsupported' : 'Alerts blocked'}
        </DropdownMenuItem>
      )
    }
    return (
      <DropdownMenuItem
        disabled={busy}
        onSelect={(e) => {
          e.preventDefault()
          void onToggle()
        }}
      >
        <Icon className="mr-2 size-4 text-muted-foreground" />
        {busy ? 'Updating…' : on ? 'Turn off alerts' : 'Turn on alerts'}
      </DropdownMenuItem>
    )
  }

  if (status === 'unsupported') {
    return (
      <p className="px-1 text-[11px] leading-snug text-muted-foreground">
        Install the app (or use Chrome) to get push alerts.
      </p>
    )
  }

  if (status === 'denied') {
    return (
      <p className="px-1 text-[11px] leading-snug text-muted-foreground">
        Alerts are blocked. Allow notifications for this site in your browser settings.
      </p>
    )
  }

  return (
    <div className="space-y-1.5">
      {!on && !compact && (
        <p className="px-1 text-[11px] leading-snug text-muted-foreground">
          Turn on alerts so you don’t miss new quotes or waiting chats.
        </p>
      )}
      <Button
        type="button"
        variant={on ? 'secondary' : 'default'}
        size="sm"
        className={cn('w-full justify-start gap-2', !on && 'shadow-sm')}
        disabled={busy}
        onClick={() => void onToggle()}
      >
        <Icon className="size-4 shrink-0" />
        {busy ? 'Updating…' : on ? 'Alerts on' : 'Turn on alerts'}
      </Button>
    </div>
  )
}
