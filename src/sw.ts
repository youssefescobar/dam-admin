/// <reference lib="webworker" />
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching'
import { clientsClaim } from 'workbox-core'
import { NavigationRoute, registerRoute } from 'workbox-routing'

declare let self: ServiceWorkerGlobalScope

cleanupOutdatedCaches()
precacheAndRoute(self.__WB_MANIFEST)
self.skipWaiting()
clientsClaim()

// SPA navigations (refresh / deep links) while offline or from SW
registerRoute(
  new NavigationRoute(createHandlerBoundToURL('/index.html'), {
    denylist: [/^\/api/, /^\/health/],
  })
)

type PushPayload = {
  title?: string
  body?: string
  data?: {
    type?: string
    url?: string
    quoteId?: string
    conversationId?: string
  }
}

self.addEventListener('push', (event) => {
  let payload: PushPayload = {
    title: 'DAMAC',
    body: 'New activity',
    data: { url: '/quotes' },
  }

  try {
    if (event.data) {
      payload = { ...payload, ...event.data.json() }
    }
  } catch {
    try {
      const text = event.data?.text()
      if (text) payload.body = text
    } catch {
      /* ignore */
    }
  }

  const data = payload.data || {}
  const url =
    data.url ||
    (data.type === 'escalation' ? '/inbox' : '/quotes')

  event.waitUntil(
    self.registration.showNotification(payload.title || 'DAMAC', {
      body: payload.body || '',
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      data: { ...data, url },
    })
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const rawUrl =
    (event.notification.data && event.notification.data.url) || '/quotes'
  const targetUrl = new URL(rawUrl, self.location.origin).href

  event.waitUntil(
    (async () => {
      const allClients = await self.clients.matchAll({
        type: 'window',
        includeUncontrolled: true,
      })
      for (const client of allClients) {
        if ('focus' in client) {
          await client.focus()
          if ('navigate' in client) {
            await (client as WindowClient).navigate(targetUrl)
          }
          return
        }
      }
      await self.clients.openWindow(targetUrl)
    })()
  )
})
