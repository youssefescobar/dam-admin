export type AdminUser = {
  id: string
  name: string
  email: string
  role: string
}

const TOKEN_KEY = 'damic_admin_token'
const ADMIN_KEY = 'damic_admin_user'

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

export function getAdmin(): AdminUser | null {
  const raw = localStorage.getItem(ADMIN_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw) as AdminUser
  } catch {
    return null
  }
}

export function setSession(token: string, admin: AdminUser) {
  localStorage.setItem(TOKEN_KEY, token)
  localStorage.setItem(ADMIN_KEY, JSON.stringify(admin))
}

export function clearSession() {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(ADMIN_KEY)
}

export function isAuthenticated() {
  return Boolean(getToken())
}
