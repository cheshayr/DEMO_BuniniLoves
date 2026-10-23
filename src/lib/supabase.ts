/**
 * DEMO BACKEND. This file replaces the real database client in the public showcase.
 * It implements just enough of the Supabase API (queries, RPCs, auth, storage) on top of in-memory sample data,
 * so the storefront runs with no server, no keys and no private business logic. Data resets on refresh.
 */
import { CATEGORIES, DISCOUNT_ROWS, EVENTS, IMAGES, NEWS, PRODUCTS, REVIEWS, SETTINGS, VARIANTS } from './demoData'
import { ADMIN_EMAIL, ADMIN_PASSWORD, PROOF_PATH, PROOF_URL, buildAdminSeed } from './adminSeed'
import { areaForRegion, normalizeCouriers, shippingCost } from './shipping'

export const isSupabaseConfigured = true

export interface User { id: string; email: string; email_confirmed_at: string; user_metadata: Record<string, unknown> }
export interface Session { access_token: string; user: User }

type Row = Record<string, any>
const clone = <T>(v: T): T => (typeof structuredClone === 'function' ? structuredClone(v) : JSON.parse(JSON.stringify(v)))
const uuid = () => (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `id-${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`)
const nowIso = () => new Date().toISOString()

/* ---------- in-memory database ---------- */

const seed = buildAdminSeed()
const db: Record<string, Row[]> = {
  categories: clone(CATEGORIES), products: clone(PRODUCTS), product_variants: clone(VARIANTS), product_images: clone(IMAGES), reviews: clone(REVIEWS),
  announcements: clone(NEWS), events: clone(EVENTS), store_settings: Object.entries(SETTINGS).map(([key, value]) => ({ key, value: clone(value) })),
  orders: seed.orders, order_items: seed.order_items, order_status_history: seed.order_status_history, payments: seed.payments, addresses: [], wishlist_items: [],
  user_roles: [], newsletter_subscribers: [], contact_messages: [], profiles: seed.profiles, discount_codes: clone(DISCOUNT_ROWS),
  inventory_movements: seed.inventory_movements, notifications: seed.notifications,
}
let orderCounter = 1000 + seed.orders.length
/* ---------- auth (any email + password works) ---------- */

const SESSION_KEY = 'bl_demo_session'
let session: Session | null = null
try { const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(SESSION_KEY) : null; if (raw) session = JSON.parse(raw) as Session } catch { session = null }
const listeners = new Set<(evt: string, s: Session | null) => void>()
const uid = () => session?.user.id ?? null
/** Demo admin: sign in with ADMIN_EMAIL (any password). Everyone else is a customer. */
const isAdmin = () => session?.user.email === ADMIN_EMAIL

function setSession(s: Session | null, evt: string) {
  session = s
  try { if (typeof localStorage !== 'undefined') { if (s) localStorage.setItem(SESSION_KEY, JSON.stringify(s)); else localStorage.removeItem(SESSION_KEY) } } catch { /* private mode */ }
  listeners.forEach((cb) => cb(evt, s))
}
/** Stable id per email so a returning "customer" keeps the same identity during the visit. */
const idFor = (email: string) => `demo-user-${email.toLowerCase().replace(/[^a-z0-9]/g, '-')}`
// Names typed at registration are remembered per email, so signing back in later keeps them.
const NAMES_KEY = 'bl_demo_names'
const names: Record<string, string> = (() => { try { return JSON.parse((typeof localStorage !== 'undefined' && localStorage.getItem(NAMES_KEY)) || '{}') } catch { return {} } })()
const makeSession = (email: string, meta: Record<string, unknown> = {}): Session => {
  const key = email.toLowerCase()
  const full_name = (meta.full_name as string) || names[key] || (key === ADMIN_EMAIL ? 'Shop Owner' : key.split('@')[0])
  if (meta.full_name) { names[key] = full_name; try { if (typeof localStorage !== 'undefined') localStorage.setItem(NAMES_KEY, JSON.stringify(names)) } catch { /* ignore */ } }
  const user = { id: idFor(email), email: key, email_confirmed_at: nowIso(), user_metadata: { ...meta, full_name } }
  if (key !== ADMIN_EMAIL) {
    const at = db.profiles.findIndex((p) => p.id === user.id)
    if (at >= 0) db.profiles[at] = { ...db.profiles[at], full_name }
    else db.profiles.push({ id: user.id, full_name, email: key, created_at: nowIso() })
  }
  return { access_token: 'demo-token', user }
}

const auth = {
  async getSession() { return { data: { session }, error: null } },
  onAuthStateChange(cb: (evt: string, s: Session | null) => void) {
    listeners.add(cb)
    return { data: { subscription: { unsubscribe: () => { listeners.delete(cb) } } } }
  },
  async signInWithPassword({ email, password }: { email: string; password: string }) {
    // the owner account has a fixed password; every other email signs in with anything
    if (email.trim().toLowerCase() === ADMIN_EMAIL && password !== ADMIN_PASSWORD) return { data: { session: null, user: null }, error: { message: 'Invalid login credentials' } as { message: string } | null }
    const s = makeSession(email.trim())
    setSession(s, 'SIGNED_IN')
    return { data: { session: s, user: s.user }, error: null as { message: string } | null }
  },
  async signUp({ email, options }: { email: string; password: string; options?: { data?: Record<string, unknown>; emailRedirectTo?: string } }) {
    if (email.trim().toLowerCase() === ADMIN_EMAIL) return { data: { session: null, user: null }, error: { message: 'That email is already registered.' } as { message: string } | null }
    const s = makeSession(email.trim(), options?.data ?? {})
    setSession(s, 'SIGNED_IN')
    return { data: { session: s, user: s.user }, error: null as { message: string } | null }
  },
  async signOut() { setSession(null, 'SIGNED_OUT'); return { error: null } },
  async resend(_p?: unknown) { return { data: {}, error: null } },
  async resetPasswordForEmail(_email?: string, _opts?: unknown) { return { data: {}, error: null as { message: string } | null } },
  async updateUser(_attrs?: unknown) { return { data: { user: session?.user ?? null }, error: null as { message: string } | null } },
}

/* ---------- views & row-level visibility ---------- */

const ownOrderIds = () => new Set(db.orders.filter((o) => o.user_id === uid()).map((o) => o.id))
const ADMIN_ONLY = new Set(['notifications', 'inventory_movements', 'discount_codes', 'profiles'])

function view(table: string): Row[] {
  switch (table) {
    case 'catalog_products':
      return db.products.map((p) => {
        const vs = db.product_variants.filter((v) => v.product_id === p.id && v.is_active)
        const c = db.categories.find((x) => x.id === p.category_id)
        return { ...p, category_slug: c?.slug ?? null, category_name: c?.name ?? null, has_variants: vs.length > 0, total_stock: vs.length ? vs.reduce((n, v) => n + v.stock, 0) : p.stock }
      })
    case 'public_reviews': return db.reviews.filter((r) => !r.is_hidden)
    case 'product_ratings': {
      const by = new Map<string, number[]>()
      db.reviews.filter((r) => !r.is_hidden).forEach((r) => by.set(r.product_id, [...(by.get(r.product_id) ?? []), r.rating]))
      return [...by].map(([product_id, rs]) => ({ product_id, avg_rating: (rs.reduce((a, b) => a + b, 0) / rs.length).toFixed(1), review_count: rs.length }))
    }
    case 'orders': return isAdmin() ? db.orders : db.orders.filter((o) => o.user_id === uid())
    case 'order_items': { if (isAdmin()) return db.order_items; const ids = ownOrderIds(); return db.order_items.filter((i) => ids.has(i.order_id)) }
    case 'order_status_history': case 'payments': { if (isAdmin()) return db[table]; const ids = ownOrderIds(); return db[table].filter((r) => ids.has(r.order_id)) }
    case 'wishlist_items': case 'addresses': return db[table].filter((r) => r.user_id === uid())
    case 'user_roles': return isAdmin() ? [{ user_id: uid(), role: 'admin' }] : []
    default: return ADMIN_ONLY.has(table) && !isAdmin() ? [] : db[table] ?? []
  }
}

/** Columns that must stay unique, like the database's unique indexes. */
const UNIQUE: Record<string, string[]> = { products: ['slug'], categories: ['slug'], events: ['slug'], announcements: ['slug'], discount_codes: ['code'] }
const dupError = { data: null, error: { message: 'duplicate key value violates unique constraint', code: '23505' } }

/* ---------- query builder ---------- */

const getPath = (row: Row, path: string): any => path.split('.').reduce<any>((o, k) => (o == null ? o : o[k]), row)
const cmp = (a: any, b: any) => (a === b ? 0 : a == null ? -1 : b == null ? 1 : a < b ? -1 : 1)

class Q implements PromiseLike<any> {
  private table: string
  private filters: ((r: Row) => boolean)[] = []
  private sorts: { col: string; asc: boolean }[] = []
  private lim: number | null = null
  private rng: [number, number] | null = null
  private wantCount = false
  private op: 'select' | 'insert' | 'update' | 'delete' | 'upsert' = 'select'
  private payload: any = null
  private selectStr = '*'
  private mode: 'many' | 'maybe' | 'one' = 'many'
  private returning = false

  constructor(table: string) { this.table = table }

  select(cols = '*', opts?: { count?: string }) {
    if (this.op === 'select') this.selectStr = cols
    else this.returning = true
    if (opts?.count) this.wantCount = true
    return this
  }
  insert(p: any) { this.op = 'insert'; this.payload = p; return this }
  update(p: any) { this.op = 'update'; this.payload = p; return this }
  upsert(p: any, _opts?: unknown) { this.op = 'upsert'; this.payload = p; return this }
  delete() { this.op = 'delete'; return this }

  eq(col: string, v: any) { this.filters.push((r) => getPath(r, col) === v); return this }
  neq(col: string, v: any) { this.filters.push((r) => getPath(r, col) !== v); return this }
  gt(col: string, v: any) { this.filters.push((r) => getPath(r, col) > v); return this }
  gte(col: string, v: any) { this.filters.push((r) => getPath(r, col) >= v); return this }
  lt(col: string, v: any) { this.filters.push((r) => getPath(r, col) < v); return this }
  lte(col: string, v: any) { this.filters.push((r) => getPath(r, col) <= v); return this }
  in(col: string, vals: any[]) { this.filters.push((r) => vals.includes(getPath(r, col))); return this }
  is(col: string, v: null) { this.filters.push((r) => getPath(r, col) == v); return this }
  not(col: string, _op: string, v: null) { this.filters.push((r) => getPath(r, col) != v); return this }
  contains(col: string, vals: any[]) { this.filters.push((r) => Array.isArray(r[col]) && vals.every((x) => r[col].includes(x))); return this }
  /** Supports the "col.ilike.%term%,col2.ilike.%term%" form used by the shop search. */
  or(expr: string) {
    const parts = expr.split(',').map((p) => p.match(/^([\w.]+)\.ilike\.%(.*)%$/)).filter((m): m is RegExpMatchArray => !!m)
    this.filters.push((r) => parts.some(([, col, term]) => String(getPath(r, col) ?? '').toLowerCase().includes(term.toLowerCase())))
    return this
  }
  order(col: string, o?: { ascending?: boolean }) { this.sorts.push({ col, asc: o?.ascending !== false }); return this }
  limit(n: number) { this.lim = n; return this }
  range(a: number, b: number) { this.rng = [a, b]; return this }
  maybeSingle() { this.mode = 'maybe'; return this }
  single() { this.mode = 'one'; return this }

  then<A = any, B = never>(ok?: ((v: any) => A | PromiseLike<A>) | null, bad?: ((e: unknown) => B | PromiseLike<B>) | null): PromiseLike<A | B> {
    return Promise.resolve().then(() => this.run()).then(ok, bad)
  }

  /** Supports the nested selects used by the admin: order_items(...), products(...), product_variants(...). */
  private embed(r: Row): Row {
    const names = [...this.selectStr.matchAll(/([a-z_]+)(?:!inner)?\(/g)].map((m) => m[1])
    if (!names.length) return r
    const out: Row = { ...r }
    for (const n of names) {
      if (n in out) continue
      if (n === 'order_items' && this.table === 'orders') out.order_items = db.order_items.filter((i) => i.order_id === r.id)
      else if (n === 'products') out.products = db.products.find((p) => p.id === r.product_id) ?? null
      else if (n === 'product_variants') out.product_variants = r.variant_id ? db.product_variants.find((v) => v.id === r.variant_id) ?? null : null
    }
    return out
  }

  private shape(rows: Row[], count: number | null) {
    const out = rows.map((r) => clone(r))
    if (this.mode === 'many') return { data: out, error: null, count }
    if (this.mode === 'maybe') return { data: out[0] ?? null, error: null, count }
    return out[0] ? { data: out[0], error: null, count } : { data: null, error: { message: 'No matching row', code: 'PGRST116' }, count }
  }

  private run(): Row {
    const t = this.table
    if (this.op === 'select') {
      let rows = view(t).map((r) => ({ ...r }))
      if (t === 'order_items' && this.selectStr.includes('orders')) {
        const own = new Map(db.orders.filter((o) => o.user_id === uid()).map((o) => [o.id, o]))
        rows = rows.filter((r) => own.has(r.order_id)).map((r) => ({ ...r, orders: own.get(r.order_id) }))
      }
      for (const f of this.filters) rows = rows.filter(f)
      const count = rows.length
      for (const { col, asc } of [...this.sorts].reverse()) rows = [...rows].sort((a, b) => (asc ? 1 : -1) * cmp(getPath(a, col), getPath(b, col)))
      if (this.rng) rows = rows.slice(this.rng[0], this.rng[1] + 1)
      if (this.lim != null) rows = rows.slice(0, this.lim)
      rows = rows.map((r) => this.embed(r))
      return this.shape(rows, this.wantCount ? count : null)
    }

    const table = (db[t] ??= [])
    if (this.op === 'insert' || this.op === 'upsert') {
      const list: Row[] = Array.isArray(this.payload) ? this.payload : [this.payload]
      const made: Row[] = []
      for (const p of list) {
        let row: Row = { ...p }
        if (t === 'store_settings') {
          const i = table.findIndex((r) => r.key === row.key)
          if (i >= 0) { table[i] = { ...table[i], ...row }; made.push(table[i]); continue }
        } else {
          row = { id: uuid(), created_at: nowIso(), ...row }
        }
        if (t === 'wishlist_items' && table.some((r) => r.user_id === row.user_id && r.product_id === row.product_id)) continue
        if ((UNIQUE[t] ?? []).some((c) => row[c] != null && table.some((r) => r[c] === row[c]))) return dupError
        if (t === 'products') row = { sold_count: 0, stock: 0, ...row }
        if (t === 'discount_codes') row = { used_count: 0, ...row, code: String(row.code ?? '').toUpperCase() }
        if (t === 'reviews') {
          if (!uid()) return { data: null, error: { message: 'Please sign in', code: '42501' } }
          if (table.some((r) => r.order_item_id === row.order_item_id)) return { data: null, error: { message: 'You already reviewed this item.', code: '23505' } }
          const first = String(session?.user.user_metadata.full_name ?? 'Customer').split(' ')[0]
          row = { ...row, reviewer_name: `${first} (you)`, verified_purchase: true, is_hidden: false, admin_reply: null }
        }
        table.push(row); made.push(row)
      }
      return this.returning ? this.shape(made, null) : { data: null, error: null }
    }

    let hit = table.filter((r) => this.filters.every((f) => f(r)))
    if (this.op === 'update') {
      for (const c of UNIQUE[t] ?? []) if (this.payload?.[c] != null && table.some((r) => !hit.includes(r) && r[c] === this.payload[c])) return dupError
      hit.forEach((r) => Object.assign(r, this.payload))
      return this.returning ? this.shape(hit, null) : { data: null, error: null }
    }
    // delete: products and options that appear in past orders are kept (like the database's foreign key)
    const ids = new Set(hit.map((r) => r.id))
    if (t === 'products' && db.order_items.some((i) => ids.has(i.product_id))) return { data: null, error: { message: 'in use', code: '23503' } }
    if (t === 'product_variants' && db.order_items.some((i) => ids.has(i.variant_id))) return { data: null, error: { message: 'in use', code: '23503' } }
    db[t] = table.filter((r) => !hit.includes(r))
    if (t === 'products') for (const k of ['product_images', 'product_variants', 'reviews', 'wishlist_items']) db[k] = db[k].filter((r) => !ids.has(r.product_id))
    if (t === 'categories') db.products.forEach((p) => { if (ids.has(p.category_id)) p.category_id = null })
    hit = []
    return { data: null, error: null }
  }
}

/* ---------- RPCs (server-side rules, simplified for the demo) ---------- */

const setting = <T,>(key: string, fallback: T): T => (db.store_settings.find((r) => r.key === key)?.value as T) ?? fallback
const fmtPeso = (c: number) => `₱${(c / 100).toLocaleString('en-PH')}`
const timers = new Map<string, ReturnType<typeof setTimeout>[]>()

function pushHistory(orderId: string, status: string, note: string | null = null) {
  db.order_status_history.push({ id: uuid(), order_id: orderId, status, note, created_at: nowIso() })
}

function notify(kind: string, title: string, body: string | null, ref: { order_id?: string; product_id?: string } = {}) {
  if ((kind === 'low_stock' || kind === 'out_of_stock') && db.notifications.some((n) => n.kind === kind && n.product_id === ref.product_id && !n.acknowledged_at)) return
  db.notifications.push({ id: uuid(), kind, title, body, product_id: ref.product_id ?? null, order_id: ref.order_id ?? null, acknowledged_at: null, created_at: nowIso() })
}

/** Records a stock change and raises a low / out-of-stock alert when needed. */
function moveStock(target: Row, product: Row, delta: number, reason: string, note: string | null, orderId: string | null = null) {
  target.stock += delta
  db.inventory_movements.push({ id: uuid(), product_id: product.id, variant_id: target === product ? null : target.id, delta, stock_after: target.stock, reason, note, created_at: nowIso(), order_id: orderId })
  const label = target === product ? product.name : `${product.name} (${target.name})`
  if (target.stock <= 0) notify('out_of_stock', `${label} is out of stock`, null, { product_id: product.id })
  else if (target.stock <= (target.low_stock_threshold ?? 5)) notify('low_stock', `${label} is running low`, `${target.stock} left`, { product_id: product.id })
}

/** Demo only: moves an order along so visitors can see the timeline and try leaving a review. */
function advance(orderId: string, steps: [number, string, string | null][]) {
  const list: ReturnType<typeof setTimeout>[] = []
  for (const [ms, status, pay] of steps) {
    const h = setTimeout(() => {
      const o = db.orders.find((x) => x.id === orderId)
      if (!o || o.status === 'cancelled' || o.manual) return
      o.status = status
      if (pay) { o.payment_status = pay; const p = db.payments.find((x) => x.order_id === orderId); if (p) p.status = pay }
      pushHistory(orderId, status, 'Demo: automatic update')
    }, ms)
    ;(h as any).unref?.()
    list.push(h)
  }
  timers.set(orderId, list)
}
/** Once the admin handles an order, the demo stops moving it automatically. */
function takeOver(o: Row) { o.manual = true; (timers.get(o.id) ?? []).forEach(clearTimeout) }

type RpcResult = { data: any; error: { message: string; code?: string } | null }
const ok = (data: any): RpcResult => ({ data, error: null })
const err = (message: string): RpcResult => ({ data: null, error: { message } })
const adminOnly = (fn: (a: Row) => RpcResult) => (a: Row): RpcResult => (isAdmin() ? fn(a) : err('Only the shop owner can do that.'))

function validateDiscount(code: string, subtotal: number) {
  const bad = (message: string) => ({ valid: false, discount_centavos: 0, message })
  const d = db.discount_codes.find((x) => x.code === String(code ?? '').trim().toUpperCase() && x.is_active)
  const t = Date.now()
  if (!d || (d.starts_at && new Date(d.starts_at).getTime() > t) || (d.ends_at && new Date(d.ends_at).getTime() < t) || (d.max_uses != null && d.used_count >= d.max_uses)) return bad('That code isn’t valid.')
  if (subtotal < d.min_subtotal_centavos) return bad(`Spend ${fmtPeso(d.min_subtotal_centavos)} or more to use this code.`)
  const off = d.percent_off ? Math.round((subtotal * d.percent_off) / 100) : d.amount_off_centavos ?? 0
  return { valid: true, discount_centavos: Math.min(off, subtotal), message: d.percent_off ? `${d.percent_off}% off applied` : `${fmtPeso(off)} off applied` }
}

const idempotent = new Map<string, string>()

function placeOrder(a: Row): RpcResult {
  const user = session?.user
  if (!user) return err('Please sign in to place an order.')
  const key = `${user.id}:${a.p_idempotency_key}`
  if (idempotent.has(key)) return ok(idempotent.get(key))
  const items: { product_id: string; variant_id: string | null; quantity: number }[] = a.p_items ?? []
  if (!items.length) return err('Your cart is empty.')

  const lines: Row[] = []
  for (const it of items) {
    const p = db.products.find((x) => x.id === it.product_id && x.status === 'published')
    if (!p) return err('Some items are no longer available.')
    const v = it.variant_id ? db.product_variants.find((x) => x.id === it.variant_id && x.is_active) : null
    if (it.variant_id && !v) return err(`That option of ${p.name} is no longer available.`)
    const stock = v ? v.stock : p.stock
    const qty = Math.floor(Number(it.quantity))
    if (!(qty > 0)) return err('Invalid quantity.')
    if (qty > stock) return err(stock <= 0 ? `${p.name} just sold out.` : `Only ${stock} left of ${p.name}.`)
    lines.push({ p, v, qty, unit: v?.price_centavos ?? p.sale_price_centavos ?? p.price_centavos })
  }
  const subtotal = lines.reduce((s, l) => s + l.unit * l.qty, 0)
  const disc = a.p_discount_code ? validateDiscount(a.p_discount_code, subtotal) : null
  const discount = disc?.valid ? disc.discount_centavos : 0
  const ad = a.p_address ?? {}

  // the courier's fee for the customer's area is decided here, on the "server", never by the browser
  const cs = normalizeCouriers(setting('couriers', null))
  const courier = cs.couriers.find((c) => c.id === a.p_courier)
  const area = areaForRegion(ad.region)
  if (!area) return err('Please choose a delivery region.')
  if (!courier) return err('Please choose a courier.')
  if (!courier.available) return err(`${courier.name} is temporarily unavailable. Please pick another courier.`)
  const shipping = shippingCost(cs, courier, area, subtotal - discount)

  const id = uuid()
  const method = String(a.p_method)
  const number = `BL-${++orderCounter}`
  db.orders.push({
    id, order_number: number, user_id: user.id, status: method === 'cod' ? 'processing' : 'awaiting_payment', payment_status: 'unpaid', payment_method: method,
    subtotal_centavos: subtotal, discount_centavos: discount, shipping_centavos: shipping, total_centavos: subtotal - discount + shipping, discount_code: discount ? String(a.p_discount_code).toUpperCase() : null,
    ship_name: ad.name, ship_phone: ad.phone, ship_email: ad.email, ship_region: ad.region, ship_province: ad.province, ship_city: ad.city, ship_barangay: ad.barangay,
    ship_street: ad.street, ship_postal_code: ad.postal_code, ship_landmark: ad.landmark ?? null, delivery_notes: ad.notes ?? null, courier: courier.name, tracking_number: null, created_at: nowIso(),
  })
  for (const l of lines) {
    db.order_items.push({ id: uuid(), order_id: id, product_id: l.p.id, variant_id: l.v?.id ?? null, product_name: l.p.name, variant_name: l.v?.name ?? null, unit_price_centavos: l.unit, quantity: l.qty })
    moveStock(l.v ?? l.p, l.p, -l.qty, 'order', number, id)
    l.p.sold_count += l.qty
  }
  if (discount) { const d = db.discount_codes.find((x) => x.code === String(a.p_discount_code).toUpperCase()); if (d) d.used_count += 1 }
  notify('new_order', `New order ${number}`, `${ad.name ?? 'A customer'} · ${fmtPeso(subtotal - discount + shipping)}`, { order_id: id })
  pushHistory(id, 'pending', 'Order placed')
  if (method === 'cod') { pushHistory(id, 'processing'); advance(id, [[8000, 'packed', null], [14000, 'shipped', null], [20000, 'delivered', 'verified']]) } else pushHistory(id, 'awaiting_payment')
  idempotent.set(key, id)
  return ok(id)
}

function myOrder(id: string) { return db.orders.find((o) => o.id === id && o.user_id === uid()) }
const PH_DAY = (iso: string | number) => new Date(new Date(iso).getTime() + 8 * 3_600_000).toISOString().slice(0, 10)

function restock(o: Row, note: string) {
  for (const it of db.order_items.filter((i) => i.order_id === o.id)) {
    const p = db.products.find((x) => x.id === it.product_id)
    const v = it.variant_id ? db.product_variants.find((x) => x.id === it.variant_id) : null
    if (p) moveStock(v ?? p, p, it.quantity, 'cancellation', note, o.id)
  }
}

const RPC: Record<string, (a: Row) => RpcResult> = {
  validate_discount: (a) => ok(validateDiscount(a.p_code, a.p_subtotal_centavos)),
  place_order: placeOrder,
  submit_payment_proof: (a) => {
    const o = myOrder(a.p_order)
    if (!o) return err('Order not found.')
    if (o.status !== 'awaiting_payment') return err('This order is not waiting for a payment.')
    db.payments.push({ id: uuid(), order_id: o.id, status: 'submitted', reference_number: a.p_reference ?? null, proof_path: a.p_proof_path ?? null, amount_centavos: o.total_centavos })
    o.status = 'payment_verification'; o.payment_status = 'submitted'
    pushHistory(o.id, 'payment_verification', 'Payment proof received')
    notify('payment_submitted', `Payment proof for ${o.order_number}`, 'Check the screenshot and approve it.', { order_id: o.id })
    advance(o.id, [[4000, 'processing', 'verified'], [10000, 'packed', null], [16000, 'shipped', null], [22000, 'delivered', null]])
    return ok(null)
  },
  cancel_my_order: (a) => {
    const o = myOrder(a.p_order)
    if (!o) return err('Order not found.')
    if (!['pending', 'awaiting_payment', 'payment_verification'].includes(o.status)) return err('This order can no longer be cancelled.')
    restock(o, 'Cancelled by customer')
    o.status = 'cancelled'; pushHistory(o.id, 'cancelled', 'Cancelled by customer')
    takeOver(o)
    return ok(null)
  },

  /* ----- owner (admin) actions ----- */
  admin_update_order: adminOnly((a) => {
    const o = db.orders.find((x) => x.id === a.p_order)
    if (!o) return err('Order not found.')
    const status = String(a.p_status)
    if (!['pending', 'awaiting_payment', 'payment_verification', 'processing', 'packed', 'shipped', 'delivered', 'cancelled', 'refunded'].includes(status)) return err('Unknown status.')
    takeOver(o)
    if (status === 'cancelled' && o.status !== 'cancelled') restock(o, a.p_note ?? 'Cancelled by shop')
    if (status !== o.status) pushHistory(o.id, status, a.p_note ?? null)
    o.status = status
    if (a.p_courier != null) o.courier = a.p_courier
    if (a.p_tracking != null) o.tracking_number = a.p_tracking
    if (status === 'delivered' && o.payment_method === 'cod') o.payment_status = 'verified'
    return ok(null)
  }),
  admin_verify_payment: adminOnly((a) => {
    const o = db.orders.find((x) => x.id === a.p_order)
    if (!o) return err('Order not found.')
    const pay = db.payments.find((x) => x.order_id === o.id)
    if (!pay) return err('There is no payment to check yet.')
    takeOver(o)
    if (a.p_approve) { pay.status = 'verified'; o.payment_status = 'verified'; o.status = 'processing'; pushHistory(o.id, 'processing', a.p_note ?? 'Payment verified') }
    else { pay.status = 'failed'; o.payment_status = 'failed'; o.status = 'awaiting_payment'; pushHistory(o.id, 'awaiting_payment', a.p_note ?? 'Payment could not be verified') }
    return ok(null)
  }),
  admin_adjust_stock: adminOnly((a) => {
    const p = db.products.find((x) => x.id === a.p_product)
    if (!p) return err('Product not found.')
    const v = a.p_variant ? db.product_variants.find((x) => x.id === a.p_variant) : null
    if (a.p_variant && !v) return err('Option not found.')
    const target = v ?? p
    const delta = Math.trunc(Number(a.p_delta))
    if (!delta) return err('Enter a number other than 0.')
    if (target.stock + delta < 0) return err('Stock can’t go below zero.')
    moveStock(target, p, delta, a.p_reason, a.p_note || null)
    return ok(null)
  }),
  admin_customers: adminOnly(() => ok(db.profiles.map((pr) => {
    const mine = db.orders.filter((o) => o.user_id === pr.id && !['cancelled', 'refunded'].includes(o.status))
    return {
      id: pr.id, full_name: pr.full_name, email: pr.email, registered_at: pr.created_at, order_count: mine.length,
      total_spent_centavos: mine.filter((o) => o.payment_status === 'verified').reduce((n, o) => n + o.total_centavos, 0),
      last_order_at: mine.map((o) => o.created_at).sort().pop() ?? null,
    }
  }).sort((x, y) => y.total_spent_centavos - x.total_spent_centavos))),
  admin_dashboard: adminOnly(() => {
    const today = PH_DAY(Date.now())
    const dayMinus = (n: number) => PH_DAY(Date.now() - n * 86_400_000)
    const live = db.orders.filter((o) => !['cancelled', 'refunded'].includes(o.status))
    const paid = live.filter((o) => o.payment_status === 'verified')
    const sum = (rows: Row[], from: string) => rows.filter((o) => PH_DAY(o.created_at) >= from).reduce((n, o) => n + o.total_centavos, 0)
    const by_status: Record<string, number> = {}
    db.orders.forEach((o) => { by_status[o.status] = (by_status[o.status] ?? 0) + 1 })
    const rows: { stock: number; threshold: number }[] = []
    for (const p of db.products.filter((x) => x.status !== 'archived')) {
      const vs = db.product_variants.filter((v) => v.product_id === p.id && v.is_active)
      if (vs.length) vs.forEach((v) => rows.push({ stock: v.stock, threshold: v.low_stock_threshold })); else rows.push({ stock: p.stock, threshold: p.low_stock_threshold })
    }
    const tally = new Map<string, { name: string; qty: number; revenue: number }>()
    const liveIds = new Set(live.filter((o) => PH_DAY(o.created_at) >= dayMinus(29)).map((o) => o.id))
    db.order_items.filter((i) => liveIds.has(i.order_id)).forEach((i) => {
      const t = tally.get(i.product_id) ?? { name: i.product_name, qty: 0, revenue: 0 }
      t.qty += i.quantity; t.revenue += i.quantity * i.unit_price_centavos; tally.set(i.product_id, t)
    })
    return ok({
      revenue_today: sum(paid, today), revenue_7d: sum(paid, dayMinus(6)), revenue_30d: sum(paid, dayMinus(29)),
      orders_today: live.filter((o) => PH_DAY(o.created_at) === today).length, by_status,
      low_stock: rows.filter((r) => r.stock > 0 && r.stock <= r.threshold).length, out_of_stock: rows.filter((r) => r.stock <= 0).length, customers: db.profiles.length,
      daily: Array.from({ length: 14 }, (_, k) => { const day = dayMinus(13 - k); return { day, revenue: paid.filter((o) => PH_DAY(o.created_at) === day).reduce((n, o) => n + o.total_centavos, 0), orders: live.filter((o) => PH_DAY(o.created_at) === day).length } }),
      top_products: [...tally.values()].sort((x, y) => y.revenue - x.revenue).slice(0, 5),
    })
  }),
}

/* ---------- storage (uploaded files live only in this browser tab) ---------- */

const blobs = new Map<string, string>([[`payment-proofs/${PROOF_PATH}`, PROOF_URL]])
const storage = {
  from(bucket: string) {
    const k = (p: string) => `${bucket}/${p}`
    return {
      async upload(path: string, file: Blob, _opts?: unknown) { try { blobs.set(k(path), URL.createObjectURL(file)) } catch { /* not a file; nothing to preview */ } return { data: { path }, error: null as null | { message: string } } },
      getPublicUrl(path: string) { return { data: { publicUrl: blobs.get(k(path)) ?? '' } } },
      async createSignedUrl(path: string, _seconds?: number) { return { data: { signedUrl: blobs.get(k(path)) ?? null }, error: null } },
      async remove(_paths: string[]) { return { data: null, error: null } },
    }
  },
}

export const supabase = {
  from: (table: string) => new Q(table),
  async rpc(name: string, args: Row = {}): Promise<RpcResult> {
    const fn = RPC[name]
    return fn ? fn(args) : err('This action is not available in the demo.')
  },
  auth,
  storage,
}