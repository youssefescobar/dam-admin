import { useCallback, useEffect, useState } from 'react'
import { Bell, BellOff, BellRing } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  disablePushNotifications,
  enablePushNotifications,
  getPushStatus,
  type PushStatus,
} from '@/lib/push'

export function PushNotificationsToggle() {
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
        toast.success('Notifications disabled on this device')
      } else {
        await enablePushNotifications()
        toast.success('This device will get quote & escalation alerts')
      }
      await refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Push setup failed')
      await refresh()
    } finally {
      setBusy(false)
    }
  }

  if (status === 'unsupported') {
    return (
      <p className="px-2 text-[11px] leading-snug text-muted-foreground">
        Push not supported in this browser. Use Chrome/Edge, or install the app on iOS.
      </p>
    )
  }

  if (status === 'denied') {
    return (
      <p className="px-2 text-[11px] leading-snug text-muted-foreground">
        Notifications blocked — enable them in browser settings for this site.
      </p>
    )
  }

  const label =
    status === 'subscribed' ? 'Notifications on' : 'Enable notifications'
  const Icon = status === 'subscribed' ? BellRing : status === 'default' ? Bell : BellOff

  return (
    <Button
      type="button"
      variant={status === 'subscribed' ? 'secondary' : 'outline'}
      size="sm"
      className="w-full justify-start gap-2"
      disabled={busy}
      onClick={() => void onToggle()}
    >
      <Icon className="size-4 shrink-0" />
      {busy ? 'Working…' : label}
    </Button>
  )
}
