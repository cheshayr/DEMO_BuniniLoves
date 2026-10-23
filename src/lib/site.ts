import { supabase, isSupabaseConfigured } from './supabase'
import { safeUrl } from './community'

/* ----------------------------------------------------------------------------
   Owner-editable site content. Everything is stored in `store_settings`
   (public read, admin write). Any field the owner leaves blank falls back to
   the built-in default, so the storefront can never end up with an empty hero.
---------------------------------------------------------------------------- */

export interface SectionText { enabled: boolean; eyebrow: string; title: string }
export interface HomeSettings {
  hero: { eyebrow: string; headline: string; accent: string; body: string; primary_label: string; primary_link: string; secondary_label: string; secondary_link: string; image_url: string }
  meet: { enabled: boolean; eyebrow: string; title: string; body: string; cta_label: string; cta_link: string; image_url: string }
  collections: SectionText
  featured: SectionText
  events: SectionText
  reviews: SectionText
}
export interface PromoBanner { enabled: boolean; title: string; text: string; cta: string; link: string }
export interface Socials { instagram: string; facebook: string; tiktok: string; shopee: string; lazada: string; youtube: string; website: string }
export interface Pinned { products: string[]; reviews: string[] }
export interface CurrencySettings { enabled: boolean; /** Units of each currency per 1 PHP, e.g. { USD: 0.0172 }. */ rates: Record<string, number>; updated_at: string | null }

export interface SiteSettings { home: HomeSettings; promo: PromoBanner; socials: Socials; pinned: Pinned; currency: CurrencySettings }

export const DEFAULT_HOME: HomeSettings = {
  hero: {
    eyebrow: 'stationery boutique · philippines', headline: 'little things,\nlots of love', accent: 'love',
    body: 'Stickers, notebooks, stationery and tiny treasures designed to make every page, planner and desk a little happier.',
    primary_label: 'Shop now', primary_link: '/shop', secondary_label: 'See upcoming events', secondary_link: '/events', image_url: '',
  },
  meet: {
    enabled: true, eyebrow: 'meet bunini', title: 'hi! we make tiny things with lots of love',
    body: 'Every sticker, notebook and stationery set is picked with care, then packed by hand. Come say hello at our next bazaar!',
    cta_label: 'About us', cta_link: '/about', image_url: '',
  },
  collections: { enabled: true, eyebrow: 'browse', title: 'featured collections' },
  featured: { enabled: true, eyebrow: 'favorites', title: 'featured picks' },
  events: { enabled: true, eyebrow: 'come say hi', title: 'upcoming bazaars & expos' },
  reviews: { enabled: true, eyebrow: 'kind words', title: 'loved by our customers' },
}
export const DEFAULT_PROMO: PromoBanner = { enabled: false, title: '', text: '', cta: 'Shop now', link: '/shop' }
export const DEFAULT_SOCIALS: Socials = { instagram: 'https://www.instagram.com/bunini_loves/', facebook: '', tiktok: '', shopee: '', lazada: '', youtube: '', website: '' }
export const DEFAULT_PINNED: Pinned = { products: [], reviews: [] }
export const DEFAULT_CURRENCY: CurrencySettings = { enabled: false, rates: {}, updated_at: null }
export const DEFAULT_SITE: SiteSettings = { home: DEFAULT_HOME, promo: DEFAULT_PROMO, socials: DEFAULT_SOCIALS, pinned: DEFAULT_PINNED, currency: DEFAULT_CURRENCY }

/* ---------- link & image safety ---------- */

/** Internal path ("/shop") or https link; anything else (javascript:, data:, //evil) is rejected. */
export const isSafeLink = (l: string) => /^(\/(?!\/)[^\s]*|https:\/\/[^\s]+)$/.test(l.trim())
export const safeLink = (l: string | undefined | null, fallback = '/'): string => (l && isSafeLink(l) ? l.trim() : fallback)
export const isExternal = (l: string) => /^https?:\/\//i.test(l)
/** Image sources must be a site path or an http(s) URL. */
export const safeImage = (u: string | undefined | null, fallback = ''): string => (u && (/^\/(?!\/)[^\s]*$/.test(u.trim()) || safeUrl(u)) ? u.trim() : fallback)

/* ---------- merging (tolerant of missing / malformed saved data) ---------- */

const str = (v: unknown, d: string) => (typeof v === 'string' ? v : d)
/** Text the owner left blank falls back to the default. */
const text = (v: unknown, d: string) => (typeof v === 'string' && v.trim() ? v : d)
const bool = (v: unknown, d: boolean) => (typeof v === 'boolean' ? v : d)
const obj = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {})
const ids = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string').slice(0, 24) : [])

function section(v: unknown, d: SectionText): SectionText {
  const o = obj(v)
  return { enabled: bool(o.enabled, d.enabled), eyebrow: str(o.eyebrow, d.eyebrow), title: text(o.title, d.title) }
}

export function mergeHome(v: unknown): HomeSettings {
  const o = obj(v), h = obj(o.hero), m = obj(o.meet), D = DEFAULT_HOME
  return {
    hero: {
      eyebrow: str(h.eyebrow, D.hero.eyebrow), headline: text(h.headline, D.hero.headline), accent: str(h.accent, D.hero.accent), body: text(h.body, D.hero.body),
      primary_label: text(h.primary_label, D.hero.primary_label), primary_link: safeLink(str(h.primary_link, ''), D.hero.primary_link),
      secondary_label: str(h.secondary_label, D.hero.secondary_label), secondary_link: safeLink(str(h.secondary_link, ''), D.hero.secondary_link),
      image_url: safeImage(str(h.image_url, '')),
    },
    meet: {
      enabled: bool(m.enabled, D.meet.enabled), eyebrow: str(m.eyebrow, D.meet.eyebrow), title: text(m.title, D.meet.title), body: str(m.body, D.meet.body),
      cta_label: str(m.cta_label, D.meet.cta_label), cta_link: safeLink(str(m.cta_link, ''), D.meet.cta_link), image_url: safeImage(str(m.image_url, '')),
    },
    collections: section(o.collections, D.collections), featured: section(o.featured, D.featured), events: section(o.events, D.events), reviews: section(o.reviews, D.reviews),
  }
}
export function mergePromo(v: unknown): PromoBanner {
  const o = obj(v)
  return { enabled: bool(o.enabled, false), title: str(o.title, ''), text: str(o.text, ''), cta: str(o.cta, 'Shop now'), link: safeLink(str(o.link, ''), '/shop') }
}
export function mergeSocials(v: unknown, legacyInstagram?: string): Socials {
  const o = obj(v)
  const pick = (k: keyof Socials, d: string) => safeUrl(str(o[k], d)) ?? ''
  return {
    instagram: pick('instagram', legacyInstagram && safeUrl(legacyInstagram) ? legacyInstagram : DEFAULT_SOCIALS.instagram),
    facebook: pick('facebook', ''), tiktok: pick('tiktok', ''), shopee: pick('shopee', ''), lazada: pick('lazada', ''), youtube: pick('youtube', ''), website: pick('website', ''),
  }
}
export function mergePinned(v: unknown): Pinned { const o = obj(v); return { products: ids(o.products), reviews: ids(o.reviews) } }
export function mergeCurrency(v: unknown): CurrencySettings {
  const o = obj(v), rates: Record<string, number> = {}
  for (const [code, rate] of Object.entries(obj(o.rates))) {
    if (/^[A-Z]{3}$/.test(code) && typeof rate === 'number' && Number.isFinite(rate) && rate > 0) rates[code] = rate
  }
  return { enabled: bool(o.enabled, false), rates, updated_at: typeof o.updated_at === 'string' ? o.updated_at : null }
}

/* ---------- reading & writing ---------- */

const KEYS = ['homepage', 'promo_banner', 'socials', 'pinned', 'currency', 'contact']

export async function fetchSiteSettings(): Promise<SiteSettings> {
  if (!isSupabaseConfigured) return DEFAULT_SITE
  const { data, error } = await supabase.from('store_settings').select('key, value').in('key', KEYS)
  if (error) return DEFAULT_SITE // the storefront must keep working even if settings can't load
  const map = new Map<string, unknown>((data ?? []).map((r: { key: string; value: unknown }): [string, unknown] => [r.key, r.value]))
  return {
    home: mergeHome(map.get('homepage')), promo: mergePromo(map.get('promo_banner')),
    socials: mergeSocials(map.get('socials'), str(obj(map.get('contact')).instagram, '')),
    pinned: mergePinned(map.get('pinned')), currency: mergeCurrency(map.get('currency')),
  }
}