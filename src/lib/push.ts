import { api } from '@/lib/api'

export type PushStatus =
  | 'unsupported'
  | 'denied'
  | 'default'
  | 'subscribed'
  | 'unsubscribed'

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  const output = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) output[i] = raw.charCodeAt(i)
  return output
}

export function isPushSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  )
}

/** `serviceWorker.ready` never settles if registration failed; give up after 5 s instead of hanging. */
function serviceWorkerReady(): Promise<ServiceWorkerRegistration> {
  return Promise.race([
    navigator.serviceWorker.ready,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Alerts aren’t available right now. Reload the app and try again.')), 5000)
    ),
  ])
}

export async function getPushStatus(): Promise<PushStatus> {
  if (!isPushSupported()) return 'unsupported'
  if (Notification.permission === 'denied') return 'denied'
  const reg = await serviceWorkerReady().catch(() => null)
  if (!reg) return 'unsupported'
  const sub = await reg.pushManager.getSubscription()
  if (sub) return 'subscribed'
  return Notification.permission === 'granted' ? 'unsubscribed' : 'default'
}

export async function registerAppServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) return null
  try {
    if (import.meta.env.DEV) {
      return await navigator.serviceWorker.register('/dev-sw.js?dev-sw', {
        type: 'module',
        scope: '/',
      })
    }
    return await navigator.serviceWorker.register('/sw.js', { scope: '/' })
  } catch (err) {
    console.error('SW registration failed', err)
    return null
  }
}


export async function enablePushNotifications(): Promise<PushSubscription> {
  if (!isPushSupported()) {
    throw new Error('Push notifications are not supported in this browser')
  }

  const permission = await Notification.requestPermission()
  if (permission !== 'granted') {
    throw new Error('Notification permission was not granted')
  }

  const { publicKey } = await api<{ publicKey: string }>('/push/vapid-public-key', {
    auth: false,
  })
  if (!publicKey) {
    throw new Error('Server has no VAPID public key configured')
  }

  const reg = await serviceWorkerReady()
  let sub = await reg.pushManager.getSubscription()
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
    })
  }

  const json = sub.toJSON()
  if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
    throw new Error('Invalid push subscription from browser')
  }

  await api('/push/subscribe', {
    method: 'POST',
    body: {
      endpoint: json.endpoint,
      keys: {
        p256dh: json.keys.p256dh,
        auth: json.keys.auth,
      },
    },
  })

  return sub
}

export async function disablePushNotifications(): Promise<void> {
  if (!isPushSupported()) return
  // getRegistration answers at once (unlike `ready`), so signing out never waits on a missing worker.
  const reg = await navigator.serviceWorker.getRegistration()
  const sub = await reg?.pushManager.getSubscription()
  if (!sub) return

  try {
    await api('/push/unsubscribe', {
      method: 'POST',
      body: { endpoint: sub.endpoint },
    })
  } catch {
    /* still unsubscribe locally */
  }

  await sub.unsubscribe()
}
