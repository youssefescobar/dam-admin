import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { toast } from 'sonner'
import './index.css'
import App from './App.tsx'
import { registerAppServiceWorker } from '@/lib/push'

void registerAppServiceWorker().then((reg) => {
  if (!reg) return
  // The app opens from its saved copy; the new service worker takes over in the
  // background after a deploy. Offer a reload instead of forcing one, so a half-filled
  // form is never lost.
  const hadController = Boolean(navigator.serviceWorker.controller)
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController) return // first install, nothing old on screen
    toast('A new version of DAMAC is ready', {
      id: 'app-update',
      duration: Infinity,
      action: { label: 'Reload', onClick: () => window.location.reload() },
    })
  })
  // An installed app can stay open for days; look for a new version when it comes back into view.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void reg.update().catch(() => {})
  })
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
)
