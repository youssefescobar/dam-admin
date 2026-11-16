import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

const SITE_URL = (import.meta.env.VITE_SITE_URL || 'https://www.munawwara.com').replace(/\/$/, '')

/** Preview URL for an image the public website serves (`/fleet/…`). Never use it for stored values. */
export const siteAsset = (url: string) => (url.startsWith('/') ? SITE_URL + url : url)

/** Admin uploads can be a video (mp4/webm) in place of an image. */
export const isVideo = (url: string) => /\.(mp4|webm)(\?|#|$)/i.test(url)

/** "New Fleet 2026!" -> "new-fleet-2026": a web-address-safe ID. */
export const slugify = (text: string) =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
