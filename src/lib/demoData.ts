/**
 * Sample data for the public demo. Everything here is made up: product names, prices, reviews, events and news.
 * Pictures are tiny SVG illustrations generated in code, so there are no image files to host.
 */

import { asset } from './assets'

type Row = Record<string, any>

const DAY = 86_400_000
const ago = (days: number) => new Date(Date.now() - days * DAY).toISOString()
const ahead = (days: number, hour = 10) => { const d = new Date(Date.now() + days * DAY); d.setUTCHours(hour - 8, 0, 0, 0); return d.toISOString() } // hour is Philippine time

/* ---------- generated artwork ---------- */

type Kind = 'star' | 'heart' | 'cloud' | 'bunny' | 'flower' | 'sparkle'
const INK = '#2b1a2e'
const PALETTES: [string, string][] = [['#ffd6e8', '#ffb8d9'], ['#dcebfa', '#b9d7f5'], ['#fff2a8', '#ffe566'], ['#ffe9f2', '#f0508c'], ['#eaf7e8', '#bfe3b4'], ['#efe6ff', '#cdb8ff']]

function shape(kind: Kind, fg: string): string {
  const s = `stroke="${INK}" stroke-width="7" stroke-linejoin="round" stroke-linecap="round"`
  switch (kind) {
    case 'star': return `<path d="M300 110 L350 235 L486 243 L380 330 L415 462 L300 390 L185 462 L220 330 L114 243 L250 235 Z" fill="${fg}" ${s}/>`
    case 'heart': return `<path d="M300 470 C120 350 110 220 190 175 C250 142 295 185 300 215 C305 185 350 142 410 175 C490 220 480 350 300 470 Z" fill="${fg}" ${s}/>`
    case 'cloud': return `<path d="M170 400 C100 400 90 310 160 295 C160 220 270 190 320 250 C390 215 470 265 440 330 C500 340 500 400 440 400 Z" fill="${fg}" ${s}/>`
    case 'flower': return `<g ${s} fill="${fg}">${[0, 72, 144, 216, 288].map((a) => `<ellipse cx="300" cy="195" rx="46" ry="70" transform="rotate(${a} 300 300)"/>`).join('')}<circle cx="300" cy="300" r="42" fill="#fff2a8"/></g>`
    case 'sparkle': return `<path d="M300 120 C310 230 370 290 480 300 C370 310 310 370 300 480 C290 370 230 310 120 300 C230 290 290 230 300 120 Z" fill="${fg}" ${s}/>`
    case 'bunny': return `<g ${s}><ellipse cx="240" cy="165" rx="38" ry="95" fill="${fg}"/><ellipse cx="360" cy="165" rx="38" ry="95" fill="${fg}"/><ellipse cx="300" cy="330" rx="130" ry="115" fill="#fff"/><circle cx="262" cy="320" r="9" fill="${INK}"/><circle cx="338" cy="320" r="9" fill="${INK}"/><path d="M285 355 Q300 372 315 355" fill="none"/><circle cx="238" cy="352" r="16" fill="${fg}" stroke="none" opacity=".7"/><circle cx="362" cy="352" r="16" fill="${fg}" stroke="none" opacity=".7"/></g>`
  }
}

export function art(label: string, kind: Kind, palette = 0, flip = false): string {
  const [bg, fg] = PALETTES[palette % PALETTES.length]
  const safe = label.replace(/&/g, '&amp;').replace(/</g, '&lt;').slice(0, 26)
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 600"><rect width="600" height="600" fill="${bg}"/>`
    + `<g transform="${flip ? 'translate(600 0) scale(-1 1)' : ''}">${shape(kind, fg)}</g>`
    + `<path d="M70 90 l12 26 26 12 -26 12 -12 26 -12 -26 -26 -12 26 -12z" fill="#fff" stroke="${INK}" stroke-width="5" stroke-linejoin="round"/>`
    + `<path d="M505 505 l9 19 19 9 -19 9 -9 19 -9 -19 -19 -9 19 -9z" fill="#fff" stroke="${INK}" stroke-width="5" stroke-linejoin="round"/>`
    + `<rect x="120" y="500" width="360" height="56" rx="28" fill="#fff" stroke="${INK}" stroke-width="6"/>`
    + `<text x="300" y="538" text-anchor="middle" font-family="ui-rounded, Fredoka, Nunito, Arial, sans-serif" font-size="28" font-weight="700" fill="${INK}">${safe}</text></svg>`
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
}

/* ---------- catalogue ---------- */

export const CATEGORIES: Row[] = [
  ['stationery', 'Stationery'], ['stickers', 'Stickers & Sticker Sheets'], ['notebooks', 'Notebooks & Journals'],
].map(([slug, name], i) => ({ id: `cat-${slug}`, slug, name, description: null, image_url: null, sort_order: i, is_active: true }))

interface Seed {
  slug: string; name: string; cat: string; price: number; sale?: number; stock: number; kind: Kind; pal: number; desc: string; tags: string[]
  img: string; flags?: ('featured' | 'new' | 'best' | 'bundle' | 'limited')[]; variants?: [string, number][]; sold?: number; specs?: string
}

const SEEDS: Seed[] = [
  { slug: 'pastel-stationery-set', name: 'Pastel Stationery Set', cat: 'stationery', price: 18900, stock: 40, kind: 'flower', pal: 3, img: 'photos/stationery.jpg', desc: 'Letter pads, matching envelopes and a few tiny stickers in soft pastels. Everything you need to write a note someone will keep.', tags: ['stationery', 'letter set'], flags: ['featured', 'new'], sold: 88, specs: 'Letter pad + envelopes + stickers' },
  { slug: 'bunny-hug-sticker-sheet', name: 'Bunny Hug Sticker Sheet', cat: 'stickers', price: 12900, stock: 60, kind: 'bunny', pal: 0, img: 'photos/sticker.jpg', desc: 'A full sheet of cuddly bunnies in matte vinyl. Waterproof, scratch-resistant and perfect for planners, laptops and water bottles.', tags: ['sticker', 'bunny'], flags: ['featured', 'best'], sold: 240, specs: 'A6 sheet · matte vinyl · waterproof' },
  { slug: 'pocket-bunny-notebook', name: 'Pocket Bunny Notebook', cat: 'notebooks', price: 15900, stock: 36, kind: 'bunny', pal: 1, img: 'photos/nb.jpg', desc: 'A softcover A6 notebook with 96 dotted pages. Small enough for any bag, cute enough to show off.', tags: ['notebook', 'dotted'], flags: ['featured', 'best'], variants: [['Pink', 20], ['Blue', 16]], sold: 98, specs: 'A6 · 96 pages · 100gsm dotted paper' },
]

export const PRODUCTS: Row[] = SEEDS.map((s, i) => {
  const cat = CATEGORIES.find((c) => c.slug === s.cat)!
  const f = s.flags ?? []
  return {
    id: `prod-${s.slug}`, slug: s.slug, name: s.name, description: s.desc, specs: s.specs ?? null, care_instructions: s.cat === 'stickers' ? 'Apply to a clean, dry surface. Avoid soaking for 24 hours.' : null,
    category_id: cat.id, category_slug: cat.slug, category_name: cat.name, tags: s.tags, price_centavos: s.price, sale_price_centavos: s.sale ?? null,
    stock: s.variants ? 0 : s.stock, low_stock_threshold: 10, is_featured: f.includes('featured'), is_new_arrival: f.includes('new'), is_best_seller: f.includes('best'),
    is_bundle: f.includes('bundle'), is_limited_edition: f.includes('limited'), sold_count: s.sold ?? 0, status: 'published', created_at: ago(i * 3 + 1),
  }
})

export const VARIANTS: Row[] = SEEDS.flatMap((s) => (s.variants ?? []).map(([name, stock], i) => ({
  id: `var-${s.slug}-${i}`, product_id: `prod-${s.slug}`, name, price_centavos: null, stock, low_stock_threshold: 5, sort_order: i, is_active: true,
})))

export const IMAGES: Row[] = SEEDS.map((s) => ({
  id: `img-${s.slug}-0`, product_id: `prod-${s.slug}`, url: asset(s.img), alt: s.name, sort_order: 0,
}))

/** If a photo file is missing from /public/photos, this generated artwork is shown in its place. */
export const PHOTO_FALLBACKS: Record<string, string> = Object.fromEntries(SEEDS.map((s) => [s.img.split('/').pop()!, art(s.name, s.kind, s.pal)]))

/* ---------- reviews (made up) ---------- */

const REVIEW_TEXT: [string, number, string, string, string?][] = [
  ['bunny-hug-sticker-sheet', 5, 'Mika R.', 'So cute and they stick really well on my laptop. Already ordered a second sheet!', 'Thank you so much, Mika! ♡'],
  ['bunny-hug-sticker-sheet', 5, 'Jon P.', 'Bought as a gift and my sister loved it. Quality is great for the price.'],
  ['bunny-hug-sticker-sheet', 4, 'Aly D.', 'Perfect for my bullet journal. Wish there were a few more bunnies per sheet.'],
  ['pocket-bunny-notebook', 5, 'Bea S.', 'Fits in my small bag and the paper does not bleed with gel pens.', 'So happy you like it ♡'],
  ['pocket-bunny-notebook', 4, 'Rico T.', 'Cute cover, nice dotted pages. Shipping took a few days but it was well packed.'],
  ['pastel-stationery-set', 5, 'Carla M.', 'The envelopes are so pretty. I used the whole set for birthday letters.'],
  ['pastel-stationery-set', 5, 'Nina L.', 'Soft colours, thick paper, and a tiny sticker surprise. Will buy again.', 'Aww, thank you Nina!'],
]

export const REVIEWS: Row[] = REVIEW_TEXT.map(([slug, rating, who, body, reply], i) => ({
  id: `rev-${i + 1}`, product_id: `prod-${slug}`, rating, body, photo_path: null, admin_reply: reply ?? null, created_at: ago(2 + i * 4),
  reviewer_name: who, verified_purchase: true, is_hidden: false, user_id: `seed-user-${i}`,
}))

/* ---------- events & news ---------- */

export const EVENTS: Row[] = [
  { slug: 'sample-stationery-bazaar', name: 'Sample Stationery Bazaar', startDays: 12, endDays: 13, venue: 'Demo Convention Hall, Manila', address: '123 Sample Street, Manila (fictional)', booth: 'Booth B-12', description: 'Come say hi! We bring new sticker sheets, notebooks and a few surprise freebies for the first 50 visitors.\n\nThis is a fictional demo event.' },
  { slug: 'paper-and-pen-expo', name: 'Paper & Pen Expo', startDays: 26, endDays: 28, venue: 'Example Expo Center, Quezon City', address: '45 Placeholder Avenue (fictional)', booth: 'Booth 7', description: 'Three days of stationery lovers, workshops and live lettering demos.\n\nThis is a fictional demo event.' },
  { slug: 'holiday-pop-up', name: 'Holiday Pop-Up Shop', startDays: 60, endDays: 61, venue: 'Imaginary Mall, Cebu', address: 'Level 2 Atrium (fictional)', booth: null, description: 'Gift sets, stocking stuffers and free gift wrapping.\n\nThis is a fictional demo event.' },
].map((e, i) => ({ id: `evt-${i + 1}`, slug: e.slug, name: e.name, starts_at: ahead(e.startDays), ends_at: ahead(e.endDays, 20), venue: e.venue, address: e.address, description: e.description, booth: e.booth, poster_url: asset(`photos/bz${i + 1}.jpg`), external_url: null, participation_info: 'Free entrance. Cash and e-wallets accepted at the booth.', status: 'published' }))

/** Fallback artwork for the bazaar photos (bz1-bz3.png) if a file is missing. */
for (const [i, e] of EVENTS.entries()) PHOTO_FALLBACKS[`bz${i + 1}.jpg`] = art(e.name, i === 1 ? 'star' : 'cloud', i + 1)

export const NEWS: Row[] = [
  { slug: 'welcome-to-the-demo', title: 'Welcome to the Bunini Loves demo', category: 'news', pinned: true, days: 1, content: 'This is a showcase build of the Bunini Loves store. Everything you see is sample data, and nothing is saved or charged.\n\nBrowse, add to cart, check out, sign in with any email, and even leave a review after your demo order "arrives".' },
  { slug: 'new-sticker-sheets', title: 'New sticker sheets just dropped', category: 'restock', pinned: false, days: 6, content: 'Three fresh sticker sheets are now in the shop: Bunny Hug, Starry Night and Cloud Nine. Matte vinyl, waterproof, extra cute.' },
  { slug: 'bazaar-weekend', title: 'See us at the next bazaar', category: 'bazaar', pinned: false, days: 9, content: 'We are packing boxes for the Sample Stationery Bazaar. Check the Events page for dates and booth number.' },
  { slug: 'behind-the-scenes-packing', title: 'Behind the scenes: packing orders', category: 'behind the scenes', pinned: false, days: 15, content: 'Every order is wrapped by hand with a tiny thank-you note and a surprise sticker.' },
].map((n, i) => ({ id: `news-${i + 1}`, slug: n.slug, title: n.title, category: n.category, cover_url: art(n.title, (['heart', 'sparkle', 'cloud', 'bunny'] as Kind[])[i], i), content: n.content, status: 'published', is_pinned: n.pinned, published_at: ago(n.days), created_at: ago(n.days) }))

/* ---------- settings & discount codes ---------- */

export const SETTINGS: Record<string, unknown> = {
  announcement: { enabled: true, text: 'free shipping on orders over ₱1,500 ♡', link: '/shop' },
  couriers: {
    free_over_centavos: 150000,
    couriers: [
      { id: 'jnt', name: 'J&T Express', available: true, estimate: '2–5 business days', rates: { metro_manila: 4400, luzon: 4400, visayas: 7400, mindanao: 9000 } },
      { id: 'lbc', name: 'LBC', available: true, estimate: '3–6 business days', rates: { metro_manila: 6000, luzon: 8500, visayas: 11000, mindanao: 13000 } },
    ],
  },
  payment_methods: {
    gcash: { enabled: true, instructions: 'Demo only. No payment is needed. Use any file as your "screenshot".', account_name: 'Demo Shop', account_number: '0900 000 0000' },
    maya: { enabled: false }, bank_transfer: { enabled: true, instructions: 'Demo only. No real transfer is needed.', account_name: 'Demo Shop', account_number: '0000 0000 0000', bank: 'Sample Bank' },
    cod: { enabled: true, instructions: 'Pay the courier when your parcel arrives.' }, card: { enabled: false },
  },
  promo_banner: { enabled: true, title: 'Bazaar weekend: 10% off', text: 'Use code WELCOME10 at checkout. Demo code, works once per order.', cta: 'Shop now', link: '/shop' },
  socials: { instagram: 'https://www.instagram.com/bunini_loves/' },
  contact: { email: 'hello@example.com' },
  currency: { enabled: true, rates: { USD: 0.0172, EUR: 0.0158, GBP: 0.0135, JPY: 2.6, AUD: 0.0262, SGD: 0.0231 }, updated_at: null },
  pinned: { products: ['prod-pastel-stationery-set', 'prod-bunny-hug-sticker-sheet', 'prod-pocket-bunny-notebook'], reviews: [] },
}

export const DISCOUNT_ROWS: Row[] = [
  { id: 'disc-1', code: 'WELCOME10', percent_off: 10, amount_off_centavos: null, min_subtotal_centavos: 0, max_uses: null, used_count: 6, starts_at: null, ends_at: null, is_active: true },
  { id: 'disc-2', code: 'BUNNY50', percent_off: null, amount_off_centavos: 5000, min_subtotal_centavos: 50000, max_uses: 100, used_count: 2, starts_at: null, ends_at: null, is_active: true },
]