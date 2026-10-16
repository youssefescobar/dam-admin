import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

const sar = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 })

/** Quote prices are in Saudi riyals, e.g. "SAR 12,500". */
export function formatSar(amount: number) {
  return `SAR ${sar.format(amount)}`
}
