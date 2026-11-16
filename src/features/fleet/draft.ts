import type { FleetBus, FleetText, QuoteClass } from '@/lib/types'

/** Bus types the quote form knows. A bus links to one so "Request this bus" pre-selects it. */
export const QUOTE_CLASSES: { value: QuoteClass; label: string }[] = [
  { value: 'vip', label: 'VIP' },
  { value: 'premium_vip', label: 'Premium VIP' },
  { value: 'standard', label: 'Standard coach' },
  { value: 'coach', label: 'Coach' },
  { value: 'city_large', label: 'Large city bus' },
  { value: 'city', label: 'City / minibus' },
  { value: 'employee', label: 'Staff bus' },
]

export const LANGS = [
  { lang: 'en', label: 'English' },
  { lang: 'ar', label: 'العربية' },
  { lang: 'fr', label: 'Français' },
  { lang: 'id', label: 'Bahasa Indonesia' },
] as const
export type Lang = (typeof LANGS)[number]['lang']

/** Staff write English and Arabic; French and Indonesian are optional and fall back to English. */
export const MAIN_LANGS = LANGS.slice(0, 2)
export const EXTRA_LANGS = LANGS.slice(2)

export const MAX_PHOTOS = 20
export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

/** One language as the form edits it: amenities are one per line. */
export type DraftText = Omit<FleetText, 'amenities'> & { amenities: string }

export type Draft = {
  _id?: string
  slug: string
  quoteClass: QuoteClass
  published: boolean
  showInShowroom: boolean
  coverImage: string
  exteriorImages: string[]
  interiorImages: string[]
} & Record<Lang, DraftText>

export type PhotoKey = 'exteriorImages' | 'interiorImages'

const toDraftText = (t?: Partial<FleetText>): DraftText => ({
  name: t?.name || '',
  seatsLabel: t?.seatsLabel || '',
  summary: t?.summary || '',
  amenities: (t?.amenities || []).join('\n'),
})

export const emptyDraft = (): Draft => ({
  slug: '',
  quoteClass: 'vip',
  published: true,
  showInShowroom: true,
  coverImage: '',
  exteriorImages: [],
  interiorImages: [],
  en: toDraftText(),
  ar: toDraftText(),
  fr: toDraftText(),
  id: toDraftText(),
})

export const toDraft = (bus: FleetBus): Draft => ({
  _id: bus._id,
  slug: bus.slug,
  quoteClass: bus.quoteClass || 'vip',
  published: bus.published,
  showInShowroom: bus.showInShowroom,
  coverImage: bus.coverImage || '',
  exteriorImages: bus.exteriorImages || [],
  interiorImages: bus.interiorImages || [],
  en: toDraftText(bus.en),
  ar: toDraftText(bus.ar),
  fr: toDraftText(bus.fr),
  id: toDraftText(bus.id),
})

export const amenityList = (text: string) =>
  text
    .split('\n')
    .map((a) => a.trim())
    .filter(Boolean)

const toText = (t: DraftText): FleetText => ({
  name: t.name.trim(),
  seatsLabel: t.seatsLabel.trim(),
  summary: t.summary.trim(),
  amenities: amenityList(t.amenities),
})

/** Request body for POST /fleet and PUT /fleet/:id. */
export const toBody = (d: Draft) => ({
  slug: d.slug.trim(),
  quoteClass: d.quoteClass,
  published: d.published,
  showInShowroom: d.showInShowroom,
  coverImage: d.coverImage.trim(),
  exteriorImages: d.exteriorImages,
  interiorImages: d.interiorImages,
  en: toText(d.en),
  ar: toText(d.ar),
  fr: toText(d.fr),
  id: toText(d.id),
})

/** Display name in the admin: English, else Arabic, else the ID. */
export const busName = (bus: Pick<FleetBus, 'slug'> & Partial<Record<Lang, Partial<FleetText>>>) =>
  bus.en?.name || bus.ar?.name || bus.slug

export const photoCount = (d: Pick<Draft, 'coverImage' | PhotoKey>) =>
  new Set([d.coverImage, ...d.exteriorImages, ...d.interiorImages].filter(Boolean)).size
