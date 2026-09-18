import { useCallback, useEffect, useState } from 'react'
import { Download, Share, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const DISMISS_KEY = 'damac-pwa-install-dismissed'

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

function isIos(): boolean {
  if (typeof navigator === 'undefined') return false
  return /iphone|ipad|ipod/i.test(navigator.userAgent)
}

function isStandalone(): boolean {
  if (typeof window === 'undefined') return false
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    // iOS Safari
    Boolean((navigator as Navigator & { standalone?: boolean }).standalone)
  )
}

export function PwaInstallBanner({ className }: { className?: string }) {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null)
  const [iosHint, setIosHint] = useState(false)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (isStandalone()) return
    if (localStorage.getItem(DISMISS_KEY) === '1') return

    if (isIos()) {
      setIosHint(true)
      setVisible(true)
      return
    }

    const onPrompt = (e: Event) => {
      e.preventDefault()
      setDeferred(e as BeforeInstallPromptEvent)
      setVisible(true)
    }
    window.addEventListener('beforeinstallprompt', onPrompt)
    return () => window.removeEventListener('beforeinstallprompt', onPrompt)
  }, [])

  const dismiss = useCallback(() => {
    localStorage.setItem(DISMISS_KEY, '1')
    setVisible(false)
    setDeferred(null)
  }, [])

  const install = useCallback(async () => {
    if (!deferred) return
    await deferred.prompt()
    const { outcome } = await deferred.userChoice
    if (outcome === 'accepted') dismiss()
    else setDeferred(null)
  }, [deferred, dismiss])

  if (!visible) return null

  return (
    <div
      className={cn(
        'flex items-start gap-3 border-b border-orange-200 bg-orange-50 px-3 py-2.5 text-sm text-foreground dark:border-orange-900/50 dark:bg-orange-950/40',
        className
      )}
    >
      <Download className="mt-0.5 size-4 shrink-0 text-primary" />
      <div className="min-w-0 flex-1">
        <p className="font-medium">Install DAMAC</p>
        {iosHint ? (
          <p className="mt-0.5 text-xs text-muted-foreground">
            Tap <Share className="inline size-3.5" /> Share, then{' '}
            <span className="font-medium">Add to Home Screen</span> for the full app
            experience.
          </p>
        ) : (
          <p className="mt-0.5 text-xs text-muted-foreground">
            Add to your home screen for faster access and push alerts.
          </p>
        )}
        <div className="mt-2 flex flex-wrap gap-2">
          {!iosHint && deferred && (
            <Button type="button" size="sm" onClick={() => void install()}>
              Install app
            </Button>
          )}
          <Button type="button" size="sm" variant="ghost" onClick={dismiss}>
            Not now
          </Button>
        </div>
      </div>
      <button
        type="button"
        className="rounded-md p-1 text-muted-foreground hover:bg-black/5"
        aria-label="Dismiss"
        onClick={dismiss}
      >
        <X className="size-4" />
      </button>
    </div>
  )
}
