import { NavLink, Outlet, Navigate } from 'react-router-dom'
import { BookOpen, Bot, Inbox, LogOut, Moon, Sun, Table2, Activity } from 'lucide-react'
import { useTheme } from 'next-themes'
import { useAuth } from '@/features/auth/auth-context'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { PushNotificationsToggle } from '@/components/layout/push-notifications-toggle'
import { cn } from '@/lib/utils'

const nav = [
  { to: '/quotes', label: 'Quotes', icon: Table2 },
  { to: '/inbox', label: 'Inbox', icon: Inbox },
  { to: '/kb', label: 'Knowledge', icon: BookOpen },
  { to: '/ai', label: 'AI', icon: Bot },
]

export function AppShell() {
  const { token, admin, logout } = useAuth()
  const { theme, setTheme } = useTheme()

  if (!token) return <Navigate to="/login" replace />

  return (
    <div className="flex h-svh overflow-hidden bg-background">
      <aside className="flex w-60 shrink-0 flex-col overflow-y-auto border-r border-sidebar-border bg-sidebar text-sidebar-foreground">
        <div className="flex items-center gap-3 px-4 py-5">
          <img
            src="/image.png"
            alt="DAMAC"
            className="mt-1 size-11 rounded-md object-contain object-center"
          />
          <div className="min-w-0">
            <div className="text-lg font-semibold tracking-tight">DAMAC</div>
            <p className="text-xs leading-snug text-muted-foreground">
              Durrah Al Munawwara admin console
            </p>
          </div>
        </div>
        <Separator />
        <nav className="flex flex-1 flex-col gap-1 p-3">
          {nav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
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
      </aside>
      <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <Outlet />
      </main>
    </div>
  )
}
