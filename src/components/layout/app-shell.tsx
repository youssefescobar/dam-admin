import { useEffect, useState } from 'react'
import { NavLink, Outlet, Navigate } from 'react-router-dom'
import {
  Activity,
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
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { PushNotificationsToggle } from '@/components/layout/push-notifications-toggle'
import { PwaInstallBanner } from '@/components/layout/pwa-install-banner'
import { cn } from '@/lib/utils'

const nav = [
  { to: '/quotes', label: 'Quotes', icon: Table2 },
  { to: '/inbox', label: 'Inbox', icon: Inbox },
  { to: '/kb', label: 'Knowledge', icon: BookOpen },
  { to: '/ai', label: 'AI', icon: Bot },
]

function BrandBlock({ compact = false }: { compact?: boolean }) {
  return (
    <div className={cn('flex items-center gap-3', compact && 'gap-2')}>
      <img
        src="/image.png"
        alt="DAMAC"
        className={cn(
          'rounded-md object-contain object-center',
          compact ? 'mt-0.5 size-8' : 'mt-1 size-11'
        )}
      />
      <div className="min-w-0">
        <div className={cn('font-semibold tracking-tight', compact ? 'text-base' : 'text-lg')}>
          DAMAC
        </div>
        {!compact && (
          <p className="text-xs leading-snug text-muted-foreground">
            Durrah Al Munawwara admin console
          </p>
        )}
      </div>
    </div>
  )
}

function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const { admin, logout } = useAuth()
  const { theme, setTheme } = useTheme()

  return (
    <>
      <nav className="flex flex-1 flex-col gap-1 p-3">
        {nav.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            onClick={onNavigate}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                  : 'text-sidebar-foreground/80 hover:bg-sidebar-accent/70'
              )
            }
          >
            <item.icon className="size-4" />
            {item.label}
          </NavLink>
        ))}
        <a
          href={`${import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:3000'}/health`}
          target="_blank"
          rel="noreferrer"
          className="mt-2 flex items-center gap-2 rounded-md px-3 py-2 text-sm text-sidebar-foreground/70 hover:bg-sidebar-accent/70"
        >
          <Activity className="size-4" />
          API health
        </a>
      </nav>
      <div className="space-y-2 border-t border-sidebar-border p-3">
        <div className="truncate px-2 text-xs text-muted-foreground">{admin?.email}</div>
        <PushNotificationsToggle />
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="icon"
            className="shrink-0"
            type="button"
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          >
            {theme === 'dark' ? <Sun /> : <Moon />}
          </Button>
          <Button variant="outline" className="flex-1" type="button" onClick={logout}>
            <LogOut />
            Logout
          </Button>
        </div>
      </div>
    </>
  )
}

export function AppShell() {
  const { token } = useAuth()
  const [menuOpen, setMenuOpen] = useState(false)

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
    <div className="flex h-svh flex-col overflow-hidden bg-background">
      <PwaInstallBanner className="shrink-0 md:hidden" />

      {/* Mobile top bar */}
      <header className="flex shrink-0 items-center justify-between gap-2 border-b px-3 py-2 md:hidden">
        <BrandBlock compact />
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label={menuOpen ? 'Close menu' : 'Open menu'}
          onClick={() => setMenuOpen((o) => !o)}
        >
          {menuOpen ? <X /> : <Menu />}
        </Button>
      </header>

      {/* Mobile drawer */}
      {menuOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-black/40"
            aria-label="Close menu"
            onClick={() => setMenuOpen(false)}
          />
          <aside className="absolute inset-y-0 right-0 flex w-[min(20rem,88vw)] flex-col bg-sidebar text-sidebar-foreground shadow-xl animate-fade-in">
            <div className="flex items-center justify-between gap-2 px-4 py-4">
              <BrandBlock compact />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="text-sidebar-foreground"
                onClick={() => setMenuOpen(false)}
              >
                <X />
              </Button>
            </div>
            <Separator />
            <SidebarNav onNavigate={() => setMenuOpen(false)} />
          </aside>
        </div>
      )}

      <div className="flex min-h-0 flex-1 overflow-hidden">
        {/* Desktop sidebar */}
        <aside className="hidden w-60 shrink-0 flex-col overflow-y-auto border-r border-sidebar-border bg-sidebar text-sidebar-foreground md:flex">
          <div className="flex items-center gap-3 px-4 py-5">
            <BrandBlock />
          </div>
          <Separator />
          <SidebarNav />
        </aside>

        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          <PwaInstallBanner className="hidden shrink-0 md:flex" />
          <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden pb-[calc(3.75rem+env(safe-area-inset-bottom))] md:pb-0">
            <Outlet />
          </main>
        </div>
      </div>

      {/* Mobile bottom tabs */}
      <nav className="fixed inset-x-0 bottom-0 z-40 flex border-t bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
        {nav.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              cn(
                'flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] font-medium',
                isActive ? 'text-primary' : 'text-muted-foreground'
              )
            }
          >
            <item.icon className="size-5" />
            {item.label}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
