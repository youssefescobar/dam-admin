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

export async function api<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers = new Headers(options.headers)
  if (options.body !== undefined) {
    headers.set('Content-Type', 'application/json')
  }
  if (options.auth !== false) {
    const token = getToken()
    if (token) headers.set('Authorization', `Bearer ${token}`)
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  })

  if (res.status === 204) {
    return undefined as T
  }

  const data = await res.json().catch(() => ({}))

  if (!res.ok) {
    if (res.status === 401 && options.auth !== false) {
      clearSession()
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

export function apiBaseUrl() {
  return API_BASE || window.location.origin
}
