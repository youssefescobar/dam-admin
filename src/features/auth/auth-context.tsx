import { createContext, useContext, useEffect, useMemo, useState, useCallback, type ReactNode } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { getAdmin, getToken, setSession, clearSession, type AdminUser } from '@/lib/auth'
import { api, SESSION_EXPIRED_EVENT } from '@/lib/api'
import { disablePushNotifications } from '@/lib/push'
import { disconnectSocket } from '@/lib/socket'

type AuthContextValue = {
  token: string | null
  admin: AdminUser | null
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  replaceToken: (token: string) => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => getToken())
  const [admin, setAdmin] = useState<AdminUser | null>(() => getAdmin())

  const login = useCallback(async (email: string, password: string) => {
    const data = await api<{
      token: string
      admin: { id: string; name: string; email: string; role: string }
    }>('/auth/login', {
      method: 'POST',
      auth: false,
      body: { email, password },
    })
    const user: AdminUser = {
      id: String(data.admin.id),
      name: data.admin.name,
      email: data.admin.email,
      role: data.admin.role,
    }
    setSession(data.token, user)
    setToken(data.token)
    setAdmin(user)
  }, [])

  const queryClient = useQueryClient()

  // Local sign-out: forget the token, drop the socket and every cached list so the next login starts clean.
  const endSession = useCallback(() => {
    clearSession()
    disconnectSocket()
    queryClient.clear()
    setToken(null)
    setAdmin(null)
  }, [queryClient])

  const logout = useCallback(async () => {
    // Alerts belong to the person, not the device: stop them before the token goes.
    await disablePushNotifications().catch(() => {})
    endSession()
  }, [endSession])

  /** After a password change: this device keeps working with the fresh token. */
  const replaceToken = useCallback((next: string) => {
    const current = getAdmin()
    if (current) setSession(next, current)
    setToken(next)
  }, [])

  useEffect(() => {
    // Without a valid token we can't tell the server to drop this device's alerts; the next login reuses them.
    const onExpired = () => {
      endSession()
      toast.message('Your session ended. Please sign in again.', { id: 'session-expired' })
    }
    window.addEventListener(SESSION_EXPIRED_EVENT, onExpired)
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, onExpired)
  }, [endSession])

  const value = useMemo(
    () => ({ token, admin, login, logout, replaceToken }),
    [token, admin, login, logout, replaceToken]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// The hook lives beside its provider on purpose; fast refresh just reloads this file.
// oxlint-disable-next-line react/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
