import { supabase } from './supabase'
import { friendlyRpcError } from './orders'
import type { OrderItemRow, OrderRow, OrderStatus, PaymentMethod, PaymentStatus } from './orders'
import type { Category, Product, ProductImage, ProductVariant } from './types'

/* ----------------------------------------------------------------------------
   Everything here runs as the signed-in owner. Row Level Security and the
   security-definer functions in the database are what actually enforce
   "admin only"; the UI route guard is just a convenience.
---------------------------------------------------------------------------- */

interface DbError { message?: string; code?: string }
/** Always throw a real Error so useAsync can show the message. */
function fail(error: DbError): never { throw new Error(friendlyRpcError(error)) }

/* ---------- money & text helpers ---------- */

/** "149.50" -> 14950. Returns null for blank/invalid/negative input. */
export function pesosToCentavos(input: string): number | null {
  const s = input.trim().replace(/[₱,\s]/g, '')
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return null
  return Math.round(parseFloat(s) * 100)
}
export const centavosToPesos = (c: number | null | undefined) => (c == null ? '' : (c / 100).toFixed(2).replace(/\.00$/, ''))

export const slugify = (s: string) =>
  s.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80)

const safeTerm = (s: string) => s.replace(/[%,()*\\]/g, ' ').trim()

/** Date inputs are Philippine calendar days. */
const dayStart = (d: string) => new Date(`${d}T00:00:00+08:00`).toISOString()
const nextDayStart = (d: string) => new Date(new Date(`${d}T00:00:00+08:00`).getTime() + 86_400_000).toISOString()

/* ---------- dashboard ---------- */

export interface Dashboard {
  revenue_today: number; revenue_7d: number; revenue_30d: number
  orders_today: number
  by_status: Partial<Record<OrderStatus, number>>
  low_stock: number; out_of_stock: number; customers: number
  daily: { day: string; revenue: number; orders: number }[]
  top_products: { name: string; qty: number; revenue: number }[]
}

export async function fetchDashboard(): Promise<Dashboard> {
  const { data, error } = await supabase.rpc('admin_dashboard')
  if (error) fail(error)
  return data as Dashboard
}

export async function fetchRecentOrders(limit = 6): Promise<OrderRow[]> {
  const { data, error } = await supabase.from('orders').select('*').order('created_at', { ascending: false }).limit(limit)
  if (error) fail(error)
  return (data ?? []) as OrderRow[]
}

/* ---------- orders ---------- */

export const ADMIN_PAGE_SIZE = 20

export interface OrderFilters {
  /** 'todo' = paid or cash orders still to confirm, pack or ship (pending, processing, packed) */
  status?: OrderStatus | 'all' | 'todo'
  payment?: PaymentStatus | 'all'
  method?: PaymentMethod | 'all'
  q?: string
  from?: string // YYYY-MM-DD (PH time)
  to?: string
  page?: number
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function applyOrderFilters(query: any, f: OrderFilters) {
  if (f.status === 'todo') query = query.in('status', ['pending', 'processing', 'packed'])
  else if (f.status && f.status !== 'all') query = query.eq('status', f.status)
  if (f.payment && f.payment !== 'all') query = query.eq('payment_status', f.payment)
  if (f.method && f.method !== 'all') query = query.eq('payment_method', f.method)
  if (f.from) query = query.gte('created_at', dayStart(f.from))
  if (f.to) query = query.lt('created_at', nextDayStart(f.to))
  const t = f.q ? safeTerm(f.q) : ''
  if (t) query = query.or(`order_number.ilike.%${t}%,ship_name.ilike.%${t}%,ship_email.ilike.%${t}%,ship_phone.ilike.%${t}%`)
  return query
}

export async function fetchAdminOrders(f: OrderFilters): Promise<{ rows: OrderRow[]; total: number }> {
  const page = Math.max(1, f.page ?? 1)
  const from = (page - 1) * ADMIN_PAGE_SIZE
  const query = applyOrderFilters(supabase.from('orders').select('*', { count: 'exact' }), f)
    .order('created_at', { ascending: false }).range(from, from + ADMIN_PAGE_SIZE - 1)
  const { data, count, error } = await query
  if (error) fail(error)
  return { rows: (data ?? []) as OrderRow[], total: count ?? 0 }
}

type OrderWithItems = OrderRow & { order_items: Pick<OrderItemRow, 'product_name' | 'variant_name' | 'quantity'>[] }

/** Up to 5,000 orders matching the filters, with their line items, for the CSV export. */
export async function fetchOrdersForExport(f: OrderFilters): Promise<OrderWithItems[]> {
  const query = applyOrderFilters(supabase.from('orders').select('*, order_items(product_name, variant_name, quantity)'), f)
    .order('created_at', { ascending: false }).range(0, 4999)
  const { data, error } = await query
  if (error) fail(error)
  return (data ?? []) as OrderWithItems[]
}

export async function adminUpdateOrder(orderId: string, status: OrderStatus, note: string, courier: string, tracking: string) {
  const { error } = await supabase.rpc('admin_update_order', {
    p_order: orderId, p_status: status, p_note: note.trim() || null, p_courier: courier.trim() || null, p_tracking: tracking.trim() || null,
  })
  if (error) fail(error)
}

export async function adminVerifyPayment(orderId: string, approve: boolean, note: string) {
  const { error } = await supabase.rpc('admin_verify_payment', { p_order: orderId, p_approve: approve, p_note: note.trim() || null })
  if (error) fail(error)
}

/** Short-lived link to a customer's private payment proof. */
export async function signedProofUrl(path: string): Promise<string> {
  const { data, error } = await supabase.storage.from('payment-proofs').createSignedUrl(path, 300)
  if (error || !data?.signedUrl) throw new Error('Could not open the proof. It may have been removed.')
  return data.signedUrl
}

/* ---------- categories ---------- */

export interface AdminCategory extends Category { is_active: boolean }

export async function fetchAllCategories(): Promise<AdminCategory[]> {
  const { data, error } = await supabase.from('categories').select('*').order('sort_order').order('name')
  if (error) fail(error)
  return (data ?? []) as AdminCategory[]
}

export interface CategoryInput { name: string; slug: string; description: string | null; sort_order: number; is_active: boolean }

export async function saveCategory(id: string | null, input: CategoryInput) {
  const q = id ? supabase.from('categories').update(input).eq('id', id) : supabase.from('categories').insert(input)
  const { error } = await q
  if (error) fail(error.code === '23505' ? { message: 'That URL name is already used by another category.' } : error)
}

export async function deleteCategory(id: string) {
  const { error } = await supabase.from('categories').delete().eq('id', id)
  if (error) fail(error)
}

/* ---------- products ---------- */

export type ProductStatus = 'draft' | 'published' | 'archived'
export interface AdminProduct extends Product { status: ProductStatus; sku: string | null }

export interface ProductListQuery { q?: string; status?: ProductStatus | 'all'; categoryId?: string; page?: number }

export async function fetchAdminProducts(f: ProductListQuery): Promise<{ products: AdminProduct[]; total: number }> {
  const page = Math.max(1, f.page ?? 1)
  const from = (page - 1) * ADMIN_PAGE_SIZE
  let query = supabase.from('catalog_products').select('*', { count: 'exact' })
  if (f.status && f.status !== 'all') query = query.eq('status', f.status)
  if (f.categoryId) query = query.eq('category_id', f.categoryId)
  const t = f.q ? safeTerm(f.q) : ''
  if (t) query = query.or(`name.ilike.%${t}%,sku.ilike.%${t}%`)
  const { data, count, error } = await query.order('created_at', { ascending: false }).range(from, from + ADMIN_PAGE_SIZE - 1)
  if (error) fail(error)
  const rows = (data ?? []) as Omit<AdminProduct, 'images'>[]
  const byProduct = new Map<string, ProductImage[]>()
  if (rows.length) {
    const { data: imgs } = await supabase.from('product_images').select('*').in('product_id', rows.map((r) => r.id)).order('sort_order')
    ;(imgs as ProductImage[] | null)?.forEach((i) => byProduct.set(i.product_id, [...(byProduct.get(i.product_id) ?? []), i]))
  }
  return { products: rows.map((r) => ({ ...r, images: byProduct.get(r.id) ?? [] })), total: count ?? 0 }
}

export interface ProductRow {
  id: string; slug: string; name: string; description: string; specs: string | null; care_instructions: string | null
  category_id: string | null; tags: string[]; price_centavos: number; sale_price_centavos: number | null; sku: string | null
  stock: number; low_stock_threshold: number
  is_featured: boolean; is_new_arrival: boolean; is_best_seller: boolean; is_bundle: boolean; is_limited_edition: boolean
  status: ProductStatus
}

export async function fetchAdminProduct(id: string) {
  const [p, v, i] = await Promise.all([
    supabase.from('products').select('*').eq('id', id).maybeSingle(),
    supabase.from('product_variants').select('*').eq('product_id', id).order('sort_order').order('name'),
    supabase.from('product_images').select('*').eq('product_id', id).order('sort_order'),
  ])
  if (p.error) fail(p.error)
  if (!p.data) return null
  return { product: p.data as ProductRow, variants: (v.data ?? []) as ProductVariant[], images: (i.data ?? []) as ProductImage[] }
}

export type ProductInput = Omit<ProductRow, 'id' | 'stock'>

const duplicateMsg = (e: DbError) =>
  e.code === '23505' ? { message: 'That URL name or SKU is already used by another product.' } : e

/** New products start at 0 stock; any opening stock is recorded as an "initial" movement so the history is complete. */
export async function createProduct(input: ProductInput, initialStock: number): Promise<string> {
  const { data, error } = await supabase.from('products').insert({ ...input, stock: 0 }).select('id').single()
  if (error) fail(duplicateMsg(error))
  const id = (data as { id: string }).id
  if (initialStock > 0) {
    try {
      await adjustStock({ productId: id, variantId: null, delta: initialStock, reason: 'initial', note: 'Opening stock' })
    } catch (e) {
      await supabase.from('products').delete().eq('id', id) // don't leave a half-created product behind
      throw e
    }
  }
  return id
}

export async function updateProduct(id: string, input: ProductInput) {
  const { error } = await supabase.from('products').update(input).eq('id', id)
  if (error) fail(duplicateMsg(error))
}

export async function setProductStatus(id: string, status: ProductStatus) {
  const { error } = await supabase.from('products').update({ status }).eq('id', id)
  if (error) fail(error)
}

export async function deleteProduct(id: string) {
  const { data: imgs } = await supabase.from('product_images').select('url').eq('product_id', id)
  const { error } = await supabase.from('products').delete().eq('id', id)
  if (error) {
    // order_items keeps products that have been ordered (history safeguard)
    if (error.code === '23503') fail({ message: 'This product appears in past orders, so it can’t be deleted. Archive it instead.' })
    fail(error)
  }
  // the rows are gone (images cascade); clean up the files too, best effort
  const paths = ((imgs ?? []) as { url: string }[])
    .map((i) => { const at = i.url.indexOf(IMAGE_MARKER); return at >= 0 ? decodeURIComponent(i.url.slice(at + IMAGE_MARKER.length).split('?')[0]) : null })
    .filter((p): p is string => p !== null)
  if (paths.length) await supabase.storage.from('product-images').remove(paths)
}

/* ---------- variants ---------- */

export interface VariantInput { name: string; price_centavos: number | null; low_stock_threshold: number; is_active: boolean; sort_order: number }

export async function createVariant(productId: string, input: VariantInput, initialStock: number) {
  const { data, error } = await supabase.from('product_variants').insert({ ...input, product_id: productId, stock: 0 }).select('id').single()
  if (error) fail(error)
  const variantId = (data as { id: string }).id
  if (initialStock > 0) {
    try {
      await adjustStock({ productId, variantId, delta: initialStock, reason: 'initial', note: 'Opening stock' })
    } catch (e) {
      await supabase.from('product_variants').delete().eq('id', variantId)
      throw e
    }
  }
}

export async function updateVariant(id: string, input: VariantInput) {
  const { error } = await supabase.from('product_variants').update(input).eq('id', id)
  if (error) fail(error)
}

export async function deleteVariant(id: string) {
  const { error } = await supabase.from('product_variants').delete().eq('id', id)
  if (error) {
    if (error.code === '23503') fail({ message: 'This option appears in past orders, so it can’t be deleted. Turn it off instead.' })
    fail(error)
  }
}

/* ---------- product images ---------- */

export const IMAGE_TYPES: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024
const IMAGE_MARKER = '/product-images/'

export async function uploadProductImage(productId: string, file: File, sortOrder: number, alt: string): Promise<ProductImage> {
  const ext = IMAGE_TYPES[file.type]
  if (!ext) throw new Error('Please choose a JPG, PNG or WebP image.')
  if (file.size > MAX_IMAGE_BYTES) throw new Error('Images must be 5 MB or smaller.')
  // extension comes from the verified MIME type, never from the user's file name
  const path = `${productId}/${crypto.randomUUID()}.${ext}`
  const up = await supabase.storage.from('product-images').upload(path, file, { contentType: file.type, cacheControl: '31536000', upsert: false })
  if (up.error) throw new Error('Upload failed. Please try again.')
  const url = supabase.storage.from('product-images').getPublicUrl(path).data.publicUrl
  const { data, error } = await supabase.from('product_images').insert({ product_id: productId, url, alt: alt || null, sort_order: sortOrder }).select('*').single()
  if (error) {
    await supabase.storage.from('product-images').remove([path])
    fail(error)
  }
  return data as ProductImage
}

export async function deleteProductImage(img: ProductImage) {
  const { error } = await supabase.from('product_images').delete().eq('id', img.id)
  if (error) fail(error)
  const at = img.url.indexOf(IMAGE_MARKER)
  if (at >= 0) await supabase.storage.from('product-images').remove([decodeURIComponent(img.url.slice(at + IMAGE_MARKER.length).split('?')[0])])
}

/** Persists the given order (first image = cover). */
export async function saveImageOrder(images: ProductImage[]) {
  const results = await Promise.all(images.map((img, i) => supabase.from('product_images').update({ sort_order: i }).eq('id', img.id)))
  const failed = results.find((r) => r.error)
  if (failed?.error) fail(failed.error)
}

/* ---------- inventory ---------- */

export type MovementReason = 'order' | 'cancellation' | 'restock' | 'manual_adjustment' | 'correction' | 'damaged' | 'initial'
export const ADJUST_REASONS: { value: MovementReason; label: string }[] = [
  { value: 'restock', label: 'Restock (new stock arrived)' },
  { value: 'correction', label: 'Count correction' },
  { value: 'damaged', label: 'Damaged / lost' },
  { value: 'manual_adjustment', label: 'Other adjustment' },
]
export const REASON_LABEL: Record<MovementReason, string> = {
  order: 'Order', cancellation: 'Cancelled order', restock: 'Restock', manual_adjustment: 'Adjustment', correction: 'Correction', damaged: 'Damaged / lost', initial: 'Opening stock',
}

export interface StockRow {
  key: string
  productId: string
  variantId: string | null
  name: string
  variantName: string | null
  status: ProductStatus
  stock: number
  threshold: number
}

export async function fetchStockRows(): Promise<StockRow[]> {
  const [p, v] = await Promise.all([
    supabase.from('catalog_products').select('id, name, status, stock, low_stock_threshold, has_variants').neq('status', 'archived').order('name'),
    supabase.from('product_variants').select('id, product_id, name, stock, low_stock_threshold, is_active, sort_order').eq('is_active', true).order('sort_order').order('name'),
  ])
  if (p.error) fail(p.error)
  if (v.error) fail(v.error)
  type P = { id: string; name: string; status: ProductStatus; stock: number; low_stock_threshold: number; has_variants: boolean }
  type V = { id: string; product_id: string; name: string; stock: number; low_stock_threshold: number }
  const variants = (v.data ?? []) as V[]
  const rows: StockRow[] = []
  for (const prod of (p.data ?? []) as P[]) {
    if (prod.has_variants) {
      for (const x of variants.filter((vv) => vv.product_id === prod.id)) {
        rows.push({ key: x.id, productId: prod.id, variantId: x.id, name: prod.name, variantName: x.name, status: prod.status, stock: x.stock, threshold: x.low_stock_threshold })
      }
    } else {
      rows.push({ key: prod.id, productId: prod.id, variantId: null, name: prod.name, variantName: null, status: prod.status, stock: prod.stock, threshold: prod.low_stock_threshold })
    }
  }
  return rows
}

export async function adjustStock(a: { productId: string; variantId: string | null; delta: number; reason: MovementReason; note: string }) {
  const { error } = await supabase.rpc('admin_adjust_stock', {
    p_product: a.productId, p_variant: a.variantId, p_delta: a.delta, p_reason: a.reason, p_note: a.note.trim(),
  })
  if (error) fail(error)
}

/** Alert threshold lives on the product (or variant); changing it re-evaluates the open alerts via the database trigger. */
export async function setThreshold(row: Pick<StockRow, 'productId' | 'variantId'>, threshold: number) {
  const q = row.variantId
    ? supabase.from('product_variants').update({ low_stock_threshold: threshold }).eq('id', row.variantId)
    : supabase.from('products').update({ low_stock_threshold: threshold }).eq('id', row.productId)
  const { error } = await q
  if (error) fail(error)
}

export interface MovementRow {
  id: string; delta: number; stock_after: number; reason: MovementReason; note: string | null; created_at: string; order_id: string | null
  products: { name: string } | null
  product_variants: { name: string } | null
}

export const MOVEMENT_PAGE_SIZE = 25

export async function fetchMovements(page: number): Promise<{ rows: MovementRow[]; total: number }> {
  const from = (Math.max(1, page) - 1) * MOVEMENT_PAGE_SIZE
  const { data, count, error } = await supabase.from('inventory_movements')
    .select('id, delta, stock_after, reason, note, created_at, order_id, products(name), product_variants(name)', { count: 'exact' })
    .order('created_at', { ascending: false }).range(from, from + MOVEMENT_PAGE_SIZE - 1)
  if (error) fail(error)
  return { rows: (data ?? []) as unknown as MovementRow[], total: count ?? 0 }
}

/* ---------- notifications ---------- */

export interface NotificationRow {
  id: string; kind: 'low_stock' | 'out_of_stock' | 'new_order' | 'payment_submitted' | string
  title: string; body: string | null; product_id: string | null; order_id: string | null
  acknowledged_at: string | null; created_at: string
}

export async function fetchNotifications(limit = 30): Promise<NotificationRow[]> {
  const { data, error } = await supabase.from('notifications').select('*').order('created_at', { ascending: false }).limit(limit)
  if (error) fail(error)
  return (data ?? []) as NotificationRow[]
}

export async function acknowledgeNotification(id: string) {
  const { error } = await supabase.from('notifications').update({ acknowledged_at: new Date().toISOString() }).eq('id', id).is('acknowledged_at', null)
  if (error) fail(error)
}

export async function acknowledgeAllNotifications() {
  const { error } = await supabase.from('notifications').update({ acknowledged_at: new Date().toISOString() }).is('acknowledged_at', null)
  if (error) fail(error)
}

/* ---------- customers ---------- */

export interface CustomerRow {
  id: string; full_name: string; email: string; registered_at: string
  order_count: number; total_spent_centavos: number; last_order_at: string | null
}

export async function fetchCustomers(): Promise<CustomerRow[]> {
  const { data, error } = await supabase.rpc('admin_customers')
  if (error) fail(error)
  return (data ?? []) as CustomerRow[]
}

/* ---------- store settings ---------- */

export interface PaymentMethodSetting { enabled: boolean; instructions: string; account_name?: string; account_number?: string; bank?: string }
export type PaymentSettings = Record<'gcash' | 'maya' | 'bank_transfer' | 'cod' | 'card', PaymentMethodSetting>
export interface ShippingSetting { flat_centavos: number; free_over_centavos: number | null; estimate: string }
export interface AnnouncementSetting { enabled: boolean; text: string; link: string }
export interface ContactSetting { email: string; instagram: string }

export interface StoreSettings {
  announcement: AnnouncementSetting
  shipping: ShippingSetting
  payment_methods: PaymentSettings
  contact: ContactSetting
}

const DEFAULT_PAYMENTS: PaymentSettings = {
  gcash: { enabled: false, instructions: '', account_name: '', account_number: '' },
  maya: { enabled: false, instructions: '', account_name: '', account_number: '' },
  bank_transfer: { enabled: false, instructions: '', account_name: '', account_number: '', bank: '' },
  cod: { enabled: false, instructions: '' },
  card: { enabled: false, instructions: 'Requires a payment gateway integration (not yet connected).' },
}

export async function fetchSettings(): Promise<StoreSettings> {
  const { data, error } = await supabase.from('store_settings').select('key, value')
  if (error) fail(error)
  const map = new Map<string, unknown>((data ?? []).map((r: { key: string; value: unknown }): [string, unknown] => [r.key, r.value]))
  const pm = (map.get('payment_methods') ?? {}) as Partial<PaymentSettings>
  return {
    announcement: { enabled: false, text: '', link: '', ...(map.get('announcement') as object) },
    shipping: { flat_centavos: 0, free_over_centavos: null, estimate: '', ...(map.get('shipping') as object) },
    payment_methods: {
      gcash: { ...DEFAULT_PAYMENTS.gcash, ...pm.gcash },
      maya: { ...DEFAULT_PAYMENTS.maya, ...pm.maya },
      bank_transfer: { ...DEFAULT_PAYMENTS.bank_transfer, ...pm.bank_transfer },
      cod: { ...DEFAULT_PAYMENTS.cod, ...pm.cod },
      card: { ...DEFAULT_PAYMENTS.card, ...pm.card, enabled: false },
    },
    contact: { email: '', instagram: '', ...(map.get('contact') as object) },
  }
}

export async function saveSetting(key: keyof StoreSettings, value: unknown) {
  const { error } = await supabase.from('store_settings').upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: 'key' })
  if (error) fail(error)
}

/* ---------- discount codes ---------- */

export interface DiscountRow {
  id: string; code: string; percent_off: number | null; amount_off_centavos: number | null; min_subtotal_centavos: number
  max_uses: number | null; used_count: number; starts_at: string | null; ends_at: string | null; is_active: boolean
}
export type DiscountInput = Omit<DiscountRow, 'id' | 'used_count'>

export async function fetchDiscounts(): Promise<DiscountRow[]> {
  const { data, error } = await supabase.from('discount_codes').select('*').order('code')
  if (error) fail(error)
  return (data ?? []) as DiscountRow[]
}

export async function saveDiscount(id: string | null, input: DiscountInput) {
  const q = id ? supabase.from('discount_codes').update(input).eq('id', id) : supabase.from('discount_codes').insert(input)
  const { error } = await q
  if (error) fail(error.code === '23505' ? { message: 'That code already exists.' } : error)
}

export async function deleteDiscount(id: string) {
  const { error } = await supabase.from('discount_codes').delete().eq('id', id)
  if (error) fail(error)
}
