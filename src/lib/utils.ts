import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

const SITE_URL = (import.meta.env.VITE_SITE_URL || 'https://www.munawwara.com').replace(/\/$/, '')

/** Preview URL for an image the public website serves (`/fleet/…`). Never use it for stored values. */
export const siteAsset = (url: string) => (url.startsWith('/') ? SITE_URL + url : url)
