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

    const onInstalled = () => {
      localStorage.setItem(DISMISS_KEY, '1')
      setVisible(false)
      setDeferred(null)
    }

    window.addEventListener('beforeinstallprompt', onPrompt)
    window.addEventListener('appinstalled', onInstalled)

    // If the native install prompt never fires, still show a compact how-to.
    const timer = window.setTimeout(() => {
      if (isStandalone()) return
      if (localStorage.getItem(DISMISS_KEY) === '1') return
      setVisible(true)
    }, 2500)

    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt)
      window.removeEventListener('appinstalled', onInstalled)
      window.clearTimeout(timer)
    }
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

  const canPrompt = Boolean(deferred) && !iosHint

  return (
    <div
      className={cn(
        'flex shrink-0 items-center gap-2 border-b border-orange-200/80 bg-orange-50 px-3 py-2 text-foreground dark:border-orange-900/40 dark:bg-orange-950/50',
        className
      )}
      role="region"
      aria-label="Install app"
    >
      <Download className="size-4 shrink-0 text-primary" aria-hidden />

      <div className="min-w-0 flex-1">
        {iosHint ? (
          <p className="text-xs leading-snug sm:text-sm">
            <span className="font-medium">Install DAMAC</span>
            <span className="text-muted-foreground">
              {' '}
              — tap <Share className="mx-0.5 inline size-3 align-text-bottom" /> Share →{' '}
              <span className="font-medium text-foreground">Add to Home Screen</span>
            </span>
          </p>
        ) : canPrompt ? (
          <p className="truncate text-xs font-medium sm:text-sm">
            Install DAMAC for home-screen access & alerts
          </p>
        ) : (
          <p className="text-xs leading-snug sm:text-sm">
            <span className="font-medium">Install DAMAC</span>
            <span className="text-muted-foreground">
              {' '}
              — browser menu (⋮) → <span className="font-medium text-foreground">Install app</span>
            </span>
          </p>
        )}
      </div>

      {canPrompt && (
        <Button
          type="button"
          size="sm"
          className="h-8 shrink-0 px-3 text-xs"
          onClick={() => void install()}
        >
          Install
        </Button>
      )}
      <Button
        type="button"
        size="sm"
        variant="ghost"
        className="hidden h-8 shrink-0 px-2 text-xs sm:inline-flex"
        onClick={dismiss}
      >
        Not now
      </Button>
      <button
        type="button"
        className="inline-flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-black/5 dark:hover:bg-white/10"
        aria-label="Dismiss install banner"
        onClick={dismiss}
      >
        <X className="size-4" />
      </button>
    </div>
  )
}
