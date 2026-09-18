import { createContext, useContext, useMemo, useState, useCallback, type ReactNode } from 'react'
import { getAdmin, getToken, setSession, clearSession, type AdminUser } from '@/lib/auth'
import { api } from '@/lib/api'
import { disconnectSocket } from '@/lib/socket'

type AuthContextValue = {
  token: string | null
  admin: AdminUser | null
  login: (email: string, password: string) => Promise<void>
  logout: () => void
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

  const logout = useCallback(() => {
    clearSession()
    disconnectSocket()
    setToken(null)
    setAdmin(null)
  }, [])

  const value = useMemo(() => ({ token, admin, login, logout }), [token, admin, login, logout])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
