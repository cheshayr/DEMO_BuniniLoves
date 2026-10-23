/**
 * Made-up shop history so the demo admin has something to show: customers, orders at every stage,
 * payment proofs, stock movements and alerts. Everything is fictional.
 */
import { PRODUCTS, REVIEWS, SETTINGS, VARIANTS } from './demoData'
import { areaForRegion, normalizeCouriers } from './shipping'

type Row = Record<string, any>
const DAY = 86_400_000
const ago = (days: number, hour = 14) => { const d = new Date(Date.now() - days * DAY); d.setUTCHours(hour - 8, (days * 7) % 60, 0, 0); return d.toISOString() }

/** Fixed demo owner login. Public on purpose: this is a showcase, not a real shop. */
export const ADMIN_EMAIL = 'admin@gmail.com'
export const ADMIN_PASSWORD = 'admin1234'

const CUSTOMERS: [string, string][] = [
  ['Mika R.', 'mika.r'], ['Jon P.', 'jon.p'], ['Aly D.', 'aly.d'], ['Bea S.', 'bea.s'], ['Rico T.', 'rico.t'],
  ['Carla M.', 'carla.m'], ['Nina L.', 'nina.l'], ['Dani V.', 'dani.v'], ['Gab N.', 'gab.n'],
]

const ADDRESSES: Record<string, Partial<Row>> = {
  metro: { ship_region: 'NCR – National Capital Region', ship_province: 'Metro Manila', ship_city: 'Quezon City', ship_barangay: 'Sample Barangay', ship_street: '12 Example Street', ship_postal_code: '1100' },
  luzon: { ship_region: 'Region III – Central Luzon', ship_province: 'Bulacan', ship_city: 'Malolos', ship_barangay: 'Sample Barangay', ship_street: '45 Placeholder Road', ship_postal_code: '3000' },
  visayas: { ship_region: 'Region VII – Central Visayas', ship_province: 'Cebu', ship_city: 'Cebu City', ship_barangay: 'Sample Barangay', ship_street: '8 Demo Lane', ship_postal_code: '6000' },
  mindanao: { ship_region: 'Region XI – Davao Region', ship_province: 'Davao del Sur', ship_city: 'Davao City', ship_barangay: 'Sample Barangay', ship_street: '3 Imaginary Avenue', ship_postal_code: '8000' },
}

/** [customer, daysAgo, status, method, courier id, address, items [slug, variant index | null, qty][]] */
type Spec = [number, number, string, string, string, keyof typeof ADDRESSES, [string, number | null, number][]]
const SPECS: Spec[] = [
  [0, 27, 'delivered', 'gcash', 'jnt', 'metro', [['bunny-hug-sticker-sheet', null, 2], ['pocket-bunny-notebook', 0, 1]]],
  [1, 24, 'delivered', 'cod', 'lbc', 'luzon', [['pastel-stationery-set', null, 1]]],
  [2, 21, 'delivered', 'bank_transfer', 'jnt', 'visayas', [['bunny-hug-sticker-sheet', null, 3]]],
  [3, 18, 'delivered', 'gcash', 'jnt', 'metro', [['pocket-bunny-notebook', 1, 2], ['bunny-hug-sticker-sheet', null, 1]]],
  [4, 15, 'delivered', 'gcash', 'lbc', 'mindanao', [['pastel-stationery-set', null, 2]]],
  [5, 12, 'delivered', 'gcash', 'jnt', 'metro', [['pastel-stationery-set', null, 1], ['bunny-hug-sticker-sheet', null, 1]]],
  [6, 9, 'delivered', 'cod', 'jnt', 'luzon', [['bunny-hug-sticker-sheet', null, 2]]],
  [0, 7, 'shipped', 'gcash', 'jnt', 'metro', [['pocket-bunny-notebook', 0, 1]]],
  [7, 5, 'packed', 'bank_transfer', 'lbc', 'visayas', [['pastel-stationery-set', null, 1], ['pocket-bunny-notebook', 1, 1]]],
  [8, 3, 'processing', 'gcash', 'jnt', 'luzon', [['bunny-hug-sticker-sheet', null, 4]]],
  [3, 2, 'payment_verification', 'gcash', 'jnt', 'metro', [['pastel-stationery-set', null, 1]]],
  [1, 1, 'payment_verification', 'bank_transfer', 'lbc', 'mindanao', [['pocket-bunny-notebook', 0, 2], ['bunny-hug-sticker-sheet', null, 2]]],
  [4, 1, 'awaiting_payment', 'gcash', 'jnt', 'metro', [['bunny-hug-sticker-sheet', null, 1]]],
  [2, 6, 'cancelled', 'gcash', 'jnt', 'luzon', [['pocket-bunny-notebook', 0, 1]]],
]

const PROOF_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 360 520"><rect width="360" height="520" fill="#f4f8ff"/><rect x="0" y="0" width="360" height="70" fill="#2b6cf6"/><text x="24" y="44" font-family="Arial" font-size="24" font-weight="bold" fill="#fff">Payment sent</text><text x="180" y="150" text-anchor="middle" font-family="Arial" font-size="18" fill="#445">Amount</text><text x="180" y="200" text-anchor="middle" font-family="Arial" font-size="44" font-weight="bold" fill="#111">SAMPLE</text><text x="180" y="270" text-anchor="middle" font-family="Arial" font-size="16" fill="#445">To: Demo Shop · 0900 000 0000</text><text x="180" y="300" text-anchor="middle" font-family="Arial" font-size="16" fill="#445">Ref. no. 0000 000 000000</text><rect x="40" y="380" width="280" height="60" rx="12" fill="#fff" stroke="#c9d6f2"/><text x="180" y="418" text-anchor="middle" font-family="Arial" font-size="15" fill="#667">Fake screenshot for the demo</text></svg>`
export const PROOF_URL = `data:image/svg+xml;utf8,${encodeURIComponent(PROOF_SVG)}`
export const PROOF_PATH = 'seed/sample-proof.png'

export function buildAdminSeed() {
  const cs = normalizeCouriers(SETTINGS.couriers)
  const profiles: Row[] = CUSTOMERS.map(([full_name, handle], i) => ({ id: `seed-user-${i}`, full_name, email: `${handle}@example.com`, created_at: ago(40 - i * 3) }))
  const orders: Row[] = []
  const order_items: Row[] = []
  const payments: Row[] = []
  const order_status_history: Row[] = []
  const notifications: Row[] = []
  const inventory_movements: Row[] = []

  SPECS.forEach(([ci, days, status, method, courierId, addr, items], i) => {
    const id = `seed-order-${i + 1}`
    const prof = profiles[ci]
    let subtotal = 0
    items.forEach(([slug, vi, qty], j) => {
      const p = PRODUCTS.find((x) => x.slug === slug)!
      const vs = VARIANTS.filter((v) => v.product_id === p.id)
      const v = vi != null ? vs[vi] : null
      const unit = v?.price_centavos ?? p.sale_price_centavos ?? p.price_centavos
      subtotal += unit * qty
      order_items.push({ id: `${id}-item-${j}`, order_id: id, product_id: p.id, variant_id: v?.id ?? null, product_name: p.name, variant_name: v?.name ?? null, unit_price_centavos: unit, quantity: qty })
    })
    const courier = cs.couriers.find((c) => c.id === courierId)!
    const area = areaForRegion(ADDRESSES[addr].ship_region as string)!
    const free = cs.free_over_centavos != null && subtotal >= cs.free_over_centavos
    const shipping = free ? 0 : courier.rates[area]
    const paid = ['processing', 'packed', 'shipped', 'delivered'].includes(status)
    const payment_status = paid && method !== 'cod' ? 'verified' : status === 'delivered' ? 'verified' : status === 'payment_verification' ? 'submitted' : 'unpaid'
    const created = ago(days, 10 + (i % 8))
    orders.push({
      id, order_number: `BL-${1001 + i}`, user_id: prof.id, status, payment_status, payment_method: method,
      subtotal_centavos: subtotal, discount_centavos: 0, shipping_centavos: shipping, total_centavos: subtotal + shipping, discount_code: null,
      ship_name: prof.full_name.replace('.', ''), ship_phone: '09170000000', ship_email: prof.email, ...ADDRESSES[addr],
      ship_landmark: null, delivery_notes: null, courier: courier.name, tracking_number: ['shipped', 'delivered'].includes(status) ? `${courier.id.toUpperCase()}${100000 + i * 137}` : null, created_at: created,
    })
    const steps = ['pending']
    if (method !== 'cod') steps.push('awaiting_payment')
    if (['payment_verification', 'processing', 'packed', 'shipped', 'delivered'].includes(status) && method !== 'cod') steps.push('payment_verification')
    if (['processing', 'packed', 'shipped', 'delivered'].includes(status)) steps.push('processing')
    if (['packed', 'shipped', 'delivered'].includes(status)) steps.push('packed')
    if (['shipped', 'delivered'].includes(status)) steps.push('shipped')
    if (status === 'delivered') steps.push('delivered')
    if (status === 'cancelled') steps.push('cancelled')
    steps.forEach((st, k) => order_status_history.push({ id: `${id}-h${k}`, order_id: id, status: st, note: k === 0 ? 'Order placed' : null, created_at: new Date(new Date(created).getTime() + k * 3_600_000 * 5).toISOString() }))
    if (method !== 'cod' && ['payment_verification', 'processing', 'packed', 'shipped', 'delivered'].includes(status)) {
      payments.push({ id: `${id}-pay`, order_id: id, status: payment_status, reference_number: `REF-${4000 + i * 11}`, proof_path: PROOF_PATH, amount_centavos: subtotal + shipping, created_at: created })
    }
    if (status === 'payment_verification') {
      notifications.push({ id: `${id}-n`, kind: 'payment_submitted', title: `Payment proof for ${`BL-${1001 + i}`}`, body: 'Check the screenshot and approve it.', product_id: null, order_id: id, acknowledged_at: null, created_at: created })
    }
  })

  // a couple of stock alerts and opening stock history
  PRODUCTS.forEach((p, i) => inventory_movements.push({ id: `mv-init-${i}`, product_id: p.id, variant_id: null, delta: p.stock + 40, stock_after: p.stock + 40, reason: 'initial', note: 'Opening stock', created_at: ago(45), order_id: null }))
  orders.filter((o) => o.status !== 'cancelled').forEach((o, i) => {
    const it = order_items.find((x) => x.order_id === o.id)!
    inventory_movements.push({ id: `mv-ord-${i}`, product_id: it.product_id, variant_id: it.variant_id, delta: -it.quantity, stock_after: 30, reason: 'order', note: o.order_number, created_at: o.created_at, order_id: o.id })
  })
  notifications.push({ id: 'n-new-1', kind: 'new_order', title: 'New order BL-1013', body: 'A customer placed an order.', product_id: null, order_id: 'seed-order-13', acknowledged_at: null, created_at: ago(1, 18) })

  // every reviewer gets a profile too
  REVIEWS.forEach((r) => { if (!profiles.some((p) => p.id === r.user_id)) profiles.push({ id: r.user_id, full_name: r.reviewer_name, email: `${String(r.reviewer_name).toLowerCase().replace(/[^a-z]/g, '')}@example.com`, created_at: ago(30) }) })

  return { profiles, orders, order_items, payments, order_status_history, notifications, inventory_movements }
}