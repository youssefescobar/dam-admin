import { useEffect, useState } from 'react'
import { NavLink, Outlet, Navigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  BookOpen,
  Bot,
  Inbox,
  LogOut,
  Menu,
  Moon,
  Sun,
  Table2,
  X,
} from 'lucide-react'
import { useTheme } from 'next-themes'
import { useAuth } from '@/features/auth/auth-context'
import { api } from '@/lib/api'
import type { Conversation } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { PushNotificationsToggle } from '@/components/layout/push-notifications-toggle'
import { PwaInstallBanner } from '@/components/layout/pwa-install-banner'
import { useLiveAlerts } from '@/hooks/use-live-alerts'
import { useKeyboardOpen } from '@/hooks/use-keyboard-open'
import { cn } from '@/lib/utils'

const nav = [
  { to: '/quotes', label: 'Quotes', icon: Table2 },
  { to: '/inbox', label: 'Inbox', icon: Inbox, badgeKey: 'inbox' as const },
  { to: '/kb', label: 'Knowledge', icon: BookOpen },
  { to: '/ai', label: 'AI chat', icon: Bot },
]

function BrandBlock({ compact = false }: { compact?: boolean }) {
  return (
    <div className={cn('flex min-w-0 items-center gap-3', compact && 'gap-2')}>
      <img
        src="/image.png"
        alt="DAMAC"
        className={cn(
          'shrink-0 rounded-md object-contain object-center',
          compact ? 'mt-0.5 size-8' : 'mt-1 size-11'
        )}
      />
      <div className="min-w-0">
        <div className={cn('font-semibold tracking-tight', compact ? 'text-base' : 'text-lg')}>
          DAMAC
        </div>
        {!compact && (
          <p className="text-xs leading-snug text-muted-foreground">
            Quotes, inbox & knowledge
          </p>
        )}
      </div>
    </div>
  )
}

function NavBadge({ count }: { count: number }) {
  if (!count) return null
  return (
    <span className="ml-auto inline-flex min-w-5 items-center justify-center rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-semibold leading-none text-primary-foreground">
      {count > 99 ? '99+' : count}
    </span>
  )
}

function SidebarNav({
  onNavigate,
  inboxCount,
}: {
  onNavigate?: () => void
  inboxCount: number
}) {
  const { admin, logout } = useAuth()
  const { theme, setTheme } = useTheme()

  return (
    <>
      <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-3">
        {nav.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            onClick={onNavigate}
            className={({ isActive }) =>
              cn(
                'flex min-h-11 items-center gap-2 rounded-md px-3 py-2.5 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                  : 'text-sidebar-foreground/80 hover:bg-sidebar-accent/70'
              )
            }
          >
            <item.icon className="size-4 shrink-0" />
            <span className="truncate">{item.label}</span>
            {'badgeKey' in item && item.badgeKey === 'inbox' ? (
              <NavBadge count={inboxCount} />
            ) : null}
          </NavLink>
        ))}
      </nav>
      <div className="space-y-2 border-t border-sidebar-border p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <div className="truncate px-2 text-xs font-medium">{admin?.name || 'Admin'}</div>
        <div className="truncate px-2 text-[11px] text-muted-foreground">{admin?.email}</div>
        <PushNotificationsToggle />
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="icon"
            className="size-11 shrink-0 md:size-9"
            type="button"
            aria-label="Toggle theme"
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          >
            {theme === 'dark' ? <Sun /> : <Moon />}
          </Button>
          <Button variant="outline" className="h-11 flex-1 md:h-9" type="button" onClick={logout}>
            <LogOut />
            Sign out
          </Button>
        </div>
      </div>
    </>
  )
}

export function AppShell() {
  const { token } = useAuth()
  const [menuOpen, setMenuOpen] = useState(false)
  const keyboardOpen = useKeyboardOpen()

  useLiveAlerts(Boolean(token))

  const inboxQuery = useQuery({
    queryKey: ['conversations', 'needs_human'],
    queryFn: () =>
      api<{ conversations: Conversation[] }>('/conversations?status=needs_human'),
    enabled: Boolean(token),
    refetchInterval: 30_000,
  })
  const inboxCount = inboxQuery.data?.conversations.length ?? 0

  useEffect(() => {
    if (!menuOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [menuOpen])

  if (!token) return <Navigate to="/login" replace />

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-background">
      <div
        className={cn('flex shrink-0 flex-col md:hidden', keyboardOpen && 'hidden')}
      >
        <header className="flex min-h-12 items-center justify-between gap-2 border-b px-3 py-2 pt-[max(0.5rem,env(safe-area-inset-top))]">
          <BrandBlock compact />
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="size-11"
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            onClick={() => setMenuOpen((o) => !o)}
          >
            {menuOpen ? <X /> : <Menu />}
          </Button>
        </header>
        <PwaInstallBanner />
      </div>

      {menuOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-black/40"
            aria-label="Close menu"
            onClick={() => setMenuOpen(false)}
          />
          <aside className="absolute inset-y-0 right-0 flex w-[min(20rem,88vw)] flex-col bg-sidebar text-sidebar-foreground shadow-xl animate-fade-in">
            <div className="flex items-center justify-between gap-2 px-4 py-4 pt-[max(1rem,env(safe-area-inset-top))]">
              <BrandBlock compact />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-11 text-sidebar-foreground"
                onClick={() => setMenuOpen(false)}
              >
                <X />
              </Button>
            </div>
            <Separator />
            <SidebarNav
              inboxCount={inboxCount}
              onNavigate={() => setMenuOpen(false)}
            />
          </aside>
        </div>
      )}

      <div className="flex min-h-0 flex-1 overflow-hidden">
        <aside className="hidden w-60 shrink-0 flex-col overflow-y-auto border-r border-sidebar-border bg-sidebar text-sidebar-foreground md:flex">
          <div className="flex items-center gap-3 px-4 py-5">
            <BrandBlock />
          </div>
          <Separator />
          <SidebarNav inboxCount={inboxCount} />
        </aside>

        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          <PwaInstallBanner className="hidden md:flex" />
          <main
            className={cn(
              'flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden md:pb-0',
              keyboardOpen
                ? 'pb-0'
                : 'pb-[calc(3.75rem+env(safe-area-inset-bottom))]'
            )}
          >
            <Outlet />
          </main>
        </div>
      </div>

      <nav
        className={cn(
          'fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden',
          keyboardOpen && 'hidden'
        )}
      >
        <div className="flex">
          {nav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                cn(
                  'relative flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 px-1 py-2 text-[11px] font-medium',
                  isActive ? 'text-primary' : 'text-muted-foreground'
                )
              }
            >
              <span className="relative">
                <item.icon className="size-5" />
                {'badgeKey' in item && item.badgeKey === 'inbox' && inboxCount > 0 ? (
                  <span className="absolute -right-2 -top-1 inline-flex min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[9px] font-semibold leading-4 text-primary-foreground">
                    {inboxCount > 9 ? '9+' : inboxCount}
                  </span>
                ) : null}
              </span>
              {item.label}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  )
}
