import { supabase } from './supabase'
import { friendlyRpcError } from './orders'
import type { Product, ProductImage } from './types'

interface DbError { message?: string; code?: string }
function fail(error: DbError): never { throw new Error(friendlyRpcError(error)) }

/* ---------- shared helpers ---------- */

export const IMAGE_TYPES: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }

/** Only plain http(s) links are ever rendered as links (blocks javascript: and data: URLs). */
export const safeUrl = (u: string | null | undefined): string | null => (u && /^https?:\/\/\S+$/i.test(u.trim()) ? u.trim() : null)

const PH = 'Asia/Manila'

/** "Sat, Nov 8 · 10:00 AM – 8:00 PM" for one-day events, "Nov 8 – Nov 10, 2026" for multi-day ones (Philippine time). */
export function formatEventWhen(startIso: string, endIso: string): { date: string; time: string } {
  const s = new Date(startIso)
  const e = new Date(endIso)
  const day = (d: Date, o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat('en-PH', { timeZone: PH, ...o }).format(d)
  const sameDay = day(s, { dateStyle: 'short' }) === day(e, { dateStyle: 'short' })
  const time = `${day(s, { timeStyle: 'short' })} – ${day(e, { timeStyle: 'short' })}`
  return sameDay
    ? { date: day(s, { weekday: 'short', month: 'long', day: 'numeric', year: 'numeric' }), time }
    : { date: `${day(s, { month: 'short', day: 'numeric' })} – ${day(e, { month: 'short', day: 'numeric', year: 'numeric' })}`, time }
}

/** <input type="datetime-local"> value for an ISO time, shown in Philippine time. */
export function toDateTimeLocal(iso: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: PH, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(iso))
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '00'
  return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}`
}
/** The reverse: a datetime-local value is read as Philippine time. */
export const fromDateTimeLocal = (v: string): string | null => {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(v)) return null
  const d = new Date(`${v}:00+08:00`)
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}

/* ---------- news ---------- */

export interface NewsPost {
  id: string; slug: string; title: string; category: string; cover_url: string | null; content: string
  status: 'draft' | 'published' | 'archived'; is_pinned: boolean; published_at: string | null; created_at: string
}

export const NEWS_CATEGORIES = ['news', 'restock', 'bazaar', 'promo', 'behind the scenes'] as const

export async function fetchNews(): Promise<NewsPost[]> {
  const { data, error } = await supabase.from('announcements').select('*').eq('status', 'published')
    .order('is_pinned', { ascending: false }).order('published_at', { ascending: false }).limit(60)
  if (error) fail(error)
  return (data ?? []) as NewsPost[]
}

export async function fetchPost(slug: string): Promise<NewsPost | null> {
  const { data, error } = await supabase.from('announcements').select('*').eq('slug', slug).eq('status', 'published').maybeSingle()
  if (error) fail(error)
  return (data as NewsPost | null) ?? null
}

/* ---------- events ---------- */

export interface EventFull {
  id: string; slug: string; name: string; starts_at: string; ends_at: string; venue: string; address: string | null
  description: string; booth: string | null; poster_url: string | null; external_url: string | null; participation_info: string | null
  status: 'draft' | 'published' | 'archived'
}

export async function fetchEvents(): Promise<EventFull[]> {
  const { data, error } = await supabase.from('events').select('*').eq('status', 'published').order('starts_at', { ascending: true }).limit(100)
  if (error) fail(error)
  return (data ?? []) as EventFull[]
}

export async function fetchEvent(slug: string): Promise<EventFull | null> {
  const { data, error } = await supabase.from('events').select('*').eq('slug', slug).eq('status', 'published').maybeSingle()
  if (error) fail(error)
  return (data as EventFull | null) ?? null
}

/* ---------- calendar export ---------- */

const icsTime = (iso: string) => new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
const icsText = (s: string) => s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n')
/** RFC 5545 line folding (kept conservative so multi-byte characters never get split past 75 octets). */
const fold = (line: string) => {
  const chunks: string[] = []
  let rest = [...line]
  while (rest.length > 60) { chunks.push(rest.slice(0, 60).join('')); rest = rest.slice(60) }
  chunks.push(rest.join(''))
  return chunks.join('\r\n ')
}

export function buildIcs(e: EventFull, pageUrl: string): string {
  const where = [e.venue, e.address].filter(Boolean).join(', ')
  const lines = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Bunini Loves//Events//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${e.id}@bunini-loves`,
    `DTSTAMP:${icsTime(new Date().toISOString())}`,
    `DTSTART:${icsTime(e.starts_at)}`,
    `DTEND:${icsTime(e.ends_at)}`,
    `SUMMARY:${icsText(e.name)}`,
    `LOCATION:${icsText(where)}`,
    `DESCRIPTION:${icsText([e.booth ? `Booth: ${e.booth}` : '', e.description, pageUrl].filter(Boolean).join('\n\n'))}`,
    `URL:${pageUrl}`,
    'END:VEVENT', 'END:VCALENDAR',
  ]
  return lines.map(fold).join('\r\n') + '\r\n'
}

export function downloadIcs(e: EventFull, pageUrl: string) {
  const blob = new Blob([buildIcs(e, pageUrl)], { type: 'text/calendar;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${e.slug}.ics`
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function googleCalendarUrl(e: EventFull, pageUrl: string): string {
  const q = new URLSearchParams({
    action: 'TEMPLATE', text: e.name, dates: `${icsTime(e.starts_at)}/${icsTime(e.ends_at)}`,
    details: [e.booth ? `Booth: ${e.booth}` : '', e.description, pageUrl].filter(Boolean).join('\n\n'),
    location: [e.venue, e.address].filter(Boolean).join(', '),
  })
  return `https://calendar.google.com/calendar/render?${q.toString()}`
}

/* ---------- wishlist ---------- */

export async function fetchWishlistProducts(): Promise<Product[]> {
  const { data: rows, error } = await supabase.from('wishlist_items').select('product_id').order('created_at', { ascending: false })
  if (error) fail(error)
  const ids = ((rows ?? []) as { product_id: string }[]).map((r) => r.product_id)
  if (!ids.length) return []
  const { data, error: e2 } = await supabase.from('catalog_products').select('*').eq('status', 'published').in('id', ids)
  if (e2) fail(e2)
  const products = (data ?? []) as Omit<Product, 'images'>[]
  const { data: imgs } = await supabase.from('product_images').select('*').in('product_id', products.map((p) => p.id)).order('sort_order')
  const byProduct = new Map<string, ProductImage[]>()
  ;(imgs as ProductImage[] | null)?.forEach((i) => byProduct.set(i.product_id, [...(byProduct.get(i.product_id) ?? []), i]))
  // keep the order the customer saved them in
  return products.map((p) => ({ ...p, images: byProduct.get(p.id) ?? [] })).sort((a, b) => ids.indexOf(a.id) - ids.indexOf(b.id))
}

/* ---------- customer reviews ---------- */

export interface ReviewableItem { id: string; product_id: string; product_name: string; variant_name: string | null; order_number: string }
export interface MyReview {
  id: string; product_id: string; order_item_id: string; rating: number; body: string; photo_path: string | null
  is_hidden: boolean; admin_reply: string | null; created_at: string; product_name: string
}

export const MAX_REVIEW_PHOTO = 3 * 1024 * 1024

export async function fetchMyReviewData(userId: string): Promise<{ pending: ReviewableItem[]; mine: MyReview[] }> {
  const [items, reviews] = await Promise.all([
    supabase.from('order_items').select('id, product_id, product_name, variant_name, orders!inner(order_number, status)').eq('orders.status', 'delivered'),
    supabase.from('reviews').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
  ])
  if (items.error) fail(items.error)
  if (reviews.error) fail(reviews.error)
  type Item = { id: string; product_id: string; product_name: string; variant_name: string | null; orders: { order_number: string } | { order_number: string }[] }
  const all = ((items.data ?? []) as Item[]).map((i) => ({
    id: i.id, product_id: i.product_id, product_name: i.product_name, variant_name: i.variant_name,
    order_number: Array.isArray(i.orders) ? (i.orders[0]?.order_number ?? '') : i.orders.order_number,
  }))
  const names = new Map(all.map((i) => [i.id, i.product_name]))
  const rows = (reviews.data ?? []) as Omit<MyReview, 'product_name'>[]
  const done = new Set(rows.map((r) => r.order_item_id))
  return {
    pending: all.filter((i) => !done.has(i.id)),
    mine: rows.map((r) => ({ ...r, product_name: names.get(r.order_item_id) ?? 'Product' })),
  }
}

export async function submitReview(a: { userId: string; item: ReviewableItem; rating: number; body: string; photo: File | null }) {
  let photoPath: string | null = null
  if (a.photo) {
    const ext = IMAGE_TYPES[a.photo.type]
    if (!ext) throw new Error('Please choose a JPG, PNG or WebP photo.')
    if (a.photo.size > MAX_REVIEW_PHOTO) throw new Error('Photos must be 3 MB or smaller.')
    photoPath = `${a.userId}/${crypto.randomUUID()}.${ext}`
    const up = await supabase.storage.from('review-photos').upload(photoPath, a.photo, { contentType: a.photo.type, upsert: false })
    if (up.error) throw new Error('Photo upload failed. Please try again.')
  }
  const { error } = await supabase.from('reviews').insert({
    product_id: a.item.product_id, user_id: a.userId, order_item_id: a.item.id, rating: a.rating, body: a.body.trim(), photo_path: photoPath,
  })
  if (error) {
    if (photoPath) await supabase.storage.from('review-photos').remove([photoPath])
    fail(error.code === '23505' ? { message: 'You already reviewed this item.' } : error.code === '42501' ? { message: 'You can review an item once your order has been delivered.' } : error)
  }
}

export async function deleteReview(r: { id: string; photo_path: string | null }) {
  const { error } = await supabase.from('reviews').delete().eq('id', r.id)
  if (error) fail(error)
  if (r.photo_path) await supabase.storage.from('review-photos').remove([r.photo_path])
}

/* ---------- admin: review moderation ---------- */

export interface AdminReview {
  id: string; product_id: string; rating: number; body: string; photo_path: string | null; is_hidden: boolean
  admin_reply: string | null; replied_at: string | null; created_at: string; user_id: string
  product_name: string; reviewer: string
}
export type ReviewFilter = 'all' | 'unanswered' | 'hidden'
export const REVIEW_PAGE = 20

export async function fetchAdminReviews(filter: ReviewFilter, page: number): Promise<{ rows: AdminReview[]; total: number }> {
  const from = (Math.max(1, page) - 1) * REVIEW_PAGE
  let q = supabase.from('reviews').select('*, products(name)', { count: 'exact' })
  if (filter === 'unanswered') q = q.is('admin_reply', null).eq('is_hidden', false)
  if (filter === 'hidden') q = q.eq('is_hidden', true)
  const { data, count, error } = await q.order('created_at', { ascending: false }).range(from, from + REVIEW_PAGE - 1)
  if (error) fail(error)
  type Row = Omit<AdminReview, 'product_name' | 'reviewer'> & { products: { name: string } | null }
  const rows = (data ?? []) as Row[]
  const names = new Map<string, string>()
  if (rows.length) {
    const { data: profs } = await supabase.from('profiles').select('id, full_name').in('id', [...new Set(rows.map((r) => r.user_id))])
    ;((profs ?? []) as { id: string; full_name: string }[]).forEach((p) => names.set(p.id, p.full_name))
  }
  return {
    rows: rows.map((r) => ({ ...r, product_name: r.products?.name ?? 'Deleted product', reviewer: names.get(r.user_id) || 'Customer' })),
    total: count ?? 0,
  }
}

export async function setReviewHidden(id: string, hidden: boolean) {
  const { error } = await supabase.from('reviews').update({ is_hidden: hidden }).eq('id', id)
  if (error) fail(error)
}

export async function replyToReview(id: string, reply: string) {
  const text = reply.trim()
  const { error } = await supabase.from('reviews').update({ admin_reply: text || null, replied_at: text ? new Date().toISOString() : null }).eq('id', id)
  if (error) fail(error)
}

/* ---------- admin: news & events ---------- */

export interface NewsInput { slug: string; title: string; category: string; cover_url: string | null; content: string; status: NewsPost['status']; is_pinned: boolean }
export interface EventInput {
  slug: string; name: string; starts_at: string; ends_at: string; venue: string; address: string | null; description: string
  booth: string | null; poster_url: string | null; external_url: string | null; participation_info: string | null; status: EventFull['status']
}

const dup = (e: DbError) => (e.code === '23505' ? { message: 'That URL name is already used. Pick another.' } : e)

export async function fetchAdminNews(): Promise<NewsPost[]> {
  const { data, error } = await supabase.from('announcements').select('*').order('created_at', { ascending: false })
  if (error) fail(error)
  return (data ?? []) as NewsPost[]
}
export async function saveNews(id: string | null, input: NewsInput) {
  const { error } = await (id ? supabase.from('announcements').update(input).eq('id', id) : supabase.from('announcements').insert(input))
  if (error) fail(dup(error))
}
export async function deleteNews(id: string) {
  const { error } = await supabase.from('announcements').delete().eq('id', id)
  if (error) fail(error)
}

export async function fetchAdminEvents(): Promise<EventFull[]> {
  const { data, error } = await supabase.from('events').select('*').order('starts_at', { ascending: false })
  if (error) fail(error)
  return (data ?? []) as EventFull[]
}
export async function saveEvent(id: string | null, input: EventInput) {
  const { error } = await (id ? supabase.from('events').update(input).eq('id', id) : supabase.from('events').insert(input))
  if (error) fail(dup(error))
}
export async function deleteEvent(id: string) {
  const { error } = await supabase.from('events').delete().eq('id', id)
  if (error) fail(error)
}

const COMMUNITY_MARKER = '/community/'
export async function uploadCommunityImage(folder: 'news' | 'events' | 'site', file: File): Promise<string> {
  const ext = IMAGE_TYPES[file.type]
  if (!ext) throw new Error('Please choose a JPG, PNG or WebP image.')
  if (file.size > 5 * 1024 * 1024) throw new Error('Images must be 5 MB or smaller.')
  const path = `${folder}/${crypto.randomUUID()}.${ext}`
  const up = await supabase.storage.from('community').upload(path, file, { contentType: file.type, cacheControl: '31536000', upsert: false })
  if (up.error) throw new Error('Upload failed. Please try again.')
  return supabase.storage.from('community').getPublicUrl(path).data.publicUrl
}
/** Best-effort cleanup of an image we uploaded earlier. */
export async function removeCommunityImage(url: string | null) {
  if (!url) return
  const at = url.indexOf(COMMUNITY_MARKER)
  if (at < 0) return
  await supabase.storage.from('community').remove([decodeURIComponent(url.slice(at + COMMUNITY_MARKER.length).split('?')[0])])
}
