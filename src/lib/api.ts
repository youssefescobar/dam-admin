import { getToken, clearSession } from '@/lib/auth'

const API_BASE = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '')

export class ApiError extends Error {
  status: number
  fields?: Record<string, string>

  constructor(status: number, message: string, fields?: Record<string, string>) {
    super(message)
    this.status = status
    this.fields = fields
  }
}

type RequestOptions = Omit<RequestInit, 'body'> & {
  body?: unknown
  auth?: boolean
}

/** Fired when the server rejects our login token; AuthProvider signs out and the shell goes to /login. */
export const SESSION_EXPIRED_EVENT = 'damac:session-expired'

/** A request that hangs longer than this fails, so buttons never stay disabled forever. */
const REQUEST_TIMEOUT_MS = 20_000

export async function api<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers = new Headers(options.headers)
  if (options.body !== undefined) {
    headers.set('Content-Type', 'application/json')
  }
  if (options.auth !== false) {
    const token = getToken()
    if (token) headers.set('Authorization', `Bearer ${token}`)
  }

  let res: Response
  try {
    res = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      signal: options.signal ?? AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    })
  } catch (err) {
    const timedOut = err instanceof DOMException && err.name === 'TimeoutError'
    throw new ApiError(0, timedOut ? 'The server took too long to answer. Try again.' : 'Can’t reach the server. Check your connection and try again.')
  }

  if (res.status === 204) {
    return undefined as T
  }

  const data = await res.json().catch(() => ({}))

  if (!res.ok) {
    if (res.status === 401 && options.auth !== false) {
      clearSession()
      window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT))
    }
    throw new ApiError(res.status, data.error || res.statusText, data.fields)
  }

  return data as T
}

/**
 * Shrink a photo before upload: longest side 2000px, re-encoded as WebP (~80% quality).
 * A phone photo goes from ~5 MB to a few hundred KB. GIFs keep their animation; if the
 * browser can't encode WebP or the result isn't smaller, the original is kept.
 */
async function shrinkImage(file: File): Promise<File> {
  if (!/^image\/(jpeg|png|webp|avif)$/.test(file.type)) return file
  try {
    const bitmap = await createImageBitmap(file)
    const scale = Math.min(1, 2000 / Math.max(bitmap.width, bitmap.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(bitmap.width * scale)
    canvas.height = Math.round(bitmap.height * scale)
    canvas.getContext('2d')?.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    bitmap.close()
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/webp', 0.8))
    if (!blob || blob.type !== 'image/webp' || blob.size >= file.size) return file
    return new File([blob], file.name.replace(/\.\w+$/, '.webp'), { type: 'image/webp' })
  } catch {
    return file
  }
}

/** Upload a file straight to storage (Cloudflare R2) and return its public URL. */
export async function uploadFile(original: File): Promise<string> {
  const file = await shrinkImage(original)
  const { uploadUrl, headers, url } = await api<{
    uploadUrl: string
    headers: Record<string, string>
    url: string
  }>('/uploads', { method: 'POST', body: { contentType: file.type, size: file.size } })
  const res = await fetch(uploadUrl, { method: 'PUT', headers, body: file })
  if (!res.ok) throw new ApiError(res.status, 'Upload failed, please try again')
  return url
}

/** Download a customer's private file (CV, photo) through a short-lived link; it's sent as an attachment. */
export async function downloadPrivateFile(file: { key: string; name?: string }) {
  const qs = new URLSearchParams({ key: file.key, name: file.name || '' })
  const { url } = await api<{ url: string }>(`/uploads/private?${qs}`)
  const a = document.createElement('a')
  a.href = url
  a.rel = 'noopener'
  a.click()
}

export function apiBaseUrl() {
  return API_BASE || window.location.origin
}
